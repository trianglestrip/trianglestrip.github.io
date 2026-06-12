"""解析耗时基准：供 /api/time 与 CLI 共用。"""

from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any

from resolve_cache import stats as cache_stats
from resolve_service import resolve_room_sync


def _wall_resolve(
    site: str,
    room: str,
    *,
    quality: str | None,
    force: bool,
) -> dict[str, Any]:
    t0 = time.perf_counter()
    payload = resolve_room_sync(
        site,
        room,
        mode="lazy",
        quality=quality or None,
        force=force,
    )
    wall_ms = int((time.perf_counter() - t0) * 1000)
    timing = payload.get("_timing") or {}
    return {
        "wall_ms": wall_ms,
        "timing": timing,
        "cached": bool(payload.get("cached")),
        "cached_meta": bool(timing.get("meta_cached")),
        "cached_tier": bool(timing.get("tier_cached")),
        "payload_cached": bool(timing.get("payload_cached")),
        "anchor": payload.get("anchor_name") or payload.get("title") or "",
        "is_live": payload.get("is_live"),
    }


def build_time_report(
    site: str,
    room: str,
    *,
    quality: str | None = None,
    run: bool = False,
) -> dict[str, Any]:
    report: dict[str, Any] = {
        "ok": True,
        "server_time": datetime.now(timezone.utc).isoformat(),
        "cache": cache_stats(),
        "params": {
            "site": site,
            "room": room,
            "quality": quality or "",
            "run": run,
        },
    }

    if not run:
        return report

    cold = _wall_resolve(site, room, quality=quality, force=True)
    warm = _wall_resolve(site, room, quality=quality, force=False)

    report["benchmark"] = {
        "site": site,
        "room": room,
        "quality": quality or "",
        "runs": [
            {"label": "cold", "desc": "force=1 跳过缓存", **cold},
            {"label": "warm", "desc": "命中 payload 缓存", **warm},
        ],
    }
    return report
