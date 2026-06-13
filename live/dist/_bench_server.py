import paramiko

HOST, USER, PASSWORD = "106.14.46.209", "root", "Sf201225"

SCRIPT = r"""
echo "=== server localhost ==="
curl -fsS -o /dev/null -w 'health:%{time_total}s\n' http://127.0.0.1:8765/api/health
curl -fsS -o /dev/null -w 'room_cold:%{time_total}s\n' 'http://127.0.0.1:8765/api/room?site=douyu&room=6188551&mode=lazy&force=1'
curl -fsS -o /dev/null -w 'room_warm:%{time_total}s\n' 'http://127.0.0.1:8765/api/room?site=douyu&room=6188551&mode=lazy'
curl -fsS -o /dev/null -w 'web_index:%{time_total}s\n' http://127.0.0.1:8080/
curl -fsS 'http://127.0.0.1:8765/api/time?site=douyu&room=6188551&run=1'
"""

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, password=PASSWORD, timeout=20)
_, o, e = c.exec_command(SCRIPT)
print((o.read() + e.read()).decode())
c.close()
