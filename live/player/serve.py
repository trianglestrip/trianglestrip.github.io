#!/usr/bin/env python3
"""本地直播 API 服务：解析后端 + 托管 live/web 前端。"""

from __future__ import annotations

import argparse
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
from resolve_service import resolve_room_sync

ROOT = Path(__file__).resolve().parent
WEB_ROOT = ROOT.parent / "web"
WEB_DIST = WEB_ROOT / "dist"

BUILD_HINT_HTML = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Live · 请先构建前端</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 42rem; margin: 3rem auto; padding: 0 1rem; line-height: 1.6; }
    code, pre { background: #f4f4f5; border-radius: 6px; }
    pre { padding: 1rem; overflow-x: auto; }
  </style>
</head>
<body>
  <h1>Vue 前端尚未构建</h1>
  <p>当前 <code>serve.py</code> 只托管 <code>live/web/dist/</code>，不能直接打开源码
  <code>index.html</code>（浏览器无法解析 <code>import "vue"</code> 等裸模块名）。</p>
  <p><strong>生产联调（:8765）</strong></p>
  <pre>cd live/web
npm install
npm run build

cd ../player
python serve.py</pre>
  <p><strong>开发热更新（:5173，推荐改 UI）</strong></p>
  <pre># 终端 1
cd live/player &amp;&amp; python serve.py

# 终端 2
cd live/web &amp;&amp; npm run dev</pre>
  <p>然后打开 <a href="http://127.0.0.1:5173/">http://127.0.0.1:5173/</a>（API 已 proxy 到 :8765）。</p>
  <p>Legacy 调试页仍可用：<a href="/legacy">/legacy</a></p>
</body>
</html>
"""


def resolve_web_root(web_root: Path) -> Path | None:
    """仅托管 Vue 构建产物 dist/；无 dist 时返回 None（展示构建说明页）。"""
    dist_index = web_root / "dist" / "index.html"
    if dist_index.is_file():
        return web_root / "dist"
    return None
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
    return resolve_room_sync(site, room_id, mode=mode, quality=quality)


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
    def __init__(self, *args, web_root: Path | None = None, **kwargs):
        self.web_root = web_root or WEB_ROOT
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
        if parsed.path.startswith("/api/"):
            if parsed.path == "/api/room":
                self._api_room(parsed)
                return
            if parsed.path == "/api/compare":
                self._api_compare(parsed)
                return
            self.send_error(404)
            return
        if parsed.path == "/legacy":
            self.path = "/player.html"
            return super().do_GET()
        return self._serve_web(parsed.path)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/resolve":
            self._api_resolve_post(parsed)
            return
        if parsed.path == "/api/compare":
            self._api_compare_post(parsed)
            return
        self.send_error(404)

    def _serve_web(self, path: str) -> None:
        if self.web_root is None:
            self._send_build_hint()
            return

        rel = path.lstrip("/") or "index.html"
        root = self.web_root.resolve()
        target = (self.web_root / rel).resolve()
        if not str(target).startswith(str(root)):
            self.send_error(403)
            return
        if target.is_dir():
            target = target / "index.html"
        if not target.is_file():
            # Vue Router history：非静态资源回退 index.html
            fallback = self.web_root / "index.html"
            if fallback.is_file() and not rel.startswith("api/"):
                target = fallback
            else:
                self.send_error(404)
                return
        content = target.read_bytes()
        content_type = self.guess_type(str(target))
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self._web_headers()
        self.end_headers()
        self.wfile.write(content)

    def _send_build_hint(self) -> None:
        content = BUILD_HINT_HTML.encode("utf-8")
        self.send_response(503)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(content)))
        self._cors()
        self.end_headers()
        self.wfile.write(content)

    def _web_headers(self) -> None:
        self._cors()
        # flv.js 等库可能注册 unload 监听；允许 self 可避免控制台 Permissions-Policy 警告
        self.send_header("Permissions-Policy", "unload=(self)")

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
    parser = argparse.ArgumentParser(description="启动直播 API + Web 前端")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--web-root", type=Path, default=WEB_ROOT)
    args = parser.parse_args()

    served_root = resolve_web_root(args.web_root)
    if served_root is not None:
        print(f"前端: 托管构建产物 {served_root}")
    elif not args.web_root.is_dir():
        print(f"警告: 前端目录不存在 {args.web_root}，仅提供 API 与 /legacy 调试页")
    else:
        print(f"警告: 未找到 {WEB_DIST / 'index.html'}")
        print("      请先: cd live/web && npm install && npm run build")
        print("      开发 UI 请用: cd live/web && npm run dev  →  http://127.0.0.1:5173/")

    def handler_factory(*handler_args, **handler_kwargs):
        return Handler(*handler_args, web_root=served_root, **handler_kwargs)

    server = ThreadingHTTPServer(("127.0.0.1", args.port), handler_factory)
    print(f"Web 页面: http://127.0.0.1:{args.port}/")
    print(f"Legacy 调试: http://127.0.0.1:{args.port}/legacy")
    print("API: GET /api/room?site=douyu|huya&room=<id>&mode=lazy|full")
    print("按 Ctrl+C 停止")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
