#!/usr/bin/env python3
"""用 streamget 解析斗鱼直播流地址（多档 douyucdn 直链）。"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from streamget import DouyuLiveStream

ROOT = Path(__file__).resolve().parent


def normalize_url(value: str) -> str:
    text = value.strip()
    if text.isdigit():
        return f"https://www.douyu.com/{text}"
    if "douyu.com" not in text:
        raise ValueError(f"无效的斗鱼地址: {value}")
    if not text.startswith("http"):
        return f"https://{text}"
    return text


def is_douyucdn_url(url: str) -> bool:
    return bool(url) and "douyucdn" in url and "edgesrv.com" not in url


def _flv_from_api_data(data: dict) -> str:
    return f"{data['rtmp_url']}/{data['rtmp_live']}"


def _line_name_for_cdn(cdns: list[dict], cdn_code: str) -> str:
    for item in cdns:
        if item.get("cdn") == cdn_code:
            return str(item.get("name") or cdn_code)
    return cdn_code


async def resolve_douyu_cdn(url: str, *, preferred_cdn: str = "hw-h5") -> dict:
    """按斗鱼 multirates + hw CDN 解析，输出与 muxia 同结构的 douyucdn 直链。"""
    live = DouyuLiveStream()
    room_data = await live.fetch_web_stream_data(url)
    rid = str(room_data["room_id"])
    anchor_name = room_data.get("anchor_name") or ""

    if not room_data.get("is_live"):
        raise RuntimeError("房间未开播或解析失败")

    base = await live._fetch_web_stream_url(rid, rate="0", cdn=preferred_cdn)
    if base.get("error") != 0:
        raise RuntimeError(base.get("msg") or "getH5PlayV1 失败")

    api_data = base.get("data") or {}
    multirates = api_data.get("multirates") or []
    cdns = api_data.get("cdnsWithName") or []
    if not multirates:
        raise RuntimeError("未返回 multirates 档位信息")

    streams: list[dict] = []
    seen_paths: set[str] = set()
    line_label = _line_name_for_cdn(cdns, preferred_cdn)

    for item in multirates:
        rate = str(item.get("rate", 0))
        group_name = str(item.get("name") or f"档{rate}")
        resp = await live._fetch_web_stream_url(rid, rate=rate, cdn=preferred_cdn)
        if resp.get("error") != 0:
            continue
        info = resp.get("data") or {}
        play_url = _flv_from_api_data(info)
        if not is_douyucdn_url(play_url):
            continue
        path_key = play_url.split("?")[0].split("/")[-1]
        if path_key in seen_paths:
            continue
        seen_paths.add(path_key)
        streams.append(
            {
                "name": group_name,
                "lines": [{"name": line_label, "url": play_url}],
                "play_url": play_url,
            }
        )

    if not streams:
        raise RuntimeError("未获取到可播放的 douyucdn 地址")

    preferred = next((group for group in streams if "高清" in group["name"]), streams[0])
    play_url = preferred["play_url"]
    backup_urls: list[str] = []
    for group in streams:
        for line in group["lines"]:
            url_item = line["url"]
            if url_item and url_item != play_url and url_item not in backup_urls:
                backup_urls.append(url_item)

    return {
        "source_url": url,
        "source": "streamget",
        "fetched_at": datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds"),
        "platform": "douyu",
        "site": "douyu",
        "room_id": rid,
        "anchor_name": anchor_name,
        "title": anchor_name,
        "is_live": True,
        "status": True,
        "streams": [{"name": group["name"], "lines": group["lines"]} for group in streams],
        "play_url": play_url,
        "flv_url": play_url,
        "m3u8_url": "",
        "backup_urls": backup_urls,
        "ok": True,
    }


async def resolve_all(url: str) -> dict:
    return await resolve_douyu_cdn(url)


def print_compare_report(room_id: str, local: dict, muxia: dict, comparison: dict) -> None:
    print(f"=== 对比 {room_id}: streamget vs muxia ===")
    print(f"档位名一致: {comparison['quality_names_match']}")
    print(f"FLV 一致: {comparison['matched']}/{comparison['total']}")
    for row in comparison["rows"]:
        mark = "OK" if row["match"] else "DIFF"
        print(
            f"[{mark}] {row['quality']} | "
            f"{row['local_line']}/{row['muxia_line']} | "
            f"{row['local_basename']}"
        )
    if comparison["all_match"]:
        print("结论: 与 muxia 完全一致")
    else:
        print("结论: 存在差异")


def main() -> int:
    parser = argparse.ArgumentParser(description="解析斗鱼直播流")
    parser.add_argument(
        "room",
        nargs="?",
        default="9999",
        help="房间号或完整 URL，默认 9999",
    )
    parser.add_argument(
        "--compare",
        action="store_true",
        help="解析后与 muxia 对比档位与 FLV 文件名",
    )
    parser.add_argument(
        "--out",
        metavar="FILE",
        help="可选：将 JSON 结果写入文件",
    )
    args = parser.parse_args()

    try:
        url = normalize_url(args.room)
        if args.compare:
            from compare_streams import compare_room_payloads
            from muxia_api import fetch_room, normalize_room

            local = asyncio.run(resolve_all(url))
            room_id = str(local.get("room_id") or args.room)
            muxia = normalize_room("douyu", room_id, fetch_room("douyu", room_id))
            comparison = compare_room_payloads(local, muxia)
            print_compare_report(room_id, local, muxia, comparison)
            payload = local
        else:
            payload = asyncio.run(resolve_all(url))
    except Exception as exc:  # noqa: BLE001
        print(f"解析失败: {exc}", file=sys.stderr)
        return 1

    print(f"房间: {url}")
    print(f"主播: {payload['anchor_name']}")
    print(f"开播: {payload['is_live']}")
    if payload.get("streams"):
        from compare_streams import flv_basename

        for group in payload["streams"]:
            line = (group.get("lines") or [{}])[0]
            print(f"  {group.get('name')}: {line.get('name')} {flv_basename(line.get('url', ''))}")
    elif payload.get("play_url"):
        print(f"播放: {payload['play_url'][:120]}...")

    if args.out:
        out_path = Path(args.out)
        out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"已写入: {out_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
