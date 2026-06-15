# 旧文语料使用策略

本策略约束 HansBug 中文博客文风 Skill 如何使用旧博客材料。凡是后续 crawler、manifest、短摘录、文风画像或审稿 rubric 需要使用 `https://www.cnblogs.com/HansBug/` 的内容，都必须先遵守这里的边界。

## 硬边界

- 旧文原始 HTML、Markdown、纯文本和抓取输出，只允许保存在 `.cache/hansbug-writing-voice/corpus/`。
- 不得把旧博客完整正文提交到本仓库。
- 只提交服务于文风分析所必需的短摘录。
- 单条摘录最多 `120` 个中文字。
- 同一来源文章在仓库内累计摘录最多 `300` 个中文字。
- 每条已提交摘录必须包含来源字段：`sourceUrl` 或 `url`。
- 每条已提交摘录必须包含用途字段：`purpose` 或 `useFor`。
- 如果来源站规则与本仓库策略冲突，按更严格的一方执行。

## 抓取可行性审计

PR-1 或后续 PR 在新增、刷新旧文抓取产物之前，必须把审计结果记录在 PR description，或记录到后续机器可读的审计文件中：

| 字段 | 必填内容 |
|---|---|
| `source` | 使用的旧博客精确来源 URL 或索引页。 |
| `tosCheck` | ToS / 站点策略检查结果，包含日期和结论。 |
| `robotsCheck` | `robots.txt` 检查结果，包含日期、相关路径规则和结论。 |
| `fetchFeasibility` | 自动抓取是允许、需要限速、不允许，还是结论不清。 |
| `fallbackPlan` | 若自动抓取不允许或结论不清，退回只使用手动短摘录。 |

如果 ToS、robots 或网络行为不清楚，不要猜。退回到手动摘录：只截取完成某个具体文风分析目的所必需的最短片段，并同时写清 `sourceUrl` 和 `purpose` / `useFor`。

## 已提交摘录格式

Markdown reference 可以使用带 `hansbug-voice-excerpt` 标记的 fenced JSON block：

````markdown
```json hansbug-voice-excerpt
{
  "sourceUrl": "https://www.cnblogs.com/HansBug/p/example.html",
  "purpose": "macro-logic",
  "text": "这里放不超过一百二十个中文字的必要短摘录。"
}
```
````

JSON manifest 可以把摘录对象放在 `excerpts` 数组里；数组里的每一项都必须是 JSON object。同一套必填字段和长度上限仍然生效。

`purpose` / `useFor` 的值要能说明这段摘录为什么需要被提交，例如：

- `macro-logic`
- `micro-pattern`
- `tone`
- `article-archetype`
- `negative-example`
- `review-rubric`

## PR-1 脚本边界

PR-1 的 `fetch_voice_corpus.py` 只负责把 manifest 中的旧博客正文抓到本地 ignored cache，默认目录是 `.cache/hansbug-writing-voice/corpus/`。它必须支持 `--dry-run`、`--limit`、`--delay`、`--timeout`、`--max-retries`、`--user-agent` 等参数，并在状态码异常、正文 selector 未命中、正文过短、manifest 缺字段或网络失败时非零退出。

PR-1 的 `extract_voice_features.py` 只负责从 cache 或显式允许的 catalog 摘要里生成机械统计。它默认只打印 JSON；只有传入 `--write-derived` 时才可以写入 `references/derived/voice-features.json`。这些派生特征不能被描述成“已经理解 HansBug 文风”，只能作为后续画像归纳前的粗统计输入。

## 验证方式

提交任何 reference 变更前，先运行：

```bash
python3 agent-skills/hansbug-writing-voice/scripts/lint_voice_references.py agent-skills/hansbug-writing-voice/references
```

当摘录过长、缺少 `sourceUrl` / `url`、缺少 `purpose` / `useFor`，`excerpts` 数组项不是 JSON object，或文件不是合法 UTF-8 / JSON 时，lint gate 必须非零退出，并给出具体文件路径和字段 / 上限原因。当前长度 gate 按中文字计数；如果短摘录里必须保留英文术语，也要保持同等克制，不要借“英文不计数”塞进大段原文。
