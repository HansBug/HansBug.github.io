#!/usr/bin/env python3
"""从 HansBug 文风语料 cache 或旧站 catalog 摘要中提取机械统计特征。"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

SCRIPT_ROOT = Path(__file__).resolve().parent
SKILL_ROOT = SCRIPT_ROOT.parent
REPO_ROOT = SKILL_ROOT.parents[1]
DEFAULT_MANIFEST = SKILL_ROOT / "references" / "sample-manifest.json"
DEFAULT_CACHE_DIR = REPO_ROOT / ".cache" / "hansbug-writing-voice" / "corpus"
DEFAULT_OUTPUT = SKILL_ROOT / "references" / "derived" / "voice-features.json"
DEFAULT_CATALOG = REPO_ROOT / "src" / "data" / "oldBlogCatalog.json"
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
TRANSITION_TERMS = [
    "首先",
    "其次",
    "具体来说",
    "另一方面",
    "换句话说",
    "总而言之",
    "归根结底",
    "好吧",
    "咳咳",
    "容我先",
    "闲话少叙",
    "说正经的",
    "说白了",
    "那么问题来了",
    "不妨",
    "别的不说",
]
PUNCT_RE = re.compile(r"[\s\dA-Za-z`~!@#$%^&*()_+\-=\[\]{};:'\"\\|,.<>/?，。！？；：、“”‘’（）【】《》—…·]+")
SENTENCE_SPLIT_RE = re.compile(r"[。！？!?；;]+")
CJK_RE = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]")


class FeatureError(RuntimeError):
    """特征提取中的可解释错误。"""


def repo_relative(path: Path) -> str:
    try:
        return str(path.resolve().relative_to(REPO_ROOT))
    except ValueError:
        return str(path)


def load_json(path: Path, label: str) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise FeatureError(f"{label} 不存在：{repo_relative(path)}") from exc
    except json.JSONDecodeError as exc:
        raise FeatureError(f"{label} 不是合法 JSON：{repo_relative(path)}: {exc.msg}") from exc
    if not isinstance(data, dict):
        raise FeatureError(f"{label} 顶层必须是 JSON object")
    return data


def validate_manifest(manifest: dict[str, Any]) -> list[dict[str, Any]]:
    sources = manifest.get("sources")
    if not isinstance(sources, list):
        raise FeatureError("manifest.sources 必须是 JSON array")
    seen: set[str] = set()
    result: list[dict[str, Any]] = []
    for index, raw in enumerate(sources):
        if not isinstance(raw, dict):
            raise FeatureError(f"manifest.sources[{index}] 必须是 JSON object")
        missing = sorted(field for field in REQUIRED_SOURCE_FIELDS if field not in raw)
        if missing:
            raise FeatureError(f"manifest.sources[{index}] 缺少字段：{', '.join(missing)}")
        if not isinstance(raw["id"], str) or not raw["id"].strip():
            raise FeatureError(f"manifest.sources[{index}].id 必须是非空字符串")
        if raw["id"] in seen:
            raise FeatureError(f"manifest.sources[{index}].id 重复：{raw['id']}")
        seen.add(raw["id"])
        if not isinstance(raw.get("useFor"), list) or not raw["useFor"]:
            raise FeatureError(f"manifest.sources[{index}].useFor 必须是非空数组")
        if not isinstance(raw.get("participatesInProfile"), bool):
            raise FeatureError(f"manifest.sources[{index}].participatesInProfile 必须是布尔值")
        if not isinstance(raw.get("holdoutForDryRun"), bool):
            raise FeatureError(f"manifest.sources[{index}].holdoutForDryRun 必须是布尔值")
        for field in ["title", "url", "articleType", "sampleRole", "cacheKey", "sourceSelector", "notes"]:
            if not isinstance(raw.get(field), str) or not raw[field].strip():
                raise FeatureError(f"manifest.sources[{index}].{field} 必须是非空字符串")
        validate_cache_key(raw["cacheKey"])
        if not isinstance(raw.get("year"), int):
            raise FeatureError(f"manifest.sources[{index}].year 必须是整数")
        result.append(raw)
    return result


def split_filters(values: list[str] | None) -> set[str]:
    result: set[str] = set()
    for value in values or []:
        result.update(part.strip() for part in value.split(",") if part.strip())
    return result


def select_sources(sources: Iterable[dict[str, Any]], ids: set[str], roles: set[str], include_non_profile: bool) -> list[dict[str, Any]]:
    selected = []
    for source in sources:
        if ids and source["id"] not in ids:
            continue
        if roles and source["sampleRole"] not in roles:
            continue
        if not include_non_profile and not source["participatesInProfile"]:
            continue
        selected.append(source)
    return selected


def load_catalog_summaries(path: Path) -> dict[str, str]:
    catalog = load_json(path, "oldBlogCatalog")
    posts = catalog.get("posts")
    if not isinstance(posts, list):
        raise FeatureError("oldBlogCatalog.posts 必须是 JSON array")
    summaries: dict[str, str] = {}
    for post in posts:
        if isinstance(post, dict) and isinstance(post.get("url"), str) and isinstance(post.get("summary"), str):
            summaries[post["url"]] = post["summary"].strip()
    return summaries


def validate_cache_key(cache_key: str) -> None:
    if not re.fullmatch(r"[A-Za-z0-9._-]+", cache_key):
        raise FeatureError(f"cacheKey 只能包含字母、数字、点、下划线和短横线：{cache_key!r}")


def cache_path(cache_dir: Path, source: dict[str, Any]) -> Path:
    cache_key = source["cacheKey"]
    validate_cache_key(cache_key)
    base = cache_dir.resolve()
    candidate = (cache_dir / f"{cache_key}.txt").resolve()
    try:
        candidate.relative_to(base)
    except ValueError as exc:
        raise FeatureError(f"cacheKey 指向 cache 目录之外：{cache_key!r}") from exc
    return candidate


def read_source_text(
    source: dict[str, Any],
    cache_dir: Path,
    summaries: dict[str, str],
    allow_catalog_summary: bool,
) -> tuple[str, str]:
    path = cache_path(cache_dir, source)
    if path.exists():
        try:
            text = path.read_text(encoding="utf-8").strip()
        except OSError as exc:
            raise FeatureError(f"无法读取 cache 文件 {repo_relative(path)}：{exc}") from exc
        if text:
            return text, "cache"
        raise FeatureError(f"cache 文件为空：{repo_relative(path)}")
    if allow_catalog_summary:
        summary = summaries.get(source["url"], "").strip()
        if summary:
            return summary, "catalog-summary"
    raise FeatureError(
        f"找不到样本正文：{source['id']}；期望 cache={repo_relative(path)}。"
        "如只是生成 smoke 派生特征，可显式使用 --allow-catalog-summary。"
    )


def paragraph_lengths(text: str) -> list[int]:
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n|\r\n\s*\r\n", text) if p.strip()]
    if len(paragraphs) <= 1:
        paragraphs = [line.strip() for line in text.splitlines() if line.strip()]
    return [len(CJK_RE.findall(p)) or len(p) for p in paragraphs]


def sentence_lengths(text: str) -> list[int]:
    sentences = [s.strip() for s in SENTENCE_SPLIT_RE.split(text) if s.strip()]
    return [len(CJK_RE.findall(s)) or len(s) for s in sentences]


def histogram(values: list[int], buckets: list[tuple[str, int, int | None]]) -> dict[str, int]:
    result = {name: 0 for name, _, _ in buckets}
    for value in values:
        for name, lower, upper in buckets:
            if value >= lower and (upper is None or value <= upper):
                result[name] += 1
                break
    return result


def summary_stats(values: list[int]) -> dict[str, Any]:
    if not values:
        return {"count": 0, "min": 0, "max": 0, "mean": 0, "median": 0}
    ordered = sorted(values)
    mid = len(ordered) // 2
    if len(ordered) % 2:
        median = ordered[mid]
    else:
        median = (ordered[mid - 1] + ordered[mid]) / 2
    return {
        "count": len(values),
        "min": ordered[0],
        "max": ordered[-1],
        "mean": round(sum(values) / len(values), 2),
        "median": round(median, 2),
    }


def collect_heading_patterns(text: str) -> Counter[str]:
    counter: Counter[str] = Counter()
    for line in text.splitlines():
        stripped = line.strip()
        match = re.match(r"^(#{1,6})\s+(.+)$", stripped)
        if match:
            counter[f"markdown-h{len(match.group(1))}"] += 1
        elif re.match(r"^(第[一二三四五六七八九十0-9]+[章节部分篇]|[一二三四五六七八九十]+、)", stripped):
            counter["chinese-numbered-heading"] += 1
        elif 2 <= len(stripped) <= 24 and not re.search(r"[。！？!?]", stripped):
            counter["short-standalone-line"] += 1
    return counter


def top_ngrams(texts: list[str], n: int, limit: int) -> list[dict[str, Any]]:
    counter: Counter[str] = Counter()
    for text in texts:
        compact = PUNCT_RE.sub("", text)
        for index in range(0, max(0, len(compact) - n + 1)):
            gram = compact[index : index + n]
            if len(gram) == n:
                counter[gram] += 1
    return [{"text": text, "count": count} for text, count in counter.most_common(limit)]


def build_features(samples: list[dict[str, Any]]) -> dict[str, Any]:
    texts = [sample["text"] for sample in samples]
    paragraph_values = [value for text in texts for value in paragraph_lengths(text)]
    sentence_values = [value for text in texts for value in sentence_lengths(text)]
    heading_counter: Counter[str] = Counter()
    transition_counter: Counter[str] = Counter()
    for text in texts:
        heading_counter.update(collect_heading_patterns(text))
        for term in TRANSITION_TERMS:
            transition_counter[term] += text.count(term)

    cjk_counts = [len(CJK_RE.findall(text)) for text in texts]
    return {
        "sourceText": dict(sorted(Counter(sample["textSource"] for sample in samples).items())),
        "sampleCount": len(samples),
        "cjkCharCount": {
            "total": sum(cjk_counts),
            "meanPerSample": round(sum(cjk_counts) / len(cjk_counts), 2) if cjk_counts else 0,
        },
        "paragraphLength": {
            "stats": summary_stats(paragraph_values),
            "buckets": histogram(
                paragraph_values,
                [("emptyOrTiny", 0, 20), ("short", 21, 80), ("medium", 81, 180), ("long", 181, 360), ("veryLong", 361, None)],
            ),
        },
        "sentenceLength": {
            "stats": summary_stats(sentence_values),
            "buckets": histogram(
                sentence_values,
                [("tiny", 0, 12), ("short", 13, 35), ("medium", 36, 70), ("long", 71, 120), ("veryLong", 121, None)],
            ),
        },
        "headingPatterns": dict(heading_counter.most_common(20)),
        "topNgrams": {
            "char2": top_ngrams(texts, 2, 30),
            "char3": top_ngrams(texts, 3, 30),
        },
        "transitionTerms": [
            {"term": term, "count": count}
            for term, count in sorted(transition_counter.items(), key=lambda item: (-item[1], item[0]))
            if count > 0
        ],
    }


def build_payload(samples: list[dict[str, Any]], manifest_path: Path, cache_dir: Path, catalog_path: Path, allow_catalog_summary: bool) -> dict[str, Any]:
    sample_payload = [
        {
            "id": sample["id"],
            "title": sample["title"],
            "sampleRole": sample["sampleRole"],
            "articleType": sample["articleType"],
            "textSource": sample["textSource"],
        }
        for sample in samples
    ]
    return {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "generator": repo_relative(Path(__file__).resolve()),
        "manifest": repo_relative(manifest_path),
        "cacheDir": repo_relative(cache_dir),
        "catalogFallback": {
            "enabled": allow_catalog_summary,
            "path": repo_relative(catalog_path),
            "说明": "仅在本地 cache 缺失且显式开启 --allow-catalog-summary 时使用旧站 catalog 摘要生成 smoke 级机械特征。",
        },
        "sampleIds": [sample["id"] for sample in samples],
        "samples": sample_payload,
        "features": build_features(samples),
        "limitations": [
            "这些数据只做段落、句长、标题、高频字符片段和转场词等机械统计，不等价于文风画像。",
            "catalog-summary 来源只适合 smoke 和 schema 稳定性验证；正式画像归纳应优先基于 ignored cache 中的旧文正文，并继续遵守 corpus-policy。",
            "holdoutForDryRun 或 participatesInProfile=false 的样本默认不会进入本文件。",
        ],
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="提取 HansBug 文风样本的机械统计特征；默认只打印 JSON，不覆盖仓库文件。")
    parser.add_argument("--manifest", default=str(DEFAULT_MANIFEST), help="样本 manifest JSON 路径。")
    parser.add_argument("--cache-dir", default=str(DEFAULT_CACHE_DIR), help="正文 cache 读取目录。")
    parser.add_argument("--catalog", default=str(DEFAULT_CATALOG), help="旧站 catalog 路径，仅供 --allow-catalog-summary 使用。")
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT), help="--write-derived 时写入的派生特征 JSON 路径。")
    parser.add_argument("--id", action="append", help="只处理指定 source id；可重复，也可用逗号分隔。")
    parser.add_argument("--sample-role", action="append", help="只处理指定 sampleRole；可重复，也可用逗号分隔。")
    parser.add_argument("--include-non-profile", action="store_true", help="连 negative / holdout 等非画像样本也纳入本次统计。")
    parser.add_argument("--allow-catalog-summary", action="store_true", help="cache 缺失时允许退回旧站 catalog 摘要；只适合 smoke。")
    parser.add_argument("--write-derived", action="store_true", help="显式写入 --output；不带该参数时只向 stdout 打印 JSON。")
    parser.add_argument("--format", choices=["json"], default="json", help="输出格式；当前只支持 json。")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        manifest_path = Path(args.manifest)
        cache_dir = Path(args.cache_dir)
        catalog_path = Path(args.catalog)
        manifest = load_json(manifest_path, "manifest")
        sources = select_sources(
            validate_manifest(manifest),
            ids=split_filters(args.id),
            roles=split_filters(args.sample_role),
            include_non_profile=args.include_non_profile,
        )
        if not sources:
            raise FeatureError("没有任何样本匹配当前筛选条件，或样本均未 participatesInProfile")
        summaries = load_catalog_summaries(catalog_path) if args.allow_catalog_summary else {}
        samples: list[dict[str, Any]] = []
        for source in sources:
            text, text_source = read_source_text(source, cache_dir, summaries, args.allow_catalog_summary)
            samples.append({**source, "text": text, "textSource": text_source})
        payload = build_payload(samples, manifest_path, cache_dir, catalog_path, args.allow_catalog_summary)
        output_text = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
        if args.write_derived:
            output_path = Path(args.output)
            try:
                output_path.parent.mkdir(parents=True, exist_ok=True)
                output_path.write_text(output_text, encoding="utf-8")
            except OSError as exc:
                raise FeatureError(f"无法写入派生特征文件 {repo_relative(output_path)}：{exc}") from exc
            print(f"OK: 已写入 {repo_relative(output_path)}")
        else:
            print(output_text, end="")
        return 0
    except FeatureError as exc:
        print(f"错误：{exc}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("错误：用户中断", file=sys.stderr)
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
