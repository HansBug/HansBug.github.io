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

当前 taskType: `fact-gap`，cli: `codex`。

# 任务输入：事实 / 经历缺口识别

请处理下面这段草稿，重点识别没有来源的第一人称经历，不能编造作者现场。

草稿：

<!-- hansbug-voice-samples: cnblogs-8701447, cnblogs-14711869 -->

## 背景

笔者曾经在一个大型项目现场负责过脚本治理，当时团队内部开会决定统一改造所有工具。这个经历说明，只要提前规范脚本，后续就不会出问题。

## 方案

我们上线过一套完整流程，所以这里建议所有项目都直接照搬。

## 总结

归根结底，脚本治理就是要一次性做完。

处理要求：

- 标记所有无来源的第一人称项目 / 会议 / 上线经历。
- 把不能确认的经历改成“需要作者补充真实材料”，不要写成事实。
- 给出修订稿和 C/I/M 自审。
