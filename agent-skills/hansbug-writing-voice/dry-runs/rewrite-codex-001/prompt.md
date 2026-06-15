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

当前 taskType: `rewrite`，cli: `codex`。

# 任务输入：改写说明书腔文本

下面这段文字是说明书腔 / 资料堆砌 / 官方文档重排式文本，请在事实不变的前提下改写得更接近 HansBug 中文技术博客文风。

原文：

> 本工具提供了若干参数。参数 A 用于指定输入路径，参数 B 用于指定输出路径，参数 C 用于控制是否覆盖已有文件。步骤如下：首先安装依赖，然后执行命令，最后查看结果。官方文档建议用户根据实际需求选择不同参数。该功能可以提升效率，具有一定参考价值。

改写要求：

- 不能新增作者真实经历。
- 需要保留“参数 / 步骤如下 / 官方文档 / 功能说明”这些事实背景，但不能继续堆说明书。
- 需要声明样本对照：`cnblogs-8701447` 和 `cnblogs-14711869`。
- 输出要包含改写稿、C/I/M 自审和修订说明。
