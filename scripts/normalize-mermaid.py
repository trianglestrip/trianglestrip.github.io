#!/usr/bin/env python3
"""Normalize Mermaid blocks for the site's Mermaid 10.9.8-compatible subset."""

from __future__ import annotations

import re
import sys
from pathlib import Path

FENCE_RE = re.compile(r"```mermaid\s*\n(.*?)\n```", re.IGNORECASE | re.DOTALL)


def normalize_block(block: str) -> str:
    lines = block.splitlines()
    out: list[str] = []
    skipping_init = False
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("%%{init:"):
            skipping_init = True
            continue
        if skipping_init:
            if stripped == "}}%%":
                skipping_init = False
            continue
        out.append(line)

    block = "\n".join(out)
    block = block.replace("&gt;", ">")
    block = block.replace("&lt;", "<")
    block = block.replace("&amp;", "&")

    # Labels with Mermaid grammar punctuation are quoted. Keep the transform
    # limited to common node declarations to avoid altering edge syntax.
    def quote_node(match: re.Match[str]) -> str:
        node_id, opener, label, closer = match.groups()
        if label.startswith('"'):
            return match.group(0)
        if any(ch in label for ch in "[]{}()"):
            return f'{node_id}{opener}"{label}"{closer}'
        return match.group(0)

    block = re.sub(
        r'(?<![A-Za-z0-9_])([A-Za-z][A-Za-z0-9_]*)\s*(\[|\{)([^\n]*?)(\]|\})',
        quote_node,
        block,
    )
    block = re.sub(r"(?m);[ \t]*$", "", block)
    return block.strip()


def main() -> int:
    if len(sys.argv) != 2:
        print(f"usage: {Path(sys.argv[0]).name} FILE", file=sys.stderr)
        return 2
    path = Path(sys.argv[1])
    text = path.read_text(encoding="utf-8-sig")
    converted = FENCE_RE.sub(lambda m: "```mermaid\n" + normalize_block(m.group(1)) + "\n```", text)
    path.write_text(converted, encoding="utf-8")
    print(f"normalized Mermaid blocks in {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
