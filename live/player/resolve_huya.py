#!/usr/bin/env python3
"""用 streamget 解析虎牙直播流地址（多档多线路 FLV 直链）。"""

from __future__ import annotations

import argparse
import asyncio
import base64
import hashlib
import json
import random
import sys
import time
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path

from streamget import HuyaLiveStream

ROOT = Path(__file__).resolve().parent


def normalize_url(value: str) -> str:
    text = value.strip()
    if text.isdigit():
        return f"https://www.huya.com/{text}"
    if "huya.com" not in text:
        raise ValueError(f"无效的虎牙地址: {value}")
    if not text.startswith("http"):
        return f"https://{text}"
    return text


def _line_name(stream_info: dict) -> str:
    index = stream_info.get("iLineIndex")
    if index is not None:
        return f"线路{index}"
    cdn = str(stream_info.get("sCdnType") or "CDN")
    return f"线路{cdn}"


def _build_anti_code(old_anti_code: str, stream_name: str) -> str:
    params_t = 100
    sdk_version = 2403051612
    t13 = int(time.time()) * 1000
    sdk_sid = t13
    init_uuid = (int(t13 % 10**10 * 1000) + int(1000 * random.random())) % 4294967295
    uid = random.randint(1400000000000, 1400009999999)
    seq_id = uid + sdk_sid
    target_unix_time = (t13 + 110624) // 1000
    ws_time = f"{target_unix_time:x}".lower()

    url_query = urllib.parse.parse_qs(old_anti_code)
    ws_secret_pf = base64.b64decode(urllib.parse.unquote(url_query["fm"][0]).encode()).decode().split("_")[0]
    ws_secret_hash = hashlib.md5(f'{seq_id}|{url_query["ctype"][0]}|{params_t}'.encode()).hexdigest()
    ws_secret = f"{ws_secret_pf}_{uid}_{stream_name}_{ws_secret_hash}_{ws_time}"
    ws_secret_md5 = hashlib.md5(ws_secret.encode()).hexdigest()

    return (
        f"wsSecret={ws_secret_md5}&wsTime={ws_time}&seqid={seq_id}&ctype={url_query['ctype'][0]}&ver=1"
        f"&fs={url_query['fs'][0]}&uuid={init_uuid}&u={uid}&t={params_t}&sv={sdk_version}"
        f"&sdk_sid={sdk_sid}&codec=264"
    )


def _build_flv_url(stream_info: dict, *, ratio: int | str = "") -> str:
    flv_url = str(stream_info.get("sFlvUrl") or "")
    stream_name = str(stream_info.get("sStreamName") or "")
    suffix = str(stream_info.get("sFlvUrlSuffix") or "flv")
    anti_code = str(stream_info.get("sFlvAntiCode") or "")
    if not flv_url or not stream_name or not anti_code:
        return ""

    new_anti_code = _build_anti_code(anti_code, stream_name)
    ratio_str = "" if ratio in (0, "0", "", None) else str(ratio)
    url = f"{flv_url}/{stream_name}.{suffix}?{new_anti_code}&ratio={ratio_str}"
    return url.replace("http://", "https://")


def _quality_items(web_data: dict) -> list[dict]:
    items = web_data.get("vMultiStreamInfo") or []
    if items:
        return [
            {
                "name": str(item.get("sDisplayName") or f"档{item.get('iBitRate', 0)}"),
                "rate": item.get("iBitRate", 0),
            }
            for item in items
        ]
    return [{"name": "默认", "rate": 0}]


def _pick_quality_item(items: list[dict], quality_name: str | None) -> dict:
    if quality_name:
        for item in items:
            name = str(item.get("name") or "")
            if quality_name == name or quality_name in name or name in quality_name:
                return item
    for item in items:
        if "高清" in str(item.get("name") or "") or "超清" in str(item.get("name") or ""):
            return item
    return items[0]


def _stream_lines(web_data: dict, *, ratio: int | str = "") -> list[dict]:
    stream_list = (web_data.get("data") or [{}])[0].get("gameStreamInfoList") or []
    lines: list[dict] = []
    for stream_info in stream_list:
        url = _build_flv_url(stream_info, ratio=ratio)
        if not url:
            continue
        lines.append({"name": _line_name(stream_info), "url": url})
    return lines


def _tier_from_quality(web_data: dict, quality: dict) -> dict | None:
    lines = _stream_lines(web_data, ratio=quality.get("rate", 0))
    if not lines:
        return None
    return {
        "name": str(quality.get("name") or "默认"),
        "lines": lines,
        "play_url": lines[0]["url"],
    }


async def _load_play_context(url: str) -> dict:
    live = HuyaLiveStream()
    web_data = await live.fetch_web_stream_data(url)
    game_info = (web_data.get("data") or [{}])[0].get("gameLiveInfo") or {}
    stream_list = (web_data.get("data") or [{}])[0].get("gameStreamInfoList") or []
    if not stream_list:
        raise RuntimeError("房间未开播或解析失败")

    room_id = url.rstrip("/").rsplit("/", maxsplit=1)[-1]
    return {
        "url": url,
        "room_id": room_id,
        "anchor_name": game_info.get("nick") or "",
        "title": game_info.get("introduction") or game_info.get("roomName") or "",
        "cover": game_info.get("screenshot") or "",
        "web_data": web_data,
        "qualities": _quality_items(web_data),
    }


def _finalize_payload(
    ctx: dict,
    streams: list[dict],
    *,
    partial: bool = False,
    quality_name: str | None = None,
) -> dict:
    if not streams:
        raise RuntimeError("未获取到可播放的虎牙 FLV 地址")

    active = streams[0]
    if quality_name:
        matched = next((group for group in streams if group["name"] == quality_name), None)
        if matched:
            active = matched

    play_url = active["play_url"]
    backup_urls = [
        line["url"]
        for group in streams
        for line in group["lines"]
        if line.get("url") and line["url"] != play_url
    ]

    payload = {
        "source_url": ctx["url"],
        "source": "streamget",
        "fetched_at": datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds"),
        "platform": "huya",
        "site": "huya",
        "room_id": ctx["room_id"],
        "anchor_name": ctx["anchor_name"],
        "title": ctx["title"] or ctx["anchor_name"],
        "cover": ctx["cover"],
        "is_live": True,
        "status": True,
        "streams": [{"name": group["name"], "lines": group["lines"]} for group in streams],
        "available_qualities": ctx["qualities"],
        "play_url": play_url,
        "flv_url": play_url,
        "m3u8_url": "",
        "backup_urls": backup_urls,
        "ok": True,
    }
    if partial:
        payload["partial"] = True
        payload["quality"] = active["name"]
    return payload


async def resolve_huya_lazy(url: str, *, quality_name: str | None = None) -> dict:
    ctx = await _load_play_context(url)
    quality = _pick_quality_item(ctx["qualities"], quality_name)
    tier = _tier_from_quality(ctx["web_data"], quality)
    if not tier:
        raise RuntimeError(f"未获取到档位 {quality.get('name') or quality_name} 的播放地址")
    return _finalize_payload(ctx, [tier], partial=True, quality_name=str(tier["name"]))


async def resolve_huya_all(url: str) -> dict:
    ctx = await _load_play_context(url)
    streams: list[dict] = []
    for quality in ctx["qualities"]:
        tier = _tier_from_quality(ctx["web_data"], quality)
        if tier:
            streams.append(tier)
    return _finalize_payload(ctx, streams)


async def resolve_all(url: str) -> dict:
    return await resolve_huya_all(url)


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
    parser = argparse.ArgumentParser(description="解析虎牙直播流")
    parser.add_argument("room", nargs="?", default="579236", help="房间号或完整 URL")
    parser.add_argument("--compare", action="store_true", help="解析后与 muxia 对比")
    parser.add_argument("--out", metavar="FILE", help="可选：将 JSON 结果写入文件")
    args = parser.parse_args()

    try:
        url = normalize_url(args.room)
        if args.compare:
            from compare_streams import compare_room_payloads
            from muxia_api import fetch_room, normalize_room

            local = asyncio.run(resolve_all(url))
            room_id = str(local.get("room_id") or args.room)
            muxia = normalize_room("huya", room_id, fetch_room("huya", room_id))
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
