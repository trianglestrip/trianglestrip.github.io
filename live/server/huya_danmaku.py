"""虎牙弹幕 WebSocket 入场所需的房间参数（绕过浏览器 CORS）。"""

from __future__ import annotations

import requests

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Origin": "https://www.huya.com",
    "Referer": "https://www.huya.com/",
}


def fetch_huya_danmaku_session(room_id: str) -> dict:
    room = str(room_id).strip()
    if not room.isdigit():
        raise ValueError(f"无效虎牙房间号: {room_id}")

    res = requests.get(
        "https://mp.huya.com/cache.php",
        params={
            "m": "Live",
            "do": "profileRoom",
            "roomid": room,
            "showSecret": "1",
        },
        headers=_HEADERS,
        timeout=12,
    )
    res.raise_for_status()
    payload = res.json()
    if int(payload.get("status") or 0) != 200:
        raise RuntimeError(payload.get("message") or "虎牙房间信息获取失败")

    data = payload.get("data") or {}
    stream = data.get("stream") or {}
    base_list = stream.get("baseSteamInfoList") or []
    profile = data.get("profileInfo") or {}
    live_data = data.get("liveData") or {}

    ayyuid = int(profile.get("yyid") or live_data.get("yyid") or 0)
    top_sid = 0
    if base_list:
        top_sid = int(base_list[0].get("lChannelId") or 0)
    if not top_sid:
        top_sid = int(live_data.get("liveChannel") or live_data.get("channel") or 0)

    if not ayyuid or not top_sid:
        raise RuntimeError("房间未开播或缺少弹幕连接参数")

    return {
        "room_id": room,
        "ayyuid": ayyuid,
        "topSid": top_sid,
        "is_live": str(data.get("liveStatus") or "").upper() == "ON",
    }
