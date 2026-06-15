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
const AUDIT_DIR = "src/data/deskpet/bangdream-resource-audit";
const DEFAULT_AUDIT_CSV = `${AUDIT_DIR}/audit.csv`;
const DEFAULT_OUTPUT_DIR = `${AUDIT_DIR}/rating-examples`;
const DEFAULT_REPORT_PATH = `${AUDIT_DIR}/rating-examples.md`;
const DEFAULT_LIMIT_PER_RATING = 20;
const SELECTION_SPILLOVER_MULTIPLIER = 3;
const DEFAULT_RENDER_TIMEOUT = 90000;
const USER_AGENT = "HansBugTechBlogDeskpetAudit/1.0 (+https://github.com/HansBug/HansBug.github.io)";
const BESTDORI_SERVERS = ["jp", "cn", "en", "kr", "tw"];
const RATINGS = ["general", "sensitive", "questionable", "explicit", "unknown"];
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
      "  node scripts/export_bangdream_rating_examples.mjs [options]",
      "",
      "Options:",
      `  --audit-csv <path>          Audit CSV path. Default: ${DEFAULT_AUDIT_CSV}`,
      `  --output-dir <path>         Image/index output directory. Default: ${DEFAULT_OUTPUT_DIR}`,
      `  --report <path>             Markdown report path. Default: ${DEFAULT_REPORT_PATH}`,
      `  --limit-per-rating <n>      Target examples per rating. Default: ${DEFAULT_LIMIT_PER_RATING}`,
      `  --render-timeout <ms>       Per-resource render timeout. Default: ${DEFAULT_RENDER_TIMEOUT}`,
      "  --force                     Rerender images even when output PNG already exists",
      "  --keep-temp                 Keep mirrored temporary Live2D models for debugging",
      "  --help, -h                  Show this help message",
    ].join("\n"),
  );
}

function parseArgs(argv) {
  const args = {
    auditCsv: DEFAULT_AUDIT_CSV,
    outputDir: DEFAULT_OUTPUT_DIR,
    reportPath: DEFAULT_REPORT_PATH,
    limitPerRating: DEFAULT_LIMIT_PER_RATING,
    renderTimeout: DEFAULT_RENDER_TIMEOUT,
    force: false,
    keepTemp: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--audit-csv") {
      args.auditCsv = argv[index + 1];
      index += 1;
      continue;
    }
    if (item === "--output-dir") {
      args.outputDir = argv[index + 1];
      index += 1;
      continue;
    }
    if (item === "--report") {
      args.reportPath = argv[index + 1];
      index += 1;
      continue;
    }
    if (item === "--limit-per-rating") {
      args.limitPerRating = Number(argv[index + 1]);
      index += 1;
      continue;
    }
    if (item === "--render-timeout") {
      args.renderTimeout = Number(argv[index + 1]);
      index += 1;
      continue;
    }
    if (item === "--force") {
      args.force = true;
      continue;
    }
    if (item === "--keep-temp") {
      args.keepTemp = true;
      continue;
    }
    if (item === "--help" || item === "-h") {
      usage();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${item}`);
  }

  if (!Number.isFinite(args.limitPerRating) || args.limitPerRating <= 0) {
    throw new Error(`Invalid --limit-per-rating value: ${args.limitPerRating}`);
  }
  if (!Number.isFinite(args.renderTimeout) || args.renderTimeout <= 0) {
    throw new Error(`Invalid --render-timeout value: ${args.renderTimeout}`);
  }

  return args;
}

function displayPath(filePath) {
  return path.relative(REPO_ROOT, path.resolve(filePath)).split(path.sep).join("/");
}

function isPathInside(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function csvParse(text) {
  const normalized = text.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const next = normalized[index + 1];

    if (quoted) {
      if (char === "\"" && next === "\"") {
        cell += "\"";
        index += 1;
        continue;
      }
      if (char === "\"") {
        quoted = false;
        continue;
      }
      cell += char;
      continue;
    }

    if (char === "\"") {
      quoted = true;
      continue;
    }
    if (char === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (char === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }

  const [header, ...body] = rows.filter((item) => item.some((value) => value.length > 0));
  if (!header) return [];
  return body.map((values) => Object.fromEntries(header.map((name, index) => [name, values[index] ?? ""])));
}

function numeric(value, fallback = 0) {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
}

function trueish(value) {
  return String(value).trim().toLowerCase() === "true";
}

function parseList(value) {
  const text = String(value || "").trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return text.split(";").map((item) => item.trim()).filter(Boolean);
  }
}

function sha256(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function sanitizeFileName(value) {
  return String(value).replace(/[^\w.-]+/g, "_").slice(0, 160);
}

function markdownEscape(value) {
  return String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll("|", "\\|")
    .replaceAll("\n", " ")
    .trim();
}

function modelCode(row) {
  const key = row.model_key || row.resource_key.replace(/^bangdream_/, "");
  const match = key.match(/^(?:upstream_)?(\d{3})_/);
  return match ? match[1] : key.split("_")[0] || "";
}

function buildDataUrlForRow(row) {
  if (row.bestdori_build_data_url) {
    return row.bestdori_build_data_url;
  }
  if (!row.tagger_visual_evidence_primary_url) {
    return "";
  }
  try {
    const parsed = new URL(row.tagger_visual_evidence_primary_url);
    parsed.pathname = parsed.pathname.replace(/\/[^/]+$/, "/buildData.asset");
    return parsed.toString();
  } catch {
    return "";
  }
}

function ratingCounts(rows) {
  const counts = Object.fromEntries(RATINGS.map((rating) => [rating, 0]));
  for (const row of rows) {
    if (Object.hasOwn(counts, row.final_content_rating)) {
      counts[row.final_content_rating] += 1;
    }
  }
  return counts;
}

function visualEvidenceCounts(rows) {
  const counts = Object.fromEntries(RATINGS.map((rating) => [rating, { withVisualEvidence: 0, missingVisualEvidence: 0 }]));
  for (const row of rows) {
    if (!Object.hasOwn(counts, row.final_content_rating)) continue;
    if (row.tagger_visual_evidence_primary_url) {
      counts[row.final_content_rating].withVisualEvidence += 1;
    } else {
      counts[row.final_content_rating].missingVisualEvidence += 1;
    }
  }
  return counts;
}

function compareRowsForRating(rating) {
  return (left, right) => {
    if (rating === "unknown") {
      const leftCompleted = left.llm_review_status === "completed" ? 0 : 1;
      const rightCompleted = right.llm_review_status === "completed" ? 0 : 1;
      if (leftCompleted !== rightCompleted) return leftCompleted - rightCompleted;
      const margin = numeric(left.rating_margin) - numeric(right.rating_margin);
      if (Math.abs(margin) > 0.000001) return margin;
      const confidence = numeric(left.rating_confidence) - numeric(right.rating_confidence);
      if (Math.abs(confidence) > 0.000001) return confidence;
      return left.resource_key.localeCompare(right.resource_key);
    }

    const leftDirect = left.llm_review_status === "not_required" ? 0 : 1;
    const rightDirect = right.llm_review_status === "not_required" ? 0 : 1;
    if (leftDirect !== rightDirect) return leftDirect - rightDirect;
    const confidence = numeric(right.rating_confidence) - numeric(left.rating_confidence);
    if (Math.abs(confidence) > 0.000001) return confidence;
    const margin = numeric(right.rating_margin) - numeric(left.rating_margin);
    if (Math.abs(margin) > 0.000001) return margin;
    return left.resource_key.localeCompare(right.resource_key);
  };
}

function selectDiverseRows(candidates, limit, rating) {
  const selected = [];
  const selectedKeys = new Set();
  const sorted = [...candidates].sort(compareRowsForRating(rating));
  const passes = rating === "questionable" ? [4, Number.POSITIVE_INFINITY] : [2, 3, Number.POSITIVE_INFINITY];

  for (const maxPerCode of passes) {
    const codeCounts = new Map();
    for (const item of selected) {
      codeCounts.set(modelCode(item), (codeCounts.get(modelCode(item)) ?? 0) + 1);
    }
    for (const row of sorted) {
      if (selected.length >= limit) break;
      if (selectedKeys.has(row.resource_key)) continue;
      const code = modelCode(row);
      if ((codeCounts.get(code) ?? 0) >= maxPerCode) continue;
      selected.push(row);
      selectedKeys.add(row.resource_key);
      codeCounts.set(code, (codeCounts.get(code) ?? 0) + 1);
    }
  }

  return selected;
}

function selectExamples(rows, limitPerRating) {
  const selected = {};
  const availableCounts = Object.fromEntries(RATINGS.map((rating) => [rating, 0]));
  for (const row of rows) {
    if (Object.hasOwn(availableCounts, row.final_content_rating) && row.tagger_visual_evidence_primary_url && buildDataUrlForRow(row)) {
      availableCounts[row.final_content_rating] += 1;
    }
  }
  for (const rating of RATINGS) {
    const candidates = rows.filter(
      (row) =>
        row.final_content_rating === rating &&
        row.tagger_visual_evidence_primary_url &&
        buildDataUrlForRow(row),
    );
    selected[rating] = selectDiverseRows(
      candidates,
      Math.min(candidates.length, limitPerRating * SELECTION_SPILLOVER_MULTIPLIER),
      rating,
    );
  }
  return { selected, availableCounts };
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
  const candidates = [source, ...preferredServers(row).map((server) => replaceServer(source, server))];
  return [...new Set(candidates)];
}

function localAssetName(fileName) {
  const base = path.basename(String(fileName || ""));
  return base.endsWith(".bytes") ? base.slice(0, -".bytes".length) : base;
}

function entryFileName(entry) {
  return entry?.fileName || entry?.file || entry?.name || "";
}

async function fetchBuffer(url, { timeout = 45000, retries = 2 } = {}) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(timeout),
        headers: { "user-agent": USER_AGENT },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
      }
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
      if (/^\s*</.test(text)) {
        throw new Error("HTML response instead of JSON asset");
      }
      return { url, json: JSON.parse(text) };
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`Could not fetch buildData.asset: ${String(lastError && (lastError.message || lastError))}`);
}

function assetUrlCandidates(buildDataUrl, entry, { appendPngIfMissingExt = false } = {}) {
  const fileName = entryFileName(entry);
  const baseUrl = entry?.bundleName
    ? bundleBaseUrl(buildDataUrl, entry.bundleName)
    : buildDataUrl.slice(0, buildDataUrl.lastIndexOf("/"));
  const fileNames = [fileName];
  if (fileName.endsWith(".bytes")) {
    fileNames.push(fileName.slice(0, -".bytes".length));
  }
  if (appendPngIfMissingExt && fileName && !path.extname(fileName)) {
    fileNames.push(`${fileName}.png`);
  }
  return [...new Set(fileNames.filter(Boolean))].map((name) => `${baseUrl}/${encodeURIComponent(name)}`);
}

async function fetchAssetFromCandidates(candidates, validate) {
  let lastError = null;
  for (const url of candidates) {
    try {
      const data = await fetchBuffer(url);
      if (validate && !validate(data)) {
        throw new Error(`asset payload failed validation: ${url}`);
      }
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

  const { url: resolvedBuildDataUrl, json } = await fetchJsonFromCandidates(candidateBuildDataUrls(row));
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
      // Physics is useful for motion, but not required for static evidence rendering.
    }
  }

  const textures = Array.isArray(base.textures) ? base.textures : [];
  if (textures.length === 0) {
    throw new Error("buildData.asset does not contain texture references");
  }
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
  if (manifest.textures.length === 0) {
    throw new Error("No textures were mirrored");
  }

  const manifestPath = path.join(modelRoot, "model.json");
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return {
    manifestPath,
    resolvedBuildDataUrl,
    textureCount: manifest.textures.length,
  };
}

function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
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

function alphaBounds(pixels, width, height, alphaThreshold = 8) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let count = 0;
  for (let offset = 3, index = 0; offset < pixels.length; offset += 4, index += 1) {
    if (pixels[offset] <= alphaThreshold) continue;
    count += 1;
    const x = index % width;
    const y = Math.floor(index / width);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  if (count === 0) {
    return { count: 0, minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }
  return { count, minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function trimmedAlphaBounds(pixels, width, height, alphaThreshold = 8) {
  const base = alphaBounds(pixels, width, height, alphaThreshold);
  if (!base.count) return base;
  const columnCounts = new Array(width).fill(0);
  const rowCounts = new Array(height).fill(0);
  for (let offset = 3, index = 0; offset < pixels.length; offset += 4, index += 1) {
    if (pixels[offset] <= alphaThreshold) continue;
    const x = index % width;
    const y = Math.floor(index / width);
    columnCounts[x] += 1;
    rowCounts[y] += 1;
  }
  const columnThreshold = Math.max(3, Math.floor(height * 0.006));
  const rowThreshold = Math.max(3, Math.floor(width * 0.006));
  let minX = base.minX;
  let maxX = base.maxX;
  let minY = base.minY;
  let maxY = base.maxY;
  while (minX < maxX && columnCounts[minX] < columnThreshold) minX += 1;
  while (maxX > minX && columnCounts[maxX] < columnThreshold) maxX -= 1;
  while (minY < maxY && rowCounts[minY] < rowThreshold) minY += 1;
  while (maxY > minY && rowCounts[maxY] < rowThreshold) maxY -= 1;
  return { count: base.count, minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
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

async function advance(app, model, frames = 10) {
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
    const textures = Array.isArray(model.textures) ? model.textures : [];
    const completePersonDecision =
      bounds.count > 0 &&
      nonblankRatio >= 0.018 &&
      bounds.width >= 90 &&
      bounds.height >= 180
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
      textureCount: textures.length,
      completePersonDecision,
      screenshotDataUrl: app.renderer.view.toDataURL("image/png"),
    };
  } catch (error) {
    window.__result = {
      ok: false,
      error: String(error && (error.stack || error.message || error)),
    };
  }
})();
</script>`;
}

async function startServer({ fsRoot }) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    if (url.pathname === "/test.html") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(pageHtml(url.searchParams.get("model")));
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
    if (!isPathInside(fsRoot, filePath)) {
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
      // Try the next known local browser path.
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
  if (!result.ok) {
    throw new Error("Chromium WebGL is unavailable.");
  }
  return result;
}

function dataUrlToBuffer(value) {
  return Buffer.from(String(value).replace(/^data:image\/png;base64,/, ""), "base64");
}

async function loadExistingExampleMetadata(outputDir) {
  try {
    const index = JSON.parse(await fs.readFile(path.resolve(outputDir, "index.json"), "utf8"));
    const entries = Object.values(index.examples || {}).flat();
    return new Map(entries.map((entry) => [entry.resourceKey, entry]));
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return new Map();
    }
    throw error;
  }
}

function reusableRenderInfo(existingMetadata, imagePath, imageHash) {
  if (!existingMetadata) {
    const error = new Error(`Existing image has no metadata in rating-examples/index.json: ${displayPath(imagePath)}`);
    error.code = "EXISTING_EXAMPLE_METADATA_INVALID";
    throw error;
  }
  if (existingMetadata.imageKind !== "live2d_render") {
    const error = new Error(`Existing image metadata is not a Live2D render: ${displayPath(imagePath)}`);
    error.code = "EXISTING_EXAMPLE_METADATA_INVALID";
    throw error;
  }
  if (existingMetadata.imageSha256 !== imageHash) {
    const error = new Error(`Existing image sha256 differs from rating-examples/index.json: ${displayPath(imagePath)}`);
    error.code = "EXISTING_EXAMPLE_METADATA_INVALID";
    throw error;
  }
  if (!existingMetadata.completePersonDecision || !existingMetadata.boundsWidth || !existingMetadata.boundsHeight) {
    const error = new Error(`Existing image metadata is incomplete; rerun with --force: ${displayPath(imagePath)}`);
    error.code = "EXISTING_EXAMPLE_METADATA_INVALID";
    throw error;
  }
  return {
    status: "reused",
    imagePath: displayPath(imagePath),
    imageSha256: imageHash,
    imageKind: "live2d_render",
    resolvedBuildDataUrl: existingMetadata.resolvedBuildDataUrl,
    textureCount: existingMetadata.textureCount,
    canvasWidth: existingMetadata.canvasWidth,
    canvasHeight: existingMetadata.canvasHeight,
    modelWidth: existingMetadata.modelWidth,
    modelHeight: existingMetadata.modelHeight,
    nonblankRatio: existingMetadata.nonblankRatio,
    boundsWidth: existingMetadata.boundsWidth,
    boundsHeight: existingMetadata.boundsHeight,
    completePersonDecision: existingMetadata.completePersonDecision,
  };
}

async function renderRow({ row, rating, page, baseUrl, outputDir, tempRoot, timeoutMs, force, existingExamples }) {
  const imagePath = path.resolve(outputDir, rating, `${sanitizeFileName(row.resource_key)}.png`);
  await fs.mkdir(path.dirname(imagePath), { recursive: true });

  if (!force) {
    try {
      const existing = await fs.readFile(imagePath);
      return reusableRenderInfo(existingExamples.get(row.resource_key), imagePath, sha256(existing));
    } catch (error) {
      if (error && error.code !== "ENOENT") {
        throw error;
      }
      // Render below when the image does not exist.
    }
  }

  const mirrored = await mirrorBestdoriModel(row, tempRoot);
  await page.goto(
    `${baseUrl}/test.html?model=${encodeURIComponent(`${baseUrl}${localModelUrl(mirrored.manifestPath)}`)}`,
    { waitUntil: "networkidle2", timeout: timeoutMs },
  );
  await page.waitForFunction("window.__result !== undefined", { timeout: timeoutMs });
  const result = await page.evaluate("window.__result");
  if (!result.ok) {
    return {
      status: "render_failed",
      renderError: result.error || "render failed",
    };
  }
  const screenshot = dataUrlToBuffer(result.screenshotDataUrl);
  await fs.writeFile(imagePath, screenshot);
  return {
    status: "rendered",
    imagePath: displayPath(imagePath),
    imageSha256: sha256(screenshot),
    imageKind: "live2d_render",
    resolvedBuildDataUrl: mirrored.resolvedBuildDataUrl,
    textureCount: mirrored.textureCount,
    canvasWidth: result.canvasWidth,
    canvasHeight: result.canvasHeight,
    modelWidth: result.modelWidth,
    modelHeight: result.modelHeight,
    nonblankRatio: Number(result.nonblankRatio.toFixed(6)),
    boundsWidth: result.bounds.width,
    boundsHeight: result.bounds.height,
    completePersonDecision: result.completePersonDecision,
  };
}

function rowToExample(row, rating, renderInfo) {
  const confidence = numeric(row.rating_confidence);
  const margin = numeric(row.rating_margin);
  return {
    resourceKey: row.resource_key,
    rating,
    modelKey: row.model_key,
    variant: row.variant,
    family: row.family,
    characterNameZh: row.character_name_zh,
    characterNameJa: row.character_name_ja,
    band: row.band,
    rowKind: row.row_kind,
    isCurrentPool: trueish(row.is_current_pool),
    contentPolicyDecision: row.content_policy_decision,
    ratingPredictedLabel: row.rating_predicted_label,
    ratingConfidence: Number(confidence.toFixed(6)),
    ratingMargin: Number(margin.toFixed(6)),
    llmReviewStatus: row.llm_review_status,
    llmReviewLabel: row.llm_review_label,
    llmReviewReason: row.llm_review_reason,
    taggerVisualEvidencePrimaryUrl: row.tagger_visual_evidence_primary_url,
    taggerVisualEvidencePrimarySha256: row.tagger_visual_evidence_primary_sha256,
    bestdoriBuildDataUrl: buildDataUrlForRow(row),
    ...renderInfo,
  };
}

function scoreText(example) {
  return `${example.ratingPredictedLabel || "n/a"} / conf ${example.ratingConfidence.toFixed(3)} / margin ${example.ratingMargin.toFixed(3)}`;
}

function reviewText(example) {
  if (example.rating === "unknown") {
    return `${example.llmReviewStatus || "n/a"}${example.llmReviewLabel ? ` -> ${example.llmReviewLabel}` : ""}`;
  }
  if (example.llmReviewStatus === "completed") {
    return `LLM -> ${example.llmReviewLabel || "n/a"}`;
  }
  return example.llmReviewStatus || "n/a";
}

function renderSummaryText(example) {
  if (example.imageKind === "tagger_texture_fallback") {
    return "texture fallback";
  }
  const decision = example.completePersonDecision || "n/a";
  const bounds = example.boundsWidth && example.boundsHeight ? `${example.boundsWidth}x${example.boundsHeight}` : "n/a";
  return `${decision}, bounds ${bounds}`;
}

function markdownForExamples({ payload, reportRelativeDir }) {
  const lines = [];
  lines.push("# BanG Dream 桌宠资源 rating 样例图");
  lines.push("");
  lines.push(`生成时间：\`${payload.generatedAt}\``);
  lines.push("");
  lines.push("本报告用于 PR #24 的人工查阅：每个 `final_content_rating` 尽量抽取 20 个典型资源，并把能够成功渲染的 Live2D 模型截图提交到仓库。候选会顺序补位，避免把渲染失败的资源硬塞进样例集。样例选择来自已经生成的 `audit.csv`，不会改变主审计表，也不会接入前端资源池。");
  lines.push("");
  lines.push("需要注意：`explicit` 当前没有任何行，因此没有可展示样例；`questionable` 全表只有 15 行，因此这里展示全部 15 行。`unknown` 只从有 Bestdori/tagger 视觉证据的 153 行里抽样，另有 28 行因为无法取得视觉证据仍保持 pending。重新导出需要本机可访问 `bestdori.com`。");
  lines.push("");
  lines.push("## 分布摘要");
  lines.push("");
  lines.push("| Rating | 全表行数 | 有视觉证据 | 缺视觉证据 | 本报告样例 | 渲染成功 | 贴图回退 |");
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const rating of RATINGS) {
    const examples = payload.examples[rating] || [];
    const rendered = examples.filter((item) => item.imageKind === "live2d_render").length;
    const fallback = examples.filter((item) => item.imageKind !== "live2d_render").length;
    const visual = payload.visualEvidenceCounts[rating] || { withVisualEvidence: 0, missingVisualEvidence: 0 };
    lines.push(
      `| \`${rating}\` | ${payload.ratingCounts[rating] || 0} | ${visual.withVisualEvidence} | ${visual.missingVisualEvidence} | ${examples.length} | ${rendered} | ${fallback} |`,
    );
  }
  lines.push("");
  lines.push("## 样例表");
  lines.push("");

  for (const rating of RATINGS) {
    const examples = payload.examples[rating] || [];
    lines.push(`### ${rating}`);
    lines.push("");
    if (examples.length === 0) {
      lines.push(rating === "explicit" ? "当前审计表没有 `explicit` 行。" : "当前没有可展示样例。");
      lines.push("");
      continue;
    }
    lines.push("| 图 | 资源 | 角色 / 变体 | 来源 | 分数 | 复核 | 策略 | 渲染检查 |");
    lines.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
    for (const example of examples) {
      const imagePath = path.relative(reportRelativeDir, path.resolve(example.imagePath)).split(path.sep).join("/");
      const image = `<img src="${markdownEscape(imagePath)}" alt="${markdownEscape(example.resourceKey)}" width="140">`;
      const resource = `\`${markdownEscape(example.resourceKey)}\``;
      const character = `${markdownEscape(example.characterNameZh || example.characterNameJa || "unknown")}<br><code>${markdownEscape(example.variant || example.modelKey)}</code>`;
      const source = markdownEscape(example.rowKind);
      lines.push(
        `| ${image} | ${resource} | ${character} | ${source} | ${markdownEscape(scoreText(example))} | ${markdownEscape(reviewText(example))} | ${markdownEscape(example.contentPolicyDecision)} | ${markdownEscape(renderSummaryText(example))} |`,
      );
    }
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

async function writeOutputs({ args, rows, selected, examplesByRating }) {
  const payload = {
    generatedAt: new Date().toISOString(),
    sourceAuditCsv: displayPath(args.auditCsv),
    selectionPolicy: {
      targetPerRating: args.limitPerRating,
      ratings: RATINGS,
      notes: [
        "general/sensitive/questionable prioritize high-confidence direct tagger rows with light character-code diversity.",
        "unknown prioritizes low-margin completed LLM-review rows with available visual evidence.",
        "Rows without Bestdori buildData or tagger visual evidence are excluded from image examples.",
        "Selection uses extra spillover rows so the final showcased set can still reach the target count when a few candidates fail to render.",
      ],
    },
    ratingCounts: ratingCounts(rows),
    visualEvidenceCounts: visualEvidenceCounts(rows),
    selectedCandidateCounts: Object.fromEntries(RATINGS.map((rating) => [rating, selected[rating]?.length || 0])),
    selectedCounts: Object.fromEntries(RATINGS.map((rating) => [rating, examplesByRating[rating]?.length || 0])),
    examples: examplesByRating,
  };

  await fs.mkdir(args.outputDir, { recursive: true });
  await fs.writeFile(path.join(args.outputDir, "index.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  const reportPath = path.resolve(args.reportPath);
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  const report = markdownForExamples({
    payload,
    reportRelativeDir: path.dirname(reportPath),
  });
  await fs.writeFile(reportPath, report, "utf8");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  args.auditCsv = path.resolve(args.auditCsv);
  args.outputDir = path.resolve(args.outputDir);
  args.reportPath = path.resolve(args.reportPath);

  const rows = csvParse(await fs.readFile(args.auditCsv, "utf8"));
  const { selected, availableCounts } = selectExamples(rows, args.limitPerRating);
  const existingExamples = await loadExistingExampleMetadata(args.outputDir);
  const chromePath = await findChromePath();
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "bangdream-rating-examples-"));
  const server = await startServer({ fsRoot: tempRoot });
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
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

  const examplesByRating = Object.fromEntries(RATINGS.map((rating) => [rating, []]));
  const failedKeysByRating = Object.fromEntries(RATINGS.map((rating) => [rating, new Set()]));
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(args.renderTimeout);
    page.setDefaultNavigationTimeout(args.renderTimeout);
    await assertWebglSupport(page, args.renderTimeout);

    let done = 0;
    for (const rating of RATINGS) {
      const targetCount = Math.min(args.limitPerRating, availableCounts[rating] || 0);
      const candidates = selected[rating] || [];
      for (const row of selected[rating] || []) {
        if ((examplesByRating[rating] || []).length >= targetCount) {
          break;
        }
        if (failedKeysByRating[rating].has(row.resource_key)) {
          continue;
        }
        done += 1;
        process.stderr.write(`${done}/${RATINGS.reduce((sum, item) => sum + Math.min(args.limitPerRating, availableCounts[item] || 0), 0)} ${rating} ${row.resource_key}\n`);
        let renderInfo;
        try {
          renderInfo = await renderRow({
            row,
            rating,
            page,
            baseUrl,
            outputDir: args.outputDir,
            tempRoot,
            timeoutMs: args.renderTimeout,
            force: args.force,
            existingExamples,
          });
        } catch (error) {
          if (error && error.code === "EXISTING_EXAMPLE_METADATA_INVALID") {
            throw error;
          }
          process.stderr.write(`  render failed, skipping: ${String(error && (error.message || error))}\n`);
          continue;
        }

        if (renderInfo.status === "render_failed") {
          process.stderr.write(`  render failed, skipping: ${renderInfo.renderError}\n`);
          failedKeysByRating[rating].add(row.resource_key);
          continue;
        }
        examplesByRating[rating].push(rowToExample(row, rating, renderInfo));
      }

      if ((examplesByRating[rating] || []).length < targetCount) {
        for (const row of candidates) {
          if ((examplesByRating[rating] || []).length >= targetCount) break;
          const alreadySelected = examplesByRating[rating].some((item) => item.resourceKey === row.resource_key);
          if (alreadySelected || failedKeysByRating[rating].has(row.resource_key)) continue;
          done += 1;
          process.stderr.write(`${done}/${RATINGS.reduce((sum, item) => sum + Math.min(args.limitPerRating, availableCounts[item] || 0), 0)} ${rating} ${row.resource_key}\n`);
          try {
            const renderInfo = await renderRow({
              row,
              rating,
              page,
              baseUrl,
              outputDir: args.outputDir,
              tempRoot,
              timeoutMs: args.renderTimeout,
              force: args.force,
              existingExamples,
            });
            if (renderInfo.status === "reused" && !renderInfo.completePersonDecision) {
              throw new Error(`Reused example is missing render metadata: ${row.resource_key}`);
            }
            if (renderInfo.status === "render_failed") {
              failedKeysByRating[rating].add(row.resource_key);
              continue;
            }
            examplesByRating[rating].push(rowToExample(row, rating, renderInfo));
          } catch (error) {
            if (error && error.code === "EXISTING_EXAMPLE_METADATA_INVALID") {
              throw error;
            }
            process.stderr.write(`  render failed, skipping: ${String(error && (error.message || error))}\n`);
            failedKeysByRating[rating].add(row.resource_key);
            continue;
          }
        }
      }

      if ((examplesByRating[rating] || []).length < targetCount) {
        process.stderr.write(`  warning: only collected ${examplesByRating[rating].length}/${targetCount} renderable examples for ${rating}\n`);
      }
    }
  } finally {
    await browser.close();
    server.close();
    if (!args.keepTemp) {
      await fs.rm(tempRoot, { recursive: true, force: true });
    } else {
      process.stderr.write(`Kept temp root: ${tempRoot}\n`);
    }
  }

  await writeOutputs({ args, rows, selected, examplesByRating });
}

await main();
