#!/usr/bin/env python3
"""在 GitHub Actions 中直接抓取各平台热榜，写入 data/hot/{platform}.json。"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data" / "hot"
SOURCES_FILE = ROOT / "scripts" / "hot-sources.json"
FETCH_TIMEOUT = 60
HTTP_TIMEOUT = 30
MAX_RETRIES = 3
USER_AGENT = "Mozilla/5.0 (compatible; blog-hot-fetch/1.0)"


def load_sources() -> dict:
    with SOURCES_FILE.open(encoding="utf-8") as fh:
        return json.load(fh)


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


def short_error(message: str, limit: int = 200) -> str:
    text = " ".join(str(message).split())
    if len(text) <= limit:
        return text
    return text[: limit - 3] + "..."


def http_get_json(url: str) -> object:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=HTTP_TIMEOUT) as response:
        return json.loads(response.read().decode("utf-8"))


def fetch_v2ex_api(limit: int) -> list[dict]:
    data = http_get_json("https://www.v2ex.com/api/topics/hot.json")
    if not isinstance(data, list):
        raise RuntimeError("invalid v2ex response")

    items: list[dict] = []
    for topic in data[:limit]:
        title = str(topic.get("title", "")).strip()
        url = str(topic.get("url", "")).strip()
        if not title or not url:
            continue
        items.append(
            {
                "title": title,
                "url": url,
                "hot": str(topic.get("replies", "")),
            }
        )
    return items


CUSTOM_DRIVERS = {
    "v2ex_api": fetch_v2ex_api,
}


def normalize_items(raw_items: list, limit: int) -> list[dict]:
    items: list[dict] = []
    for index, item in enumerate(raw_items[:limit], start=1):
        title = str(item.get("title", "")).strip()
        url = str(item.get("url") or item.get("mobile_url") or "").strip()
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


def hotboard_env() -> dict:
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUTF8"] = "1"
    return env


def run_hotboard(fetcher: str) -> dict:
    command = ["hotboard", fetcher, "--format", "json"]
    result = subprocess.run(
        command,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=FETCH_TIMEOUT,
        check=False,
        env=hotboard_env(),
    )
    if result.returncode != 0:
        stderr = result.stderr.strip()
        stdout = result.stdout.strip()
        detail = stderr or stdout or f"exit code {result.returncode}"
        raise RuntimeError(detail)

    text = result.stdout.strip()
    if not text:
        raise RuntimeError("empty hotboard output")

    # hotboard 在 JSON 后还会输出日志，只解析第一段 JSON
    payload, _ = json.JSONDecoder().raw_decode(text)
    if not isinstance(payload.get("items"), list):
        raise RuntimeError("invalid hotboard response")
    return payload


def fetch_platform(platform: str, meta: dict) -> dict:
    cache = load_cache(platform)
    title = meta.get("title", platform)
    limit = int(meta.get("limit", 10))
    fetcher = meta.get("fetcher", platform)
    driver = meta.get("driver")

    last_error = "unknown error"
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            if driver:
                driver_fn = CUSTOM_DRIVERS.get(driver)
                if driver_fn is None:
                    raise RuntimeError(f"unknown driver: {driver}")
                raw_items = driver_fn(limit)
            else:
                payload = run_hotboard(fetcher)
                raw_items = payload.get("items") or []

            items = normalize_items(raw_items, limit)
            if len(items) < 5:
                raise RuntimeError(f"too few items: {len(items)}")

            return {
                "source": platform,
                "title": title,
                "updated_at": now_iso(),
                "fetch_ok": True,
                "items": items,
            }
        except (
            RuntimeError,
            subprocess.TimeoutExpired,
            json.JSONDecodeError,
            OSError,
            urllib.error.URLError,
            TimeoutError,
            ValueError,
        ) as exc:
            last_error = short_error(exc)
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

        fetcher = meta.get("fetcher", name)
        print(f"fetch {name} via hotboard {fetcher}")
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
