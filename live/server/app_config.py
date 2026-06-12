"""加载 server/config.json（可选 config.local.json 覆盖）。"""

from __future__ import annotations

import json
import sys
from copy import deepcopy
from pathlib import Path
from typing import Any


def _app_root() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent


ROOT = _app_root()

DEFAULT_CONFIG: dict[str, Any] = {
    "host": "127.0.0.1",
    "port": 8765,
    "cors": {
        "enabled": True,
        "allowOrigin": "*",
    },
    "static": {
        "enabled": False,
        "distPath": "../dist/web",
    },
}


def _deep_merge(base: dict[str, Any], patch: dict[str, Any]) -> dict[str, Any]:
    out = deepcopy(base)
    for key, value in patch.items():
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = _deep_merge(out[key], value)
        else:
            out[key] = value
    return out


def load_config(config_path: Path | None = None) -> dict[str, Any]:
    path = config_path or (ROOT / "config.json")
    cfg = deepcopy(DEFAULT_CONFIG)
    if path.is_file():
        cfg = _deep_merge(cfg, json.loads(path.read_text(encoding="utf-8-sig")))
    local = path.with_name("config.local.json")
    if local.is_file():
        cfg = _deep_merge(cfg, json.loads(local.read_text(encoding="utf-8-sig")))
    return cfg


def resolve_static_root(cfg: dict[str, Any]) -> Path | None:
    static_cfg = cfg.get("static") or {}
    if not static_cfg.get("enabled"):
        return None
    raw = static_cfg.get("distPath") or "../dist/web"
    root = (ROOT / raw).resolve()
    index = root / "index.html"
    return root if index.is_file() else None
