#!/usr/bin/env python3
"""将 GitHub Discussions「博客」分类中 open 的讨论同步为 Hugo 文章。"""

from __future__ import annotations

import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PREPARED_POSTS = ROOT / ".hugo-prepared" / "content" / "posts"
GRAPHQL_URL = "https://api.github.com/graphql"
DEFAULT_CATEGORY = "博客"
POST_FILE_PATTERN = re.compile(r"^d-\d+\.md$")


def repo_parts() -> tuple[str, str]:
    repo = os.environ.get("GITHUB_REPOSITORY", "trianglestrip/trianglestrip.github.io")
    owner, name = repo.split("/", 1)
    return owner, name


def graphql(token: str, query: str, variables: dict | None = None) -> dict:
    payload = {"query": query}
    if variables:
        payload["variables"] = variables
    request = urllib.request.Request(
        GRAPHQL_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "trianglestrip-blog-sync",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        body = json.loads(response.read().decode("utf-8"))
    if body.get("errors"):
        raise RuntimeError(json.dumps(body["errors"], ensure_ascii=False))
    return body["data"]


def get_category_id(token: str, owner: str, name: str, category_name: str) -> str:
    query = """
    query($owner: String!, $name: String!) {
      repository(owner: $owner, name: $name) {
        discussionCategories(first: 30) {
          nodes { id name }
        }
      }
    }
    """
    data = graphql(token, query, {"owner": owner, "name": name})
    categories = data["repository"]["discussionCategories"]["nodes"]
    for item in categories:
        if item["name"] == category_name:
            return item["id"]
    available = ", ".join(node["name"] for node in categories)
    raise RuntimeError(f"未找到分类「{category_name}」，现有分类: {available}")


def fetch_discussions(token: str, owner: str, name: str, category_id: str) -> list[dict]:
    query = """
    query($owner: String!, $name: String!, $categoryId: ID!, $cursor: String) {
      repository(owner: $owner, name: $name) {
        discussions(
          first: 50
          after: $cursor
          categoryId: $categoryId
          orderBy: {field: CREATED_AT, direction: DESC}
        ) {
          pageInfo { hasNextPage endCursor }
          nodes {
            number
            title
            body
            createdAt
            closed
            labels(first: 20) { nodes { name } }
          }
        }
      }
    }
    """
    discussions: list[dict] = []
    cursor: str | None = None
    while True:
        data = graphql(
            token,
            query,
            {"owner": owner, "name": name, "categoryId": category_id, "cursor": cursor},
        )
        connection = data["repository"]["discussions"]
        discussions.extend(connection["nodes"])
        page_info = connection["pageInfo"]
        if not page_info["hasNextPage"]:
            break
        cursor = page_info["endCursor"]
    return discussions


def yaml_string(value: str) -> str:
    escaped = value.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'


def build_front_matter(title: str, post_date: str, tags: list[str], discussion_id: int) -> str:
    lines = ["---", f"title: {yaml_string(title)}", f"date: {post_date}"]
    if tags:
        lines.append("tags:")
        for tag in tags:
            lines.append(f"  - {yaml_string(tag)}")
    lines.append(f"discussion_id: {discussion_id}")
    lines.append("---")
    lines.append("")
    return "\n".join(lines)


def cleanup_generated_posts() -> None:
    if not PREPARED_POSTS.is_dir():
        PREPARED_POSTS.mkdir(parents=True, exist_ok=True)
        return
    for path in PREPARED_POSTS.iterdir():
        if path.is_file() and POST_FILE_PATTERN.match(path.name):
            path.unlink()


def sync_discussions(category_name: str) -> int:
    token = os.environ.get("GITHUB_TOKEN", "").strip()
    if not token:
        print("skip: GITHUB_TOKEN 未设置，跳过 Discussions 同步", file=sys.stderr)
        return 0

    owner, name = repo_parts()
    category_id = get_category_id(token, owner, name, category_name)
    discussions = fetch_discussions(token, owner, name, category_id)

    cleanup_generated_posts()

    synced = 0
    for item in discussions:
        if item.get("closed"):
            continue
        number = item["number"]
        title = (item.get("title") or f"discussion-{number}").strip()
        body = (item.get("body") or "").strip()
        post_date = item.get("createdAt") or ""
        tags = [node["name"] for node in item.get("labels", {}).get("nodes", [])]
        filename = PREPARED_POSTS / f"d-{number}.md"
        filename.write_text(
            build_front_matter(title, post_date, tags, number) + body + ("\n" if body else ""),
            encoding="utf-8",
        )
        print(f"synced: discussion #{number} -> {filename.relative_to(ROOT)} (title={title})")
        synced += 1

    print(f"synced {synced} open discussions from category「{category_name}」")
    return 0


def main() -> int:
    category_name = os.environ.get("DISCUSSIONS_CATEGORY", DEFAULT_CATEGORY)
    try:
        return sync_discussions(category_name)
    except urllib.error.HTTPError as exc:
        print(f"sync failed: HTTP {exc.code} {exc.reason}", file=sys.stderr)
        return 1
    except Exception as exc:  # noqa: BLE001
        print(f"sync failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
