import { createHash } from "node:crypto";
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
const diagramPath = join(repoRoot, "public/images/blog/engineering/diataxis.png");
const rejectedSelfDrawnDiagramPath = join(
  repoRoot,
  "public/images/blog/engineering/diataxis-compass.svg",
);
const attributionPath = join(repoRoot, "public/images/blog/engineering/diataxis.attribution.txt");

const upstreamDiataxisSha256 = "70ad729ae307abb3bcb266e63c2449efd1f3950587a27ccc47ef812bf28cc832";

function read(path: string) {
  return readFileSync(path, "utf8");
}

function sha256(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
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
  const citationGroups = [
    ...withoutFences.matchAll(/\[((?:[^\[\]]|\[[^\]]*\])*@(?:[^\[\]]|\[[^\]]*\])*)\]/g),
  ];
  return citationGroups.flatMap((group) =>
    [...group[1].matchAll(/@([A-Za-z0-9_][A-Za-z0-9_:.#$%&+?<>~/-]*)/g)].map(
      (match) => match[1],
    ),
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

  it("uses the upstream Diátaxis PNG as a localized asset instead of a self-drawn diagram or hotlink", () => {
    expect(existsSync(diagramPath)).toBe(true);
    expect(existsSync(rejectedSelfDrawnDiagramPath)).toBe(false);
    expect(existsSync(attributionPath)).toBe(true);

    const article = read(articlePath);
    const diagram = readFileSync(diagramPath);
    const attribution = read(attributionPath);

    expect(article).toContain("/images/blog/engineering/diataxis.png");
    expect(article).not.toContain("diataxis-compass.svg");
    expect(article).not.toContain("https://diataxis.fr/_images/diataxis.png");
    expect(article).not.toContain("本站自绘");
    expect(article).not.toContain("based on the Diátaxis compass");
    expect([...diagram.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(diagram.length).toBeGreaterThan(50_000);
    expect(sha256(diagram)).toBe(upstreamDiataxisSha256);
    expect(attribution).toContain("https://diataxis.fr/_images/diataxis.png");
    expect(attribution).toContain("Daniele Procida");
    expect(attribution).toContain("CC BY-SA 4.0");
    expect(attribution).toContain(`SHA-256: ${upstreamDiataxisSha256}`);
    expect(attribution).toContain("unchanged local copy");
  });

  it("keeps the issue #40 conceptual anchors and expanded archaeology in the article body", () => {
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
      "Manual / man page",
      "HOWTO",
      "literate programming",
      "notebook",
      "docs-as-code",
      "面多加水，水多加面",
      "考古切片",
      "Commands, part 1",
      "both a tutorial and a reference",
      "piece of literature",
      "live code, equations, narrative text",
      "Issue Trackers",
      "局部混合可以接受，主承诺混乱不可以",
      "minimal tutorial",
      "learning-oriented tutorial",
      "即时输出",
      "阶段自检",
      "机器验收",
      "真人任务测试",
      "CI 证明材料没坏，真人任务测试证明路径没断",
      "阻断级 checklist",
      "treevalue",
      "Issue / Milestone",
      "README 不是垃圾场，README 是交通枢纽",
      "不是所有模板都叫 tutorial",
    ];

    for (const anchor of requiredAnchors) {
      expect(article, `missing anchor: ${anchor}`).toContain(anchor);
    }

    expect(Buffer.byteLength(article, "utf8")).toBeGreaterThan(60_000);
  });

  it("keeps citations consistent and avoids obvious placeholder / hotlink failures", () => {
    const article = read(articlePath);
    const bibtex = read(bibliographyPath);
    const bibKeys = extractBibtexKeys(bibtex);
    const uniqueBibKeys = new Set(bibKeys.map((key) => key.toLowerCase()));
    const citationKeys = extractMarkdownCitationKeys(article);

    expect(bibKeys.length).toBeGreaterThanOrEqual(25);
    expect(uniqueBibKeys.size).toBe(bibKeys.length);
    expect(citationKeys.length).toBeGreaterThanOrEqual(20);

    for (const key of citationKeys) {
      expect(uniqueBibKeys.has(key.toLowerCase()), `missing bib entry for ${key}`).toBe(true);
    }

    for (const key of bibKeys) {
      expect(citationKeys.map((citationKey) => citationKey.toLowerCase())).toContain(key.toLowerCase());
    }

    expect(article).not.toContain("TODO");
    expect(article).not.toContain("[NO_PRINTED_FORM]");
    const articleWithoutLegalCitations = stripBracketCitations(stripFencedCode(article));
    expect(articleWithoutLegalCitations).not.toMatch(/(^|[^`])@[A-Za-z0-9_][A-Za-z0-9_:.#$%&+?<>~/-]*/);
    expect(article).not.toMatch(/!\[[^\]]*\]\(https?:\/\//);
  });
});
