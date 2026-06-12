"""解析结果短期缓存：房间 meta 与各档位 tier 分层。"""

from __future__ import annotations

import copy
import time
from threading import Lock

DEFAULT_TTL = 45.0

_lock = Lock()
_entries: dict[str, dict] = {}


def _now() -> float:
    return time.monotonic()


def _meta_key(site: str, room_id: str) -> str:
    return f"meta:{site}:{room_id}"


def _tier_key(site: str, room_id: str, quality_name: str) -> str:
    return f"tier:{site}:{room_id}:{quality_name}"


def _payload_key(site: str, room_id: str, mode: str, quality_key: str) -> str:
    return f"payload:{site}:{room_id}:{mode}:{quality_key}"


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


def get_meta(site: str, room_id: str) -> dict | None:
    return get(_meta_key(site, room_id))


def set_meta(site: str, room_id: str, meta: dict, *, ttl: float = DEFAULT_TTL) -> None:
    set(_meta_key(site, room_id), meta, ttl=ttl)


def get_tier(site: str, room_id: str, quality_name: str) -> dict | None:
    return get(_tier_key(site, room_id, quality_name))


def set_tier(site: str, room_id: str, quality_name: str, tier: dict, *, ttl: float = DEFAULT_TTL) -> None:
    set(_tier_key(site, room_id, quality_name), tier, ttl=ttl)


def get_payload(site: str, room_id: str, mode: str, quality_key: str) -> dict | None:
    return get(_payload_key(site, room_id, mode, quality_key))


def set_payload(
    site: str,
    room_id: str,
    mode: str,
    quality_key: str,
    payload: dict,
    *,
    ttl: float = DEFAULT_TTL,
) -> None:
    set(_payload_key(site, room_id, mode, quality_key), payload, ttl=ttl)
