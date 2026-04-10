#!/usr/bin/env python3

from __future__ import annotations

import json
import math
import re
from collections import Counter, defaultdict
from pathlib import Path

import requests
from bs4 import BeautifulSoup


REPO_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = REPO_ROOT / "src" / "data" / "oldBlogCatalog.json"

BASE_URL = "https://www.cnblogs.com/HansBug"
SIDEBAR_URL = f"{BASE_URL}/ajax/sidebar-lists"
BLOG_STATS_URL = f"{BASE_URL}/ajax/blog-stats"
BLOG_NEWS_URL = f"{BASE_URL}/ajax/news"

ALGORITHM_CATEGORIES = {
    "APIO",
    "Bzoj",
    "NOI",
    "NOIP",
    "Poj",
    "Tyvj",
    "Wikioi/Codevs",
    "算法模板",
}
ENV_CATEGORIES = {"环境配置", "Latex"}
FRONTEND_CATEGORIES = {"前端设计", "Javascript", "Nodejs"}
PYTHON_OPEN_CATEGORIES = {"Python", "treevalue", "开源项目", "强化学习", "深度学习"}
COURSE_CATEGORIES = {"助教工作"}
ENGINEERING_CATEGORIES = {"开发向", "Java", "Ruby on Rails"}
RESEARCH_CATEGORIES = {"研究报告", "学习笔记"}

ALGORITHM_PATTERN = re.compile(
    r"(BZOJ|USACO|NOIP|NOI|APIO|POJ|TYVJ|Wikioi|Codevs|JSOI|洛谷|算法模板|最短路|凸包|网络流|Splay|Hash)",
    re.IGNORECASE,
)
ENV_PATTERN = re.compile(
    r"(Ubuntu|vagrant|gitlab|环境|部署|Idea|LaTeX|LATEX|npm|pip|扩容)",
    re.IGNORECASE,
)
FRONTEND_PATTERN = re.compile(
    r"(前端|Editor|vue|Vue|Javascript|JavaScript|Nodejs|NodeJS|wangEditor|ACE)",
    re.IGNORECASE,
)
PYTHON_OPEN_PATTERN = re.compile(
    r"(Python|treevalue|强化学习|深度学习|开源)",
    re.IGNORECASE,
)
COURSE_PATTERN = re.compile(
    r"(软工|软件工程|作业|评审|评分|结对|Alpha|Beta|助教)",
    re.IGNORECASE,
)
ENGINEERING_PATTERN = re.compile(
    r"(Debug|工程|Milestone|Issue|项目管理|接口|部署模式|Rails)",
    re.IGNORECASE,
)
RESEARCH_PATTERN = re.compile(
    r"(调研|测评|总结|报告|思考|分析|讲课|手稿)",
    re.IGNORECASE,
)


def build_session() -> requests.Session:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": (
                "Mozilla/5.0 (X11; Linux x86_64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/134.0.0.0 Safari/537.36"
            )
        }
    )
    return session


def fetch_html(session: requests.Session, url: str) -> str:
    response = session.get(url, timeout=20)
    response.raise_for_status()
    return response.text


def parse_count_links(side_soup: BeautifulSoup, selector: str) -> list[dict]:
    items: list[dict] = []
    for anchor in side_soup.select(selector):
        text = anchor.get_text(" ", strip=True)
        match = re.match(r"(.+?)\((\d+)\)$", text)
        if not match:
            continue
        items.append(
            {
                "name": match.group(1),
                "count": int(match.group(2)),
                "url": anchor["href"],
            }
        )
    return items


def parse_month_archives(side_soup: BeautifulSoup) -> list[dict]:
    archives: list[dict] = []
    for anchor in side_soup.select("#sidebar_postarchive a.category-item-link"):
        text = anchor.get_text(" ", strip=True)
        match = re.match(r"(\d{4})年(\d{1,2})月\((\d+)\)$", text)
        if not match:
            continue
        archives.append(
            {
                "month": f"{match.group(1)}-{int(match.group(2)):02d}",
                "count": int(match.group(3)),
                "url": anchor["href"],
            }
        )
    return archives


def parse_ranking_block(top_soup: BeautifulSoup, selector: str, metric_key: str) -> list[dict]:
    items: list[dict] = []
    for anchor in top_soup.select(f"{selector} li a"):
        text = " ".join(anchor.stripped_strings)
        match = re.match(r"^\d+\.\s*(.*)\((\d+)\)$", text)
        if not match:
            continue
        items.append(
            {
                "title": match.group(1).strip(),
                "url": anchor["href"],
                metric_key: int(match.group(2)),
            }
        )
    return items


def parse_blog_stats(session: requests.Session) -> dict:
    html = fetch_html(session, BLOG_STATS_URL)
    total_posts = int(re.search(r"随笔 -\s*(\d+)", html).group(1))
    total_comments = int(re.search(r"评论 -\s*(\d+)", html).group(1))
    total_views = int(re.search(r"总阅读数:\s*(\d+)", html).group(1))
    return {
        "totalPosts": total_posts,
        "totalComments": total_comments,
        "totalViews": total_views,
        "totalViewsText": f"{total_views:,}",
    }


def parse_profile(session: requests.Session) -> dict:
    html = fetch_html(session, BLOG_NEWS_URL)
    soup = BeautifulSoup(html, "lxml")
    motto = soup.select_one("#sidebar_news_content")
    profile = soup.select_one("#profile_block")
    profile_text = " ".join(profile.stripped_strings) if profile else ""
    followers = re.search(r"粉丝：\s*(\d+)", profile_text)
    following = re.search(r"关注：\s*(\d+)", profile_text)
    garden_age = re.search(r"园龄：\s*([0-9年月]+)", profile_text)
    return {
        "motto": " ".join(motto.stripped_strings) if motto else "",
        "followers": int(followers.group(1)) if followers else 0,
        "following": int(following.group(1)) if following else 0,
        "gardenAge": garden_age.group(1) if garden_age else "",
    }


def clean_summary(node: BeautifulSoup | None) -> str:
    if not node:
        return ""
    text = node.get_text(" ", strip=True)
    text = text.replace("阅读全文", "").replace("摘要：", "").strip()
    return re.sub(r"\s+", " ", text)


def parse_entry_item(item: BeautifulSoup) -> dict | None:
    title_anchor = item.select_one(".entrylistItemTitle")
    desc = item.select_one(".entrylistItemPostDesc")
    if not title_anchor or not desc:
        return None

    permalink = desc.select_one("a[title='permalink']")
    date_time = permalink.get_text(" ", strip=True) if permalink else ""

    view_span = desc.select_one(".post-view-count")
    comment_span = desc.select_one(".post-comment-count")

    def extract_counter(node: BeautifulSoup | None) -> int | None:
        if not node:
            return None
        match = re.search(r"(\d+)", node.get_text(" ", strip=True))
        return int(match.group(1)) if match else None

    return {
        "title": title_anchor.get_text(" ", strip=True),
        "url": title_anchor["href"],
        "dateTime": date_time,
        "views": extract_counter(view_span),
        "comments": extract_counter(comment_span),
        "summary": clean_summary(item.select_one(".c_b_p_desc")),
    }


def fill_post_stats(session: requests.Session, url: str) -> tuple[int, int]:
    html = fetch_html(session, url)
    soup = BeautifulSoup(html, "lxml")
    view = soup.select_one("#post_view_count")
    comment = soup.select_one("#post_comment_count")
    return (
        int(view.get_text(strip=True)) if view and view.get_text(strip=True).isdigit() else 0,
        int(comment.get_text(strip=True)) if comment and comment.get_text(strip=True).isdigit() else 0,
    )


def crawl_month_posts(session: requests.Session, archives: list[dict]) -> tuple[dict[str, dict], list[str]]:
    posts: dict[str, dict] = {}
    fallback_urls: list[str] = []

    for archive in archives:
        soup = BeautifulSoup(fetch_html(session, archive["url"]), "lxml")
        items = soup.select(".entrylistItem")
        if len(items) != archive["count"]:
            raise RuntimeError(
                f"Archive count mismatch for {archive['month']}: "
                f"expected {archive['count']}, got {len(items)}"
            )

        for item in items:
            parsed = parse_entry_item(item)
            if not parsed:
                continue

            if parsed["views"] is None or parsed["comments"] is None:
                parsed["views"], parsed["comments"] = fill_post_stats(session, parsed["url"])
                fallback_urls.append(parsed["url"])

            post_id = int(re.search(r"/p/(\d+)\.html", parsed["url"]).group(1))
            parsed["id"] = post_id
            parsed["date"] = parsed["dateTime"].split(" ")[0]
            parsed["year"] = int(parsed["dateTime"][:4])
            parsed["month"] = parsed["dateTime"][:7]
            parsed["categories"] = []
            posts[parsed["url"]] = parsed

    return posts, fallback_urls


def crawl_category_memberships(session: requests.Session, categories: list[dict]) -> dict[str, list[str]]:
    memberships: defaultdict[str, set[str]] = defaultdict(set)

    for category in categories:
        seen: set[str] = set()
        total_pages = max(1, math.ceil(category["count"] / 20))

        for page_num in range(1, total_pages + 1):
            url = category["url"] if page_num == 1 else f"{category['url']}?page={page_num}"
            soup = BeautifulSoup(fetch_html(session, url), "lxml")
            for anchor in soup.select(".entrylistItemTitle"):
                href = anchor.get("href")
                if not href:
                    continue
                seen.add(href)
                memberships[href].add(category["name"])

        if len(seen) != category["count"]:
            raise RuntimeError(
                f"Category count mismatch for {category['name']}: "
                f"expected {category['count']}, got {len(seen)}"
            )

    return {url: sorted(names) for url, names in memberships.items()}


def derive_track(title: str, categories: list[str]) -> str:
    category_set = set(categories)

    if category_set & ALGORITHM_CATEGORIES or ALGORITHM_PATTERN.search(title):
        return "算法 / OI"
    if category_set & ENV_CATEGORIES or ENV_PATTERN.search(title):
        return "环境 / 部署"
    if category_set & FRONTEND_CATEGORIES or FRONTEND_PATTERN.search(title):
        return "前端 / Web"
    if category_set & PYTHON_OPEN_CATEGORIES or PYTHON_OPEN_PATTERN.search(title):
        return "Python / 开源 / AI"
    if category_set & COURSE_CATEGORIES or COURSE_PATTERN.search(title):
        return "课程 / 软件工程"
    if category_set & ENGINEERING_CATEGORIES or ENGINEERING_PATTERN.search(title):
        return "工程 / 开发"
    if category_set & RESEARCH_CATEGORIES or RESEARCH_PATTERN.search(title):
        return "研究 / 总结"
    return "其他归档"


def build_yearly_trend(posts: list[dict]) -> list[dict]:
    counter = Counter(post["year"] for post in posts)
    return [
        {"year": year, "count": counter[year]}
        for year in sorted(counter.keys(), reverse=True)
    ]


def build_track_counts(posts: list[dict]) -> list[dict]:
    counter = Counter(post["track"] for post in posts)
    preferred_order = [
        "算法 / OI",
        "工程 / 开发",
        "课程 / 软件工程",
        "研究 / 总结",
        "环境 / 部署",
        "Python / 开源 / AI",
        "前端 / Web",
        "其他归档",
    ]
    return [
        {"name": name, "count": counter[name]}
        for name in preferred_order
        if counter[name]
    ]


def build_catalog() -> dict:
    session = build_session()

    sidebar_payload = session.get(SIDEBAR_URL, timeout=20).json()
    side_soup = BeautifulSoup(sidebar_payload["sideColumn"], "lxml")
    top_soup = BeautifulSoup(sidebar_payload["topLists"], "lxml")

    archives = parse_month_archives(side_soup)
    categories = parse_count_links(side_soup, "#sidebar_postcategory a.category-item-link")
    stats = parse_blog_stats(session)
    profile = parse_profile(session)

    posts_by_url, fallback_urls = crawl_month_posts(session, archives)
    category_memberships = crawl_category_memberships(session, categories)

    for url, post in posts_by_url.items():
        post["categories"] = category_memberships.get(url, [])
        post["track"] = derive_track(post["title"], post["categories"])

    posts = sorted(posts_by_url.values(), key=lambda item: item["dateTime"], reverse=True)
    top_viewed = sorted(posts, key=lambda item: (-item["views"], -item["comments"]))[:20]
    top_commented = sorted(posts, key=lambda item: (-item["comments"], -item["views"]))[:20]

    catalog = {
        "generatedAt": __import__("datetime").datetime.now().isoformat(timespec="seconds"),
        "profile": profile,
        "stats": stats,
        "archives": archives,
        "categories": sorted(categories, key=lambda item: (-item["count"], item["name"])),
        "yearlyTrend": build_yearly_trend(posts),
        "trackCounts": build_track_counts(posts),
        "topViewed": [
            {"title": item["title"], "url": item["url"], "views": item["views"]}
            for item in top_viewed
        ],
        "topCommented": [
            {"title": item["title"], "url": item["url"], "comments": item["comments"]}
            for item in top_commented
        ],
        "topLiked": parse_ranking_block(top_soup, "#TopDiggPostsBlock", "likes"),
        "posts": posts,
        "integrity": {
            "missingStatsFilledFromPostPage": len(fallback_urls),
            "postsWithoutExactCategory": sum(1 for item in posts if not item["categories"]),
        },
    }

    if catalog["stats"]["totalPosts"] != len(catalog["posts"]):
        raise RuntimeError(
            f"Total post count mismatch: stats={catalog['stats']['totalPosts']}, "
            f"crawled={len(catalog['posts'])}"
        )

    return catalog


def main() -> None:
    catalog = build_catalog()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {OUTPUT_PATH}")
    print(f"Posts: {len(catalog['posts'])}")
    print(f"Exact categories missing on {catalog['integrity']['postsWithoutExactCategory']} posts")


if __name__ == "__main__":
    main()
