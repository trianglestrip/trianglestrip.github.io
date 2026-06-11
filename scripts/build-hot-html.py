#!/usr/bin/env python3
"""根据 data/hot 缓存生成独立静态热榜页 static/news/index.html。"""

from __future__ import annotations

import html
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data" / "hot"
OUTPUT = ROOT / "static" / "news" / "index.html"
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


def render_dock(
    display_order: list[str],
    platforms: dict,
    icons: dict | None,
) -> str:
    dock_icons = icon_layer(icons, "dock")
    items: list[str] = []
    for platform_id in display_order:
        meta = platforms.get(platform_id)
        if not meta:
            continue
        target_id = html.escape(f"hot-{platform_id}")
        name = html.escape(str(meta.get("title") or platform_id))
        icon_html = render_sprite_icon(
            platform_id,
            meta,
            dock_icons,
            css_class="hot-dock__icon",
        )
        items.append(
            f'<a class="hot-dock__item" href="#{target_id}" data-target="{target_id}">'
            f'{icon_html}<span class="hot-dock__name">{name}</span></a>'
        )
    if not items:
        return ""
    return f'<nav class="hot-dock" aria-label="平台快捷跳转">{"".join(items)}</nav>'


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

    card_id = html.escape(f"hot-{platform_id}")
    return f"""<section id="{card_id}" class="hot-card hot-card--{html.escape(platform_id)}" data-category="{category}" style="--hot-accent: {color}">
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
.hot-page { max-width: 100%; padding-bottom: 2rem; }
.hot-header {
  position: sticky;
  top: 0;
  z-index: 100;
  width: 100vw;
  max-width: 100vw;
  margin-left: calc(50% - 50vw);
  margin-bottom: 1.25rem;
  padding: 1rem 1.5rem 1.15rem;
  border-bottom: 1px solid var(--border);
  background: var(--hot-header-bg, rgba(248, 249, 250, 0.92));
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
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
  max-width: 1100px;
  margin: 0 auto;
  padding: 0.5rem;
  border-radius: 2rem;
  background: var(--hot-nav-bg, rgba(0, 0, 0, 0.04));
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
.hot-dock {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.85rem 0.75rem;
  max-width: 100%;
  margin: 1rem auto 0;
  padding: 0.25rem 0.5rem 0.15rem;
}
.hot-dock__item {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  width: 4.5rem;
  text-decoration: none;
  color: inherit;
  cursor: pointer;
  transition: transform 0.15s;
}
.hot-dock__item:hover { transform: translateY(-2px); }
.hot-dock__icon {
  display: block;
  width: var(--hot-dock-icon-size, 4rem);
  height: var(--hot-dock-icon-size, 4rem);
  background-image: var(--hot-dock-sprite-url);
  background-repeat: no-repeat;
  background-size: var(--hot-dock-sprite-width) var(--hot-dock-sprite-height);
  border-radius: 0.85rem;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.12);
  background-color: #fff;
}
@media (prefers-color-scheme: dark) {
  .hot-dock__icon { background-color: #2a2b30; }
}
.hot-dock__name {
  max-width: 4.5rem;
  color: var(--text-muted);
  font-size: 0.72rem;
  line-height: 1.25;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hot-dock__item:hover .hot-dock__name { color: var(--link); }
.hot-board {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1rem;
  width: 100vw;
  max-width: 100vw;
  margin-left: calc(50% - 50vw);
  padding: 0 1.25rem;
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
  scroll-margin-top: 11rem;
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
@media (max-width: 1400px) {
  .hot-board { grid-template-columns: repeat(3, minmax(0, 1fr)); padding: 0 1rem; }
}
@media (max-width: 1024px) {
  .hot-board { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 640px) {
  .hot-header {
    width: 100%;
    max-width: 100%;
    margin-left: 0;
    padding: 1rem 0.75rem 1.25rem;
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
    width: 100%;
    max-width: 100%;
    margin-left: 0;
    padding-left: 0;
    padding-right: 0;
    grid-template-columns: 1fr;
  }
}
"""

JS = """
(function () {
  const nav = document.querySelector('.hot-nav');
  const cards = document.querySelectorAll('.hot-card[data-category]');
  if (!nav || !cards.length) return;
  const buttons = nav.querySelectorAll('.hot-nav__btn');
  const storageKey = 'hot-board-filter';
  function applyFilter(filter) {
    cards.forEach((card) => {
      card.style.display = filter === 'all' || card.dataset.category === filter ? '' : 'none';
    });
    buttons.forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.filter === filter);
    });
    try { localStorage.setItem(storageKey, filter); } catch (e) {}
  }
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => applyFilter(btn.dataset.filter || 'all'));
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


def sprite_css(icons: dict | None) -> str:
    if not icons:
        return ""
    parts: list[str] = []
    card = icon_layer(icons, "card")
    dock = icon_layer(icons, "dock")
    if card:
        sprite = html.escape(str(card.get("sprite", "icons-sprite.png")))
        parts.append(
            f"--hot-sprite-url: url('{sprite}'); "
            f"--hot-sprite-width: {int(card.get('width', 0))}px; "
            f"--hot-sprite-height: {int(card.get('height', 0))}px; "
            f"--hot-icon-size: {int(card.get('icon_size', 20))}px"
        )
    if dock:
        sprite = html.escape(str(dock.get("sprite", "icons-sprite-lg.png")))
        parts.append(
            f"--hot-dock-sprite-url: url('{sprite}'); "
            f"--hot-dock-sprite-width: {int(dock.get('width', 0))}px; "
            f"--hot-dock-sprite-height: {int(dock.get('height', 0))}px; "
            f"--hot-dock-icon-size: {int(dock.get('icon_size', 64))}px"
        )
    if not parts:
        return ""
    return f":root {{ {'; '.join(parts)}; }}"


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

    nav_buttons = ['<button type="button" class="hot-nav__btn is-active" data-filter="all">全部</button>']
    for cat in cfg.get("categories", []):
        nav_buttons.append(
            f'<button type="button" class="hot-nav__btn" data-filter="{html.escape(cat["id"])}">'
            f'{html.escape(cat["name"])}</button>'
        )

    platforms = cfg.get("platforms", {})
    category_ids = [cat["id"] for cat in cfg.get("categories", []) if cat.get("id")]
    display_order = interleave_by_category(cfg.get("order", []), platforms, category_ids)
    cards = []
    for platform_id in display_order:
        pmeta = platforms.get(platform_id)
        if not pmeta:
            continue
        data_path = DATA_DIR / f"{platform_id}.json"
        data = load_json(data_path) if data_path.exists() else None
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

    dock_html = render_dock(display_order, platforms, icons_raw)

    page = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>热榜</title>
  <meta name="description" content="多平台热榜聚合">
  <link rel="canonical" href="{SITE_URL}news/">
  <style>{sprite_css(icons)}{CSS}</style>
</head>
<body>
  <main class="hot-page">
    <header class="hot-header">
      <nav class="hot-nav" aria-label="热榜分类">{"".join(nav_buttons)}</nav>
      {dock_html}
    </header>
    <div class="hot-board">{"".join(cards)}</div>
  </main>
  <script>{JS}</script>
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
