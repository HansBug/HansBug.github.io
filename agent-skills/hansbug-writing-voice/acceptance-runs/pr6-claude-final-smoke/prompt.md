你正在为 HansBug/HansBug.github.io 仓库执行 PR-6 最终真实 CLI smoke。请严格遵守：不要修改仓库文件，不要启动 sub-subagent，不要访问 `.cache/hansbug-writing-voice/corpus/`，不要编造作者真实经历、课程现场、项目现场或会议经历。

任务：
1. 先读取并遵守 `CLAUDE.md` 中的 “HansBug 文风 Skill 强入口”。
2. 再读取并执行 `agent-skills/hansbug-writing-voice/SKILL.md`，按任务模式表判断本任务属于“写作”。
3. 本 smoke 为最终入口验收，不是普通骨架草稿。你必须实际读取并在输出里列出写作模式对应 references：`references/corpus-policy.md`、`references/voice-profile.md`、`references/article-archetypes.md`、`references/macro-logic.md`、`references/micro-patterns.md`、`references/prompt-recipes.md`；不得只说“理论上应读”。
4. 写一段短技术实践文骨架，主题是“为什么仓库维护脚本需要把失败路径写清楚”。已知事实只有：面向个人技术博客仓库维护；核心判断是“脚本失败不可怕，失败后没有清晰路径才可怕”；边界是“不讨论线上业务容灾”；需要声明样本对照 `cnblogs-8701447` 和 `cnblogs-14711869`。
5. 必须显式写出你使用了 `CLAUDE.md` 和 `agent-skills/hansbug-writing-voice/SKILL.md` 两个入口路径，并说明按任务模式表选择了哪些 references。必须明确没有作者事实材料时不能编造项目、会议、课程、上线现场。
6. 最终输出只用中文，不要包进 fenced code block，不要输出 `★ Insight`、装饰线 insight、内部思考、策略注释或“我先如何处理”的元解释。最后必须有一行 `最终自审：C=0 / I=0 / M=<数字>`，这里的自审是对你本次 smoke 输出本身的自审；如果你的输出仍有 C/I，先修掉再给最终自审。
