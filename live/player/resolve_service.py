"""统一解析入口：meta / tier 分层缓存 + 多平台调度 + 耗时统计。"""

from __future__ import annotations

import asyncio
import threading
import time
from typing import Callable

from resolve_cache import get_meta, get_payload, get_tier, set_meta, set_payload, set_tier
from resolve_douyu import load_meta as douyu_load_meta
from resolve_douyu import normalize_url as douyu_normalize_url
from resolve_douyu import resolve_all_tiers as douyu_resolve_all_tiers
from resolve_douyu import resolve_tier as douyu_resolve_tier
from resolve_huya import load_meta as huya_load_meta
from resolve_huya import normalize_url as huya_normalize_url
from resolve_huya import resolve_all_tiers as huya_resolve_all_tiers
from resolve_huya import resolve_tier as huya_resolve_tier
from room_schema import build_room_payload, pick_quality_name

SITE_LOAD_META: dict[str, Callable] = {
    "douyu": douyu_load_meta,
    "huya": huya_load_meta,
}

SITE_RESOLVE_TIER: dict[str, Callable] = {
    "douyu": douyu_resolve_tier,
    "huya": huya_resolve_tier,
}

SITE_RESOLVE_ALL_TIERS: dict[str, Callable] = {
    "douyu": douyu_resolve_all_tiers,
    "huya": huya_resolve_all_tiers,
}

SITE_NORMALIZE_URL: dict[str, Callable[[str], str]] = {
    "douyu": douyu_normalize_url,
    "huya": huya_normalize_url,
}


class _AsyncLoopRunner:
    """HTTP 线程复用同一事件循环，避免每次 asyncio.run 冷启动。"""

    def __init__(self) -> None:
        self._loop = asyncio.new_event_loop()
        self._thread = threading.Thread(target=self._run, name="resolve-async-loop", daemon=True)
        self._thread.start()

    def _run(self) -> None:
        asyncio.set_event_loop(self._loop)
        self._loop.run_forever()

    def run(self, coro):
        future = asyncio.run_coroutine_threadsafe(coro, self._loop)
        return future.result()


_runner: _AsyncLoopRunner | None = None
_runner_lock = threading.Lock()


def _get_runner() -> _AsyncLoopRunner:
    global _runner
    if _runner is None:
        with _runner_lock:
            if _runner is None:
                _runner = _AsyncLoopRunner()
    return _runner


def normalize_room_url(site: str, room_id: str) -> str:
    normalizer = SITE_NORMALIZE_URL.get(site)
    if not normalizer:
        raise ValueError(f"暂不支持平台: {site}")
    return normalizer(room_id)


def _ms_since(start: float) -> int:
    return int((time.perf_counter() - start) * 1000)


async def fetch_meta(site: str, room_id: str, *, force: bool = False) -> dict:
    if not force:
        cached = get_meta(site, room_id)
        if cached:
            cached["cached_meta"] = True
            return cached

    loader = SITE_LOAD_META.get(site)
    if not loader:
        raise ValueError(f"暂不支持平台: {site}")

    url = normalize_room_url(site, room_id)
    meta = await loader(url)
    set_meta(site, room_id, meta)
    return meta


async def fetch_tier(site: str, room_id: str, meta: dict, quality_name: str, *, force: bool = False) -> dict:
    if not force:
        cached = get_tier(site, room_id, quality_name)
        if cached:
            cached["cached_tier"] = True
            return cached

    resolver = SITE_RESOLVE_TIER.get(site)
    if not resolver:
        raise ValueError(f"暂不支持平台: {site}")

    tier = await resolver(meta, quality_name)
    set_tier(site, room_id, quality_name, tier)
    return tier


async def resolve_room(
    site: str,
    room_id: str,
    *,
    mode: str = "lazy",
    quality: str | None = None,
    force: bool = False,
) -> dict:
    t0 = time.perf_counter()
    timing: dict = {
        "total_ms": 0,
        "meta_ms": 0,
        "tier_ms": 0,
        "payload_cached": False,
        "meta_cached": False,
        "tier_cached": False,
    }

    quality_key = (quality or "").strip() or "*"
    if not force:
        cached = get_payload(site, room_id, mode, quality_key)
        if cached:
            cached["cached"] = True
            timing["payload_cached"] = True
            timing["total_ms"] = _ms_since(t0)
            cached["_timing"] = timing
            return cached

    t_meta = time.perf_counter()
    meta = await fetch_meta(site, room_id, force=force)
    timing["meta_ms"] = _ms_since(t_meta)
    timing["meta_cached"] = bool(meta.get("cached_meta"))

    if mode == "full":
        t_tier = time.perf_counter()
        resolver = SITE_RESOLVE_ALL_TIERS.get(site)
        if not resolver:
            raise ValueError(f"暂不支持平台: {site}")
        tiers = await resolver(meta)
        timing["tier_ms"] = _ms_since(t_tier)
        payload = build_room_payload(meta, tiers, source="streamget")
    else:
        quality_item = pick_quality_name(meta["available_qualities"], quality)
        tier_name = str(quality_item.get("name") or quality or "默认")
        t_tier = time.perf_counter()
        tier = await fetch_tier(site, room_id, meta, tier_name, force=force)
        timing["tier_ms"] = _ms_since(t_tier)
        timing["tier_cached"] = bool(tier.get("cached_tier"))
        payload = build_room_payload(meta, [tier], partial=True, active_quality=tier_name, source="streamget")

    payload["source"] = "streamget"
    set_payload(site, room_id, mode, quality_key, payload)
    timing["total_ms"] = _ms_since(t0)
    payload["_timing"] = timing
    return payload


def resolve_room_sync(
    site: str,
    room_id: str,
    *,
    mode: str = "lazy",
    quality: str | None = None,
    force: bool = False,
) -> dict:
    return _get_runner().run(
        resolve_room(site, room_id, mode=mode, quality=quality, force=force),
    )
