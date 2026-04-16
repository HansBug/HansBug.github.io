import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import vue from "@astrojs/vue";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import remarkCitations from "./src/utils/remark/remarkCitations.mjs";

export default defineConfig({
  site: "https://hansbug.github.io",
  output: "static",
  trailingSlash: "always",
  compressHTML: true,
  integrations: [sitemap(), vue()],
  markdown: {
    remarkPlugins: [remarkGfm, remarkMath, remarkCitations],
    rehypePlugins: [rehypeKatex],
    shikiConfig: {
      theme: "github-dark",
    },
  },
});
