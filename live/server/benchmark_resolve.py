#!/usr/bin/env python3
"""对比 /api/room 冷/热解析耗时。"""

from __future__ import annotations

import argparse
import json
import time
import urllib.parse
import urllib.request

DEFAULT_BASE = "http://127.0.0.1:8765"
DEFAULT_ROOM = "252140"


def fetch_room(base: str, room: str, *, quality: str = "", force: bool = False) -> tuple[dict, int]:
    params = {
        "site": "douyu",
        "room": room,
        "mode": "lazy",
        "source": "local",
    }
    if quality:
        params["quality"] = quality
    if force:
        params["force"] = "1"
    url = f"{base}/api/room?{urllib.parse.urlencode(params)}"
    t0 = time.perf_counter()
    with urllib.request.urlopen(url, timeout=120) as resp:
        body = resp.read().decode("utf-8")
    ms = int((time.perf_counter() - t0) * 1000)
    return json.loads(body), ms


def main() -> int:
    parser = argparse.ArgumentParser(description="解析 API 耗时对比")
    parser.add_argument("room", nargs="?", default=DEFAULT_ROOM)
    parser.add_argument("--base", default=DEFAULT_BASE)
    parser.add_argument("--quality", default="", help="清晰度名称，如 蓝光4M")
    args = parser.parse_args()

    print(f"base={args.base} room={args.room}\n")

    cold, cold_ms = fetch_room(args.base, args.room, quality=args.quality, force=True)
    if not cold.get("ok"):
        print(f"冷解析失败 ({cold_ms}ms): {cold.get('error')}")
        return 1
    print(f"冷解析 force=1: {cold_ms}ms  timing={cold.get('_timing')}")

    warm, warm_ms = fetch_room(args.base, args.room, quality=args.quality)
    print(f"热缓存:       {warm_ms}ms  cached={warm.get('cached')} timing={warm.get('_timing')}")

    meta_only, meta_ms = fetch_room(args.base, args.room, quality=args.quality, force=False)
    print(f"再次请求:     {meta_ms}ms  cached={meta_only.get('cached')} timing={meta_only.get('_timing')}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
