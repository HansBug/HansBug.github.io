import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const repoRoot = new URL("..", import.meta.url).pathname;
const skillRoot = join(repoRoot, "agent-skills/hansbug-writing-voice");
const referencesRoot = join(skillRoot, "references");
const lintScript = join(skillRoot, "scripts/lint_voice_references.py");

const pr2ReferenceFiles = [
  "voice-profile.md",
  "article-archetypes.md",
  "micro-patterns.md",
  "macro-logic.md",
  "anti-patterns.md",
];

const sampleEvidenceGuardTerms: Record<string, string[]> = {
  // 这些词不是新的样本元数据，而是针对 holdout / negative 样本的人工泄漏守卫词。
  // 自动标题切分只能拦住完整标题或长片段，拦不住“函数树化”这类核心话题词；
  // PR-2 阶段先在测试里显式列出，后续如样本调整再同步维护。
  "cnblogs-14789352": ["近取Key"],
  "cnblogs-15618673": ["Treevalue", "函数树化"],
  "cnblogs-16096691": ["搬家通知"],
  "cnblogs-14873227": ["北航敏捷软工Alpha", "Alpha阶段评分表"],
  "cnblogs-4523770": ["算法模板", "平衡树", "Treap"],
  "cnblogs-8439342": ["洛谷", "讲课手稿"],
};

async function readReference(file: string) {
  return readFile(join(referencesRoot, file), "utf8");
}

async function readJson(path: string) {
  return JSON.parse(await readFile(path, "utf8"));
}

function countChineseChars(text: string) {
  return [...text].filter((char) =>
    /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u.test(char),
  ).length;
}

function getMarkdownH2Sections(text: string) {
  return text.split(/\n## /).slice(1);
}

function getSampleEvidenceTokens(source: {
  id: string;
  cacheKey: string;
  title?: string;
}) {
  const title = source.title ?? "";
  const titleFragments = Array.from(
    new Set(
      title
        .split(/[\s\p{P}\p{S}]+/u)
        .map((token) => token.trim())
        .filter((token) => token.length >= 4),
    ),
  );

  return [
    source.id,
    source.cacheKey,
    title,
    ...titleFragments,
    ...(sampleEvidenceGuardTerms[source.id] ?? []),
  ].filter(Boolean);
}

async function runLint() {
  try {
    const result = await execFileAsync(
      "python3",
      [lintScript, referencesRoot],
      {
        cwd: repoRoot,
        maxBuffer: 1024 * 1024,
      },
    );
    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    const err = error as Error & {
      code?: number;
      stdout?: string;
      stderr?: string;
    };
    return {
      code: err.code ?? 1,
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? "",
    };
  }
}

describe("HansBug writing voice skill PR-2", () => {
  it("adds all PR-2 references as Chinese human-readable documents", async () => {
    for (const file of pr2ReferenceFiles) {
      const text = await readReference(file);
      expect(text.startsWith("# ")).toBe(true);
      expect(text.length).toBeGreaterThan(800);
      expect(countChineseChars(text)).toBeGreaterThan(300);
      expect(text).not.toContain("TODO");
      expect(text).not.toContain("后续 PR 占位");
    }
  });

  it("updates the skill task table to load PR-2 references progressively", async () => {
    const skill = await readFile(join(skillRoot, "SKILL.md"), "utf8");

    for (const file of pr2ReferenceFiles) {
      expect(skill).toContain(`references/${file}`);
      expect(skill).not.toContain(`references/${file}\`（后续 PR 占位）`);
    }
    expect(skill).toContain("不要默认全量加载所有文件");
    expect(skill).toContain("PR-2 已补充正式画像层");
    expect(skill.split("\n").length).toBeLessThanOrEqual(540);
  });

  it("keeps the voice profile centered on judgement instead of catchphrases", async () => {
    const text = await readReference("voice-profile.md");

    expect(text).toContain(
      "像 HansBug，首先不是像某几个词，而是像一套判断方式",
    );
    expect(text).toContain("概念拆分与对立辨析");
    expect(text).toContain("技术判断密度");
    expect(text).toContain("事实与经历边界");
    expect(text).toContain("结尾盖章");
    expect(text).toContain("不能替作者编造事实");
  });

  it("documents required article archetypes with use cases, structures and forbidden zones", async () => {
    const text = await readReference("article-archetypes.md");
    const archetypes = [
      "技术实践文",
      "教程 / 学习笔记文",
      "复盘 / 事故分析文",
      "测评 / 评论文",
      "课程 / 项目总结文",
    ];

    for (const archetype of archetypes) {
      const index = text.indexOf(`## ${archetype}`);
      expect(index).toBeGreaterThanOrEqual(0);
      const next = text.indexOf("\n## ", index + 1);
      const section = next === -1 ? text.slice(index) : text.slice(index, next);
      expect(section).toContain("适用场景");
      expect(section).toContain("推荐结构");
      expect(section).toContain("禁区");
    }
  });

  it("requires every micro pattern to carry the three anti-buffet labels", async () => {
    const text = await readReference("micro-patterns.md");
    const sections = getMarkdownH2Sections(text);

    expect(sections.length).toBeGreaterThanOrEqual(8);
    for (const section of sections) {
      expect(section).toContain("诊断用途");
      expect(section).toContain("可少量借用");
      expect(section).toContain("禁止机械拼贴");
    }
    expect(text).toContain("口癖 buffet");
    expect(text).toContain("高口癖密度");
  });

  it("documents macro logic from phenomena to engineering tradeoffs and method", async () => {
    const text = await readReference("macro-logic.md");

    expect(text).toContain("缘起 / 题外话破题");
    expect(text).toContain("问题定义 / 边界交代");
    expect(text).toContain("核心判断前置");
    expect(text).toContain("从现象到本质");
    expect(text).toContain("从实现到工程取舍");
    expect(text).toContain("从经历到方法论");
    expect(text).toContain("结尾上升");
  });

  it("covers anti-patterns with signals, harm and repair directions", async () => {
    const text = await readReference("anti-patterns.md");
    const sections = getMarkdownH2Sections(text);

    expect(sections.length).toBeGreaterThanOrEqual(8);
    for (const section of sections) {
      expect(section).toContain("识别信号");
      expect(section).toContain("危害");
      expect(section).toContain("修复方向");
    }
    expect(text).toContain("这是 C 级问题");
  });

  it("keeps holdout samples out of positive voice-profile evidence", async () => {
    const manifest = await readJson(
      join(referencesRoot, "sample-manifest.json"),
    );
    const holdoutIds = manifest.sources
      .filter(
        (source: { holdoutForDryRun: boolean }) => source.holdoutForDryRun,
      )
      .map(getSampleEvidenceTokens)
      .flat();
    const positiveFiles = [
      "voice-profile.md",
      "article-archetypes.md",
      "micro-patterns.md",
      "macro-logic.md",
    ];
    const positiveText = (
      await Promise.all(positiveFiles.map(readReference))
    ).join("\n");

    for (const token of holdoutIds) {
      expect(positiveText).not.toContain(token);
    }
    const pr2Text = (
      await Promise.all(pr2ReferenceFiles.map(readReference))
    ).join("\n");
    expect(pr2Text).toContain("holdout");
    expect(pr2Text).toContain("不得进入");
  });

  it("keeps negative samples as anti-pattern evidence only", async () => {
    const manifest = await readJson(
      join(referencesRoot, "sample-manifest.json"),
    );
    const negativeTokens = manifest.sources
      .filter(
        (source: { sampleRole: string }) => source.sampleRole === "negative",
      )
      .map(getSampleEvidenceTokens)
      .flat();
    const positiveFiles = [
      "voice-profile.md",
      "article-archetypes.md",
      "micro-patterns.md",
      "macro-logic.md",
    ];
    const positiveText = (
      await Promise.all(positiveFiles.map(readReference))
    ).join("\n");

    for (const token of negativeTokens) {
      expect(positiveText).not.toContain(token);
    }
    const antiPatterns = await readReference("anti-patterns.md");
    expect(antiPatterns).toContain("negative");
    expect(antiPatterns).toContain("反例");
    expect(antiPatterns).toContain("不得作为正向模仿来源");
  });

  it("keeps committed references within excerpt lint boundaries", async () => {
    const result = await runLint();

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("OK");
    expect(result.stderr).not.toContain("Traceback");
  });
});
