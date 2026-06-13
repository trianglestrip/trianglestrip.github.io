"""Upload web/ only and restart live-web."""
import os
import stat
import sys
import tempfile
import zipfile

import paramiko

HOST = "106.14.46.209"
USER = "root"
PASSWORD = "Sf201225"
DEPLOY_ROOT = "/opt/live"
REMOTE_ZIP = "/tmp/live-web.zip"
WEB_LOCAL = os.path.join(os.path.dirname(__file__), "web")


def main() -> None:
    zip_path = os.path.join(tempfile.gettempdir(), "live-web.zip")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, _, files in os.walk(WEB_LOCAL):
            for name in files:
                full = os.path.join(root, name)
                rel = os.path.relpath(full, WEB_LOCAL).replace("\\", "/")
                zf.write(full, f"web/{rel}")
    print(f"zip {os.path.getsize(zip_path)} bytes", flush=True)

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30)
    sftp = client.open_sftp()
    print("uploading...", flush=True)
    sftp.put(zip_path, REMOTE_ZIP)
    sftp.chmod(REMOTE_ZIP, stat.S_IRUSR | stat.S_IWUSR)
    sftp.close()

    cmds = [
        f"rm -rf {DEPLOY_ROOT}/web/assets",
        f"unzip -o {REMOTE_ZIP} -d {DEPLOY_ROOT}",
        "grep -q LIVE_BIND=0.0.0.0 /etc/systemd/system/live-web.service || sed -i '/Environment=LIVE_API=/a Environment=LIVE_BIND=0.0.0.0' /etc/systemd/system/live-web.service",
        "systemctl daemon-reload",
        "grep -o 'index-[A-Za-z0-9_-]*\\.js' " + f"{DEPLOY_ROOT}/web/index.html | head -1",
        "systemctl restart live-web",
        "sleep 1",
        "systemctl is-active live-web",
        "curl -fsS -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/",
    ]
    for cmd in cmds:
        print(f"$ {cmd}", flush=True)
        _, stdout, stderr = client.exec_command(cmd)
        out = (stdout.read() + stderr.read()).decode().strip()
        if out:
            print(out, flush=True)
        if stdout.channel.recv_exit_status() != 0:
            client.close()
            sys.exit(1)

    client.close()
    os.remove(zip_path)
    print("OK http://106.14.46.209:8080/", flush=True)


if __name__ == "__main__":
    main()
