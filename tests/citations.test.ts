import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  remarkArticleCitationPreflight,
  rehypeArticleCitations,
  resolveArticleCitationPaths,
} from "../src/utils/citations";
import {
  remarkCodeCopyOptions,
  rehypeEnhancedCodeBlocks,
  remarkProtectDollarText,
  remarkStandardMermaid,
} from "../src/utils/markdownFeatures";

const articleFrontmatter = {
  bibliography: "./citation-fixture.bib",
  citationStyle: "hansbug-numeric-superscript",
};

async function makeFixtureDir() {
  const root = await mkdtemp(join(tmpdir(), "hansbug-citations-"));
  const articleDir = join(root, "src/content/blog/engineering");
  await mkdir(articleDir, { recursive: true });
  const cslDir = join(root, "src/citations/styles");
  await mkdir(cslDir, { recursive: true });
  const cslSource = await readFile(
    new URL("../src/citations/styles/hansbug-numeric-superscript.csl", import.meta.url),
    "utf8",
  );
  await writeFile(join(cslDir, "hansbug-numeric-superscript.csl"), cslSource);
  return { root, articleDir, markdownPath: join(articleDir, "citation-fixture.md") };
}

async function writeFixtureBib(articleDir: string, content = validBibtex()) {
  const bibliographyPath = join(articleDir, "citation-fixture.bib");
  await writeFile(bibliographyPath, content);
  return bibliographyPath;
}

function validBibtex(extra = "") {
  return [
    "@article{nash1950,",
    "  title = {Equilibrium points in n-person games},",
    "  author = {Nash, John},",
    "  journal = {Proceedings of the National Academy of Sciences},",
    "  year = {1950}",
    "}",
    "",
    "@book{riehl2017,",
    "  title = {Category Theory in Context},",
    "  author = {Riehl, Emily},",
    "  publisher = {Dover Publications},",
    "  year = {2017}",
    "}",
    extra,
  ].join("\n");
}

async function renderArticleMarkdown(
  root: string,
  markdownPath: string,
  markdown: string,
  frontmatter: Record<string, unknown> = articleFrontmatter,
) {
  const processor = await createMarkdownProcessor({
    syntaxHighlight: "shiki",
    shikiConfig: { theme: "github-dark" },
    remarkPlugins: [
      remarkGfm,
      remarkMath,
      remarkCodeCopyOptions,
      remarkProtectDollarText,
      remarkStandardMermaid,
      [remarkArticleCitationPreflight, { root }],
    ],
    rehypePlugins: [rehypeKatex, rehypeEnhancedCodeBlocks, [rehypeArticleCitations, { root }]],
  });

  return processor.render(markdown, {
    fileURL: pathToFileURL(markdownPath),
    frontmatter,
  });
}

describe("article citation pipeline", () => {
  let fixtureRoot: string | undefined;

  afterEach(async () => {
    vi.restoreAllMocks();
    if (fixtureRoot) {
      await rm(fixtureRoot, { recursive: true, force: true });
      fixtureRoot = undefined;
    }
  });

  it("renders linked superscript numeric citations and bibliography", async () => {
    const fixture = await makeFixtureDir();
    fixtureRoot = fixture.root;
    await writeFixtureBib(fixture.articleDir);

    const result = await renderArticleMarkdown(
      fixture.root,
      fixture.markdownPath,
      [
        "单引用应该能工作[@nash1950]，多引用也要稳定[@nash1950; @riehl2017]。",
        "",
        "locator 不应被误判为逗号多引用[@nash1950, p. 12]，suppress author 也应可渲染[-@riehl2017]。",
        "",
        "## 参考文献",
        "",
        "[^ref]",
      ].join("\n"),
    );

    expect(result.code).toContain('class="article-citation"');
    expect(result.code).toContain('href="#bib-nash1950"');
    expect(result.code).toContain('href="#bib-riehl2017"');
    expect(result.code).toContain('class="article-citation__link"');
    expect(result.code).not.toContain("]–[");
    expect(result.code).toContain('id="cite-nash1950-1"');
    expect(result.code).toContain('id="cite-nash1950-2"');
    expect(result.code).toContain('href="#cite-nash1950-1"');
    expect(result.code).toContain('href="#cite-nash1950-2"');
    expect(result.code).toContain('class="article-reference-backrefs"');
    expect(result.code).toContain('class="article-reference-backref"');
    expect(result.code).toContain('id="refs"');
    expect(result.code).toContain('class="csl-entry article-reference-entry"');
    expect(result.code).toContain('id="bib-nash1950"');
    expect(result.code).toContain('id="bib-riehl2017"');
    expect(result.code).toContain("Equilibrium points in n-person games");
    expect(result.code).toContain("Category Theory in Context");
    expect(result.code).not.toContain("[NO_PRINTED_FORM]");
    expect(result.code).not.toContain("[@nash1950]");
  });

  it("linkifies bibliography URLs and keeps trailing punctuation outside the link", async () => {
    const fixture = await makeFixtureDir();
    fixtureRoot = fixture.root;
    await writeFixtureBib(
      fixture.articleDir,
      [
        "@online{web2026,",
        "  title = {Web documentation},",
        "  author = {{Example Docs}},",
        "  url = {https://example.com/docs/path},",
        "  urldate = {2026-06-10}",
        "}",
      ].join("\n"),
    );

    const result = await renderArticleMarkdown(
      fixture.root,
      fixture.markdownPath,
      ["Web citation[@web2026].", "", "## 参考文献", "", "[^ref]"].join("\n"),
    );

    expect(result.code).toContain('class="article-reference-url"');
    expect(result.code).toContain('href="https://example.com/docs/path"');
    expect(result.code).toContain('target="_blank"');
    expect(result.code).toContain('rel="noreferrer"');
    expect(result.code).toContain('https://example.com/docs/path</a>.');
  });

  it("does not treat inline code or fenced code citations as real citations", async () => {
    const fixture = await makeFixtureDir();
    fixtureRoot = fixture.root;

    const result = await renderArticleMarkdown(
      fixture.root,
      fixture.markdownPath,
      ["Inline `[@missing]` is literal.", "", "```text", "[@missing-too]", "```"].join("\n"),
      {},
    );

    expect(result.code).toContain("<code>[@missing]</code>");
    expect(result.code).toContain("[@missing-too]");
    expect(result.code).not.toContain("article-citation");
  });

  it("does not require bibliography for ordinary email links or social mentions", async () => {
    const fixture = await makeFixtureDir();
    fixtureRoot = fixture.root;

    const result = await renderArticleMarkdown(
      fixture.root,
      fixture.markdownPath,
      "普通邮件链接：[hansbug@buaa.edu.cn](mailto:hansbug@buaa.edu.cn)，普通 mention @hansbug 也不是引用。",
      {},
    );

    expect(result.code).toContain("mailto:hansbug@buaa.edu.cn");
    expect(result.code).toContain("@hansbug");
    expect(result.code).not.toContain("article-citation");
  });

  it("does not scan indented code blocks or raw HTML code blocks as citations", async () => {
    const fixture = await makeFixtureDir();
    fixtureRoot = fixture.root;
    await writeFixtureBib(fixture.articleDir);

    const result = await renderArticleMarkdown(
      fixture.root,
      fixture.markdownPath,
      [
        "真实引用[@nash1950].",
        "",
        "    Literal bracket marker: [@literal]",
        "    Literal bare marker: @nash1950",
        "",
        "<pre>",
        "[@evil] and @nash1950 are literal here.",
        "</pre>",
        "",
        "<code>[@evil-too]</code>",
        "",
        "## 参考文献",
        "",
        "[^ref]",
      ].join("\n"),
    );

    expect(result.code).toContain('href="#bib-nash1950"');
    expect(result.code).toContain("Literal bracket marker: [@literal]");
    expect(result.code).toContain("[@evil] and @nash1950 are literal here.");
    expect(result.code).not.toContain("bib-literal");
    expect(result.code).not.toContain("bib-evil");
  });

  it("allows normal @mentions while still rejecting bare keys that exist in the article bibliography", async () => {
    const fixture = await makeFixtureDir();
    fixtureRoot = fixture.root;
    await writeFixtureBib(fixture.articleDir);

    const result = await renderArticleMarkdown(
      fixture.root,
      fixture.markdownPath,
      "正文引用[@nash1950]，顺手提一下 @hansbug 不是引用。",
    );
    expect(result.code).toContain("@hansbug");
    expect(result.code).toContain('href="#bib-nash1950"');

    await expect(renderArticleMarkdown(fixture.root, fixture.markdownPath, "Bare @nash1950 is banned.")).rejects.toThrow(
      /Bare citation syntax is not supported[\s\S]*Fix: replace `@nash1950` with `\[@nash1950\]`/,
    );
  });

  it("fails before rehype-citation for missing bibliography entries", async () => {
    const fixture = await makeFixtureDir();
    fixtureRoot = fixture.root;
    await writeFixtureBib(fixture.articleDir);

    await expect(
      renderArticleMarkdown(fixture.root, fixture.markdownPath, "Missing key[@missing]."),
    ).rejects.toThrow(/Missing bibliography entry[\s\S]*Missing key: missing[\s\S]*Fix:/);
  });

  it("fails with a clear semicolon fix for comma-separated multi citations", async () => {
    const fixture = await makeFixtureDir();
    fixtureRoot = fixture.root;
    await writeFixtureBib(fixture.articleDir);

    await expect(
      renderArticleMarkdown(fixture.root, fixture.markdownPath, "Bad separator[@nash1950, @riehl2017]."),
    ).rejects.toThrow(/逗号不是多引用分隔符，多引用请写 `\[@a; @b\]`/);
  });

  it("fails on bare citation keys before they can produce NO_PRINTED_FORM", async () => {
    const fixture = await makeFixtureDir();
    fixtureRoot = fixture.root;
    await writeFixtureBib(fixture.articleDir);

    await expect(renderArticleMarkdown(fixture.root, fixture.markdownPath, "Bare @nash1950 is banned.")).rejects.toThrow(
      /Bare citation syntax is not supported[\s\S]*Fix: replace `@nash1950` with `\[@nash1950\]`/,
    );
  });

  it("fails on duplicate and case-conflicting BibTeX keys", async () => {
    const fixture = await makeFixtureDir();
    fixtureRoot = fixture.root;
    await writeFixtureBib(
      fixture.articleDir,
      validBibtex(
        [
          "",
          "@article{nash1950, title={Duplicate}, author={Dup, D}, year={1951}}",
          "@article{RIEHL2017, title={Case Conflict}, author={Dup, D}, year={2018}}",
        ].join("\n"),
      ),
    );

    await expect(renderArticleMarkdown(fixture.root, fixture.markdownPath, "Text[@nash1950].")).rejects.toThrow(
      /Duplicate BibTeX key[\s\S]*nash1950/,
    );
    await writeFixtureBib(
      fixture.articleDir,
      validBibtex(["", "@article{RIEHL2017, title={Case Conflict}, author={Dup, D}, year={2018}}"].join("\n")),
    );
    await expect(renderArticleMarkdown(fixture.root, fixture.markdownPath, "Text[@riehl2017].")).rejects.toThrow(
      /BibTeX key case conflict[\s\S]*riehl2017/,
    );
  });

  it("fails on invalid BibTeX and missing bibliography files", async () => {
    const fixture = await makeFixtureDir();
    fixtureRoot = fixture.root;
    await writeFixtureBib(fixture.articleDir, "@article{broken, title={Broken}");

    await expect(renderArticleMarkdown(fixture.root, fixture.markdownPath, "Text[@broken].")).rejects.toThrow(
      /Invalid BibTeX[\s\S]*citation-fixture\.bib[\s\S]*Fix:/,
    );

    await expect(renderArticleMarkdown(fixture.root, fixture.markdownPath, "Text[@broken].")).rejects.toThrow(
      /expected "rbrace"/,
    );

    await rm(join(fixture.articleDir, "citation-fixture.bib"));
    await expect(renderArticleMarkdown(fixture.root, fixture.markdownPath, "Text[@broken].")).rejects.toThrow(
      /Bibliography file not found[\s\S]*citation-fixture\.bib/,
    );
  });

  it("warns about unused bibliography entries without failing the render", async () => {
    const fixture = await makeFixtureDir();
    fixtureRoot = fixture.root;
    await writeFixtureBib(fixture.articleDir);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const result = await renderArticleMarkdown(fixture.root, fixture.markdownPath, "Only one citation[@nash1950].");

    expect(result.code).toContain("Equilibrium points in n-person games");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Unused bibliography entry"));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("riehl2017"));
  });

  it("keeps bibliography resolution scoped to the current article directory", async () => {
    const fixture = await makeFixtureDir();
    fixtureRoot = fixture.root;
    const bibliographyPath = await writeFixtureBib(fixture.articleDir);

    const paths = resolveArticleCitationPaths({
      root: fixture.root,
      markdownPath: fixture.markdownPath,
      bibliography: "./citation-fixture.bib",
    });

    expect(paths.bibliographyAbsPath).toBe(bibliographyPath);
    expect(paths.bibliographyRelativePath).toBe("src/content/blog/engineering/citation-fixture.bib");

    expect(() =>
      resolveArticleCitationPaths({
        root: fixture.root,
        markdownPath: fixture.markdownPath,
        bibliography: "../shared.bib",
      }),
    ).toThrow(/must stay in the article directory/);
  });

});

describe("citation guide and schema wiring", () => {
  it("documents citation usage in AGENTS.md without PR-only acceptance text", async () => {
    const guide = await readFile(new URL("../AGENTS.md", import.meta.url), "utf8");

    expect(guide).toContain("论文式引用");
    expect(guide).toContain("bibliography: ./");
    expect(guide).toContain("[@key]");
    expect(guide).toContain("[@a; @b]");
    expect(guide).toContain("## 参考文献");
    expect(guide).toContain("[^ref]");
    expect(guide).toContain("不要写成 `[@a, @b]`");
    expect(guide).toContain("不要使用裸 `@key`");
    expect(guide).not.toContain("某个 PR 的临时验收步骤");
  });

  it("keeps the blog schema contract explicit", async () => {
    const schema = await readFile(new URL("../src/content.config.ts", import.meta.url), "utf8");

    expect(schema).toContain("bibliography");
    expect(schema).toContain("citationStyle");
    expect(schema).toContain("hansbug-numeric-superscript");
  });
});
