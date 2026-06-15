# HansBug 文风 Skill PR-6 最终验收报告

关联：issue #25、伞 PR #26、PR #34。

本报告是 PR-6 的总验收记录，目标不是继续扩写文风画像，而是确认 PR-0..PR-5 已经形成“样本 -> 画像 -> 写作流程 -> 机械粗筛 -> agent 审稿 -> 真实 CLI forward-test”的闭环，并补上 PR-6 自身的最终真实 CLI smoke、机械测试、CI 与上游同步证据。

## 上游与子 PR 对账

| 阶段 | PR | 状态 | 本报告复核点 |
|---|---:|---|---|
| PR-0 | #27 | 已合入 | Skill 骨架、`SKILL.md` frontmatter、`corpus-policy.md`、`.cache/hansbug-writing-voice/` ignore、摘录 lint。 |
| PR-1 | #29 | 已合入 | `sample-manifest.json`、正文抓取脚本、机械特征提取、`derived/voice-features.json`。 |
| PR-2 | #30 | 已合入 | `voice-profile.md`、`article-archetypes.md`、`micro-patterns.md`、`macro-logic.md`、`anti-patterns.md`。 |
| PR-3 | #31 | 已合入 | `review-rubric.md`、`prompt-recipes.md`、`check_hansbug_voice.py` 与对抗 fixtures。 |
| PR-4 | #32 | 已合入 | `CLAUDE.md / AGENTS.md` 强入口、单一信源和 PR-4 专项测试。 |
| PR-5 | #33 | 已合入 | 12 个真实 CLI matrix 全部 pass，3 个 `*-failed-001` failure-evidence 保留并映射。 |
| PR-6 | #34 | 当前 PR | 总验收报告、PR-6 专项测试、最终真实 CLI smoke、issue #25 / 伞 PR #26 同步。 |

## 关键产物存在性

- Skill 入口：`agent-skills/hansbug-writing-voice/SKILL.md`
- 强入口：`CLAUDE.md` 中 `### HansBug 文风 Skill 强入口`
- 软链：`AGENTS.md -> CLAUDE.md`
- references：`corpus-policy.md`、`sample-manifest.json`、`voice-profile.md`、`article-archetypes.md`、`micro-patterns.md`、`macro-logic.md`、`anti-patterns.md`、`review-rubric.md`、`prompt-recipes.md`、`derived/voice-features.json`
- scripts：`lint_voice_references.py`、`fetch_voice_corpus.py`、`extract_voice_features.py`、`check_hansbug_voice.py`、`run_forward_tests.py`
- PR-5 dry-runs：12 个正式 matrix slug + `write-claude-failed-001` / `rewrite-claude-failed-001` / `fix-ai-cliche-claude-failed-001`
- PR-6 acceptance-runs：`pr6-codex-final-smoke` / `pr6-claude-final-smoke`

## PR-5 matrix 复核摘要

PR-6 专项测试会机械读取 12 个正式 matrix 的 `result.json`，检查：

- `status === "pass"`
- `parseIssues === []`
- `review.critical === 0`
- `review.important === 0`
- 写作类 matrix 的 `check.status === "pass"`
- 写作类 matrix 的 `check.blockingFindings === 0`

3 个失败证据目录继续保留，不删除、不覆盖：

| failure slug | 对应复测 slug | 当前策略 |
|---|---|---|
| `write-claude-failed-001` | `write-claude-001` | 保留失败原始证据，正式 matrix 已复测通过。 |
| `rewrite-claude-failed-001` | `rewrite-claude-001` | 保留失败原始证据，正式 matrix 已复测通过。 |
| `fix-ai-cliche-claude-failed-001` | `fix-ai-cliche-claude-001` | 保留失败原始证据，正式 matrix 已复测通过。 |

## PR-6 真实 CLI smoke 证据

PR-6 新增两条最终真实 smoke，不复用 PR-5 结果冒充。证据目录为 `agent-skills/hansbug-writing-voice/acceptance-runs/`。

| slug | CLI | taskType | exit | status | review | 证据目录 |
|---|---|---|---:|---|---|---|
| `pr6-codex-final-smoke` | `codex exec` | `review` | 0 | pass | C=0 / I=0 / M=0 | `acceptance-runs/pr6-codex-final-smoke/` |
| `pr6-claude-final-smoke` | `claude -p` | `write` | 0 | pass | C=0 / I=0 / M=2 | `acceptance-runs/pr6-claude-final-smoke/` |

两条 smoke 均包含固定证据文件：`prompt.md`、`command.md`、`stdout.log`、`stderr.log`、`exit-code.txt`、`result.json`。

### `pr6-codex-final-smoke`

命令：

```bash
codex exec --dangerously-bypass-approvals-and-sandbox "$(cat agent-skills/hansbug-writing-voice/acceptance-runs/pr6-codex-final-smoke/prompt.md)"
```

通过点：

- 输出显式提到 `CLAUDE.md` 与 `agent-skills/hansbug-writing-voice/SKILL.md`。
- 按“审阅”模式读取 `references/corpus-policy.md`、`references/voice-profile.md`、`references/anti-patterns.md`、`references/review-rubric.md`。
- 对 AI 腔候选稿指出 `AI 式正确废话`、缺少核心判断、缺少边界说明等阻断问题。
- 最终自审：`C=0 / I=0 / M=0`。

### `pr6-claude-final-smoke`

命令：

```bash
claude -p --dangerously-skip-permissions "$(cat agent-skills/hansbug-writing-voice/acceptance-runs/pr6-claude-final-smoke/prompt.md)"
```

通过点：

- 输出显式提到 `CLAUDE.md` 与 `agent-skills/hansbug-writing-voice/SKILL.md`。
- 按“写作”模式实际读取并列出 `references/corpus-policy.md`、`references/voice-profile.md`、`references/article-archetypes.md`、`references/macro-logic.md`、`references/micro-patterns.md`、`references/prompt-recipes.md`。
- 明确样本对照 `cnblogs-8701447` 与 `cnblogs-14711869`。
- 明确没有作者事实材料时不能编造项目、会议、课程、上线现场。
- 最终自审：`C=0 / I=0 / M=2`，M 不阻塞。

## C/I 失败-修复-复测记录

PR-6 最终两条真实 CLI smoke 没有出现 C/I 失败，因此没有需要按“失败 -> 修复 -> 复测”保留的新失败目录。

| smoke | 原始 prompt | 命令 | 退出码 | stdout/stderr 片段 | 修法 | 复测命令 | 复测产物 |
|---|---|---|---:|---|---|---|---|
| `pr6-codex-final-smoke` | `acceptance-runs/pr6-codex-final-smoke/prompt.md` | `command.md` | 0 | `stdout.log` 含 `AI 式正确废话`、`缺少边界`、`最终自审：C=0 / I=0 / M=0` | 无 C/I 修复 | 不需要 | `result.json` status=pass |
| `pr6-claude-final-smoke` | `acceptance-runs/pr6-claude-final-smoke/prompt.md` | `command.md` | 0 | `stdout.log` 含两条入口路径、六个写作 references、样本 ids、`最终自审：C=0 / I=0 / M=2` | 无 C/I 修复 | 不需要 | `result.json` status=pass |

说明：`pr6-claude-final-smoke` 的 prompt 在形成最终报告前被主 session 收紧过一次，原因是第一版输出虽然 C/I=0，但“骨架阶段只实读部分 references”的口径容易给最终入口验收留下歧义。该调整属于实现期 M 级稳健性优化，不是 C/I 失败复测链路；最终保留的证据以上表目录为准。

## 缓存与旧文全文边界

- `.gitignore` 含 `.cache/hansbug-writing-voice/`。
- PR-6 未提交 `.cache/hansbug-writing-voice/corpus/`。
- PR-6 未提交旧博客完整正文 HTML。
- 本地 ignore 证明命令：

```bash
mkdir -p .cache/hansbug-writing-voice/corpus
touch .cache/hansbug-writing-voice/corpus/.pr6-ignore-check
git status --ignored -- .cache/hansbug-writing-voice/
git status --ignored=matching --short -- .cache/hansbug-writing-voice/
git check-ignore -v .cache/hansbug-writing-voice/corpus/.pr6-ignore-check
rm -rf .cache/hansbug-writing-voice/corpus
```

对应输出：

```text
!! .cache/hansbug-writing-voice/
.gitignore:7:.cache/hansbug-writing-voice/  .cache/hansbug-writing-voice/corpus/.pr6-ignore-check
```

## 本地验证命令

PR-6 开发阶段执行 / 将由 CI 覆盖的命令：

```bash
python3 agent-skills/hansbug-writing-voice/scripts/lint_voice_references.py agent-skills/hansbug-writing-voice/references
python3 agent-skills/hansbug-writing-voice/scripts/fetch_voice_corpus.py --dry-run --limit 1
python3 agent-skills/hansbug-writing-voice/scripts/extract_voice_features.py --allow-catalog-summary
python3 agent-skills/hansbug-writing-voice/scripts/check_hansbug_voice.py --help
python3 agent-skills/hansbug-writing-voice/scripts/run_forward_tests.py --only __none__ --timeout 1
npm run test
npm run check
npm run build
```

## CI 证据

- PR-6 自身最近一次已完成 GitHub Actions run URL（实现提交 be93c7c 后）：https://github.com/HansBug/HansBug.github.io/actions/runs/27570040988
- main 上 PR-5 合入后最近一次成功 run URL：https://github.com/HansBug/HansBug.github.io/actions/runs/27568146702

说明：本报告提交后，PR #34 会触发新的 PR CI；最终合入前以 PR checks 面板和 PR comment 中记录的最新 run 为准。本报告保留上述 URL，确保报告自身也有可追溯的 CI 基线。

## issue / 伞 PR 同步

- issue #25 PR-6 进度同步 comment：https://github.com/HansBug/HansBug.github.io/issues/25#issuecomment-4711395657
- 伞 PR #26 PR-6 进度同步 comment：https://github.com/HansBug/HansBug.github.io/pull/26#issuecomment-4711395670

PR-6 合入 main 后，需要继续：

1. 在 issue #25 comment 汇报 PR-6 已合入；若伞 PR 最终验收也完成，再按用户指示关闭 issue。
2. 在伞 PR #26 body/comment 同步 PR-6 已合入。
3. 继续对伞 PR #26 做最终 review 与真实 `codex exec` / `claude -p` 调用验收，直到伞 PR ready。

## 结论

截至本报告，PR-0..PR-5 的关键产物、PR-5 真实 CLI matrix、PR-6 最终真实 CLI smoke、cache 边界、上游同步链路均已形成可对账证据。

当前总验收结论：**C=0 / I=0，PR-6 可以进入实现 review 与 CI 收口阶段。**
