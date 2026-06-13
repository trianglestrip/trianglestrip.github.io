"""Upload server/ only and restart live-api."""
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
REMOTE_ZIP = "/tmp/live-api.zip"
SERVER_LOCAL = os.path.join(os.path.dirname(__file__), "server")

SERVER_CONFIG = """{
  "host": "0.0.0.0",
  "port": 8765,
  "cors": { "enabled": true, "allowOrigin": "*" },
  "static": { "enabled": false, "distPath": "../web" }
}
"""


def main() -> None:
    zip_path = os.path.join(tempfile.gettempdir(), "live-api.zip")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, _, files in os.walk(SERVER_LOCAL):
            for name in files:
                if name == "config.json":
                    continue
                full = os.path.join(root, name)
                rel = os.path.relpath(full, SERVER_LOCAL).replace("\\", "/")
                if rel.startswith("data/") or rel == "data":
                    continue
                zf.write(full, f"server/{rel}")
    print(f"zip {os.path.getsize(zip_path)} bytes", flush=True)

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30)
    sftp = client.open_sftp()
    print("uploading...", flush=True)
    sftp.put(zip_path, REMOTE_ZIP)
    sftp.chmod(REMOTE_ZIP, stat.S_IRUSR | stat.S_IWUSR)
    with sftp.file(f"{DEPLOY_ROOT}/server/config.json", "w") as f:
        f.write(SERVER_CONFIG)
    sftp.close()

    cmds = [
        f"mkdir -p {DEPLOY_ROOT}/server/data",
        f"test -f {DEPLOY_ROOT}/server/data/follows-store.json && cp {DEPLOY_ROOT}/server/data/follows-store.json /tmp/follows-store.json.bak || true",
        f"unzip -o {REMOTE_ZIP} -d {DEPLOY_ROOT}",
        "test -f /tmp/follows-store.json.bak && mv /tmp/follows-store.json.bak " + f"{DEPLOY_ROOT}/server/data/follows-store.json || true",
        "systemctl restart live-api",
        "sleep 2",
        "systemctl is-active live-api",
        "curl -fsS http://127.0.0.1:8765/api/health",
        "curl -fsS -o /dev/null -w 'room:%{time_total}s %{http_code}\\n' 'http://127.0.0.1:8765/api/room?site=douyu&room=6188551&mode=lazy&force=1'",
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
    print("OK API http://106.14.46.209:8765/", flush=True)


if __name__ == "__main__":
    main()
