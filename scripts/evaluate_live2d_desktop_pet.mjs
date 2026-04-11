import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { promisify } from "node:util";

import puppeteer from "puppeteer-core";

const CHROME_PATH = process.env.CHROME_PATH || "/usr/bin/google-chrome";
const DEFAULT_TIMEOUT = 120000;
const DEFAULT_SUMMARY_PATH = "plans/live2d-content-collection-summary.md";
const DEFAULT_OUTPUT_PATH = "plans/live2d-desktop-pet-eval.json";
const ASSESSMENT_HEADER = "右下角桌宠适配实测";
const execFileAsync = promisify(execFile);

function usage() {
  console.error(
    [
      "Usage:",
      "  node scripts/evaluate_live2d_desktop_pet.mjs [options]",
      "",
      "Options:",
      `  --summary <path>     Summary markdown path. Default: ${DEFAULT_SUMMARY_PATH}`,
      `  --output <path>      JSON output path. Default: ${DEFAULT_OUTPUT_PATH}`,
      `  --timeout <ms>       Per-model timeout. Default: ${DEFAULT_TIMEOUT}`,
      "  --limit <n>          Only evaluate the first n rows from the success table",
      "  --match <text>       Only evaluate rows whose IP / model / manifest contains the text",
      "  --force              Ignore existing JSON results and rerun matched rows",
      "  --review-dir <path>  Save browser review screenshots for matched rows",
      "  --apply              Write each finished assessment back into the summary table immediately",
      "  --keep-temp          Keep the per-run temporary root instead of cleaning it",
      "  --help, -h           Show this help message",
      "",
      "Examples:",
      "  node scripts/evaluate_live2d_desktop_pet.mjs --match Haru --limit 2",
      "  node scripts/evaluate_live2d_desktop_pet.mjs --apply",
    ].join("\n"),
  );
}

function parseArgs(argv) {
  const args = {
    summaryPath: DEFAULT_SUMMARY_PATH,
    outputPath: DEFAULT_OUTPUT_PATH,
    timeout: DEFAULT_TIMEOUT,
    limit: null,
    match: null,
    force: false,
    apply: false,
    keepTemp: false,
    reviewDir: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];

    if (item === "--summary") {
      args.summaryPath = argv[index + 1];
      index += 1;
      continue;
    }

    if (item === "--output") {
      args.outputPath = argv[index + 1];
      index += 1;
      continue;
    }

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

    if (item === "--force") {
      args.force = true;
      continue;
    }

    if (item === "--review-dir") {
      args.reviewDir = argv[index + 1];
      index += 1;
      continue;
    }

    if (item === "--apply") {
      args.apply = true;
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

  if (!Number.isFinite(args.timeout) || args.timeout <= 0) {
    throw new Error(`Invalid --timeout value: ${args.timeout}`);
  }

  if (args.limit !== null && (!Number.isFinite(args.limit) || args.limit <= 0)) {
    throw new Error(`Invalid --limit value: ${args.limit}`);
  }

  return args;
}

function stripCode(cell) {
  const trimmed = cell.trim();
  if (trimmed.startsWith("`") && trimmed.endsWith("`")) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function splitTableRow(line) {
  return line
    .trim()
    .slice(1, -1)
    .split("|")
    .map((item) => item.trim());
}

function parseSuccessRows(summaryText) {
  const lines = summaryText.split("\n");
  const sectionStart = lines.findIndex((line) => line.trim() === "## 1. 已收集成功总表");
  const sectionEnd = lines.findIndex(
    (line, index) => index > sectionStart && line.trim().startsWith("## 2."),
  );

  if (sectionStart === -1 || sectionEnd === -1) {
    throw new Error("Could not locate the success table section in the summary.");
  }

  const headerIndex = lines.findIndex(
    (line, index) => index > sectionStart && line.startsWith("| IP | 模型 |"),
  );
  if (headerIndex === -1) {
    throw new Error("Could not locate the success table header.");
  }

  const rows = [];
  for (let index = headerIndex + 2; index < sectionEnd; index += 1) {
    const line = lines[index];
    if (!line.startsWith("| ")) {
      continue;
    }

    const cells = splitTableRow(line);
    if (cells.length < 9) {
      continue;
    }

    rows.push({
      lineIndex: index,
      rawLine: line,
      ip: cells[0],
      model: cells[1],
      resourceType: cells[2],
      sizeText: stripCode(cells[3]),
      runtime: cells[4],
      manifestUrl: stripCode(cells[5]),
      localStatus: cells[6],
      remoteStatus: cells[7],
      remark: cells[8],
      existingAssessment: cells[9] ? cells[9] : null,
      cells,
    });
  }

  return {
    lines,
    headerIndex,
    sectionStart,
    sectionEnd,
    rows,
  };
}

async function loadExistingResults(outputPath) {
  try {
    const raw = await fs.readFile(outputPath, "utf8");
    const parsed = JSON.parse(raw);
    const map = new Map();
    for (const item of parsed.results || []) {
      map.set(item.manifestUrl, item);
    }
    return map;
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return new Map();
    }
    throw error;
  }
}

async function atomicWriteFile(filePath, content) {
  const dir = path.dirname(filePath);
  const tempPath = path.join(dir, `.${path.basename(filePath)}.${process.pid}.tmp`);
  await fs.writeFile(tempPath, content, "utf8");
  await fs.rename(tempPath, filePath);
}

function candidateUrlsForFetch(url) {
  const candidates = [url];
  const match = url.match(/^https:\/\/cdn\.jsdelivr\.net\/gh\/([^/]+)\/([^@/]+)@([^/]+)\/(.+)$/);
  if (match) {
    const [, owner, repo, ref, filePath] = match;
    candidates.push(`https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${filePath}`);
  }
  return [...new Set(candidates)];
}

async function fetchWithRetries(url, { responseType = "arrayBuffer", timeout = 30000, retries = 2 } = {}) {
  let lastError = null;

  for (const candidateUrl of candidateUrlsForFetch(url)) {
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const response = await fetch(candidateUrl, {
          signal: AbortSignal.timeout(timeout),
          headers: {
            "user-agent": "HansBug.github.io Live2D desktop-pet evaluator",
          },
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }

        if (responseType === "text") {
          return await response.text();
        }

        return Buffer.from(await response.arrayBuffer());
      } catch (error) {
        lastError = error;
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
        }
      }
    }
  }

  for (const candidateUrl of candidateUrlsForFetch(url)) {
    try {
      const curlArgs = [
        "-L",
        "--fail",
        "--silent",
        "--show-error",
        "--retry",
        String(Math.max(retries + 1, 4)),
        "--connect-timeout",
        String(Math.max(10, Math.min(Math.ceil(timeout / 3000), 30))),
        "--max-time",
        String(Math.max(20, Math.ceil(timeout / 1000))),
        candidateUrl,
      ];
      const { stdout } = await execFileAsync("curl", curlArgs, {
        encoding: "buffer",
        maxBuffer: 256 * 1024 * 1024,
      });
      if (responseType === "text") {
        return stdout.toString("utf8");
      }
      return stdout;
    } catch (curlError) {
      lastError = curlError;
    }
  }

  throw new Error(`Fetch failed for ${url}: ${String(lastError && (lastError.message || lastError))}`);
}

function resolveRelative(manifestUrl, relativePath) {
  return new URL(relativePath, manifestUrl).toString();
}

function collectRequiredFiles(runtime, manifestJson) {
  const files = new Map();

  function addFile(filePath, optional = false) {
    if (typeof filePath !== "string" || !filePath.trim()) {
      return;
    }

    const normalized = filePath.trim();
    if (!files.has(normalized)) {
      files.set(normalized, { path: normalized, optional });
      return;
    }

    if (!optional) {
      files.get(normalized).optional = false;
    }
  }

  if (runtime === "Cubism 4") {
    const refs = manifestJson.FileReferences || {};
    addFile(refs.Moc, false);
    addFile(refs.Physics, true);
    addFile(refs.Pose, true);
    addFile(refs.UserData, true);
    addFile(refs.DisplayInfo, true);

    for (const texture of refs.Textures || []) {
      addFile(texture, false);
    }

    for (const expression of refs.Expressions || []) {
      addFile(expression.File, true);
    }

    for (const motions of Object.values(refs.Motions || {})) {
      if (!Array.isArray(motions) || motions.length === 0) {
        continue;
      }
      addFile(motions[0].File, true);
      addFile(motions[0].Sound, true);
    }
  } else {
    addFile(manifestJson.model, false);
    addFile(manifestJson.physics, true);
    addFile(manifestJson.pose, true);

    for (const texture of manifestJson.textures || []) {
      addFile(texture, false);
    }

    for (const expression of manifestJson.expressions || []) {
      addFile(expression.file, true);
    }

    for (const motions of Object.values(manifestJson.motions || {})) {
      if (!Array.isArray(motions) || motions.length === 0) {
        continue;
      }
      addFile(motions[0].file, true);
      addFile(motions[0].sound, true);
    }
  }

  return Array.from(files.values()).sort((left, right) => left.path.localeCompare(right.path));
}

async function mirrorRemoteManifest(row, rootDir) {
  const manifestUrl = row.manifestUrl;
  const remoteManifestName = path.basename(new URL(manifestUrl).pathname) || "model.json";
  const manifestName =
    row.runtime === "Cubism 2.1" &&
    remoteManifestName !== "model.json" &&
    !remoteManifestName.endsWith(".model.json")
      ? "model.json"
      : remoteManifestName;
  const modelRoot = path.join(rootDir, sanitizePath(`${row.ip}-${row.model}`));
  const manifestPath = path.join(modelRoot, manifestName);

  await fs.mkdir(modelRoot, { recursive: true });

  const manifestText = await fetchWithRetries(manifestUrl, { responseType: "text", timeout: 45000, retries: 3 });
  const manifestJson = JSON.parse(manifestText);
  await fs.writeFile(manifestPath, manifestText, "utf8");

  const dependencies = collectRequiredFiles(row.runtime, manifestJson);
  for (const dependency of dependencies) {
    const assetUrl = resolveRelative(manifestUrl, dependency.path);
    const localPath = path.join(modelRoot, dependency.path);
    await fs.mkdir(path.dirname(localPath), { recursive: true });

    try {
      const data = await fetchWithRetries(assetUrl, {
        responseType: "arrayBuffer",
        timeout: 45000,
        retries: 3,
      });
      await fs.writeFile(localPath, data);
    } catch (error) {
      if (!dependency.optional) {
        throw error;
      }
    }
  }

  return {
    manifestPath,
    dependencyCount: dependencies.length,
  };
}

function sanitizePath(value) {
  return value.replace(/[^\w.-]+/g, "_").slice(0, 120);
}

function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
  if (filePath.endsWith(".moc") || filePath.endsWith(".moc3")) return "application/octet-stream";
  if (filePath.endsWith(".exp.json") || filePath.endsWith(".exp3.json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".wav")) return "audio/wav";
  if (filePath.endsWith(".mp3")) return "audio/mpeg";
  return "application/octet-stream";
}

function localModelUrl(filePath) {
  return `/__fs__${encodeURI(path.resolve(filePath))}`;
}

function pageHtml(runtime, modelUrl, resourceType, titleText) {
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
<style>
  :root {
    color-scheme: light;
    font-family: "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
  }

  body {
    margin: 0;
    background: #f3f2ec;
    color: #2e342f;
  }

  #view {
    position: fixed;
    left: -9999px;
    top: -9999px;
  }

  #report {
    width: 1320px;
    padding: 22px;
    box-sizing: border-box;
    background:
      linear-gradient(135deg, rgba(190, 194, 182, 0.25), rgba(243, 242, 236, 0.92)),
      linear-gradient(180deg, #f7f6f1, #ece9df);
  }

  .report__header {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: flex-start;
    margin-bottom: 16px;
  }

  .report__title {
    font-size: 28px;
    font-weight: 700;
    letter-spacing: 0.02em;
  }

  .report__meta {
    margin-top: 6px;
    color: #5a635a;
    font-size: 16px;
  }

  .report__stats {
    min-width: 340px;
    padding: 12px 14px;
    border: 1px solid rgba(83, 92, 83, 0.18);
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.62);
    font-size: 15px;
    line-height: 1.55;
    color: #3b443b;
    white-space: pre-wrap;
  }

  .report__panels {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 14px;
  }

  .panel {
    border: 1px solid rgba(83, 92, 83, 0.2);
    border-radius: 16px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.72);
    box-shadow: 0 10px 22px rgba(83, 92, 83, 0.08);
  }

  .panel__label {
    padding: 10px 14px;
    font-weight: 700;
    font-size: 16px;
    color: #445046;
    border-bottom: 1px solid rgba(83, 92, 83, 0.12);
    background: rgba(242, 240, 232, 0.88);
  }

  .panel img {
    width: 100%;
    display: block;
    background: #f7f5ef;
  }
</style>
<div id="report">
  <div class="report__header">
    <div>
      <div class="report__title">${titleText}</div>
      <div class="report__meta">${resourceType}</div>
    </div>
    <div id="stats" class="report__stats">加载中…</div>
  </div>
  <div class="report__panels">
    <section class="panel">
      <div class="panel__label">静态摆位</div>
      <img id="shot-neutral" alt="neutral" />
    </section>
    <section class="panel">
      <div class="panel__label">鼠标跟随</div>
      <img id="shot-focus" alt="focus" />
    </section>
    <section class="panel">
      <div class="panel__label">触发动效</div>
      <img id="shot-motion" alt="motion" />
    </section>
  </div>
</div>
<canvas id="view" width="440" height="520"></canvas>
<script src="https://pixijs.download/v6.5.10/pixi-legacy.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/pixi-live2d-display/dist/index.min.js"></script>
${runtime === "Cubism 2.1" ? cubism2Scripts : cubism4Scripts}
<script>
window.__result = undefined;
window.__reportReady = false;
const RESOURCE_TYPE = ${JSON.stringify(resourceType)};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeHitAreas(settings) {
  const raw = settings.hitAreas || settings.HitAreas || [];
  return raw.map((item) => item.Name || item.name || item.Id || item.id || "unknown");
}

function normalizeExpressions(settings) {
  return settings.expressions || settings.Expressions || [];
}

function normalizeMotionEntries(settings) {
  const motions = settings.motions || settings.Motions || {};
  return Object.entries(motions).map(([name, items]) => ({
    name,
    count: Array.isArray(items) ? items.length : 0,
  }));
}

function chooseMotionGroup(entries) {
  const groups = entries.map((item) => item.name);
  const patterns = [
    /tap[_-]?body|touch[_-]?body|body/i,
    /tap[_-]?head|touch[_-]?head|flick[_-]?head|head/i,
    /tap|touch|flick|pinch/i,
  ];

  for (const pattern of patterns) {
    const hit = groups.find((name) => pattern.test(name));
    if (hit) {
      return hit;
    }
  }

  const nonIdle = groups.find((name) => !/idle/i.test(name));
  return nonIdle || groups[0] || null;
}

function getExtractor(app) {
  return app.renderer.plugins?.extract || app.renderer.extract;
}

function buildBackdrop() {
  const graphics = new PIXI.Graphics();
  graphics.beginFill(0xf6f4ed, 1);
  graphics.drawRoundedRect(0, 0, 440, 520, 24);
  graphics.endFill();

  graphics.lineStyle(2, 0xb8b9af, 0.9);
  graphics.drawRoundedRect(52, 34, 344, 430, 20);

  graphics.lineStyle(1.5, 0xc8c6b8, 0.6);
  graphics.moveTo(52, 410);
  graphics.lineTo(396, 410);
  graphics.moveTo(312, 34);
  graphics.lineTo(312, 464);

  return graphics;
}

function layoutDeskpet(model, app) {
  const bounds = model.getLocalBounds();
  const width = Math.max(bounds.width, 1);
  const height = Math.max(bounds.height, 1);
  const halfLike = /半身|小挂件|桌宠|精灵|吉祥物/.test(RESOURCE_TYPE);
  const fullBody = /全身/.test(RESOURCE_TYPE);
  const wide = /横构图|超宽/.test(RESOURCE_TYPE);

  const slot = { x: 52, y: 34, width: 344, height: 430 };
  const targetHeight = slot.height * (fullBody ? 1.42 : halfLike ? 0.96 : wide ? 1.05 : 1.14);
  const scale = targetHeight / height;
  const overflow = slot.height * (fullBody ? 0.18 : halfLike ? 0.04 : 0.10);

  model.pivot.set(bounds.x + width / 2, bounds.y + height);
  model.position.set(slot.x + slot.width * (wide ? 0.48 : 0.66), slot.y + slot.height + overflow);
  model.scale.set(scale);
}

function alphaBounds(pixels, width, height, alphaThreshold = 8) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let count = 0;

  for (let offset = 3, index = 0; offset < pixels.length; offset += 4, index += 1) {
    if (pixels[offset] <= alphaThreshold) {
      continue;
    }

    count += 1;
    const x = index % width;
    const y = Math.floor(index / width);

    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  if (count === 0) {
    return { count: 0, width: 0, height: 0, minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  return {
    count,
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function capture(app) {
  app.renderer.render(app.stage);
  const extractor = getExtractor(app);
  if (!extractor || typeof extractor.pixels !== "function") {
    throw new Error("Pixi extract plugin is unavailable.");
  }

  const pixels = extractor.pixels(app.stage);
  const width = app.renderer.width;
  const height = app.renderer.height;
  const bounds = alphaBounds(pixels, width, height);

  return { pixels, width, height, bounds };
}

function captureShot(app) {
  app.renderer.render(app.stage);
  return app.renderer.view.toDataURL("image/png");
}

function diffMetrics(before, after, referenceBounds) {
  const width = before.width;
  const height = before.height;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let changed = 0;

  for (let offset = 0, index = 0; offset < before.pixels.length; offset += 4, index += 1) {
    const beforeAlpha = before.pixels[offset + 3];
    const afterAlpha = after.pixels[offset + 3];
    if (beforeAlpha <= 4 && afterAlpha <= 4) {
      continue;
    }

    const delta =
      Math.abs(before.pixels[offset] - after.pixels[offset]) +
      Math.abs(before.pixels[offset + 1] - after.pixels[offset + 1]) +
      Math.abs(before.pixels[offset + 2] - after.pixels[offset + 2]) +
      Math.abs(beforeAlpha - afterAlpha);

    if (delta <= 44) {
      continue;
    }

    changed += 1;
    const x = index % width;
    const y = Math.floor(index / width);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  const diffWidth = changed === 0 ? 0 : maxX - minX + 1;
  const diffHeight = changed === 0 ? 0 : maxY - minY + 1;
  const referenceCount = Math.max(referenceBounds.count, 1);

  return {
    changedPixels: changed,
    changedRatio: changed / referenceCount,
    coverageWidth: referenceBounds.width > 0 ? diffWidth / referenceBounds.width : 0,
    coverageHeight: referenceBounds.height > 0 ? diffHeight / referenceBounds.height : 0,
  };
}

async function advance(app, model, frames = 1) {
  for (let index = 0; index < frames; index += 1) {
    if (typeof model.update === "function") {
      model.update(16.67);
    }
    app.renderer.render(app.stage);
    await sleep(0);
  }
}

async function runFocusProbe(app, model, baseline) {
  if (typeof model.focus !== "function") {
    return { supported: false };
  }

  try {
    model.focus(0, 0);
    await advance(app, model, 8);
    const neutral = capture(app);

    model.focus(0.82, -0.42);
    await advance(app, model, 18);
    const right = capture(app);

    model.focus(-0.82, 0.42);
    await advance(app, model, 18);
    const left = capture(app);

    const diffA = diffMetrics(neutral, right, baseline.bounds);
    const diffB = diffMetrics(right, left, baseline.bounds);

    return {
      supported: true,
      changedRatio: Math.max(diffA.changedRatio, diffB.changedRatio),
      coverageWidth: Math.max(diffA.coverageWidth, diffB.coverageWidth),
      coverageHeight: Math.max(diffA.coverageHeight, diffB.coverageHeight),
    };
  } catch (error) {
    return {
      supported: true,
      error: String(error && (error.stack || error.message || error)),
    };
  }
}

async function runExpressionProbe(app, model, baseline, expressions) {
  if (typeof model.expression !== "function" || expressions.length === 0) {
    return { supported: false };
  }

  const candidates = [];
  const first = expressions[0];
  candidates.push(0);
  if (first?.Name) candidates.push(first.Name);
  if (first?.name) candidates.push(first.name);

  let chosen = null;
  let lastError = null;
  for (const candidate of candidates) {
    try {
      await Promise.resolve(model.expression(candidate));
      chosen = candidate;
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (chosen === null) {
    return {
      supported: true,
      error: String(lastError && (lastError.stack || lastError.message || lastError)),
    };
  }

  const before = capture(app);
  await advance(app, model, 10);
  const after = capture(app);
  const diff = diffMetrics(before, after, baseline.bounds);

  return {
    supported: true,
    chosen,
    changedRatio: diff.changedRatio,
    coverageWidth: diff.coverageWidth,
    coverageHeight: diff.coverageHeight,
  };
}

async function runMotionProbe(app, model, baseline, motionEntries) {
  if (typeof model.motion !== "function" || motionEntries.length === 0) {
    return { supported: false };
  }

  const group = chooseMotionGroup(motionEntries);
  if (!group) {
    return { supported: false };
  }

  const priority = PIXI.live2d?.MotionPriority?.FORCE ?? 3;
  const before = capture(app);

  try {
    await Promise.resolve(model.motion(group, 0, priority));
    await advance(app, model, /idle/i.test(group) ? 36 : 48);
    const after = capture(app);
    const diff = diffMetrics(before, after, baseline.bounds);

    return {
      supported: true,
      group,
      touchLike: /tap|touch|flick|pinch|body|head/i.test(group),
      changedRatio: diff.changedRatio,
      coverageWidth: diff.coverageWidth,
      coverageHeight: diff.coverageHeight,
    };
  } catch (error) {
    return {
      supported: true,
      group,
      error: String(error && (error.stack || error.message || error)),
    };
  }
}

(async () => {
  try {
    const app = new PIXI.Application({
      view: document.getElementById("view"),
      width: 440,
      height: 520,
      backgroundAlpha: 0,
      antialias: true,
      preserveDrawingBuffer: true,
      autoStart: false,
    });
    const backdrop = buildBackdrop();
    app.stage.addChild(backdrop);

    const options = { autoUpdate: false };
    if (PIXI.live2d?.MotionPreloadStrategy) {
      options.motionPreload = PIXI.live2d.MotionPreloadStrategy.NONE;
    }

    if (!PIXI.live2d || !PIXI.live2d.Live2DModel) {
      throw new Error("Live2D runtime missing.");
    }

    const model = await PIXI.live2d.Live2DModel.from(${JSON.stringify(modelUrl)}, options);
    app.stage.addChild(model);
    layoutDeskpet(model, app);
    await advance(app, model, 10);

    const baseline = capture(app);
    const settings = model.internalModel?.settings || {};
    const hitAreas = normalizeHitAreas(settings);
    const expressions = normalizeExpressions(settings);
    const motionEntries = normalizeMotionEntries(settings);
    const neutralShot = captureShot(app);
    const focusProbe = await runFocusProbe(app, model, baseline);
    const focusShot = captureShot(app);
    model.focus?.(0, 0);
    await advance(app, model, 8);
    const expressionProbe = await runExpressionProbe(app, model, baseline, expressions);
    await advance(app, model, 8);
    const motionProbe = await runMotionProbe(app, model, baseline, motionEntries);
    const motionShot = captureShot(app);

    const textures = Array.isArray(model.textures)
      ? model.textures.map((texture) => ({
          width: texture.baseTexture.realWidth || texture.baseTexture.width || 0,
          height: texture.baseTexture.realHeight || texture.baseTexture.height || 0,
        }))
      : [];
    const texturePixels = textures.reduce((sum, texture) => sum + texture.width * texture.height, 0);
    const targetDeskpetWidth =
      baseline.bounds.height > 0
        ? Math.round((baseline.bounds.width / baseline.bounds.height) * 340)
        : null;

    document.getElementById("shot-neutral").src = neutralShot;
    document.getElementById("shot-focus").src = focusShot;
    document.getElementById("shot-motion").src = motionShot;
    document.getElementById("stats").textContent =
      "命中区 " + hitAreas.length +
      " 个\\n表情 " + expressions.length +
      " 个\\n动作组 " + motionEntries.length +
      " 组\\n触发动作 " + (motionProbe.group || "无") +
      "\\n焦点反应 " + (focusProbe.supported ? (focusProbe.error ? "失败" : "已测") : "无") +
      "\\n建议位宽 " + (targetDeskpetWidth ?? "未知") + " px";
    window.__reportReady = true;

    window.__result = {
      ok: true,
      width: model.width,
      height: model.height,
      visibleBounds: baseline.bounds,
      targetDeskpetWidth,
      textureCount: textures.length,
      texturePixels,
      textures,
      hitAreas,
      expressionsCount: expressions.length,
      motionGroups: motionEntries,
      touchLikeMotionGroups: motionEntries
        .map((item) => item.name)
        .filter((name) => /tap|touch|flick|pinch|body|head/i.test(name)),
      focusProbe,
      expressionProbe,
      motionProbe,
    };
  } catch (error) {
    window.__result = {
      ok: false,
      stage: "probe",
      error: String(error && (error.stack || error.message || error)),
    };
  }
})();
</script>`;
}

async function startServer() {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");

    if (url.pathname === "/test.html") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(
        pageHtml(
          url.searchParams.get("runtime"),
          url.searchParams.get("model"),
          url.searchParams.get("resourceType") || "",
          url.searchParams.get("title") || "Live2D Review",
        ),
      );
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

function shortError(errorText) {
  if (!errorText) {
    return "未知错误";
  }
  return String(errorText).split("\n")[0].replace(/\s+/g, " ").slice(0, 120);
}

function buildAssessment(row, item) {
  if (item.status !== "ok" || !item.result?.ok) {
    return `本轮复测失败：${shortError(item.result?.error || item.error)}`;
  }

  const result = item.result;
  const motionGroupCount = result.motionGroups.length;
  const hitAreaCount = result.hitAreas.length;
  const expressionCount = result.expressionsCount;
  const touchLikeCount = result.touchLikeMotionGroups.length;
  const focusStrong =
    result.focusProbe?.supported &&
    !result.focusProbe.error &&
    result.focusProbe.changedRatio >= 0.018;
  const focusBody =
    focusStrong &&
    result.focusProbe.coverageHeight >= 0.45;
  const motionStrong =
    result.motionProbe?.supported &&
    !result.motionProbe.error &&
    result.motionProbe.changedRatio >= 0.025;
  const motionBody =
    motionStrong &&
    result.motionProbe.coverageHeight >= 0.55;
  const headOnly =
    (focusStrong || motionStrong) &&
    !focusBody &&
    !motionBody;
  const wide =
    /横构图|超宽/.test(row.resourceType) ||
    (Number.isFinite(result.targetDeskpetWidth) && result.targetDeskpetWidth >= 410);
  const halfLike = /半身|小挂件|桌宠|精灵|吉祥物/.test(row.resourceType);
  const fullBody = /全身/.test(row.resourceType);
  const heavy =
    result.texturePixels >= 45_000_000;
  const dense =
    result.texturePixels >= 28_000_000;

  let grade = "可用";
  if (motionBody && hitAreaCount >= 2 && motionGroupCount >= 3 && !wide && !heavy) {
    grade = "强适合";
  } else if ((motionBody || (focusBody && motionStrong)) && !wide) {
    grade = heavy ? "适合但偏重" : fullBody ? "适合，建议裁腰" : "适合";
  } else if (headOnly || wide) {
    grade = "不建议";
  } else if (!motionStrong && !focusStrong && touchLikeCount === 0) {
    grade = "不建议";
  } else if (heavy) {
    grade = "可用但偏重";
  }

  const interactionParts = [];
  if (motionStrong) {
    const coverage = motionBody ? "变化覆盖到半身/全身" : "变化主要集中在头肩";
    interactionParts.push(
      `动作组 ${motionGroupCount} 组，实测 \`${result.motionProbe.group}\` 可触发，${coverage}`,
    );
  } else if (focusStrong) {
    const coverage = focusBody ? "视线和躯干跟随都比较明显" : "主要是视线/头部轻动";
    interactionParts.push(`动作反馈偏轻，${coverage}`);
  } else {
    interactionParts.push("实测动作反馈偏弱，更像轻微动态立绘");
  }

  interactionParts.push(`命中区 ${hitAreaCount} 个，表情 ${expressionCount} 个`);

  if (Number.isFinite(result.targetDeskpetWidth)) {
    interactionParts.push(`按 340px 高度摆右下角约 ${result.targetDeskpetWidth}x340`);
  }

  if (wide) {
    interactionParts.push("横向占位偏大");
  } else if (fullBody && grade !== "不建议") {
    interactionParts.push("更适合运行时裁到腰部以上");
  } else if (halfLike) {
    interactionParts.push("半身/小挂件构图天然更贴桌宠位");
  }

  if (heavy) {
    interactionParts.push("纹理开销偏高");
  } else if (dense) {
    interactionParts.push("细节够用但更适合桌面端");
  }

  return `${grade}：${interactionParts.join("；")}`;
}

async function writeOutput(outputPath, rows, resultsMap) {
  const ordered = rows
    .map((row) => resultsMap.get(row.manifestUrl))
    .filter(Boolean);

  const stats = {
    total: ordered.length,
    ok: ordered.filter((item) => item.status === "ok" && item.result?.ok).length,
    failed: ordered.filter((item) => item.status !== "ok" || !item.result?.ok).length,
  };

  const payload = {
    generatedAt: new Date().toISOString(),
    stats,
    results: ordered,
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await atomicWriteFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
}

function ensureAssessmentColumnSkeleton(summaryText) {
  const parsed = parseSuccessRows(summaryText);
  const lines = summaryText.split("\n");
  const headerCells = splitTableRow(lines[parsed.headerIndex]);
  let changed = false;

  if (headerCells[headerCells.length - 1] !== ASSESSMENT_HEADER) {
    headerCells.push(ASSESSMENT_HEADER);
    lines[parsed.headerIndex] = `| ${headerCells.join(" | ")} |`;
    changed = true;
  }

  const separatorCells = splitTableRow(lines[parsed.headerIndex + 1]);
  while (separatorCells.length < headerCells.length) {
    separatorCells.push("---");
    changed = true;
  }
  lines[parsed.headerIndex + 1] = `| ${separatorCells.join(" | ")} |`;

  for (const row of parsed.rows) {
    const cells = splitTableRow(lines[row.lineIndex]);
    while (cells.length < headerCells.length) {
      cells.push("");
      changed = true;
    }
    lines[row.lineIndex] = `| ${cells.join(" | ")} |`;
  }

  return {
    changed,
    text: lines.join("\n"),
  };
}

async function updateSummaryAssessment(summaryPath, row, assessment) {
  const currentText = await fs.readFile(summaryPath, "utf8");
  const current = parseSuccessRows(currentText);
  const lines = currentText.split("\n");
  const target = current.rows.find((item) => item.manifestUrl === row.manifestUrl);

  if (!target) {
    throw new Error(`Could not find summary row for ${row.manifestUrl}`);
  }

  const headerCells = splitTableRow(lines[current.headerIndex]);
  if (headerCells[headerCells.length - 1] !== ASSESSMENT_HEADER) {
    throw new Error("Assessment column is missing from the current summary file.");
  }

  const cells = splitTableRow(lines[target.lineIndex]);
  while (cells.length < headerCells.length) {
    cells.push("");
  }
  cells[headerCells.length - 1] = assessment;
  lines[target.lineIndex] = `| ${cells.join(" | ")} |`;
  await atomicWriteFile(summaryPath, `${lines.join("\n")}\n`);
}

function countByGrade(results) {
  const counts = {};
  for (const item of results) {
    const assessment = item.assessment || "";
    const grade = assessment.split("：")[0] || "未分级";
    counts[grade] = (counts[grade] || 0) + 1;
  }
  return counts;
}

function hasStableAssessment(assessment) {
  return Boolean(assessment) && !String(assessment).startsWith("本轮复测失败");
}

async function evaluateRow({ row, page, baseUrl, runTempRoot, timeout, reviewDir }) {
  const perModelRoot = path.join(runTempRoot, sanitizePath(`${row.ip}-${row.model}`));
  const startedAt = performance.now();

  try {
    const mirrored = await mirrorRemoteManifest(row, perModelRoot);
    const localUrl = `${baseUrl}${localModelUrl(mirrored.manifestPath)}`;

    await page.goto(
      `${baseUrl}/test.html?runtime=${encodeURIComponent(row.runtime)}&model=${encodeURIComponent(localUrl)}&resourceType=${encodeURIComponent(row.resourceType)}&title=${encodeURIComponent(`${row.ip} / ${row.model}`)}`,
      { waitUntil: "networkidle2", timeout },
    );
    await page.waitForFunction("window.__result !== undefined", { timeout });
    const result = await page.evaluate("window.__result");

    let reviewImagePath = null;
    if (reviewDir && result.ok) {
      await page.waitForFunction("window.__reportReady === true", { timeout });
      const reportHandle = await page.$("#report");
      if (reportHandle) {
        await fs.mkdir(reviewDir, { recursive: true });
        reviewImagePath = path.join(reviewDir, `${sanitizePath(`${row.ip}-${row.model}`)}.png`);
        await reportHandle.screenshot({ path: reviewImagePath });
      }
    }

    return {
      manifestUrl: row.manifestUrl,
      ip: row.ip,
      model: row.model,
      runtime: row.runtime,
      resourceType: row.resourceType,
      status: result.ok ? "ok" : "probe_failed",
      durationMs: Math.round(performance.now() - startedAt),
      dependencyCount: mirrored.dependencyCount,
      reviewImagePath,
      result,
    };
  } catch (error) {
    return {
      manifestUrl: row.manifestUrl,
      ip: row.ip,
      model: row.model,
      runtime: row.runtime,
      resourceType: row.resourceType,
      status: "download_or_driver_failed",
      durationMs: Math.round(performance.now() - startedAt),
      error: String(error && (error.stack || error.message || error)),
    };
  } finally {
    await fs.rm(perModelRoot, { recursive: true, force: true });
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const summaryPath = path.resolve(args.summaryPath);
  const outputPath = path.resolve(args.outputPath);
  const reviewDir = args.reviewDir ? path.resolve(args.reviewDir) : null;
  let summaryText = await fs.readFile(summaryPath, "utf8");
  if (args.apply) {
    const prepared = ensureAssessmentColumnSkeleton(summaryText);
    if (prepared.changed) {
      await atomicWriteFile(summaryPath, `${prepared.text}\n`);
      summaryText = prepared.text.endsWith("\n") ? prepared.text : `${prepared.text}\n`;
    }
  }

  const parsed = parseSuccessRows(summaryText);
  const existingResults = await loadExistingResults(outputPath);
  const runTempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "live2d-deskpet-eval-"));

  const matchedRows = parsed.rows.filter((row) => {
    if (!args.match) {
      return true;
    }

    const haystack = `${row.ip} ${row.model} ${row.resourceType} ${row.manifestUrl}`.toLowerCase();
    return haystack.includes(args.match.toLowerCase());
  });
  const rows = args.limit === null ? matchedRows : matchedRows.slice(0, args.limit);

  if (rows.length === 0) {
    throw new Error("No rows matched the current filters.");
  }

  const server = await startServer();
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-web-security",
      "--disable-gpu",
      "--disable-dev-shm-usage",
    ],
    timeout: args.timeout,
    protocolTimeout: args.timeout,
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(args.timeout);
  page.setDefaultNavigationTimeout(args.timeout);

  try {
    for (const [index, row] of rows.entries()) {
      if (!args.force && hasStableAssessment(row.existingAssessment)) {
        console.error(
          `Skipping ${index + 1}/${rows.length}: ${row.ip} / ${row.model} (summary already has assessment)`,
        );
        continue;
      }

      if (!args.force && existingResults.has(row.manifestUrl)) {
        const cached = existingResults.get(row.manifestUrl);
        if (hasStableAssessment(cached.assessment)) {
          console.error(
            `Skipping ${index + 1}/${rows.length}: ${row.ip} / ${row.model} (cached result present)`,
          );
          if (args.apply) {
            await updateSummaryAssessment(summaryPath, row, cached.assessment);
          }
          continue;
        }
      }

      console.error(`Evaluating ${index + 1}/${rows.length}: ${row.ip} / ${row.model}`);
      const record = await evaluateRow({
        row,
        page,
        baseUrl,
        runTempRoot,
        timeout: args.timeout,
        reviewDir,
      });
      record.assessment = buildAssessment(row, record);
      existingResults.set(row.manifestUrl, record);
      await writeOutput(outputPath, parsed.rows, existingResults);
      if (args.apply) {
        await updateSummaryAssessment(summaryPath, row, record.assessment);
      }
      console.log(
        JSON.stringify({
          manifestUrl: record.manifestUrl,
          status: record.status,
          assessment: record.assessment,
        }),
      );
    }
  } finally {
    await browser.close();
    server.close();
    if (!args.keepTemp) {
      await fs.rm(runTempRoot, { recursive: true, force: true });
    }
  }

  const finalOrdered = parsed.rows
    .map((row) => existingResults.get(row.manifestUrl))
    .filter(Boolean);
  const gradeCounts = countByGrade(finalOrdered);
  console.error(`Finished ${rows.length} matched rows. Grade counts so far: ${JSON.stringify(gradeCounts)}`);
  console.error(`Output written to ${outputPath}`);
}

await main();
