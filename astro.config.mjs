import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import vue from "@astrojs/vue";
import remarkGfm from "remark-gfm";
import remarkCitations from "./src/utils/remark/remarkCitations.mjs";

export default defineConfig({
  site: "https://hansbug.github.io",
  output: "static",
  trailingSlash: "always",
  compressHTML: true,
  integrations: [sitemap(), vue()],
  markdown: {
    remarkPlugins: [remarkGfm, remarkCitations],
    shikiConfig: {
      theme: "github-dark",
    },
  },
});
