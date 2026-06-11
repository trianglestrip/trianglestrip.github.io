#!/usr/bin/env python3
"""本地直播测试服务：解析 API、FLV 代理与播放器页面。"""

from __future__ import annotations

import argparse
import json
import re
import secrets
import subprocess
import sys
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import requests

from muxia_api import fetch_room, normalize_room

ROOT = Path(__file__).resolve().parent
STREAM_FILE = ROOT / "stream.json"
PROXY_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Referer": "https://www.douyu.com/",
    "Origin": "https://www.douyu.com",
    "Accept": "*/*",
    "Accept-Encoding": "identity",
    "Connection": "close",
}
CHUNK_SIZE = 64 * 1024
FLV_MAGIC = b"FLV"
SESSION_TTL_SECONDS = 3600
ROOM_RE = re.compile(r"(?:douyu\.com/)?(\d+)$")

PROXY_SESSIONS: dict[str, dict] = {}


def register_proxy_session(play_url: str, backup_urls: list[str]) -> str:
    sid = secrets.token_urlsafe(8)
    urls: list[str] = []
    seen: set[str] = set()
    for item in [play_url, *backup_urls]:
        if item and item not in seen:
            seen.add(item)
            urls.append(item)
    PROXY_SESSIONS[sid] = {
        "urls": urls,
        "expires": time.time() + SESSION_TTL_SECONDS,
    }
    return sid


def get_session_urls(sid: str) -> list[str]:
    session = PROXY_SESSIONS.get(sid)
    if not session:
        return []
    if session["expires"] < time.time():
        PROXY_SESSIONS.pop(sid, None)
        return []
    return session["urls"]


def parse_room_id(value: str) -> str:
    text = value.strip()
    if text.isdigit():
        return text
    match = ROOM_RE.search(text.replace("https://", "").replace("http://", ""))
    if match:
        return match.group(1)
    raise ValueError(f"无效房间号: {value}")


def attach_proxy(payload: dict) -> dict:
    play_url = payload.get("play_url") or payload.get("flv_url") or payload.get("m3u8_url") or ""
    backup_urls = payload.get("backup_urls") or []
    sid = register_proxy_session(play_url, backup_urls)
    payload["proxy_sid"] = sid
    payload["proxy_url"] = f"/api/proxy?sid={sid}&mode=live"
    payload["ok"] = True
    return payload


def normalize_streamget(payload: dict) -> dict:
    play_url = payload.get("play_url") or payload.get("flv_url") or payload.get("m3u8_url") or ""
    backup_urls = [
        item
        for item in (payload.get("backup_urls") or [])
        if item and item != play_url and "douyucdn" in item and "edgesrv.com" not in item
    ]
    lines = []
    if play_url:
        lines.append({"name": "主线路", "url": play_url})
    for index, url in enumerate(backup_urls, start=2):
        lines.append({"name": f"备用{index}", "url": url})
    if lines:
        payload["streams"] = [{"name": payload.get("quality") or "默认", "lines": lines}]
    payload["title"] = payload.get("anchor_name") or payload.get("title") or ""
    payload["status"] = bool(payload.get("is_live"))
    return payload


def resolve_local(room: str, quality: str) -> dict:
    cmd = [sys.executable, str(ROOT / "resolve_douyu.py"), room, "--quality", quality]
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    if result.returncode != 0:
        detail = result.stderr.strip() or result.stdout.strip() or "resolve failed"
        raise RuntimeError(detail)
    payload = json.loads(STREAM_FILE.read_text(encoding="utf-8"))
    payload["source"] = "streamget"
    payload["site"] = "douyu"
    payload["room_id"] = parse_room_id(room)
    return normalize_streamget(payload)


def resolve_muxia(site: str, room: str) -> dict:
    room_id = parse_room_id(room)
    data = fetch_room(site, room_id)
    return normalize_room(site, room_id, data)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/favicon.ico":
            self.send_response(204)
            self.end_headers()
            return
        if parsed.path == "/api/room":
            self._api_room(parsed)
            return
        if parsed.path == "/api/stream":
            self._send_stream_json()
            return
        if parsed.path == "/api/proxy":
            query = parse_qs(parsed.query)
            sid = query.get("sid", [""])[0]
            mode = query.get("mode", ["segment"])[0]
            if sid:
                self._proxy_stream_by_sid(sid, mode=mode)
                return
            target = query.get("url", [""])[0]
            self._proxy_stream(target)
            return
        if parsed.path == "/":
            self.path = "/player.html"
        return super().do_GET()

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/resolve":
            self._api_resolve_post(parsed)
            return
        if parsed.path == "/api/proxy/register":
            self._api_proxy_register()
            return
        self.send_error(404)

    def _read_json_body(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length).decode("utf-8") if length else ""
        if not body:
            return {}
        return json.loads(body)

    def _api_room(self, parsed) -> None:
        query = parse_qs(parsed.query)
        site = query.get("site", ["douyu"])[0]
        room = query.get("room", query.get("id", ["9999"]))[0]
        source = query.get("source", ["muxia"])[0]
        quality = query.get("quality", ["OD"])[0]
        try:
            if source == "local":
                payload = resolve_local(room, quality)
            else:
                payload = resolve_muxia(site, room)
            if not payload.get("is_live") and not payload.get("status"):
                self._send_json({"ok": False, "error": "房间未开播"}, status=404)
                return
            self._send_json(attach_proxy(payload))
        except Exception as exc:  # noqa: BLE001
            self._send_json({"ok": False, "error": str(exc)}, status=500)

    def _api_proxy_register(self) -> None:
        try:
            data = self._read_json_body()
        except json.JSONDecodeError:
            self._send_json({"ok": False, "error": "无效 JSON"}, status=400)
            return

        play_url = str(data.get("play_url") or "").strip()
        if not play_url.startswith(("http://", "https://")):
            self._send_json({"ok": False, "error": "缺少有效 play_url"}, status=400)
            return

        backup_urls = [str(item) for item in (data.get("backup_urls") or []) if item]
        self._send_json(attach_proxy({"play_url": play_url, "backup_urls": backup_urls}))

    def _api_resolve_post(self, parsed) -> None:
        query = parse_qs(parsed.query)
        try:
            data = self._read_json_body()
        except json.JSONDecodeError:
            self._send_json({"ok": False, "error": "无效 JSON"}, status=400)
            return

        room = str(data.get("room") or query.get("room", ["9999"])[0])
        quality = str(data.get("quality") or query.get("quality", ["OD"])[0])
        source = str(data.get("source") or query.get("source", ["local"])[0])
        site = str(data.get("site") or query.get("site", ["douyu"])[0])

        try:
            if source == "muxia":
                payload = resolve_muxia(site, room)
            else:
                payload = resolve_local(room, quality)
            self._send_json(attach_proxy(payload))
        except Exception as exc:  # noqa: BLE001
            self._send_json({"ok": False, "error": str(exc)}, status=500)

    def _open_upstream(self, target: str) -> requests.Response | None:
        try:
            upstream = requests.get(
                target,
                headers=PROXY_HEADERS,
                stream=True,
                timeout=(15, None),
            )
            upstream.raise_for_status()
            return upstream
        except requests.RequestException:
            return None

    def _send_flv_headers(self) -> None:
        self.send_response(200)
        self.send_header("Content-Type", "video/x-flv")
        self._cors()
        self.send_header("Cache-Control", "no-cache, no-store")
        self.send_header("Connection", "close")
        self.end_headers()

    def _pipe_upstream(
        self,
        upstream: requests.Response,
        *,
        first_chunk: bytes = b"",
    ) -> None:
        pending = first_chunk
        while True:
            chunk = pending or upstream.raw.read(CHUNK_SIZE)
            pending = b""
            if not chunk:
                break
            self.wfile.write(chunk)
            self.wfile.flush()

    def _proxy_stream_by_sid(self, sid: str, *, mode: str = "segment") -> None:
        targets = get_session_urls(sid)
        if not targets:
            self.send_error(404, "session expired, resolve again")
            return

        target = ""
        for candidate in targets:
            upstream = self._open_upstream(candidate)
            if upstream is None:
                continue
            first = upstream.raw.read(4)
            if not first.startswith(FLV_MAGIC):
                upstream.close()
                continue
            target = candidate
            try:
                self._send_flv_headers()
                self.wfile.write(first)
                self._pipe_upstream(upstream)
            except (BrokenPipeError, ConnectionResetError, OSError):
                upstream.close()
                return
            finally:
                upstream.close()
            break

        if not target:
            self.send_error(502, "no playable upstream")
            return

        # live / segment 均单次上游连接后结束；由 flv.js isLive 自动重连同一代理 URL。
        # 切勿在同一条 HTTP 响应里拼接多段 FLV，否则时间戳回绕会导致一秒一卡。

    def _proxy_stream(self, target: str) -> None:
        if not target.startswith(("http://", "https://")):
            self._send_json({"ok": False, "error": "无效的流地址"}, status=400)
            return

        upstream = self._open_upstream(target)
        if upstream is None:
            self.send_error(502, "upstream failed")
            return
        first = upstream.raw.read(4)
        if not first.startswith(FLV_MAGIC):
            upstream.close()
            self.send_error(502, "upstream is not flv")
            return
        try:
            self._send_flv_headers()
            self.wfile.write(first)
            self._pipe_upstream(upstream)
        except (BrokenPipeError, ConnectionResetError, OSError):
            pass
        finally:
            upstream.close()

    def _send_stream_json(self) -> None:
        if not STREAM_FILE.exists():
            self._send_json({"ok": False, "error": "stream.json 不存在，请先运行 resolve_douyu.py"}, status=404)
            return
        payload = json.loads(STREAM_FILE.read_text(encoding="utf-8"))
        payload["source"] = "streamget"
        self._send_json(attach_proxy(payload))

    def _cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")

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
    parser = argparse.ArgumentParser(description="启动直播测试服务")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()

    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    print(f"播放页: http://127.0.0.1:{args.port}/")
    print("按 Ctrl+C 停止")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
