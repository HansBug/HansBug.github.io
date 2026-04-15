---
title: "从战壕到帅案——关于 AI 在写作与编码中的真实作用、产能重估与劳心时代"
description: "把“AI 提高效率”这种已经说烂的话，翻成可复核的 GitHub 统计、发展时间线和真实工作体验之后，结论其实比口号更激烈。"
pubDate: 2026-04-14
updatedDate: 2026-04-15
tags:
  - LLM 应用
  - 工程效率
  - 评测方法
  - 知识管理
  - 开源维护
difficulty: "实践"
excerpt: "如果只是喊一句“AI 让人更高效”，那未免太轻了。真正被改写的不是几行代码的生成速度，而是工作单元、认知瓶颈、责任边界，以及人看待自己价值的方式。"
series: "AI 时代的工程方法"
draft: false
pinned: false
---

最近这段时间，笔者越来越强烈地意识到一件事：AI在自己的日常工作流程里开始起到越来越重要的作用，而且已经远远不只是一个能帮你写两行docstring或者单元测试或者小函数的玩具。若真要只是那样的话，那说实话，基本已经落后现实半个时代了。为此我觉得，有必要单独就AI这件事拿出来好好说说自己的现状与理解。

然而，问题恰恰也出在这里。今天关于 AI coding 的讨论，太容易滑向两边：一边是“AI 真香”“效率起飞”这种一听就知道没什么信息量的水文；另一边是“工具无罪”“拥抱变化”“保持理性”这种句句正确、却句句无用的空话。前者太浮，后者太轻。说白了，很多文章之所以没有说服力，不是因为它们说错了，而是因为它们没有真的把问题立起来，结果把一个已经剧烈改写现实的东西，写得像一段平平无奇的新闻摘要。

所以这篇文章，笔者更想按一种接近 empirical study 的方式来写：先把问题提出来，再一层一层往下答，而不是一上来就把后文的结论拍在桌上。具体来说，本文至少想回答下面几组问题：

> * `RQ1`：如果把时间线、分期和可复核样本都摆上来，今天的产能变化到底有多大？
> * `RQ2`：AI Coding 到底把今天的工作模式和流程改写成了什么？
> * `RQ3`：这种变化到底有没有把人变轻松？
> * `RQ4`：身为开发者，以及自己在这条链路里真正不可替代的部分？
> * `RQ5`：今天到底应该怎样看待 AI 产物的责任边界？

也正因为如此，我会以我自己为研究对象，拿我现在和过去的真实的Git行为、GitHub 统计，并且进行详实的时间线整理和样本清洗。做这些，并不是为了把文章写成一份“看我最近产能多高”的自我展示报告，而是为了给这些问题提供一个足够具体、足够贴地的回答。笔者确实去翻了自己的 GitHub 记录，也确实做了统计。公开部分只用 `HansBug` 这边已经开放的信息做详细表格、详细链接和细粒度拆解；另一部分未开源工作，则只保留匿名聚合结果，不挂仓库名，不挂链接，也不写任何可以逆推出具体项目的细节。该公开的地方公开到底，不该公开的地方到此为止，这不是姿态问题，而是边界问题。

还有一点也必须先说清楚：这篇文章的主体分析，按“人”做，不按“单个 repo”做——也就是同一个人在同一个时间窗内到底产出了总计多少内容。至于原因，后面的RQ Answer阶段会给出回答——这件事也恰恰是AI Coding带来的非常核心的改变。

## LLM、Agent 与 Coding Agent 的前世今生

如果今天要严肃讨论 AI coding 给工程工作、写作工作和人的脑力分配带来的变化，那么有一条背景线是绕不过去的：我们今天所说的 `AI`，并不是一个单一技术对象，而是一串彼此相连、但层级并不相同的能力演化。`ChatGPT` 爆火[@openai-chatgpt]、`GPT-4` 发布[@openai-gpt4]、`SWE-bench` 提出[@swe-bench]、`Codex` 研究预览[@openai-codex-preview]，以及 `Claude Code` 团队级使用经验公开[@anthropic-claude-code]，都可以被泛泛地归到“AI 来了”这四个字里；但如果不先把这条技术史拆开，后面关于分期、产能和工作流改写的讨论就很容易失焦。原因并不复杂：这些节点对应的，不是同一层级的能力变化，也不是同一层级的工作单元。

从背景上看，今天这套现实至少建立在四条相互叠加的线上。第一条，是生成式大模型本身的演化。这里如果只从 `2022-11` 的 `ChatGPT` 开始看，其实已经太晚了。更早的技术起点至少可以追到 `2017-06`，也就是 Vaswani 等人提出 `Transformer` 架构的时候[@transformer]；真正把“只靠 scale 和预训练就能把语言能力推上去”这件事做成行业共识的，则是 `2020-05` Brown 等人的 `GPT-3`[@gpt3]。紧接着，`2022-03` Ouyang 等人的 `InstructGPT` 把“会续写”推向“会按指令做事”[@instructgpt]，同月 Hoffmann 等人的 `Chinchilla` 把 compute-optimal scaling 摆上台面[@chinchilla]，`2022-04` Chowdhery 等人的 `PaLM` 则把规模化推理与代码能力一起抬高[@palm]。到了 `2022-11`，OpenAI 以产品形态推出 `ChatGPT`[@openai-chatgpt]，而 `2023-02` Touvron 等人的 `LLaMA` 又把高性能开源基座模型拉回了研究共同体[@llama]；接下来 `2023-03` 的 `GPT-4`[@openai-gpt4]、`2024-05` 的 `GPT-4o`[@openai-gpt4o] 与 `2024-09` 的 `o1-preview`[@openai-o1]，则分别把多模态、成本 / 速度与 reasoning 路线继续往前推进。与这条主线并行的，是 Zhao 等人的 `A Survey of Large Language Models`：它初次发表于 `2023-03`，但并不是停留在 `2023` 年的定稿综述，而是一篇截至 `2026-03` 仍在持续更新、当前 arXiv 已经到 `v19` 的 living survey[@llm-survey]。因此，如果只用“一篇 survey”来带过 LLM 的来路，信息实际上是远远不够的。

第二条，是从 LLM 到 agent 的方法论演化。这里的关键问题不再是“模型能不能回答”，而是“模型能不能围绕目标持续做事”。这个转折在文献里并不是凭空出现的。`2022-10`，Yao 等人提出 `ReAct`，把 reasoning 与 acting 首次显式耦合起来[@react]；`2023-02`，Schick 等人提出 `Toolformer`，把工具调用从 prompt 工程层面推向了模型学习层面[@toolformer]；`2023-03`，Shinn 等人的 `Reflexion` 又把反思式反馈引入了 agent 回路[@reflexion]；`2023-05`，Wang 等人的 `Voyager` 则把长程任务与持续探索推进到了更完整的 agent 范式[@voyager]。到了 `2023-08` 与 `2023-09`，Lei Wang 等人与 Zhiheng Xi 等人的两篇 agent 综述，才把记忆、规划、工具使用、环境交互、多 agent 协作这些部件系统性地整理成相对稳定的框架[@autonomous-agent-survey; @agent-rise-survey]。也就是说，agent 这一条线的重点，不是“模型又涨了一点 benchmark”，而是问题的讨论单位从单次回答转向了持续行动。

第三条，是 software engineering agents 自己的形成过程。软件工程并不是 LLM / agent 研究的唯一落点，但它毫无疑问是最先形成稳定 benchmark、稳定任务接口和稳定产品叙事的那条线。`2023-10`，Jimenez 等人的 `SWE-bench` 把真实 GitHub issue resolution 变成了公开 benchmark[@swe-bench]；`2024-05`，John Yang 等人的 `SWE-agent` 则把 repo 浏览、命令执行、补丁生成与测试反馈串成了完整链路[@swe-agent]；`2024-07`，Xia 等人的 `Agentless` 又专门从“去掉复杂 agent 编排后，模型究竟还能做多少工程任务”这个角度做了反向解构[@agentless]。同一时期，市场层面也出现了强烈的产品信号，例如 `2024-03` Cognition 公开 `Devin`[@cognition-devin]。到了 `2024-09`，Liu 等人的《Large Language Model-Based Agents for Software Engineering: A Survey》才把 software engineering agents 的研究范围，从零散 demo 明确抬到了 repo-scale reasoning、tool orchestration、verification loop 与 workflow integration[@se-agent-survey]。换句话说，软件工程 agent 之所以重要，不只是因为它能“写代码”，而是因为它最早把 agent 讨论推进到了可执行、可验证、可比较的工程现实。

第四条，才是今天这篇文章真正关心的组织化、工作流级落地。这里讨论的，已经不是“单个模型”或者“单个论文方法”，而是这些能力怎样被接进真实工作流。`2024-10` Anthropic 把 `computer use` 正式推到公开视野[@anthropic-computer-use]；`2025-02` GitHub 宣布 `Copilot Agent` 模式[@copilot-agent]，同月 Anthropic 在 API release notes 中把 `Claude Sonnet 3.7` 与 `Claude Code` 一并推上工程讨论主线[@anthropic-api-notes]；`2025-05` OpenAI 发布 `Codex` 研究预览[@openai-codex-preview]，Google 公开 `Jules`[@google-jules]；`2025-08` OpenAI 推出 `GPT-5 for developers`[@openai-gpt5-dev]，GitHub 则把 VS Code 里的 `Agents Panel` 推向 GA[@copilot-agents-panel]；`2025-10` OpenAI 又把 `Codex` 做到 generally available[@openai-codex-ga]；最终到 `2026-03`，Anthropic 公开《How Anthropic teams use Claude Code》，这件事才算从“产品能用”进一步走到“团队真的这样用”[@anthropic-claude-code]。也正是在这一层，AI coding 讨论的对象才真正从“会不会写函数”转成“人如何组织一群 agent，去改写自己的日常工作流”。

如果要把上面这些关键节点压缩成一张更清晰的背景表，那么至少可以写成下面这样：

| 时间 | 主线 | 代表性工作 | 作者 / 机构 | 在这条技术线上意味着什么 |
| --- | --- | --- | --- | --- |
| `2017-06` | LLM 基础架构 | `Attention Is All You Need` | Vaswani et al. | `Transformer` 架构奠基，后续大模型路线的技术起点[@transformer] |
| `2020-05` | LLM 规模化 | `GPT-3` | Brown et al. / OpenAI | few-shot prompting 被正式推成行业主叙事[@gpt3] |
| `2022-03` | LLM 对齐 | `InstructGPT` | Ouyang et al. / OpenAI | 从续写转向指令跟随，RLHF 路线成形[@instructgpt] |
| `2022-03` | LLM 训练范式 | `Chinchilla` | Hoffmann et al. / DeepMind | compute-optimal scaling 被明确提出[@chinchilla] |
| `2022-04` | LLM 规模化 | `PaLM` | Chowdhery et al. / Google | 大规模预训练与复杂推理能力继续抬升[@palm] |
| `2022-10` | Agent 方法 | `ReAct` | Yao et al. | reasoning 与 acting 被首次系统耦合[@react] |
| `2022-11` | 对话式产品 | `ChatGPT` | OpenAI | 对话式 LLM 成为大众入口[@openai-chatgpt] |
| `2023-02` | Agent 方法 | `Toolformer` | Schick et al. | 工具调用从技巧走向可学习能力[@toolformer] |
| `2023-02` | 开源 LLM | `LLaMA` | Touvron et al. / Meta | 高性能开源基座模型成为研究共同体新底座[@llama] |
| `2023-03` | 对话式 LLM | `GPT-4` | OpenAI | 复杂任务遵循、写作与推理能力继续提升[@openai-gpt4] |
| `2023-03` | Agent 方法 | `Reflexion` | Shinn et al. | 反思式反馈进入 agent 回路[@reflexion] |
| `2023-03` | 背景综述 | `A Survey of Large Language Models` | Zhao et al. | 截至 `2026-03` 仍在更新的 living survey，系统梳理 LLM 全景[@llm-survey] |
| `2023-05` | Agent 方法 | `Voyager` | Wang et al. | 长程任务与持续探索范式被推进[@voyager] |
| `2023-08` | Agent 综述 | `Autonomous Agents Survey` | Lei Wang et al. | 自主 agent 框架与评测视角系统化[@autonomous-agent-survey] |
| `2023-09` | Agent 综述 | `The Rise and Potential...` | Zhiheng Xi et al. | LLM-based agents 的整体图景被进一步整理[@agent-rise-survey] |
| `2023-10` | SWE Agent | `SWE-bench` | Jimenez et al. | 真实 GitHub issue resolution 成为公开 benchmark[@swe-bench] |
| `2024-03` | SWE 产品 | `Devin` | Cognition | 软件工程 agent 开始进入大众产品叙事[@cognition-devin] |
| `2024-05` | 工作流产品 | `GPT-4o` | OpenAI | 成本、速度与多模态交互进入更高频可用区间[@openai-gpt4o] |
| `2024-05` | SWE Agent | `SWE-agent` | John Yang et al. | repo 浏览、命令执行与补丁生成被串成工程链路[@swe-agent] |
| `2024-07` | SWE Agent | `Agentless` | Xia et al. | 对“必须复杂 agent 编排吗”做出反向拆解[@agentless] |
| `2024-09` | SWE Agent 综述 | `LLM-Based Agents for Software Engineering` | Liu et al. | software engineering agents 范围被系统化界定[@se-agent-survey] |
| `2024-09` | Reasoning 路线 | `o1-preview` | OpenAI | “先想再答”的 reasoning model 路线被公开摆上台面[@openai-o1] |
| `2024-10` | Agent 工具能力 | `computer use` | Anthropic | 计算机操作能力进入公开产品视野[@anthropic-computer-use] |
| `2025-02` | 工作流产品 | `Copilot Agent Mode` | GitHub | repo 级编码 agent 进入主流 IDE 叙事[@copilot-agent] |
| `2025-02` | 工作流产品 | `Claude Sonnet 3.7 / Claude Code` | Anthropic | 编码模型与 CLI 代理形态进一步结合[@anthropic-api-notes] |
| `2025-05` | 工作流产品 | `Codex Preview` | OpenAI | 可执行、可持续追问的 coding agent 路线公开化[@openai-codex-preview] |
| `2025-05` | 工作流产品 | `Jules` | Google | 异步 coding agent 被正式推向开发者[@google-jules] |
| `2025-08` | 开发者模型 | `GPT-5 for developers` | OpenAI | 开发者定向模型 / 工具叙事继续强化[@openai-gpt5-dev] |
| `2025-08` | 工作流产品 | `Agents Panel` | GitHub | 多 agent 面板进入 IDE 日常工作流[@copilot-agents-panel] |
| `2025-10` | 工作流产品 | `Codex GA` | OpenAI | coding agent 从预览走向正式可用[@openai-codex-ga] |
| `2026-03` | 团队实践 | `How Anthropic teams use Claude Code` | Anthropic | 团队级、多 agent 工作流被正式公开总结[@anthropic-claude-code] |

单看文字，还是容易把这条线看散。所以下面直接按三个阶段来展示时间线：第一张图看对话式 LLM 与 Agent 原型期，第二张图看软件工程 Agent 进入主线的过渡期，第三张图看 repo 级编码助手与组织化 Agent 工作流如何真正成形。每张图内部都保留季度格子，因此既能看大阶段，也不会把时间感抹平。为了避免季度线上出现大片空白，图里额外补进了几个非常关键、但前文表格里没逐个展开的节点，例如 `2024-03` 的 Devin 首次亮相、`2024-10` 的 Claude Computer Use 公测、以及 `2025-08` 前后 GitHub agents panel 与 GPT-5 for developers 这些点[@cognition-devin; @anthropic-computer-use; @copilot-agents-panel; @openai-gpt5-dev]。图里同时放了产品发布、方法范式和综述 / 基准三类节点；年份主线与事件框使用不同颜色区分，基本可以直接看出，哪些节点是在推模型能力本身，哪些是在把 agent / software engineering 这套方法论钉实，哪些又是在把它真正推到工程实践里。

```mermaid
timeline
    title 第一阶段：对话式 LLM 爆发与 Agent 原型成形（2022 Q4 - 2023 Q4）
    section 2022
      四季度
        : 2022-10-06 ReAct 推理-行动范式
        : 2022-11-30 ChatGPT 出圈
    section 2023
      一季度
        : 2023-02-09 Toolformer 工具调用
        : 2023-03-14 GPT-4 发布
        : 2023-03-20 Reflexion 反思式 Agent
        : 2023-03-31 大模型综述
      二季度
        : 2023-05-25 Voyager 长程 Agent
      三季度
        : 2023-08-22 自主 Agent 综述
        : 2023-09-14 LLM Agent 发展综述
      四季度
        : 2023-10-10 SWE-bench 基准
```

```mermaid
timeline
    title 第二阶段：软件工程 Agent 进入主线（2024 Q1 - 2024 Q4）
    section 2024
      一季度
        : 2024-03-12 Devin 首次亮相
      二季度
        : 2024-05-13 GPT-4o 发布
        : 2024-05-24 SWE-agent
      三季度
        : 2024-07-02 Agentless
        : 2024-09-05 软件工程 Agent 综述
        : 2024-09-12 OpenAI o1 preview
      四季度
        : 2024-10-22 Claude Computer Use 公测
```

```mermaid
timeline
    title 第三阶段：Repo 级编码助手成形与组织化 Agent 落地（2025 Q1 - 2026 Q1）
    section 2025
      一季度
        : 2025-02-06 GitHub Copilot Agent 模式
        : 2025-02-24 Claude Sonnet 3.7 / Claude Code
      二季度
        : 2025-05-16 Codex 预览
        : 2025-05-20 Jules 公测
      三季度
        : 2025-08-07 GPT-5 for developers
        : 2025-08-19 GitHub Agents Panel
      四季度
        : 2025-10-06 Codex GA
    section 2026
      一季度
        : 2026-03-04 Claude Code 团队实践公开
```

之所以要先把这条时间线铺出来，不是为了在文里堆名词，而是为了避免一件特别常见、也特别要命的误判：把不同层级的技术变化混成一个“AI 一直在进步”的含糊叙事。实际上，`ChatGPT` 带来的是自然语言接口普及，`ReAct` 和 agent 综述带来的是“模型如何连续做事”的范式坐标，`SWE-bench` 一类工作带来的是软件工程任务的公开衡量，而 `Codex`、`Claude Code`、`Jules` 这类产品化形态带来的，则是 agent 真正接进生产流之后，工作单元如何被整体改写。把这几层混在一起，后面分期就一定会切歪。

## 研究设计、样本与结果

### 定义：研究对象、时代划分与核心指标

本文的实证部分，并不是一个要去证明“AI 一定让人更强”的先验论证，而是一个围绕前述 `RQ` 所做的样本化研究。研究对象只有一个，就是笔者本人在不同技术阶段下的工作痕迹；研究目的也只有一个，就是尽量用可复核、可解释的方式，把工作单元、产能结构和工作负荷究竟发生了什么变化，拆给自己和读者看。

这一步首先要解决的，就是定义问题。原始分期设定里有一个很现实的冲突：“前 AI 时代”写的是 `2024 年 6 月之前`，“初步 AI 时代”写的是 `2024 年 1 月到 2026 年 1 月底`。这两个区间在 `2024-01-01` 到 `2024-05-31` 之间明显重叠。写文章时可以含糊，做研究设计时不能含糊；否则同一段时间会被重复计入，后面无论是 commit 数、活跃仓库数还是产能倍率，都会从坐标系层面先坏掉。

不过，技术史分期和个人工作流分期也不是一回事。前一节回答的是“行业走到了哪里”，这里回答的则是“笔者自己的工作方式究竟是什么时候真的被改写了”。因此，本文最终采用的是下面这组不重叠、且与个人工作方式直接对应的精确分期：

| 时期 | 精确时间范围 | 为什么这么切 |
| --- | --- | --- |
| 前 AI 基线期 | `截至 2024-05-31` | 把 `2024-05-13` 的 GPT-4o 和 `2024` 年中之后更成熟的代码助手浪潮之前的部分，视为“AI 已存在，但尚未重写日常工作流”的基线期。 |
| 初步 AI 期 | `2024-06-01` 到 `2026-01-31` | 这段时间里，模型开始真正可用，仓库级辅助开始成形，AI 从“能玩”变成“能干活”；但多 agent 编排和大规模 vibe 工作流还没有在笔者这里完全爆开。 |
| Vibe / Agent 期 | `2026-02-28` 到 `2026-04-14` | 这里的 `2026-02-28` 是本文统计采用的个人工作流分界点，不是术语诞生日。术语本身在 `2025` 年初就已经流行开来，但术语流行与个人工作方式什么时候真的被改写，本来就不是同一件事。 |

这张图是本文采用的切法：

```mermaid
flowchart LR
    A["前 AI 基线期<br/>截至 2024-05-31<br/>AI 已存在，但尚未重写日常工作流"] --> B["初步 AI 期<br/>2024-06-01 至 2026-01-31<br/>模型开始真正可用，仓库级辅助成形"] --> C["Vibe / Agent 期<br/>2026-02-28 至 2026-04-14<br/>多 agent 并行、跨仓库协同、写作与编码合流"]
```

这个切法和前面的技术时间线是能对上的，但并不是机械对应。对笔者本人而言，所谓前 AI 基线期，说白了就是古法手工编程时期：要么还没有 LLM，要么模型虽然已经出现，但离“能稳定生成可用代码”还差得很远，因此主要工作方式仍然是自己手写、自己查、自己改。初步 AI 期则不一样了，这一阶段模型在一些小型、低难度、通用化任务上已经开始变得稳定，于是我开始尝试把 prompt、上下文说明和代码片段丢给网页上的 LLM，让它先生成一部分内容，我再复制回来接着改；但这个阶段还谈不上什么系统性的 AI 助手编排，更谈不上多 agent 协作。真正的分水岭，是 `2026-02-28` 之后这段时间：到了这里，才进入今天所谓 vibe / agent 时代，也就是 `Codex`、`Claude Code` 这类东西真正玩飞起来的阶段。代码、文档、研究、博客和站点维护不再只是“偶尔让模型帮一下”，而是开始被一起挂进多线程、可并行、可持续追问的 agent 工作流里。行业时间线告诉我这股浪潮是怎么来的，个人工作流分期则告诉我：它到底是什么时候真正打到了我自己身上。

这组定义还隐含了另一个前提：本文的统计单位是“人”，不是“单个 repo”。原因很简单，vibe / agent 时代真正离谱的地方，本来就不是某一个仓库一天多了多少 commit，而是同一个人在同一个时间窗里，能不能同时把代码、文档、研究笔记、博客长文、脚手架和站点维护一起挂起来推进。按单 repo 看，最多只能看见一个局部战场是否热闹；按人看，才更接近这篇文章真正想研究的对象。

### 研究设计：样本口径、清洗规则与比较方式

这次统计我用了两层口径。第一层是 GitHub `contributionsCollection` 里的 `commit contribution`，它回答的是“在一个连续时间窗里，作为这个人，我总共发生了多少次跨仓库的有效提交活动”。这一层最适合做峰值窗口筛选，因为它天然按“人”而不是按某个仓库在看。第二层是 GitHub 默认分支 landed commit 对应的落地层指标，包括 landed commit、非 merge commit、修改文件数、增删行，以及提交更偏代码还是更偏文档。它回答的是另一个问题：这些高强度窗口最后到底在工程表面上落成了什么。

两层都要用，原因并不复杂。只看贡献层，就只能知道“很忙”，却不知道忙出来的是代码、文档、测试还是一堆杂项；只看落地层，又很容易被默认分支策略、merge 方式、批量 sweep、大型导入和 API 技术细节带偏。尤其是今天这种多 agent、多分支、多仓库同时推进的工作流，如果只盯 landed commit，很多实际上已经发生过的密集劳动会被压扁；但如果只盯 contribution，又会把产物结构抹平。所以本文的做法是先用贡献层找峰值窗口，再用落地层拆细节，最后把两者放在一起看。

“按人统计”这件事也不是姿态，而是现实要求。前 AI 时代的高强度输出，往往是一个主 repo 带一两个配套仓库；现在的高强度输出，往往同时挂着研究笔记、框架代码、博客站点、文档沉淀、技能脚手架和若干调研仓库。如果今天还按单 repo 统计，得到的最多只是“这个库最近很热闹”，而不是“这个人当前到底处在什么工作状态里”。说得更直一点，那就像拿单兵冲锋速度去衡量一个师级指挥调度水平，当然也能测，但测出来的根本不是重点。

另外，本文这次不再满足于“看 commit 数和 raw 行数”，而是把公开窗口逐条拉到 commit 明细层做了一次人工清洗。原因并不复杂：如果直接拿 raw changed lines 来说事，那么 merge diff、生成式语法文件、锁文件、批量导入的原始文本、资源镜像和结构化台账，很容易把图表直接顶飞，最后得到一张看上去很吓人、但其实解释力很差的曲线。这种数当然不是假的，但它衡量的往往不是“人到底输出了多少有效内容”，而是“这一阶段有多少机器可批量展开的表面被一起推平了”。

因此，本文在落地层额外定义了一个 **有效变更行** 指标。它的计算方式很直接：先排除 merge commit 的重复 diff，再从非 merge 提交里去掉几类明显不适合直接当作“有效产能”的文件，包括自动生成的 parser/lexer 产物、锁文件、批量导入的论文全文转储 `paper_content.txt`、vendored 桌宠资源、自动生成的旧站目录账本，以及那种更像半自动评审台账的大型 JSON。保留下来的，才是本文后面真正拿来比较的“有效变更行”。换句话说，本文不是不用 raw 行数，而是把 raw 行数当作表面规模信号，把清洗后的有效变更行当作更接近真实工作量的信号。

数据边界也一并说清楚，省得后面又跑偏：

1. 公开细表和外链，只使用 `HansBug` 这边已经公开的信息。
2. 另一部分未开源工作，确实做了统计，但只给匿名聚合结果，不挂仓库名，不挂链接，也不写任何可逆去匿名的细节。
3. 全文时间统计的截止时间，是 **2026-04-14**。
4. 全文并行保留两套行数：`raw changed lines` 用来看工作表面的总展开规模，`有效变更行` 用来看排除 merge diff 与明显机器产物之后，真正仍值得拿来比较的那部分工作量。
5. `有效变更行` 的清洗规则，在公开样本里固定排除了 merge diff、生成式 parser/lexer 产物、锁文件、批量导入的论文全文转储、vendored 资源以及少数明显台账型 JSON；语言桶按 `py / node / md / other` 四类聚合。

这一步看上去有点像先把话说死，实际上非常必要。因为如果方法论不先钉住，后面的数字很容易沦为一种很省事、也很廉价的自我催眠：先拿几个漂亮数把自己哄舒服，再假装那就是分析。坦白说，这种活 AI 比人还会干，但也正因为如此，人更得把坐标系先守住。

### 研究结果（一）：公开样本与匿名样本的窗口结构

#### 公开样本：`HansBug` 这边能完全复核的三段窗口

先看公开样本。这里的窗口，都是按“人”的维度，在对应时期里挑出的 14 天高强度窗口；表里给出的公开仓库链接，都可以直接点进去核对。

#### 表 1：公开样本的 14 天峰值窗口（贡献层，按人、跨仓库）

| 时期 | 时间窗 | 14 天 `commit contribution` | 活跃天数 | 日均贡献提交 | 平均活跃仓库数/日 | 峰值同时活跃仓库数 | 主要公开仓库 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 前 AI 基线期 | `2023-02-22` ~ `2023-03-07` | 117 | 8 | 8.36 | 0.79 | 2 | [opendilab/treevalue](https://github.com/opendilab/treevalue) 101、[HansBug/hbutils](https://github.com/HansBug/hbutils) 9、[HansBug/fake_html](https://github.com/HansBug/fake_html) 7 |
| 初步 AI 期 | `2025-06-13` ~ `2025-06-26` | 264 | 12 | 18.86 | 1.00 | 2 | [HansBug/pyfcstm](https://github.com/HansBug/pyfcstm) 234、[HansBug/plantumlcli](https://github.com/HansBug/plantumlcli) 30 |
| Vibe / Agent 期 | `2026-04-01` ~ `2026-04-14` | 635 | 14 | 45.36 | 2.43 | 4 | [HansBug/research_ideas](https://github.com/HansBug/research_ideas) 328、[HansBug/hubvault](https://github.com/HansBug/hubvault) 139、[HansBug/HansBug.github.io](https://github.com/HansBug/HansBug.github.io) 102、[HansBug/pyfcstm](https://github.com/HansBug/pyfcstm) 46、[HansBug/python-ai-cheatsheet](https://github.com/HansBug/python-ai-cheatsheet) 11、[HansBug/deck-workflow-skill](https://github.com/HansBug/deck-workflow-skill) 7、[HansBug/jml-openjml-field-guide](https://github.com/HansBug/jml-openjml-field-guide) 2 |

表 1 先给出了三段公开可复核窗口在 contribution-layer 上的基本结构。就结果本身看，前 AI 基线期主要集中在 `treevalue` 与少量配套仓库；初步 AI 期则高度集中在 `pyfcstm`；而 `2026-04-01` 到 `2026-04-14` 这一段公开窗口，已经同时覆盖研究写作、存储框架、博客站点、DSL / 框架推进、速查手册、技能脚手架与调研导览等多类输出面。与之对应，平均活跃公开仓库数从 `0.79` 提高到 `2.43`，峰值同时活跃公开仓库数从 `2` 提高到 `4`。

#### 表 2：公开样本的 14 天峰值窗口（落地层，加入清洗后的有效代码量）

| 时期 | 时间窗 | landed commit | 非 merge commit | 有效提交 | raw changed lines | 非 merge changed lines | 有效变更行 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 前 AI 基线期 | `2023-02-22` ~ `2023-03-07` | 60 | 46 | 46 | 7,964 | 4,914 | 4,914 |
| 初步 AI 期 | `2025-06-13` ~ `2025-06-26` | 174 | 174 | 174 | 47,425 | 47,425 | 23,980 |
| Vibe / Agent 期 | `2026-04-01` ~ `2026-04-14` | 639 | 622 | 620 | 5,943,848 | 3,303,799 | 587,672 |

表 2 给出了公开样本在 landed-layer 上的结果，并把 `raw changed lines`、`non-merge changed lines` 与清洗后的 `有效变更行` 分开呈现。结果显示，当前公开 Vibe 窗口的 `raw changed lines` 达到 `5,943,848`，其中包括大规模 merge diff 和明显机器产物；在清洗掉这些部分之后，`有效变更行` 仍然达到 `587,672`，对应前 AI 公开窗口的 `4,914` 与初步 AI 公开窗口的 `23,980`。

把 commit 数和代码量放在同一张图里看，会更直观一些。严格来说，这张图本来应该画双纵轴；但 `Mermaid` 原生并不支持双 `y-axis`，所以这里只能退一步，把“有效变更行”按 `100 × log10(lines)` 的方式投射成折线，左边的柱子仍然保留真实的有效提交数。原始数值以表 2 为准，图只负责把趋势压到同一视野里：

```mermaid
%% series-labels: 有效提交|100×log10(有效变更行)
%% series-colors: #8fd6ff|#f2c16d
xychart-beta
    title "图 1 公开 14 天峰值窗口：有效提交与有效变更行"
    x-axis ["前AI公开", "初步AI公开", "Vibe公开"]
    y-axis "Commits / 100×log10(Changed Lines)" 0 --> 650
    bar [46, 174, 620]
    line [369, 438, 577]
```

图 1 只是把表 2 的两类结果压到同一视野中。它不单独承担解释任务，只负责把 `有效提交` 与 `有效变更行` 的相对量级放到一张图上展示。

语言分布再往下拆，就更能看出三个窗口的结构差异了：

| 时期 | `py` | `node` | `md` | `other` |
| --- | ---: | ---: | ---: | ---: |
| 前 AI 基线期 | `1,927` (`39.2%`) | `0` | `195` (`4.0%`) | `2,792` (`56.8%`) |
| 初步 AI 期 | `20,635` (`86.1%`) | `0` | `1,930` (`8.0%`) | `1,415` (`5.9%`) |
| Vibe / Agent 期 | `83,021` (`14.1%`) | `26,413` (`4.5%`) | `435,666` (`74.1%`) | `42,572` (`7.2%`) |

这里的 `other` 指的是 `Cython / workflow / Makefile / CSS / 配置与杂项结构文件` 这类既不归入 `py`、也不归入 `md` 的变更。结果上看，前 AI 公开窗口中 `other` 占比相对较高；初步 AI 公开窗口以 `py` 为绝对主导；而当前 Vibe 窗口中 `md` 占比达到 `74.1%`。

```mermaid
%% series-labels: Python|Node|Markdown|其他
%% series-colors: #8fd6ff|#f2c16d|#8fe1ba|#ff9bb0
xychart-beta
    title "图 2 三个时期的语言构成占比"
    x-axis ["前AI", "初步AI", "Vibe"]
    y-axis "Percent" 0 --> 100
    bar [39.2, 86.1, 14.1]
    bar [0.0, 0.0, 4.5]
    bar [4.0, 8.0, 74.1]
    bar [56.8, 5.9, 7.2]
```

如果再按提交主导形态去分，差异会更刺眼：

| 时期 | 文档型提交 | 代码型提交 | 混合型提交 |
| --- | ---: | ---: | ---: |
| 前 AI 基线期 | `1` (`2.2%`) | `34` (`73.9%`) | `11` (`23.9%`) |
| 初步 AI 期 | `6` (`3.4%`) | `144` (`82.8%`) | `24` (`13.8%`) |
| Vibe / Agent 期 | `182` (`29.4%`) | `77` (`12.4%`) | `361` (`58.2%`) |

按提交主导形态统计时，前 AI 基线期与初步 AI 期的代码型提交分别为 `73.9%` 与 `82.8%`；而当前 Vibe / Agent 期中，混合型提交占比达到 `58.2%`，文档型提交占比达到 `29.4%`。这组结果与前面的语言分布一起，构成了 landed-layer 上的结构性差异。

```mermaid
%% series-labels: 文档型|代码型|混合型
%% series-colors: #8fe1ba|#8fd6ff|#f2c16d
xychart-beta
    title "图 3 三个时期的提交主导形态占比"
    x-axis ["前AI", "初步AI", "Vibe"]
    y-axis "Percent" 0 --> 100
    bar [2.2, 3.4, 29.4]
    bar [73.9, 82.8, 12.4]
    bar [23.9, 13.8, 58.2]
```

#### 匿名样本：那部分未开源工作不该被省略

如果只看公开样本，这篇文章很容易被理解成“拿现在公开窗口去欺负一个历史上比较窄的基线”。可事实不是这样。笔者在前 AI 和初步 AI 阶段，本来就不是低产的人，那部分没有开源的工作如果完全省略，反而会把历史强度压得过低。所以这里必须把匿名聚合结果摆出来，边界守住，但历史强度也不能被抹平。

#### 表 3：匿名未开源样本的 14 天高强度窗口（落地层，匿名聚合）

| 匿名样本 | 时间窗 | landed commit | 非 merge commit | 覆盖仓库数 | 活跃天数 | 平均活跃仓库数/日 | 峰值同时活跃仓库数 | 修改文件数 | `+` 行 | `-` 行 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 匿名前 AI 高强度窗口 | `2023-12-23` ~ `2024-01-05` | 167 | 140 | 8 | 14 | 2.86 | 4 | 1,391 | 51,535 | 5,175 |
| 匿名初步 AI 高强度窗口 | `2024-08-27` ~ `2024-09-09` | 167 | 157 | 6 | 14 | 1.57 | 3 | 644 | 20,560 | 1,461 |

表 3 给出了匿名未开源样本中的两段高强度窗口。结果上看，这两段历史匿名样本本身已经是高压、多仓库并行窗口：两者 landed commit 都是 `167`，非 merge commit 分别为 `140` 与 `157`，覆盖仓库数分别为 `8` 与 `6`。

#### 表 4：匿名历史样本与当前公开样本的“代码/文档触达面”对比

| 样本 | 涉及代码提交数 | 涉及文档提交数 | 观察 |
| --- | ---: | ---: | --- |
| 匿名前 AI 高强度窗口 | 132 | 69 | 编码密度高，文档并不少，但仍是“代码主、文档辅” |
| 匿名初步 AI 高强度窗口 | 160 | 25 | 更典型的“代码主线窗口”，文档面明显收缩 |
| 当前公开 Vibe 窗口 | 158 | 541 | 代码触达面几乎维持历史峰值，但文档触达面直接爆炸 |

表 4 进一步给出了匿名历史样本与当前公开样本在“代码 / 文档触达面”上的差异。结果上看，当前公开 Vibe 窗口的代码触达提交数与匿名历史高强度样本大体处于同一量级，而文档触达提交数则显著提高。

### 研究结果（二）：峰值窗口倍率与结果汇总

#### 表 5：按人、跨仓库的峰值窗口倍率（贡献层，保守口径）

| 时间窗 | 前 AI 基线期 | 初步 AI 期 | Vibe / Agent 期 | `Vibe / 前AI` | `Vibe / 初步AI` |
| --- | ---: | ---: | ---: | ---: | ---: |
| 7 天峰值 | 193 | 184 | 395 | 2.05x | 2.15x |
| 14 天峰值 | 314 | 274 | 635 | 2.02x | 2.32x |
| 30 天峰值 | 580 | 459 | 996 | 1.72x | 2.17x |

表 5 使用的是 contribution-layer 的按人峰值窗口。结果显示，当前 Vibe / Agent 期相对于历史高强度窗口的倍率大致稳定在 `1.7` 到 `2.3` 倍之间。

下面这张图把三个时期的人级 14 天峰值窗口直接放到一起看：

```mermaid
xychart-beta
    title "14 天峰值 Commit Contribution（按人、跨仓库）"
    x-axis ["前AI基线", "初步AI", "Vibe/Agent"]
    y-axis "Commits" 0 --> 700
    bar [314, 274, 635]
```

图 2 对应的是表 5 的 contribution-layer 结果，因此把匿名未开源样本也一并纳入了比较。

#### 表 6：公开与匿名样本的落地层倍率（更贴近“干成了多少事”）

| 对比口径 | 基线窗口 | 当前 Vibe 公开窗口 | 倍率 |
| --- | --- | ---: | ---: |
| 公开 landed commit | 前 AI 公开窗口 60 | 639 | 10.65x |
| 公开 landed commit | 初步 AI 公开窗口 174 | 639 | 3.67x |
| 公开非 merge commit | 前 AI 公开窗口 46 | 622 | 13.52x |
| 公开非 merge commit | 初步 AI 公开窗口 174 | 622 | 3.57x |
| 公开有效变更行 | 前 AI 公开窗口 4,914 | 587,672 | 119.59x |
| 公开有效变更行 | 初步 AI 公开窗口 23,980 | 587,672 | 24.51x |
| 匿名 landed commit | 匿名前 AI 高强度窗口 167 | 639 | 3.83x |
| 匿名 landed commit | 匿名初步 AI 高强度窗口 167 | 639 | 3.83x |
| 匿名非 merge commit | 匿名前 AI 高强度窗口 140 | 622 | 4.44x |
| 匿名非 merge commit | 匿名初步 AI 高强度窗口 157 | 622 | 3.96x |

表 6 给出了公开与匿名样本在 landed-layer 上的倍率结果。按当前口径计算，公开窗口相对于历史匿名高强度窗口的 landed commit 倍率为 `3.83x`，非 merge commit 倍率为 `3.96x` 至 `4.44x`；如果只与公开前 AI 窗口比较，则若干指标继续抬高到 `10x` 以上。至于这些结果分别意味着什么、又应当如何回答前文的 `RQ`，后文再专门展开；在这一节里，先把结果本身摆出来即可。

下面这张图把 landed-layer 里最能说明问题的一组对比单独画出来：

```mermaid
xychart-beta
    title "落地层 14 天窗口：历史高强度样本 vs 当前公开 Vibe 样本"
    x-axis ["匿名前AI", "匿名初步AI", "当前Vibe公开"]
    y-axis "Landed commits" 0 --> 700
    bar [167, 167, 639]
```

如果非要把这段统计压缩成一句俗一点、但并不失真的话，那就是：AI 真正厉害的地方，不是给你省几次敲键盘，而是把你原来要分三周、分三条线、分三种心境才能做完的东西，硬生生压进了同一个 14 天窗口里。所谓“感觉离谱”，本质上就是这种时间压缩和工作面并行叠出来的结果。只不过今天再谈“压缩”，已经不能只盯 commit 条数了；commit、有效变更行、语言构成和提交主导形态，得一起看，才能看见这股力量到底把什么改写了。

## AI 对写作和代码的真实作用：不是单任务更快，而是总工作面被改写

### 为什么我说最大的变化是总工作面暴涨

很多人本能地把 AI 的价值理解成“原来一天写 500 行代码，现在一天写 1000 行”“原来三小时做完一件事，现在一小时做完”。这些理解都不能说错，但它们还停留在旧坐标系里，也就是默认你仍然在沿着单任务、单主线、单仓库那套方式工作。可从这次统计能看出来，今天的现实越来越像是：代码在推进，文档在跟，研究笔记在沉淀，博客长文在收束，站点能力也在一起迭代，而这些东西不再是排队发生，而是并行发生。

公开 Vibe 窗口里，平均活跃公开仓库数已经达到 `2.43 个/日`，峰值同时活跃公开仓库数达到 `4`。对应的前 AI 公开窗口分别只有 `0.79` 和 `2`，初步 AI 公开窗口则是 `1.00` 和 `2`。换句话说，公开可见层面上，今天的工作并行度已经是过去的 `2` 到 `3` 倍。这个指标之所以比“写了多少行代码”更值钱，是因为它直接揭示了大脑被迫盯着多少条轨道，而不是某一条轨道跑得多快。

```mermaid
xychart-beta
    title "公开样本：平均同时活跃仓库数 / 日"
    x-axis ["前AI公开样本", "初步AI公开样本", "Vibe公开样本"]
    y-axis "Repos / day" 0 --> 3
    bar [0.79, 1.0, 2.43]
```

所以笔者才会反复强调，今天 AI 真正厉害的地方，不是让一个人“更像程序员”，而是让一个人越来越像一个在多条任务线上持续调度的系统管理员、技术主编、架构裁判和小型指挥官。如果还只盯着某一个 repo 最近有没有爆 commit，那等于只看见了战线上的一个碉堡，却没看见整张沙盘已经在同时转起来。

### 说回写作：AI 为什么把文档面和博客面也一起点燃

前面最容易被忽略、但又最不该忽略的数字，其实是当前公开窗口里那 `541` 个文档相关提交。它说明的并不是“今天我突然爱写东西了”，而是写作本身已经被重新拉回了工程主流程。过去很多本来应该写下来的东西最后没写，不是因为人不知道该写，而是因为没空、太费劲、太打断心流，或者资料明明在脑子里，但要把它们整理成一篇能读、能用、能沉淀的文本，成本高得离谱。结果就是，大量本来应该成为知识资产的经验，最后都烂在聊天记录、issue 评论、半截草稿和脑补里。

AI 在这里最狠的一刀，不是替你“写得更漂亮”，而是把知识外化这件事的门槛砍下来了。于是研究笔记更容易先铺开再回收，调研综述更容易先成形再收束，博客长文不再必须等一整块空档才能开写，项目路线、知识图谱、字段说明、站点内容和文档摘要也开始更像日常维护，而不是“以后有空再补”的边角料。换句话说，过去你经常得在“先写代码还是先写下来”之间二选一；现在越来越多的时候，代码、文档、博客和站点可以互相供血，这才是写作面被点燃的真正原因。

这也是为什么，笔者今天会毫不犹豫地把 AI 用在博客和写作上。不是因为它能替我当作者，而是因为在今天，不把 AI 用在写作上，本身反而是在浪费一种极其宝贵的知识外化能力。写作不再只是“我有余力时才去做的表达性活动”，而越来越像工程工作本身的一部分：它负责把判断、经验、结构和路线正式固化下来。如果今天还把它当作附庸，反而是在主动放弃 AI 最能帮人补上的那一块短板。

### 说回代码：AI coding 真正离谱在什么地方

再把视角收回代码本身。笔者觉得，今天 AI coding 的离谱之处至少有四层，而且越往后越关键。

1. 第一层当然是大家都知道的那层：样板、胶水、搬运、格式调整、常规重构、路径搜索、简单脚手架、重复测试和局部改名，这些低价值实现动作现在已经大量可以外包给模型或 agent。这一层是地板，不是天花板。
2. 第二层是它显著降低了多仓库切换的心理成本。以前人在多仓库切换时，最大的损耗往往不是“不会写”，而是重新进上下文、重新找入口、重新恢复工作记忆。今天有了 repo-aware 搜索、上下文压缩、agent 摘要和批量 diff 解释之后，多仓库切换虽然依旧很累，但已经不再像过去那样“每切一次都像重新投胎”。
3. 第三层是它把很多原本需要“整块空档”的任务，打碎成了可以穿插推进的任务。长文、全局重命名、统一接口、补文档、补说明、整理测试、批量 sweep，这些以前经常得等“专门抽一段时间”才能动手的事情，现在越来越能被拆成多条副线，穿插进主任务之间去推进。
4. 第四层，也是我真正觉得最离谱的一层，是它让“架构意图”和“工程表面”之间的距离明显缩短了。过去人脑子里常常已经有一个相对完整的想法，但从想法到真正落成一组工程改动，中间隔着大量机械展开、重复同步和局部细节照顾。现在这层摩擦被削掉了很多，于是人的主要精力就自然前移到了更值钱的地方：这个抽象是否成立，这条路线是否合理，这个边界会不会害人，这件事到底该不该做，而不是只是“怎么亲手把它全部敲出来”。

所以我才会说，AI coding 真正可怕的地方，不是它替你写了多少行，而是它把“想法通往工程表面”的通路变宽了。一旦这条通路变宽，很多过去本来有价值、但总是被实现摩擦磨死的东西，今天就会被捞出来真正做掉。那种感觉，才是今天所谓 AI coding “离谱”的根子。

顺便也在这里泼一盆冷水：不要拿“行数”当最终 KPI。当前公开 Vibe 窗口里的行数看起来极其夸张，甚至已经到了肉眼可见不正常的程度；`research_ideas` 和 `HansBug.github.io` 里都出现过接近或达到 GitHub Commit API `300 files` 返回上限的大提交。这说明今天的工作流确实已经能支撑大规模 sweep 式更新，但它同样说明，如果你把行数直接当 headline KPI，那就非常容易自欺欺人。行数能说明今天的工作表面很大、批量更新很常见、AI 确实把很多大面动作变得可行，但它不能单独说明人的价值提升了多少。人的价值不在行数里，而在判断里；这点要是丢了，这篇文章就会迅速滑进一种非常廉价的产能崇拜。

## 效率、疲惫与责任：人被从战壕里赶出来之后

### 为什么效率更高，人反而更累

很多外行看到这里，第一反应往往是：既然效率提高了这么多，那你岂不是应该轻松很多？不好意思，恰恰相反。AI 越能干，人在很多时候反而越累，而且这件事一点都不神秘。过去大量时间其实消耗在低密度劳动上：机械搬运、重复改名、样板代码、文档格式整理、低级试错、需要耐心但不太需要判断的重复操作。这些活以前都得自己做，不一定难，但很碎、很耗、很打断心流。现在 AI 把这类活吃掉了一大块，甚至很多时候吃得比你还好。

问题就在这里：既然“不用动脑的苦力活”都被剥走了，那么最后留在你面前的还能是什么？当然只剩那些真正烧脑的东西，比如需求边界怎么切、哪条任务线先走、哪个 agent 该先放出去、谁在改什么会不会撞接口、哪些地方必须人亲自过脑、哪些内容虽然能生成但还没到能签字负责的程度。也就是说，人并没有不干活，只是越来越只干那些最费脑子的活。过去让你累的，很多是琐碎；现在让你累的，很多是持续不断的高密度决策。前者像搬砖，后者像一直在下棋，而且棋盘还不止一张。

说到底，今天这种工作状态和过去最大的心理差异，就是你越来越像坐在帅案前调兵遣将，而不是在前线战壕里只盯一个火力点。你要盯战线是不是在推进，哪个方向是主攻，哪个 agent 需要补上下文，哪个任务今天必须收口，哪个仓库可以先挂着。看起来你不怎么抡锤子了，实际上这玩意更耗命。过去是自己冲锋，现在是让一整条线别乱；过去是一个局部出问题自己扛着修，现在是多个上下文同时开着，任何一个判断失误都可能拖累全局。这就是为什么笔者最近越来越能理解“劳心”这两个字：AI 把你从琐碎中解放出来了，但它没有把你从疲惫中解放出来，它只是把疲惫的来源从手脚换到了脑子。

### 这件事逼着人成长了什么

当然，事情如果只到“更累”这一步，那也太亏了。幸好不是。AI 这套工作方式除了把人压得很紧之外，也确实逼着人长出了一些过去不那么容易长出来的东西。

第一，它几乎是半强迫地打破了人的敝帚自珍。以前很多程序员会天然地把价值感绑在一些很表层的熟练度上，比如我手写得快、模板熟、样板代码抄得顺、某些重复套路滚瓜烂熟。这些东西以前当然有用，但 AI 一上来最先碾过去的，恰恰就是这一层。于是人会被迫面对一个非常不舒服、但绕不过去的问题：如果这些我曾经引以为傲的表层熟练度，AI 现在也能做、甚至还能做得更快，那我身上真正不可替代的部分到底是什么？笔者自己的答案越来越明确：是创造力，是对问题本质的把握，是对领域的深度理解，是对边界、代价和长期后果的判断，是对“什么叫真的成立”的品味。

第二，它迫使人获得更高的视角。过去很多时候，人可以长期沉浸在局部实现里，因为大量时间本来就花在局部实现上；现在当多个 agent 同时开工之后，注意力天然会被抬高，因为不站高一点根本管不过来。将帅没工夫天天盯着一个碉堡怎么炸，他真正得盯的是哪条战线是主攻、哪条线只是佯攻、兵力分配是否合理、哪个点一旦失守会拖垮全局。映射回工程工作，就是哪些任务是主线、哪些只是噪音、哪些接口一定要先定、哪些内容必须先收敛判断再动手。说白了，这不是人突然变高级了，而是工作形态逼得人不站高一点就没法带。

第三，它逼着人学会多线程工作。坦白说，笔者自己以前并不是一个天然擅长多线程的人，我的惯性其实偏线性，容易一头扎进一个问题狠狠干到底。这个习惯本身不坏，但它越来越不适合今天这种同时和多个 agent、多个 repo、多个上下文打交道的工作形态。现在你必须学会在几个上下文之间快速切换，记住不同任务当前分别推进到哪里，知道哪个任务是在等输入、哪个任务是在等验证，在脑子里同时维护多个半打开的问题空间，还不能因为切换太频繁而彻底丢线。这套能力以前当然也有价值，但不是每天都被逼到墙角；现在如果学不会，根本吃不满这套工作流的效率红利。

### 我对 AI 产物与 AI 写作的态度

聊到这里，态度也该摆明了。笔者对 AI 产物的看法很直接：AI 本身不是原罪。垃圾文章和屎山代码不是模型自己凭空长出来的，真正该背锅的还是使用它的人。工具不负责目标，工具不负责品味，工具不负责边界，工具更不负责签字；负责这些事情的，永远是人。一个真正懂行的人，会先把问题定义清楚，把评价坐标钉住，把边界交代清楚，把真正关键的地方亲自盯住，让 AI 去跑那些机械性、重复性、可批量化的部分，再用自己的领域知识和审美把结果收回来。一个糊涂的人则恰恰相反：问题没定义清楚就开始生成，自己没有判断，只会接受第一版结果，不做复核，不对后果负责，最后生成一堆垃圾，再回头怪 AI 不靠谱。同一个工具，两种人用出来，当然是两个世界。

所以这件事我一点也不避讳：是的，笔者现在写代码会用 AI；是的，笔者现在写博客也会用 AI；而且我甚至会主动把自己过去的文风、句法习惯、论证方式和文章气口蒸馏进今天的写作流程里。因为我真正想保留的，从来不是“每个字都必须是我自己手敲”，而是文章里的判断是我的、问题定义是我的、边界意识是我的、最后拍板的那一下仍然是我的。AI 在这里不是替我成为作者，而是把我的想法更快地压到可见表面上。只要最后出来的内容确实是我所思所想，而且我愿意为它负责，这件事在我这里就是成立的。

如果一定要把这篇文章的最终判断压成一句话，那大概就是这样：AI 没有把人从劳动里解放出来，它只是把人从低密度劳动里赶了出来，然后把人扔进了更高密度、更高责任、更高脑力负担的劳动里。站在今天这个时点回头看，真正被改写的不是几行代码的生成速度，而是工作单元、并行度、文档与代码的关系、人的认知负载分布，以及人对自己价值的理解。过去的我更像战壕里的士兵，顶多算尖刀排排长；今天的我越来越像坐在帅案前调度部将、最后还得亲自签字的人。电脑和办公桌像沙盘，agent 像部将，而真正不能偷懒的东西，最后仍然是判断、方向、品味、边界和责任。

这件事当然很累，但我并不认为它是坏事。因为归根结底，人真正该值钱的，本来也不是手抡得多快，而是脑子到底在想什么，眼睛到底看多远，最后敢不敢为自己的判断负责。至于 AI，让它干活去吧；它本来就该干活。真正不能偷懒的，从来不是它，而是坐在帅案前、最后要签字的那个人。

## 参考资料

1. [@openai-chatgpt] OpenAI, “ChatGPT”, `2022-11-30`：<https://openai.com/blog/chatgpt>
2. [@openai-gpt4] OpenAI, “GPT-4”, `2023-03-14`：<https://openai.com/research/gpt-4>
3. [@llm-survey] Zhao et al., “A Survey of Large Language Models”，始于 `2023-03-31`，截至 `2026-03-18` 仍在持续更新，当前 arXiv `v19`：<https://arxiv.org/abs/2303.18223>
4. [@react] Yao et al., “ReAct: Synergizing Reasoning and Acting in Language Models”, `2022`：<https://arxiv.org/abs/2210.03629>
5. [@toolformer] Schick et al., “Toolformer: Language Models Can Teach Themselves to Use Tools”, `2023`：<https://arxiv.org/abs/2302.04761>
6. [@reflexion] Shinn et al., “Reflexion: Language Agents with Verbal Reinforcement Learning”, `2023`：<https://arxiv.org/abs/2303.11366>
7. [@voyager] Wang et al., “Voyager: An Open-Ended Embodied Agent with Large Language Models”, `2023`：<https://arxiv.org/abs/2305.16291>
8. [@autonomous-agent-survey] Xi et al., “The Rise and Potential of Large Language Model Based Agents: A Survey”, `2023`：<https://arxiv.org/abs/2309.07864>
9. [@agent-rise-survey] Wang et al., “A Survey on Large Language Model based Autonomous Agents”, `2023`：<https://arxiv.org/abs/2308.11432>
10. [@swe-bench] Jimenez et al., “SWE-bench: Can Language Models Resolve Real-World GitHub Issues?”, `2024`：<https://arxiv.org/abs/2310.06770>
11. [@openai-gpt4o] OpenAI, “Hello GPT-4o”, `2024-05-13`：<https://openai.com/index/hello-gpt-4o/>
12. [@openai-o1] OpenAI, “Introducing OpenAI o1-preview”, `2024-09-12`：<https://openai.com/index/introducing-openai-o1-preview/>
13. [@swe-agent] Yang et al., “SWE-agent: Agent-Computer Interfaces Enable Automated Software Engineering”, `2024`：<https://arxiv.org/abs/2405.15793>
14. [@agentless] Xia et al., “Agentless: Demystifying LLM-based Software Engineering Agents”, `2024`：<https://arxiv.org/abs/2407.01489>
15. [@se-agent-survey] Wang et al., “A Survey of Software Engineering Agents”, `2024`：<https://arxiv.org/abs/2409.02977>
16. [@anthropic-api-notes] Anthropic, API release notes，含 `Claude Sonnet 3.7`、`Claude Sonnet 4.x` 等时间线：<https://docs.anthropic.com/en/release-notes/api>
17. [@copilot-agent] GitHub, “GitHub Copilot: The Agent Awakens”, `2025-02-06`：<https://github.blog/news-insights/product-news/github-copilot-the-agent-awakens/>
18. [@google-jules] Google, “Jules: an asynchronous coding agent”, `2025-05-20`：<https://blog.google/technology/google-labs/jules/>
19. [@openai-codex-preview] OpenAI, “Introducing Codex”, `2025-05-16`：<https://openai.com/index/introducing-codex/>
20. [@openai-codex-ga] OpenAI, “Codex is now generally available”, `2025-10-06`：<https://openai.com/index/codex-generally-available/>
21. [@anthropic-claude-code] Anthropic, “How Anthropic teams use Claude Code”, `2026-03-04`：<https://www.anthropic.com/customers/how-anthropic-teams-use-claude-code>
22. [@anthropic-agentic-report] Anthropic, “2026 Agentic Coding Trends Report” PDF：<https://resources.anthropic.com/hubfs/2026%20Agentic%20Coding%20Trends%20Report.pdf>
23. [@genai-reshaping-dev] “How early adopters are reshaping software development with GenAI”, `2025`：<https://arxiv.org/abs/2503.05012>
24. [@cognition-devin] Cognition, “Introducing Devin, the first AI software engineer”, `2024-03-12`：<https://cognition.ai/blog/introducing-devin>
25. [@anthropic-computer-use] Anthropic, “Claude 3.5 Sonnet, Claude 3.5 Haiku, and computer use”, `2024-10-22`：<https://www.anthropic.com/news/3-5-models-and-computer-use>
26. [@copilot-agents-panel] GitHub Changelog, “Agents panel for GitHub Copilot in VS Code is now generally available”, `2025-08-19`：<https://github.blog/changelog/2025-08-19-agents-panel-for-github-copilot-in-vs-code-is-now-generally-available/>
27. [@openai-gpt5-dev] OpenAI, “GPT-5 for developers”, `2025-08-07`：<https://openai.com/index/introducing-gpt-5-for-developers/>
