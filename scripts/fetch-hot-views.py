#!/usr/bin/env python3
"""拉取各平台计数页的不蒜子 PV，写入 data/hot/views.json。"""

from __future__ import annotations

import json
import random
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data" / "hot"
VIEWS_PATH = DATA_DIR / "views.json"
SITE_URL = "https://trianglestrip.github.io/"
API_URL = "https://busuanzi.ibruce.info/busuanzi"
USER_AGENT = "blog-hot-views/1.0"
REQUEST_DELAY = 0.35


def load_json(path: Path) -> dict:
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


def fetch_page_pv(platform_id: str) -> int | None:
    page_url = f"{SITE_URL}news/p/{platform_id}.html"
    callback = f"BusuanziCallback_{random.randint(1, 10**9)}"
    req = urllib.request.Request(
        f"{API_URL}?jsonpCallback={callback}",
        headers={"Referer": page_url, "User-Agent": USER_AGENT},
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            text = resp.read().decode("utf-8", errors="replace")
    except (urllib.error.URLError, TimeoutError, ValueError) as exc:
        print(f"warn {platform_id}: {exc}")
        return None

    match = re.search(r"\{[^{}]*\}", text)
    if not match:
        print(f"warn {platform_id}: invalid response")
        return None
    try:
        payload = json.loads(match.group())
    except json.JSONDecodeError:
        print(f"warn {platform_id}: json decode failed")
        return None

    page_pv = payload.get("page_pv")
    if page_pv is None:
        return None
    try:
        return int(page_pv)
    except (TypeError, ValueError):
        return None


def run() -> int:
    cfg_path = DATA_DIR / "config.json"
    if not cfg_path.exists():
        print("missing config.json")
        return 1

    cfg = load_json(cfg_path)
    order = cfg.get("order", [])
    platforms = cfg.get("platforms", {})

    existing: dict[str, int | None] = {}
    if VIEWS_PATH.exists():
        existing = load_json(VIEWS_PATH).get("platforms", {})

    result: dict[str, int | None] = {}
    ids = [platform_id for platform_id in order if platform_id in platforms]
    for index, platform_id in enumerate(ids):
        pv = fetch_page_pv(platform_id)
        if pv is None and platform_id in existing:
            pv = existing.get(platform_id)
            print(f"keep {platform_id}: {pv}")
        else:
            print(f"fetch {platform_id}: {pv}")
        result[platform_id] = pv
        if index < len(ids) - 1:
            time.sleep(REQUEST_DELAY)

    out = {
        "updated_at": datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds"),
        "platforms": result,
    }
    VIEWS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with VIEWS_PATH.open("w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    print(f"wrote {VIEWS_PATH}")
    return 0


def main() -> int:
    return run()


if __name__ == "__main__":
    raise SystemExit(main())
