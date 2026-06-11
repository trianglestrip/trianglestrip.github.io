#!/usr/bin/env python3
"""下载各平台 favicon，合成卡片用小图与导航用大图雪碧图。"""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from io import BytesIO
from pathlib import Path

NEWS_ROOT = Path(__file__).resolve().parent
CONFIG_FILE = NEWS_ROOT / "data" / "config.json"
MANIFEST_FILE = NEWS_ROOT / "data" / "icons.json"
SPRITE_CARD_FILE = NEWS_ROOT / "icons-sprite.png"
SPRITE_DOCK_FILE = NEWS_ROOT / "icons-sprite-dock.png"
CARD_ICON_SIZE = 20
DOCK_ICON_SIZE = 32
COLS = 10
USER_AGENT = "Mozilla/5.0 (compatible; blog-hot-icons/1.0)"


def load_config() -> dict:
    with CONFIG_FILE.open(encoding="utf-8") as fh:
        return json.load(fh)


def download_icon(domain: str) -> bytes | None:
    url = f"https://www.google.com/s2/favicons?domain={domain}&sz=128"
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            data = response.read()
    except (urllib.error.URLError, TimeoutError, OSError):
        return None
    return data if data else None


def make_letter_icon(letter: str, color: str, size: int) -> "object":
    from PIL import Image, ImageDraw, ImageFont

    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    fill = color if color.startswith("#") else "#888888"
    rgb = tuple(int(fill[i : i + 2], 16) for i in (1, 3, 5))
    radius = max(4, size // 5)
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=rgb + (255,))
    text = (letter or "?")[:1].upper()
    font_size = max(12, size // 3)
    try:
        font = ImageFont.truetype("arial.ttf", font_size)
    except OSError:
        font = ImageFont.load_default()
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    draw.text(
        ((size - tw) / 2, (size - th) / 2 - 1),
        text,
        fill=(255, 255, 255, 255),
        font=font,
    )
    return image


def load_icon_image(raw: bytes, size: int) -> "object":
    from PIL import Image

    image = Image.open(BytesIO(raw)).convert("RGBA")
    return image.resize((size, size), Image.Resampling.LANCZOS)


def resolve_icon_image(
    raw: bytes | None,
    title: str,
    color: str,
    icon_size: int,
) -> "object":
    if raw:
        try:
            return load_icon_image(raw, icon_size)
        except Exception:
            pass
    return make_letter_icon(title, color, icon_size)


def build_layer(
    platform_ids: list[str],
    sources: dict[str, tuple[bytes | None, str, str]],
    icon_size: int,
) -> tuple["object", dict[str, dict[str, int]]]:
    from PIL import Image

    rows = (len(platform_ids) + COLS - 1) // COLS
    sprite = Image.new("RGBA", (COLS * icon_size, rows * icon_size), (0, 0, 0, 0))
    manifest_icons: dict[str, dict[str, int]] = {}

    for index, platform_id in enumerate(platform_ids):
        raw, title, color = sources[platform_id]
        col = index % COLS
        row = index // COLS
        x = col * icon_size
        y = row * icon_size
        icon = resolve_icon_image(raw, title, color, icon_size)
        sprite.paste(icon, (x, y), icon)
        manifest_icons[platform_id] = {"x": x, "y": y}

    return sprite, manifest_icons


def layer_manifest(sprite_file: Path, icon_size: int, icons: dict[str, dict[str, int]]) -> dict:
    rows = (len(icons) + COLS - 1) // COLS if icons else 0
    return {
        "icon_size": icon_size,
        "cols": COLS,
        "rows": rows,
        "sprite": sprite_file.name,
        "width": COLS * icon_size,
        "height": rows * icon_size,
        "icons": icons,
    }


def build_sprite() -> dict:
    try:
        from PIL import Image  # noqa: F401
    except ImportError as exc:
        raise SystemExit("请先安装 Pillow: pip install pillow") from exc

    cfg = load_config()
    order = cfg.get("order", [])
    platforms = cfg.get("platforms", {})
    platform_ids = [pid for pid in order if pid in platforms]
    if not platform_ids:
        raise SystemExit("config.json 中没有可生成图标的平台")

    sources: dict[str, tuple[bytes | None, str, str]] = {}
    for platform_id in platform_ids:
        meta = platforms[platform_id]
        domain = str(meta.get("icon_domain") or meta.get("domain") or "")
        title = str(meta.get("title") or platform_id)
        color = str(meta.get("color") or "#888888")
        raw = download_icon(domain) if domain else None
        sources[platform_id] = (raw, title, color)

    card_sprite, card_icons = build_layer(platform_ids, sources, CARD_ICON_SIZE)
    dock_sprite, dock_icons = build_layer(platform_ids, sources, DOCK_ICON_SIZE)

    SPRITE_CARD_FILE.parent.mkdir(parents=True, exist_ok=True)
    card_sprite.save(SPRITE_CARD_FILE, format="PNG")
    dock_sprite.save(SPRITE_DOCK_FILE, format="PNG")

    manifest = {
        "card": layer_manifest(SPRITE_CARD_FILE, CARD_ICON_SIZE, card_icons),
        "dock": layer_manifest(SPRITE_DOCK_FILE, DOCK_ICON_SIZE, dock_icons),
    }
    MANIFEST_FILE.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return manifest


def main() -> int:
    manifest = build_sprite()
    card = manifest["card"]
    dock = manifest["dock"]
    print(
        f"built {SPRITE_CARD_FILE} ({card['width']}x{card['height']}, "
        f"{len(card['icons'])} icons)"
    )
    print(
        f"built {SPRITE_DOCK_FILE} ({dock['width']}x{dock['height']}, "
        f"{len(dock['icons'])} icons)"
    )
    print(f"wrote {MANIFEST_FILE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
