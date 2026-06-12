"""统一解析入口：meta / tier 分层缓存 + 多平台调度。"""

from __future__ import annotations

import asyncio
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


def normalize_room_url(site: str, room_id: str) -> str:
    normalizer = SITE_NORMALIZE_URL.get(site)
    if not normalizer:
        raise ValueError(f"暂不支持平台: {site}")
    return normalizer(room_id)


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


async def fetch_tier(site: str, room_id: str, meta: dict, quality_name: str) -> dict:
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
) -> dict:
    quality_key = (quality or "").strip() or "*"
    cached = get_payload(site, room_id, mode, quality_key)
    if cached:
        cached["cached"] = True
        return cached

    meta = await fetch_meta(site, room_id)
    if mode == "full":
        resolver = SITE_RESOLVE_ALL_TIERS.get(site)
        if not resolver:
            raise ValueError(f"暂不支持平台: {site}")
        tiers = await resolver(meta)
        payload = build_room_payload(meta, tiers, source="streamget")
    else:
        quality_item = pick_quality_name(meta["available_qualities"], quality)
        tier_name = str(quality_item.get("name") or quality or "默认")
        tier = await fetch_tier(site, room_id, meta, tier_name)
        payload = build_room_payload(meta, [tier], partial=True, active_quality=tier_name, source="streamget")

    payload["source"] = "streamget"
    set_payload(site, room_id, mode, quality_key, payload)
    return payload


def resolve_room_sync(
    site: str,
    room_id: str,
    *,
    mode: str = "lazy",
    quality: str | None = None,
) -> dict:
    return asyncio.run(resolve_room(site, room_id, mode=mode, quality=quality))
