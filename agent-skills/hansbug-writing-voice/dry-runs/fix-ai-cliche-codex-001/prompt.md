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

当前 taskType: `fix-ai-cliche`，cli: `codex`。

# 任务输入：反向压力测试 / 修复 AI 腔

下面这段草稿故意写得很 AI 腔，并且有高口癖密度、低判断密度、无边界的问题。请先判 C/I/M，再给出修复稿。

草稿：

<!-- hansbug-voice-samples: cnblogs-8701447, cnblogs-14711869 -->

## 背景

咳咳，笔者认为这个工具总体而言具有重要意义。好吧，可以看出它能够提升效率。值得注意的是，随着技术的发展，这类工具有积极意义，也有参考价值。

## 方案

用户可以按照步骤操作，首先准备环境，然后执行命令，最后不断优化。咳咳，笔者觉得这件事很好。

## 总结

综上所述，这个工具值得使用。2333。

修复要求：

- 必须明确这是 issue #25 的反向压力测试。
- 必须指出“高口癖密度 + 低判断密度 / 无边界 / AI 腔正确废话”。
- 修复稿要补主问题、边界、核心判断和总结盖章。
