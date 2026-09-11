#!/usr/bin/env python3
"""Validate Mermaid blocks against the site's Mermaid 10.9.8-compatible subset.

The site renders Mermaid with a pinned legacy-compatible runtime. This check is
intentionally conservative: it catches syntax that can be accepted by newer
Mermaid versions but is fragile after Hugo/HTML processing.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

FENCE_RE = re.compile(r"```mermaid\s*\n(.*?)\n```", re.IGNORECASE | re.DOTALL)
NODE_RE = re.compile(
    r"(?<![A-Za-z0-9_])([A-Za-z][A-Za-z0-9_]*)\s*(\[|\{)(.*?)(\]|\})"
)


def check_block(block: str, path: Path, block_number: int) -> list[str]:
    errors: list[str] = []
    lines = block.splitlines()
    if not lines:
        return [f"{path}: Mermaid block #{block_number} is empty"]

    diagram_type = lines[0].strip()
    if not (
        diagram_type.startswith(("flowchart ", "graph "))
        or diagram_type == "sequenceDiagram"
    ):
        errors.append(
            f"{path}: Mermaid block #{block_number} has unsupported header "
            f"{diagram_type!r}; use flowchart/graph/sequenceDiagram"
        )

    for offset, line in enumerate(lines, start=1):
        stripped = line.strip()
        if stripped.startswith("%%{init:"):
            errors.append(
                f"{path}:{offset}: Mermaid init directives are disabled for the "
                "site's Mermaid 10.9.8 compatibility subset"
            )

        # Raw HTML entities are often introduced by Discussion/Hugo conversion
        # and can change Mermaid's lexer input.
        if any(entity in line for entity in ("&gt;", "&lt;", "&amp;")):
            errors.append(
                f"{path}:{offset}: HTML entity found in Mermaid source; use plain "
                "text or quote the complete label"
            )

        # A label containing grammar punctuation must be quoted. The parser
        # otherwise treats it as Mermaid syntax instead of label text.
        for match in NODE_RE.finditer(line):
            node_id, opener, label, _ = match.groups()
            if label.startswith('"'):
                continue
            if any(ch in label for ch in "[]{}()"):
                errors.append(
                    f"{path}:{offset}: node {node_id!r} has unquoted grammar "
                    f"characters in its label; use {node_id}[\"...\"]"
                )

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "root",
        nargs="?",
        default=".hugo-prepared/content",
        help="directory containing Markdown articles",
    )
    args = parser.parse_args()
    root = Path(args.root)
    if not root.is_dir():
        print(f"Mermaid check skipped: directory not found: {root}")
        return 0

    errors: list[str] = []
    files = sorted(root.rglob("*.md"))
    block_count = 0
    for path in files:
        text = path.read_text(encoding="utf-8-sig")
        for number, match in enumerate(FENCE_RE.finditer(text), start=1):
            block_count += 1
            errors.extend(check_block(match.group(1), path, number))

    if errors:
        print("Mermaid 10.9.8 compatibility check failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print(f"Mermaid 10.9.8 compatibility check passed: {block_count} block(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
