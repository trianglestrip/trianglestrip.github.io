"""统一房间 meta / tier 结构与 API 响应组装。"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


def pick_quality_name(items: list[dict], quality_name: str | None) -> dict:
    if quality_name:
        for item in items:
            name = str(item.get("name") or "")
            if quality_name == name or quality_name in name or name in quality_name:
                return item
    for item in items:
        name = str(item.get("name") or "")
        if any(tag in name for tag in ("高清", "超清", "蓝光")):
            return item
    return items[0]


def tier_dict(name: str, lines: list[dict], *, play_url: str | None = None) -> dict:
    first_url = play_url or (lines[0]["url"] if lines else "")
    return {
        "name": name,
        "lines": lines,
        "play_url": first_url,
    }


def build_room_payload(
    meta: dict,
    tiers: list[dict],
    *,
    partial: bool = False,
    active_quality: str | None = None,
    source: str = "streamget",
) -> dict:
    if not tiers:
        raise RuntimeError("未获取到可播放地址")

    active = tiers[0]
    if active_quality:
        matched = next((tier for tier in tiers if tier["name"] == active_quality), None)
        if matched:
            active = matched

    play_url = active.get("play_url") or active["lines"][0]["url"]
    backup_urls = [
        line["url"]
        for tier in tiers
        for line in tier.get("lines") or []
        if line.get("url") and line["url"] != play_url
    ]

    payload: dict[str, Any] = {
        "source_url": meta["source_url"],
        "source": source,
        "fetched_at": datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds"),
        "platform": meta["site"],
        "site": meta["site"],
        "room_id": meta["room_id"],
        "anchor_name": meta.get("anchor_name") or "",
        "title": meta.get("title") or meta.get("anchor_name") or "",
        "cover": meta.get("cover") or "",
        "is_live": True,
        "status": True,
        "streams": [{"name": tier["name"], "lines": tier["lines"]} for tier in tiers],
        "available_qualities": meta.get("available_qualities") or [],
        "play_url": play_url,
        "flv_url": play_url,
        "m3u8_url": meta.get("m3u8_url") or "",
        "backup_urls": backup_urls,
        "meta": {
            "site": meta["site"],
            "room_id": meta["room_id"],
            "title": meta.get("title") or "",
            "anchor_name": meta.get("anchor_name") or "",
            "cover": meta.get("cover") or "",
            "is_live": True,
            "available_qualities": meta.get("available_qualities") or [],
        },
        "ok": True,
    }
    if partial:
        payload["partial"] = True
        payload["quality"] = active["name"]
    return payload
