"""斗鱼解析：streamget getH5PlayV1 + hw-h5，返回 douyucdn 直链（无代理）。"""

from __future__ import annotations

import asyncio
import re
import sys
from pathlib import Path

PLAYER_DIR = Path(__file__).resolve().parent.parent / "player"
if str(PLAYER_DIR) not in sys.path:
    sys.path.insert(0, str(PLAYER_DIR))

from compare_streams import compare_room_payloads  # noqa: E402
from muxia_api import fetch_room, normalize_room  # noqa: E402
from resolve_douyu import normalize_url, resolve_douyu_cdn  # noqa: E402


def parse_room_id(raw: str) -> str:
    raw = (raw or "").strip()
    if not raw:
        raise ValueError("缺少房间号")
    if raw.isdigit():
        return raw
    m = re.search(r"douyu\.com/(?:b|room/share)?/?(\d+)", raw, re.I)
    if m:
        return m.group(1)
    m = re.search(r"(\d{4,})", raw)
    if m:
        return m.group(1)
    raise ValueError(f"无法识别房间号: {raw}")


def resolve_douyu(room: str) -> dict:
    room_id = parse_room_id(room)
    payload = asyncio.run(resolve_douyu_cdn(normalize_url(room_id)))
    payload["ok"] = True
    return payload


def compare_douyu(room: str) -> dict:
    room_id = parse_room_id(room)
    local = resolve_douyu(room_id)
    muxia = normalize_room("douyu", room_id, fetch_room("douyu", room_id))
    return {
        "ok": True,
        "site": "douyu",
        "room_id": room_id,
        "local": local,
        "muxia": muxia,
        "compare": compare_room_payloads(local, muxia),
    }
