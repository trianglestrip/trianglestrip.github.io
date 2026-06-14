"""分类与房间列表：直连平台接口，不使用 muxia。"""

from __future__ import annotations

import re
from typing import Any

import requests

from text_sanitize import sanitize_unicode

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Referer": "https://www.huya.com/",
}

_DOUYU_HEADERS = {
    **_HEADERS,
    "Referer": "https://www.douyu.com/",
}

_HUYA_GAME_PIC = "https://huyaimg.msstatic.com/cdnimage/game/{cid}-MS.jpg"
_HUYA_GAME_LIST_URL = "https://mp.huya.com/cache.php?m=Game&do=gameList&game_type=1"

_HUYA_BUSS_GROUPS: list[dict[str, Any]] = [
    {"id": "1", "name": "网游", "buss_type": 1},
    {"id": "3", "name": "手游", "buss_type": 3},
    {"id": "8", "name": "娱乐", "buss_type": 8},
    {"id": "2", "name": "单机", "buss_type": 2},
]

_HUYA_CATEGORY_PAGES: list[dict[str, str]] = [
    {"id": "1", "name": "网游", "url": "https://www.huya.com/g_ol"},
    {"id": "3", "name": "手游", "url": "https://www.huya.com/g_sy"},
    {"id": "8", "name": "娱乐", "url": "https://www.huya.com/g_yl"},
    {"id": "2", "name": "单机", "url": "https://www.huya.com/g_pc"},
]

# 拉取失败时的兜底热门分区
_HUYA_FALLBACK_GROUPS: list[dict[str, Any]] = [
    {
        "id": "1",
        "name": "热门",
        "list": [
            {"cid": 1, "name": "英雄联盟"},
            {"cid": 862, "name": "CS2"},
            {"cid": 2336, "name": "王者荣耀"},
            {"cid": 3203, "name": "和平精英"},
            {"cid": 5937, "name": "无畏契约"},
            {"cid": 5485, "name": "lol云顶之弈"},
            {"cid": 4, "name": "穿越火线"},
            {"cid": 393, "name": "炉石传说"},
            {"cid": 7, "name": "DOTA2"},
            {"cid": 2, "name": "地下城与勇士"},
            {"cid": 802, "name": "坦克世界"},
            {"cid": 1663, "name": "星秀"},
            {"cid": 2135, "name": "一起看"},
        ],
    },
]

_huya_category_cache: list[dict[str, Any]] | None = None


def _get_json(
    url: str,
    *,
    params: dict | None = None,
    method: str = "GET",
    json_body: Any = None,
    headers: dict[str, str] | None = None,
) -> Any:
    resp = requests.request(
        method,
        url,
        params=params,
        json=json_body,
        headers=headers or _HEADERS,
        timeout=20,
    )
    resp.raise_for_status()
    return resp.json()


def _format_online(count: int | float | str | None) -> str:
    try:
        value = float(count or 0)
    except (TypeError, ValueError):
        return ""
    if value >= 10000:
        return f"{value / 10000:.1f}万"
    if value >= 1000:
        return f"{value / 1000:.1f}千"
    if value > 0:
        return str(int(value))
    return ""


def _huya_pic(cid: int | str) -> str:
    return _HUYA_GAME_PIC.format(cid=cid)


def _normalize_huya_room(item: dict[str, Any]) -> dict[str, Any]:
    room_id = item.get("lProfileRoom") or item.get("lChannel") or item.get("lUid")
    cover = item.get("sScreenshot") or item.get("sPreviewUrl") or ""
    if cover and cover.startswith("//"):
        cover = f"https:{cover}"
    online = _format_online(item.get("lTotalCount") or item.get("lUserCount"))
    return sanitize_unicode(
        {
            "roomId": str(room_id or ""),
            "siteId": "huya",
            "status": True,
            "title": item.get("sIntroduction") or item.get("sRoomName") or "",
            "nickname": item.get("sNick") or "",
            "cid": str(item.get("iGid") or item.get("iGameId") or ""),
            "category": item.get("sGameFullName") or "",
            "online": online,
            "cover": cover,
        }
    )


def _fetch_huya_live_list(gid: int | str, *, page: int, page_size: int = 120) -> dict[str, Any]:
    data = _get_json(
        "https://live.huya.com/liveHttpUI/getLiveList",
        params={"iGid": gid, "iPageNo": page, "iPageSize": page_size},
    )
    items = data.get("vList") or []
    total_page = int(data.get("iTotalPage") or 1)
    return {
        "list": [_normalize_huya_room(item) for item in items if _normalize_huya_room(item).get("roomId")],
        "hasMore": page < total_page,
        "page": page,
    }


def _parse_huya_game_list(html: str) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for match in re.finditer(r'data-gid="(\d+)" title=([^>]+)', html):
        name = match.group(2).strip().strip('"')
        items.append({"cid": int(match.group(1)), "name": sanitize_unicode(name)})
    return items


def _build_huya_category_groups(
    source: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    groups: list[dict[str, Any]] = []
    for group in source:
        items = []
        for item in group["list"]:
            cid = item["cid"]
            items.append(
                {
                    "cid": cid,
                    "name": item["name"],
                    "pic": _huya_pic(cid),
                }
            )
        groups.append({"id": group["id"], "name": group["name"], "list": items})
    return groups


def _group_huya_games_by_buss_type(games: list[dict[str, Any]]) -> list[dict[str, Any]]:
    buckets: dict[int, list[dict[str, Any]]] = {}
    for game in games:
        if game.get("isHide"):
            continue
        gid = game.get("gid")
        name = sanitize_unicode(str(game.get("gameFullName") or "").strip())
        buss_type = game.get("bussType")
        if gid is None or not name or buss_type is None:
            continue
        buckets.setdefault(int(buss_type), []).append({"cid": int(gid), "name": name})

    groups: list[dict[str, Any]] = []
    for group in _HUYA_BUSS_GROUPS:
        items = []
        for item in buckets.get(int(group["buss_type"]), []):
            cid = item["cid"]
            items.append({"cid": cid, "name": item["name"], "pic": _huya_pic(cid)})
        if items:
            groups.append({"id": group["id"], "name": group["name"], "list": items})
    return groups


def _fetch_huya_categories_from_api() -> list[dict[str, Any]]:
    payload = _get_json(_HUYA_GAME_LIST_URL)
    if int(payload.get("status") or 0) != 200:
        raise RuntimeError("huya game list status error")
    games = payload.get("data") or []
    if not games:
        raise RuntimeError("huya game list empty")
    groups = _group_huya_games_by_buss_type(games)
    if not groups:
        raise RuntimeError("huya category groups empty")
    return groups


def _fetch_huya_categories() -> list[dict[str, Any]]:
    global _huya_category_cache
    if _huya_category_cache is not None:
        return _huya_category_cache

    try:
        groups = _fetch_huya_categories_from_api()
        _huya_category_cache = groups
        return groups
    except Exception:
        pass

    try:
        pages: list[dict[str, Any]] = []
        for page in _HUYA_CATEGORY_PAGES:
            resp = requests.get(page["url"], headers=_HEADERS, timeout=20)
            resp.raise_for_status()
            game_list = _parse_huya_game_list(resp.text)
            if game_list:
                pages.append({"id": page["id"], "name": page["name"], "list": game_list})
        if pages:
            groups = _build_huya_category_groups(pages)
            _huya_category_cache = groups
            return groups
    except Exception:
        pass

    return _build_huya_category_groups(_HUYA_FALLBACK_GROUPS)


_douyu_cate2_name_cache: dict[str, str] | None = None


def _douyu_cate2_names() -> dict[str, str]:
    global _douyu_cate2_name_cache
    if _douyu_cate2_name_cache is None:
        mapping: dict[str, str] = {}
        for group in _fetch_douyu_categories():
            for item in group.get("list") or []:
                cid = item.get("cid")
                if cid is not None:
                    mapping[str(cid)] = item.get("name") or ""
        _douyu_cate2_name_cache = mapping
    return _douyu_cate2_name_cache


def _douyu_online(item: dict[str, Any]) -> str:
    hn = item.get("hn")
    if hn:
        text = str(hn).strip()
        if text:
            return text
    return _format_online(item.get("online") or item.get("viewerCount"))


def _douyu_category(item: dict[str, Any]) -> str:
    name = item.get("cate2Name") or item.get("gameName") or item.get("cate3Name")
    if name:
        return str(name)
    cid = item.get("cate2Id") or item.get("cate1Id")
    if cid is not None:
        return _douyu_cate2_names().get(str(cid), "")
    return ""


def _fetch_douyu_categories() -> list[dict[str, Any]]:
    data = _get_json("https://m.douyu.com/api/cate/list", headers=_DOUYU_HEADERS)
    payload = data.get("data") or {}
    cate1 = {item["cate1Id"]: item["cate1Name"] for item in payload.get("cate1Info") or []}
    grouped: dict[int, dict[str, Any]] = {}
    for item in payload.get("cate2Info") or []:
        cate1_id = item.get("cate1Id")
        group = grouped.setdefault(
            cate1_id,
            {"id": str(cate1_id), "name": cate1.get(cate1_id, "分类"), "list": []},
        )
        group["list"].append(
            {
                "cid": item.get("cate2Id"),
                "name": item.get("cate2Name") or "",
                "pic": item.get("pic") or item.get("icon") or "",
            }
        )
    return [group for group in grouped.values() if group["list"]]


def _normalize_douyu_room(item: dict[str, Any]) -> dict[str, Any]:
    return sanitize_unicode(
        {
            "roomId": str(item.get("rid") or ""),
            "siteId": "douyu",
            "status": bool(item.get("isLive", item.get("showStatus", 1))),
            "title": item.get("roomName") or "",
            "nickname": item.get("nickname") or item.get("ownerName") or "",
            "cid": str(item.get("cate2Id") or item.get("cate1Id") or ""),
            "category": _douyu_category(item),
            "online": _douyu_online(item),
            "cover": item.get("roomSrc") or item.get("verticalSrc") or "",
        }
    )


def _fetch_douyu_rooms(*, cid: int | str | None, page: int, limit: int = 30) -> dict[str, Any]:
    params: dict[str, Any] = {"page": page, "limit": limit}
    if cid is not None and str(cid) not in ("", "0"):
        params["cate2Id"] = cid
    data = _get_json("https://m.douyu.com/api/room/list", params=params, headers=_DOUYU_HEADERS)
    payload = data.get("data") or {}
    items = payload.get("list") or []
    page_count = int(payload.get("pageCount") or 1)
    now_page = int(payload.get("nowPage") or page)
    has_more = payload.get("hasMore")
    if has_more is None:
        has_more = now_page < page_count
    return {
        "list": [_normalize_douyu_room(item) for item in items if _normalize_douyu_room(item).get("roomId")],
        "hasMore": bool(has_more),
        "page": now_page,
    }


def fetch_categories(site: str) -> list[dict[str, Any]]:
    if site == "huya":
        return _fetch_huya_categories()
    if site == "douyu":
        return _fetch_douyu_categories()
    raise ValueError(f"暂不支持平台: {site}")


def fetch_recommend_rooms(site: str, *, page: int = 1) -> dict[str, Any]:
    if site == "huya":
        return _fetch_huya_live_list(0, page=page)
    if site == "douyu":
        return _fetch_douyu_rooms(cid=None, page=page)
    raise ValueError(f"暂不支持平台: {site}")


def fetch_category_rooms(
    site: str,
    category_id: str | int,
    *,
    page: int = 1,
    pid: str | int | None = None,
) -> dict[str, Any]:
    del pid  # 虎牙/斗鱼直连接口不使用 pid
    if site == "huya":
        result = _fetch_huya_live_list(category_id, page=page)
        result["cid"] = str(category_id)
        return result
    if site == "douyu":
        result = _fetch_douyu_rooms(cid=category_id, page=page)
        result["cid"] = str(category_id)
        return result
    raise ValueError(f"暂不支持平台: {site}")
