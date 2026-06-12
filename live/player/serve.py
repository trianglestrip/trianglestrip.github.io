#!/usr/bin/env python3
"""本地直播测试服务：纯解析 API、muxia 对比与播放器页面（无流转发）。"""

from __future__ import annotations

import argparse
import asyncio
import json
import re
from concurrent.futures import ThreadPoolExecutor
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from compare_streams import compare_room_payloads
from muxia_api import fetch_room, normalize_room
from resolve_cache import get as cache_get
from resolve_cache import set as cache_set
from resolve_douyu import normalize_url as douyu_normalize_url
from resolve_douyu import resolve_all as douyu_resolve_all
from resolve_douyu import resolve_douyu_lazy
from resolve_huya import normalize_url as huya_normalize_url
from resolve_huya import resolve_all as huya_resolve_all
from resolve_huya import resolve_huya_lazy

ROOT = Path(__file__).resolve().parent
ROOM_RES = {
    "douyu": re.compile(r"(?:douyu\.com/)?(\d+)$"),
    "huya": re.compile(r"(?:huya\.com/)?(\d+)$"),
}


def parse_room_id(value: str, site: str = "douyu") -> str:
    text = value.strip()
    if text.isdigit():
        return text
    cleaned = text.replace("https://", "").replace("http://", "")
    pattern = ROOM_RES.get(site) or ROOM_RES["douyu"]
    match = pattern.search(cleaned)
    if match:
        return match.group(1)
    raise ValueError(f"无效房间号: {value}")


def finalize_payload(payload: dict) -> dict:
    payload["ok"] = True
    return payload


def resolve_local(site: str, room: str, *, mode: str = "lazy", quality: str | None = None) -> dict:
    room_id = parse_room_id(room, site)
    quality_key = (quality or "").strip() or "*"
    cache_key = f"local:{site}:{room_id}:{mode}:{quality_key}"
    cached = cache_get(cache_key)
    if cached:
        cached["cached"] = True
        return cached

    if site == "huya":
        url = huya_normalize_url(room_id)
        if mode == "full":
            payload = asyncio.run(huya_resolve_all(url))
        else:
            payload = asyncio.run(resolve_huya_lazy(url, quality_name=quality or None))
    elif site == "douyu":
        url = douyu_normalize_url(room_id)
        if mode == "full":
            payload = asyncio.run(douyu_resolve_all(url))
        else:
            payload = asyncio.run(resolve_douyu_lazy(url, quality_name=quality or None))
    else:
        raise ValueError(f"暂不支持平台: {site}")

    payload["source"] = "streamget"
    payload["site"] = site
    payload["room_id"] = room_id
    cache_set(cache_key, payload)
    return payload


def resolve_muxia(site: str, room: str) -> dict:
    room_id = parse_room_id(room, site)
    cache_key = f"muxia:{site}:{room_id}"
    cached = cache_get(cache_key)
    if cached:
        cached["cached"] = True
        return cached
    data = fetch_room(site, room_id)
    payload = normalize_room(site, room_id, data)
    cache_set(cache_key, payload)
    return payload


def compare_room(site: str, room: str) -> dict:
    room_id = parse_room_id(room, site)
    with ThreadPoolExecutor(max_workers=2) as pool:
        local_future = pool.submit(resolve_local, site, room_id, mode="full")
        muxia_future = pool.submit(resolve_muxia, site, room_id)
        local = local_future.result()
        muxia = muxia_future.result()
    comparison = compare_room_payloads(local, muxia)
    return {
        "ok": True,
        "site": site,
        "room_id": room_id,
        "local": local,
        "muxia": muxia,
        "compare": comparison,
    }


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
        if parsed.path == "/api/compare":
            self._api_compare(parsed)
            return
        if parsed.path == "/":
            self.path = "/player.html"
        return super().do_GET()

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/resolve":
            self._api_resolve_post(parsed)
            return
        if parsed.path == "/api/compare":
            self._api_compare_post(parsed)
            return
        self.send_error(404)

    def _read_json_body(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length).decode("utf-8") if length else ""
        if not body:
            return {}
        return json.loads(body)

    def _query_room(self, parsed) -> tuple[str, str, str, str, str]:
        query = parse_qs(parsed.query)
        site = query.get("site", ["douyu"])[0]
        room = query.get("room", query.get("id", ["9999"]))[0]
        source = query.get("source", ["local"])[0]
        mode = query.get("mode", ["lazy"])[0]
        quality = query.get("quality", [""])[0]
        return site, room, source, mode, quality

    def _api_room(self, parsed) -> None:
        site, room, source, mode, quality = self._query_room(parsed)
        try:
            if source == "local":
                payload = resolve_local(site, room, mode=mode, quality=quality or None)
            else:
                payload = resolve_muxia(site, room)
            if not payload.get("is_live") and not payload.get("status"):
                self._send_json({"ok": False, "error": "房间未开播"}, status=404)
                return
            self._send_json(finalize_payload(payload))
        except Exception as exc:  # noqa: BLE001
            self._send_json({"ok": False, "error": str(exc)}, status=500)

    def _api_compare(self, parsed) -> None:
        site, room, _, _, _ = self._query_room(parsed)
        try:
            payload = compare_room(site, room)
            if not payload["local"].get("is_live") and not payload["local"].get("status"):
                self._send_json({"ok": False, "error": "房间未开播"}, status=404)
                return
            self._send_json(payload)
        except Exception as exc:  # noqa: BLE001
            self._send_json({"ok": False, "error": str(exc)}, status=500)

    def _api_resolve_post(self, parsed) -> None:
        query = parse_qs(parsed.query)
        try:
            data = self._read_json_body()
        except json.JSONDecodeError:
            self._send_json({"ok": False, "error": "无效 JSON"}, status=400)
            return

        room = str(data.get("room") or query.get("room", ["9999"])[0])
        source = str(data.get("source") or query.get("source", ["local"])[0])
        site = str(data.get("site") or query.get("site", ["douyu"])[0])

        try:
            if source == "muxia":
                payload = resolve_muxia(site, room)
            else:
                mode = str(data.get("mode") or query.get("mode", ["lazy"])[0])
                quality = str(data.get("quality") or query.get("quality", [""])[0]) or None
                payload = resolve_local(site, room, mode=mode, quality=quality)
            self._send_json(finalize_payload(payload))
        except Exception as exc:  # noqa: BLE001
            self._send_json({"ok": False, "error": str(exc)}, status=500)

    def _api_compare_post(self, parsed) -> None:
        query = parse_qs(parsed.query)
        try:
            data = self._read_json_body()
        except json.JSONDecodeError:
            self._send_json({"ok": False, "error": "无效 JSON"}, status=400)
            return
        site = str(data.get("site") or query.get("site", ["douyu"])[0])
        room = str(data.get("room") or query.get("room", ["9999"])[0])
        try:
            self._send_json(compare_room(site, room))
        except Exception as exc:  # noqa: BLE001
            self._send_json({"ok": False, "error": str(exc)}, status=500)

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
    parser = argparse.ArgumentParser(description="启动直播测试服务（纯解析）")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()

    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    print(f"播放页: http://127.0.0.1:{args.port}/")
    print("API: GET /api/room?mode=lazy&quality=<档名> | GET /api/compare?room=<id>")
    print("按 Ctrl+C 停止")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
