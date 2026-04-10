import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import vue from "@astrojs/vue";
import remarkGfm from "remark-gfm";

export default defineConfig({
  site: "https://hansbug.github.io",
  output: "static",
  trailingSlash: "always",
  compressHTML: true,
  integrations: [sitemap(), vue()],
  markdown: {
    remarkPlugins: [remarkGfm],
    shikiConfig: {
      theme: "github-light",
    },
  },
});
