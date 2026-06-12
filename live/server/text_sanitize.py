"""清理 API 响应中无法 UTF-8 编码的孤立 surrogate（常见于第三方 emoji 字段）。"""

from __future__ import annotations

from typing import Any


def sanitize_unicode(value: Any) -> Any:
    if isinstance(value, str):
        return value.encode("utf-16", "surrogatepass").decode("utf-16", "replace")
    if isinstance(value, dict):
        return {k: sanitize_unicode(v) for k, v in value.items()}
    if isinstance(value, list):
        return [sanitize_unicode(v) for v in value]
    if isinstance(value, tuple):
        return tuple(sanitize_unicode(v) for v in value)
    return value
