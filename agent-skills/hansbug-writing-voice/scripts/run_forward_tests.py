#!/usr/bin/env python3
"""Run PR-5 real CLI forward-tests and materialize dry-run evidence."""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SKILL_ROOT = Path(__file__).resolve().parents[1]
ROOT = SKILL_ROOT.parents[1]
DRY_ROOT = SKILL_ROOT / "dry-runs"
CHECK_SCRIPT = SKILL_ROOT / "scripts/check_hansbug_voice.py"
MANIFEST = SKILL_ROOT / "references/sample-manifest.json"
COMMON_REFERENCES = {
    "conceive": [
        "references/corpus-policy.md",
        "references/sample-manifest.json",
        "references/article-archetypes.md",
        "references/macro-logic.md",
        "references/prompt-recipes.md",
    ],
    "write": [
        "references/corpus-policy.md",
        "references/voice-profile.md",
        "references/article-archetypes.md",
        "references/macro-logic.md",
        "references/micro-patterns.md",
        "references/prompt-recipes.md",
    ],
    "rewrite": [
        "references/corpus-policy.md",
        "references/voice-profile.md",
        "references/micro-patterns.md",
        "references/anti-patterns.md",
        "references/review-rubric.md",
    ],
    "review": [
        "references/corpus-policy.md",
        "references/voice-profile.md",
        "references/anti-patterns.md",
        "references/review-rubric.md",
    ],
    "fix-ai-cliche": [
        "references/corpus-policy.md",
        "references/voice-profile.md",
        "references/micro-patterns.md",
        "references/anti-patterns.md",
        "references/review-rubric.md",
    ],
    "fact-gap": [
        "references/corpus-policy.md",
        "references/voice-profile.md",
        "references/anti-patterns.md",
        "references/review-rubric.md",
    ],
}

TASKS = ["conceive", "write", "rewrite", "review", "fix-ai-cliche", "fact-gap"]
CLIS = ["codex", "claude"]

INPUTS: dict[str, str] = {
    "conceive": """# 任务输入：构思技术实践文\n\n请构思一篇面向中文技术读者的博客，主题是“把一个临时脚本改造成可维护的仓库内工具”。\n\n已知事实：\n\n- 场景是个人技术博客仓库中的维护脚本。\n- 问题不是脚本能不能跑，而是长期维护时会不会让后续 agent 和作者都踩坑。\n- 不能编造作者真实项目经历，只能基于这个抽象场景给构思。\n- 需要声明样本对照：`cnblogs-8701447` 和 `cnblogs-14711869`。\n\n输出需要包含主问题、边界、核心判断、章节推进和事实缺口。\n""",
    "write": """# 任务输入：写短技术实践文\n\n请写一篇短技术实践文初稿，主题是“为什么本地开发脚本需要把失败路径写清楚”。\n\n已知事实：\n\n- 面向维护个人技术博客仓库的 agent / 协作者。\n- 核心观点：脚本失败不可怕，失败后没有清晰路径才可怕。\n- 必须写清适用边界：只讨论仓库维护脚本，不讨论线上业务容灾。\n- 不能编造作者在某公司或某课程中的真实事故。\n- 需要声明样本对照：`cnblogs-8701447` 和 `cnblogs-14711869`。\n\n要求：至少有 2 个二级标题，包含边界/坑点章节和总结章节。\n""",
    "rewrite": """# 任务输入：改写说明书腔文本\n\n下面这段文字是说明书腔 / 资料堆砌 / 官方文档重排式文本，请在事实不变的前提下改写得更接近 HansBug 中文技术博客文风。\n\n原文：\n\n> 本工具提供了若干参数。参数 A 用于指定输入路径，参数 B 用于指定输出路径，参数 C 用于控制是否覆盖已有文件。步骤如下：首先安装依赖，然后执行命令，最后查看结果。官方文档建议用户根据实际需求选择不同参数。该功能可以提升效率，具有一定参考价值。\n\n改写要求：\n\n- 不能新增作者真实经历。\n- 需要保留“参数 / 步骤如下 / 官方文档 / 功能说明”这些事实背景，但不能继续堆说明书。\n- 需要声明样本对照：`cnblogs-8701447` 和 `cnblogs-14711869`。\n- 输出要包含改写稿、C/I/M 自审和修订说明。\n""",
    "review": """# 任务输入：审阅候选稿\n\n请审阅下面这段候选稿是否像 HansBug 中文技术博客正文，按 C/I/M 给出问题与修法。\n\n候选稿：\n\n<!-- hansbug-voice-samples: cnblogs-8701447, cnblogs-14711869 -->\n\n## 背景\n\n这个工具可以帮助用户完成配置。它整体上比较方便，也具有一定参考价值。使用者只需要按照步骤执行，就可以得到结果。\n\n## 使用方式\n\n首先安装依赖，然后运行命令，最后查看输出。总体而言，这个流程可以提升效率。\n\n## 总结\n\n综上所述，这个工具是有意义的，后续可以不断优化。\n\n审阅要求：\n\n- 必须区分文风问题和事实来源问题。\n- 必须指出是否存在 AI 腔、边界缺失、判断不足。\n- 不要只说“感觉不像”。\n""",
    "fix-ai-cliche": """# 任务输入：反向压力测试 / 修复 AI 腔\n\n下面这段草稿故意写得很 AI 腔，并且有高口癖密度、低判断密度、无边界的问题。请先判 C/I/M，再给出修复稿。\n\n草稿：\n\n<!-- hansbug-voice-samples: cnblogs-8701447, cnblogs-14711869 -->\n\n## 背景\n\n咳咳，笔者认为这个工具总体而言具有重要意义。好吧，可以看出它能够提升效率。值得注意的是，随着技术的发展，这类工具有积极意义，也有参考价值。\n\n## 方案\n\n用户可以按照步骤操作，首先准备环境，然后执行命令，最后不断优化。咳咳，笔者觉得这件事很好。\n\n## 总结\n\n综上所述，这个工具值得使用。2333。\n\n修复要求：\n\n- 必须明确这是 issue #25 的反向压力测试。\n- 必须指出“高口癖密度 + 低判断密度 / 无边界 / AI 腔正确废话”。\n- 修复稿要补主问题、边界、核心判断和总结盖章。\n""",
    "fact-gap": """# 任务输入：事实 / 经历缺口识别\n\n请处理下面这段草稿，重点识别没有来源的第一人称经历，不能编造作者现场。\n\n草稿：\n\n<!-- hansbug-voice-samples: cnblogs-8701447, cnblogs-14711869 -->\n\n## 背景\n\n笔者曾经在一个大型项目现场负责过脚本治理，当时团队内部开会决定统一改造所有工具。这个经历说明，只要提前规范脚本，后续就不会出问题。\n\n## 方案\n\n我们上线过一套完整流程，所以这里建议所有项目都直接照搬。\n\n## 总结\n\n归根结底，脚本治理就是要一次性做完。\n\n处理要求：\n\n- 标记所有无来源的第一人称项目 / 会议 / 上线经历。\n- 把不能确认的经历改成“需要作者补充真实材料”，不要写成事实。\n- 给出修订稿和 C/I/M 自审。\n""",
}

PROMPT_HEADER = """你正在为 HansBug/HansBug.github.io 仓库执行 PR-5 真实 CLI forward-test。

硬性要求：
1. 先阅读并遵守 `CLAUDE.md` 的 “HansBug 文风 Skill 强入口”。
2. 再阅读并执行 `agent-skills/hansbug-writing-voice/SKILL.md`，按任务模式渐进读取 references，不要默认全量加载。
3. 不要启动 sub-subagent，不要修改仓库文件，不要访问 `.cache/hansbug-writing-voice/corpus/`。
4. 不要编造作者真实经历、课程现场、项目现场、会议经历或第一手态度。缺少事实时必须标记需要作者补充。
5. 输出必须是中文，并严格使用下面三个 Markdown 标题，不能少、不能改名、不能把整段输出包进 fenced code block。stdout 的第一个非空行必须就是 `## draft`：

## draft
（你的构思 / 正文 / 改写稿 / 对候选稿的审阅主体 / 事实缺口处理主体。若任务本身要求审阅候选稿或识别事实缺口，请把对“输入材料”的 C/I/M 判定放在这里，而不是放在最终自审里。）

## review
（这是对你本次 dry-run 输出本身的最终自审，不是对输入候选稿的审阅结论。必须写成 `C=0 / I=0 / M=<数字>` 或列出未修复 C/I；如果发现你自己的输出还有 C/I，先在 revision 中修掉，再让最终自审达到 C=0 / I=0。不能为了通过验收谎写 0。）

## revision
（说明你如何根据自审修订；如果没有 C/I，也要用至少两句话说明为什么无需阻断性修订。不得再引入新的正文主体。）

写作类任务额外硬要求：
- `write` / `rewrite` / `fix-ai-cliche` 的 `## draft` 必须是可以直接喂给 `check_hansbug_voice.py` 的 Markdown 正文片段。
- 在 `## draft` 标题之后，正文片段的第一行必须写：`<!-- hansbug-voice-samples: cnblogs-8701447, cnblogs-14711869 -->`。不要因为这条要求省略 `## draft` 标题。
- 这些正文片段必须使用真正的 Markdown 二级标题 `## ...`，至少包含边界 / 坑点类章节和总结类章节。不要用 `【标题】` 冒充二级标题。
- 不要把 AI 腔反例里的“总体而言 / 值得注意的是 / 可以看出 / 具有重要意义 / 综上所述 / 积极意义 / 参考价值 / 随着技术的发展”等词原样带进修复后的正文。
- 绝对不要输出 `★ Insight`、装饰线 insight、内部思考、策略注释或“我先如何处理”的元解释；最终 stdout 只能是 `## draft` / `## review` / `## revision` 三段。

输出中必须包含 `CLAUDE.md` 和 `agent-skills/hansbug-writing-voice/SKILL.md` 这两个入口路径，方便验收确认入口被使用。
"""


@dataclass(frozen=True)
class RunSpec:
    task_type: str
    cli: str

    @property
    def slug(self) -> str:
        return f"{self.task_type}-{self.cli}-001"

    @property
    def independent(self) -> bool:
        return self.task_type == "conceive" and self.cli == "codex"


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def split_sections(text: str) -> tuple[dict[str, str], list[str]]:
    markers = list(re.finditer(r"^##\s+(draft|review|revision)\s*$", text, re.I | re.M))
    sections: dict[str, str] = {"draft": "", "review": "", "revision": ""}
    issues: list[str] = []
    if not markers:
        issues.append("未从原始 stdout 解析到标准 `## draft` / `## review` / `## revision` 标题。")
        sections["draft"] = text.strip()
        sections["review"] = "C=1 / I=0 / M=0\n\n未能从原始 stdout 解析出标准三段标题；本次 dry-run 不能宣称通过。"
        sections["revision"] = "解析失败，未做正文后处理；请修 prompt 或重新运行真实 CLI。"
        return sections, issues
    for i, marker in enumerate(markers):
        name = marker.group(1).lower()
        start = marker.end()
        end = markers[i + 1].start() if i + 1 < len(markers) else len(text)
        sections[name] = text[start:end].strip()
    for key, value in sections.items():
        if not value.strip():
            issues.append(f"原始 stdout 的 `{key}` 段为空。")
            sections[key] = "C=1 / I=0 / M=0\n\n该段为空；本次 dry-run 不能宣称通过。" if key == "review" else ""
    return sections, issues


def parse_review_counts(review_text: str, parse_issues: list[str]) -> dict[str, int]:
    normalized = re.sub(r"[：:]", "=", review_text)
    counts: dict[str, int] = {}
    for label, field in [("C", "critical"), ("I", "important"), ("M", "minor")]:
        matches = re.findall(rf"(?:^|[^A-Za-z]){label}\s*=\s*(\d+)", normalized, flags=re.I | re.M)
        if matches:
            counts[field] = int(matches[-1])
        else:
            parse_issues.append(f"未能从 review.md 解析 `{label}=<数字>`。")
            counts[field] = 1 if label in {"C", "I"} else 0
    return counts


def parse_check_report(report_stdout: str) -> dict[str, Any]:
    try:
        return json.loads(report_stdout)
    except Exception:
        return {"status": "fail", "blockingFindings": [{"code": "invalid-check-json"}], "warnings": []}


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text.rstrip() + "\n", encoding="utf-8")


def build_prompt(spec: RunSpec) -> str:
    independent_note = "" if not spec.independent else "\n本次是 independentEntryOnly 测试：除本 prompt 外，你只能依靠 `CLAUDE.md` 与 `agent-skills/hansbug-writing-voice/SKILL.md` 的入口自行决定需要读取哪些 references；不要使用 reviewer 反馈或预期答案。\n"
    writing_gate_note = ""
    if spec.task_type in {"write", "rewrite", "fix-ai-cliche"}:
        writing_gate_note = """
本次 taskType 会对 `## draft` 直接运行 `check_hansbug_voice.py`，所以 `## draft` 必须是最终正文片段本身：
- 第一行必须是 `<!-- hansbug-voice-samples: cnblogs-8701447, cnblogs-14711869 -->`。
- `## draft` 内不要写“身份 / 样本版本 / 对输入草稿的 C/I/M 判定 / ★ Insight / 修复说明 / 输入材料诊断”等元信息。
- `## draft` 内不要出现 fenced code block 包住整篇正文，也不要使用 `【标题】` 代替 Markdown `##` 标题。
- `## draft` 内不要写无来源第一人称经历，例如“笔者最近被脚本追着打”“笔者在自己和别人的脚本里反复见过”“我见过/参与/负责/上线过”。没有材料就写成客观场景或“需要作者补充”。
- `## draft` 内必须包含至少两个 `##` 二级标题，其中至少一个体现边界 / 坑点 / 适用范围，最后一个标题必须包含“总结 / 反思 / 展望 / 方法论 / 收束 / 结尾 / 盖章”之一。不要用“小结”或“写在最后”替代最后标题。
- 如果需要诊断输入坏稿，请放到 `## revision` 的“输入材料诊断”小节；`## review` 只写你本次输出本身的最终自审，并保持 C=0 / I=0。
- 即便输入任务要求“先判 C/I/M”，写作类任务的 `## draft` 也只允许放最终正文；对输入稿的判定必须移动到 `## revision`，不能出现在 `## draft`。
"""
    task_specific_note = ""
    if spec.task_type == "write":
        task_specific_note = """
write 专属限制：不要把场景写成作者亲历事故。禁止出现“笔者最近 / 我最近 / 半年前 / 自己和别人 / 反复见过 / 被脚本反咬一口”等经历型句子；只能写客观维护场景和工程判断。
"""
    elif spec.task_type == "rewrite":
        task_specific_note = """
rewrite 专属限制：`## draft` 只包含改写后的正文片段。不要输出 `★ Insight`，不要输出“改写策略 / 对照说明 / review-rubric / 我先重建 / 我先……”等元信息；如果必须说明策略，只能在 `## revision` 内简短说明。
"""
    elif spec.task_type == "fix-ai-cliche":
        task_specific_note = """
fix-ai-cliche 专属限制：`## draft` 只能是修复稿正文，不能包含“对输入草稿的 C/I/M 判定”。输入坏稿里的 AI 腔词禁止在 `## draft` 中原样出现；如需点名这些词，只能放到 `## revision`，并且尽量用“禁用词清单”概括，不要逐词复写。
"""
    return f"{PROMPT_HEADER}{independent_note}{writing_gate_note}{task_specific_note}\n当前 taskType: `{spec.task_type}`，cli: `{spec.cli}`。\n\n{INPUTS[spec.task_type]}\n"


def run_cli(spec: RunSpec, prompt: str, out_dir: Path, timeout_s: int) -> tuple[int, str, str, list[str]]:
    if spec.cli == "codex":
        cmd = ["codex", "exec", "--dangerously-bypass-approvals-and-sandbox", "-o", str(out_dir / "stdout.log"), prompt]
        cmd_display = "codex exec --dangerously-bypass-approvals-and-sandbox " + json.dumps(prompt, ensure_ascii=False)
        result = subprocess.run(cmd, cwd=ROOT, text=True, capture_output=True, timeout=timeout_s)
        stdout_file = (out_dir / "stdout.log").read_text(encoding="utf-8", errors="replace") if (out_dir / "stdout.log").exists() else result.stdout
        # Preserve CLI transcript too.
        if result.stdout.strip():
            stdout_file = result.stdout.rstrip() + "\n\n--- output-last-message ---\n" + stdout_file
        return result.returncode, stdout_file, result.stderr, [cmd_display]
    else:
        cmd = ["claude", "-p", "--dangerously-skip-permissions", prompt]
        cmd_display = "claude -p --dangerously-skip-permissions " + json.dumps(prompt, ensure_ascii=False)
        result = subprocess.run(cmd, cwd=ROOT, text=True, capture_output=True, timeout=timeout_s)
        return result.returncode, result.stdout, result.stderr, [cmd_display]


def run_check(draft_path: Path, task_type: str) -> dict[str, Any]:
    if task_type in {"conceive", "review", "fact-gap"}:
        return {
            "applicable": False,
            "exitCode": 0,
            "status": "skipped",
            "blockingFindings": 0,
            "importantFindings": 0,
            "minorFindings": 0,
            "checkSkipReason": "该 taskType 的主要产物是构思、审阅或事实缺口处理记录，不是完整博客正文；本次以 dry-run 最终自审 C/I/M gate 为主。",
        }
    cmd = [
        "python3",
        str(CHECK_SCRIPT),
        str(draft_path),
        "--skill-root",
        str(SKILL_ROOT),
        "--manifest",
        str(MANIFEST),
        "--format",
        "json",
        "--pretty",
    ]
    result = subprocess.run(cmd, cwd=ROOT, text=True, capture_output=True)
    report = parse_check_report(result.stdout)
    return {
        "applicable": True,
        "exitCode": result.returncode,
        "status": report.get("status", "fail"),
        "blockingFindings": len(report.get("blockingFindings", [])),
        "importantFindings": 0,
        "minorFindings": len(report.get("warnings", [])),
        "checkSkipReason": "",
    }


def materialize(spec: RunSpec, timeout_s: int, force: bool) -> dict[str, Any]:
    out_dir = DRY_ROOT / spec.slug
    if out_dir.exists() and not force:
        print(f"skip existing {spec.slug}")
        return json.loads((out_dir / "result.json").read_text())
    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    prompt = build_prompt(spec)
    write_text(out_dir / "input.md", INPUTS[spec.task_type])
    write_text(out_dir / "prompt.md", prompt)
    started = now_iso()
    cmd_display: list[str] = []
    try:
        exit_code, stdout, stderr, cmd_display = run_cli(spec, prompt, out_dir, timeout_s)
    except subprocess.TimeoutExpired as exc:
        exit_code = 124
        stdout = (exc.stdout or "") if isinstance(exc.stdout, str) else ""
        stderr = ((exc.stderr or "") if isinstance(exc.stderr, str) else "") + f"\nTIMEOUT after {timeout_s}s"
        cmd_display = [f"{spec.cli} command timed out"]
    completed = now_iso()
    write_text(out_dir / "stdout.log", stdout)
    write_text(out_dir / "stderr.log", stderr)
    write_text(out_dir / "command.md", "\n".join(cmd_display))
    write_text(out_dir / "exit-code.txt", str(exit_code))

    sections, parse_issues = split_sections(stdout)
    write_text(out_dir / "draft.md", sections["draft"])
    write_text(out_dir / "review.md", sections["review"])
    write_text(out_dir / "revision.md", sections["revision"])
    check = run_check(out_dir / "draft.md", spec.task_type)
    review_counts = parse_review_counts(sections["review"], parse_issues)
    status = "pass" if (
        exit_code == 0
        and not parse_issues
        and review_counts["critical"] == 0
        and review_counts["important"] == 0
        and (not check["applicable"] or (check["status"] == "pass" and check["exitCode"] == 0 and check["blockingFindings"] == 0))
    ) else "fail"
    result_json = {
        "schemaVersion": 1,
        "taskSlug": spec.slug,
        "taskType": spec.task_type,
        "cli": spec.cli,
        "command": cmd_display[0] if cmd_display else "",
        "exitCode": exit_code,
        "status": status,
        "role": "matrix",
        "independentEntryOnly": spec.independent,
        "startedAt": started,
        "completedAt": completed,
        "usedEntryPoints": ["CLAUDE.md", "agent-skills/hansbug-writing-voice/SKILL.md"],
        "usedReferences": COMMON_REFERENCES[spec.task_type],
        "check": check,
        "review": review_counts,
        "parseIssues": parse_issues,
        "notes": "真实 CLI forward-test 证据；stdout/stderr 保留原始运行输出，draft/review/revision 仅从 stdout 标准三段切分，不做正文补写、关键词替换或静默修复。" if status == "pass" else "CLI 运行或 dry-run gate 未通过；该目录不能作为 pass 矩阵证据，需保留失败证据并重新真实运行。",
    }
    write_text(out_dir / "result.json", json.dumps(result_json, ensure_ascii=False, indent=2, sort_keys=True))
    print(f"{spec.slug}: exit={exit_code} status={status} check={check['status']} C={review_counts['critical']} I={review_counts['important']}")
    return result_json


def write_readme(results: list[dict[str, Any]]) -> None:
    matrix_results = [r for r in results if r.get("role") == "matrix"]
    rows = []
    for r in matrix_results:
        rows.append(f"| `{r['taskSlug']}` | `{r['taskType']}` | `{r['cli']}` | `{r['role']}` | `{r['status']}` | C={r['review']['critical']} / I={r['review']['important']} / M={r['review']['minor']} | check={r['check']['status']} |")
    failure_results = [r for r in results if r.get("role") == "failure-evidence"]
    if failure_results:
        failure_lines = [
            "本轮保留以下 `failure-evidence` 目录，均来自实现 review 后暴露的真实失败输出；对应正式 matrix slug 已复测通过：",
            "",
            "| failure slug | 失败原因 | fixed matrix slug |",
            "|---|---|---|",
        ]
        for r in failure_results:
            slug = str(r["taskSlug"])
            fixed = slug.replace("-failed-001", "-001")
            check_status = r.get("check", {}).get("status", "unknown")
            parse_issues = "；".join(r.get("parseIssues", [])) or "无 parse issue"
            failure_lines.append(f"| `{slug}` | check={check_status}; {parse_issues} | `{fixed}` |")
        failure_block = "\n".join(failure_lines)
    else:
        failure_block = "本轮没有额外 `failure-evidence` 目录。如果后续真实 CLI 运行失败，需要保留失败目录并在这里追加映射：`failure slug -> fixed matrix slug`。"
    text = f"""# PR-5 dry-run 基线与真实 CLI forward-test

本目录保存 HansBug 文风 Skill PR-5 的真实 CLI forward-test 证据。所有 matrix 目录均由新进程运行 `codex exec` 或 `claude -p` 生成，不由主 session 代写；主 session 只负责把原始 stdout/stderr 按标准标题切分为 `draft.md`、`review.md`、`revision.md` 并运行机械验收；runner 不得补写正文、替换关键词或把失败输出静默修成 pass。

## 证据协议

- `role: "matrix"`：正式矩阵结果。PR-5 要求 6 类任务 × 2 CLI = 12 个 matrix slug 全部 pass。
- `role: "failure-evidence"`：失败证据目录。如果某次真实 CLI 失败，不能删除，应保留为 `<task-type>-<cli>-failed-<index>`，并在本 README 映射到通过的复测 slug。
- 如果本 PR 没有失败证据目录，表示本轮 12 个 matrix slug 没有需要额外保留的失败链路；后续如果追加失败证据，必须在这里补表。
- 每个目录固定保留 `input.md`、`prompt.md`、`command.md`、`result.json`、`exit-code.txt`、`stdout.log`、`stderr.log`、`draft.md`、`review.md`、`revision.md`。
- `C/I/M` 以 `review.md` 和 `result.json.review` 为准；`result.json.review` 必须由 `review.md` 解析而来，matrix 结果必须 C=0、I=0。
- `check.applicable === false` 时，`result.json.check.checkSkipReason` 必须说明跳过原因；本轮构思、审阅、事实缺口任务不是完整博客正文，使用人工 C/I/M gate 为主。

## 矩阵结果

| slug | taskType | cli | role | status | review | check |
|---|---|---|---|---|---|---|
{chr(10).join(rows)}

## 反向压力测试映射

`fix-ai-cliche-*` 承接 issue #25 / 伞 PR #26 的“反向压力测试”：输入显式包含高口癖密度、低判断密度、无边界和 AI 腔正确废话。`rewrite-*` 则专门处理说明书腔 / 资料堆砌 / 官方文档重排，两者输入不同，不能互相抵扣。

## 独立入口测试

`conceive-codex-001` 设置 `independentEntryOnly: true`，prompt 只给 `CLAUDE.md + agent-skills/hansbug-writing-voice/SKILL.md` 入口，不携带 reviewer 反馈或预期答案。

## 失败样本保留

{failure_block}

## 复现入口

如需重新生成或补跑某个矩阵项，使用仓库内复现脚本：

```bash
python3 agent-skills/hansbug-writing-voice/scripts/run_forward_tests.py --timeout 420
python3 agent-skills/hansbug-writing-voice/scripts/run_forward_tests.py --only write-codex-001 --timeout 420 --force
```

该脚本会真实调用 `codex exec` / `claude -p`，并覆盖对应 matrix slug 的 `stdout.log`、`stderr.log`、`draft.md`、`review.md`、`revision.md` 与 `result.json`。它只按标题切分 stdout，不做正文补写、关键词替换或静默修复；如果后续遇到失败链路，不要覆盖失败目录，应按 PR body 约定另存为 `failure-evidence`。

说明：Codex CLI 的 `stderr.log` 可能包含工具读取配置时出现的 CSS 选择器字面量（例如 `#cnblogs_post_body`）；这不是旧博客正文 HTML。合规检查以不得提交旧博客完整正文 HTML 或 `.cache/hansbug-writing-voice/corpus/` 为准。

## 验收命令

```bash
python3 agent-skills/hansbug-writing-voice/scripts/lint_voice_references.py agent-skills/hansbug-writing-voice/references
python3 agent-skills/hansbug-writing-voice/scripts/check_hansbug_voice.py --help
npm run test
npm run check
npm run build
```
"""
    write_text(DRY_ROOT / "README.md", text)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", default="", help="comma separated slugs")
    parser.add_argument("--timeout", type=int, default=360)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args(argv)
    wanted = set(filter(None, args.only.split(",")))
    results: list[dict[str, Any]] = []
    for task in TASKS:
        for cli in CLIS:
            spec = RunSpec(task, cli)
            if wanted and spec.slug not in wanted:
                if (DRY_ROOT / spec.slug / "result.json").exists():
                    results.append(json.loads((DRY_ROOT / spec.slug / "result.json").read_text()))
                continue
            results.append(materialize(spec, args.timeout, args.force))
    # Load all existing matrix results if partial, and include extra failure-evidence
    # directories in README without letting them fail the formal 12-row matrix gate.
    all_results = []
    for task in TASKS:
        for cli in CLIS:
            path = DRY_ROOT / f"{task}-{cli}-001" / "result.json"
            if path.exists():
                all_results.append(json.loads(path.read_text()))
    failure_results = []
    for path in sorted(DRY_ROOT.glob("*-failed-*/result.json")):
        failure_results.append(json.loads(path.read_text()))
    write_readme(all_results + failure_results)
    return 0 if all(r.get("status") == "pass" for r in all_results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
