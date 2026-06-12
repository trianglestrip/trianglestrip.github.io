#!/usr/bin/env python3
"""斗鱼解析 + 静态播放页：仅返回 douyucdn 直链，不转发流。"""

from __future__ import annotations

import argparse
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from douyu_resolve import compare_douyu, resolve_douyu

ROOT = Path(__file__).resolve().parent
LSF_BASE = "http://127.0.0.1:8770"


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, directory: str | None = None, **kwargs) -> None:
        super().__init__(*args, directory=directory or str(ROOT), **kwargs)

    def _cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path == "/api/config":
            self._send_json(
                {
                    "lsf_base": LSF_BASE,
                    "douyu_default": "streamget",
                    "proxy": False,
                }
            )
            return
        if parsed.path == "/api/room":
            self._api_room(parsed)
            return
        if parsed.path == "/api/compare":
            self._api_compare(parsed)
            return
        if parsed.path == "/":
            self.path = "/player.html"
        if parsed.path == "/favicon.ico":
            self.send_response(204)
            self.end_headers()
            return
        return super().do_GET()

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self._cors()
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers()

    def _api_room(self, parsed) -> None:
        query = parse_qs(parsed.query)
        room = query.get("room", query.get("id", ["9999"]))[0]
        try:
            payload = resolve_douyu(room)
            if not payload.get("is_live") and not payload.get("status"):
                self._send_json({"ok": False, "error": "房间未开播"}, status=404)
                return
            self._send_json(payload)
        except Exception as exc:  # noqa: BLE001
            self._send_json({"ok": False, "error": str(exc)}, status=500)

    def _api_compare(self, parsed) -> None:
        query = parse_qs(parsed.query)
        room = query.get("room", query.get("id", ["9999"]))[0]
        try:
            payload = compare_douyu(room)
            if not payload["local"].get("is_live") and not payload["local"].get("status"):
                self._send_json({"ok": False, "error": "房间未开播"}, status=404)
                return
            self._send_json(payload)
        except Exception as exc:  # noqa: BLE001
            self._send_json({"ok": False, "error": str(exc)}, status=500)

    def _send_json(self, payload: dict, *, status: int = 200) -> None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self._cors()
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, format: str, *args) -> None:  # noqa: A003
        print(f"[{self.log_date_time_string()}] {format % args}")


def main() -> int:
    global LSF_BASE
    parser = argparse.ArgumentParser(description="斗鱼解析播放页（无流代理）")
    parser.add_argument("--port", type=int, default=8771)
    parser.add_argument("--lsf-port", type=int, default=8770)
    args = parser.parse_args()
    LSF_BASE = f"http://127.0.0.1:{args.lsf_port}"

    server = ThreadingHTTPServer(
        ("127.0.0.1", args.port),
        lambda *a, **kw: Handler(*a, directory=str(ROOT), **kw),
    )
    print(f"播放页: http://127.0.0.1:{args.port}/")
    print(f"斗鱼 API: GET /api/room?room=<id> | GET /api/compare?room=<id>")
    print(f"其他平台 VLC: {LSF_BASE}/<site>/<room>")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
