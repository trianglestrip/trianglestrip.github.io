#!/usr/bin/env python3
"""用 streamget 解析斗鱼直播流地址（多档 douyucdn 直链）。"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

from streamget import DouyuLiveStream

from room_schema import build_room_payload, pick_quality_name

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


def _cache_white_key(live: DouyuLiveStream, white: dict) -> None:
    """同一次解析内复用白名单，避免每档重复 getEncryption。"""

    async def _cached() -> dict:
        return white

    live._update_white_key = _cached  # type: ignore[method-assign]


def _pick_quality_item(multirates: list[dict], quality_name: str | None) -> dict:
    return pick_quality_name(_available_qualities(multirates), quality_name)


def _available_qualities(multirates: list[dict]) -> list[dict]:
    return [
        {"name": str(item.get("name") or f"档{item.get('rate', 0)}"), "rate": item.get("rate", 0)}
        for item in multirates
    ]


def _cover_from_room(room: dict) -> str:
    cover = str(room.get("room_pic") or room.get("coverSrc") or "").strip()
    if not cover:
        src = str(room.get("room_src") or "").strip()
        if src.startswith("//"):
            cover = f"https:{src}"
        elif src.startswith("http"):
            cover = src
        elif src:
            cover = f"https://rpic.douyucdn.cn/{src.lstrip('/')}"
    elif cover.startswith("//"):
        cover = f"https:{cover}"
    return cover


def _tier_from_response(
    item: dict,
    resp: dict,
    *,
    line_label: str,
    seen_paths: set[str] | None = None,
) -> dict | None:
    if resp.get("error") != 0:
        return None
    rate = str(item.get("rate", 0))
    group_name = str(item.get("name") or f"档{rate}")
    info = resp.get("data") or {}
    play_url = _flv_from_api_data(info)
    if not is_douyucdn_url(play_url):
        return None
    if seen_paths is not None:
        path_key = play_url.split("?")[0].split("/")[-1]
        if path_key in seen_paths:
            return None
        seen_paths.add(path_key)
    return {
        "name": group_name,
        "lines": [{"name": line_label, "url": play_url}],
        "play_url": play_url,
    }


def _avatar_from_room(room: dict) -> str:
    avatar = room.get("avatar")
    if isinstance(avatar, dict):
        text = str(avatar.get("big") or avatar.get("middle") or avatar.get("small") or "").strip()
    else:
        text = str(avatar or "").strip()
    if text.startswith("//"):
        return f"https:{text}"
    return text


async def _load_play_context(url: str, *, preferred_cdn: str = "hw-h5") -> dict:
    live = DouyuLiveStream()
    room_raw, white = await asyncio.gather(
        live.fetch_web_stream_data(url, process_data=False),
        live._update_white_key(),
    )
    rid = str(room_raw["room_id"])
    if room_raw.get("show_status") != 1:
        raise RuntimeError("房间未开播或解析失败")

    _cache_white_key(live, white)
    base = await live._fetch_web_stream_url(rid, rate="0", cdn=preferred_cdn)
    if base.get("error") != 0:
        raise RuntimeError(base.get("msg") or "getH5PlayV1 失败")

    api_data = base.get("data") or {}
    multirates = api_data.get("multirates") or []
    cdns = api_data.get("cdnsWithName") or []
    if not multirates:
        raise RuntimeError("未返回 multirates 档位信息")

    return {
        "live": live,
        "rid": rid,
        "url": url,
        "anchor_name": room_raw.get("nickname") or "",
        "cover": _cover_from_room(room_raw),
        "avatar": _avatar_from_room(room_raw),
        "white": white,
        "base": base,
        "multirates": multirates,
        "cdns": cdns,
        "line_label": _line_name_for_cdn(cdns, preferred_cdn),
        "preferred_cdn": preferred_cdn,
    }


def meta_from_context(ctx: dict) -> dict:
    return {
        "site": "douyu",
        "room_id": ctx["rid"],
        "source_url": ctx["url"],
        "anchor_name": ctx["anchor_name"],
        "title": ctx["anchor_name"],
        "cover": ctx.get("cover") or "",
        "avatar": ctx.get("avatar") or "",
        "available_qualities": _available_qualities(ctx["multirates"]),
        "context": {
            "rid": ctx["rid"],
            "url": ctx["url"],
            "anchor_name": ctx["anchor_name"],
            "multirates": ctx["multirates"],
            "cdns": ctx["cdns"],
            "line_label": ctx["line_label"],
            "preferred_cdn": ctx["preferred_cdn"],
            "white": ctx["white"],
            "base": ctx["base"],
        },
    }


def _context_from_meta(meta: dict) -> dict:
    blob = meta["context"]
    live = DouyuLiveStream()
    _cache_white_key(live, blob["white"])
    return {
        "live": live,
        "rid": blob["rid"],
        "url": blob["url"],
        "anchor_name": blob["anchor_name"],
        "base": blob["base"],
        "multirates": blob["multirates"],
        "cdns": blob["cdns"],
        "line_label": blob["line_label"],
        "preferred_cdn": blob["preferred_cdn"],
    }


async def load_meta(url: str, *, preferred_cdn: str = "hw-h5") -> dict:
    ctx = await _load_play_context(url, preferred_cdn=preferred_cdn)
    return meta_from_context(ctx)


async def resolve_tier(meta: dict, quality_name: str | None = None) -> dict:
    ctx = _context_from_meta(meta)
    item = _pick_quality_item(ctx["multirates"], quality_name)
    resp = await _fetch_tier_response(ctx, item)
    tier = _tier_from_response(item, resp, line_label=ctx["line_label"])
    if not tier:
        raise RuntimeError(f"未获取到档位 {item.get('name') or quality_name} 的播放地址")
    return tier


async def resolve_all_tiers(meta: dict) -> list[dict]:
    ctx = _context_from_meta(meta)

    async def fetch_tier(item: dict) -> tuple[dict, dict]:
        return item, await _fetch_tier_response(ctx, item)

    tier_results = await asyncio.gather(*[fetch_tier(item) for item in ctx["multirates"]])
    streams: list[dict] = []
    seen_paths: set[str] = set()
    for item, resp in tier_results:
        tier = _tier_from_response(item, resp, line_label=ctx["line_label"], seen_paths=seen_paths)
        if tier:
            streams.append(tier)
    if not streams:
        raise RuntimeError("未获取到可播放的 douyucdn 地址")
    return streams


async def _fetch_tier_response(ctx: dict, item: dict) -> dict:
    rate = str(item.get("rate", 0))
    if rate == "0":
        return ctx["base"]
    return await ctx["live"]._fetch_web_stream_url(
        ctx["rid"],
        rate=rate,
        cdn=ctx["preferred_cdn"],
    )


def _finalize_payload(
    meta: dict,
    streams: list[dict],
    *,
    partial: bool = False,
    quality_name: str | None = None,
) -> dict:
    return build_room_payload(
        meta,
        streams,
        partial=partial,
        active_quality=quality_name or (streams[0]["name"] if partial else None),
    )


async def resolve_douyu_lazy(url: str, *, quality_name: str | None = None, preferred_cdn: str = "hw-h5") -> dict:
    meta = await load_meta(url, preferred_cdn=preferred_cdn)
    tier = await resolve_tier(meta, quality_name)
    return _finalize_payload(meta, [tier], partial=True, quality_name=tier["name"])


async def resolve_douyu_cdn(url: str, *, preferred_cdn: str = "hw-h5") -> dict:
    meta = await load_meta(url, preferred_cdn=preferred_cdn)
    streams = await resolve_all_tiers(meta)
    return _finalize_payload(meta, streams)


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
