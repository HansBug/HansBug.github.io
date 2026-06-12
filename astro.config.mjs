import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import vue from "@astrojs/vue";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import contentHmr from "./src/integrations/contentHmr.ts";
import {
  rehypeEnhancedCodeBlocks,
  remarkProtectDollarText,
  remarkStandardMermaid,
} from "./src/utils/markdownFeatures.ts";

export default defineConfig({
  site: "https://hansbug.github.io",
  output: "static",
  trailingSlash: "always",
  compressHTML: true,
  integrations: [sitemap(), vue(), contentHmr()],
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
    remarkPlugins: [remarkGfm, remarkMath, remarkProtectDollarText, remarkStandardMermaid],
    rehypePlugins: [rehypeKatex, rehypeEnhancedCodeBlocks],
    shikiConfig: {
      theme: "github-dark",
    },
  },
});
