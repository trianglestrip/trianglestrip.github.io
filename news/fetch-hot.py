#!/usr/bin/env python3
"""在 GitHub Actions 中直接抓取各平台热榜，写入 news/data/{platform}.json。"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

import feedparser
from bs4 import BeautifulSoup

NEWS_ROOT = Path(__file__).resolve().parent
DATA_DIR = NEWS_ROOT / "data"
META_FILE = DATA_DIR / "meta.json"
SOURCES_FILE = NEWS_ROOT / "hot-sources.json"
FETCH_TIMEOUT = 60
HTTP_TIMEOUT = 30
MAX_RETRIES = 3
USER_AGENT = "Mozilla/5.0 (compatible; blog-hot-fetch/1.0)"


def load_sources() -> dict:
    with SOURCES_FILE.open(encoding="utf-8") as fh:
        return json.load(fh)


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def parse_time(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def should_fetch(cache: dict, ttl_minutes: int, force: bool) -> bool:
    if force:
        return True
    updated_at = parse_time(cache.get("updated_at"))
    if updated_at is None:
        return True
    return datetime.now(updated_at.tzinfo) - updated_at >= timedelta(minutes=ttl_minutes)


def load_cache(platform: str) -> dict:
    path = DATA_DIR / f"{platform}.json"
    if not path.exists():
        return {"source": platform, "items": []}
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


def short_error(message: str, limit: int = 200) -> str:
    text = " ".join(str(message).split())
    if len(text) <= limit:
        return text
    return text[: limit - 3] + "..."


def http_get_json(url: str, headers: dict[str, str] | None = None) -> object:
    merged = {"User-Agent": USER_AGENT}
    if headers:
        merged.update(headers)
    request = urllib.request.Request(url, headers=merged)
    with urllib.request.urlopen(request, timeout=HTTP_TIMEOUT) as response:
        return json.loads(response.read().decode("utf-8"))


def http_get_text(url: str, headers: dict[str, str] | None = None) -> str:
    merged = {"User-Agent": USER_AGENT}
    if headers:
        merged.update(headers)
    request = urllib.request.Request(url, headers=merged)
    with urllib.request.urlopen(request, timeout=HTTP_TIMEOUT) as response:
        return response.read().decode("utf-8", errors="replace")


def fetch_v2ex_api(limit: int) -> list[dict]:
    data = http_get_json("https://www.v2ex.com/api/topics/hot.json")
    if not isinstance(data, list):
        raise RuntimeError("invalid v2ex response")

    items: list[dict] = []
    for topic in data[:limit]:
        title = str(topic.get("title", "")).strip()
        url = str(topic.get("url", "")).strip()
        if not title or not url:
            continue
        items.append(
            {
                "title": title,
                "url": url,
                "hot": str(topic.get("replies", "")),
            }
        )
    return items


def fetch_yystv_api(limit: int) -> list[dict]:
    text = http_get_text(
        "https://www.yystv.cn/home/get_home_docs_by_page",
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36"
            )
        },
    )
    data = json.loads(text)
    article_list = data.get("data", []) if isinstance(data, dict) else []
    items: list[dict] = []
    for item in article_list[:limit]:
        item_id = str(item.get("id", "")).strip()
        title = str(item.get("title", "")).strip()
        if not item_id or not title:
            continue
        items.append(
            {
                "title": title,
                "url": f"https://www.yystv.cn/p/{item_id}",
                "hot": str(item.get("author", "") or ""),
            }
        )
    return items


def fetch_jianshu_trending(limit: int) -> list[dict]:
    text = http_get_text(
        "https://www.jianshu.com/asimov/trending/now",
        headers={"Referer": "https://www.jianshu.com"},
    )
    data = json.loads(text)
    if not isinstance(data, list):
        raise RuntimeError("invalid jianshu trending response")

    items: list[dict] = []
    for entry in data:
        obj = entry.get("object") if isinstance(entry, dict) else None
        if not isinstance(obj, dict) or obj.get("type") != 1:
            continue
        note = obj.get("data")
        if not isinstance(note, dict):
            continue
        title = str(note.get("title", "")).strip()
        slug = str(note.get("slug", "")).strip()
        if not title or not slug:
            continue
        hot = note.get("total_fp_amount")
        if hot is None:
            hot = note.get("likes_count", "")
        items.append(
            {
                "title": title,
                "url": f"https://www.jianshu.com/p/{slug}",
                "hot": str(hot),
            }
        )
        if len(items) >= limit:
            break
    return items


def fetch_douban_group(limit: int) -> list[dict]:
    html = http_get_text("https://www.douban.com/group/explore")
    soup = BeautifulSoup(html, "html.parser")
    items: list[dict] = []
    for block in soup.select(".article .channel-item"):
        link = block.select_one("h3 a")
        if not link:
            continue
        title = link.get_text(strip=True)
        href = str(link.get("href") or "").strip()
        if not title or not href:
            continue
        hot_elem = block.select_one(".likes")
        hot = hot_elem.get_text(strip=True) if hot_elem else ""
        items.append({"title": title, "url": href, "hot": hot})
        if len(items) >= limit:
            break
    return items


def fetch_nodeseek_rss(limit: int) -> list[dict]:
    text = http_get_text("https://rss.nodeseek.com/")
    feed = feedparser.parse(text)
    items: list[dict] = []
    for entry in feed.entries[:limit]:
        title = str(entry.get("title", "")).strip()
        url = str(entry.get("link", "")).strip()
        if not title or not url:
            continue
        items.append({"title": title, "url": url, "hot": ""})
    return items


def fetch_hf_trending(repo_type: str, limit: int) -> list[dict]:
    data = http_get_json(f"https://huggingface.co/api/trending?type={repo_type}&limit={limit}")
    if not isinstance(data, dict):
        raise RuntimeError("invalid huggingface trending response")

    items: list[dict] = []
    for entry in data.get("recentlyTrending") or []:
        if not isinstance(entry, dict):
            continue
        repo = entry.get("repoData")
        if not isinstance(repo, dict):
            continue
        repo_id = str(repo.get("id", "")).strip()
        if not repo_id:
            continue
        items.append(
            {
                "title": repo_id,
                "url": f"https://huggingface.co/{repo_id}",
                "hot": str(repo.get("likes", "")),
            }
        )
        if len(items) >= limit:
            break
    return items


def fetch_hf_trending_models(limit: int) -> list[dict]:
    return fetch_hf_trending("model", limit)


def fetch_hf_daily_papers(limit: int) -> list[dict]:
    data = http_get_json(
        "https://huggingface.co/api/daily_papers?limit=50&sort=trending&p=0"
    )
    papers_raw = data if isinstance(data, list) else data.get("papers") or data.get("results") or []
    if not isinstance(papers_raw, list):
        raise RuntimeError("invalid huggingface papers response")

    items: list[dict] = []
    for entry in papers_raw:
        if not isinstance(entry, dict):
            continue
        paper = entry.get("paper")
        if not isinstance(paper, dict):
            paper = entry
        title = str(paper.get("title", "")).strip()
        paper_id = str(paper.get("id") or paper.get("arxivId") or "").strip()
        if not title or not paper_id:
            continue
        items.append(
            {
                "title": title,
                "url": f"https://huggingface.co/papers/{paper_id}",
                "hot": str(paper.get("upvotes") or entry.get("numComments") or ""),
            }
        )
        if len(items) >= limit:
            break
    return items


def fetch_rss(url: str, limit: int) -> list[dict]:
    text = http_get_text(url)
    feed = feedparser.parse(text)
    items: list[dict] = []
    for entry in feed.entries[:limit]:
        title = str(entry.get("title", "")).strip()
        link = str(entry.get("link", "")).strip()
        if not title or not link:
            continue
        hot = entry.get("published") or entry.get("updated") or ""
        items.append({"title": title, "url": link, "hot": str(hot)})
    return items


def fetch_douban_movie(limit: int) -> list[dict]:
    data = http_get_json(
        "https://movie.douban.com/j/new_search_subjects?"
        "sort=U&range=0,10&tags=&start=0&genres=&countries=&year_range=2024,2026"
    )
    if not isinstance(data, dict):
        raise RuntimeError("invalid douban movie response")

    items: list[dict] = []
    for movie in data.get("data") or []:
        if not isinstance(movie, dict):
            continue
        title = str(movie.get("title", "")).strip()
        url = str(movie.get("url", "")).strip()
        if not title or not url:
            continue
        rate = str(movie.get("rate", "")).strip()
        hot = f"评分 {rate}" if rate else ""
        items.append({"title": title, "url": url, "hot": hot})
        if len(items) >= limit:
            break
    return items


def fetch_wallstreetcn(limit: int) -> list[dict]:
    data = http_get_json(
        "https://api-one.wallstcn.com/apiv1/content/information-flow?"
        "channel=global-channel&accept=article&limit=20"
    )
    if not isinstance(data, dict):
        raise RuntimeError("invalid wallstreetcn response")

    items: list[dict] = []
    for entry in data.get("data", {}).get("items") or []:
        if not isinstance(entry, dict):
            continue
        resource = entry.get("resource")
        if not isinstance(resource, dict):
            continue
        title = str(resource.get("title", "")).strip()
        uri = str(resource.get("uri") or resource.get("url") or "").strip()
        if not title or not uri:
            continue
        if uri.startswith("/"):
            uri = f"https://wallstreetcn.com{uri}"
        items.append({"title": title, "url": uri, "hot": ""})
        if len(items) >= limit:
            break
    return items


def fetch_3dm_news(limit: int) -> list[dict]:
    html = http_get_text("https://www.3dmgame.com/news/")
    soup = BeautifulSoup(html, "html.parser")
    items: list[dict] = []
    seen: set[str] = set()
    for link in soup.select("a[href]"):
        href = str(link.get("href") or "").strip()
        if "/news/" not in href or href in seen:
            continue
        title = link.get_text(strip=True)
        if not title or len(title) < 6:
            continue
        if not href.startswith("http"):
            href = f"https://www.3dmgame.com{href}"
        seen.add(href)
        items.append({"title": title, "url": href, "hot": ""})
        if len(items) >= limit:
            break
    return items


def fetch_taptap(limit: int) -> list[dict]:
    html = http_get_text(
        "https://www.taptap.cn/top/download",
        headers={"Referer": "https://www.taptap.cn/"},
    )
    soup = BeautifulSoup(html, "html.parser")
    items: list[dict] = []
    seen: set[str] = set()
    for link in soup.select('a[href*="/app/"]'):
        href = str(link.get("href") or "").strip()
        title = link.get_text(strip=True)
        if not title or href in seen:
            continue
        if not href.startswith("http"):
            href = f"https://www.taptap.cn{href}"
        seen.add(href)
        items.append({"title": title, "url": href, "hot": ""})
        if len(items) >= limit:
            break
    return items


def fetch_coolapk(limit: int) -> list[dict]:
    headers = {
        "User-Agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36",
        "X-App-Id": "com.coolapk.market",
        "X-Requested-With": "XMLHttpRequest",
    }
    try:
        data = http_get_json(
            "https://api.coolapk.com/v6/feed/draw?type=12&page=1",
            headers=headers,
        )
    except (urllib.error.URLError, json.JSONDecodeError, RuntimeError, ValueError):
        data = None

    items: list[dict] = []
    if isinstance(data, dict):
        for entry in data.get("data") or []:
            if not isinstance(entry, dict):
                continue
            title = str(entry.get("message_title") or entry.get("message", "")).strip()
            url = str(entry.get("url") or entry.get("shareUrl") or "").strip()
            if not title or not url:
                continue
            items.append({"title": title, "url": url, "hot": str(entry.get("replynum", ""))})
            if len(items) >= limit:
                return items

    html = http_get_text("https://www.coolapk.com/", headers=headers)
    soup = BeautifulSoup(html, "html.parser")
    seen: set[str] = set()
    for link in soup.select('a[href*="/feed/"]'):
        href = str(link.get("href") or "").strip()
        title = link.get_text(strip=True)
        if not title or len(title) < 4 or href in seen:
            continue
        if not href.startswith("http"):
            href = f"https://www.coolapk.com{href}"
        seen.add(href)
        items.append({"title": title, "url": href, "hot": ""})
        if len(items) >= limit:
            break
    return items


def fetch_xueqiu(limit: int) -> list[dict]:
    opener = urllib.request.build_opener()
    opener.addheaders = [("User-Agent", USER_AGENT)]
    opener.open("https://xueqiu.com/", timeout=HTTP_TIMEOUT)
    request = urllib.request.Request(
        "https://xueqiu.com/statuses/hot/listV2.json?since_id=-1&max_id=-1&size=20",
        headers={"User-Agent": USER_AGENT, "Referer": "https://xueqiu.com/"},
    )
    with opener.open(request, timeout=HTTP_TIMEOUT) as response:
        data = json.loads(response.read().decode("utf-8"))

    if not isinstance(data, dict):
        raise RuntimeError("invalid xueqiu response")

    items: list[dict] = []
    for entry in data.get("items") or []:
        if not isinstance(entry, dict):
            continue
        title = str(entry.get("title") or entry.get("description") or "").strip()
        target = entry.get("target")
        url = ""
        if isinstance(target, dict):
            url = str(target.get("url") or "").strip()
        if not url:
            url = str(entry.get("target_url") or entry.get("url") or "").strip()
        if not title or not url:
            continue
        items.append({"title": title, "url": url, "hot": str(entry.get("view_count", ""))})
        if len(items) >= limit:
            break
    return items


def fetch_hackernews_api(limit: int) -> list[dict]:
    ids = http_get_json("https://hacker-news.firebaseio.com/v0/topstories.json")
    if not isinstance(ids, list):
        raise RuntimeError("invalid hackernews response")

    items: list[dict] = []
    for story_id in ids:
        if len(items) >= limit:
            break
        story = http_get_json(f"https://hacker-news.firebaseio.com/v0/item/{story_id}.json")
        if not isinstance(story, dict) or story.get("type") != "story":
            continue
        title = str(story.get("title", "")).strip()
        if not title:
            continue
        url = str(story.get("url") or f"https://news.ycombinator.com/item?id={story_id}").strip()
        items.append({"title": title, "url": url, "hot": str(story.get("score", ""))})
    return items


CUSTOM_DRIVERS = {
    "v2ex_api": fetch_v2ex_api,
    "yystv_api": fetch_yystv_api,
    "jianshu_trending": fetch_jianshu_trending,
    "douban_group": fetch_douban_group,
    "douban_movie": fetch_douban_movie,
    "nodeseek_rss": fetch_nodeseek_rss,
    "hackernews_api": fetch_hackernews_api,
    "hf_trending_models": fetch_hf_trending_models,
    "hf_daily_papers": fetch_hf_daily_papers,
    "wallstreetcn": fetch_wallstreetcn,
    "3dm_news": fetch_3dm_news,
    "taptap": fetch_taptap,
    "coolapk": fetch_coolapk,
    "xueqiu": fetch_xueqiu,
}


def normalize_items(raw_items: list, limit: int) -> list[dict]:
    items: list[dict] = []
    for index, item in enumerate(raw_items[:limit], start=1):
        title = str(item.get("title", "")).strip()
        url = str(item.get("url") or item.get("mobile_url") or "").strip()
        if not title or not url:
            continue
        hot = item.get("hot")
        if hot is None:
            hot = item.get("desc") or ""
        items.append(
            {
                "rank": index,
                "title": title,
                "url": url,
                "hot": str(hot).strip() if hot is not None else "",
            }
        )
    return items


def hotboard_env() -> dict:
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUTF8"] = "1"
    return env


def run_hotboard(fetcher: str, extra_args: list[str] | None = None) -> dict:
    command = ["hotboard", fetcher]
    if extra_args:
        command.extend(extra_args)
    command.extend(["--format", "json"])
    result = subprocess.run(
        command,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=FETCH_TIMEOUT,
        check=False,
        env=hotboard_env(),
    )
    if result.returncode != 0:
        stderr = result.stderr.strip()
        stdout = result.stdout.strip()
        detail = stderr or stdout or f"exit code {result.returncode}"
        raise RuntimeError(detail)

    text = result.stdout.strip()
    if not text:
        raise RuntimeError("empty hotboard output")

    # hotboard 在 JSON 后还会输出日志，只解析第一段 JSON
    payload, _ = json.JSONDecoder().raw_decode(text)
    if not isinstance(payload.get("items"), list):
        raise RuntimeError("invalid hotboard response")
    return payload


def fetch_platform(platform: str, meta: dict) -> dict:
    cache = load_cache(platform)
    title = meta.get("title", platform)
    limit = int(meta.get("limit", 10))
    min_items = int(meta.get("min_items", 3))
    fetcher = meta.get("fetcher", platform)
    driver = meta.get("driver")

    last_error = "unknown error"
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            if driver == "rss":
                rss_url = meta.get("rss_url")
                if not rss_url:
                    raise RuntimeError("rss_url required for rss driver")
                raw_items = fetch_rss(rss_url, limit)
            elif driver:
                driver_fn = CUSTOM_DRIVERS.get(driver)
                if driver_fn is None:
                    raise RuntimeError(f"unknown driver: {driver}")
                raw_items = driver_fn(limit)
            else:
                hotboard_args = meta.get("hotboard_args") or []
                payload = run_hotboard(fetcher, hotboard_args)
                raw_items = payload.get("items") or []

            items = normalize_items(raw_items, limit)
            if len(items) < min_items:
                raise RuntimeError(f"too few items: {len(items)}")

            return {
                "source": platform,
                "title": title,
                "updated_at": now_iso(),
                "fetch_ok": True,
                "items": items,
            }
        except (
            RuntimeError,
            subprocess.TimeoutExpired,
            json.JSONDecodeError,
            OSError,
            urllib.error.URLError,
            TimeoutError,
            ValueError,
        ) as exc:
            last_error = short_error(exc)
            if attempt < MAX_RETRIES:
                continue

    return {
        "source": platform,
        "title": title,
        "updated_at": now_iso(),
        "fetch_ok": False,
        "error": last_error,
        "items": cache.get("items") or [],
    }


def write_run_meta(*, changed: int, fetched: int, skipped: int) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    meta = {
        "last_run_at": now_iso(),
        "changed": changed,
        "fetched": fetched,
        "skipped": skipped,
    }
    META_FILE.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_cache(platform: str, data: dict) -> bool:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    path = DATA_DIR / f"{platform}.json"
    serialized = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    old = path.read_text(encoding="utf-8") if path.exists() else ""
    if serialized == old:
        return False
    path.write_text(serialized, encoding="utf-8")
    return True


def run(platform: str | None, force: bool) -> int:
    sources = load_sources()
    platforms: dict[str, dict] = sources["platforms"]

    if platform:
        if platform not in platforms:
            print(f"unknown platform: {platform}", file=sys.stderr)
            return 1
        targets = {platform: platforms[platform]}
    else:
        targets = platforms

    changed = 0
    fetched = 0
    skipped = 0
    for name, meta in targets.items():
        cache = load_cache(name)
        ttl_minutes = int(meta.get("ttl_minutes", 30))
        if not should_fetch(cache, ttl_minutes, force):
            print(f"skip {name}: cache still fresh")
            skipped += 1
            continue

        driver = meta.get("driver")
        fetcher = meta.get("fetcher", name)
        if driver:
            print(f"fetch {name} via driver {driver}")
        else:
            hotboard_args = meta.get("hotboard_args") or []
            args_text = " ".join(hotboard_args) if hotboard_args else ""
            print(f"fetch {name} via hotboard {fetcher} {args_text}".rstrip())
        fetched += 1
        data = fetch_platform(name, meta)
        if write_cache(name, data):
            changed += 1
            status = "ok" if data.get("fetch_ok") else "failed (cache kept)"
            print(f"updated {name}: {status}")
        else:
            print(f"unchanged {name}")

    write_run_meta(changed=changed, fetched=fetched, skipped=skipped)

    build_script = NEWS_ROOT / "build-hot-html.py"
    if build_script.exists():
        subprocess.run([sys.executable, str(build_script)], check=False)

    print(f"done, changed={changed}")
    return 0


def main() -> int:
    args = sys.argv[1:]
    force = "--force" in args
    args = [arg for arg in args if arg != "--force"]

    platform = args[0] if args else None
    if platform == "--due-only":
        platform = None

    return run(platform, force)


if __name__ == "__main__":
    raise SystemExit(main())
