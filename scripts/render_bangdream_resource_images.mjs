#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

import puppeteer from "puppeteer-core";

const execFile = promisify(execFileCallback);

const REPO_ROOT = process.cwd();
const USER_AGENT = "HansBugTechBlogRenderedAudit/1.0 (+https://github.com/HansBug/HansBug.github.io)";
const BESTDORI_SERVERS = ["jp", "cn", "en", "kr", "tw"];
const DEFAULT_INPUT = "src/data/deskpet/bangdream-rendered-resource-audit/render-input.jsonl";
const DEFAULT_OUTPUT_DIR = "src/data/deskpet/bangdream-rendered-resource-audit/rendered";
const DEFAULT_RESULTS = "src/data/deskpet/bangdream-rendered-resource-audit/render-results.json";
const DEFAULT_TIMEOUT = 90000;
const DEFAULT_RETRIES = 2;
const CHROME_PATH_CANDIDATES = [
  process.env.CHROME_PATH,
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);

function usage() {
  console.error(
    [
      "Usage:",
      "  node scripts/render_bangdream_resource_images.mjs [options]",
      "",
      "Options:",
      `  --input <path>          JSON/JSONL rows to render. Default: ${DEFAULT_INPUT}`,
      `  --output-dir <path>     PNG output directory. Default: ${DEFAULT_OUTPUT_DIR}`,
      `  --results <path>        JSON result output path. Default: ${DEFAULT_RESULTS}`,
      "  --limit <n>             Maximum rows to attempt.",
      "  --offset <n>            Rows to skip before applying limit.",
      `  --render-timeout <ms>   Per-resource render timeout. Default: ${DEFAULT_TIMEOUT}`,
      `  --retries <n>           Per-resource render attempts. Default: ${DEFAULT_RETRIES}`,
      "  --concurrency <n>       Concurrent Chromium pages. Default: 1.",
      "  --force                 Rerender existing images.",
      "  --keep-temp             Keep temporary mirrored models for debugging.",
      "  --help, -h              Show this help message.",
    ].join("\n"),
  );
}

function parseArgs(argv) {
  const args = {
    input: DEFAULT_INPUT,
    outputDir: DEFAULT_OUTPUT_DIR,
    results: DEFAULT_RESULTS,
    limit: null,
    offset: 0,
    renderTimeout: DEFAULT_TIMEOUT,
    retries: DEFAULT_RETRIES,
    concurrency: 1,
    force: false,
    keepTemp: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--input") {
      args.input = argv[++index];
    } else if (item === "--output-dir") {
      args.outputDir = argv[++index];
    } else if (item === "--results") {
      args.results = argv[++index];
    } else if (item === "--limit") {
      args.limit = Number(argv[++index]);
    } else if (item === "--offset") {
      args.offset = Number(argv[++index]);
    } else if (item === "--render-timeout") {
      args.renderTimeout = Number(argv[++index]);
    } else if (item === "--retries") {
      args.retries = Number(argv[++index]);
    } else if (item === "--concurrency") {
      args.concurrency = Number(argv[++index]);
    } else if (item === "--force") {
      args.force = true;
    } else if (item === "--keep-temp") {
      args.keepTemp = true;
    } else if (item === "--help" || item === "-h") {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${item}`);
    }
  }

  if (args.limit !== null && (!Number.isFinite(args.limit) || args.limit < 1)) {
    throw new Error(`Invalid --limit value: ${args.limit}`);
  }
  if (!Number.isFinite(args.offset) || args.offset < 0) {
    throw new Error(`Invalid --offset value: ${args.offset}`);
  }
  if (!Number.isFinite(args.renderTimeout) || args.renderTimeout <= 0) {
    throw new Error(`Invalid --render-timeout value: ${args.renderTimeout}`);
  }
  if (!Number.isFinite(args.retries) || args.retries < 0) {
    throw new Error(`Invalid --retries value: ${args.retries}`);
  }
  if (!Number.isFinite(args.concurrency) || args.concurrency < 1) {
    throw new Error(`Invalid --concurrency value: ${args.concurrency}`);
  }
  args.concurrency = Math.max(1, Math.floor(args.concurrency));

  return args;
}

function displayPath(filePath) {
  return path.relative(REPO_ROOT, path.resolve(filePath)).split(path.sep).join("/");
}

function isPathInside(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function sha256(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function sanitizeFileName(value) {
  return String(value || "").replace(/[^\w.-]+/g, "_").slice(0, 180);
}

function parseList(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  const text = String(value || "").trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return text.split(/[;,]/).map((item) => item.trim()).filter(Boolean);
  }
}

async function readRows(inputPath) {
  const text = await fs.readFile(inputPath, "utf8");
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) {
    return JSON.parse(trimmed);
  }
  return trimmed
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function buildDataUrlForRow(row) {
  if (row.bestdori_build_data_url) return String(row.bestdori_build_data_url);
  if (!row.costume_key || !row.bestdori_preferred_server) return "";
  return `https://bestdori.com/assets/${row.bestdori_preferred_server}/live2d/chara/${row.costume_key}_rip/buildData.asset`;
}

function replaceServer(url, server) {
  const parsed = new URL(url);
  const parts = parsed.pathname.split("/");
  const assetsIndex = parts.indexOf("assets");
  if (assetsIndex >= 0 && parts.length > assetsIndex + 1) {
    parts[assetsIndex + 1] = server;
    parsed.pathname = parts.join("/");
  }
  return parsed.toString();
}

function preferredServers(row) {
  const explicit = row.bestdori_preferred_server ? [row.bestdori_preferred_server] : [];
  const available = parseList(row.bestdori_available_servers);
  return [...new Set([...explicit, ...BESTDORI_SERVERS, ...available])].filter(Boolean);
}

function candidateBuildDataUrls(row) {
  const source = buildDataUrlForRow(row);
  if (!source) return [];
  return [...new Set([source, ...preferredServers(row).map((server) => replaceServer(source, server))])];
}

function bundleBaseUrl(buildDataUrl, bundleName) {
  const parsed = new URL(buildDataUrl);
  const parts = parsed.pathname.split("/");
  const assetsIndex = parts.indexOf("assets");
  if (assetsIndex < 0 || parts.length <= assetsIndex + 1) {
    return buildDataUrl.slice(0, buildDataUrl.lastIndexOf("/"));
  }
  const pathPrefix = parts.slice(0, assetsIndex + 2).join("/");
  const bundlePath = String(bundleName || "").replace(/^\/+|\/+$/g, "");
  const ripPath = bundlePath.endsWith("_rip") ? bundlePath : `${bundlePath}_rip`;
  parsed.pathname = `${pathPrefix}/${ripPath}`;
  return parsed.toString();
}

function entryFileName(entry) {
  return entry?.fileName || entry?.file || entry?.name || "";
}

function localAssetName(fileName) {
  const base = path.basename(String(fileName || ""));
  return base.endsWith(".bytes") ? base.slice(0, -".bytes".length) : base;
}

function assetUrlCandidates(buildDataUrl, entry, { appendPngIfMissingExt = false } = {}) {
  const fileName = entryFileName(entry);
  const baseUrl = entry?.bundleName
    ? bundleBaseUrl(buildDataUrl, entry.bundleName)
    : buildDataUrl.slice(0, buildDataUrl.lastIndexOf("/"));
  const fileNames = [fileName];
  if (fileName.endsWith(".bytes")) fileNames.push(fileName.slice(0, -".bytes".length));
  if (appendPngIfMissingExt && fileName && !path.extname(fileName)) fileNames.push(`${fileName}.png`);
  return [...new Set(fileNames.filter(Boolean))].map((name) => `${baseUrl}/${encodeURIComponent(name)}`);
}

async function fetchBuffer(url, { timeout = 45000, retries = 2 } = {}) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(timeout),
        headers: { "user-agent": USER_AGENT },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
      if (attempt < retries) await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }

  try {
    const { stdout } = await execFile(
      "curl",
      [
        "-L",
        "--fail",
        "--silent",
        "--show-error",
        "--retry",
        "3",
        "--connect-timeout",
        "20",
        "--max-time",
        String(Math.max(30, Math.ceil(timeout / 1000))),
        "-A",
        USER_AGENT,
        url,
      ],
      { encoding: "buffer", maxBuffer: 256 * 1024 * 1024 },
    );
    return stdout;
  } catch (curlError) {
    lastError = curlError;
  }

  throw new Error(`Fetch failed for ${url}: ${String(lastError && (lastError.message || lastError))}`);
}

async function fetchJsonFromCandidates(candidates) {
  let lastError = null;
  for (const url of candidates) {
    try {
      const data = await fetchBuffer(url, { timeout: 45000, retries: 2 });
      const text = data.toString("utf8");
      if (/^\s*</.test(text)) throw new Error("HTML response instead of JSON asset");
      return { url, json: JSON.parse(text), sha256: sha256(data), contentType: "application/json" };
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`Could not fetch buildData.asset: ${String(lastError && (lastError.message || lastError))}`);
}

async function fetchAssetFromCandidates(candidates, validate) {
  let lastError = null;
  for (const url of candidates) {
    try {
      const data = await fetchBuffer(url);
      if (validate && !validate(data)) throw new Error(`asset payload failed validation: ${url}`);
      return { url, data };
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`Could not fetch valid asset: ${String(lastError && (lastError.message || lastError))}`);
}

async function mirrorBestdoriModel(row, tempRoot) {
  const modelRoot = path.join(tempRoot, sanitizeFileName(row.resource_key));
  const live2dDir = path.join(modelRoot, "live2d");
  await fs.mkdir(live2dDir, { recursive: true });

  const { url: resolvedBuildDataUrl, json, sha256: buildDataSha256, contentType } = await fetchJsonFromCandidates(
    candidateBuildDataUrls(row),
  );
  const base = json.Base || json;
  if (!base.model || !entryFileName(base.model)) {
    throw new Error("buildData.asset does not contain a model reference");
  }

  const manifest = {
    name: row.model_key || row.resource_key,
    model: "",
    textures: [],
    type: "Live2D Model Setting",
    motions: {},
    expressions: [],
  };

  const modelFile = localAssetName(entryFileName(base.model));
  const { data: modelData } = await fetchAssetFromCandidates(
    assetUrlCandidates(resolvedBuildDataUrl, base.model),
    (data) => data.subarray(0, 3).toString("utf8") === "moc",
  );
  await fs.writeFile(path.join(live2dDir, modelFile), modelData);
  manifest.model = `live2d/${modelFile}`;

  if (base.physics && entryFileName(base.physics)) {
    try {
      const physicsFile = localAssetName(entryFileName(base.physics));
      const { data: physicsData } = await fetchAssetFromCandidates(
        assetUrlCandidates(resolvedBuildDataUrl, base.physics),
        (data) => !data.subarray(0, 32).toString("utf8").trimStart().startsWith("<"),
      );
      await fs.writeFile(path.join(live2dDir, physicsFile), physicsData);
      manifest.physics = `live2d/${physicsFile}`;
    } catch {
      // Static evidence rendering does not require physics.
    }
  }

  const textures = Array.isArray(base.textures) ? base.textures : [];
  if (textures.length === 0) throw new Error("buildData.asset does not contain texture references");
  for (const texture of textures) {
    const textureFile = localAssetName(entryFileName(texture));
    if (!textureFile) continue;
    const localTextureFile = path.extname(textureFile) ? textureFile : `${textureFile}.png`;
    const { data: textureData } = await fetchAssetFromCandidates(
      assetUrlCandidates(resolvedBuildDataUrl, texture, { appendPngIfMissingExt: true }),
      (data) => data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    );
    await fs.writeFile(path.join(live2dDir, localTextureFile), textureData);
    manifest.textures.push(`live2d/${localTextureFile}`);
  }
  if (manifest.textures.length === 0) throw new Error("No textures were mirrored");

  const manifestPath = path.join(modelRoot, "model.json");
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return {
    manifestPath,
    resolvedBuildDataUrl,
    buildDataSha256,
    buildDataContentType: contentType,
    textureCount: manifest.textures.length,
  };
}

function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".moc")) return "application/octet-stream";
  if (filePath.endsWith(".physics")) return "application/json; charset=utf-8";
  return "application/octet-stream";
}

function localModelUrl(filePath) {
  return `/__fs__${encodeURI(path.resolve(filePath))}`;
}

function pageHtml(modelUrl) {
  return `<!doctype html>
<meta charset="utf-8" />
<canvas id="view" width="440" height="560"></canvas>
<script>
window.__result = undefined;
window.__earlyErrors = [];
window.addEventListener("error", (event) => {
  window.__earlyErrors.push(String(event.message || event.error || "unknown early error"));
});
</script>
<script src="/__repo__/node_modules/pixi.js-legacy/dist/browser/pixi-legacy.min.js"></script>
<script src="/__repo__/src/vendor/deskpet/live2d.min.js"></script>
<script src="/__repo__/node_modules/pixi-live2d-display/dist/cubism2.min.js"></script>
<script>
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getExtractor(app) {
  return app.renderer.plugins?.extract || app.renderer.extract;
}

function trimmedAlphaBounds(pixels, width, height, alphaThreshold = 8) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let count = 0;
  const columnCounts = new Array(width).fill(0);
  const rowCounts = new Array(height).fill(0);
  for (let offset = 3, index = 0; offset < pixels.length; offset += 4, index += 1) {
    if (pixels[offset] <= alphaThreshold) continue;
    count += 1;
    const x = index % width;
    const y = Math.floor(index / width);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    columnCounts[x] += 1;
    rowCounts[y] += 1;
  }
  if (count === 0) return { count: 0, minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  const columnThreshold = Math.max(3, Math.floor(height * 0.006));
  const rowThreshold = Math.max(3, Math.floor(width * 0.006));
  while (minX < maxX && columnCounts[minX] < columnThreshold) minX += 1;
  while (maxX > minX && columnCounts[maxX] < columnThreshold) maxX -= 1;
  while (minY < maxY && rowCounts[minY] < rowThreshold) minY += 1;
  while (maxY > minY && rowCounts[maxY] < rowThreshold) maxY -= 1;
  return { count, minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function fitWholeModel(model, app) {
  const bounds = model.getLocalBounds();
  const width = Math.max(bounds.width, 1);
  const height = Math.max(bounds.height, 1);
  const maxWidth = app.renderer.width * 0.84;
  const maxHeight = app.renderer.height * 0.90;
  const scale = Math.min(maxWidth / width, maxHeight / height);
  model.pivot.set(bounds.x + width / 2, bounds.y + height / 2);
  model.position.set(app.renderer.width / 2, app.renderer.height / 2 + app.renderer.height * 0.025);
  model.scale.set(scale);
}

async function advance(app, model, frames = 14) {
  for (let index = 0; index < frames; index += 1) {
    if (typeof model.update === "function") model.update(16.67);
    app.renderer.render(app.stage);
    await sleep(16);
  }
}

(async () => {
  try {
    const app = new PIXI.Application({
      view: document.getElementById("view"),
      width: 440,
      height: 560,
      backgroundAlpha: 0,
      antialias: true,
      preserveDrawingBuffer: true,
      autoStart: false,
    });
    if (!PIXI.live2d || !PIXI.live2d.Live2DModel) {
      throw new Error("Live2D runtime missing: " + JSON.stringify({ pixiVersion: PIXI.VERSION, earlyErrors: window.__earlyErrors }));
    }
    const options = { autoUpdate: false };
    if (PIXI.live2d?.MotionPreloadStrategy) {
      options.motionPreload = PIXI.live2d.MotionPreloadStrategy.NONE;
    }
    const model = await PIXI.live2d.Live2DModel.from(${JSON.stringify(modelUrl)}, options);
    app.stage.addChild(model);
    fitWholeModel(model, app);
    await advance(app, model, 14);
    const extractor = getExtractor(app);
    if (!extractor || typeof extractor.pixels !== "function") {
      throw new Error("Pixi extract plugin is unavailable.");
    }
    app.renderer.render(app.stage);
    const pixels = extractor.pixels(app.stage);
    const bounds = trimmedAlphaBounds(pixels, app.renderer.width, app.renderer.height, 8);
    const nonblankRatio = bounds.count / Math.max(app.renderer.width * app.renderer.height, 1);
    const completePersonDecision =
      bounds.count > 0 && nonblankRatio >= 0.018 && bounds.width >= 90 && bounds.height >= 180
        ? "pass"
        : "review";
    window.__result = {
      ok: true,
      canvasWidth: app.renderer.width,
      canvasHeight: app.renderer.height,
      modelWidth: Math.round(model.width),
      modelHeight: Math.round(model.height),
      bounds,
      nonblankRatio,
      textureCount: Array.isArray(model.textures) ? model.textures.length : 0,
      completePersonDecision,
      screenshotDataUrl: app.renderer.view.toDataURL("image/png"),
    };
  } catch (error) {
    window.__result = { ok: false, error: String(error && (error.stack || error.message || error)) };
  }
})();
</script>`;
}

async function startServer({ fsRoots }) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    if (url.pathname === "/test.html") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(pageHtml(url.searchParams.get("model") || ""));
      return;
    }
    if (url.pathname.startsWith("/__repo__/")) {
      const filePath = path.resolve(REPO_ROOT, decodeURI(url.pathname.slice("/__repo__/".length)));
      if (!isPathInside(REPO_ROOT, filePath)) {
        res.writeHead(403);
        res.end("forbidden");
        return;
      }
      try {
        const data = await fs.readFile(filePath);
        res.writeHead(200, { "content-type": contentType(filePath) });
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end("not found");
      }
      return;
    }
    if (!url.pathname.startsWith("/__fs__/")) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    const filePath = path.resolve(decodeURI(url.pathname.slice("/__fs__".length)));
    if (!fsRoots.some((root) => isPathInside(root, filePath))) {
      res.writeHead(403);
      res.end("forbidden");
      return;
    }
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

async function findChromePath() {
  for (const candidate of CHROME_PATH_CANDIDATES) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Try the next browser path.
    }
  }
  throw new Error(`No Chrome/Chromium executable found. Tried: ${CHROME_PATH_CANDIDATES.join(", ")}`);
}

async function assertWebglSupport(page, timeoutMs) {
  await page.goto("data:text/html,<canvas id='probe' width='8' height='8'></canvas>", {
    waitUntil: "load",
    timeout: timeoutMs,
  });
  const result = await page.evaluate(() => {
    const canvas = document.getElementById("probe");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl") || canvas.getContext("webgl2");
    return { ok: Boolean(gl), renderer: gl ? gl.getParameter(gl.RENDERER) : "" };
  });
  if (!result.ok) throw new Error("Chromium WebGL is unavailable.");
  return result;
}

function dataUrlToBuffer(value) {
  return Buffer.from(String(value).replace(/^data:image\/png;base64,/, ""), "base64");
}

async function imageStatsFromPng(page, imagePath, baseUrl, timeoutMs) {
  const imageUrl = `${baseUrl}${localModelUrl(imagePath)}`;
  await page.goto(
    `data:text/html,${encodeURIComponent('<canvas id="view" width="440" height="560"></canvas>')}`,
    { waitUntil: "load", timeout: timeoutMs },
  );
  return page.evaluate(async (url) => {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.getElementById("view");
    const context = canvas.getContext("2d");
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let minX = canvas.width;
    let minY = canvas.height;
    let maxX = -1;
    let maxY = -1;
    let count = 0;
    const columnCounts = new Array(canvas.width).fill(0);
    const rowCounts = new Array(canvas.height).fill(0);
    for (let offset = 3, index = 0; offset < pixels.length; offset += 4, index += 1) {
      if (pixels[offset] <= 8) continue;
      count += 1;
      const x = index % canvas.width;
      const y = Math.floor(index / canvas.width);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      columnCounts[x] += 1;
      rowCounts[y] += 1;
    }
    if (count === 0) {
      return {
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        bounds: { count: 0, minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 },
        nonblankRatio: 0,
        completePersonDecision: "review",
      };
    }
    const columnThreshold = Math.max(3, Math.floor(canvas.height * 0.006));
    const rowThreshold = Math.max(3, Math.floor(canvas.width * 0.006));
    while (minX < maxX && columnCounts[minX] < columnThreshold) minX += 1;
    while (maxX > minX && columnCounts[maxX] < columnThreshold) maxX -= 1;
    while (minY < maxY && rowCounts[minY] < rowThreshold) minY += 1;
    while (maxY > minY && rowCounts[maxY] < rowThreshold) maxY -= 1;
    const bounds = {
      count,
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    };
    const nonblankRatio = count / Math.max(canvas.width * canvas.height, 1);
    return {
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      bounds,
      nonblankRatio,
      completePersonDecision:
        count > 0 && nonblankRatio >= 0.018 && bounds.width >= 90 && bounds.height >= 180
          ? "pass"
          : "review",
    };
  }, imageUrl);
}

function failureResult(row, error, attemptCount) {
  const message = String(error && (error.message || error));
  let status = "unknown_error";
  if (/timed out|timeout/i.test(message)) status = "render_timeout";
  if (/HTML response|buildData|JSON/i.test(message)) status = "build_data_invalid";
  if (/Fetch failed|HTTP|curl/i.test(message)) status = "network_failed";
  if (/texture|moc|asset payload/i.test(message)) status = "conversion_failed";
  return {
    resource_key: row.resource_key,
    status,
    attempted_at: new Date().toISOString(),
    attempt_count: attemptCount,
    error: message.slice(0, 1000),
  };
}

async function renderOne({ row, page, baseUrl, outputDir, tempRoot, timeoutMs, force, retries }) {
  const imagePath = path.resolve(outputDir, `${sanitizeFileName(row.resource_key)}.png`);
  await fs.mkdir(path.dirname(imagePath), { recursive: true });
  if (!force) {
    try {
      const existing = await fs.readFile(imagePath);
      const stats = await imageStatsFromPng(page, imagePath, baseUrl, timeoutMs);
      return {
        resource_key: row.resource_key,
        status: "reused",
        image_path: displayPath(imagePath),
        image_sha256: sha256(existing),
        canvas_width: stats.canvasWidth,
        canvas_height: stats.canvasHeight,
        nonblank_ratio: Number(stats.nonblankRatio.toFixed(6)),
        bounds_min_x: stats.bounds.minX,
        bounds_min_y: stats.bounds.minY,
        bounds_max_x: stats.bounds.maxX,
        bounds_max_y: stats.bounds.maxY,
        bounds_width: stats.bounds.width,
        bounds_height: stats.bounds.height,
        complete_person_decision: stats.completePersonDecision,
        attempted_at: new Date().toISOString(),
        attempt_count: 0,
      };
    } catch (error) {
      if (error && error.code !== "ENOENT") throw error;
    }
  }

  let lastError = null;
  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    try {
      const mirrored = await mirrorBestdoriModel(row, tempRoot);
      await page.goto(
        `${baseUrl}/test.html?model=${encodeURIComponent(`${baseUrl}${localModelUrl(mirrored.manifestPath)}`)}`,
        { waitUntil: "networkidle2", timeout: timeoutMs },
      );
      await page.waitForFunction("window.__result !== undefined", { timeout: timeoutMs });
      const result = await page.evaluate("window.__result");
      if (!result.ok) throw new Error(result.error || "render failed");
      const screenshot = dataUrlToBuffer(result.screenshotDataUrl);
      const imageSha = sha256(screenshot);
      await fs.writeFile(imagePath, screenshot);
      return {
        resource_key: row.resource_key,
        status: result.bounds?.count > 0 ? "rendered" : "blank_canvas",
        image_path: displayPath(imagePath),
        image_sha256: imageSha,
        resolved_build_data_url: mirrored.resolvedBuildDataUrl,
        build_data_sha256: mirrored.buildDataSha256,
        build_data_content_type: mirrored.buildDataContentType,
        texture_count: mirrored.textureCount,
        canvas_width: result.canvasWidth,
        canvas_height: result.canvasHeight,
        model_width: result.modelWidth,
        model_height: result.modelHeight,
        nonblank_ratio: Number(result.nonblankRatio.toFixed(6)),
        bounds_min_x: result.bounds.minX,
        bounds_min_y: result.bounds.minY,
        bounds_max_x: result.bounds.maxX,
        bounds_max_y: result.bounds.maxY,
        bounds_width: result.bounds.width,
        bounds_height: result.bounds.height,
        complete_person_decision: result.completePersonDecision,
        attempted_at: new Date().toISOString(),
        attempt_count: attempt,
        error: "",
      };
    } catch (error) {
      lastError = error;
    }
  }
  return failureResult(row, lastError, retries + 1);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  args.input = path.resolve(args.input);
  args.outputDir = path.resolve(args.outputDir);
  args.results = path.resolve(args.results);

  const allRows = await readRows(args.input);
  const rows = allRows.slice(args.offset, args.limit === null ? undefined : args.offset + args.limit);
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "bangdream-rendered-audit-"));
  const server = await startServer({ fsRoots: [REPO_ROOT, tempRoot] });
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const chromePath = await findChromePath();
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-web-security",
      "--enable-webgl",
      "--enable-unsafe-swiftshader",
      "--ignore-gpu-blocklist",
      "--use-gl=swiftshader",
      "--disable-dev-shm-usage",
    ],
    timeout: args.renderTimeout,
    protocolTimeout: args.renderTimeout,
  });

  const results = new Array(rows.length);
  try {
    const probePage = await browser.newPage();
    await assertWebglSupport(probePage, args.renderTimeout);
    await probePage.close();

    let nextIndex = 0;
    async function worker(workerId) {
      const page = await browser.newPage();
      page.setDefaultTimeout(args.renderTimeout);
      page.setDefaultNavigationTimeout(args.renderTimeout);
      try {
        while (true) {
          const index = nextIndex;
          nextIndex += 1;
          if (index >= rows.length) break;
          const row = rows[index];
          process.stderr.write(
            `${args.offset + index + 1}/${allRows.length} ${row.resource_key} worker=${workerId}\n`,
          );
          results[index] = await renderOne({
            row,
            page,
            baseUrl,
          outputDir: args.outputDir,
          tempRoot,
          timeoutMs: args.renderTimeout,
            force: args.force,
            retries: args.retries,
          });
        }
      } finally {
        await page.close();
      }
    }

    const workerCount = Math.min(args.concurrency, rows.length);
    await Promise.all(Array.from({ length: workerCount }, (_, index) => worker(index + 1)));
  } finally {
    await browser.close();
    server.close();
    if (!args.keepTemp) {
      await fs.rm(tempRoot, { recursive: true, force: true });
    } else {
      process.stderr.write(`Kept temp root: ${tempRoot}\n`);
    }
  }

  const payload = {
    generated_at: new Date().toISOString(),
    input: displayPath(args.input),
    output_dir: displayPath(args.outputDir),
    offset: args.offset,
    limit: args.limit,
    concurrency: args.concurrency,
    total_input_rows: allRows.length,
    attempted_rows: rows.length,
    results: results.filter(Boolean),
  };
  await fs.mkdir(path.dirname(args.results), { recursive: true });
  await fs.writeFile(args.results, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  process.stdout.write(`${args.results}\n`);
}

await main();
