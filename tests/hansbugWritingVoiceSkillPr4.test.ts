import { lstat, readFile, readlink } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = new URL("..", import.meta.url).pathname;
const claudePath = join(repoRoot, "CLAUDE.md");
const agentsPath = join(repoRoot, "AGENTS.md");
const skillPath = join(repoRoot, "agent-skills/hansbug-writing-voice/SKILL.md");

async function readRootDoc() {
  return readFile(claudePath, "utf8");
}

async function readSkill() {
  return readFile(skillPath, "utf8");
}

function extractSection(text: string, heading: string) {
  const start = text.indexOf(heading);
  expect(start, `missing section heading: ${heading}`).toBeGreaterThanOrEqual(0);
  const rest = text.slice(start + heading.length);
  const nextHeading = rest.search(/\n#{2,3} /);
  return nextHeading === -1 ? rest : rest.slice(0, nextHeading);
}

describe("HansBug writing voice skill PR-4", () => {
  it("keeps AGENTS.md as the single symlink entry to CLAUDE.md", async () => {
    const stat = await lstat(agentsPath);
    expect(stat.isSymbolicLink()).toBe(true);
    expect(await readlink(agentsPath)).toBe("CLAUDE.md");
  });

  it("adds a hard CLAUDE.md entry for blog writing tasks to execute the repo-local Skill", async () => {
    const doc = await readRootDoc();
    const section = extractSection(doc, "### HansBug 文风 Skill 强入口");

    expect(section).toContain("agent-skills/hansbug-writing-voice/SKILL.md");
    expect(section).toContain("src/content/blog/");
    for (const trigger of ["构思", "写作", "改写", "扩写", "风格增强", "文风审阅", "机械检查"]) {
      expect(section).toContain(trigger);
    }
    expect(section).toContain("必须");
    expect(section).toContain("不得");
    expect(section).not.toContain("建议使用");
    expect(section).not.toContain("可以参考");
  });

  it("documents the manual fallback path and the no-false-ready rule", async () => {
    const section = extractSection(await readRootDoc(), "### HansBug 文风 Skill 强入口");

    expect(section).toContain("不能自动发现");
    expect(section).toContain("手动打开");
    expect(section).toContain("任务模式表");
    expect(section).toContain("渐进读取");
    expect(section).toContain("未完成");
    expect(section).toContain("不得宣称");
    for (const marker of ["ready", "像 HansBug", "文风 gate"]) {
      expect(section).toContain(marker);
    }
  });

  it("keeps CLAUDE.md as outer boundary while Skill references remain the detailed source", async () => {
    const section = extractSection(await readRootDoc(), "### HansBug 文风 Skill 强入口");

    expect(section).toContain("外层边界");
    expect(section).toContain("执行细则");
    expect(section).toContain("references");
    expect(section).toContain("措辞差异不等于冲突");
    expect(section).toContain("check_hansbug_voice.py");
    expect(section).toContain("非博客正文");
    for (const exempt of ["首页", "按钮", "导航", "README", "维护说明", "issue/PR 计划文案"]) {
      expect(section).toContain(exempt);
    }
  });

  it("does not copy PR-3 reference-only implementation details into CLAUDE.md", async () => {
    const doc = await readRootDoc();
    for (const internalAnchor of [
      "ai-cliche-generic-summary",
      "catchphrase-without-judgement",
      "unsupported-first-person-experience",
      "blockingFindings",
      "possibleUnsupportedExperienceClaims",
      "overusedMicroPatterns",
    ]) {
      expect(doc).not.toContain(internalAnchor);
    }
  });

  it("updates SKILL.md away from root-document priority loops", async () => {
    const skill = await readSkill();

    expect(skill).not.toContain("优先遵守根目录规则");
    expect(skill).not.toContain("当它们更严格或更具体时，以它们为准");
    expect(skill).not.toMatch(/更严格[、，或和]*更具体[^\n]*(根目录|CLAUDE\.md \/ AGENTS\.md)[^\n]*(优先|为准)/);
    expect(skill).toContain("外层边界");
    expect(skill).toContain("执行细则");
    expect(skill).toContain("references");
  });
});
