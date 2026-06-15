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

当前 taskType: `review`，cli: `claude`。

# 任务输入：审阅候选稿

请审阅下面这段候选稿是否像 HansBug 中文技术博客正文，按 C/I/M 给出问题与修法。

候选稿：

<!-- hansbug-voice-samples: cnblogs-8701447, cnblogs-14711869 -->

## 背景

这个工具可以帮助用户完成配置。它整体上比较方便，也具有一定参考价值。使用者只需要按照步骤执行，就可以得到结果。

## 使用方式

首先安装依赖，然后运行命令，最后查看输出。总体而言，这个流程可以提升效率。

## 总结

综上所述，这个工具是有意义的，后续可以不断优化。

审阅要求：

- 必须区分文风问题和事实来源问题。
- 必须指出是否存在 AI 腔、边界缺失、判断不足。
- 不要只说“感觉不像”。
