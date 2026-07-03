---
title: "Tutorial 不是 Reference：技术文档四象限与教程工程验收"
description: "本文用 Diátaxis 四象限重新拆开 tutorial、how-to、reference 和 explanation 的边界，重点说明一篇技术教程怎样保护学习路径，并怎样用机器验收和真人任务测试把它真正验住。"
pubDate: 2026-07-03
tags:
  - 工程效率
  - 知识管理
  - 开源维护
difficulty: "实践"
excerpt: "好教程不是把资料塞满，而是带读者获得第一次可重复的理解。Reference 查事实，how-to 做任务，explanation 讲为什么；tutorial 最怕的是把这三位邻居全请进主线，然后假装自己很完整。"
draft: false
pinned: false
bibliography: ./tutorial-documentation-quadrants.bib
citationStyle: hansbug-numeric-superscript
---

<!-- hansbug-voice-samples: cnblogs-8701447, cnblogs-14711869, cnblogs-15894649 -->

最近这段时间，笔者又被一个老问题反复追着打：为什么很多技术教程看起来很努力，命令、参数、背景、链接、截图一个不缺，读者照着走却还是一脸懵？

这事最烦人的地方在于，它通常不是“作者不认真”。恰恰相反，很多坏教程坏在作者太认真：怕读者不知道背景，于是先讲架构；怕读者以后查不到参数，于是把 reference 摊开；怕读者遇到真实任务，于是顺手塞几个 how-to 分支；怕文章不够有深度，于是又补一段设计哲学。最后整篇文档像一锅加了太多料的汤，闻起来很热闹，入口只剩混乱。

所以本文真正要讲的不是“技术文档怎样写得体面”，而是一个更硬的问题：**当我们说一篇 tutorial 是合格的，它到底应该满足什么结构、边界和验收条件？**

先把结论拍在桌上：**tutorial 的核心不是资料完整，而是学习路径成立。** Reference 负责查准事实，how-to guide 负责完成任务，explanation 负责建立理解，而 tutorial 负责带读者获得第一次可重复的理解。把这四件事混成一件事，看起来像照顾读者，实际上是在把读者按进信息泥潭里游泳。

## 先说为什么会混：几条传统都对，但挤在一起就出事

技术文档今天这么容易混，不是凭空来的。它背后有几条非常强的传统，而且每条传统都很正经。

首先是 manual / man page 这一类 reference 传统。1971 年第一版 Unix Programmer's Manual 就已经把命令、系统调用、库例程、文件格式等分门别类列出来[@unix_programmers_manual_1971]。这套东西的价值很清楚：你要查一个命令到底是什么、接口有什么能力、系统边界在哪里，它必须准确、可扫描、可查证。

然后是 HOWTO 传统。Linux Documentation Project 的页面直到今天仍能看到 HOWTO、Guides、FAQs、man pages 这类形态并列存在[@linux_documentation_project_guides]。HOWTO 解决的是“我现在要把某件事做成”。它的气质很实用，甚至有一点救火味：别先跟我讲宇宙的本质，我先把网卡、内核模块、双系统或者某个服务配出来再说。

再往另一边看，还有 literate programming 和 notebook 这条叙事传统。Knuth 当年谈 literate programming，核心不是把代码变得花哨，而是强调程序也应该按人的理解顺序来组织[@knuth_literate_programming]；Jupyter 则把代码、叙事和输出放在同一个计算叙事容器里[@jupyter_computational_narratives]。这条线给技术写作带来的启发很大：代码不只是执行材料，也可以是解释材料。

最后是 docs-as-code 和可验证文档传统。Rustdoc documentation tests 可以让文档里的示例代码进入测试语境[@rustdoc_documentation_tests]，GitLab 文档也把 lint、链接、Vale、图片路径等检查放进文档测试链路[@gitlab_documentation_testing]。这条线提醒我们：文档不是写完发布就算完，它也可以进入工程验收。

问题来了：这些传统都对，为什么 tutorial 还是会坏？

原因很简单——它们解决的是不同读者动作。Reference 要查准事实，HOWTO 要完成任务，解释性叙事要建立心智模型，docs-as-code 要让材料别坏。它们都很重要，但不能一起挤进 tutorial 的学习主线。说白了，不是资料不重要，而是资料站错了位置。

## Diátaxis 不是四个筐，而是一张写作坐标图

这里就该把 Diátaxis 请出来了。Diátaxis 把技术文档拆成 tutorials、how-to guides、reference 和 explanation 四种模式，并明确说这四类对应的是用户不同需求[@diataxis_overview]。更关键的是，它不是让我们给页面贴标签玩，而是提供了一张坐标图。

![Diátaxis 四象限本地示意图](/images/blog/engineering/diataxis-compass.svg)

*图 1：本站自绘的 Diátaxis 四象限示意图，based on the Diátaxis compass[@diataxis_compass]。*

这张图要先看两条轴。

纵轴是 **Action / Cognition**：读者此刻是在做，还是在理解。横轴是 **Acquisition / Application**：读者是在获得新能力，还是在应用已有能力。Diátaxis compass 甚至把问题压成两问：action or cognition？acquisition or application？[@diataxis_compass]

顺着这两条轴走一圈，四类文档的位置就清楚了：

| 模式 | 坐标 | 读者问题 | 主承诺 | 最怕什么 |
|---|---|---|---|---|
| Tutorial | Action + Acquisition | 我第一次怎样学会？ | 带读者走过一条安全、可复现、有学习反馈的路径 | 还没成功先讲架构，或者把参数大全塞进来 |
| How-to guides | Action + Application | 我现在怎样完成这个任务？ | 帮已有基本背景的读者把具体任务做成 | 反复讲新手基础，一个页面塞多个任务 |
| Reference | Cognition + Application | 这个字段、命令、参数到底是什么？ | 提供准确、完整、可扫描的事实结构 | 写故事、写路线、让查事实的人读长篇叙事 |
| Explanation | Cognition + Acquisition | 为什么这样设计？ | 建立心智模型，讲清背景、关系和取舍 | 抢走 tutorial 主线，让读者迟迟看不到反馈 |

一句话版就是：tutorial 带我学会一次；how-to 告诉我这件事怎么做；reference 让我查准事实；explanation 让我理解为什么。

但这里必须补一句，否则 Diátaxis 很容易被用成另一种文档洁癖：**局部混合可以接受，主承诺混乱不可以。** 一个 tutorial 里当然可以有少量解释，一个 reference 里当然可以有例子，一个 how-to 里也可以提醒概念。问题不在“有没有混合元素”，而在页面主承诺是不是已经糊掉。刀要切在主承诺上，不要切在表面元素上。

## Tutorial 的真正任务：带读者获得第一次可重复的理解

Diátaxis 对 tutorial 的定义很硬：tutorial 总是 learning-oriented，它服务的是用户技能和知识的 acquisition / study，而不是直接帮用户完成一个工作任务[@diataxis_tutorials]。这句话如果只当概念看，似乎没什么；真落到写作，就会挡住一大堆偷懒写法。

Tutorial 不是“有步骤的文章”。有步骤的不一定是 tutorial，Kubernetes 的 ConfigMap 页面是典型任务页，它的主承诺是帮读者把 ConfigMap 接到 Pod 里[@kubernetes_configmap_task]；Google style guide 对 procedures 的建议也很明确：过程文档应围绕任务步骤、上下文、动作、输出组织[@google_procedures]。这些都很有用，但它们不是 tutorial 的全部。

Tutorial 的任务，是设计一条学习路径。读者跟着走，不只是“完成了某个玩具任务”，而是获得了下一次能独立复现的理解。Django 的 first app 教程把项目创建、开发服务器、视图和 URL 逐步串起来[@django_first_app]；Rust guessing game 则用一个稍长的小项目承载变量、输入、随机数、匹配、循环等语言概念[@rust_guessing_game]。后者不是因为长就变成 explanation，也不是因为有任务就变成 how-to。它属于 **learning-oriented tutorial**：学习目标更大，阶段反馈也必须更清楚。

所以我更愿意把 tutorial 分成两档：

1. **minimal tutorial / quickstart 型**：目标是尽快形成第一层反馈，比如安装后跑出第一个页面、第一个命令、第一个 hello world。
2. **learning-oriented tutorial / 教材型**：目标是用一个小项目逐步建立概念，篇幅可以更长，但每一段都要有清晰阶段反馈。

这两档都成立。判断标准不是“短不短”，而是学习路径有没有被设计过。

这也解释了为什么“第一条成功路径”那么重要。Tutorial 里需要可观测成功标志，但成功标志不能只理解成“命令跑完了”。至少有两类反馈：一类是**即时输出**，比如服务启动、测试通过、页面出现预期内容；另一类是**阶段自检**，比如读者能不能说清刚才那一步把哪个概念接了起来。前者让读者知道材料没坏，后者让读者知道自己不是在机械抄咒语。

好吧，这里可以说得再刻薄一点：如果读者只会把命令复制完，但不知道刚才连接了什么东西，那不是教程成功，是打字员训练成功。

## 另外三位邻居：别让它们抢戏

How-to guide 的读者状态和 tutorial 不一样；Diátaxis 对 how-to guides 的定位也正是帮助读者完成现实任务[@diataxis_howto]。它默认读者已经有一定背景，现在要完成一个具体任务。Django 的 custom management command 页面就是很好的 how-to 样本：它不从“Django 是什么”讲起，而是直接围绕如何创建自定义 `django-admin` 命令展开[@django_custom_commands]。这类页面最重要的是任务边界、前置条件、步骤顺序和失败恢复。

Reference 更冷。Diátaxis 对 reference 的要求是提供事实性、可查证的信息，而不是教学叙事[@diataxis_reference]。Django model field reference 的中心是字段、选项、默认值、类型和事实结构[@django_model_field_reference]。读者来这里不是为了被带着走一遍，而是为了查“这个字段到底能不能这样用”。Reference 像地图，不像导游词。地图如果写成游记，读者会想把作者请出去冷静一下。

Explanation 负责另一件事：讲清为什么；Diátaxis 也把 explanation 放在理解背景、原因和关系的位置[@diataxis_explanation]。Next.js 的 rendering philosophy 这类页面，主承诺就是解释渲染模型背后的设计思路和取舍[@nextjs_rendering_philosophy]；Kubernetes cluster architecture 则是把控制平面、节点、组件关系这些系统结构讲清楚[@kubernetes_cluster_architecture]。Explanation 的价值很高，但它最容易把 tutorial 诱拐走。因为作者一旦觉得“这个背景必须讲清楚”，教程的第一条反馈就会被拖到十几屏之后。读者还没跑起来，先被一辆满载概念的卡车碾过去了。

所以这三位邻居不是敌人，而是邻居。该串门时串门，该回家时回家。Tutorial 里可以链接 reference，可以点到 explanation，可以在结尾导向 how-to；但它们不能搬进客厅当主人。

## 好 tutorial 的内部结构：从学习目标倒推

如果把 tutorial 当学习路径，而不是当资料合集，它的结构就能倒推出来。

| 部件 | 作用 | 失败信号 |
|---|---|---|
| 学习目标 | 说明读者会获得什么能力 | 只写“本文介绍 X”，没有说读者能做什么 |
| 目标读者 | 说明谁适合读 | 新手和熟手都被塞进同一路径 |
| 前置条件 | 把环境、账号、权限、版本钉住 | 读者跑到一半才发现缺东西 |
| 非目标 | 明确本文不讲什么 | 一篇教程背完整个宇宙 |
| 路径步骤 | 按学习顺序安排动作 | 分支过早、解释过量、跳步严重 |
| 可观测成功标志 | 覆盖即时输出与阶段自检 | 命令跑没跑通不知道，学没学会也不知道 |
| 失败恢复 | 给高频失败方式留出口 | 一偏离 happy path 就掉进井里 |
| 下一步 | 导向 how-to / reference / explanation | 教程结束后读者仍不知道去哪 |

The Good Docs Project 的 tutorial template 也把学习目标、目标读者、前置背景、before you begin、steps、summary、next steps 等结构列出来[@gooddocs_tutorial_template]。这说明好 tutorial 并不是靠作者现场发挥玄学，它确实有可以检查的骨架。

但骨架不是模板崇拜。模板只能提醒你该问什么，不能替你判断取舍。真正难的是：哪些解释现在必须讲，哪些解释应该推迟；哪些任务可以进入第一条路径，哪些应该挪到后续 how-to；哪个输出是读者能看懂的成功标志，哪个输出只是作者自己看着舒服。

这就是教程写作里最容易被糊弄过去的地方。很多文章不是没有结构，而是结构不服务学习。

## 复杂工具怎么办：拆体系，不要堆长文

复杂工具当然不可能靠一篇 tutorial 讲完。真正靠谱的文档体系，往往长得像这样：

```text
Tutorials/
  - 最小成功闭环
  - 第一个真实项目
  - 进阶学习路径
How-to guides/
  - 如何接入 CI
  - 如何迁移旧项目
  - 如何处理常见错误
Reference/
  - CLI 参数
  - 配置文件 schema
  - API / SDK reference
Explanation/
  - 架构设计
  - 核心概念
  - 取舍与边界
```

这不是为了把目录做得漂亮，而是为了让读者动作少打架。学习时走 tutorial，做任务时看 how-to，查事实时看 reference，想理解设计时读 explanation。每类文档都可以互相链接，但不要互相冒充。

如果项目已经有一大坨混合文档，也不用一上来就重构全站。先拿 Diátaxis compass 给现有页面标主承诺：这个页面主要在服务 action 还是 cognition？服务 acquisition 还是 application？再找最伤读者的页面动刀。通常最该先修的，不是目录名不好看，而是第一条学习路径断了。

说白了，复杂系统当然可以有复杂结构，但不能把不同目的的文字混成一锅。那不是降低门槛，是把门槛拆碎了铺在地上，读者每走一步都要扎脚。

## 工程验收：机器验证材料，真人验证路径

Tutorial 写完以后，不能只靠作者自己读一遍说“挺顺”。它至少需要两条腿。

第一条腿是**机器验收**：材料没坏。示例代码和命令能不能运行？输出是不是来自真实工具行为？链接和交叉引用是否还有效？版本敏感内容有没有写明版本或日期？Google 的 code samples 指南强调示例要清晰、能被复制使用、并避免让读者踩不必要的坑[@google_code_samples]；timeless documentation 则提醒作者少写会快速过期的“现在 / 当前 / 最新”之类表达[@google_timeless_documentation]。这些都属于材料层面的工程护栏。

机器验收可以包括 doctest、文档测试、link check、Markdown lint、术语检查、危险示例扫描。Rustdoc tests 和 GitLab documentation testing 都是这条线上的例子[@rustdoc_documentation_tests; @gitlab_documentation_testing]。它们证明不了教程好，但能防止教程坏得太低级。

第二条腿是**真人任务测试**：路径没断。NN/g 对 usability testing 的描述非常朴素：让参与者执行任务，研究者观察他们的行为和反馈[@nng_usability_testing]；任务场景还需要给参与者一个真实可理解的目标，而不是抽象命令[@nng_task_scenarios]。放到 tutorial 上，就是找目标读者按教程独立走关键路径，观察他在哪一步停顿、哪句话误解、失败后有没有恢复路径、结束后是否知道下一步去哪。

这里的盖章句可以很硬：**CI 证明材料没坏，真人任务测试证明路径没断。少任何一条，教程都只能算“看起来能用”。**

## 阻断级 checklist：教程 PR 到底该审什么

如果要把上面这些话落到 PR review，我建议至少用下面这份阻断级 checklist。它不是装饰，是挡住烂教程的门槛。

### A. 模式与目标

- [ ] 这篇文档的主模式已经明确：tutorial / how-to / reference / explanation。
- [ ] 如果它是 tutorial，学习目标能用一句话说清。
- [ ] 它没有把 reference、explanation 或多个 how-to 任务塞进 tutorial 主线。

### B. 路径与反馈

- [ ] 读者能在教程中完成一个最小成功闭环。
- [ ] 每个关键阶段都有可观测成功标志，且同时照顾即时输出和阶段自检。
- [ ] 失败后读者知道当前可能错在哪里，以及下一步查什么。
- [ ] 教程结尾给出明确下一步：继续 tutorial、进入 how-to、查 reference，或读 explanation。

### C. 示例与材料

- [ ] 关键命令 / 代码 / 输出来自真实运行，或明确标注不能自动运行。
- [ ] 示例使用安全假数据或保留域名，不硬编码真实 token、密码、私钥。
- [ ] 版本敏感内容写明版本号或日期，不靠 `latest`、`current`、`now` 这类词撑场面。

### D. 验收与维护

- [ ] 文档构建、链接、交叉引用和基础 lint 通过。
- [ ] 可执行示例进入 doctest / 文档测试 / 等价 CI，或明确说明人工验证方式。
- [ ] 至少一次由目标读者按教程独立走过关键路径，且卡点被记录和处理。

这份阻断级 checklist 的价值在于，它逼你问一个不那么体面的问题：这篇教程到底是带读者学会了，还是只是把作者知道的东西摊出来了？

反模式也可以集中收束成一组：参数大全冒充教程；架构论文开局；没有最小成功闭环；命令和输出靠想象；解释过量；版本、账号、权限全靠读者猜；没有失败恢复；PR review 只看格式，路径断了也没人管。

其中最毒的一条大概是最后一条。错别字都修了，读者还是走不通。这种 review 看起来很认真，实际上全在给事故擦边框。

## 拿自己的旧材料试刀：treevalue 与 Issue / Milestone

外部案例讲多了，文章很容易变成资料综述。这里还是拿自己的旧材料试一刀。

先说 treevalue。这里不能倒过来吹牛，说当年做 treevalue 文档时已经系统采用 Diátaxis。没有。更准确的说法是：今天站在新的文档思维框架下，回头看一个真实开源项目天然会长出哪些不同类型的说明。

例如 treevalue v1.5.0 文档里，installation 页面主要解决安装和 CLI 初验问题[@treevalue_installation_150]；仓库 README 则承担概览、getting started、quick usage、性能、贡献和 citation 等入口责任[@treevalue_repository]；旧文《treevalue——Master Nested Data Like Tensor》更像面向项目价值和设计意图的介绍文章[@hansbug_treevalue_old_blog]。这些材料不必都叫 tutorial。有人第一次跑起来，有人查 API，有人想理解为什么要把嵌套数据做成 tensor-like 的样子，这本来就是不同读者动作。

拿 treevalue 回头看，最有意思的地方不是“当年是否按 Diátaxis 设计过”，而是一个真实开源项目天然会遇到四类需求。如果把 quickstart、安装说明、API 参考、设计解释全塞进一篇所谓“入门教程”，看起来照顾新手，实际上是在把新手拖进信息泥潭里游泳。

再看旧文《关于 Issue/Milestone 的使用指导》[@hansbug_issue_milestone_old_blog]。它更接近给学生 / 团队成员的操作指南，而不是 tutorial。读者的目标不是第一次理解“协作管理是什么”，而是在已有课程或团队语境下，把 issue、milestone、任务拆分、进度跟踪这些动作做起来。换句话说，它的主承诺更像 how-to：我现在怎样把协作流程跑顺。

这两个例子放在这里，不是为了证明自家材料多么标准，而是为了提醒自己：框架只有拿回真实材料里试刀，才知道是不是能切开问题。只在外部案例上讲道理，文章很容易显得很对，也很飘。

## 总结：别把资料密度误认为教学质量

最后收一下。

Tutorial 不是 reference。Reference 的尊严在准确，tutorial 的尊严在路径。How-to 的尊严在把任务做成，explanation 的尊严在把为什么讲透。四类文档谁也不比谁高级，但谁也不该冒充谁。

写 tutorial 最容易犯的错，就是把作者的不安全感转嫁给读者：我怕你不知道，所以我全写上；我怕你以后要查，所以我全塞进来；我怕你误解，所以我先讲半天背景。结果读者还没获得第一次成功反馈，先被作者的焦虑压垮了。

真正好的 tutorial 要反过来：少一点炫耀资料密度，多一点路径纪律；少一点“我知道很多”，多一点“你现在应该看到什么”；少一点万能长文，多一点可复现的第一步。

说到底，文档也是工程资产。工程资产不是堆在那里显得很多，而是关键时刻真的能用。教程尤其如此——它不是把知识摆在读者面前，而是把读者带到能自己继续走的地方。

别把这事想得太轻。一个走不通的 tutorial，伤的不是一页文档的面子，而是读者对整个项目的第一层信任。

### 参考文献

[^ref]
