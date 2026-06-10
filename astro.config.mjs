import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import vue from "@astrojs/vue";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

export default defineConfig({
  site: "https://hansbug.github.io",
  output: "static",
  trailingSlash: "always",
  compressHTML: true,
  integrations: [sitemap(), vue()],
  vite: {
    server: {
      watch: {
        usePolling: true,
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
    remarkPlugins: [remarkGfm, remarkMath],
    rehypePlugins: [rehypeKatex],
    shikiConfig: {
      theme: "github-dark",
    },
  },
});
