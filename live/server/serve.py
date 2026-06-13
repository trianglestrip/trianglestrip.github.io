#!/usr/bin/env python3
"""直播解析 API 服务（默认仅 API，静态托管由 config.json 控制）。"""

from __future__ import annotations

import argparse
import asyncio
import json
import re
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from app_config import load_config, resolve_static_root
from browse_api import fetch_categories, fetch_category_rooms, fetch_recommend_rooms
from follow_status import fetch_follow_snapshots
from huya_danmaku import fetch_huya_danmaku_session
from resolve_cache import get as cache_get
from resolve_cache import set as cache_set
from resolve_cache import stats as cache_stats
from resolve_service import resolve_room_sync
from resolve_timing import build_time_report
from text_sanitize import sanitize_unicode

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


def resolve_local(site: str, room: str, *, mode: str = "lazy", quality: str | None = None, force: bool = False) -> dict:
    room_id = parse_room_id(room, site)
    return resolve_room_sync(site, room_id, mode=mode, quality=quality, force=force)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, web_root: Path | None = None, server_config: dict | None = None, **kwargs):
        self.web_root = web_root
        self.server_config = server_config or {}
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
            if parsed.path == "/api/health":
                self._api_health()
                return
            if parsed.path == "/api/room":
                self._api_room(parsed)
                return
            if parsed.path == "/api/categories":
                self._api_categories(parsed)
                return
            if parsed.path == "/api/rooms":
                self._api_rooms(parsed)
                return
            if parsed.path == "/api/time":
                self._api_time(parsed)
                return
            if parsed.path == "/api/huya/danmaku":
                self._api_huya_danmaku(parsed)
                return
            self.send_error(404)
            return
        return self._serve_web(parsed.path)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/resolve":
            self._api_resolve_post(parsed)
            return
        if parsed.path == "/api/follows/status":
            self._api_follows_status()
            return
        self.send_error(404)

    def _serve_web(self, path: str) -> None:
        if self.web_root is None:
            self._send_api_only()
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

    def _send_api_only(self) -> None:
        self._send_json(
            {
                "ok": False,
                "error": "本服务仅提供 API。请单独部署前端，或在 server/config.json 中开启 static.enabled。",
            },
            status=404,
        )

    def _web_headers(self) -> None:
        self._cors()
        # flv.js 等库可能注册 unload 监听；允许 self 可避免控制台 Permissions-Policy 警告
        self.send_header("Permissions-Policy", "unload=(self)")
        if self.web_root is not None:
            self.send_header("X-Live-Web-Root", str(self.web_root))

    def _api_health(self) -> None:
        static_cfg = self.server_config.get("static") or {}
        payload = {
            "ok": True,
            "mode": "static+api" if self.web_root else "api-only",
            "host": self.server_config.get("host"),
            "port": self.server_config.get("port"),
            "static_enabled": bool(static_cfg.get("enabled")),
            "static_root": str(self.web_root) if self.web_root else None,
            "browse_api": True,
            "resolve_cache": cache_stats(),
        }
        self._send_json(payload)

    def _read_json_body(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length).decode("utf-8") if length else ""
        if not body:
            return {}
        return json.loads(body)

    def _query_room(self, parsed) -> tuple[str, str, str, str, bool]:
        query = parse_qs(parsed.query)
        site = query.get("site", ["douyu"])[0]
        room = query.get("room", query.get("id", ["9999"]))[0]
        mode = query.get("mode", ["lazy"])[0]
        quality = query.get("quality", [""])[0]
        force = query.get("force", ["0"])[0].lower() in ("1", "true", "yes")
        return site, room, mode, quality, force

    def _api_room(self, parsed) -> None:
        site, room, mode, quality, force = self._query_room(parsed)
        try:
            payload = resolve_local(site, room, mode=mode, quality=quality or None, force=force)
            if not payload.get("is_live") and not payload.get("status"):
                self._send_json({"ok": False, "error": "房间未开播"}, status=404)
                return
            self._send_json(finalize_payload(payload))
        except Exception as exc:  # noqa: BLE001
            self._send_json({"ok": False, "error": str(exc)}, status=500)

    def _api_categories(self, parsed) -> None:
        query = parse_qs(parsed.query)
        site = query.get("site", ["douyu"])[0]
        cache_key = f"browse:categories:{site}"
        cached = cache_get(cache_key)
        if cached:
            self._send_json({"ok": True, "site": site, "categories": cached, "cached": True})
            return
        try:
            categories = fetch_categories(site)
            cache_set(cache_key, categories, ttl=300)
            self._send_json({"ok": True, "site": site, "categories": categories})
        except Exception as exc:  # noqa: BLE001
            self._send_json({"ok": False, "error": str(exc)}, status=500)

    def _api_rooms(self, parsed) -> None:
        query = parse_qs(parsed.query)
        site = query.get("site", ["douyu"])[0]
        page = int(query.get("page", ["1"])[0] or 1)
        cid = query.get("cid", query.get("id", [""]))[0]
        pid = query.get("pid", [""])[0] or None
        recommend = query.get("recommend", [""])[0] in ("1", "true", "yes")
        cache_key = f"browse:rooms:{site}:{'rec' if recommend else cid}:{pid or ''}:{page}"
        cached = cache_get(cache_key)
        if cached:
            self._send_json({"ok": True, "site": site, **cached, "cached": True})
            return
        try:
            if recommend:
                payload = fetch_recommend_rooms(site, page=page)
            else:
                if not cid:
                    self._send_json({"ok": False, "error": "缺少 cid 参数"}, status=400)
                    return
                payload = fetch_category_rooms(site, cid, page=page, pid=pid)
            result = {
                "list": payload.get("list") or [],
                "hasMore": bool(payload.get("hasMore")),
                "page": page,
            }
            if not recommend:
                result["cid"] = cid
                if pid:
                    result["pid"] = pid
            cache_set(cache_key, result, ttl=60)
            self._send_json({"ok": True, "site": site, **result})
        except Exception as exc:  # noqa: BLE001
            self._send_json({"ok": False, "error": str(exc)}, status=500)

    def _api_huya_danmaku(self, parsed) -> None:
        query = parse_qs(parsed.query)
        room = query.get("room", query.get("id", [""]))[0]
        if not room:
            self._send_json({"ok": False, "error": "缺少 room 参数"}, status=400)
            return
        try:
            session = fetch_huya_danmaku_session(room)
            self._send_json({"ok": True, **session})
        except Exception as exc:  # noqa: BLE001
            self._send_json({"ok": False, "error": str(exc)}, status=500)

    def _api_time(self, parsed) -> None:
        query = parse_qs(parsed.query)
        site = query.get("site", ["douyu"])[0]
        room = query.get("room", query.get("id", ["252140"]))[0]
        quality = query.get("quality", [""])[0] or None
        run = query.get("run", ["0"])[0].lower() in ("1", "true", "yes")
        try:
            room_id = parse_room_id(room, site)
            payload = build_time_report(site, room_id, quality=quality, run=run)
            self._send_json(payload)
        except Exception as exc:  # noqa: BLE001
            self._send_json({"ok": False, "error": str(exc)}, status=500)

    def _api_follows_status(self) -> None:
        try:
            data = self._read_json_body()
        except json.JSONDecodeError:
            self._send_json({"ok": False, "error": "无效 JSON"}, status=400)
            return
        rooms = data.get("rooms")
        if not isinstance(rooms, list):
            self._send_json({"ok": False, "error": "缺少 rooms 数组"}, status=400)
            return
        try:
            snapshots = asyncio.run(fetch_follow_snapshots(rooms))
            self._send_json({"ok": True, "list": snapshots})
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
        site = str(data.get("site") or query.get("site", ["douyu"])[0])

        try:
            mode = str(data.get("mode") or query.get("mode", ["lazy"])[0])
            quality = str(data.get("quality") or query.get("quality", [""])[0]) or None
            force = str(data.get("force") or query.get("force", ["0"])[0]).lower() in ("1", "true", "yes")
            payload = resolve_local(site, room, mode=mode, quality=quality, force=force)
            self._send_json(finalize_payload(payload))
        except Exception as exc:  # noqa: BLE001
            self._send_json({"ok": False, "error": str(exc)}, status=500)

    def _cors(self) -> None:
        cors = self.server_config.get("cors") or {}
        if cors.get("enabled", True):
            self.send_header("Access-Control-Allow-Origin", cors.get("allowOrigin", "*"))
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            # HTTPS 公网页（如 GitHub Pages）访问本机 API 时需要
            self.send_header("Access-Control-Allow-Private-Network", "true")

    def _send_json(self, payload: dict, *, status: int = 200) -> None:
        data = json.dumps(sanitize_unicode(payload), ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self._cors()
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, format: str, *args) -> None:  # noqa: A003
        print(f"[{self.log_date_time_string()}] {format % args}")


def main() -> int:
    parser = argparse.ArgumentParser(description="启动直播解析 API 服务")
    parser.add_argument("--config", type=Path, default=None, help="配置文件路径，默认 server/config.json")
    parser.add_argument("--port", type=int, default=None, help="覆盖 config.json 中的 port")
    args = parser.parse_args()

    cfg = load_config(args.config)
    if args.port is not None:
        cfg["port"] = args.port

    host = str(cfg.get("host") or "127.0.0.1")
    port = int(cfg.get("port") or 8765)
    served_root = resolve_static_root(cfg)

    if served_root is not None:
        print(f"静态托管: {served_root}")
    else:
        static_cfg = cfg.get("static") or {}
        if static_cfg.get("enabled"):
            print("警告: static.enabled=true 但未找到 dist/index.html，仅提供 API")
        else:
            print("模式: 仅 API（前后端解耦，前端请单独部署）")

    def handler_factory(*handler_args, **handler_kwargs):
        return Handler(*handler_args, web_root=served_root, server_config=cfg, **handler_kwargs)

    try:
        server = ThreadingHTTPServer((host, port), handler_factory)
    except OSError as exc:
        print(f"错误: 无法绑定 {host}:{port}（{exc}）")
        print("      可能已有旧 serve.py 在运行。Windows 可先执行:")
        print(f"      netstat -ano | findstr :{port}")
        print("      taskkill /PID <pid> /F")
        print("      或直接运行: .\\start.ps1")
        return 1

    print(f"API: http://{host}:{port}/api/health")
    print("     GET /api/room?site=douyu|huya&room=<id>&mode=lazy|full")
    print("     GET /api/categories?site=douyu|huya")
    print("     GET /api/rooms?site=douyu|huya&cid=<id>&page=1")
    print("     GET /api/rooms?site=douyu|huya&recommend=1&page=1")
    print("配置: server/config.json（可选 config.local.json 覆盖）")
    print("按 Ctrl+C 停止")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
