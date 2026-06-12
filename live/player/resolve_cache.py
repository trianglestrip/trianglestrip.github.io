"""解析结果短期缓存（按房间 + 档位）。"""

from __future__ import annotations

import copy
import time
from threading import Lock

DEFAULT_TTL = 45.0

_lock = Lock()
_entries: dict[str, dict] = {}


def _now() -> float:
    return time.monotonic()


def get(key: str) -> dict | None:
    with _lock:
        entry = _entries.get(key)
        if not entry or _now() >= entry["expires"]:
            if entry:
                del _entries[key]
            return None
        return copy.deepcopy(entry["data"])


def set(key: str, data: dict, *, ttl: float = DEFAULT_TTL) -> None:
    with _lock:
        _entries[key] = {"data": copy.deepcopy(data), "expires": _now() + ttl}


def get_room_tier(room_id: str, quality_name: str) -> dict | None:
    return get(f"local:{room_id}:tier:{quality_name}")


def set_room_tier(room_id: str, quality_name: str, tier: dict, *, ttl: float = DEFAULT_TTL) -> None:
    set(f"local:{room_id}:tier:{quality_name}", tier, ttl=ttl)


def get_room_meta(room_id: str) -> dict | None:
    return get(f"local:{room_id}:meta")


def set_room_meta(room_id: str, meta: dict, *, ttl: float = DEFAULT_TTL) -> None:
    set(f"local:{room_id}:meta", meta, ttl=ttl)
