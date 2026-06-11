#!/usr/bin/env python3
"""用 streamget 解析斗鱼直播流地址，并写入 stream.json 供播放器使用。"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests
from streamget import DouyuLiveStream

ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "stream.json"
PROBE_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Referer": "https://www.douyu.com/",
}


def normalize_url(value: str) -> str:
    text = value.strip()
    if text.isdigit():
        return f"https://www.douyu.com/{text}"
    if "douyu.com" not in text:
        raise ValueError(f"无效的斗鱼地址: {value}")
    if not text.startswith("http"):
        return f"https://{text}"
    return text


def candidate_urls(payload: dict) -> list[str]:
    urls: list[str] = []
    for key in ("flv_url", "record_url", "m3u8_url"):
        value = payload.get(key) or ""
        if value:
            urls.append(value)
    try:
        extra = json.loads(payload.get("raw", "{}")).get("extra", {})
        urls.extend(extra.get("backup_url_list", []))
    except json.JSONDecodeError:
        pass

    def rank(item: str) -> tuple[int, str]:
        if "douyucdn" in item:
            return (0, item)
        if "edgesrv.com" in item:
            return (9, item)
        return (1, item)

    seen: set[str] = set()
    ordered: list[str] = []
    for item in sorted(urls, key=rank):
        if "edgesrv.com" in item:
            continue
        if item not in seen:
            seen.add(item)
            ordered.append(item)
    return ordered


def probe_playable(url: str) -> bool:
    try:
        resp = requests.get(url, headers=PROBE_HEADERS, stream=True, timeout=12)
        chunk = resp.raw.read(4)
        return resp.status_code == 200 and (chunk.startswith(b"FLV") or url.endswith(".m3u8"))
    except requests.RequestException:
        return False


def pick_play_url(payload: dict) -> tuple[str, list[str]]:
    candidates = candidate_urls(payload)
    if not candidates:
        return "", []

    working = [url for url in candidates if probe_playable(url)]
    if working:
        return working[0], working
    return "", []


async def resolve(url: str, quality: str) -> dict:
    live = DouyuLiveStream()
    data = await live.fetch_web_stream_data(url)
    stream = await live.fetch_stream_url(data, quality)
    payload = {
        "source_url": url,
        "quality": quality,
        "fetched_at": datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds"),
        "platform": getattr(stream, "platform", "douyu"),
        "anchor_name": getattr(stream, "anchor_name", ""),
        "is_live": bool(getattr(stream, "is_live", False)),
        "flv_url": getattr(stream, "flv_url", "") or "",
        "m3u8_url": getattr(stream, "m3u8_url", "") or "",
        "record_url": getattr(stream, "record_url", "") or "",
        "raw": stream.to_json() if hasattr(stream, "to_json") else str(stream),
    }
    if not payload["is_live"]:
        raise RuntimeError("房间未开播或解析失败")
    if not payload["flv_url"] and not payload["m3u8_url"]:
        raise RuntimeError("未获取到可播放地址")

    play_url, all_urls = pick_play_url(payload)
    payload["play_url"] = play_url
    payload["backup_urls"] = [item for item in all_urls if item != play_url]
    return payload


def main() -> int:
    parser = argparse.ArgumentParser(description="解析斗鱼直播流")
    parser.add_argument(
        "room",
        nargs="?",
        default="9999",
        help="房间号或完整 URL，默认 9999",
    )
    parser.add_argument(
        "--quality",
        default="OD",
        choices=["OD", "UHD", "HD", "SD", "LD"],
        help="清晰度，默认原画 OD",
    )
    args = parser.parse_args()

    try:
        url = normalize_url(args.room)
        payload = asyncio.run(resolve(url, args.quality))
    except Exception as exc:  # noqa: BLE001
        print(f"解析失败: {exc}", file=sys.stderr)
        return 1

    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"房间: {url}")
    print(f"主播: {payload['anchor_name']}")
    print(f"开播: {payload['is_live']}")
    if payload.get("play_url"):
        print(f"播放: {payload['play_url'][:120]}...")
    elif payload["flv_url"]:
        print(f"FLV: {payload['flv_url'][:120]}...")
    if payload["m3u8_url"]:
        print(f"M3U8: {payload['m3u8_url'][:120]}...")
    print(f"已写入: {OUTPUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
