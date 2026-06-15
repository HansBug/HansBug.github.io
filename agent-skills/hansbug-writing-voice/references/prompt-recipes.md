# HansBug 文风 Prompt Recipes

本文件提供给 Codex / Claude 使用 HansBug 中文博客文风 Skill 时的固定任务配方。它的目的不是让每次输出都长一个样，而是让 agent 在构思、写作、改写、审稿和机械检查时，稳定地读取正确材料、暴露事实缺口、避免编造经历，并把输出落到可审阅的结构上。

所有 recipe 默认面向中文写作。代码、路径、JSON key、CLI 参数可以保持英文；人读说明、审稿意见和写作正文默认中文。

## 通用前置动作

每次使用本 Skill，先做这几件事：

1. 说明当前模式：构思、初稿写作、改写、风格增强、风格审稿、反向批评、检查 / CLI gate 中的哪一种。
2. 按 `SKILL.md` 只读取当前模式需要的 references，不要默认全量加载。
3. 如果任务涉及旧博客样本、manifest、摘录或抓取，先读 `corpus-policy.md`。
4. 明确样本版本：当前使用 `sample-manifest.json` 的 `schemaVersion: 2`，正向样本只允许 `participatesInProfile: true`。
5. 明确 sample ids：输出中列出实际使用的样本 id；没有样本对照时必须承认缺口。
6. 明确最后更新：在审稿或计划中写出本次使用的日期或 PR 阶段，例如 `最后更新：2026-06-15 / PR-3`。
7. 盘点事实缺口：把缺少作者真实经历、版本、环境、数据、链接的地方列出来。
8. 不编造经历：没有来源时，用占位请求或降格表述，不写成作者已经经历过。

## 构思

### 适用场景

用户只给了主题、问题或一组材料，需要先决定文章角度、读者、边界、核心判断和大纲。

### 必须读取

- `references/corpus-policy.md`（若涉及旧博客样本）
- `references/sample-manifest.json`
- `references/article-archetypes.md`
- `references/macro-logic.md`
- 必要时读取 `references/voice-profile.md`

### 样本版本 / sample ids / 最后更新

输出中必须包含：

```text
样本版本：sample-manifest schemaVersion 2
参考 sample ids：cnblogs-8701447, ...
最后更新：2026-06-15 / PR-3
```

sample ids 只列实际对照过的正向样本；不要把 holdout 或 negative 写进去。

### 输出格式

```text
文章类型：技术实践文 / 教程 / 复盘 / 测评 / 课程总结 / 其他
主问题：...
不解决：...
核心判断：...
读者应该先看：...
建议结构：
1. 缘起 / 破题：...
2. 问题定义 / 边界：...
3. 核心判断前置：...
4. 分维度分析：...
5. 反例 / 坑点：...
6. 总结盖章：...
事实缺口：...
```

### 事实缺口与不编造经历

如果用户没有提供经历，不要写“我曾经在某项目里”。应写“这里需要作者补一个真实项目现场，否则只能写成一般工程经验”。

## 初稿写作

### 适用场景

用户要求直接写一篇新文章，或给了足够事实材料让 agent 输出完整草稿。

### 必须读取

- `references/voice-profile.md`
- `references/article-archetypes.md`
- `references/macro-logic.md`
- `references/micro-patterns.md`
- 必要时读取 `references/anti-patterns.md`

### 样本版本 / sample ids / 最后更新

在写作前的简短说明中列出样本版本、sample ids 和最后更新；正文里不必硬塞这些元信息，除非文章本身需要说明写作依据。

### 输出格式

先给一段“写作前确认”，再给正文：

```text
写作前确认：
- 样本版本：...
- 参考 sample ids：...
- 本文解决：...
- 本文不解决：...
- 事实缺口：...

--- 正文 ---
```

正文必须在前三段内进入主问题和核心判断。技术实践文如果适合三段式 quick-start，应按 `CLAUDE.md / AGENTS.md` 的固定模板写。

### 事实缺口与不编造经历

缺少事实时，可以写“【需要作者补充：这里最好放一个真实踩坑经历】”，不能自动补会议、项目、课程现场。

## 改写

### 适用场景

用户已有草稿，希望在不改变事实和含义的前提下更像 HansBug。

### 必须读取

- `references/voice-profile.md`
- `references/micro-patterns.md`
- `references/anti-patterns.md`
- `references/review-rubric.md`

### 样本版本 / sample ids / 最后更新

改写说明中列出参考样本和最后更新；如果没有样本对照，只能做一般中文技术文润色，不能声称已完成 HansBug 文风贴合。

### 输出格式

```text
改写原则：
- 保留事实：...
- 调整结构：...
- 加强判断：...
- 不碰内容：...

改写稿：...

改动说明：
- ...
```

### 事实缺口与不编造经历

原文没有的经历不要新增。原文含糊的第一人称经历，应标记“需作者确认”，不要越写越真。

## 风格增强

### 适用场景

文章结构基本成立，只需要增加作者判断、段落落锤、概念拆分、读者引导和适度松弛感。

### 必须读取

- `references/voice-profile.md`
- `references/micro-patterns.md`
- `references/macro-logic.md`

### 样本版本 / sample ids / 最后更新

列出本次对照的正向样本 id；如果只增强局部段落，也要说明没有做全文审稿。

### 输出格式

```text
增强目标：判断前置 / 概念拆分 / 工程取舍 / 结尾盖章 / 读者引导
原段落问题：...
增强后文本：...
为什么这样改：...
```

### 事实缺口与不编造经历

风格增强不能增加事实强度。可以把“可能”写得更清楚，不能把“可能”写成“我亲历”。

## 风格审稿

### 适用场景

用户要求检查文章像不像 HansBug、是否有 AI 腔、是否符合 `CLAUDE.md / AGENTS.md` 和本 Skill。

### 必须读取

- `references/voice-profile.md`
- `references/anti-patterns.md`
- `references/review-rubric.md`
- 必要时读取 `references/macro-logic.md`

### 样本版本 / sample ids / 最后更新

审稿意见开头必须写：

```text
样本版本：sample-manifest schemaVersion 2
对照 sample ids：...
最后更新：2026-06-15 / PR-3
```

### 输出格式

按 C/I/M 输出：

```text
结论：C=0 / I=1 / M=2
C 级问题：...
I 级问题：...
M 级建议：...
建议修改顺序：...
```

### 事实缺口与不编造经历

把无来源第一人称经历单独列出。审稿时不要因为段落“很有味道”就放过事实风险。

## 反向批评

### 适用场景

需要轻度对抗性 review，专门找假模仿、空泛判断、样本误用、事实编造和机械 gate 漏洞。

### 必须读取

- `references/anti-patterns.md`
- `references/review-rubric.md`
- `references/sample-manifest.json`
- 必要时读取 `references/micro-patterns.md`

### 样本版本 / sample ids / 最后更新

必须写明检查了哪些 sample ids，尤其要确认没有使用 holdout / negative 做正向证据。

### 输出格式

```text
对抗性结论：...
最像假模仿的地方：...
最可能编造事实的地方：...
最可能误用样本的地方：...
至少一个可复现反例：...
C/I/M 列表：...
```

### 事实缺口与不编造经历

优先攻击“写得像真的但没有来源”的段落。宁可要求作者补证据，也不要为了顺滑放行。

## 检查 / CLI gate

### 适用场景

需要确定性粗筛 Markdown 草稿，或需要在 PR 中证明明显问题会被拦住。

### 必须读取

- `references/corpus-policy.md`
- `references/sample-manifest.json`
- `references/review-rubric.md`
- `scripts/check_hansbug_voice.py`
- 必要时运行 `scripts/lint_voice_references.py`

### 样本版本 / sample ids / 最后更新

CLI 输出里的 `matchedSamples` 只允许来自 `participatesInProfile: true` 的样本。人工报告中仍需写明本次 manifest 路径和最后更新。

### 输出格式

机器消费统一使用 JSON：

```bash
python3 agent-skills/hansbug-writing-voice/scripts/check_hansbug_voice.py \
  src/content/blog/example.md \
  --skill-root agent-skills/hansbug-writing-voice \
  --manifest agent-skills/hansbug-writing-voice/references/sample-manifest.json \
  --format json \
  --pretty
```

人读摘要可以使用：

```bash
python3 agent-skills/hansbug-writing-voice/scripts/check_hansbug_voice.py \
  src/content/blog/example.md \
  --skill-root agent-skills/hansbug-writing-voice \
  --manifest agent-skills/hansbug-writing-voice/references/sample-manifest.json \
  --format text
```

### 事实缺口与不编造经历

如果 CLI 命中 `possibleUnsupportedExperienceClaims`，先处理事实风险，再谈文风润色。不要让漂亮的语气盖过不可靠的事实。
