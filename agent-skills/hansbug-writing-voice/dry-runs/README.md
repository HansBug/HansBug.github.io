# PR-5 dry-run 基线与真实 CLI forward-test

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
| `conceive-codex-001` | `conceive` | `codex` | `matrix` | `pass` | C=0 / I=0 / M=1 | check=skipped |
| `conceive-claude-001` | `conceive` | `claude` | `matrix` | `pass` | C=0 / I=0 / M=3 | check=skipped |
| `write-codex-001` | `write` | `codex` | `matrix` | `pass` | C=0 / I=0 / M=1 | check=pass |
| `write-claude-001` | `write` | `claude` | `matrix` | `pass` | C=0 / I=0 / M=3 | check=pass |
| `rewrite-codex-001` | `rewrite` | `codex` | `matrix` | `pass` | C=0 / I=0 / M=0 | check=pass |
| `rewrite-claude-001` | `rewrite` | `claude` | `matrix` | `pass` | C=0 / I=0 / M=2 | check=pass |
| `review-codex-001` | `review` | `codex` | `matrix` | `pass` | C=0 / I=0 / M=1 | check=skipped |
| `review-claude-001` | `review` | `claude` | `matrix` | `pass` | C=0 / I=0 / M=2 | check=skipped |
| `fix-ai-cliche-codex-001` | `fix-ai-cliche` | `codex` | `matrix` | `pass` | C=0 / I=0 / M=1 | check=pass |
| `fix-ai-cliche-claude-001` | `fix-ai-cliche` | `claude` | `matrix` | `pass` | C=0 / I=0 / M=0 | check=pass |
| `fact-gap-codex-001` | `fact-gap` | `codex` | `matrix` | `pass` | C=0 / I=0 / M=1 | check=skipped |
| `fact-gap-claude-001` | `fact-gap` | `claude` | `matrix` | `pass` | C=0 / I=0 / M=2 | check=skipped |

## 反向压力测试映射

`fix-ai-cliche-*` 承接 issue #25 / 伞 PR #26 的“反向压力测试”：输入显式包含高口癖密度、低判断密度、无边界和 AI 腔正确废话。`rewrite-*` 则专门处理说明书腔 / 资料堆砌 / 官方文档重排，两者输入不同，不能互相抵扣。

## 独立入口测试

`conceive-codex-001` 设置 `independentEntryOnly: true`，prompt 只给 `CLAUDE.md + agent-skills/hansbug-writing-voice/SKILL.md` 入口，不携带 reviewer 反馈或预期答案。

## 失败样本保留

本轮保留以下 `failure-evidence` 目录，均来自实现 review 后暴露的真实失败输出；对应正式 matrix slug 已复测通过：

| failure slug | 失败原因 | fixed matrix slug |
|---|---|---|
| `fix-ai-cliche-claude-failed-001` | check=fail; 无 parse issue | `fix-ai-cliche-claude-001` |
| `rewrite-claude-failed-001` | check=fail; 无 parse issue | `rewrite-claude-001` |
| `write-claude-failed-001` | check=fail; 无 parse issue | `write-claude-001` |

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
