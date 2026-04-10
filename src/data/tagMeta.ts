type TagMeta = {
  group: string;
  description: string;
  accent: "orange" | "teal" | "slate" | "green" | "blue" | "red";
};

export const tagMeta: Record<string, TagMeta> = {
  "工程效率": {
    group: "工程实践",
    description: "围绕节奏、流程、工具和执行质量展开的工程经验。",
    accent: "orange",
  },
  "Git 协作": {
    group: "工程实践",
    description: "关于分支策略、提交规范、协作边界和仓库治理的讨论。",
    accent: "slate",
  },
  "CI/CD": {
    group: "工程实践",
    description: "从构建、测试到部署链路的自动化与稳态维护。",
    accent: "orange",
  },
  "Python 工具链": {
    group: "编程语言",
    description: "聚焦 Python 项目结构、工具选择与长期维护方式。",
    accent: "green",
  },
  "LLM 应用": {
    group: "AI 系统",
    description: "模型应用层的工程组织、产品约束与试验方法。",
    accent: "teal",
  },
  "评测方法": {
    group: "AI 系统",
    description: "如何定义问题、设计对照、解释结果并避免虚假结论。",
    accent: "teal",
  },
  "架构设计": {
    group: "系统设计",
    description: "围绕系统边界、模块职责和演化路径的结构化思考。",
    accent: "blue",
  },
  "知识管理": {
    group: "写作与沉淀",
    description: "如何把零散经验变成可检索、可复用、可迭代的内容资产。",
    accent: "slate",
  },
  "静态站点": {
    group: "写作与沉淀",
    description: "使用静态生成和纯前端托管来构建可长期维护的网站。",
    accent: "orange",
  },
  "开源维护": {
    group: "写作与沉淀",
    description: "维护公共代码、公共文档和公共沟通接口的长期动作。",
    accent: "slate",
  },
  "调试排障": {
    group: "工程实践",
    description: "定位问题、构建证据链和缩小排查范围的技巧。",
    accent: "red",
  },
  "可观测性": {
    group: "系统设计",
    description: "日志、指标、追踪和实验观察面的设计与演进。",
    accent: "blue",
  },
  "团队协作": {
    group: "系统设计",
    description: "团队边界、沟通成本和协作接口在技术系统中的体现。",
    accent: "slate",
  },
  "产品化": {
    group: "AI 系统",
    description: "从实验原型到可交付能力之间的收敛和取舍。",
    accent: "orange",
  },
};

export function fallbackTagMeta(tag: string): TagMeta {
  return {
    group: "未分组",
    description: `${tag} 相关的工程经验与技术记录。`,
    accent: "slate",
  };
}
