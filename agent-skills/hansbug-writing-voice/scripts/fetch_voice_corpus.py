#!/usr/bin/env python3
"""按 HansBug 文风样本 manifest 抓取旧博客正文，只写入本地 ignored cache。"""

from __future__ import annotations

import argparse
import contextlib
import http.client
import json
import re
import signal
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Iterable

SCRIPT_ROOT = Path(__file__).resolve().parent
SKILL_ROOT = SCRIPT_ROOT.parent
REPO_ROOT = SKILL_ROOT.parents[1]
DEFAULT_MANIFEST = SKILL_ROOT / "references" / "sample-manifest.json"
DEFAULT_CACHE_DIR = REPO_ROOT / ".cache" / "hansbug-writing-voice" / "corpus"
DEFAULT_USER_AGENT = "HansBugTechBlogVoiceSkill/1.0 (+https://hansbug.github.io; respectful cache-only corpus builder)"
VOID_TAGS = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}

REQUIRED_SOURCE_FIELDS = {
    "id",
    "title",
    "url",
    "year",
    "articleType",
    "sampleRole",
    "useFor",
    "participatesInProfile",
    "holdoutForDryRun",
    "cacheKey",
    "sourceSelector",
    "notes",
}


class CorpusError(RuntimeError):
    """语料抓取中的可解释错误。"""


class NonRetryableCorpusError(CorpusError):
    """不应进入重试循环的抓取错误，例如 HTTP 4xx/5xx 状态码或确定性正文解析失败。"""


@dataclass(frozen=True)
class SourceItem:
    id: str
    title: str
    url: str
    sample_role: str
    cache_key: str
    source_selector: str


class SelectedTextParser(HTMLParser):
    """只为 cnblogs 正文提取设计的轻量 HTML 文本抽取器。"""

    def __init__(self, selector: str):
        super().__init__(convert_charrefs=True)
        self.selector = selector.strip()
        self.target = parse_simple_selector(self.selector)
        self.capture_depth = 0
        self.skip_depth = 0
        self.parts: list[str] = []
        self.matched = False
        self.heading_depth: int | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        attr_map = {name.lower(): value or "" for name, value in attrs}

        if self.skip_depth:
            if tag in {"script", "style", "noscript"}:
                self.skip_depth += 1
            return
        if tag in {"script", "style", "noscript"}:
            self.skip_depth = 1
            return

        if self.capture_depth:
            if tag not in VOID_TAGS:
                self.capture_depth += 1
            if tag in {"p", "div", "section", "article", "blockquote", "ul", "ol", "li", "pre", "table", "tr"}:
                self.parts.append("\n")
            if re.fullmatch(r"h[1-6]", tag):
                self.heading_depth = int(tag[1])
                self.parts.append("\n" + "#" * self.heading_depth + " ")
            if tag == "br":
                self.parts.append("\n")
            return

        if selector_matches(tag, attr_map, self.target):
            self.matched = True
            self.capture_depth = 1
            if re.fullmatch(r"h[1-6]", tag):
                self.heading_depth = int(tag[1])
                self.parts.append("#" * self.heading_depth + " ")

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if self.skip_depth:
            if tag in {"script", "style", "noscript"}:
                self.skip_depth -= 1
            return
        if not self.capture_depth:
            return
        if self.heading_depth is not None and tag == f"h{self.heading_depth}":
            self.parts.append("\n")
            self.heading_depth = None
        if tag in {"p", "div", "section", "article", "blockquote", "ul", "ol", "li", "pre", "table", "tr"}:
            self.parts.append("\n")
        self.capture_depth -= 1

    def handle_data(self, data: str) -> None:
        if self.capture_depth and not self.skip_depth:
            self.parts.append(data)

    def text(self) -> str:
        text = "".join(self.parts)
        text = text.replace("\xa0", " ").replace("\u3000", " ")
        lines = [re.sub(r"[ \t]+", " ", line).strip() for line in text.splitlines()]
        compact: list[str] = []
        previous_blank = False
        for line in lines:
            if not line:
                if not previous_blank:
                    compact.append("")
                previous_blank = True
                continue
            compact.append(line)
            previous_blank = False
        return "\n".join(compact).strip()


def parse_simple_selector(selector: str) -> tuple[str, str]:
    if not selector:
        raise CorpusError("sourceSelector 不能为空")
    if " " in selector or ">" in selector or "," in selector:
        raise CorpusError(
            f"暂只支持简单 selector（#id、.class 或 tag），当前 sourceSelector={selector!r} 过于复杂"
        )
    if selector.startswith("#") and len(selector) > 1:
        return ("id", selector[1:])
    if selector.startswith(".") and len(selector) > 1:
        return ("class", selector[1:])
    if re.fullmatch(r"[A-Za-z][A-Za-z0-9_-]*", selector):
        return ("tag", selector.lower())
    raise CorpusError(f"暂不支持的 sourceSelector={selector!r}；请使用 #id、.class 或 tag")


def selector_matches(tag: str, attrs: dict[str, str], target: tuple[str, str]) -> bool:
    kind, value = target
    if kind == "tag":
        return tag == value
    if kind == "id":
        return attrs.get("id") == value
    if kind == "class":
        return value in attrs.get("class", "").split()
    return False


def validate_cache_key(cache_key: str) -> None:
    if not re.fullmatch(r"[A-Za-z0-9._-]+", cache_key):
        raise CorpusError(f"cacheKey 只能包含字母、数字、点、下划线和短横线：{cache_key!r}")


def repo_relative(path: Path) -> str:
    try:
        return str(path.resolve().relative_to(REPO_ROOT))
    except ValueError:
        return str(path)


def load_manifest(path: Path) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise CorpusError(f"manifest 不存在：{repo_relative(path)}") from exc
    except json.JSONDecodeError as exc:
        raise CorpusError(f"manifest 不是合法 JSON：{repo_relative(path)}: {exc.msg}") from exc
    if not isinstance(data, dict):
        raise CorpusError("manifest 顶层必须是 JSON object")
    if not isinstance(data.get("sources"), list):
        raise CorpusError("manifest.sources 必须是 JSON array")
    return data


def validate_source(raw: Any, index: int) -> SourceItem:
    if not isinstance(raw, dict):
        raise CorpusError(f"manifest.sources[{index}] 必须是 JSON object")
    missing = sorted(field for field in REQUIRED_SOURCE_FIELDS if field not in raw)
    if missing:
        raise CorpusError(f"manifest.sources[{index}] 缺少字段：{', '.join(missing)}")
    for field in ["id", "title", "url", "sampleRole", "cacheKey", "sourceSelector", "notes"]:
        if not isinstance(raw.get(field), str) or not raw[field].strip():
            raise CorpusError(f"manifest.sources[{index}].{field} 必须是非空字符串")
    if not isinstance(raw.get("year"), int):
        raise CorpusError(f"manifest.sources[{index}].year 必须是整数")
    if not isinstance(raw.get("useFor"), list) or not raw["useFor"]:
        raise CorpusError(f"manifest.sources[{index}].useFor 必须是非空数组")
    if not isinstance(raw.get("participatesInProfile"), bool):
        raise CorpusError(f"manifest.sources[{index}].participatesInProfile 必须是布尔值")
    if not isinstance(raw.get("holdoutForDryRun"), bool):
        raise CorpusError(f"manifest.sources[{index}].holdoutForDryRun 必须是布尔值")
    parse_simple_selector(raw["sourceSelector"])
    validate_cache_key(raw["cacheKey"])
    return SourceItem(
        id=raw["id"].strip(),
        title=raw["title"].strip(),
        url=raw["url"].strip(),
        sample_role=raw["sampleRole"].strip(),
        cache_key=raw["cacheKey"].strip(),
        source_selector=raw["sourceSelector"].strip(),
    )


def iter_sources(manifest: dict[str, Any]) -> Iterable[SourceItem]:
    for index, raw in enumerate(manifest["sources"]):
        yield validate_source(raw, index)


def split_filters(values: list[str] | None) -> set[str]:
    result: set[str] = set()
    for value in values or []:
        result.update(part.strip() for part in value.split(",") if part.strip())
    return result


def filter_sources(sources: Iterable[SourceItem], ids: set[str], roles: set[str], limit: int | None) -> list[SourceItem]:
    selected = []
    for source in sources:
        if ids and source.id not in ids:
            continue
        if roles and source.sample_role not in roles:
            continue
        selected.append(source)
        if limit is not None and len(selected) >= limit:
            break
    return selected



@contextlib.contextmanager
def source_deadline(source: SourceItem, seconds: float):
    """为单篇样本设置整体 deadline，避免远端持续断流/慢流导致全量抓取卡死。"""

    if seconds <= 0 or not hasattr(signal, "SIGALRM"):
        yield
        return

    previous_handler = signal.getsignal(signal.SIGALRM)

    def handle_timeout(_signum: int, _frame: Any) -> None:
        raise CorpusError(f"单篇抓取超时：{source.id} 超过 --source-timeout={seconds:g} 秒")

    signal.signal(signal.SIGALRM, handle_timeout)
    signal.setitimer(signal.ITIMER_REAL, seconds)
    try:
        yield
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)
        signal.signal(signal.SIGALRM, previous_handler)

def read_url(url: str, timeout: float, user_agent: str) -> str:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme in {"", "file"}:
        path = Path(urllib.request.url2pathname(parsed.path if parsed.scheme == "file" else url))
        return path.read_text(encoding="utf-8")
    if parsed.scheme not in {"http", "https"}:
        raise CorpusError(f"不支持的 URL scheme：{parsed.scheme or '<empty>'} ({url})")

    request = urllib.request.Request(url, headers={"User-Agent": user_agent})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:  # noqa: S310 - URL 来自受控 manifest
            charset = response.headers.get_content_charset() or "utf-8"
            return response.read().decode(charset, errors="replace")
    except urllib.error.HTTPError as exc:
        raise NonRetryableCorpusError(f"HTTP 状态码异常：{exc.code} ({url})") from exc
    except (http.client.HTTPException, TimeoutError) as exc:
        raise CorpusError(f"网络读取异常：{type(exc).__name__}: {exc} ({url})") from exc


def fetch_with_retries(source: SourceItem, timeout: float, user_agent: str, max_retries: int, retry_backoff: float) -> str:
    attempts = max_retries + 1
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            return read_url(source.url, timeout=timeout, user_agent=user_agent)
        except NonRetryableCorpusError:
            raise
        except (OSError, UnicodeError, urllib.error.URLError, CorpusError) as exc:
            last_error = exc
            if attempt >= attempts:
                break
            time.sleep(retry_backoff * attempt)
    raise CorpusError(f"抓取失败：{source.id} {source.url}: {last_error}") from last_error


def extract_text(html: str, source: SourceItem, min_chars: int) -> str:
    parser = SelectedTextParser(source.source_selector)
    parser.feed(html)
    parser.close()
    if not parser.matched:
        raise NonRetryableCorpusError(f"selector 未命中：{source.id} sourceSelector={source.source_selector!r}")
    text = parser.text()
    visible_chars = len(re.sub(r"\s+", "", text))
    if visible_chars < min_chars:
        raise NonRetryableCorpusError(f"正文过短：{source.id} 仅 {visible_chars} 个非空白字符，低于 --min-chars={min_chars}")
    return text


def cache_path(cache_dir: Path, source: SourceItem) -> Path:
    validate_cache_key(source.cache_key)
    base = cache_dir.resolve()
    candidate = (cache_dir / f"{source.cache_key}.txt").resolve()
    try:
        candidate.relative_to(base)
    except ValueError as exc:
        raise CorpusError(f"cacheKey 指向 cache 目录之外：{source.cache_key!r}") from exc
    return candidate


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="按 HansBug 文风样本 manifest 抓取旧博客正文；完整正文只写入 .cache/hansbug-writing-voice/corpus/。"
    )
    parser.add_argument("--manifest", default=str(DEFAULT_MANIFEST), help="样本 manifest JSON 路径。")
    parser.add_argument("--cache-dir", default=str(DEFAULT_CACHE_DIR), help="正文 cache 输出目录，默认是被 git ignore 的本地目录。")
    parser.add_argument("--id", action="append", help="只抓取指定 source id；可重复，也可用逗号分隔。")
    parser.add_argument("--sample-role", action="append", help="只抓取指定 sampleRole；可重复，也可用逗号分隔。")
    parser.add_argument("--limit", type=int, help="最多抓取多少篇；不传则抓取筛选后的全部样本。")
    parser.add_argument("--delay", type=float, default=1.5, help="每篇成功写入后的等待秒数，用于限速。")
    parser.add_argument("--timeout", type=float, default=20.0, help="单次 socket 读写超时时间（秒）。")
    parser.add_argument("--source-timeout", type=float, default=90.0, help="单篇样本整体超时时间（秒）；设为 0 可关闭。")
    parser.add_argument("--max-retries", type=int, default=2, help="失败后的最大重试次数。")
    parser.add_argument("--retry-backoff", type=float, default=1.5, help="重试退避基准秒数，会乘以当前 attempt。")
    parser.add_argument("--user-agent", default=DEFAULT_USER_AGENT, help="HTTP User-Agent。")
    parser.add_argument("--min-chars", type=int, default=300, help="selector 命中后正文最少非空白字符数。")
    parser.add_argument("--dry-run", action="store_true", help="只校验 manifest 并打印计划，不发请求、不写 cache。")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        if args.limit is not None and args.limit < 1:
            raise CorpusError("--limit 必须大于 0")
        if args.delay < 0 or args.timeout <= 0 or args.source_timeout < 0 or args.max_retries < 0 or args.retry_backoff < 0:
            raise CorpusError("--delay/--timeout/--source-timeout/--max-retries/--retry-backoff 参数不合法")
        if args.min_chars < 1:
            raise CorpusError("--min-chars 必须大于 0")

        manifest = load_manifest(Path(args.manifest))
        selected = filter_sources(
            iter_sources(manifest),
            ids=split_filters(args.id),
            roles=split_filters(args.sample_role),
            limit=args.limit,
        )
        if not selected:
            raise CorpusError("没有任何样本匹配当前 --id / --sample-role / --limit 条件")

        cache_dir = Path(args.cache_dir)
        planned_targets = [(source, cache_path(cache_dir, source)) for source in selected]
        if args.dry_run:
            print(f"DRY-RUN: 将处理 {len(selected)} 篇样本，cache 目录为 {repo_relative(cache_dir)}")
            for source, target in planned_targets:
                print(f"- {source.id} [{source.sample_role}] {source.title} -> {repo_relative(target)}")
            return 0

        cache_dir.mkdir(parents=True, exist_ok=True)
        for index, (source, target) in enumerate(planned_targets, start=1):
            attempts = args.max_retries + 1
            last_error: Exception | None = None
            for attempt in range(1, attempts + 1):
                try:
                    with source_deadline(source, args.source_timeout):
                        html = fetch_with_retries(source, args.timeout, args.user_agent, 0, args.retry_backoff)
                        text = extract_text(html, source, args.min_chars)
                        target.write_text(text + "\n", encoding="utf-8")
                    last_error = None
                    break
                except NonRetryableCorpusError:
                    raise
                except CorpusError as exc:
                    last_error = exc
                    if attempt >= attempts:
                        break
                    time.sleep(args.retry_backoff * attempt)
            if last_error is not None:
                raise CorpusError(f"抓取失败：{source.id} {source.url}: {last_error}") from last_error
            print(f"OK {index}/{len(selected)}: {source.id} -> {repo_relative(target)}")
            if index < len(selected) and args.delay:
                time.sleep(args.delay)
        return 0
    except CorpusError as exc:
        print(f"错误：{exc}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("错误：用户中断", file=sys.stderr)
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
