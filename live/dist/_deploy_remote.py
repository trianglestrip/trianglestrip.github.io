"""Deploy live/dist: zip upload + remote unzip + systemd."""
import os
import stat
import sys
import tempfile
import time
import zipfile

import paramiko

HOST = "106.14.46.209"
USER = "root"
PASSWORD = "Sf201225"
DEPLOY_ROOT = "/opt/live"
LOCAL_DIST = os.path.dirname(os.path.abspath(__file__))
REMOTE_ZIP = "/tmp/live-deploy.zip"


def log(msg: str) -> None:
    print(msg, flush=True)


def zip_dist(path: str) -> int:
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as zf:
        for folder in ("server", "web"):
            base = os.path.join(LOCAL_DIST, folder)
            for root, _, files in os.walk(base):
                for name in files:
                    full = os.path.join(root, name)
                    rel = os.path.relpath(full, LOCAL_DIST).replace("\\", "/")
                    zf.write(full, rel)
    return os.path.getsize(path)


def connect() -> paramiko.SSHClient:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30)
    return client


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 600) -> tuple[int, str]:
    log(f"$ {cmd[:120]}{'...' if len(cmd) > 120 else ''}")
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode()
    err = stderr.read().decode()
    code = stdout.channel.recv_exit_status()
    merged = (out + err).strip()
    if merged:
        log(merged[-4000:] if len(merged) > 4000 else merged)
    return code, merged


def upload_zip(client: paramiko.SSHClient, zip_path: str) -> None:
    size = os.path.getsize(zip_path)
    log(f"Uploading {size} bytes -> {REMOTE_ZIP}")
    sftp = client.open_sftp()
    mark = [0]

    def progress(done, total):
        if total and (done - mark[0] >= total // 10 or done == total):
            mark[0] = done
            log(f"  upload {done}/{total} ({100 * done // total}%)")

    sftp.put(zip_path, REMOTE_ZIP, callback=progress)
    sftp.chmod(REMOTE_ZIP, stat.S_IRUSR | stat.S_IWUSR)
    sftp.close()
    log("Upload done.")


def install_node(client: paramiko.SSHClient) -> None:
    code, out = run(client, "command -v node >/dev/null 2>&1 && node -v")
    if code == 0:
        return
    run(client, "yum install -y unzip 2>/dev/null || true", timeout=300)
    code, _ = run(client, "yum install -y nodejs 2>&1", timeout=600)
    if code != 0:
        run(client, "curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -", timeout=300)
        code, _ = run(client, "yum install -y nodejs", timeout=600)
    if code != 0:
        raise RuntimeError("Failed to install nodejs")
    run(client, "node -v && npm -v")


def deploy_files(client: paramiko.SSHClient) -> None:
    run(client, f"mkdir -p {DEPLOY_ROOT}/server/data")
    run(client, f"test -f {DEPLOY_ROOT}/server/data/follows-store.json && cp {DEPLOY_ROOT}/server/data/follows-store.json /tmp/follows-store.json.bak || true")
    code, _ = run(client, f"unzip -o {REMOTE_ZIP} -d {DEPLOY_ROOT}")
    if code != 0:
        raise RuntimeError("unzip failed")
    run(client, "test -f /tmp/follows-store.json.bak && mv /tmp/follows-store.json.bak " + f"{DEPLOY_ROOT}/server/data/follows-store.json || true")

    config = """{
  "host": "0.0.0.0",
  "port": 8765,
  "cors": { "enabled": true, "allowOrigin": "*" },
  "static": { "enabled": false, "distPath": "../web" }
}"""
    sftp = client.open_sftp()
    with sftp.file(f"{DEPLOY_ROOT}/server/config.json", "w") as f:
        f.write(config)
    sftp.close()

    run(client, f"sed -i 's/.listen(PORT, \"127.0.0.1\"/.listen(PORT, \"0.0.0.0\"/' {DEPLOY_ROOT}/web/server.mjs")


def setup_systemd(client: paramiko.SSHClient) -> None:
    _, out = run(client, "command -v node")
    node = out.strip().splitlines()[-1] if out.strip() else "/usr/bin/node"

    api_unit = f"""[Unit]
Description=Lemon Live API
After=network.target

[Service]
Type=simple
WorkingDirectory={DEPLOY_ROOT}/server
ExecStart={node} live-api.mjs
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
"""
    web_unit = f"""[Unit]
Description=Lemon Live Web
After=network.target live-api.service

[Service]
Type=simple
WorkingDirectory={DEPLOY_ROOT}/web
ExecStart={node} server.mjs 8080
Restart=on-failure
RestartSec=3
Environment=LIVE_API=http://127.0.0.1:8765

[Install]
WantedBy=multi-user.target
"""
    sftp = client.open_sftp()
    with sftp.file("/etc/systemd/system/live-api.service", "w") as f:
        f.write(api_unit)
    with sftp.file("/etc/systemd/system/live-web.service", "w") as f:
        f.write(web_unit)
    sftp.close()

    run(client, "systemctl daemon-reload")
    run(client, "systemctl enable live-api live-web")
    run(client, "systemctl restart live-api")
    time.sleep(2)
    run(client, "systemctl restart live-web")
    time.sleep(2)
    run(client, "systemctl is-active live-api live-web")
    run(client, "if systemctl is-active --quiet firewalld; then firewall-cmd --permanent --add-port=8080/tcp; firewall-cmd --permanent --add-port=8765/tcp; firewall-cmd --reload; fi || true")


def verify(client: paramiko.SSHClient) -> None:
    _, health = run(client, "curl -fsS http://127.0.0.1:8765/api/health")
    _, web = run(client, "curl -fsS -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/")
    if "FAIL" in health or web.strip() != "200":
        run(client, "journalctl -u live-api -u live-web --no-pager -n 30")
        raise RuntimeError(f"verify failed: api={health.strip()} web={web.strip()}")
    log(f"OK  API: {health.strip()}")
    log(f"OK  Web: {web.strip()}")
    log(f"Open: http://{HOST}:8080/")


def main() -> None:
    zip_path = os.path.join(tempfile.gettempdir(), "live-deploy.zip")
    log("1/5 Packaging...")
    size = zip_dist(zip_path)
    log(f"   zip {size} bytes")

    client = connect()
    try:
        log("2/5 Upload zip...")
        upload_zip(client, zip_path)
        log("3/5 Install Node...")
        install_node(client)
        log("4/5 Unzip + configure...")
        deploy_files(client)
        log("5/5 Start services...")
        setup_systemd(client)
        verify(client)
    finally:
        client.close()
        try:
            os.remove(zip_path)
        except OSError:
            pass


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        log(f"ERROR: {exc}")
        sys.exit(1)
