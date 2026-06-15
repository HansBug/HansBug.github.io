#!/usr/bin/env python3
"""对 HansBug 中文博客文风草稿做确定性粗筛。"""

from __future__ import annotations

import argparse
import contextlib
import importlib.util
import io
import json
import re
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Iterable

SCORE_MEANING = "rough-gate-only-not-style-similarity"
DEFAULT_REFERENCES = Path(__file__).resolve().parents[1] / "references"
DEFAULT_MANIFEST = DEFAULT_REFERENCES / "sample-manifest.json"

CJK_RE = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]")
H2_RE = re.compile(r"^##\s+(.+)$", re.MULTILINE)
SAMPLE_COMMENT_RE = re.compile(r"hansbug-voice-samples\s*:\s*([^\n<>]+)", re.IGNORECASE)
SAMPLE_INLINE_RE = re.compile(r"(?:样本|sample ids?|参考|对照)[:：]\s*([A-Za-z0-9_,，、\-\s]+)", re.IGNORECASE)
CNBLOGS_ID_RE = re.compile(r"cnblogs-\d+")

# 这些词表均来自 PR-2 references：anti-patterns.md 的 AI 腔/正确废话/资料搬运腔，
# micro-patterns.md 的口癖 buffet，macro-logic.md 的边界和结尾要求，
# voice-profile.md / anti-patterns.md 的事实与经历边界。
AI_CLICHE_TERMS = [
    "总体而言",
    "值得注意的是",
    "可以看出",
    "具有重要意义",
    "综上所述",
    "积极意义",
    "参考价值",
    "不断优化",
    "随着技术的发展",
]
CATCHPHRASE_TERMS = ["笔者", "好吧", "咳咳", "2333", "闲话少叙", "容我先", "说白了"]
JUDGEMENT_TERMS = [
    "先说结论",
    "核心判断",
    "本质",
    "根因",
    "不是",
    "而是",
    "取舍",
    "边界",
    "能跑不等于",
    "设计成立",
    "长期维护",
    "失败方式",
    "维护成本",
]
BOUNDARY_TERMS = ["不解决", "边界", "适用", "不适用", "前置条件", "失败方式", "版本", "环境"]
CLOSING_TERMS = ["归根结底", "说到底", "总结", "盖章", "最终判断", "长期", "方法论", "维护"]
EXPERIENCE_TERMS = ["我", "笔者", "我们"]
UNSUPPORTED_EXPERIENCE_PATTERNS = [
    r"(?:我|笔者|我们).{0,16}(?:负责|参与|经历|踩过|见过|拍板|上线|复盘)",
    r"(?:项目|课程|助教|会议|现场|团队|内部|上线).{0,24}(?:我|笔者|我们|当时|曾经)",
    r"(?:我|笔者|我们).{0,24}(?:会议|现场|课程|项目|团队|内部)",
]
EXPERIENCE_SOURCE_MARKERS = ["用户提供", "作者提供", "据材料", "公开链接", "需要作者补充", "需作者确认"]


@dataclass(frozen=True)
class Finding:
    code: str
    severity: str
    message: str
    evidence: str
    fixHint: str

    def to_json(self) -> dict[str, str]:
        return asdict(self)


def count_cjk(text: str) -> int:
    return len(CJK_RE.findall(text))


def strip_frontmatter(text: str) -> str:
    if text.startswith("---\n"):
        end = text.find("\n---\n", 4)
        if end != -1:
            return text[end + 5 :]
    return text


def compact_evidence(text: str, limit: int = 180) -> str:
    normalized = re.sub(r"\s+", " ", text).strip()
    if len(normalized) <= limit:
        return normalized
    return normalized[: limit - 1] + "…"


def make_finding(code: str, severity: str, message: str, evidence: str, fix_hint: str) -> Finding:
    return Finding(code=code, severity=severity, message=message, evidence=compact_evidence(evidence), fixHint=fix_hint)


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def load_manifest(path: Path) -> tuple[dict[str, Any] | None, list[Finding]]:
    try:
        manifest = load_json(path)
    except FileNotFoundError:
        return None, [make_finding("manifest-not-found", "C", "找不到样本 manifest。", str(path), "传入正确的 --manifest 路径。")]
    except json.JSONDecodeError as exc:
        return None, [make_finding("manifest-invalid-json", "C", "样本 manifest 不是合法 JSON。", f"{path}: {exc.msg}", "修复 JSON 语法。")]

    findings: list[Finding] = []
    sources = manifest.get("sources") if isinstance(manifest, dict) else None
    if not isinstance(sources, list):
        return None, [make_finding("manifest-missing-sources", "C", "样本 manifest 缺少 sources 数组。", str(path), "使用 PR-1 schemaVersion 2 manifest。")]

    seen: set[str] = set()
    for source in sources:
        if not isinstance(source, dict):
            findings.append(make_finding("manifest-invalid-source", "C", "manifest sources 内存在非 object 条目。", repr(source), "每个 source 必须是 JSON object。"))
            continue
        sid = str(source.get("id", ""))
        if not sid:
            findings.append(make_finding("manifest-invalid-source", "C", "manifest source 缺少 id。", json.dumps(source, ensure_ascii=False)[:120], "补齐 source.id。"))
            continue
        if sid in seen:
            findings.append(make_finding("manifest-duplicate-sample-id", "C", "manifest source id 重复。", sid, "保持 sample id 唯一。"))
        seen.add(sid)
        role = source.get("sampleRole")
        participates = bool(source.get("participatesInProfile"))
        holdout = bool(source.get("holdoutForDryRun"))
        if participates and (role == "negative" or holdout):
            findings.append(
                make_finding(
                    "invalid-positive-sample-role",
                    "C",
                    "holdout / negative 样本不能参与正向画像。",
                    f"{sid}: sampleRole={role}, holdoutForDryRun={holdout}, participatesInProfile={participates}",
                    "把该样本的 participatesInProfile 改回 false，或修正 sampleRole / holdout 设置。",
                )
            )
    return manifest, findings


def get_sources_by_id(manifest: dict[str, Any] | None) -> dict[str, dict[str, Any]]:
    if not manifest:
        return {}
    return {str(item.get("id")): item for item in manifest.get("sources", []) if isinstance(item, dict) and item.get("id")}


def extract_declared_sample_ids(text: str) -> list[str]:
    ids: list[str] = []
    for match in SAMPLE_COMMENT_RE.finditer(text):
        ids.extend(CNBLOGS_ID_RE.findall(match.group(1)))
    for match in SAMPLE_INLINE_RE.finditer(text):
        ids.extend(CNBLOGS_ID_RE.findall(match.group(1)))
    # 去重但保持顺序。
    result: list[str] = []
    for sid in ids:
        if sid not in result:
            result.append(sid)
    return result


def validate_declared_samples(sample_ids: list[str], sources_by_id: dict[str, dict[str, Any]]) -> tuple[list[dict[str, Any]], list[Finding]]:
    findings: list[Finding] = []
    matched: list[dict[str, Any]] = []
    for sid in sample_ids:
        source = sources_by_id.get(sid)
        if source is None:
            findings.append(
                make_finding(
                    "unknown-sample-id",
                    "C",
                    "文稿引用了不存在的 sample id。",
                    sid,
                    "改成 sample-manifest.json 中存在且 participatesInProfile=true 的样本，或删除这条对照声明。",
                )
            )
            continue
        role = source.get("sampleRole")
        holdout = bool(source.get("holdoutForDryRun"))
        participates = bool(source.get("participatesInProfile"))
        if role == "negative" or holdout or not participates:
            findings.append(
                make_finding(
                    "invalid-positive-sample-role",
                    "C",
                    "文稿把不可作为正向画像的样本用于正向对照。",
                    f"{sid}: sampleRole={role}, holdoutForDryRun={holdout}, participatesInProfile={participates}",
                    "只使用 participatesInProfile=true 且非 holdout / negative 的样本做正向对照。",
                )
            )
            continue
        matched.append(
            {
                "id": sid,
                "title": source.get("title", ""),
                "sampleRole": role,
                "articleType": source.get("articleType", ""),
            }
        )
    return matched, findings


def count_terms(text: str, terms: Iterable[str]) -> dict[str, int]:
    return {term: text.count(term) for term in terms if text.count(term) > 0}


def has_any(text: str, terms: Iterable[str]) -> bool:
    return any(term in text for term in terms)


def judgement_density(text: str) -> int:
    return sum(text.count(term) for term in JUDGEMENT_TERMS)


def detect_ai_cliches(text: str) -> list[Finding]:
    hits = count_terms(text, AI_CLICHE_TERMS)
    findings: list[Finding] = []
    if len(hits) >= 3 or sum(hits.values()) >= 4:
        findings.append(
            make_finding(
                "ai-cliche-generic-summary",
                "C",
                "文稿出现 AI 式正确废话和泛泛总结。",
                "、".join(f"{k}×{v}" for k, v in hits.items()),
                "删掉空泛总结，补主问题、核心判断、工程取舍和具体失败方式。",
            )
        )
    return findings


def detect_core_judgement(text: str) -> list[Finding]:
    body = strip_frontmatter(text)
    first_part = body[: min(len(body), 520)]
    density = judgement_density(first_part)
    has_conclusion = any(term in first_part for term in ["先说结论", "核心判断", "本文解决", "本文真正", "归根结底"])
    if density < 2 and not has_conclusion:
        return [
            make_finding(
                "missing-core-judgement",
                "C",
                "前三段附近缺少清楚的核心判断。",
                first_part,
                "在开头补主问题、边界和作者判断，不要只介绍本文会讲什么。",
            )
        ]
    return []


def detect_catchphrase_stuffing(text: str) -> list[Finding]:
    hits = count_terms(text, CATCHPHRASE_TERMS)
    total = sum(hits.values())
    density = judgement_density(text)
    cjk = max(count_cjk(text), 1)
    if total >= 7 and (density < 5 or total / cjk > 0.015):
        return [
            make_finding(
                "catchphrase-without-judgement",
                "C",
                "口癖密度过高，但判断密度不足。",
                "、".join(f"{k}×{v}" for k, v in hits.items()),
                "先删口癖，重建问题定义、边界、工程取舍和结尾盖章。",
            )
        ]
    return []


def detect_macro_structure(text: str) -> list[Finding]:
    findings: list[Finding] = []
    headings = H2_RE.findall(text)
    if len(headings) < 2:
        findings.append(
            make_finding(
                "missing-h2-structure",
                "C",
                "缺少稳定的二级标题结构。",
                f"检测到 {len(headings)} 个二级标题。",
                "至少拆出问题定义、方案分析、边界 / 坑点、总结等章节。",
            )
        )
    boundary_headings = [heading for heading in headings if any(term in heading for term in ["边界", "反例", "例外", "坑点", "适用"])]
    has_boundary_statement = "不解决" in text or "不适用" in text or "失败方式" in text
    if not boundary_headings and not has_boundary_statement:
        findings.append(
            make_finding(
                "missing-boundary-section",
                "C",
                "缺少边界、适用场景或失败方式说明。",
                "未发现边界类二级标题，也未命中“不解决 / 不适用 / 失败方式”等明确边界声明。",
                "补“本文解决什么 / 不解决什么”、适用环境、失败方式和例外。",
            )
        )
    closing_area = text[-500:]
    if not has_any(closing_area, CLOSING_TERMS) or not ("##" in closing_area and ("总结" in closing_area or "收束" in closing_area or "结尾" in closing_area)):
        findings.append(
            make_finding(
                "missing-closing-lift",
                "C",
                "结尾没有完成总结盖章或视角上升。",
                closing_area,
                "补一个回到主问题、抬高到方法论或长期维护判断的总结段。",
            )
        )
    return findings


def detect_unsupported_experience(text: str) -> list[Finding]:
    if has_any(text, EXPERIENCE_SOURCE_MARKERS):
        return []
    findings: list[Finding] = []
    for pattern in UNSUPPORTED_EXPERIENCE_PATTERNS:
        match = re.search(pattern, text)
        if match:
            start = max(0, match.start() - 35)
            end = min(len(text), match.end() + 55)
            findings.append(
                make_finding(
                    "unsupported-first-person-experience",
                    "C",
                    "疑似无来源第一人称项目 / 课程 / 会议现场。",
                    text[start:end],
                    "补作者提供的真实来源，或改成需要作者补充的占位，不要写成确定经历。",
                )
            )
            break
    return findings


def detect_missing_sample_comparison(sample_ids: list[str]) -> list[Finding]:
    if sample_ids:
        return []
    return [
        make_finding(
            "missing-sample-comparison",
            "C",
            "候选稿没有声明任何正向样本对照。",
            "未找到 hansbug-voice-samples 注释或 sample ids 声明。",
            "在草稿中用 HTML 注释声明实际对照的正向样本，例如 <!-- hansbug-voice-samples: cnblogs-8701447 -->。",
        )
    ]


def load_lint_module(skill_root: Path):
    script = skill_root / "scripts" / "lint_voice_references.py"
    spec = importlib.util.spec_from_file_location("hansbug_voice_lint", script)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"无法加载 {script}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)  # type: ignore[union-attr]
    return module


def lint_references(skill_root: Path, references_dir: Path) -> list[Finding]:
    try:
        module = load_lint_module(skill_root)
        errors = module.lint_references(references_dir)
    except Exception as exc:  # pragma: no cover - defensive, still returns JSON.
        return [
            make_finding(
                "reference-lint-failed",
                "C",
                "reference 摘录扫描执行失败。",
                str(exc),
                "先确保 lint_voice_references.py 可运行，再修复 references 目录。",
            )
        ]
    if not errors:
        return []
    return [
        make_finding(
            "reference-lint-failed",
            "C",
            "reference 摘录扫描发现违规内容。",
            " | ".join(errors),
            "按 lint_voice_references.py 的错误提示修复 sourceUrl、purpose、UTF-8 或摘录长度。",
        )
    ]


def bucket_findings(findings: list[Finding]) -> dict[str, list[Finding]]:
    buckets = {
        "blockingFindings": [],
        "warnings": [],
        "missingMacroSections": [],
        "overusedMicroPatterns": [],
        "aiClicheHits": [],
        "possibleUnsupportedExperienceClaims": [],
    }
    for finding in findings:
        if finding.code.startswith("missing-") and finding.code in {"missing-h2-structure", "missing-boundary-section", "missing-closing-lift"}:
            buckets["missingMacroSections"].append(finding)
        elif finding.code == "catchphrase-without-judgement":
            buckets["overusedMicroPatterns"].append(finding)
        elif finding.code.startswith("ai-cliche"):
            buckets["aiClicheHits"].append(finding)
        elif finding.code == "unsupported-first-person-experience":
            buckets["possibleUnsupportedExperienceClaims"].append(finding)
        elif finding.severity == "C":
            buckets["blockingFindings"].append(finding)
        else:
            buckets["warnings"].append(finding)
    return buckets


def calculate_score(findings: list[Finding]) -> int:
    score = 100
    for finding in findings:
        if finding.severity == "C":
            score -= 18
        elif finding.severity == "I":
            score -= 9
        else:
            score -= 3
    return max(0, min(100, score))


def build_report(markdown_path: Path, skill_root: Path, manifest_path: Path, references_dir: Path) -> dict[str, Any]:
    findings: list[Finding] = []
    manifest, manifest_findings = load_manifest(manifest_path)
    findings.extend(manifest_findings)
    sources_by_id = get_sources_by_id(manifest)

    try:
        text = markdown_path.read_text(encoding="utf-8")
    except FileNotFoundError:
        findings.append(make_finding("draft-not-found", "C", "找不到待检查 Markdown 文件。", str(markdown_path), "传入正确的 Markdown 路径。"))
        text = ""
    except UnicodeDecodeError as exc:
        findings.append(make_finding("draft-invalid-utf8", "C", "待检查 Markdown 不是合法 UTF-8。", f"{markdown_path}: {exc.reason}", "用 UTF-8 保存 Markdown 文件。"))
        text = ""

    sample_ids = extract_declared_sample_ids(text)
    matched_samples, sample_findings = validate_declared_samples(sample_ids, sources_by_id)
    findings.extend(sample_findings)
    findings.extend(lint_references(skill_root, references_dir))

    if text:
        findings.extend(detect_missing_sample_comparison(sample_ids))
        findings.extend(detect_ai_cliches(text))
        findings.extend(detect_core_judgement(text))
        findings.extend(detect_catchphrase_stuffing(text))
        findings.extend(detect_macro_structure(text))
        findings.extend(detect_unsupported_experience(text))

    buckets = bucket_findings(findings)
    status = "fail" if any(f.severity == "C" for f in findings) else "pass"
    report: dict[str, Any] = {
        "status": status,
        "score": calculate_score(findings),
        "scoreMeaning": SCORE_MEANING,
        "blockingFindings": [f.to_json() for f in buckets["blockingFindings"]],
        "warnings": [f.to_json() for f in buckets["warnings"]],
        "matchedSamples": matched_samples,
        "missingMacroSections": [f.to_json() for f in buckets["missingMacroSections"]],
        "overusedMicroPatterns": [f.to_json() for f in buckets["overusedMicroPatterns"]],
        "aiClicheHits": [f.to_json() for f in buckets["aiClicheHits"]],
        "possibleUnsupportedExperienceClaims": [f.to_json() for f in buckets["possibleUnsupportedExperienceClaims"]],
    }
    return report


def render_text(report: dict[str, Any]) -> str:
    title = "检查通过" if report["status"] == "pass" else "检查失败"
    lines = [f"{title}：status={report['status']}，score={report['score']}（{report['scoreMeaning']}）"]
    if report["matchedSamples"]:
        ids = ", ".join(sample["id"] for sample in report["matchedSamples"])
        lines.append(f"正向样本对照：{ids}")
    for field in ["blockingFindings", "missingMacroSections", "overusedMicroPatterns", "aiClicheHits", "possibleUnsupportedExperienceClaims", "warnings"]:
        items = report.get(field, [])
        if not items:
            continue
        lines.append(f"\n{field}:")
        for item in items:
            lines.append(f"- [{item['severity']}] {item['code']}：{item['message']}；建议：{item['fixHint']}")
    return "\n".join(lines) + "\n"


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="对 HansBug 中文博客文风草稿做确定性粗筛；score 不是文风相似度，只是粗筛健康度。"
    )
    parser.add_argument("markdown", help="要检查的 Markdown 草稿路径")
    parser.add_argument("--skill-root", default=str(Path(__file__).resolve().parents[1]), help="hansbug-writing-voice skill 根目录")
    parser.add_argument("--manifest", default=str(DEFAULT_MANIFEST), help="sample-manifest.json 路径")
    parser.add_argument("--references-dir", default="", help="要执行摘录 lint 的 references 目录；默认使用 skill-root/references")
    parser.add_argument("--format", choices=["json", "text"], default="text", help="输出格式：json 供机器消费，text 供人读")
    parser.add_argument("--pretty", action="store_true", help="JSON 输出使用缩进，便于 PR 审阅")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    skill_root = Path(args.skill_root).resolve()
    manifest_path = Path(args.manifest).resolve()
    references_dir = Path(args.references_dir).resolve() if args.references_dir else skill_root / "references"
    markdown_path = Path(args.markdown).resolve()

    report = build_report(markdown_path, skill_root, manifest_path, references_dir)
    if args.format == "json":
        print(json.dumps(report, ensure_ascii=False, indent=2 if args.pretty else None, sort_keys=True))
    else:
        print(render_text(report), end="")
    return 0 if report["status"] == "pass" else 1


if __name__ == "__main__":
    raise SystemExit(main())
