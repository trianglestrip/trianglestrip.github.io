#!/usr/bin/env python3
"""复制 content 并在临时目录为 posts/*.md 自动生成 front matter。"""

from __future__ import annotations

import re
import shutil
import subprocess
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE_CONTENT = ROOT / "content"
PREPARED_CONTENT = ROOT / ".hugo-prepared" / "content"
FRONT_MATTER_RE = re.compile(r"^---\s*\r?\n.*?\r?\n---\s*\r?\n?", re.DOTALL)


def git_date(path: Path) -> str:
    try:
        result = subprocess.run(
            ["git", "log", "-1", "--format=%as", "--", str(path)],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=True,
        )
        value = result.stdout.strip()
        if value:
            return value
    except (subprocess.CalledProcessError, FileNotFoundError):
        pass
    return date.today().isoformat()


def extract_body(content: str) -> str:
    match = FRONT_MATTER_RE.match(content)
    if match:
        return content[match.end() :]
    return content


def build_front_matter(title: str, post_date: str) -> str:
    escaped = title.replace("\\", "\\\\").replace('"', '\\"')
    return f'---\ntitle: "{escaped}"\ndate: {post_date}\n---\n\n'


def prepare_post(source_path: Path, target_path: Path) -> None:
    raw = source_path.read_text(encoding="utf-8-sig")
    body = extract_body(raw).lstrip("\n")
    title = source_path.stem
    post_date = git_date(source_path)
    target_path.parent.mkdir(parents=True, exist_ok=True)
    target_path.write_text(build_front_matter(title, post_date) + body, encoding="utf-8")
    print(
        f"prepared: {source_path.relative_to(ROOT)} "
        f"-> {target_path.relative_to(ROOT)} (title={title}, date={post_date})"
    )


def main() -> int:
    if not SOURCE_CONTENT.is_dir():
        print(f"content directory not found: {SOURCE_CONTENT}", file=sys.stderr)
        return 1

    if PREPARED_CONTENT.exists():
        shutil.rmtree(PREPARED_CONTENT)
    shutil.copytree(SOURCE_CONTENT, PREPARED_CONTENT)

    posts_dir = SOURCE_CONTENT / "posts"
    if not posts_dir.is_dir():
        print("no posts directory, content copied only")
        return 0

    for source_path in sorted(posts_dir.glob("*.md")):
        if source_path.name.startswith("."):
            continue
        target_path = PREPARED_CONTENT / "posts" / source_path.name
        prepare_post(source_path, target_path)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
