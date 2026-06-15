你正在为 HansBug/HansBug.github.io 仓库执行 PR-5 真实 CLI forward-test。

硬性要求：
1. 先阅读并遵守 `CLAUDE.md` 的 “HansBug 文风 Skill 强入口”。
2. 再阅读并执行 `agent-skills/hansbug-writing-voice/SKILL.md`，按任务模式渐进读取 references，不要默认全量加载。
3. 不要启动 sub-subagent，不要修改仓库文件，不要访问 `.cache/hansbug-writing-voice/corpus/`。
4. 不要编造作者真实经历、课程现场、项目现场、会议经历或第一手态度。缺少事实时必须标记需要作者补充。
5. 输出必须是中文，并严格使用下面三个 Markdown 标题：

## draft
（你的构思/正文/改写稿/审阅稿主体）

## review
（按 C/I/M 自审；必须写 `C=0` 或列出 C，必须写 `I=0` 或列出 I）

## revision
（说明你如何根据自审修订，若无需修订也说明原因）

输出中必须包含 `CLAUDE.md` 和 `agent-skills/hansbug-writing-voice/SKILL.md` 这两个入口路径，方便验收确认入口被使用。

当前 taskType: `write`，cli: `claude`。

# 任务输入：写短技术实践文

请写一篇短技术实践文初稿，主题是“为什么本地开发脚本需要把失败路径写清楚”。

已知事实：

- 面向维护个人技术博客仓库的 agent / 协作者。
- 核心观点：脚本失败不可怕，失败后没有清晰路径才可怕。
- 必须写清适用边界：只讨论仓库维护脚本，不讨论线上业务容灾。
- 不能编造作者在某公司或某课程中的真实事故。
- 需要声明样本对照：`cnblogs-8701447` 和 `cnblogs-14711869`。

要求：至少有 2 个二级标题，包含边界/坑点章节和总结章节。
