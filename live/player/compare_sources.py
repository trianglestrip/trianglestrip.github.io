#!/usr/bin/env python3
"""对比 streamget 与 muxia 解析出的斗鱼流地址。"""

from __future__ import annotations

import asyncio
import json
import re
import subprocess
import sys
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import requests
from muxia_api import fetch_room, normalize_room
from streamget import DouyuLiveStream

ROOT = Path(__file__).resolve().parent
PROBE_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Referer": "https://www.douyu.com/",
}


def probe_url(url: str, *, seconds: float = 2.0) -> dict:
    result = {
        "url": url,
        "host": urlparse(url).netloc,
        "path": urlparse(url).path,
        "ok": False,
        "status": None,
        "magic": "",
        "bytes": 0,
        "has_video": False,
        "has_audio": False,
        "tags_seen": [],
        "error": "",
    }
    try:
        with requests.get(url, headers=PROBE_HEADERS, stream=True, timeout=(10, seconds)) as resp:
            result["status"] = resp.status_code
            if resp.status_code != 200:
                result["error"] = f"HTTP {resp.status_code}"
                return result
            buf = b""
            for chunk in resp.iter_content(64 * 1024):
                if not chunk:
                    break
                buf += chunk
                if len(buf) >= 256 * 1024:
                    break
            result["bytes"] = len(buf)
            if len(buf) < 4:
                result["error"] = "body too small"
                return result
            result["magic"] = buf[:3].decode("latin1", errors="replace")
            if not buf.startswith(b"FLV"):
                result["error"] = "not flv"
                return result
            tags = set()
            pos = 13
            limit = min(len(buf), 120000)
            while pos + 11 < limit:
                tag_type = buf[pos]
                data_size = int.from_bytes(buf[pos + 1 : pos + 4], "big")
                if data_size <= 0 or pos + 11 + data_size > len(buf):
                    break
                if tag_type == 9:
                    result["has_video"] = True
                    tags.add("video")
                elif tag_type == 8:
                    result["has_audio"] = True
                    tags.add("audio")
                elif tag_type == 18:
                    tags.add("script")
                pos += 11 + data_size + 4
            result["tags_seen"] = sorted(tags)
            result["ok"] = result["has_video"]
            if not result["ok"]:
                result["error"] = "no video tag in sample"
    except Exception as exc:  # noqa: BLE001
        result["error"] = str(exc)
    return result


async def streamget_urls(room: str) -> dict:
    live = DouyuLiveStream()
    data = await live.fetch_web_stream_data(f"https://www.douyu.com/{room}")
    out = {"qualities": {}}
    for quality in ["OD", "UHD", "HD", "SD", "LD"]:
        try:
            stream = await live.fetch_stream_url(data, quality)
            flv = getattr(stream, "flv_url", "") or ""
            m3u8 = getattr(stream, "m3u8_url", "") or ""
            raw = {}
            if hasattr(stream, "to_json"):
                try:
                    raw = json.loads(stream.to_json())
                except json.JSONDecodeError:
                    raw = {}
            extra = []
            try:
                extra = json.loads(raw.get("raw", "{}")).get("extra", {}).get("backup_url_list", [])
            except Exception:
                extra = []
            urls = [u for u in [flv, m3u8, *extra] if u]
            out["qualities"][quality] = urls
        except Exception as exc:  # noqa: BLE001
            out["qualities"][quality] = {"error": str(exc)}
    return out


def summarize_path(path: str) -> str:
    name = path.rsplit("/", 1)[-1]
    if "_8000" in name:
        return "8000码率"
    if "_4000" in name:
        return "4000码率"
    if "_2000" in name:
        return "2000码率"
    return "原画/无后缀"


def main() -> int:
    room = sys.argv[1] if len(sys.argv) > 1 else "9999"
    print(f"=== 房间 {room} ===\n")

    muxia = normalize_room("douyu", room, fetch_room("douyu", room))
    muxia_urls = []
    for group in muxia.get("streams") or []:
        for line in group.get("lines") or []:
            if line.get("url"):
                muxia_urls.append((group.get("name"), line.get("name"), line["url"]))

    print("[muxia] 线路数:", len(muxia_urls))
    for q, line, url in muxia_urls[:6]:
        probe = probe_url(url)
        print(
            f"  {q}/{line} | {probe['host']} | {summarize_path(probe['path'])} | "
            f"bytes={probe['bytes']} video={probe['has_video']} audio={probe['has_audio']} "
            f"err={probe['error']}"
        )

    sg = asyncio.run(streamget_urls(room))
    print("\n[streamget] 清晰度:")
    sg_primary = []
    for quality, urls in sg["qualities"].items():
        if isinstance(urls, dict) and "error" in urls:
            print(f"  {quality}: ERROR {urls['error']}")
            continue
        print(f"  {quality}: {len(urls)} urls")
        for url in urls[:3]:
            probe = probe_url(url)
            print(
                f"    {probe['host']} | {summarize_path(probe['path'])} | "
                f"bytes={probe['bytes']} video={probe['has_video']} audio={probe['has_audio']} "
                f"err={probe['error']}"
            )
            if quality == "OD":
                sg_primary.append(url)

    print("\n=== 对比结论 ===")
    muxia_hosts = {urlparse(u).netloc for _, _, u in muxia_urls}
    sg_hosts = {urlparse(u).netloc for u in sg_primary}
    print("muxia CDN 节点:", ", ".join(sorted(muxia_hosts)) or "-")
    print("streamget OD CDN 节点:", ", ".join(sorted(sg_hosts)) or "-")

    muxia_paths = {summarize_path(urlparse(u).path) for _, _, u in muxia_urls}
    sg_paths = {summarize_path(urlparse(u).path) for u in sg_primary}
    print("muxia 码率档:", ", ".join(sorted(muxia_paths)))
    print("streamget OD 码率档:", ", ".join(sorted(sg_paths)))

    # subprocess resolve_douyu pick
    subprocess.run([sys.executable, str(ROOT / "resolve_douyu.py"), room], check=False)
    picked = json.loads((ROOT / "stream.json").read_text(encoding="utf-8"))
    picked_url = picked.get("play_url") or ""
    print("\n[resolve_douyu 当前选中]", picked_url[:110], "...")
    picked_probe = probe_url(picked_url)
    print(
        "  probe:",
        picked_probe,
    )

    muxia_main = muxia_urls[0][2] if muxia_urls else ""
    if muxia_main:
        print("\n[muxia 主线路]", muxia_main[:110], "...")
        print("  probe:", probe_url(muxia_main))

    same_path = urlparse(picked_url).path == urlparse(muxia_main).path if picked_url and muxia_main else False
    print("\n路径相同:", same_path)
    if picked_probe["ok"] and muxia_main:
        mp = probe_url(muxia_main)
        if not mp["ok"]:
            print("=> muxia 主线路探测也失败，可能是 CDN/网络瞬时问题")
        elif picked_probe["host"] != mp["host"]:
            print("=> streamget 与 muxia 指向不同 CDN 节点，可尝试切换解析源")
        elif not same_path:
            print("=> streamget 可能选了不同码率/路径，与 muxia 原画档不一致")
        else:
            print("=> 两源 URL 结构基本一致，播放问题更可能在播放器/代理而非解析")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
