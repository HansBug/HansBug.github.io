import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import puppeteer from "puppeteer-core";

const CHROME_PATH = process.env.CHROME_PATH || "/usr/bin/google-chrome";
const DEFAULT_TIMEOUT = 60000;

function usage() {
  console.error(
    [
      "Usage:",
      "  node scripts/validate_live2d_models.mjs [options] <file-or-dir-or-url>...",
      "",
      "Options:",
      "  --timeout <ms>     Per-model timeout. Default: 60000",
      "  --limit <n>        Only test the first n collected manifests",
      "  --match <text>     Only keep manifests whose path/URL contains the text",
      "  --output <path>    Write the final JSON array to a file",
      "",
      "Examples:",
      "  node scripts/validate_live2d_models.mjs /tmp/live2d-more/AzurLane-Live2D/live2d",
      "  node scripts/validate_live2d_models.mjs --match lafei /tmp/live2d-more/AzurLane-Live2D/live2d",
      "  node scripts/validate_live2d_models.mjs https://cdn.jsdelivr.net/gh/Live2D/CubismWebSamples@master/Samples/Resources/Hiyori/Hiyori.model3.json",
    ].join("\n"),
  );
}

function parseArgs(argv) {
  const args = {
    timeout: DEFAULT_TIMEOUT,
    limit: null,
    match: null,
    output: null,
    targets: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];

    if (item === "--timeout") {
      args.timeout = Number(argv[index + 1]);
      index += 1;
      continue;
    }

    if (item === "--limit") {
      args.limit = Number(argv[index + 1]);
      index += 1;
      continue;
    }

    if (item === "--match") {
      args.match = argv[index + 1];
      index += 1;
      continue;
    }

    if (item === "--output") {
      args.output = argv[index + 1];
      index += 1;
      continue;
    }

    if (item === "--help" || item === "-h") {
      usage();
      process.exit(0);
    }

    args.targets.push(item);
  }

  if (args.targets.length === 0) {
    usage();
    process.exit(1);
  }

  if (!Number.isFinite(args.timeout) || args.timeout <= 0) {
    throw new Error(`Invalid --timeout value: ${args.timeout}`);
  }

  if (args.limit !== null && (!Number.isFinite(args.limit) || args.limit <= 0)) {
    throw new Error(`Invalid --limit value: ${args.limit}`);
  }

  return args;
}

function isRemoteTarget(value) {
  return value.startsWith("http://") || value.startsWith("https://");
}

function isManifestFile(value) {
  return value.endsWith(".model3.json") || value.endsWith(".model.json");
}

async function walkManifests(dir) {
  const results = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      results.push(...(await walkManifests(fullPath)));
      continue;
    }

    if (entry.isFile() && isManifestFile(entry.name)) {
      results.push(fullPath);
    }
  }

  return results;
}

async function collectTargets(targets) {
  const manifests = [];

  for (const target of targets) {
    if (isRemoteTarget(target)) {
      manifests.push(target);
      continue;
    }

    const stats = await fs.stat(target);
    if (stats.isFile()) {
      if (isManifestFile(target)) {
        manifests.push(path.resolve(target));
      }
      continue;
    }

    if (stats.isDirectory()) {
      manifests.push(...(await walkManifests(path.resolve(target))));
    }
  }

  manifests.sort((left, right) => left.localeCompare(right));
  return manifests;
}

function runtimeForManifest(target) {
  if (target.endsWith(".model3.json")) {
    return "cubism4";
  }
  if (target.endsWith(".model.json")) {
    return "cubism2";
  }
  throw new Error(`Unknown manifest runtime: ${target}`);
}

function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
  if (filePath.endsWith(".wav")) return "audio/wav";
  return "application/octet-stream";
}

function pageHtml(runtime, modelUrl) {
  const cubism2Scripts = `
    <script src="https://cdn.jsdelivr.net/gh/dylanNew/live2d/webgl/Live2D/lib/live2d.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/pixi-live2d-display/dist/cubism2.min.js"></script>
  `;
  const cubism4Scripts = `
    <script src="https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/pixi-live2d-display/dist/cubism4.min.js"></script>
  `;

  return `<!doctype html>
<meta charset="utf-8" />
<canvas id="view" width="800" height="600"></canvas>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pixi.js/7.3.2/pixi.min.js"></script>
${runtime === "cubism2" ? cubism2Scripts : cubism4Scripts}
<script>
window.__result = undefined;
window.addEventListener("error", (event) => {
  window.__result = {
    ok: false,
    stage: "window-error",
    error: String(event.message || event.error || "unknown window error"),
  };
});

(async () => {
  try {
    window.PIXI = PIXI;
    const app = new PIXI.Application({
      view: document.getElementById("view"),
      width: 800,
      height: 600,
      autoStart: false,
      backgroundAlpha: 0,
    });

    const options = { autoUpdate: false };
    if (PIXI.live2d.MotionPreloadStrategy) {
      options.motionPreload = PIXI.live2d.MotionPreloadStrategy.NONE;
    }

    const model = await PIXI.live2d.Live2DModel.from(${JSON.stringify(modelUrl)}, options);
    app.stage.addChild(model);
    model.update(16);
    app.render();

    window.__result = {
      ok: true,
      width: model.width,
      height: model.height,
      textureCount: Array.isArray(model.textures) ? model.textures.length : null,
    };
  } catch (error) {
    window.__result = {
      ok: false,
      stage: "load",
      error: String(error && (error.stack || error.message || error)),
    };
  }
})();
</script>`;
}

function localModelUrl(manifestPath) {
  return `/__fs__${encodeURI(path.resolve(manifestPath))}`;
}

async function startServer() {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");

    if (url.pathname === "/test.html") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(pageHtml(url.searchParams.get("runtime"), url.searchParams.get("model")));
      return;
    }

    if (!url.pathname.startsWith("/__fs__/")) {
      res.writeHead(404);
      res.end("not found");
      return;
    }

    const filePath = decodeURI(url.pathname.slice("/__fs__".length));

    try {
      const data = await fs.readFile(filePath);
      res.writeHead(200, { "content-type": contentType(filePath) });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("not found");
    }
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return server;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const collected = await collectTargets(args.targets);
  const filtered = collected.filter((item) => !args.match || item.includes(args.match));
  const manifests = args.limit === null ? filtered : filtered.slice(0, args.limit);

  if (manifests.length === 0) {
    throw new Error("No manifest matched the current filters.");
  }

  const server = await startServer();
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-web-security"],
  });

  const results = [];

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(args.timeout);

    for (const manifest of manifests) {
      const runtime = runtimeForManifest(manifest);
      const model = isRemoteTarget(manifest) ? manifest : `${baseUrl}${localModelUrl(manifest)}`;
      const startedAt = performance.now();

      try {
        await page.goto(
          `${baseUrl}/test.html?runtime=${encodeURIComponent(runtime)}&model=${encodeURIComponent(model)}`,
          { waitUntil: "networkidle2", timeout: args.timeout },
        );
        await page.waitForFunction("window.__result !== undefined", { timeout: args.timeout });

        const result = await page.evaluate("window.__result");
        const record = {
          manifest,
          runtime,
          source: isRemoteTarget(manifest) ? "remote" : "local",
          durationMs: Math.round(performance.now() - startedAt),
          result,
        };
        results.push(record);
        console.log(JSON.stringify(record));
      } catch (error) {
        const record = {
          manifest,
          runtime,
          source: isRemoteTarget(manifest) ? "remote" : "local",
          durationMs: Math.round(performance.now() - startedAt),
          result: {
            ok: false,
            stage: "driver",
            error: String(error && (error.stack || error.message || error)),
          },
        };
        results.push(record);
        console.log(JSON.stringify(record));
      }
    }
  } finally {
    await browser.close();
    server.close();
  }

  if (args.output) {
    await fs.writeFile(args.output, `${JSON.stringify(results, null, 2)}\n`, "utf8");
  }

  const passed = results.filter((item) => item.result.ok).length;
  const failed = results.length - passed;
  console.error(`Validated ${results.length} models: ${passed} passed, ${failed} failed.`);
}

await main();
