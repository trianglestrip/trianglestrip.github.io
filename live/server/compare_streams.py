"""对比本机 streamget 解析与 muxia 解析结果。"""

from __future__ import annotations

from urllib.parse import urlparse


def flv_basename(url: str) -> str:
    if not url:
        return ""
    return url.split("?")[0].rstrip("/").split("/")[-1]


def url_host(url: str) -> str:
    if not url:
        return ""
    return urlparse(url).netloc


def _first_line(stream: dict | None) -> tuple[str, str]:
    if not stream:
        return "", ""
    lines = stream.get("lines") or []
    if not lines:
        return "", ""
    line = lines[0]
    return str(line.get("name") or ""), str(line.get("url") or "")


def compare_room_payloads(local: dict, muxia: dict) -> dict:
    local_streams = local.get("streams") or []
    muxia_streams = muxia.get("streams") or []
    muxia_by_name = {str(item.get("name") or ""): item for item in muxia_streams}

    rows: list[dict] = []
    for local_stream in local_streams:
        quality = str(local_stream.get("name") or "")
        muxia_stream = muxia_by_name.get(quality)
        local_line, local_url = _first_line(local_stream)
        muxia_line, muxia_url = _first_line(muxia_stream)
        local_base = flv_basename(local_url)
        muxia_base = flv_basename(muxia_url)
        flv_match = bool(local_base) and local_base == muxia_base
        line_match = local_line == muxia_line
        rows.append(
            {
                "quality": quality,
                "local_line": local_line,
                "muxia_line": muxia_line,
                "local_host": url_host(local_url),
                "muxia_host": url_host(muxia_url),
                "local_basename": local_base,
                "muxia_basename": muxia_base,
                "local_url": local_url,
                "muxia_url": muxia_url,
                "flv_match": flv_match,
                "line_match": line_match,
                "match": flv_match and line_match,
            }
        )

    local_names = [str(item.get("name") or "") for item in local_streams]
    muxia_names = [str(item.get("name") or "") for item in muxia_streams]
    local_only = [name for name in local_names if name not in muxia_names]
    muxia_only = [name for name in muxia_names if name not in local_names]

    matched = sum(1 for row in rows if row["match"])
    return {
        "quality_names_match": local_names == muxia_names,
        "all_flv_match": bool(rows) and all(row["flv_match"] for row in rows),
        "all_match": bool(rows) and all(row["match"] for row in rows),
        "matched": matched,
        "total": len(rows),
        "local_qualities": local_names,
        "muxia_qualities": muxia_names,
        "local_only": local_only,
        "muxia_only": muxia_only,
        "rows": rows,
    }
