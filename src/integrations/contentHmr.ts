import { join, relative } from "node:path";
import type { AstroIntegration } from "astro";

const CONTENT_MARKDOWN_RE = /^src\/content\/(?:blog|routes|projects)\/.+\.md$/;
const CONTENT_ROOT_DIR = "src/content";
const REFRESH_DELAY_MS = 120;
type ContentChangeEvent = "add" | "change" | "unlink";

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
        const pendingRouteTablePaths = new Set<string>();

        const scheduleRefresh = (filePath: string, eventType: ContentChangeEvent) => {
          const relativePath = normalizeRelativePath(rootPath, filePath);
          if (!CONTENT_MARKDOWN_RE.test(relativePath)) {
            return;
          }

          pendingPaths.add(relativePath);
          if (eventType !== "change") {
            pendingRouteTablePaths.add(relativePath);
          }

          if (refreshTimer) {
            clearTimeout(refreshTimer);
          }

          refreshTimer = setTimeout(async () => {
            refreshTimer = undefined;
            const changedPaths = [...pendingPaths].sort();
            const routeTablePaths = [...pendingRouteTablePaths].sort();
            pendingPaths.clear();
            pendingRouteTablePaths.clear();
            try {
              await refreshContent({});
              const dataStoreModule = server.moduleGraph.getModuleById("/@id/astro:data-layer-content");
              if (dataStoreModule) {
                server.moduleGraph.invalidateModule(dataStoreModule);
              }
              server.ws.send({ type: "full-reload", path: "*" });
              logger.info(`reloaded content from ${changedPaths.join(", ")}`);
              if (routeTablePaths.length > 0) {
                logger.warn(
                  `added or removed content files may require restarting dev server to rebuild Astro routes: ${routeTablePaths.join(
                    ", ",
                  )}`,
                );
              }
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              logger.error(`failed to reload ${changedPaths.join(", ")}: ${message}`);
            }
          }, REFRESH_DELAY_MS);
        };

        server.watcher.add(join(rootPath, CONTENT_ROOT_DIR));
        server.watcher.on("add", (filePath) => scheduleRefresh(filePath, "add"));
        server.watcher.on("change", (filePath) => scheduleRefresh(filePath, "change"));
        server.watcher.on("unlink", (filePath) => scheduleRefresh(filePath, "unlink"));
      },
    },
  };
}
