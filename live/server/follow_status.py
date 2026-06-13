"""关注列表：轻量查询房间直播状态与主播头像。"""

from __future__ import annotations

import asyncio
from typing import Any

import requests

from resolve_douyu import _cover_from_room

_DOUYU_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Referer": "https://www.douyu.com/",
}

_HUYA_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Origin": "https://www.huya.com",
    "Referer": "https://www.huya.com/",
}

_STATUS_ORDER = {"live": 0, "replay": 1, "offline": 2}


def _avatar_from_douyu(room: dict) -> str:
    avatar = room.get("avatar")
    if isinstance(avatar, dict):
        text = str(avatar.get("big") or avatar.get("middle") or avatar.get("small") or "").strip()
    else:
        text = str(avatar or "").strip()
    if text.startswith("//"):
        return f"https:{text}"
    return text


def _avatar_from_huya(profile: dict) -> str:
    text = str(profile.get("avatar180") or profile.get("avatar") or "").strip()
    if text.startswith("//"):
        return f"https:{text}"
    return text


def _douyu_state(room: dict) -> str:
    show_status = int(room.get("show_status") or 0)
    if show_status == 1:
        return "live"
    if show_status == 2:
        return "replay"
    return "offline"


def _huya_state(data: dict) -> str:
    live_data = data.get("liveData") or {}
    live_status = str(data.get("liveStatus") or "").upper()
    real_live_status = str(data.get("realLiveStatus") or "").upper()
    if live_status == "OFF" and real_live_status == "OFF":
        return "offline"
    stream = data.get("stream") or {}
    has_flv = bool(stream.get("baseSteamInfoList"))
    hls = str(live_data.get("hls") or live_data.get("hlsUrl") or "")
    replay_hint = (
        live_data.get("isReplay") in (1, "1", True)
        or live_status in {"REPLAY", "VOD"}
        or real_live_status in {"REPLAY", "VOD"}
        or ("livereplay" in hls or "al-vod.cdn.huya.com" in hls or "/vhuya/clips/" in hls)
    )
    if live_status == "ON" or real_live_status == "ON":
        if live_data.get("isReplay") in (1, "1", True):
            return "replay"
        return "live"
    if replay_hint:
        return "replay" if has_flv else "offline"
    if has_flv and live_status != "OFF" and real_live_status != "OFF":
        return "live"
    return "offline"


def fetch_douyu_follow_snapshot(room_id: str) -> dict[str, Any]:
    rid = str(room_id).strip()
    res = requests.get(
        f"https://www.douyu.com/betard/{rid}",
        headers=_DOUYU_HEADERS,
        timeout=12,
    )
    res.raise_for_status()
    room = (res.json() or {}).get("room") or {}
    return {
        "site": "douyu",
        "id": rid,
        "state": _douyu_state(room),
        "avatar": _avatar_from_douyu(room),
        "cover": _cover_from_room(room),
        "title": str(room.get("room_name") or room.get("nickname") or ""),
        "anchor": str(room.get("nickname") or ""),
    }


def fetch_huya_follow_snapshot(room_id: str) -> dict[str, Any]:
    rid = str(room_id).strip()
    res = requests.get(
        "https://mp.huya.com/cache.php",
        params={"m": "Live", "do": "profileRoom", "roomid": rid, "showSecret": "1"},
        headers=_HUYA_HEADERS,
        timeout=12,
    )
    res.raise_for_status()
    payload = res.json()
    if int(payload.get("status") or 0) != 200:
        raise RuntimeError(payload.get("message") or "虎牙房间信息获取失败")
    data = payload.get("data") or {}
    profile = data.get("profileInfo") or {}
    live_data = data.get("liveData") or {}
    cover = str(live_data.get("screenshot") or live_data.get("cover") or "").strip()
    if cover.startswith("//"):
        cover = f"https:{cover}"
    return {
        "site": "huya",
        "id": rid,
        "state": _huya_state(data),
        "avatar": _avatar_from_huya(profile),
        "cover": cover,
        "title": str(live_data.get("introduction") or live_data.get("gameHostName") or profile.get("nick") or ""),
        "anchor": str(profile.get("nick") or ""),
    }


def _fetch_one(site: str, room_id: str) -> dict[str, Any]:
    site = str(site or "").strip()
    rid = str(room_id or "").strip()
    if not site or not rid:
        return {"site": site, "id": rid, "state": "offline", "avatar": "", "cover": ""}
    try:
        if site == "douyu":
            return fetch_douyu_follow_snapshot(rid)
        if site == "huya":
            return fetch_huya_follow_snapshot(rid)
    except Exception:
        pass
    return {"site": site, "id": rid, "state": "offline", "avatar": "", "cover": ""}


async def fetch_follow_snapshots(rooms: list[dict[str, Any]]) -> list[dict[str, Any]]:
    tasks = []
    seen: set[str] = set()
    for item in rooms or []:
        site = str(item.get("site") or "").strip()
        rid = str(item.get("id") or item.get("roomId") or "").strip()
        key = f"{site}:{rid}"
        if not site or not rid or key in seen:
            continue
        seen.add(key)
        tasks.append(asyncio.to_thread(_fetch_one, site, rid))
    if not tasks:
        return []
    results = await asyncio.gather(*tasks)
    results.sort(key=lambda row: (_STATUS_ORDER.get(row.get("state"), 9), row.get("site", ""), row.get("id", "")))
    return results
