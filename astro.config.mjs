import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import vue from "@astrojs/vue";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import contentHmr from "./src/integrations/contentHmr.ts";
import { remarkArticleCitationPreflight, rehypeArticleCitations } from "./src/utils/citations.ts";
import {
  remarkCodeCopyOptions,
  rehypeEnhancedCodeBlocks,
  remarkProtectDollarText,
  remarkStandardMermaid,
} from "./src/utils/markdownFeatures.ts";

export default defineConfig({
  site: "https://hansbug.github.io",
  output: "static",
  trailingSlash: "always",
  compressHTML: true,
  integrations: [
    sitemap({
      filter: (page) => !page.includes("/citation-fixture/"),
    }),
    vue(),
    contentHmr(),
  ],
  vite: {
    server: {
      watch: {
        usePolling: process.env.CHOKIDAR_USEPOLLING === "true",
        interval: 1000,
        ignored: [
          "**/.astro/**",
          "**/.git/**",
          "**/.omx/**",
          "**/coverage/**",
          "**/dist/**",
          "**/node_modules/**",
        ],
      },
    },
  },
  markdown: {
    remarkPlugins: [
      remarkGfm,
      remarkMath,
      remarkCodeCopyOptions,
      remarkProtectDollarText,
      remarkStandardMermaid,
      remarkArticleCitationPreflight,
    ],
    rehypePlugins: [rehypeKatex, rehypeEnhancedCodeBlocks, rehypeArticleCitations],
    shikiConfig: {
      theme: "github-dark",
    },
  },
});
