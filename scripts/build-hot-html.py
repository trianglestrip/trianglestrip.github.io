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


def icon_src(meta: dict) -> str:
    if meta.get("icon_url"):
        return str(meta["icon_url"])
    domain = meta.get("icon_domain") or meta.get("domain", "")
    # 直连站点 favicon 常被 CORP/403 拦截（如 linux.do），走代理
    return f"https://www.google.com/s2/favicons?domain={domain}&sz=32"


def render_card(platform_id: str, meta: dict, data: dict | None, now: datetime) -> str:
    title = html.escape(meta.get("title", platform_id))
    color = html.escape(meta.get("color", "#ccc"))
    category = html.escape(meta.get("category", ""))
    icon = html.escape(icon_src(meta))
    letter = html.escape(title[0] if title else "?")

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

    return f"""<section class="hot-card hot-card--{html.escape(platform_id)}" data-category="{category}" style="--hot-accent: {color}">
  <header class="hot-card__head">
    <div class="hot-card__head-left">
      <span class="hot-card__icon-box">
        <img class="hot-card__icon" src="{icon}" alt="" width="20" height="20" loading="lazy" decoding="async">
        <span class="hot-card__icon-letter" aria-hidden="true">{letter}</span>
      </span>
      <h2 class="hot-card__title">{card_title}</h2>
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
  width: 100vw;
  max-width: 100vw;
  margin-left: calc(50% - 50vw);
  margin-bottom: 1.25rem;
  padding: 1.25rem 1.5rem 1.5rem;
  border-bottom: 1px solid var(--border);
  background: var(--hot-header-bg, rgba(255, 255, 255, 0.72));
  backdrop-filter: blur(8px);
}
@media (prefers-color-scheme: dark) {
  .hot-header { --hot-header-bg: rgba(42, 43, 48, 0.85); }
}
.hot-meta {
  margin: 0 0 1rem;
  color: var(--text-muted);
  font-size: 0.82rem;
  text-align: center;
  letter-spacing: 0.02em;
}
.hot-meta--empty { color: #c97a1a; }
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
.hot-card__icon {
  display: block;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 0.25rem;
  object-fit: contain;
  background: #fff;
}
.hot-card__icon.is-hidden { display: none; }
.hot-card__icon-letter {
  display: none;
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
.hot-card__icon-letter.is-visible { display: flex; }
.hot-card__title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
  document.querySelectorAll('.hot-card__icon').forEach((img) => {
    img.addEventListener('error', function () {
      this.classList.add('is-hidden');
      this.nextElementSibling?.classList.add('is-visible');
    });
  });
})();
"""


def build() -> Path:
    cfg = load_json(DATA_DIR / "config.json")
    meta_path = DATA_DIR / "meta.json"
    run_meta = load_json(meta_path) if meta_path.exists() else None
    now = datetime.now(timezone.utc).astimezone()

    updated_iso, updated_label = resolve_updated_at(cfg, run_meta, now)
    meta_class = "" if updated_iso else " hot-meta--empty"
    meta_time = (
        f'<time datetime="{html.escape(updated_iso)}">{html.escape(updated_label)}</time>'
        if updated_iso
        else html.escape(updated_label)
    )

    nav_buttons = ['<button type="button" class="hot-nav__btn is-active" data-filter="all">全部</button>']
    for cat in cfg.get("categories", []):
        nav_buttons.append(
            f'<button type="button" class="hot-nav__btn" data-filter="{html.escape(cat["id"])}">'
            f'{html.escape(cat["name"])}</button>'
        )

    platforms = cfg.get("platforms", {})
    cards = []
    for platform_id in cfg.get("order", []):
        pmeta = platforms.get(platform_id)
        if not pmeta:
            continue
        data_path = DATA_DIR / f"{platform_id}.json"
        data = load_json(data_path) if data_path.exists() else None
        cards.append(render_card(platform_id, pmeta, data, now))

    page = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>热榜</title>
  <meta name="description" content="多平台热榜聚合">
  <link rel="canonical" href="{SITE_URL}news/">
  <style>{CSS}</style>
</head>
<body>
  <main class="hot-page">
    <header class="hot-header">
      <p class="hot-meta{meta_class}">更新于 {meta_time}</p>
      <nav class="hot-nav" aria-label="热榜分类">{"".join(nav_buttons)}</nav>
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
