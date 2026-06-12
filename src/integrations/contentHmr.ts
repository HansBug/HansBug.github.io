import { relative } from "node:path";
import type { AstroIntegration } from "astro";

const CONTENT_MARKDOWN_RE = /^src\/content\/(?:blog|routes|projects)\/.+\.md$/;
const REFRESH_DELAY_MS = 120;

function normalizeRelativePath(rootPath: string, filePath: string) {
  return relative(rootPath, filePath).replaceAll("\\", "/");
}

export default function contentHmr(): AstroIntegration {
  return {
    name: "hansbug-content-hmr",
    hooks: {
      "astro:server:setup": ({ server, refreshContent, logger }) => {
        if (!refreshContent) {
          return;
        }

        server.watcher.setMaxListeners(Math.max(server.watcher.getMaxListeners(), 50));
        const rootPath = server.config.root;
        let refreshTimer: ReturnType<typeof setTimeout> | undefined;
        const pendingPaths = new Set<string>();

        const scheduleRefresh = (filePath: string) => {
          const relativePath = normalizeRelativePath(rootPath, filePath);
          if (!CONTENT_MARKDOWN_RE.test(relativePath)) {
            return;
          }

          pendingPaths.add(relativePath);

          if (refreshTimer) {
            clearTimeout(refreshTimer);
          }

          refreshTimer = setTimeout(async () => {
            refreshTimer = undefined;
            const changedPaths = [...pendingPaths].sort();
            pendingPaths.clear();
            try {
              await refreshContent({});
              const dataStoreModule = server.moduleGraph.getModuleById("/@id/astro:data-layer-content");
              if (dataStoreModule) {
                server.moduleGraph.invalidateModule(dataStoreModule);
              }
              server.ws.send({ type: "full-reload", path: "*" });
              logger.info(`reloaded content from ${changedPaths.join(", ")}`);
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              logger.error(`failed to reload ${changedPaths.join(", ")}: ${message}`);
            }
          }, REFRESH_DELAY_MS);
        };

        server.watcher.add("src/content/**/*.md");
        server.watcher.on("add", scheduleRefresh);
        server.watcher.on("change", scheduleRefresh);
        server.watcher.on("unlink", scheduleRefresh);
      },
    },
  };
}
