"""lemon-live 同款 muxia 解析 API 封装。"""

from __future__ import annotations

import json
from typing import Any
from urllib.parse import urlencode

import lzstring
import requests

from text_sanitize import sanitize_unicode

MUXIA_BASE = "https://live.muxia.site/api/"
MUXIA_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Referer": "https://lemonlive.deno.dev/",
}


def _decode_payload(raw: str) -> dict[str, Any]:
    if not raw:
        raise RuntimeError("muxia API 返回空响应")
    text = lzstring.LZString.decompressFromBase64(raw)
    if not text:
        raise RuntimeError("muxia 响应解码失败")
    payload = json.loads(text)
    if payload.get("code") != 200:
        raise RuntimeError(payload.get("msg") or "muxia API 错误")
    return sanitize_unicode(payload["data"])


def fetch_muxia(site: str, action: str, params: dict[str, Any] | None = None) -> Any:
    query = urlencode({k: v for k, v in (params or {}).items() if v is not None and v != ""})
    url = f"{MUXIA_BASE}{site}/{action}"
    if query:
        url = f"{url}?{query}"
    resp = requests.get(url, headers=MUXIA_HEADERS, timeout=20)
    resp.raise_for_status()
    return _decode_payload(resp.text)


def fetch_room(site: str, room_id: str) -> dict[str, Any]:
    return fetch_muxia(site, "getRoomDetail", {"id": room_id})


def fetch_categories(site: str) -> list[dict[str, Any]]:
    data = fetch_muxia(site, "getCategories")
    return data if isinstance(data, list) else []


def fetch_category_rooms(
    site: str,
    category_id: str | int,
    *,
    page: int = 1,
    pid: str | int | None = None,
) -> dict[str, Any]:
    params: dict[str, Any] = {"id": category_id, "page": page}
    if pid is not None:
        params["pid"] = pid
    data = fetch_muxia(site, "getCategoryRooms", params)
    return data if isinstance(data, dict) else {"list": [], "hasMore": False}


def fetch_recommend_rooms(site: str, *, page: int = 1) -> dict[str, Any]:
    data = fetch_muxia(site, "getRecommendRooms", {"page": page})
    return data if isinstance(data, dict) else {"list": [], "hasMore": False}


def normalize_room(site: str, room_id: str, data: dict[str, Any]) -> dict[str, Any]:
    streams: list[dict[str, Any]] = []
    for item in data.get("stream") or []:
        lines = []
        for line in item.get("lines") or []:
            url = line.get("url") or ""
            if not url:
                continue
            lines.append({"name": line.get("name") or "线路", "url": url})
        if lines:
            streams.append({"name": item.get("name") or "默认", "lines": lines})

    play_url = ""
    backup_urls: list[str] = []
    if streams and streams[0]["lines"]:
        play_url = streams[0]["lines"][0]["url"]
        backup_urls = [line["url"] for line in streams[0]["lines"][1:]]
        for group in streams[1:]:
            backup_urls.extend(line["url"] for line in group["lines"])

    return {
        "source": "muxia",
        "site": site,
        "room_id": room_id,
        "title": data.get("title") or "",
        "anchor_name": data.get("nickname") or data.get("title") or "",
        "status": bool(data.get("status")),
        "cover": data.get("cover") or "",
        "streams": streams,
        "play_url": play_url,
        "backup_urls": backup_urls,
        "flv_url": play_url if play_url.endswith(".flv") or ".flv?" in play_url else "",
        "m3u8_url": play_url if ".m3u8" in play_url else "",
        "is_live": bool(data.get("status")),
    }
