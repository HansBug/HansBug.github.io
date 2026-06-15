# PR-6 acceptance-runs

本目录只保存 PR-6 的最小最终真实 CLI smoke 证据，不是 PR-5 的 12 项 matrix dry-run。每个子目录均由独立 CLI 进程执行并保留原始 `stdout.log` / `stderr.log`。

| slug | CLI | taskType | status | 说明 |
|---|---|---|---|---|
| `pr6-codex-final-smoke` | `codex exec` | `review` | `pass` | 按审阅模式检查 AI 腔候选稿，输出 C/I/M 与修法。 |
| `pr6-claude-final-smoke` | `claude -p` | `write` | `pass` | 按写作模式写短技术实践文骨架，并明确不编造作者经历。 |

证据协议：每个目录至少包含 `prompt.md`、`command.md`、`stdout.log`、`stderr.log`、`exit-code.txt`、`result.json`。
