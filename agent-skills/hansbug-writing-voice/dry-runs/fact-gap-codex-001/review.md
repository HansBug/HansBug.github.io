样本版本：`sample-manifest.json` schemaVersion 2  
对照 sample ids：`cnblogs-8701447`, `cnblogs-14711869`  
最后更新：2026-06-16 / PR-5  
机械粗筛：已用 `agent-skills/hansbug-writing-voice/scripts/check_hansbug_voice.py` 对原草稿临时文件运行，命中 `unsupported-first-person-experience` 与 `missing-boundary-section`，状态为 `fail`。

C 级问题：

- C1 `[unsupported-first-person-experience]` 原文“笔者曾经在一个大型项目现场负责过脚本治理”是无来源第一人称项目现场经历。
  修复：改为“需要作者补充真实材料”，不能写成事实。
- C2 `[unsupported-first-person-experience]` 原文“当时团队内部开会决定统一改造所有工具”是无来源会议 / 内部决策经历。
  修复：要求作者补充会议背景或删去。
- C3 `[unsupported-first-person-experience]` 原文“我们上线过一套完整流程”是无来源上线经历。
  修复：要求补流程、范围、结果和证据，否则降格为一般建议。
- C4 `[missing-boundary-section]` 原文“所有项目都直接照搬”“一次性做完”没有适用边界，且把未确认经验扩成普遍真理。
  修复：补适用条件、失败方式和不适用场景。

I=0

M 级建议：

- M1 原标题“背景 / 方案 / 总结”偏平，可以后续改成更带判断的标题，但本轮重点是 fact-gap，不强行润色。
- M2 修订稿已保留一点作者式判断，但没有继续增强文风，因为事实材料不足时不应靠语气补洞。

C=0
I=0
M=0
