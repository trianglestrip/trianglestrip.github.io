"""测试 lsf / streamget 对指定斗鱼房间（不含 muxia）。"""

from __future__ import annotations

import sys
import time

import requests

ROOM = sys.argv[1] if len(sys.argv) > 1 else "5720533"
LSF = "http://127.0.0.1:8770"
API = "http://127.0.0.1:8771/api/room"


def probe(name: str, url: str, *, read_chunks: int = 6) -> None:
    t0 = time.time()
    try:
        r = requests.get(
            url,
            stream=True,
            timeout=60,
            headers={
                "User-Agent": "Mozilla/5.0",
                "Referer": "https://www.douyu.com/",
            },
        )
        body = b""
        for _, chunk in zip(range(read_chunks), r.iter_content(16384)):
            body += chunk
        ms = int((time.time() - t0) * 1000)
        ctype = r.headers.get("Content-Type", "")
        print(
            f"[{name}] status={r.status_code} ms={ms} "
            f"ctype={ctype} bytes={len(body)} head={body[:24]!r}"
        )
        r.close()
    except Exception as exc:
        print(f"[{name}] ERR {type(exc).__name__}: {exc}")


def main() -> None:
    print(f"=== room {ROOM} (open source only) ===")
    print("斗鱼浏览器: streamget 直链 | VLC: lsf 8770")
    for fmt in ("flv", "m3u8"):
        probe(f"lsf-{fmt}", f"{LSF}/douyu/{ROOM}?format={fmt}")

    try:
        r = requests.get(f"{API}?site=douyu&room={ROOM}", timeout=120)
        d = r.json()
        print(f"[streamget-api] status={r.status_code} ok={d.get('ok')} source={d.get('source')}")
        streams = d.get("streams") or []
        for group in streams:
            for line in group.get("lines") or []:
                url = line.get("url") or ""
                if url:
                    probe(f"cdn-{group.get('name')}", url)
    except Exception as exc:
        print(f"[streamget-api] ERR {exc}")


if __name__ == "__main__":
    main()
