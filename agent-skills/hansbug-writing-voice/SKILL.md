---
name: hansbug-writing-voice
description: 围绕 HansBug 中文技术博客文风，辅助构思、写作、改写、审阅和机械检查博客正文。用于 Codex 或 Claude 需要撰写、改写、审阅、校验 src/content/blog/ 下中文文章，或维护本仓库内 HansBug 文风工作流的场景。
---

# HansBug 中文博客文风 Skill

如果本仓库内的 Skill 不能被自动发现，先手动读取本文件，再按下方任务模式表只读取当前任务需要的 references 参考资料。不要假设 PR-0 阶段已经存在所有未来 reference 参考资料；标注为 `后续 PR 占位` 的路径只是后续 PR 的导航契约，不是 missing-file error，缺失时不要中止任务。

## 适用边界

这个 Skill 只面向 HansBug 中文技术博客正文写作。它的目标不是泛化到英文写作，也不是把任何页面文案都改成博客腔；后续 agent 在处理 `src/content/blog/` 文章的构思、写作、改写、审阅、检查时，才应优先使用它。

使用本 Skill 时，要在不整篇复制旧文的前提下，让中文技术文章更接近 HansBug 本人已经稳定形成的表达方式、判断结构和论述节奏。若仓库根目录的 `CLAUDE.md / AGENTS.md` 给出了更严格、更具体的写作规则，优先遵守根目录规则。

不要用本 Skill 做这些事：

- 抓取或提交旧博客完整正文；
- 绕过来源站点 ToS、robots 或版权边界；
- 实现 citation、BibTeX、CSL 或站点渲染功能；
- 在用户没有给出事实依据时，替作者编造经历、项目现场、课程现场或第一手判断；
- 把中文文风约束强行套到英文写作任务上。

## 任务模式

| 模式 | 何时使用 | 读取这些 references / scripts |
|---|---|---|
| `构思` | 规划新文章，决定角度、读者、结构、边界和核心判断。 | `references/corpus-policy.md`; `references/sample-manifest.json`; `references/article-archetypes.md`（后续 PR 占位）; `references/macro-logic.md`（后续 PR 占位）; `references/prompt-recipes.md`（后续 PR 占位） |
| `写作` | 写一篇新文章或补一大段新章节。 | `references/corpus-policy.md`; `references/voice-profile.md`（后续 PR 占位）; `references/article-archetypes.md`（后续 PR 占位）; `references/macro-logic.md`（后续 PR 占位）; `references/micro-patterns.md`（后续 PR 占位）; `references/prompt-recipes.md`（后续 PR 占位） |
| `改写` | 在保持事实和含义稳定的前提下，把已有文本改得更接近 HansBug 文风。 | `references/corpus-policy.md`; `references/voice-profile.md`（后续 PR 占位）; `references/micro-patterns.md`（后续 PR 占位）; `references/anti-patterns.md`（后续 PR 占位）; `references/review-rubric.md`（后续 PR 占位） |
| `审阅` | 审查草稿或 PR 的文风贴合度、表达清晰度和结构合理性。 | `references/corpus-policy.md`; `references/voice-profile.md`（后续 PR 占位）; `references/anti-patterns.md`（后续 PR 占位）; `references/review-rubric.md`（后续 PR 占位） |
| `检查` | 运行确定性 gate，或检查 reference / 摘录 / manifest / 派生特征是否合规。 | `references/corpus-policy.md`; `references/sample-manifest.json`; `references/derived/voice-features.json`; `scripts/lint_voice_references.py`; `scripts/fetch_voice_corpus.py`; `scripts/extract_voice_features.py`; `references/review-rubric.md`（后续 PR 占位）; `scripts/check_hansbug_voice.py`（后续 PR 占位） |

## 工作流

1. 先检查仓库根目录的 `CLAUDE.md / AGENTS.md`；当它们更严格或更具体时，以它们为准。
2. 判断当前任务属于上表中的一个或多个模式。
3. 读取 reference 参考资料之前，先说明你选择了哪些模式、准备读取哪些文件或脚本。
4. 只要涉及旧博客材料、样本、manifest、摘录或抓取产物，必须先读取 `references/corpus-policy.md`。
5. 只加载当前模式需要、且在当前 PR 阶段实际存在的 references；不要为了“更像”而无脑全量加载。
6. 如果某个后续 PR 占位 reference 参考资料还不存在，明确说明当前阶段缺少该 reference，然后用现有规则继续；不要臆造它的内容。
7. 写作或改写时，保持文章事实、主题和用户意图不乱跑；只在有助于文风贴合的地方调整结构、重心、语气和措辞。
8. 审阅时，把文风问题落到可执行修改或具体例子上；不要只写“感觉不像”“味道不够”这种空话。
9. 检查时，先跑确定性脚本，再补人工文风判断。

## PR-0 / PR-1 可用命令

检查已提交 reference 参考资料里的摘录是否满足来源、用途、JSON 结构和长度约束（单条 `120` 个中文字、同一来源累计 `300` 个中文字）：

```bash
python3 agent-skills/hansbug-writing-voice/scripts/lint_voice_references.py agent-skills/hansbug-writing-voice/references
```

PR-0 的 lint gate 只保护摘录元数据和长度上限。PR-1 额外提供样本 manifest、cache-only 正文抓取脚本和机械特征提取脚本；文风 rubric、多轮真实 CLI forward-test 和最终强入口仍属于后续 PR。

查看 PR-1 样本抓取计划，不发请求、不写 cache：

```bash
python3 agent-skills/hansbug-writing-voice/scripts/fetch_voice_corpus.py --dry-run --limit 3
```

抽取机械特征时，默认只向 stdout 打印 JSON；只有显式 `--write-derived` 才会覆盖 `references/derived/voice-features.json`。如果本地没有 ignored cache，可以加 `--allow-catalog-summary` 生成 smoke 级特征，但正式画像归纳仍应优先使用 `.cache/hansbug-writing-voice/corpus/` 里的正文。

```bash
python3 agent-skills/hansbug-writing-voice/scripts/extract_voice_features.py --allow-catalog-summary
python3 agent-skills/hansbug-writing-voice/scripts/extract_voice_features.py --allow-catalog-summary --write-derived
```

PR-1 的派生特征只做段落长度、句长、标题模式、高频 n-gram、转场词粗统计等机械统计，不等价于文风画像。后续写作或审阅时，可以把 `references/sample-manifest.json` 和 `references/derived/voice-features.json` 当作“样本入口和粗粒度仪表盘”，但不要拿它们替代 PR-2 之后的正式文风画像。

PR-0 / PR-1 的 references 参考资料默认不包含真实旧文全文，所以仓库内 references 目录应当默认通过该 lint gate。后续 PR 如果添加样本 manifest 或已提交摘录，仍必须对非空 references 继续运行同一个命令。
