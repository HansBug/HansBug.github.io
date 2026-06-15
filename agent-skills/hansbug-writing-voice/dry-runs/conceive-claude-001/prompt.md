你正在为 HansBug/HansBug.github.io 仓库执行 PR-5 真实 CLI forward-test。

硬性要求：
1. 先阅读并遵守 `CLAUDE.md` 的 “HansBug 文风 Skill 强入口”。
2. 再阅读并执行 `agent-skills/hansbug-writing-voice/SKILL.md`，按任务模式渐进读取 references，不要默认全量加载。
3. 不要启动 sub-subagent，不要修改仓库文件，不要访问 `.cache/hansbug-writing-voice/corpus/`。
4. 不要编造作者真实经历、课程现场、项目现场、会议经历或第一手态度。缺少事实时必须标记需要作者补充。
5. 输出必须是中文，并严格使用下面三个 Markdown 标题，不能少、不能改名、不能把整段输出包进 fenced code block：

## draft
（你的构思 / 正文 / 改写稿 / 对候选稿的审阅主体 / 事实缺口处理主体。若任务本身要求审阅候选稿或识别事实缺口，请把对“输入材料”的 C/I/M 判定放在这里，而不是放在最终自审里。）

## review
（这是对你本次 dry-run 输出本身的最终自审，不是对输入候选稿的审阅结论。必须写成 `C=0 / I=0 / M=<数字>` 或列出未修复 C/I；如果发现你自己的输出还有 C/I，先在 revision 中修掉，再让最终自审达到 C=0 / I=0。不能为了通过验收谎写 0。）

## revision
（说明你如何根据自审修订；如果没有 C/I，说明为什么无需阻断性修订。不得再引入新的正文主体。）

写作类任务额外硬要求：
- `write` / `rewrite` / `fix-ai-cliche` 的 `## draft` 必须是可以直接喂给 `check_hansbug_voice.py` 的 Markdown 正文片段。
- 这些正文片段第一行必须写：`<!-- hansbug-voice-samples: cnblogs-8701447, cnblogs-14711869 -->`。
- 这些正文片段必须使用真正的 Markdown 二级标题 `## ...`，至少包含边界 / 坑点类章节和总结类章节。不要用 `【标题】` 冒充二级标题。
- 不要把 AI 腔反例里的“总体而言 / 值得注意的是 / 可以看出 / 具有重要意义 / 综上所述 / 积极意义 / 参考价值 / 随着技术的发展”等词原样带进修复后的正文。

输出中必须包含 `CLAUDE.md` 和 `agent-skills/hansbug-writing-voice/SKILL.md` 这两个入口路径，方便验收确认入口被使用。

当前 taskType: `conceive`，cli: `claude`。

# 任务输入：构思技术实践文

请构思一篇面向中文技术读者的博客，主题是“把一个临时脚本改造成可维护的仓库内工具”。

已知事实：

- 场景是个人技术博客仓库中的维护脚本。
- 问题不是脚本能不能跑，而是长期维护时会不会让后续 agent 和作者都踩坑。
- 不能编造作者真实项目经历，只能基于这个抽象场景给构思。
- 需要声明样本对照：`cnblogs-8701447` 和 `cnblogs-14711869`。

输出需要包含主问题、边界、核心判断、章节推进和事实缺口。
