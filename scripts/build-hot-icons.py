#!/usr/bin/env python3
"""下载各平台 favicon，合成雪碧图 static/news/icons-sprite.png。"""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from io import BytesIO
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONFIG_FILE = ROOT / "data" / "hot" / "config.json"
MANIFEST_FILE = ROOT / "data" / "hot" / "icons.json"
SPRITE_FILE = ROOT / "static" / "news" / "icons-sprite.png"
ICON_SIZE = 20
COLS = 10
USER_AGENT = "Mozilla/5.0 (compatible; blog-hot-icons/1.0)"


def load_config() -> dict:
    with CONFIG_FILE.open(encoding="utf-8") as fh:
        return json.load(fh)


def download_icon(domain: str) -> bytes | None:
    url = f"https://www.google.com/s2/favicons?domain={domain}&sz=64"
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            data = response.read()
    except (urllib.error.URLError, TimeoutError, OSError):
        return None
    return data if data else None


def make_letter_icon(letter: str, color: str) -> "object":
    from PIL import Image, ImageDraw, ImageFont

    image = Image.new("RGBA", (ICON_SIZE, ICON_SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    fill = color if color.startswith("#") else "#888888"
    rgb = tuple(int(fill[i : i + 2], 16) for i in (1, 3, 5))
    draw.rounded_rectangle((0, 0, ICON_SIZE - 1, ICON_SIZE - 1), radius=4, fill=rgb + (255,))
    text = (letter or "?")[:1].upper()
    try:
        font = ImageFont.truetype("arial.ttf", 12)
    except OSError:
        font = ImageFont.load_default()
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    draw.text(((ICON_SIZE - tw) / 2, (ICON_SIZE - th) / 2 - 1), text, fill=(255, 255, 255, 255), font=font)
    return image


def load_icon_image(raw: bytes) -> "object":
    from PIL import Image

    image = Image.open(BytesIO(raw)).convert("RGBA")
    return image.resize((ICON_SIZE, ICON_SIZE), Image.Resampling.LANCZOS)


def build_sprite() -> dict:
    try:
        from PIL import Image
    except ImportError as exc:
        raise SystemExit("请先安装 Pillow: pip install pillow") from exc

    cfg = load_config()
    order = cfg.get("order", [])
    platforms = cfg.get("platforms", {})
    platform_ids = [pid for pid in order if pid in platforms]
    if not platform_ids:
        raise SystemExit("config.json 中没有可生成图标的平台")

    rows = (len(platform_ids) + COLS - 1) // COLS
    sprite = Image.new("RGBA", (COLS * ICON_SIZE, rows * ICON_SIZE), (0, 0, 0, 0))
    manifest_icons: dict[str, dict[str, int]] = {}

    for index, platform_id in enumerate(platform_ids):
        meta = platforms[platform_id]
        domain = str(meta.get("icon_domain") or meta.get("domain") or "")
        title = str(meta.get("title") or platform_id)
        color = str(meta.get("color") or "#888888")
        col = index % COLS
        row = index // COLS
        x = col * ICON_SIZE
        y = row * ICON_SIZE

        raw = download_icon(domain) if domain else None
        if raw:
            try:
                icon = load_icon_image(raw)
            except Exception:
                icon = make_letter_icon(title, color)
        else:
            icon = make_letter_icon(title, color)

        sprite.paste(icon, (x, y), icon)
        manifest_icons[platform_id] = {"x": x, "y": y}

    SPRITE_FILE.parent.mkdir(parents=True, exist_ok=True)
    sprite.save(SPRITE_FILE, format="PNG")

    manifest = {
        "icon_size": ICON_SIZE,
        "cols": COLS,
        "rows": rows,
        "sprite": "icons-sprite.png",
        "width": COLS * ICON_SIZE,
        "height": rows * ICON_SIZE,
        "icons": manifest_icons,
    }
    MANIFEST_FILE.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return manifest


def main() -> int:
    manifest = build_sprite()
    print(f"built {SPRITE_FILE} ({manifest['width']}x{manifest['height']}, {len(manifest['icons'])} icons)")
    print(f"wrote {MANIFEST_FILE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
