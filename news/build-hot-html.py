#!/usr/bin/env python3
"""根据 news/data 缓存生成独立静态热榜页 news/index.html。"""

from __future__ import annotations

import html
import json
import random
import tomllib
from datetime import datetime, timezone
from pathlib import Path

NEWS_ROOT = Path(__file__).resolve().parent
REPO_ROOT = NEWS_ROOT.parent
DATA_DIR = NEWS_ROOT / "data"
OUTPUT = NEWS_ROOT / "index.html"
SITE_URL = "https://trianglestrip.github.io/"


def load_json(path: Path) -> dict:
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


def format_relative(iso_value: str, now: datetime) -> str:
    try:
        updated = datetime.fromisoformat(iso_value)
    except ValueError:
        return iso_value
    if updated.tzinfo is None:
        updated = updated.replace(tzinfo=now.tzinfo)
    seconds = int((now - updated).total_seconds())
    if seconds < 60:
        return "刚刚"
    if seconds < 3600:
        return f"{seconds // 60}分钟前"
    if seconds < 86400:
        return f"{seconds // 3600}小时前"
    return f"{seconds // 86400}天前"


def interleave_by_category(
    order: list[str],
    platforms: dict,
    category_ids: list[str],
) -> list[str]:
    """按分类轮询排列：每轮从各分类取一个，使首页横向分布更均衡。"""
    buckets: dict[str, list[str]] = {cat_id: [] for cat_id in category_ids}
    extra: dict[str, list[str]] = {}

    for platform_id in order:
        meta = platforms.get(platform_id)
        if not meta:
            continue
        category = str(meta.get("category", "general"))
        if category in buckets:
            buckets[category].append(platform_id)
        else:
            extra.setdefault(category, []).append(platform_id)

    merged_ids = category_ids + [cat for cat in extra if cat not in category_ids]
    max_len = 0
    for cat_id in merged_ids:
        max_len = max(max_len, len(buckets.get(cat_id, [])) + len(extra.get(cat_id, [])))

    result: list[str] = []
    for index in range(max_len):
        for cat_id in merged_ids:
            items = buckets.get(cat_id, []) + extra.get(cat_id, [])
            if index < len(items):
                result.append(items[index])
    return result


def resolve_updated_at(cfg: dict, run_meta: dict | None, now: datetime) -> tuple[str, str]:
    if run_meta and run_meta.get("last_run_at"):
        iso = str(run_meta["last_run_at"])
        return iso, format_relative(iso, now)

    latest_ts = 0
    latest_iso = ""
    for platform_id in cfg.get("order", []):
        path = DATA_DIR / f"{platform_id}.json"
        if not path.exists():
            continue
        data = load_json(path)
        iso = data.get("updated_at")
        if not iso:
            continue
        try:
            ts = int(datetime.fromisoformat(iso).timestamp())
        except ValueError:
            continue
        if ts > latest_ts:
            latest_ts = ts
            latest_iso = iso
    if latest_iso:
        return latest_iso, format_relative(latest_iso, now)
    return "", "暂无更新记录"


def load_baidu_id() -> str:
    hugo_path = REPO_ROOT / "hugo.toml"
    if not hugo_path.exists():
        return ""
    with hugo_path.open("rb") as fh:
        data = tomllib.load(fh)
    baidu_id = data.get("params", {}).get("analytics", {}).get("baidu", {}).get("id", "")
    return str(baidu_id).strip() if baidu_id else ""


def platform_home_url(meta: dict) -> str:
    if meta.get("home_url"):
        return str(meta["home_url"])
    domain = str(meta.get("domain") or "").strip()
    if not domain:
        return "#"
    return f"https://{domain}"


def icon_layer(icons: dict | None, layer: str) -> dict | None:
    if not icons:
        return None
    if layer in icons and isinstance(icons[layer], dict):
        return icons[layer]
    if layer == "card" and "icons" in icons:
        return icons
    return None


def render_sprite_icon(
    platform_id: str,
    meta: dict,
    icons: dict | None,
    *,
    css_class: str,
) -> str:
    title = str(meta.get("title") or platform_id)
    letter = html.escape(title[0] if title else "?")
    color = html.escape(meta.get("color", "#ccc"))

    if icons:
        pos = icons.get("icons", {}).get(platform_id)
        if pos:
            x = int(pos["x"])
            y = int(pos["y"])
            return (
                f'<span class="{css_class}" '
                f'style="background-position: -{x}px -{y}px" aria-hidden="true"></span>'
            )

    return (
        f'<span class="hot-card__icon-letter is-visible" '
        f'style="background: {color}" aria-hidden="true">{letter}</span>'
    )


def render_icon(platform_id: str, meta: dict, icons: dict | None) -> str:
    return render_sprite_icon(
        platform_id,
        meta,
        icons,
        css_class="hot-card__icon-sprite",
    )


def render_dock_icon(platform_id: str, meta: dict, dock_icons: dict | None) -> str:
    title = str(meta.get("title") or platform_id)
    letter = html.escape(title[0] if title else "?")
    color = html.escape(meta.get("color", "#ccc"))
    pos_style = f"--dock-ph-color: {color};"
    if dock_icons:
        pos = dock_icons.get("icons", {}).get(platform_id)
        if pos:
            pos_style += f" background-position: -{int(pos['x'])}px -{int(pos['y'])}px;"
    return (
        f'<span class="hot-dock__icon" style="{pos_style}" aria-hidden="true">'
        f'<span class="hot-dock__icon-ph">{letter}</span></span>'
    )


def category_platforms(order: list[str], platforms: dict, category_id: str) -> list[tuple[str, dict]]:
    result: list[tuple[str, dict]] = []
    for platform_id in order:
        meta = platforms.get(platform_id)
        if meta and str(meta.get("category", "")) == category_id:
            result.append((platform_id, meta))
    return result


def category_accent(platforms_in_cat: list[tuple[str, dict]]) -> str:
    if not platforms_in_cat:
        return "#888888"
    _, meta = platforms_in_cat[0]
    return str(meta.get("color", "#888888"))


def load_platform_data(order: list[str]) -> dict[str, dict | None]:
    data: dict[str, dict | None] = {}
    for platform_id in order:
        path = DATA_DIR / f"{platform_id}.json"
        data[platform_id] = load_json(path) if path.exists() else None
    return data


def render_snapshot(
    categories: list[dict],
    order: list[str],
    platforms: dict,
    platform_data: dict[str, dict | None],
) -> str:
    rows: list[str] = []
    for cat in categories:
        category_id = str(cat.get("id", ""))
        if not category_id:
            continue
        category_name = html.escape(str(cat.get("name", category_id)))
        safe_category = html.escape(category_id)
        slides: list[dict[str, str]] = []

        for platform_id, meta in category_platforms(order, platforms, category_id):
            data = platform_data.get(platform_id)
            items = (data or {}).get("items") or []
            if not items:
                continue
            item = random.choice(items)
            slides.append(
                {
                    "source": str(meta.get("title") or platform_id),
                    "title": str(item.get("title", "")),
                    "url": str(item.get("url", "#")),
                    "hot": str(item.get("hot", "")) if item.get("hot") else "",
                }
            )

        if not slides:
            rows.append(
                f'<div class="hot-snapshot__row" data-category="{safe_category}" '
                f'data-ticker-delay="{len(rows) * 1000}" data-ticker-interval="{60000 + (len(rows) % 7) * 800}">'
                f'<span class="hot-snapshot__cat">{category_name}</span>'
                f'<div class="hot-snapshot__ticker">'
                f'<span class="hot-snapshot__empty">暂无数据</span></div>'
                f'<span class="hot-snapshot__hot"></span></div>'
            )
            continue

        random.shuffle(slides)
        slide_html: list[str] = []
        for index, slide in enumerate(slides):
            source = html.escape(slide["source"])
            title = html.escape(slide["title"])
            url = html.escape(slide["url"])
            hot = html.escape(slide["hot"])
            active = " is-active" if index == 0 else ""
            slide_html.append(
                f'<a class="hot-snapshot__slide{active}" href="{url}" target="_blank" '
                f'rel="noopener noreferrer" data-hot="{hot}" title="{title}">'
                f'<span class="hot-snapshot__source">{source}</span>'
                f'<span class="hot-snapshot__title">{title}</span></a>'
            )

        first_hot = html.escape(slides[0]["hot"])
        hot_visible = ' style="visibility:hidden"' if not slides[0]["hot"] else ""
        rows.append(
            f'<div class="hot-snapshot__row" data-category="{safe_category}" '
            f'data-ticker-delay="{len(rows) * 1000}" data-ticker-interval="{60000 + (len(rows) % 7) * 800}">'
            f'<span class="hot-snapshot__cat">{category_name}</span>'
            f'<div class="hot-snapshot__ticker">{"".join(slide_html)}</div>'
            f'<span class="hot-snapshot__hot"{hot_visible}>{first_hot}</span></div>'
        )

    if not rows:
        return ""
    return (
        f'<section class="hot-snapshot-wrap" aria-label="网站速览">'
        f'<h2 class="hot-snapshot__heading">网站速览</h2>'
        f'<div class="hot-snapshot">{"".join(rows)}</div>'
        f"</section>"
    )


def render_nav_icon(platform_id: str, meta: dict, nav_icons: dict | None) -> str:
    title = str(meta.get("title") or platform_id)
    letter = html.escape(title[0] if title else "?")
    color = html.escape(meta.get("color", "#ccc"))
    if nav_icons:
        pos = nav_icons.get("icons", {}).get(platform_id)
        if pos:
            x = int(pos["x"])
            y = int(pos["y"])
            return (
                f'<span class="hot-nav__menu-icon" '
                f'style="background-position: -{x}px -{y}px" aria-hidden="true"></span>'
            )
    return (
        f'<span class="hot-nav__menu-icon hot-nav__menu-icon--letter" '
        f'style="background: {color}" aria-hidden="true">{letter}</span>'
    )


def render_nav(
    categories: list[dict],
    order: list[str],
    platforms: dict,
    icons: dict | None = None,
) -> str:
    parts = ['<button type="button" class="hot-nav__btn is-active" data-filter="all">全部</button>']
    for cat in categories:
        category_id = str(cat.get("id", ""))
        category_name = html.escape(str(cat.get("name", category_id)))
        if not category_id:
            continue
        menu_html = ""
        items = category_platforms(order, platforms, category_id)
        if items:
            links: list[str] = []
            for platform_id, meta in items:
                target_id = html.escape(f"hot-{platform_id}")
                title = html.escape(str(meta.get("title") or platform_id))
                icon_html = render_nav_icon(platform_id, meta, icons)
                links.append(
                    f'<a class="hot-nav__menu-item" href="#{target_id}" role="menuitem" '
                    f'data-target="{target_id}" data-category="{html.escape(category_id)}">'
                    f'{icon_html}<span class="hot-nav__menu-label">{title}</span></a>'
                )
            menu_html = f'<div class="hot-nav__menu" role="menu">{"".join(links)}</div>'
        parts.append(
            f'<div class="hot-nav__group">'
            f'<button type="button" class="hot-nav__btn" data-filter="{html.escape(category_id)}">'
            f"{category_name}</button>{menu_html}</div>"
        )
    return "".join(parts)


def render_dock(
    order: list[str],
    platforms: dict,
    category_ids: list[str],
    icons: dict | None,
) -> str:
    dock_icons = icon_layer(icons, "dock")
    groups: list[str] = []
    merged_ids = category_ids + [
        cat_id
        for cat_id in {str(meta.get("category", "")) for meta in platforms.values()}
        if cat_id and cat_id not in category_ids
    ]

    for category_id in merged_ids:
        items_in_cat = category_platforms(order, platforms, category_id)
        if not items_in_cat:
            continue
        accent = html.escape(category_accent(items_in_cat))
        items: list[str] = []
        for platform_id, meta in items_in_cat:
            target_id = html.escape(f"hot-{platform_id}")
            name = html.escape(str(meta.get("title") or platform_id))
            icon_html = render_dock_icon(platform_id, meta, dock_icons)
            items.append(
                f'<a class="hot-dock__item" href="#{target_id}" data-target="{target_id}" '
                f'title="{name}">'
                f'{icon_html}<span class="hot-dock__name">{name}</span></a>'
            )
        groups.append(
            f'<div class="hot-dock__group" data-category="{html.escape(category_id)}" '
            f'style="--group-accent: {accent}">{"".join(items)}</div>'
        )

    if not groups:
        return ""
    return (
        f'<div class="hot-dock-wrap">'
        f'<nav class="hot-dock" aria-label="平台快捷跳转">{"".join(groups)}</nav>'
        f"</div>"
    )


def render_card(
    platform_id: str,
    meta: dict,
    data: dict | None,
    now: datetime,
    *,
    category_names: dict[str, str],
    icons: dict | None,
) -> str:
    title = html.escape(meta.get("title", platform_id))
    color = html.escape(meta.get("color", "#ccc"))
    category_id = str(meta.get("category", ""))
    category = html.escape(category_id)
    category_label = html.escape(category_names.get(category_id, category_id))
    home_url = html.escape(platform_home_url(meta))
    icon_html = render_icon(platform_id, meta, icons)

    if data:
        card_title = html.escape(data.get("title") or meta.get("title", platform_id))
        head_right_parts: list[str] = []
        if data.get("updated_at"):
            rel = format_relative(str(data["updated_at"]), now)
            dt = html.escape(str(data["updated_at"]))
            head_right_parts.append(f'<time datetime="{dt}">{html.escape(rel)}</time>')
        if not data.get("fetch_ok", True):
            head_right_parts.append('<span class="hot-card__stale">· 缓存</span>')
        head_right = " ".join(head_right_parts)
        items = data.get("items") or []
        if items:
            rows = []
            for item in items:
                rank = html.escape(str(item.get("rank", "")))
                link_title = html.escape(str(item.get("title", "")))
                url = html.escape(str(item.get("url", "#")))
                hot = item.get("hot")
                hot_html = (
                    f'<span class="hot-card__hot">{html.escape(str(hot))}</span>' if hot else ""
                )
                rows.append(
                    f'<li class="hot-card__row">'
                    f'<span class="hot-card__rank">{rank}</span>'
                    f'<a class="hot-card__link" href="{url}" target="_blank" rel="noopener noreferrer" '
                    f'title="{link_title}">{link_title}</a>{hot_html}</li>'
                )
            body = f'<ol class="hot-card__list">{"".join(rows)}</ol>'
        else:
            body = '<p class="hot-card__empty">暂无数据</p>'
    else:
        card_title = title
        head_right = '<span class="hot-card__stale">等待抓取</span>'
        body = '<p class="hot-card__empty">暂无数据</p>'

    platform_name = html.escape(str(meta.get("title") or platform_id))
    card_id = html.escape(f"hot-{platform_id}")
    safe_platform_id = html.escape(platform_id)
    return f"""<section id="{card_id}" class="hot-card hot-card--{html.escape(platform_id)}" data-category="{category}" data-platform-id="{safe_platform_id}" data-platform-name="{platform_name}" style="--hot-accent: {color}">
  <header class="hot-card__head">
    <div class="hot-card__head-left">
      <span class="hot-card__icon-box">{icon_html}</span>
      <h2 class="hot-card__title">
        <a class="hot-card__title-link" href="{home_url}" target="_blank" rel="noopener noreferrer">{card_title}</a>
        <span class="hot-card__category">{category_label}</span>
      </h2>
    </div>
    <div class="hot-card__head-right">{head_right}</div>
  </header>
  {body}
</section>"""


CSS = """
:root {
  color-scheme: light dark;
  --text: #2c3e50;
  --text-muted: #999;
  --bg: #f8f9fa;
  --link: #42b983;
  --border: rgba(125, 125, 125, 0.2);
  --hot-card-bg: #fff;
  --hot-card-head-bg: #fafafa;
  --hot-card-border: #eee;
  --hot-card-row-border: #f3f3f3;
  --hot-content-max: min(96vw, 1200px);
  --hot-content-pad: clamp(0.75rem, 2.5vw, 2.5rem);
  --hot-card-min: 280px;
}
@media (min-width: 1200px) {
  :root {
    --hot-content-max: min(94vw, 1440px);
    --hot-card-min: 300px;
  }
}
@media (min-width: 1600px) {
  :root {
    --hot-content-max: min(92vw, 1680px);
    --hot-card-min: 320px;
  }
}
@media (prefers-color-scheme: dark) {
  :root {
    --text: #e8e8e8;
    --text-muted: #999;
    --bg: #1b1c20;
    --hot-card-bg: #2a2b30;
    --hot-card-head-bg: #32333a;
    --hot-card-border: rgba(255, 255, 255, 0.08);
    --hot-card-row-border: rgba(255, 255, 255, 0.05);
  }
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color: var(--text);
  background: var(--bg);
  line-height: 1.5;
}
.hot-page { max-width: 100%; padding-bottom: 1rem; }
.hot-footer {
  max-width: var(--hot-content-max);
  margin: 1.25rem auto 0;
  padding: 1rem var(--hot-content-pad) 1.5rem;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.8rem;
  line-height: 1.6;
}
.hot-footer__stats { margin: 0; }
.hot-footer__sep { margin: 0 0.4rem; opacity: 0.55; }
.hot-header {
  position: sticky;
  top: 0;
  z-index: 100;
  width: 100%;
  padding: 1rem var(--hot-content-pad) 0.85rem;
  border-bottom: 1px solid var(--border);
  background: var(--hot-header-bg, rgba(248, 249, 250, 0.92));
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
  overflow: visible;
}
.hot-dock-wrap {
  width: 100%;
  margin-bottom: 1.25rem;
  padding: 0.85rem var(--hot-content-pad) 1rem;
  border-bottom: 1px solid var(--border);
}
.hot-snapshot-wrap {
  width: 100%;
  margin-bottom: 1rem;
  padding: 0.75rem var(--hot-content-pad) 0.85rem;
  border-bottom: 1px solid var(--border);
}
.hot-snapshot__heading {
  max-width: var(--hot-content-max);
  margin: 0 auto 0.55rem;
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--text);
}
.hot-snapshot {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0;
  max-width: var(--hot-content-max);
  margin: 0 auto;
}
@media (min-width: 900px) {
  .hot-snapshot {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: clamp(1.25rem, 3vw, 2.5rem);
  }
}
@media (min-width: 1400px) {
  .hot-snapshot {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
.hot-snapshot__row {
  display: grid;
  grid-template-columns: 3rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.65rem;
  padding: 0.42rem 0;
  border-bottom: 1px solid var(--hot-card-row-border);
}
.hot-snapshot__row:last-child { border-bottom: none; }
.hot-snapshot__cat {
  flex-shrink: 0;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--text-muted);
}
.hot-snapshot__ticker {
  position: relative;
  min-width: 0;
  height: 1.35rem;
  overflow: hidden;
}
.hot-snapshot__slide {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
  color: inherit;
  text-decoration: none;
  transform: translateY(100%);
  opacity: 0;
  pointer-events: none;
  transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.5s ease;
}
.hot-snapshot__slide.is-active {
  transform: translateY(0);
  opacity: 1;
  pointer-events: auto;
  z-index: 1;
}
.hot-snapshot__slide.is-exit {
  transform: translateY(-100%);
  opacity: 0;
  z-index: 0;
}
.hot-snapshot__slide:hover .hot-snapshot__title { color: var(--link); }
.hot-snapshot__source {
  flex-shrink: 0;
  color: var(--text-muted);
  font-size: 0.75rem;
}
.hot-snapshot__title {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 0.84rem;
}
.hot-snapshot__hot {
  flex-shrink: 0;
  max-width: 5.5rem;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--text-muted);
  font-size: 0.72rem;
  font-variant-numeric: tabular-nums;
  text-align: right;
}
@media (min-width: 1200px) {
  .hot-snapshot__row {
    grid-template-columns: 3.25rem minmax(0, 1fr) auto;
    gap: 0.75rem;
    padding: 0.48rem 0;
  }
  .hot-snapshot__cat { font-size: 0.78rem; }
  .hot-snapshot__source { font-size: 0.78rem; }
  .hot-snapshot__title { font-size: 0.88rem; }
  .hot-snapshot__hot { font-size: 0.75rem; }
}
.hot-snapshot__empty {
  color: var(--text-muted);
  font-size: 0.82rem;
}
@media (prefers-color-scheme: dark) {
  .hot-header {
    --hot-header-bg: rgba(27, 28, 32, 0.92);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
  }
}
.hot-nav {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 0.65rem;
  max-width: var(--hot-content-max);
  margin: 0 auto;
  padding: 0.5rem clamp(0.5rem, 1.5vw, 1rem);
  border-radius: 2rem;
  background: var(--hot-nav-bg, rgba(0, 0, 0, 0.04));
  overflow: visible;
}
.hot-nav__group {
  position: relative;
}
@media (prefers-color-scheme: dark) {
  .hot-nav { --hot-nav-bg: rgba(255, 255, 255, 0.06); }
}
.hot-nav__btn {
  padding: 0.62rem 1.5rem;
  min-height: 2.75rem;
  border: none;
  border-radius: 1.75rem;
  background: transparent;
  color: inherit;
  font-size: 1rem;
  font-weight: 500;
  line-height: 1.2;
  cursor: pointer;
  transition: color 0.2s, background 0.2s, box-shadow 0.2s, transform 0.15s;
}
.hot-nav__btn:hover {
  color: var(--link);
  background: rgba(66, 185, 131, 0.1);
}
.hot-nav__btn.is-active {
  background: var(--link);
  color: #fff;
  font-weight: 600;
  box-shadow: 0 4px 14px rgba(66, 185, 131, 0.35);
}
.hot-nav__btn.is-active:hover {
  color: #fff;
  transform: translateY(-1px);
}
.hot-nav__menu {
  display: none;
  position: absolute;
  top: 100%;
  left: 50%;
  z-index: 200;
  min-width: 9.5rem;
  max-width: 14rem;
  max-height: calc(16rem + 0.4rem);
  overflow-x: hidden;
  overflow-y: auto;
  padding: 0.4rem 0 0;
  margin: 0;
  border: none;
  background: transparent;
  box-shadow: none;
  transform: translateX(-50%);
}
.hot-nav__menu::after {
  content: '';
  position: absolute;
  inset: 0.4rem 0 0 0;
  z-index: 0;
  border: 1px solid var(--hot-card-border);
  border-radius: 0.55rem;
  background: var(--hot-card-bg);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  pointer-events: none;
}
.hot-nav__group.is-open .hot-nav__menu,
.hot-nav__group:focus-within .hot-nav__menu {
  display: block;
}
.hot-nav__menu-item {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.45rem 0.85rem;
  color: inherit;
  font-size: 0.86rem;
  line-height: 1.35;
  text-decoration: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hot-nav__menu-icon {
  flex-shrink: 0;
  width: var(--hot-icon-size, 1.25rem);
  height: var(--hot-icon-size, 1.25rem);
  border-radius: 0.25rem;
  background-image: var(--hot-sprite-url);
  background-repeat: no-repeat;
  background-size: var(--hot-sprite-width) var(--hot-sprite-height);
}
.hot-nav__menu-icon--letter {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background-image: none;
  color: #fff;
  font-size: 0.62rem;
  font-weight: 600;
  line-height: 1;
}
.hot-nav__menu-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hot-nav__menu-item:hover {
  color: var(--link);
  background: rgba(66, 185, 131, 0.1);
}
.hot-dock {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 0.35rem 0.5rem;
  width: 100%;
  max-width: var(--hot-content-max);
  margin: 0 auto;
  padding: 0.1rem 0;
}
@media (min-width: 1200px) {
  .hot-dock {
    gap: 0.4rem 0.65rem;
  }
  .hot-dock__group {
    padding: 0.28rem 0.38rem;
  }
}
.hot-dock__group {
  display: inline-flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 0.15rem;
  padding: 0.22rem 0.3rem;
  border-radius: 0.45rem;
  background: color-mix(in srgb, var(--group-accent, #888) 10%, transparent);
}
.hot-dock__item {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  width: 2.85rem;
  text-decoration: none;
  color: inherit;
  cursor: pointer;
  transition: transform 0.15s;
}
.hot-dock__item:hover { transform: translateY(-1px); }
.hot-dock__icon {
  display: block;
  width: 2rem;
  height: 2rem;
  border-radius: 0.45rem;
  background-repeat: no-repeat;
  background-color: transparent;
}
.hot-dock__icon-ph {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  background: var(--dock-ph-color, #888);
  color: #fff;
  font-size: 0.62rem;
  font-weight: 700;
  line-height: 1;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}
.hot-dock--ready .hot-dock__icon {
  background-image: var(--hot-dock-sprite-url);
  background-size: var(--hot-dock-sprite-width) var(--hot-dock-sprite-height);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
  background-color: #fff;
}
.hot-dock--ready .hot-dock__icon-ph { display: none; }
@media (prefers-color-scheme: dark) {
  .hot-dock--ready .hot-dock__icon { background-color: #2a2b30; }
}
.hot-dock__name {
  max-width: 2.85rem;
  color: var(--text-muted);
  font-size: 0.65rem;
  line-height: 1.2;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hot-dock__item:hover .hot-dock__name { color: var(--link); }
.hot-board {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, var(--hot-card-min)), 1fr));
  gap: clamp(0.75rem, 1.5vw, 1.25rem);
  width: 100%;
  max-width: var(--hot-content-max);
  margin: 0 auto;
  padding: 0 var(--hot-content-pad);
}
.hot-card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 19rem;
  border-radius: 0.6rem;
  background: var(--hot-card-bg);
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  scroll-margin-top: 5.5rem;
}
.hot-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.65rem;
  padding: 0.8rem 1rem;
  border-top: 3px solid var(--hot-accent, #ccc);
  border-bottom: 1px solid var(--hot-card-border);
  background: var(--hot-card-head-bg);
}
.hot-card__head-left {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
  flex: 1;
}
.hot-card__head-right {
  flex-shrink: 0;
  color: var(--text-muted);
  font-size: 0.72rem;
  white-space: nowrap;
}
.hot-card__icon-box {
  position: relative;
  flex-shrink: 0;
  width: 1.25rem;
  height: 1.25rem;
}
.hot-card__icon-sprite {
  display: block;
  width: var(--hot-icon-size, 1.25rem);
  height: var(--hot-icon-size, 1.25rem);
  background-image: var(--hot-sprite-url);
  background-repeat: no-repeat;
  background-size: var(--hot-sprite-width) var(--hot-sprite-height);
  border-radius: 0.25rem;
}
.hot-card__icon-letter {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 0.25rem;
  background: var(--hot-accent, #ccc);
  color: #fff;
  font-size: 0.65rem;
  font-weight: 700;
  line-height: 1.25rem;
  text-align: center;
}
.hot-card__title {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin: 0;
  min-width: 0;
  font-size: 0.95rem;
  font-weight: 600;
}
.hot-card__title-link {
  min-width: 0;
  color: inherit;
  text-decoration: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hot-card__title-link:hover { color: var(--hot-accent, var(--link)); }
.hot-card__category {
  flex-shrink: 0;
  padding: 0.08rem 0.35rem;
  border-radius: 0.2rem;
  background: var(--border);
  color: var(--text-muted);
  font-size: 0.62rem;
  font-weight: 500;
  line-height: 1.3;
}
.hot-card__list {
  flex: 1;
  margin: 0;
  padding: 0;
  list-style: none;
}
.hot-card__row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 0.9rem;
  border-bottom: 1px solid var(--hot-card-row-border);
}
.hot-card__rank {
  flex: 0 0 1.1rem;
  color: var(--text-muted);
  font-size: 0.78rem;
  text-align: center;
}
.hot-card__link {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: inherit;
  text-decoration: none;
  font-size: 0.86rem;
}
.hot-card__link:hover { color: var(--link); }
.hot-card__hot {
  flex: 0 0 auto;
  max-width: 4.5rem;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--text-muted);
  font-size: 0.72rem;
  text-align: right;
}
.hot-card__empty {
  flex: 1;
  margin: 0;
  padding: 1.5rem 0.85rem;
  color: var(--text-muted);
  font-size: 0.82rem;
  text-align: center;
}
.hot-card__stale { color: #c97a1a; }
@media (max-width: 640px) {
  .hot-header,
  .hot-dock-wrap,
  .hot-snapshot-wrap {
    width: 100%;
    max-width: 100%;
  }
  .hot-header {
    padding: 1rem 0.75rem 0.85rem;
  }
  .hot-snapshot-wrap {
    padding: 0.65rem 0.5rem 0.75rem;
  }
  .hot-snapshot {
    grid-template-columns: minmax(0, 1fr);
    column-gap: 0;
  }
  .hot-snapshot__row {
    grid-template-columns: 2.5rem minmax(0, 1fr);
    gap: 0.45rem 0.5rem;
  }
  .hot-snapshot__hot {
    display: none;
  }
  .hot-dock-wrap {
    padding: 0.45rem 0.35rem 0.55rem;
  }
  .hot-dock {
    gap: 0.2rem;
  }
  .hot-dock__group {
    gap: 0.08rem;
    padding: 0.15rem 0.2rem;
    border-radius: 0.35rem;
  }
  .hot-dock__item {
    width: 2.5rem;
    gap: 0;
  }
  .hot-dock__name {
    display: none;
  }
  .hot-nav {
    gap: 0.45rem;
    padding: 0.4rem;
    border-radius: 1.25rem;
  }
  .hot-nav__btn {
    padding: 0.5rem 1rem;
    min-height: 2.4rem;
    font-size: 0.92rem;
  }
  .hot-board {
    grid-template-columns: minmax(0, 1fr);
    padding-left: 0.5rem;
    padding-right: 0.5rem;
  }
}
"""

JS = """
(function () {
  function formatRelative(iso) {
    const updated = new Date(iso);
    if (Number.isNaN(updated.getTime())) return iso;
    const seconds = Math.floor((Date.now() - updated.getTime()) / 1000);
    if (seconds < 60) return '刚刚';
    if (seconds < 3600) return Math.floor(seconds / 60) + '分钟前';
    if (seconds < 86400) return Math.floor(seconds / 3600) + '小时前';
    return Math.floor(seconds / 86400) + '天前';
  }
  document.querySelectorAll('.hot-card__head time[datetime]').forEach(function (el) {
    const iso = el.getAttribute('datetime');
    if (iso) el.textContent = formatRelative(iso);
  });
})();
(function () {
  const TICKER_ANIM_MS = 500;
  document.querySelectorAll('.hot-snapshot__row').forEach(function (row) {
    const slides = row.querySelectorAll('.hot-snapshot__slide');
    const hotEl = row.querySelector('.hot-snapshot__hot');
    if (slides.length <= 1) return;
    let index = 0;
    let animating = false;
    const interval = parseInt(row.getAttribute('data-ticker-interval') || '60000', 10);
    const delay = parseInt(row.getAttribute('data-ticker-delay') || '0', 10);
    function updateHot(slide) {
      if (!hotEl) return;
      const hot = slide.getAttribute('data-hot') || '';
      hotEl.textContent = hot;
      hotEl.style.visibility = hot ? 'visible' : 'hidden';
    }
    function tick() {
      if (animating) return;
      animating = true;
      const current = slides[index];
      const nextIndex = (index + 1) % slides.length;
      const next = slides[nextIndex];
      current.classList.remove('is-active');
      current.classList.add('is-exit');
      next.classList.add('is-active');
      updateHot(next);
      setTimeout(function () {
        current.classList.remove('is-exit');
        index = nextIndex;
        animating = false;
      }, TICKER_ANIM_MS);
    }
    setTimeout(function () {
      setInterval(tick, interval);
    }, delay);
  });
})();
(function () {
  const nav = document.querySelector('.hot-nav');
  const cards = document.querySelectorAll('.hot-card[data-category]');
  if (!nav || !cards.length) return;
  const buttons = nav.querySelectorAll('.hot-nav__btn');
  const groups = nav.querySelectorAll('.hot-nav__group');
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const storageKey = 'hot-board-filter';
  function closeMenus() {
    groups.forEach(function (group) {
      group.classList.remove('is-open');
    });
  }
  function applyFilter(filter) {
    cards.forEach((card) => {
      card.style.display = filter === 'all' || card.dataset.category === filter ? '' : 'none';
    });
    buttons.forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.filter === filter);
    });
    try { localStorage.setItem(storageKey, filter); } catch (e) {}
  }
  function scrollToCard(targetId, category) {
    const card = document.getElementById(targetId);
    if (!card) return;
    if (category) applyFilter(category);
    requestAnimationFrame(() => {
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
  groups.forEach(function (group) {
    const menu = group.querySelector('.hot-nav__menu');
    if (!menu || !canHover) return;
    group.addEventListener('mouseenter', function () {
      group.classList.add('is-open');
    });
    group.addEventListener('mouseleave', function () {
      group.classList.remove('is-open');
    });
  });
  nav.addEventListener('click', (event) => {
    const menuItem = event.target.closest('.hot-nav__menu-item');
    if (menuItem) {
      event.preventDefault();
      closeMenus();
      scrollToCard(menuItem.getAttribute('data-target'), menuItem.getAttribute('data-category'));
      return;
    }
    const btn = event.target.closest('.hot-nav__btn');
    if (!btn) return;
    const group = btn.closest('.hot-nav__group');
    const menu = group && group.querySelector('.hot-nav__menu');
    if (!canHover && menu) {
      const isOpen = group.classList.contains('is-open');
      closeMenus();
      if (!isOpen) {
        group.classList.add('is-open');
      }
    } else {
      closeMenus();
    }
    applyFilter(btn.dataset.filter || 'all');
  });
  document.addEventListener('click', function (event) {
    if (!nav.contains(event.target)) closeMenus();
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closeMenus();
  });
  let saved = 'all';
  try { saved = localStorage.getItem(storageKey) || 'all'; } catch (e) {}
  if (saved !== 'all' && !nav.querySelector('[data-filter="' + saved + '"]')) saved = 'all';
  applyFilter(saved);
})();
(function () {
  const dock = document.querySelector('.hot-dock');
  if (!dock) return;
  dock.addEventListener('click', (event) => {
    const item = event.target.closest('.hot-dock__item');
    if (!item) return;
    event.preventDefault();
    const targetId = item.getAttribute('data-target');
    if (!targetId) return;
    const card = document.getElementById(targetId);
    if (!card) return;
    const allBtn = document.querySelector('.hot-nav__btn[data-filter="all"]');
    if (allBtn && !allBtn.classList.contains('is-active')) {
      allBtn.click();
    }
    requestAnimationFrame(() => {
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
})();
"""

BAIDU_TRACKING_JS = """
(function () {
  const seen = new Set();
  const observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      const card = entry.target;
      const platformId = card.dataset.platformId;
      if (!platformId || seen.has(platformId)) return;
      seen.add(platformId);
      const label = (card.dataset.platformName || platformId) + '|' + (card.dataset.category || '');
      window._hmt = window._hmt || [];
      _hmt.push(['_trackEvent', 'hot_platform', 'view', label]);
      observer.unobserve(card);
    });
  }, { rootMargin: '0px', threshold: 0.15 });
  document.querySelectorAll('.hot-card[data-platform-id]').forEach(function (card) {
    observer.observe(card);
  });
})();
"""


def baidu_head_html(baidu_id: str) -> str:
    if not baidu_id:
        return ""
    safe_id = html.escape(baidu_id)
    return f"""  <script>
    var _hmt = _hmt || [];
    (function () {{
      var hm = document.createElement("script");
      hm.src = "https://hm.baidu.com/hm.js?{safe_id}";
      var s = document.getElementsByTagName("script")[0];
      s.parentNode.insertBefore(hm, s);
    }})();
  </script>
"""


def sprite_css(icons: dict | None) -> str:
    card = icon_layer(icons, "card") if icons else icons
    if not card:
        return ""
    sprite = html.escape(str(card.get("sprite", "icons-sprite.png")))
    return (
        f":root {{ --hot-sprite-url: url('{sprite}'); "
        f"--hot-sprite-width: {int(card.get('width', 0))}px; "
        f"--hot-sprite-height: {int(card.get('height', 0))}px; "
        f"--hot-icon-size: {int(card.get('icon_size', 20))}px; }}"
    )


def dock_sprite_js(dock: dict | None) -> str:
    if not dock:
        return ""
    cfg = json.dumps(
        {
            "sprite": dock.get("sprite", "icons-sprite-dock.png"),
            "width": int(dock.get("width", 0)),
            "height": int(dock.get("height", 0)),
        },
        ensure_ascii=False,
    )
    return f"""
(function () {{
  const cfg = {cfg};
  if (!cfg.sprite) return;
  function applyDockSprite() {{
    const root = document.documentElement;
    const dock = document.querySelector('.hot-dock');
    if (!dock) return;
    const img = new Image();
    img.onload = function () {{
      root.style.setProperty('--hot-dock-sprite-url', "url('" + cfg.sprite + "')");
      root.style.setProperty('--hot-dock-sprite-width', cfg.width + 'px');
      root.style.setProperty('--hot-dock-sprite-height', cfg.height + 'px');
      dock.classList.add('hot-dock--ready');
    }};
    img.src = cfg.sprite;
  }}
  if ('requestIdleCallback' in window) {{
    requestIdleCallback(applyDockSprite, {{ timeout: 2500 }});
  }} else {{
    window.addEventListener('load', function () {{ setTimeout(applyDockSprite, 0); }});
  }}
}})();
"""


def build() -> Path:
    cfg = load_json(DATA_DIR / "config.json")
    now = datetime.now(timezone.utc).astimezone()
    icons_path = DATA_DIR / "icons.json"
    icons_raw = load_json(icons_path) if icons_path.exists() else None
    icons = icons_raw
    card_icons = icon_layer(icons_raw, "card")
    category_names = {
        str(cat.get("id", "")): str(cat.get("name", ""))
        for cat in cfg.get("categories", [])
        if cat.get("id")
    }

    platforms = cfg.get("platforms", {})
    platform_order = cfg.get("order", [])
    baidu_id = load_baidu_id()

    nav_html = render_nav(cfg.get("categories", []), platform_order, platforms, card_icons)
    category_ids = [cat["id"] for cat in cfg.get("categories", []) if cat.get("id")]
    platform_data = load_platform_data(platform_order)
    snapshot_html = render_snapshot(
        cfg.get("categories", []),
        platform_order,
        platforms,
        platform_data,
    )
    display_order = interleave_by_category(cfg.get("order", []), platforms, category_ids)
    cards = []
    for platform_id in display_order:
        pmeta = platforms.get(platform_id)
        if not pmeta:
            continue
        data = platform_data.get(platform_id)
        cards.append(
            render_card(
                platform_id,
                pmeta,
                data,
                now,
                category_names=category_names,
                icons=card_icons,
            )
        )

    dock_html = render_dock(platform_order, platforms, category_ids, icons_raw)
    dock_icons = icon_layer(icons_raw, "dock")
    page_js = JS + dock_sprite_js(dock_icons)
    if baidu_id:
        page_js += BAIDU_TRACKING_JS

    page = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>热榜</title>
  <meta name="description" content="多平台热榜聚合">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <link rel="canonical" href="{SITE_URL}news/">
{baidu_head_html(baidu_id)}  <style>{sprite_css(card_icons)}{CSS}</style>
</head>
<body>
  <main class="hot-page">
    <header class="hot-header">
      <nav class="hot-nav" aria-label="热榜分类">{nav_html}</nav>
    </header>
    {snapshot_html}
    {dock_html}
    <div class="hot-board">{"".join(cards)}</div>
    <footer class="hot-footer">
      <p class="hot-footer__stats">
        <span id="busuanzi_container_site_uv">本站访客 <span id="busuanzi_value_site_uv">—</span></span>
        <span class="hot-footer__sep" aria-hidden="true">·</span>
        <span id="busuanzi_container_site_pv">总访问 <span id="busuanzi_value_site_pv">—</span></span>
        <span class="hot-footer__sep" aria-hidden="true">·</span>
        <span id="busuanzi_container_page_pv">本页 <span id="busuanzi_value_page_pv">—</span></span>
      </p>
    </footer>
  </main>
  <script async src="//busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js"></script>
  <script>{page_js}</script>
</body>
</html>
"""

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(page, encoding="utf-8")
    return OUTPUT


def main() -> int:
    path = build()
    print(f"built {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
