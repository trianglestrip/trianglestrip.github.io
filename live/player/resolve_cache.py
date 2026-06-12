"""解析结果短期缓存：meta / tier / payload 分层 TTL + LRU。"""

from __future__ import annotations

import copy
import time
from collections import OrderedDict
from threading import Lock

# 播放 URL 带签名，不宜长缓存
PAYLOAD_TTL = 45.0
TIER_TTL = 45.0
# 房间 meta（档位列表、base 响应）可稍长，减少重复 betard + getEncryption
META_TTL = 180.0

DEFAULT_TTL = PAYLOAD_TTL
MAX_ENTRIES = 100

_lock = Lock()
_entries: OrderedDict[str, dict] = OrderedDict()


def _now() -> float:
    return time.monotonic()


def _meta_key(site: str, room_id: str) -> str:
    return f"meta:{site}:{room_id}"


def _tier_key(site: str, room_id: str, quality_name: str) -> str:
    return f"tier:{site}:{room_id}:{quality_name}"


def _payload_key(site: str, room_id: str, mode: str, quality_key: str) -> str:
    return f"payload:{site}:{room_id}:{mode}:{quality_key}"


def _purge_expired() -> None:
    now = _now()
    stale = [key for key, entry in _entries.items() if now >= entry["expires"]]
    for key in stale:
        del _entries[key]


def _evict_if_needed() -> None:
    while len(_entries) > MAX_ENTRIES:
        _entries.popitem(last=False)


def get(key: str) -> dict | None:
    with _lock:
        _purge_expired()
        entry = _entries.get(key)
        if not entry:
            return None
        if _now() >= entry["expires"]:
            del _entries[key]
            return None
        _entries.move_to_end(key)
        return copy.deepcopy(entry["data"])


def set(key: str, data: dict, *, ttl: float = DEFAULT_TTL) -> None:
    with _lock:
        _purge_expired()
        if key in _entries:
            del _entries[key]
        _entries[key] = {"data": copy.deepcopy(data), "expires": _now() + ttl}
        _entries.move_to_end(key)
        _evict_if_needed()


def stats() -> dict:
    with _lock:
        _purge_expired()
        return {
            "entries": len(_entries),
            "max_entries": MAX_ENTRIES,
            "ttl_sec": {
                "meta": META_TTL,
                "tier": TIER_TTL,
                "payload": PAYLOAD_TTL,
            },
        }


def get_meta(site: str, room_id: str) -> dict | None:
    return get(_meta_key(site, room_id))


def set_meta(site: str, room_id: str, meta: dict, *, ttl: float = META_TTL) -> None:
    set(_meta_key(site, room_id), meta, ttl=ttl)


def get_tier(site: str, room_id: str, quality_name: str) -> dict | None:
    return get(_tier_key(site, room_id, quality_name))


def set_tier(site: str, room_id: str, quality_name: str, tier: dict, *, ttl: float = TIER_TTL) -> None:
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
    ttl: float = PAYLOAD_TTL,
) -> None:
    set(_payload_key(site, room_id, mode, quality_key), payload, ttl=ttl)
