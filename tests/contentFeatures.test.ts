import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { hasMermaidFence } from "../src/utils/markdownFeatures";

async function readSource(path: string) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("Mermaid fence detection", () => {
  it("detects only the documented standard mermaid fence", () => {
    expect(hasMermaidFence("```mermaid\nflowchart TD\n  A --> B\n```")).toBe(true);
    expect(hasMermaidFence("```Mermaid\nflowchart TD\n  A --> B\n```")).toBe(false);
    expect(hasMermaidFence("``` mermaid\nflowchart TD\n  A --> B\n```")).toBe(false);
    expect(hasMermaidFence("```mermaid title=\"demo\"\nflowchart TD\n  A --> B\n```")).toBe(false);
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
  it("configures GFM, remark-math and rehype-katex together", async () => {
    const config = await readSource("astro.config.mjs");

    expect(config).toContain('import remarkGfm from "remark-gfm";');
    expect(config).toContain('import remarkMath from "remark-math";');
    expect(config).toContain('import rehypeKatex from "rehype-katex";');
    expect(config).toContain("remarkPlugins: [remarkGfm, remarkMath]");
    expect(config).toContain("rehypePlugins: [rehypeKatex]");
  });

  it("loads KaTeX CSS from the shared layout", async () => {
    const layout = await readSource("src/layouts/BaseLayout.astro");

    expect(layout).toContain('import "katex/dist/katex.min.css";');
  });

  it("keeps generated directories out of the Vite dev watcher", async () => {
    const config = await readSource("astro.config.mjs");

    expect(config).toContain("**/dist/**");
    expect(config).toContain("**/coverage/**");
    expect(config).toContain("**/.astro/**");
    expect(config).toContain("**/.git/**");
    expect(config).toContain("usePolling: true");
    expect(config).toContain("interval: 1000");
  });
});

describe("Mermaid renderer wiring", () => {
  const detailPages = [
    "src/pages/blog/[...slug].astro",
    "src/pages/routes/[slug].astro",
    "src/pages/projects/[slug].astro",
  ];

  it.each(detailPages)("uses the shared Mermaid fence detector in %s", async (path) => {
    const source = await readSource(path);

    expect(source).toContain('import MermaidRenderer from "../../components/MermaidRenderer.astro";');
    expect(source).toContain('import { hasMermaidFence } from "../../utils/markdownFeatures";');
    expect(source).toContain("hasMermaidFence(");
    expect(source).not.toContain('.includes("```mermaid")');
    expect(source).toContain("{hasMermaid && <MermaidRenderer />}");
  });

  it("uses dynamic Mermaid imports instead of inlining the bundled runtime", async () => {
    const renderer = await readSource("src/components/MermaidRenderer.astro");

    expect(renderer).toContain('import("mermaid")');
    expect(renderer).not.toContain("mermaid.min.js?raw");
    expect(renderer).toContain('securityLevel: "strict"');
  });
});
