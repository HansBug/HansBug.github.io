import { readFile } from "node:fs/promises";
import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { describe, expect, it } from "vitest";
import {
  remarkCodeCopyOptions,
  rehypeEnhancedCodeBlocks,
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
    remarkPlugins: [remarkGfm, remarkMath, remarkCodeCopyOptions, remarkProtectDollarText, remarkStandardMermaid],
    rehypePlugins: [rehypeKatex, rehypeEnhancedCodeBlocks],
  });

  return processor.render(markdown).then((result) => result.code);
}

function getAttributeValue(html: string, name: string) {
  const match = html.match(new RegExp(`${name}="([\\s\\S]*?)"`));
  return match?.[1] ?? "";
}

function decodeHtmlAttributeValue(value: string) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (entity, body: string) => {
    if (body.toLowerCase().startsWith("#x")) {
      return String.fromCodePoint(Number.parseInt(body.slice(2), 16));
    }
    if (body.startsWith("#")) {
      return String.fromCodePoint(Number.parseInt(body.slice(1), 10));
    }
    const namedEntities: Record<string, string> = {
      amp: "&",
      apos: "'",
      gt: ">",
      lt: "<",
      quot: '"',
    };
    return namedEntities[body.toLowerCase()] ?? entity;
  });
}

describe("Mermaid fence detection", () => {
  it("detects only the documented standard mermaid fence", () => {
    expect(hasMermaidFence("```mermaid\nflowchart TD\n  A --> B\n```")).toBe(true);
    expect(hasMermaidFence("````mermaid\nflowchart TD\n  A --> B\n````")).toBe(true);
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
      "Tight shell vars: $PATH$ and $HOME$ should stay text.",
      "",
      "Underscore shell vars: $NODE_ENV$ and $_TMP$ should stay text.",
      "",
      "Tight lowercase words: $npm$ should stay text.",
      "",
      "Easy inline: $ x $.",
      "",
      "Single uppercase variable: $E$.",
      "",
      "Spaced inline: $ xy $.",
      "",
      "Energy: $E = mc^2$.",
      "",
      "$$ xxxx $$",
      "",
      "$$",
      "\\int_0^1 x^2 dx",
      "$$",
    ].join("\n"));

    expect(html).toContain("$PATH and home $HOME");
    expect(html).toContain("$PATH$ and $HOME$");
    expect(html).toContain("$NODE_ENV$ and $_TMP$");
    expect(html).toContain("$npm$");
    expect(html).not.toContain("PATH and home</annotation>");
    expect(html).not.toContain(">PATH</annotation>");
    expect(html).not.toContain(">HOME</annotation>");
    expect(html).not.toContain(">NODE_ENV</annotation>");
    expect(html).not.toContain(">_TMP</annotation>");
    expect(html).not.toContain(">npm</annotation>");
    expect(html.match(/class="katex"/g)?.length ?? 0).toBeGreaterThanOrEqual(5);
    expect(html.match(/class="katex-display"/g)).toHaveLength(2);
    expect(html).toContain(">x</annotation>");
    expect(html).toContain(">E</annotation>");
    expect(html).toContain(">xy</annotation>");
    expect(html).toContain("E = mc^2");
    expect(html).toContain(">xxxx</annotation>");
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
    expect(html).toContain("data-code-language=\"sh\"");
    expect(html).toContain("$HOME");
  });

  it("enhances fenced code blocks with line numbers, raw copy text and soft-wrap line structure", async () => {
    const longLine = "printf '" + "segment-".repeat(16) + "'";
    const html = await renderMarkdown([
      "```bash",
      "echo first",
      longLine,
      "",
      "echo done",
      "```",
    ].join("\n"));

    expect(html).toContain('class="code-block"');
    expect(html).toContain('data-enhanced-code-block="true"');
    expect(html).toContain('data-code-language="bash"');
    expect(html).toContain('data-code-raw="echo first\n');
    expect(html).toContain('aria-label="复制代码"');
    expect(html).toContain('data-code-copy-button');
    expect(html.match(/class="code-block__line /g)).toHaveLength(4);
    expect(html).toContain('data-line-number="1"');
    expect(html).toContain('data-line-number="4"');
    expect(html).toContain('class="code-block__line code-block__line--even"');
    expect(html).toContain('class="code-block__line code-block__line--odd"');
    expect(html).toContain('class="code-block__line-number" aria-hidden="true">2</span>');
    expect(html).toContain('class="code-block__line-code">');
    expect(html).toContain("segment-segment-segment-segment");
  });

  it("keeps dangerous characters and literal HTML entities intact for browser-decoded copy text", async () => {
    const rawCode = [
      '<script>alert("XSS")</script>',
      "literal entities: &#x22; &amp; &#39;",
      'if (a < b && c > d) { return "ok"; }',
    ].join("\n");
    const html = await renderMarkdown(["```html", rawCode, "```"].join("\n"));
    const encodedRaw = getAttributeValue(html, "data-code-raw");

    expect(html).toContain('data-code-language="html"');
    expect(encodedRaw).toContain("&#x22;XSS&#x22;");
    expect(encodedRaw).toContain("&#x26;#x22;");
    expect(encodedRaw).toContain("&#x26;amp;");
    expect(encodedRaw).toContain("&#x26;#39;");
    expect(decodeHtmlAttributeValue(encodedRaw)).toBe(rawCode);
  });

  it("pins empty and trailing-blank fenced code block behavior", async () => {
    const emptyHtml = await renderMarkdown(["```bash", "```"].join("\n"));
    expect(emptyHtml).toContain('data-code-raw=""');
    expect(emptyHtml).toContain('aria-label="空代码块，无可复制内容"');
    expect(emptyHtml).toContain(">空代码</button>");
    expect(emptyHtml).toContain("disabled");
    expect(emptyHtml.match(/data-line-number=/g)).toHaveLength(1);

    const trailingBlankHtml = await renderMarkdown(["```text", "line1", "line2", "", "```"].join("\n"));
    const decodedRaw = decodeHtmlAttributeValue(getAttributeValue(trailingBlankHtml, "data-code-raw"));
    expect(decodedRaw).toBe("line1\nline2\n");
    expect(trailingBlankHtml.match(/data-line-number=/g)).toHaveLength(3);
    expect(trailingBlankHtml).toContain('data-line-number="3"');
  });

  it("marks code blocks that should copy page URL placeholders literally", async () => {
    const literalHtml = await renderMarkdown(["```text copy-literal-page-url", "{{PAGE_URL}}", "```"].join("\n"));
    const defaultHtml = await renderMarkdown(["```text", "{{PAGE_URL}}", "```"].join("\n"));

    expect(literalHtml).toContain('data-code-literal-page-url="true"');
    expect(literalHtml).toContain("{{PAGE_URL}}");
    expect(defaultHtml).not.toContain("data-code-literal-page-url");
  });

  it("keeps literal page URL copy options aligned when Mermaid blocks are present", async () => {
    const html = await renderMarkdown(
      [
        "```mermaid",
        "flowchart TD",
        "  A --> B",
        "```",
        "",
        "```text copy-literal-page-url",
        "{{PAGE_URL}}",
        "```",
      ].join("\n"),
    );

    expect(html).toContain('data-standard-mermaid="true"');
    expect(html).toContain('data-code-literal-page-url="true"');
  });

  it("uses conditional KaTeX CSS loading from detail layouts", async () => {
    const layout = await readSource("src/layouts/BaseLayout.astro");
    const config = await readSource("astro.config.mjs");

    expect(layout).toContain('{includeKatex && <link rel="stylesheet" href="/vendor/katex/katex.min.css" />}');
    expect(config).toContain("remarkProtectDollarText");
    expect(config).toContain("remarkCodeCopyOptions");
    expect(config).toContain("remarkStandardMermaid");
    expect(config).toContain("rehypeEnhancedCodeBlocks");
    expect(layout).toContain('import "../utils/codeBlockCopy";');
  });

  it("documents page URL prompt placeholders and literal-copy escapes for future articles", async () => {
    const agentsGuide = await readSource("AGENTS.md");

    expect(agentsGuide).toContain("{{PAGE_URL}}");
    expect(agentsGuide).toContain("copy-literal-page-url");
    expect(agentsGuide).toContain("不要把某个 PR 的临时验收步骤、截图要求或 CI 要求写进这里");
  });

  it("detects math syntax only for formulas that will render", () => {
    expect(hasMathSyntax("$PATH and home $HOME")).toBe(false);
    expect(hasMathSyntax("$PATH$")).toBe(false);
    expect(hasMathSyntax("$HOME$")).toBe(false);
    expect(hasMathSyntax("$NODE_ENV$")).toBe(false);
    expect(hasMathSyntax("$npm$")).toBe(false);
    expect(hasMathSyntax("$plain words$")).toBe(false);
    expect(hasMathSyntax("$ x $")).toBe(true);
    expect(hasMathSyntax("$E$")).toBe(true);
    expect(hasMathSyntax("$ xy $")).toBe(true);
    expect(hasMathSyntax("$E = mc^2$")).toBe(true);
    expect(hasMathSyntax("$$ xxxx $$")).toBe(true);
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
    expect(source).toContain('import { renderFreshContent } from "../../utils/liveContent";');
    expect(source).toContain('import { hasMathSyntax, hasMermaidFence } from "../../utils/markdownFeatures";');
    expect(source).toContain("renderFreshContent(");
    expect(source).toContain("hasMermaidFence(");
    expect(source).toContain("hasMathSyntax(");
    expect(source).toContain("includeKatex={hasMath}");
    expect(source).toContain("{hasMermaid && <MermaidRenderer />}");
  });

  it("uses the fresh dev content helper to avoid stale Markdown renders during Vite HMR", async () => {
    const source = await readSource("src/utils/liveContent.ts");

    expect(source).toContain('const dataStoreUrl = new URL("../../.astro/data-store.json", import.meta.url);');
    expect(source).toContain("if (!import.meta.env.DEV)");
    expect(source).toContain("store.get(entry.collection)?.get(entry.id)");
    expect(source).toContain("console.warn");
    expect(source).toContain("falling back to stale entry");
    expect(source).toContain("render(freshEntry)");
  });

  it("registers a dev content HMR integration for Markdown collection edits", async () => {
    const config = await readSource("astro.config.mjs");
    const integration = await readSource("src/integrations/contentHmr.ts");

    expect(config).toContain('import contentHmr from "./src/integrations/contentHmr.ts";');
    expect(config).toContain("contentHmr()");
    expect(integration).toContain('"astro:server:setup"');
    expect(integration).toContain("refreshContent({})");
    expect(integration).toContain('const CONTENT_ROOT_DIR = "src/content";');
    expect(integration).toContain("server.watcher.add(join(rootPath, CONTENT_ROOT_DIR))");
    expect(integration).toContain('server.watcher.on("add", (filePath) => scheduleRefresh(filePath, "add"))');
    expect(integration).toContain('server.watcher.on("change", (filePath) => scheduleRefresh(filePath, "change"))');
    expect(integration).toContain('server.watcher.on("unlink", (filePath) => scheduleRefresh(filePath, "unlink"))');
    expect(integration).toContain("may require restarting dev server to rebuild Astro routes");
    expect(integration).toContain('server.ws.send({ type: "full-reload", path: "*" })');
  });

  it("loads Mermaid dynamically only after finding standard marked blocks", async () => {
    const renderer = await readSource("src/components/MermaidRenderer.astro");

    expect(renderer).toContain('import("mermaid")');
    expect(renderer).toContain('pre[data-standard-mermaid="true"]');
    expect(renderer).toContain("向左平移 Mermaid 图");
    expect(renderer).toContain("MERMAID_PAN_STEP");
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
