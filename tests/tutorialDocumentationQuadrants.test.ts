import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = new URL("..", import.meta.url).pathname;
const articlePath = join(
  repoRoot,
  "src/content/blog/engineering/tutorial-documentation-quadrants.md",
);
const bibliographyPath = join(
  repoRoot,
  "src/content/blog/engineering/tutorial-documentation-quadrants.bib",
);
const diagramPath = join(repoRoot, "public/images/blog/engineering/diataxis-compass.svg");

function read(path: string) {
  return readFileSync(path, "utf8");
}

function extractFrontmatter(markdown: string) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n/);
  expect(match, "missing YAML frontmatter").toBeTruthy();
  return match![1];
}

function extractBibtexKeys(bibtex: string) {
  return [...bibtex.matchAll(/@\w+\s*{\s*([^,\s]+)\s*,/g)].map((match) => match[1]);
}

function stripFencedCode(markdown: string) {
  return markdown.replace(/```[\s\S]*?```/g, "");
}

function stripBracketCitations(markdown: string) {
  return markdown.replace(/\[((?:[^\[\]]|\[[^\]]*\])*@(?:[^\[\]]|\[[^\]]*\])*)\]/g, "");
}

function extractMarkdownCitationKeys(markdown: string) {
  const withoutFences = stripFencedCode(markdown);
  return [...withoutFences.matchAll(/\[@([A-Za-z0-9_][A-Za-z0-9_:.#$%&+?<>~/-]*)/g)].map(
    (match) => match[1],
  );
}

describe("tutorial documentation quadrants article", () => {
  it("exists with publishable frontmatter and per-article bibliography wiring", () => {
    expect(existsSync(articlePath)).toBe(true);
    expect(existsSync(bibliographyPath)).toBe(true);

    const article = read(articlePath);
    const frontmatter = extractFrontmatter(article);

    expect(frontmatter).toContain('title: "Tutorial 不是 Reference：技术文档四象限与教程工程验收"');
    expect(frontmatter).toContain("bibliography: ./tutorial-documentation-quadrants.bib");
    expect(frontmatter).toContain("citationStyle: hansbug-numeric-superscript");
    expect(frontmatter).toContain("draft: false");
    expect(frontmatter).toContain("知识管理");
    expect(frontmatter).toContain("工程效率");
    expect(frontmatter).toContain("开源维护");
  });

  it("uses a local Diátaxis compass diagram instead of hotlinking the upstream image", () => {
    expect(existsSync(diagramPath)).toBe(true);
    const article = read(articlePath);
    const diagram = read(diagramPath);

    expect(article).toContain("/images/blog/engineering/diataxis-compass.svg");
    expect(article).not.toContain("https://diataxis.fr/_images/diataxis.png");
    expect(diagram).toContain("Tutorials");
    expect(diagram).toContain("How-to guides");
    expect(diagram).toContain("Reference");
    expect(diagram).toContain("Explanation");
    expect(diagram).toContain("Action");
    expect(diagram).toContain("Cognition");
    expect(diagram).toContain("Acquisition");
    expect(diagram).toContain("Application");
  });

  it("keeps the issue #40 conceptual anchors in the article body", () => {
    const article = read(articlePath);
    const requiredAnchors = [
      "Action",
      "Cognition",
      "Acquisition",
      "Application",
      "tutorial",
      "how-to",
      "reference",
      "explanation",
      "局部混合可以接受，主承诺混乱不可以",
      "minimal tutorial",
      "learning-oriented tutorial",
      "即时输出",
      "阶段自检",
      "机器验收",
      "真人任务测试",
      "treevalue",
      "Issue / Milestone",
      "阻断级 checklist",
    ];

    for (const anchor of requiredAnchors) {
      expect(article, `missing anchor: ${anchor}`).toContain(anchor);
    }
  });

  it("keeps citations consistent and avoids obvious placeholder / hotlink failures", () => {
    const article = read(articlePath);
    const bibtex = read(bibliographyPath);
    const bibKeys = extractBibtexKeys(bibtex);
    const uniqueBibKeys = new Set(bibKeys.map((key) => key.toLowerCase()));
    const citationKeys = extractMarkdownCitationKeys(article);

    expect(bibKeys.length).toBeGreaterThanOrEqual(12);
    expect(uniqueBibKeys.size).toBe(bibKeys.length);
    expect(citationKeys.length).toBeGreaterThanOrEqual(10);

    for (const key of citationKeys) {
      expect(uniqueBibKeys.has(key.toLowerCase()), `missing bib entry for ${key}`).toBe(true);
    }

    expect(article).not.toContain("TODO");
    expect(article).not.toContain("[NO_PRINTED_FORM]");
    const articleWithoutLegalCitations = stripBracketCitations(stripFencedCode(article));
    expect(articleWithoutLegalCitations).not.toMatch(/(^|[^`])@[A-Za-z0-9_][A-Za-z0-9_:.#$%&+?<>~/-]*/);
    expect(article).not.toMatch(/!\[[^\]]*\]\(https?:\/\//);
  });
});
