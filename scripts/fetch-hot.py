#!/usr/bin/env python3
"""从 DailyHotApi 抓取热榜，按平台写入独立缓存文件 data/hot/{platform}.json。"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data" / "hot"
SOURCES_FILE = ROOT / "scripts" / "hot-sources.json"
DEFAULT_API_BASE = "https://api-hot.imsyy.top"
REQUEST_TIMEOUT = 30
MAX_RETRIES = 3


def load_sources() -> dict:
    with SOURCES_FILE.open(encoding="utf-8") as fh:
        return json.load(fh)


def api_base() -> str:
    value = os.environ.get("DAILYHOT_API_BASE", "").strip()
    return (value or DEFAULT_API_BASE).rstrip("/")


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def parse_time(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def should_fetch(cache: dict, ttl_minutes: int, force: bool) -> bool:
    if force:
        return True
    updated_at = parse_time(cache.get("updated_at"))
    if updated_at is None:
        return True
    return datetime.now(updated_at.tzinfo) - updated_at >= timedelta(minutes=ttl_minutes)


def load_cache(platform: str) -> dict:
    path = DATA_DIR / f"{platform}.json"
    if not path.exists():
        return {"source": platform, "items": []}
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


def normalize_items(raw_items: list, limit: int) -> list[dict]:
    items: list[dict] = []
    for index, item in enumerate(raw_items[:limit], start=1):
        title = str(item.get("title", "")).strip()
        url = str(item.get("url") or item.get("mobileUrl") or "").strip()
        if not title or not url:
            continue
        hot = item.get("hot")
        if hot is None:
            hot = item.get("desc") or ""
        items.append(
            {
                "rank": index,
                "title": title,
                "url": url,
                "hot": str(hot).strip() if hot is not None else "",
            }
        )
    return items


def fetch_platform(platform: str, meta: dict) -> dict:
    cache = load_cache(platform)
    title = meta.get("title", platform)
    limit = int(meta.get("limit", 10))
    url = f"{api_base()}/{platform}"

    last_error = "unknown error"
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            request = urllib.request.Request(
                url,
                headers={
                    "User-Agent": "blog-hot-fetch/1.0",
                    "Accept": "application/json",
                },
            )
            with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT) as response:
                payload = json.loads(response.read().decode("utf-8"))

            if payload.get("code") != 200:
                raise RuntimeError(payload.get("message") or f"API code {payload.get('code')}")

            items = normalize_items(payload.get("data") or [], limit)
            if len(items) < 5:
                raise RuntimeError(f"too few items: {len(items)}")

            return {
                "source": platform,
                "title": title,
                "updated_at": now_iso(),
                "fetch_ok": True,
                "items": items,
            }
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, RuntimeError, json.JSONDecodeError) as exc:
            last_error = str(exc)
            if attempt < MAX_RETRIES:
                continue

    return {
        "source": platform,
        "title": title,
        "updated_at": now_iso(),
        "fetch_ok": False,
        "error": last_error,
        "items": cache.get("items") or [],
    }


def write_cache(platform: str, data: dict) -> bool:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    path = DATA_DIR / f"{platform}.json"
    serialized = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    old = path.read_text(encoding="utf-8") if path.exists() else ""
    if serialized == old:
        return False
    path.write_text(serialized, encoding="utf-8")
    return True


def run(platform: str | None, force: bool) -> int:
    sources = load_sources()
    platforms: dict[str, dict] = sources["platforms"]

    if platform:
        if platform not in platforms:
            print(f"unknown platform: {platform}", file=sys.stderr)
            return 1
        targets = {platform: platforms[platform]}
    else:
        targets = platforms

    changed = 0
    for name, meta in targets.items():
        cache = load_cache(name)
        ttl_minutes = int(meta.get("ttl_minutes", 30))
        if not should_fetch(cache, ttl_minutes, force):
            print(f"skip {name}: cache still fresh")
            continue

        print(f"fetch {name} from {api_base()}/{name}")
        data = fetch_platform(name, meta)
        if write_cache(name, data):
            changed += 1
            status = "ok" if data.get("fetch_ok") else "failed (cache kept)"
            print(f"updated {name}: {status}")
        else:
            print(f"unchanged {name}")

    print(f"done, changed={changed}")
    return 0


def main() -> int:
    args = sys.argv[1:]
    force = "--force" in args
    args = [arg for arg in args if arg != "--force"]

    platform = args[0] if args else None
    if platform == "--due-only":
        platform = None

    return run(platform, force)


if __name__ == "__main__":
    raise SystemExit(main())
