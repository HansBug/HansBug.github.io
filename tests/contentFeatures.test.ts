import { readFile } from "node:fs/promises";
import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { describe, expect, it } from "vitest";
import {
  hasMathSyntax,
  hasMermaidFence,
  remarkProtectDollarText,
  remarkStandardMermaid,
} from "../src/utils/markdownFeatures";
import {
  calculateFitScale,
  clampMermaidScale,
  formatMermaidScale,
  getMermaidZoomState,
  parseSvgSizeAttributes,
  parseSvgViewBox,
} from "../src/utils/mermaidViewport";

async function readSource(path: string) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

async function renderMarkdown(markdown: string) {
  const processor = await createMarkdownProcessor({
    syntaxHighlight: "shiki",
    shikiConfig: { theme: "github-dark" },
    remarkPlugins: [remarkGfm, remarkMath, remarkProtectDollarText, remarkStandardMermaid],
    rehypePlugins: [rehypeKatex],
  });

  return processor.render(markdown).then((result) => result.code);
}

describe("Mermaid fence detection", () => {
  it("detects only the documented standard mermaid fence", () => {
    expect(hasMermaidFence("```mermaid\nflowchart TD\n  A --> B\n```")).toBe(true);
    expect(hasMermaidFence("```Mermaid\nflowchart TD\n  A --> B\n```")).toBe(false);
    expect(hasMermaidFence("``` mermaid\nflowchart TD\n  A --> B\n```")).toBe(false);
    expect(hasMermaidFence("```mermaid title=\"demo\"\nflowchart TD\n  A --> B\n```")).toBe(false);
    expect(hasMermaidFence("~~~mermaid\nflowchart TD\n  A --> B\n~~~")).toBe(false);
  });

  it("does not treat a literal mermaid opener inside another code block as a Mermaid diagram", () => {
    const markdown = [
      "```text",
      "This line documents the literal marker:",
      "```mermaid",
      "```",
    ].join("\n");

    expect(hasMermaidFence(markdown)).toBe(false);
  });
});

describe("Markdown rendering pipeline", () => {
  it("marks only standard Mermaid fences for runtime rendering", async () => {
    const html = await renderMarkdown([
      "```mermaid",
      "flowchart TD",
      "  A --> B",
      "```",
      "",
      "```mermaid title=\"demo\"",
      "flowchart TD",
      "  C --> D",
      "```",
      "",
      "``` mermaid",
      "flowchart TD",
      "  E --> F",
      "```",
      "",
      "~~~mermaid",
      "flowchart TD",
      "  G --> H",
      "~~~",
      "",
      "```Mermaid",
      "flowchart TD",
      "  I --> J",
      "```",
    ].join("\n"));

    expect(html.match(/data-standard-mermaid="true"/g)).toHaveLength(1);
    expect(html).toContain('<pre class="mermaid-source-block" data-standard-mermaid="true">');
    expect(html.match(/data-language="mermaid"/g)).toHaveLength(3);
    expect(html).toContain("data-language=\"plaintext\"");
  });

  it("renders mathematical dollar syntax without eating shell variables", async () => {
    const html = await renderMarkdown([
      "Path: $PATH and home $HOME should stay text.",
      "",
      "Energy: $E = mc^2$.",
      "",
      "$$",
      "\\int_0^1 x^2 dx",
      "$$",
    ].join("\n"));

    expect(html).toContain("$PATH and home $HOME");
    expect(html).not.toContain("PATH and home</annotation>");
    expect(html.match(/class="katex"/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(html).toContain("class=\"katex-display\"");
    expect(html).toContain("E = mc^2");
  });

  it("keeps GFM tables, code blocks, inline code, lists and blockquotes stable around dollar text", async () => {
    const html = await renderMarkdown([
      "| key | value |",
      "| --- | --- |",
      "| path | $PATH |",
      "",
      "- keep `$HOME` as inline code",
      "",
      "> quoted $PATH should stay text",
      "",
      "```sh",
      "echo $HOME",
      "```",
    ].join("\n"));

    expect(html).toContain("<table>");
    expect(html).toContain("<code>$HOME</code>");
    expect(html).toContain("<blockquote>");
    expect(html).toContain("quoted $PATH should stay text");
    expect(html).toContain("data-language=\"sh\"");
    expect(html).toContain("$HOME");
  });

  it("uses conditional KaTeX CSS loading from detail layouts", async () => {
    const layout = await readSource("src/layouts/BaseLayout.astro");
    const config = await readSource("astro.config.mjs");

    expect(layout).toContain('{includeKatex && <link rel="stylesheet" href="/vendor/katex/katex.min.css" />}');
    expect(config).toContain("remarkProtectDollarText");
    expect(config).toContain("remarkStandardMermaid");
  });

  it("detects math syntax only for formulas that will render", () => {
    expect(hasMathSyntax("$PATH and home $HOME")).toBe(false);
    expect(hasMathSyntax("$plain words$")).toBe(false);
    expect(hasMathSyntax("$E = mc^2$")).toBe(true);
    expect(hasMathSyntax("$$\\int_0^1 x^2 dx$$")).toBe(true);
  });
});

describe("Mermaid renderer wiring", () => {
  const detailPages = [
    "src/pages/blog/[...slug].astro",
    "src/pages/routes/[slug].astro",
    "src/pages/projects/[slug].astro",
  ];

  it.each(detailPages)("uses shared Mermaid and math detectors in %s", async (path) => {
    const source = await readSource(path);

    expect(source).toContain('import MermaidRenderer from "../../components/MermaidRenderer.astro";');
    expect(source).toContain('import { hasMathSyntax, hasMermaidFence } from "../../utils/markdownFeatures";');
    expect(source).toContain("hasMermaidFence(");
    expect(source).toContain("hasMathSyntax(");
    expect(source).toContain("includeKatex={hasMath}");
    expect(source).toContain("{hasMermaid && <MermaidRenderer />}");
  });

  it("loads Mermaid dynamically only after finding standard marked blocks", async () => {
    const renderer = await readSource("src/components/MermaidRenderer.astro");

    expect(renderer).toContain('import("mermaid")');
    expect(renderer).toContain('pre[data-standard-mermaid="true"]');
    expect(renderer.indexOf("const blocks = rootSelectors.flatMap")).toBeLessThan(renderer.indexOf("await loadMermaid()"));
    expect(renderer).toContain('securityLevel: "strict"');
    expect(renderer).toContain('window.matchMedia("(prefers-color-scheme: light)")');
  });
});

describe("Mermaid viewport helpers", () => {
  it("parses SVG size from viewBox before width and height attributes", () => {
    expect(parseSvgViewBox("0 0 320 180")).toEqual({ width: 320, height: 180 });
    expect(parseSvgViewBox("0 0 -320 180")).toBeUndefined();
    expect(parseSvgSizeAttributes({ viewBox: "0 0 640 360", width: "10", height: "10" })).toEqual({
      width: 640,
      height: 360,
    });
  });

  it("falls back to safe SVG dimensions and clamps zoom state", () => {
    expect(parseSvgSizeAttributes({ width: "bad", height: "" })).toEqual({ width: 720, height: 420 });
    expect(calculateFitScale(360, 720)).toBe(0.5);
    expect(calculateFitScale(1440, 720)).toBe(1);
    expect(clampMermaidScale(0.01, 0.5)).toBe(0.5);
    expect(clampMermaidScale(8, 0.5)).toBe(5);
    expect(getMermaidZoomState(0.5, 0.5)).toBe("fit");
    expect(getMermaidZoomState(0.7, 0.5)).toBe("zoomed");
    expect(formatMermaidScale(1.234)).toBe("123%");
  });
});
