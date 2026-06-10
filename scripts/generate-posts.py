#!/usr/bin/env python3
"""从 docs/posts/*.md 生成 posts.json，自动附带 Git 创建/修改日期。"""

import json
import re
import subprocess
import sys
from pathlib import Path


def parse_front_matter(content: str):
    meta = {}
    body = content
    if content.startswith("---"):
        parts = content.split("---", 2)
        if len(parts) >= 3:
            for line in parts[1].strip().splitlines():
                if ":" in line:
                    key, value = line.split(":", 1)
                    meta[key.strip()] = value.strip().strip("\"'")
            body = parts[2]
    return meta, body


def git_date(path: Path, first: bool = False) -> str:
    cmd = ["git", "log", "--follow", "--format=%aI"]
    if first:
        cmd.extend(["--diff-filter=A", "-1"])
    else:
        cmd.append("-1")
    cmd.extend(["--", path.as_posix()])
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        line = result.stdout.strip()
        return line[:10] if line else ""
    except (subprocess.CalledProcessError, FileNotFoundError):
        return ""


def extract_title(meta, body, filename):
    if meta.get("title"):
        return meta["title"]
    match = re.search(r"^#\s+(.+)", body, re.MULTILINE)
    if match:
        return match.group(1).strip()
    return Path(filename).stem


def extract_excerpt(meta, body):
    if meta.get("excerpt"):
        return meta["excerpt"]
    for line in body.splitlines():
        text = line.strip()
        if not text or text.startswith(("<", "#", "---", "!", "[")):
            continue
        return text[:120]
    return ""


def fallback_date(meta, filename):
    if meta.get("date"):
        return meta["date"]
    match = re.match(r"^(\d{4}-\d{2}-\d{2})", filename)
    if match:
        return match.group(1)
    return ""


def main():
    posts_dir = Path("docs/posts")
    output = Path(sys.argv[1] if len(sys.argv) > 1 else "_site/posts.json")

    posts = []
    if posts_dir.is_dir():
        for path in sorted(posts_dir.glob("*.md")):
            if path.name.startswith("_"):
                continue
            content = path.read_text(encoding="utf-8")
            meta, body = parse_front_matter(content)
            created = git_date(path, first=True) or fallback_date(meta, path.name)
            updated = git_date(path, first=False) or created
            posts.append(
                {
                    "file": f"posts/{path.name}",
                    "title": extract_title(meta, body, path.name),
                    "created": created,
                    "updated": updated,
                    "excerpt": extract_excerpt(meta, body),
                }
            )

    posts.sort(key=lambda p: (p["updated"], p["created"]), reverse=True)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(posts, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Generated {len(posts)} posts -> {output}")


if __name__ == "__main__":
    main()
