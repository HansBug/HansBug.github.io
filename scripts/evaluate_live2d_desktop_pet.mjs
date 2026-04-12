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
      "  --offset <n>         Skip the first n matched rows before evaluation",
      "  --limit <n>          Only evaluate the first n rows from the success table",
      "  --match <text>       Only evaluate rows whose IP / model / manifest contains the text",
      "  --reviewed-only      Only evaluate rows that already have a manual assessment",
      "  --force              Ignore existing JSON results and rerun matched rows",
      "  --review-dir <path>  Save browser review screenshots for matched rows",
      "  --apply              Write each finished assessment back into the summary table immediately",
      "  --keep-temp          Keep the per-run temporary root instead of cleaning it",
      "  --help, -h           Show this help message",
      "",
      "Examples:",
      "  node scripts/evaluate_live2d_desktop_pet.mjs --match Haru --limit 2",
      "  node scripts/evaluate_live2d_desktop_pet.mjs --reviewed-only --offset 50 --limit 25 --force --apply",
      "  node scripts/evaluate_live2d_desktop_pet.mjs --apply",
    ].join("\n"),
  );
}

function parseArgs(argv) {
  const args = {
    summaryPath: DEFAULT_SUMMARY_PATH,
    outputPath: DEFAULT_OUTPUT_PATH,
    timeout: DEFAULT_TIMEOUT,
    offset: 0,
    limit: null,
    match: null,
    reviewedOnly: false,
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

    if (item === "--offset") {
      args.offset = Number(argv[index + 1]);
      index += 1;
      continue;
    }

    if (item === "--match") {
      args.match = argv[index + 1];
      index += 1;
      continue;
    }

    if (item === "--reviewed-only") {
      args.reviewedOnly = true;
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

  if (!Number.isFinite(args.offset) || args.offset < 0) {
    throw new Error(`Invalid --offset value: ${args.offset}`);
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

function parseSizeMetadata(text) {
  if (!text || text === "未记录") {
    return null;
  }

  const match = String(text).match(/([0-9.]+)\s*x\s*([0-9.]+)/i);
  if (!match) {
    return null;
  }

  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }

  return {
    width,
    height,
    ratio: width / height,
    label: `${width} x ${height}`,
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
  const candidates = [];

  const rawMatch = url.match(/^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/);
  if (rawMatch) {
    const [, owner, repo, ref, filePath] = rawMatch;
    candidates.push(`https://cdn.jsdelivr.net/gh/${owner}/${repo}@${ref}/${filePath}`);
  }

  candidates.push(url);

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

function chooseRepresentativeMotionGroup(entries) {
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
  return nonIdle ?? groups[0] ?? null;
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

    const expressions = refs.Expressions || [];
    if (expressions[0]?.File) {
      addFile(expressions[0].File, true);
    }

    const motionGroups = Object.entries(refs.Motions || {})
      .map(([name, items]) => ({
        name,
        items: Array.isArray(items) ? items : [],
      }))
      .filter((item) => item.items.length > 0);
    const idleMotion = motionGroups.find((item) => /idle/i.test(item.name))?.items[0];
    if (idleMotion) {
      addFile(idleMotion.File, true);
      addFile(idleMotion.Sound, true);
    }
    const chosenMotionGroup = chooseRepresentativeMotionGroup(
      motionGroups.map((item) => ({ name: item.name, count: item.items.length })),
    );
    const chosenMotion = motionGroups.find((item) => item.name === chosenMotionGroup)?.items[0];
    if (chosenMotion) {
      addFile(chosenMotion.File, true);
      addFile(chosenMotion.Sound, true);
    }
  } else {
    addFile(manifestJson.model, false);
    addFile(manifestJson.physics, true);
    addFile(manifestJson.pose, true);

    for (const texture of manifestJson.textures || []) {
      addFile(texture, false);
    }

    const expressions = manifestJson.expressions || [];
    if (expressions[0]?.file) {
      addFile(expressions[0].file, true);
    }

    const motionGroups = Object.entries(manifestJson.motions || {})
      .map(([name, items]) => ({
        name,
        items: Array.isArray(items) ? items : [],
      }))
      .filter((item) => item.items.length > 0);
    const idleMotion = motionGroups.find((item) => /idle/i.test(item.name))?.items[0];
    if (idleMotion) {
      addFile(idleMotion.file, true);
      addFile(idleMotion.sound, true);
    }
    const chosenMotionGroup = chooseRepresentativeMotionGroup(
      motionGroups.map((item) => ({ name: item.name, count: item.items.length })),
    );
    const chosenMotion = motionGroups.find((item) => item.name === chosenMotionGroup)?.items[0];
    if (chosenMotion) {
      addFile(chosenMotion.file, true);
      addFile(chosenMotion.sound, true);
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

function pageHtml(runtime, modelUrl, resourceType, titleText, sizeLabel, sizeRatio) {
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
const RESOURCE_SIZE = ${JSON.stringify(
    sizeLabel && Number.isFinite(sizeRatio) && sizeRatio > 0 ? { label: sizeLabel, ratio: sizeRatio } : null,
  )};
const FOLLOW_PARAMETER_SPECS = [
  { key: "eyeBallX", label: "眼球水平", ids: ["ParamEyeBallX", "PARAM_EYE_BALL_X"], indexProp: "eyeballXParamIndex", axis: "eye" },
  { key: "eyeBallY", label: "眼球垂直", ids: ["ParamEyeBallY", "PARAM_EYE_BALL_Y"], indexProp: "eyeballYParamIndex", axis: "eye" },
  { key: "angleX", label: "头部水平", ids: ["ParamAngleX", "PARAM_ANGLE_X"], indexProp: "angleXParamIndex", axis: "head" },
  { key: "angleY", label: "头部垂直", ids: ["ParamAngleY", "PARAM_ANGLE_Y"], indexProp: "angleYParamIndex", axis: "head" },
  { key: "angleZ", label: "头部倾斜", ids: ["ParamAngleZ", "PARAM_ANGLE_Z"], indexProp: "angleZParamIndex", axis: "head" },
  { key: "bodyAngleX", label: "身体水平", ids: ["ParamBodyAngleX", "PARAM_BODY_ANGLE_X"], indexProp: "bodyAngleXParamIndex", axis: "body" },
];

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
  return nonIdle ?? groups[0] ?? null;
}

function displayMotionGroupName(name) {
  return name === "" ? "未命名动作组" : name || "无";
}

function getExtractor(app) {
  return app.renderer.plugins?.extract || app.renderer.extract;
}

function fitAspectBox(box, ratio) {
  const safeRatio = Number.isFinite(ratio) && ratio > 0 ? ratio : box.width / box.height;
  let width = box.width;
  let height = width / safeRatio;
  if (height > box.height) {
    height = box.height;
    width = height * safeRatio;
  }

  return {
    x: box.x + (box.width - width) / 2,
    y: box.y + (box.height - height) / 2,
    width,
    height,
  };
}

function defaultResourceRatio() {
  if (/横构图|超宽/.test(RESOURCE_TYPE)) return 1.28;
  if (/半身|小挂件|桌宠|精灵|吉祥物/.test(RESOURCE_TYPE)) return 0.82;
  if (/全身/.test(RESOURCE_TYPE)) return 0.62;
  return 0.78;
}

function buildBackdrop() {
  const profile = deskpetLayoutProfile();
  const slot = profile.slot;
  const graphics = new PIXI.Graphics();
  graphics.beginFill(0xf6f4ed, 1);
  graphics.drawRoundedRect(0, 0, 440, 520, 24);
  graphics.endFill();

  graphics.lineStyle(2, 0xb8b9af, 0.9);
  graphics.drawRoundedRect(slot.x, slot.y, slot.width, slot.height, 20);

  graphics.lineStyle(1.5, 0xc8c6b8, 0.6);
  graphics.moveTo(slot.x, slot.y + slot.height * 0.88);
  graphics.lineTo(slot.x + slot.width, slot.y + slot.height * 0.88);
  graphics.moveTo(slot.x + slot.width * 0.75, slot.y);
  graphics.lineTo(slot.x + slot.width * 0.75, slot.y + slot.height);

  return graphics;
}

function deskpetLayoutProfile() {
  const halfLike = /半身|小挂件|桌宠|精灵|吉祥物/.test(RESOURCE_TYPE);
  const fullBody = /全身/.test(RESOURCE_TYPE);
  const wide = /横构图|超宽/.test(RESOURCE_TYPE);
  const maxSlot = { x: 52, y: 34, width: 344, height: 430 };
  const sourceRatio = RESOURCE_SIZE?.ratio || defaultResourceRatio();
  const slot = fitAspectBox(maxSlot, sourceRatio);
  if (wide) {
    slot.y = maxSlot.y;
  }

  return {
    sourceSize: RESOURCE_SIZE,
    sourceRatio,
    halfLike,
    fullBody,
    wide,
    slot,
  };
}

function layoutDeskpet(model, app) {
  const bounds = model.getLocalBounds();
  const width = Math.max(bounds.width, 1);
  const height = Math.max(bounds.height, 1);
  const profile = deskpetLayoutProfile();
  const targetHeight = profile.slot.height * (profile.fullBody ? 1.95 : profile.halfLike ? 0.96 : profile.wide ? 1.05 : 1.14);
  const scale = targetHeight / height;
  const overflow = profile.slot.height * (profile.fullBody ? 1.02 : profile.halfLike ? 0.04 : 0.10);

  model.pivot.set(bounds.x + width / 2, bounds.y + height);
  model.position.set(
    profile.slot.x + profile.slot.width * (profile.fullBody ? 0.56 : profile.wide ? 0.48 : 0.66),
    profile.slot.y + profile.slot.height + overflow,
  );
  model.scale.set(scale);
}

function deskpetLayoutMargins(profile) {
  return {
    left: profile.wide ? 18 : 12,
    right: profile.wide ? 18 : 12,
    top: 12,
    bottom: profile.halfLike ? 10 : profile.fullBody ? 14 : 12,
  };
}

function desiredDeskpetVisibleHeight(profile) {
  if (profile.fullBody) {
    if (profile.sourceRatio <= 0.68) return 0.82;
    if (profile.sourceRatio <= 0.82) return 0.92;
    return 1.00;
  }
  if (profile.wide) return 1.28;
  if (profile.halfLike) return 0.84;
  return 1.10;
}

function desiredDeskpetVisibleWidth(profile) {
  if (profile.wide) {
    const compactWide =
      profile.sourceRatio >= 1.28 &&
      profile.sourceSize?.width <= 1400 &&
      profile.sourceSize?.height <= 1100;
    if (compactWide) return 0.72;
  }
  return null;
}

function desiredDeskpetTopRatio(profile) {
  if (profile.fullBody) {
    if (profile.sourceRatio <= 0.68) return 0.18;
    if (profile.sourceRatio <= 0.82) return 0.12;
    return 0.08;
  }
  if (profile.wide) return 0.09;
  if (profile.halfLike) return 0.16;
  return 0.14;
}

function snapshotModelBounds(model) {
  try {
    const rect = typeof model.getBounds === "function" ? model.getBounds() : null;
    if (!rect || !Number.isFinite(rect.width) || !Number.isFinite(rect.height)) {
      return { count: 0, width: 0, height: 0, minX: 0, minY: 0, maxX: 0, maxY: 0 };
    }

    const width = Math.max(rect.width, 0);
    const height = Math.max(rect.height, 0);
    return {
      count: width > 0 && height > 0 ? 1 : 0,
      minX: rect.x,
      minY: rect.y,
      maxX: rect.x + width,
      maxY: rect.y + height,
      width,
      height,
    };
  } catch {
    return { count: 0, width: 0, height: 0, minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }
}

function evaluateDeskpetPlacement(bounds, slot, profile) {
  if (!bounds.count || bounds.width <= 0 || bounds.height <= 0) {
    return {
      bounds,
      issueLevel: "missing",
      needsAdjustment: true,
      summaryText: "人物没有正常落进方形预览区内",
      leftOverflow: 0,
      rightOverflow: 0,
      topOverflow: 0,
      bottomOverflow: 0,
      centerOffsetX: 0,
      fillWidth: 0,
      fillHeight: 0,
      mostlyOutside: true,
      headTooLow: true,
    };
  }

  const leftOverflow = Math.max(0, slot.x - bounds.minX);
  const rightOverflow = Math.max(0, bounds.maxX - (slot.x + slot.width));
  const topOverflow = Math.max(0, slot.y - bounds.minY);
  const bottomOverflow = Math.max(0, bounds.maxY - (slot.y + slot.height));
  const centerOffsetX =
    bounds.minX + bounds.width / 2 - (slot.x + slot.width / 2);
  const fillWidth = slot.width > 0 ? bounds.width / slot.width : 0;
  const fillHeight = slot.height > 0 ? bounds.height / slot.height : 0;
  const overflowSides = [];
  const intersectWidth =
    Math.max(0, Math.min(bounds.maxX, slot.x + slot.width) - Math.max(bounds.minX, slot.x));
  const intersectHeight =
    Math.max(0, Math.min(bounds.maxY, slot.y + slot.height) - Math.max(bounds.minY, slot.y));
  const insideRatio =
    bounds.width > 0 && bounds.height > 0
      ? (intersectWidth * intersectHeight) / (bounds.width * bounds.height)
      : 0;
  const mostlyOutsideThreshold = profile.wide ? 0.42 : 0.72;
  const mostlyOutside = profile.fullBody ? false : insideRatio < mostlyOutsideThreshold;
  const headTooLow =
    bounds.minY > slot.y + slot.height * (profile.fullBody ? 0.18 : 0.24);
  const sideTooFar = !profile.fullBody && Math.abs(centerOffsetX) > slot.width * 0.24;
  const desiredWidth = desiredDeskpetVisibleWidth(profile);
  const widthTooWeak =
    Number.isFinite(desiredWidth) &&
    fillWidth < desiredWidth - 0.02;
  const cropTooWeak = fillHeight < desiredDeskpetVisibleHeight(profile) - 0.04 || widthTooWeak;
  const severeOverflow = !profile.fullBody && (
    leftOverflow > slot.width * (profile.wide ? 0.28 : 0.18) ||
    rightOverflow > slot.width * (profile.wide ? 0.28 : 0.18) ||
    topOverflow > slot.height * 0.14 ||
    bottomOverflow > slot.height * (profile.wide ? 0.42 : 0.22)
  );

  if (topOverflow > 4) overflowSides.push("上边");
  if (bottomOverflow > 4) overflowSides.push("下边");
  if (leftOverflow > 4) overflowSides.push("左边");
  if (rightOverflow > 4) overflowSides.push("右边");

  let issueLevel = "good";
  let summaryText = profile.fullBody
    ? "主体主要落在方形预览区内，半身/裁腰结构保持正常"
    : "主体主要落在方形预览区内，半身结构保持正常";
  if (mostlyOutside) {
    issueLevel = "overflow";
    summaryText = "人物大半不在方形预览区里";
  } else if (cropTooWeak) {
    issueLevel = "offset";
    summaryText = profile.fullBody
      ? "人物整体过小，还没有形成应有的半身/裁腰结构"
      : "人物整体过小，还没有形成应有的半身结构";
  } else if (headTooLow) {
    issueLevel = "offset";
    summaryText = "人物整体偏下，头顶已经掉到预览框下半区";
  } else if (severeOverflow && overflowSides.length > 0) {
    issueLevel = "overflow";
    summaryText = "人物有一部分从" + overflowSides.join("、") + "出框";
  } else if (sideTooFar) {
    issueLevel = "offset";
    summaryText = "人物整体偏" + (centerOffsetX > 0 ? "右" : "左") + "，主体没有落在方形区中央";
  } else if (fillHeight < 0.4 || fillWidth < 0.18) {
    issueLevel = "offset";
    summaryText = "人物整体偏小，虽然在方形预览区内但存在感偏弱";
  }

  return {
    bounds,
    issueLevel,
    needsAdjustment: mostlyOutside || cropTooWeak || headTooLow || severeOverflow || sideTooFar,
    summaryText,
    leftOverflow,
    rightOverflow,
    topOverflow,
    bottomOverflow,
    centerOffsetX,
    fillWidth,
    fillHeight,
    mostlyOutside,
    headTooLow,
    cropTooWeak,
  };
}

async function refineDeskpetLayout(app, model, backdrop) {
  const profile = deskpetLayoutProfile();
  const slot = profile.slot;
  const margins = deskpetLayoutMargins(profile);

  await advance(app, model, 2);
  const before = evaluateDeskpetPlacement(captureModelBounds(app, backdrop), slot, profile);
  let adjusted = false;

  for (let index = 0; index < 3; index += 1) {
    const current = evaluateDeskpetPlacement(captureModelBounds(app, backdrop), slot, profile);
    if (!current.needsAdjustment) {
      return {
        adjusted,
        before,
        after: current,
      };
    }

    const availableWidth = Math.max(slot.width - margins.left - margins.right, 1);
    const availableHeight = Math.max(slot.height - margins.top - margins.bottom, 1);
    let changed = false;

    let scaleChanged = false;
    if (current.cropTooWeak) {
      const heightGrow =
        (slot.height * desiredDeskpetVisibleHeight(profile)) / Math.max(current.bounds.height, 1);
      const desiredWidth = desiredDeskpetVisibleWidth(profile);
      const widthGrow =
        Number.isFinite(desiredWidth)
          ? (slot.width * desiredWidth) / Math.max(current.bounds.width, 1)
          : 1;
      const grow = Math.max(heightGrow, widthGrow);
      if (Number.isFinite(grow) && grow > 1.02 && grow < 2.6) {
        model.scale.set(model.scale.x * grow, model.scale.y * grow);
        adjusted = true;
        changed = true;
        scaleChanged = true;
      }
    }

    const heightNeedsShrink =
      !profile.fullBody &&
      !profile.wide &&
      current.bounds.height > availableHeight;
    if (!scaleChanged && (!profile.fullBody && (current.mostlyOutside || current.bounds.width > availableWidth || heightNeedsShrink))) {
      const widthFit = availableWidth / Math.max(current.bounds.width, 1);
      const heightFit = profile.fullBody
        ? 1
        : profile.wide
          ? 1
        : availableHeight / Math.max(current.bounds.height, 1);
      const shrink = Math.min(
        widthFit,
        heightFit,
      ) * 0.98;

      if (Number.isFinite(shrink) && shrink < 0.995) {
        model.scale.set(model.scale.x * shrink, model.scale.y * shrink);
        adjusted = true;
        changed = true;
        scaleChanged = true;
      }
    }

    if (scaleChanged) {
      await advance(app, model, 2);
      continue;
    }

    let shiftX = 0;
    let shiftY = 0;
    if (current.headTooLow || current.cropTooWeak) {
      const targetTop = slot.y + slot.height * desiredDeskpetTopRatio(profile);
      shiftY += targetTop - current.bounds.minY;
    }
    if (Math.abs(current.centerOffsetX) > slot.width * 0.24) {
      const keepOffset = slot.width * 0.12 * Math.sign(current.centerOffsetX);
      shiftX += -(current.centerOffsetX - keepOffset);
    }
    if (current.mostlyOutside && !current.headTooLow) {
      const targetCenterX = slot.x + margins.left + availableWidth / 2;
      const currentCenterX = current.bounds.minX + current.bounds.width / 2;
      shiftX += targetCenterX - currentCenterX;
      if (!profile.fullBody) {
        const targetBottom = slot.y + margins.top + availableHeight;
        shiftY += targetBottom - current.bounds.maxY;
      }
    }

    if (Math.abs(shiftX) > 1 || Math.abs(shiftY) > 1) {
      model.position.x += shiftX;
      model.position.y += shiftY;
      adjusted = true;
      changed = true;
    }

    if (!changed) {
      break;
    }

    await advance(app, model, 2);
  }

  const after = evaluateDeskpetPlacement(captureModelBounds(app, backdrop), slot, profile);
  return {
    adjusted,
    before,
    after,
  };
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

function trimmedAlphaBounds(pixels, width, height, alphaThreshold = 8) {
  const base = alphaBounds(pixels, width, height, alphaThreshold);
  if (!base.count) {
    return base;
  }

  const columnCounts = new Array(width).fill(0);
  const rowCounts = new Array(height).fill(0);
  for (let offset = 3, index = 0; offset < pixels.length; offset += 4, index += 1) {
    if (pixels[offset] <= alphaThreshold) {
      continue;
    }

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

  while (minX < maxX && columnCounts[minX] < columnThreshold) {
    minX += 1;
  }
  while (maxX > minX && columnCounts[maxX] < columnThreshold) {
    maxX -= 1;
  }
  while (minY < maxY && rowCounts[minY] < rowThreshold) {
    minY += 1;
  }
  while (maxY > minY && rowCounts[maxY] < rowThreshold) {
    maxY -= 1;
  }

  return {
    count: base.count,
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function backdropFilteredBounds(pixels, width, height, alphaThreshold = 8) {
  const palette = [
    [246, 244, 237],
    [184, 185, 175],
    [200, 198, 184],
  ];
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let count = 0;

  for (let offset = 0, index = 0; offset < pixels.length; offset += 4, index += 1) {
    const alpha = pixels[offset + 3];
    if (alpha <= alphaThreshold) {
      continue;
    }

    const r = pixels[offset];
    const g = pixels[offset + 1];
    const b = pixels[offset + 2];
    const isBackdrop = palette.some(([pr, pg, pb]) =>
      Math.abs(r - pr) + Math.abs(g - pg) + Math.abs(b - pb) <= 22,
    );
    if (isBackdrop) {
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

function captureModelBounds(app, backdrop) {
  const previousVisible = backdrop?.visible ?? true;
  if (backdrop) {
    backdrop.visible = false;
  }

  try {
    const extractor = getExtractor(app);
    if (!extractor || typeof extractor.pixels !== "function") {
      throw new Error("Pixi extract plugin is unavailable.");
    }

    const renderTexture = PIXI.RenderTexture.create({
      width: app.renderer.width,
      height: app.renderer.height,
    });

    try {
      app.renderer.render(app.stage, { renderTexture, clear: true });
      const pixels = extractor.pixels(renderTexture);
      return trimmedAlphaBounds(pixels, app.renderer.width, app.renderer.height);
    } finally {
      renderTexture.destroy(true);
    }
  } finally {
    if (backdrop) {
      backdrop.visible = previousVisible;
      app.renderer.render(app.stage);
    }
  }
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

function readParameterValue(core, index) {
  if (!core || !Number.isFinite(index) || index < 0) {
    return null;
  }

  try {
    if (typeof core.getParamFloat === "function") {
      const value = core.getParamFloat(index);
      return Number.isFinite(value) ? value : null;
    }

    if (typeof core.getParameterValueByIndex === "function") {
      const value = core.getParameterValueByIndex(index);
      return Number.isFinite(value) ? value : null;
    }
  } catch {
    return null;
  }

  return null;
}

function resolveParameterIndex(core, internalModel, spec) {
  const internalIndex = internalModel?.[spec.indexProp];
  if (Number.isFinite(internalIndex) && internalIndex >= 0) {
    return internalIndex;
  }

  if (typeof core?.getParameterIndex === "function") {
    for (const id of spec.ids) {
      const index = core.getParameterIndex(id);
      if (Number.isFinite(index) && index >= 0) {
        return index;
      }
    }
  }

  const rawIds = Array.isArray(core?._parameterIds) ? core._parameterIds : [];
  for (let index = 0; index < rawIds.length; index += 1) {
    const value = String(rawIds[index]);
    if (spec.ids.includes(value)) {
      return index;
    }
  }

  return null;
}

function snapshotFollowParameters(model) {
  const internalModel = model.internalModel;
  const core = internalModel?.coreModel;
  const parameters = {};
  const focusController = internalModel?.focusController;
  const controller = focusController
    ? {
        x: Number.isFinite(focusController.x) ? focusController.x : null,
        y: Number.isFinite(focusController.y) ? focusController.y : null,
        targetX: Number.isFinite(focusController.targetX) ? focusController.targetX : null,
        targetY: Number.isFinite(focusController.targetY) ? focusController.targetY : null,
      }
    : null;

  if (!internalModel || !core) {
    return {
      available: false,
      parameters,
      controller,
    };
  }

  for (const spec of FOLLOW_PARAMETER_SPECS) {
    const index = resolveParameterIndex(core, internalModel, spec);
    const value = readParameterValue(core, index);
    if (!Number.isFinite(value)) {
      continue;
    }

    parameters[spec.key] = {
      label: spec.label,
      axis: spec.axis,
      index,
      value,
    };
  }

  return {
    available: Object.keys(parameters).length > 0,
    parameters,
    controller,
  };
}

function buildNumericFollowProbe(neutral, focusRight, focusLeft) {
  const parameters = {};
  let eyeMaxDelta = 0;
  let headMaxDelta = 0;
  let bodyMaxDelta = 0;
  let controllerMaxDelta = 0;

  for (const spec of FOLLOW_PARAMETER_SPECS) {
    const neutralValue = neutral.parameters[spec.key]?.value;
    const rightValue = focusRight.parameters[spec.key]?.value;
    const leftValue = focusLeft.parameters[spec.key]?.value;
    const values = [neutralValue, rightValue, leftValue].filter((value) => Number.isFinite(value));
    if (values.length === 0) {
      continue;
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    parameters[spec.key] = {
      label: spec.label,
      axis: spec.axis,
      index:
        neutral.parameters[spec.key]?.index ??
        focusRight.parameters[spec.key]?.index ??
        focusLeft.parameters[spec.key]?.index ??
        null,
      neutral: Number.isFinite(neutralValue) ? neutralValue : null,
      focusRight: Number.isFinite(rightValue) ? rightValue : null,
      focusLeft: Number.isFinite(leftValue) ? leftValue : null,
      range,
    };

    if (spec.axis === "eye") {
      eyeMaxDelta = Math.max(eyeMaxDelta, range);
    } else if (spec.axis === "head") {
      headMaxDelta = Math.max(headMaxDelta, range);
    } else if (spec.axis === "body") {
      bodyMaxDelta = Math.max(bodyMaxDelta, range);
    }
  }

  for (const key of ["x", "y", "targetX", "targetY"]) {
    const values = [
      neutral.controller?.[key],
      focusRight.controller?.[key],
      focusLeft.controller?.[key],
    ].filter((value) => Number.isFinite(value));
    if (values.length === 0) {
      continue;
    }

    controllerMaxDelta = Math.max(controllerMaxDelta, Math.max(...values) - Math.min(...values));
  }

  return {
    available: Object.keys(parameters).length > 0,
    parameters,
    eyeMaxDelta,
    headMaxDelta,
    bodyMaxDelta,
    controller: {
      neutral: neutral.controller || null,
      focusRight: focusRight.controller || null,
      focusLeft: focusLeft.controller || null,
      maxDelta: controllerMaxDelta,
    },
  };
}

function buildVisualFollowProbe(diffA, diffB) {
  const changedRatio = Math.max(diffA.changedRatio, diffB.changedRatio);
  const coverageWidth = Math.max(diffA.coverageWidth, diffB.coverageWidth);
  const coverageHeight = Math.max(diffA.coverageHeight, diffB.coverageHeight);

  let visibilityLevel = "none";
  let visibilityText = "画面上几乎看不出跟随";
  if (changedRatio >= 0.035 || coverageHeight >= 0.5) {
    visibilityLevel = "clear";
    visibilityText = "画面上能直接看出跟随";
  } else if (changedRatio >= 0.012 || coverageHeight >= 0.22) {
    visibilityLevel = "light";
    visibilityText = "画面上能看出轻微跟随";
  } else if (changedRatio >= 0.003) {
    visibilityLevel = "tiny";
    visibilityText = "画面上幅度很小";
  }

  let motionAreaLevel = "face";
  let motionAreaText = "视觉上主要是脸部到头部在动";
  if (coverageHeight >= 0.68 || changedRatio >= 0.08) {
    motionAreaLevel = "body";
    motionAreaText = "视觉上能看到头肩到上半身都在动";
  } else if (coverageHeight >= 0.32 || changedRatio >= 0.02) {
    motionAreaLevel = "head";
    motionAreaText = "视觉上主要是头部到头肩在动";
  }

  return {
    neutralToRight: diffA,
    rightToLeft: diffB,
    changedRatio,
    coverageWidth,
    coverageHeight,
    visibilityLevel,
    visibilityText,
    motionAreaLevel,
    motionAreaText,
  };
}

function formatDelta(value) {
  if (!Number.isFinite(value)) {
    return "0";
  }

  if (value >= 10) {
    return value.toFixed(1);
  }
  if (value >= 1) {
    return value.toFixed(2);
  }
  return value.toFixed(3);
}

function summarizeFollowProbe(visual, numeric) {
  const eyeDelta = numeric.eyeMaxDelta || 0;
  const headDelta = numeric.headMaxDelta || 0;
  const bodyDelta = numeric.bodyMaxDelta || 0;
  const controllerDelta = numeric.controller?.maxDelta || 0;
  const eyeLight = eyeDelta >= 0.05;
  const eyeClear = eyeDelta >= 0.18;
  const headLight = headDelta >= 1.2;
  const headClear = headDelta >= 5;
  const bodyLight = bodyDelta >= 0.5;
  const bodyClear = bodyDelta >= 1.8;

  let followLevel = "none";
  let followLabel = "几乎无默认跟随";
  let movementText = "眼睛、头部和上身参数都基本不变";

  if (bodyClear || (bodyLight && headClear)) {
    followLevel = "upper-body-clear";
    followLabel = "上身也明显跟随";
    movementText = "头部跟随明显，上身也被明显带动";
  } else if (bodyLight) {
    followLevel = "upper-body-light";
    followLabel = "上身会被轻带动";
    movementText = "头部跟随明确，上身也有轻微带动";
  } else if (headClear) {
    followLevel = "head-clear";
    followLabel = "头部跟随明显";
    movementText = eyeLight
      ? "头部跟随明显，眼睛也会同步偏转"
      : "头部跟随明显，身体基本不动";
  } else if (headLight) {
    followLevel = "head-light";
    followLabel = "头部轻微跟随";
    movementText = eyeLight
      ? "眼睛会跟，头部也有轻微带动，身体基本不动"
      : "头部会轻微带动，身体基本不动";
  } else if (eyeClear) {
    followLevel = "eyes-clear";
    followLabel = "眼睛跟随明确";
    movementText = "主要是眼睛在跟，头部和上身基本不动";
  } else if (eyeLight) {
    followLevel = "eyes-light";
    followLabel = "眼睛小幅跟随";
    movementText = "主要是眼睛小幅跟随，头部和上身基本不动";
  }

  if (followLevel === "none" && visual.visibilityLevel !== "none") {
    if (visual.motionAreaLevel === "body") {
      followLevel = "visual-body";
      followLabel = "视觉上上半身在动";
      movementText = visual.motionAreaText;
    } else if (visual.motionAreaLevel === "head") {
      followLevel = "visual-head";
      followLabel = "视觉上头肩在动";
      movementText = visual.motionAreaText;
    } else {
      followLevel = "visual-face";
      followLabel = "视觉上脸部轻动";
      movementText = visual.motionAreaText;
    }
  }

  let followSummary = "";
  if (!numeric.available) {
    followSummary =
      visual.visibilityLevel === "none"
        ? "鼠标跟随：当前脚本拿不到标准跟随参数，画面上也几乎看不出变化，可先按默认无明显跟随处理。"
        : "鼠标跟随：" + visual.visibilityText + "，但当前脚本拿不到标准跟随参数，暂时只能按画面做保守判断。";
  } else if (followLevel === "none") {
    followSummary =
      visual.visibilityLevel === "none"
        ? "鼠标跟随：画面上几乎看不出，数值上眼睛、头部和上身参数都基本不变，可按默认几乎不跟随处理。"
        : controllerDelta >= 0.12
          ? "鼠标跟随：" + visual.visibilityText + "，数值上 focusController 已有响应，但眼睛、头部和上身标准参数没有明显变化。"
          : "鼠标跟随：" + visual.visibilityText + "，但当前抓到的眼睛、头部和上身标准参数没有明显变化。";
  } else if (followLevel.startsWith("visual-")) {
    followSummary =
      "鼠标跟随：" + movementText +
      (controllerDelta >= 0.12
        ? "，数值上 focusController 也有明确响应，但标准跟随参数没有直接暴露。"
        : "，但当前抓到的标准跟随参数没有明显变化。");
  } else if (visual.visibilityLevel === "none" || visual.visibilityLevel === "tiny") {
    followSummary = "鼠标跟随：" + visual.visibilityText + "，但数值上" + movementText + "。";
  } else {
    followSummary = "鼠标跟随：" + movementText + "；" + visual.visibilityText + "。";
  }

  return {
    followLevel,
    followLabel,
    movementText,
    followSummary,
    parameterSummary:
      "眼睛Δ" + formatDelta(eyeDelta) +
      " / 头部Δ" + formatDelta(headDelta) +
      " / 上身Δ" + formatDelta(bodyDelta) +
      " / 焦点Δ" + formatDelta(controllerDelta),
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
    return {
      supported: false,
      followLevel: "unsupported",
      followLabel: "无 focus 接口",
      followSummary: "鼠标跟随：当前 runtime 没有可调用的 focus 接口，脚本侧无法确认默认跟随。",
      parameterSummary: "眼睛Δ0 / 头部Δ0 / 上身Δ0",
    };
  }

  try {
    model.focus(0, 0);
    await advance(app, model, 8);
    const neutral = capture(app);
    const neutralParameters = snapshotFollowParameters(model);

    model.focus(0.82, -0.42);
    await advance(app, model, 18);
    const focusRight = capture(app);
    const focusRightParameters = snapshotFollowParameters(model);

    model.focus(-0.82, 0.42);
    await advance(app, model, 18);
    const focusLeft = capture(app);
    const focusLeftParameters = snapshotFollowParameters(model);

    const diffA = diffMetrics(neutral, focusRight, baseline.bounds);
    const diffB = diffMetrics(focusRight, focusLeft, baseline.bounds);
    const visual = buildVisualFollowProbe(diffA, diffB);
    const numeric = buildNumericFollowProbe(
      neutralParameters,
      focusRightParameters,
      focusLeftParameters,
    );
    const follow = summarizeFollowProbe(visual, numeric);

    return {
      supported: true,
      changedRatio: visual.changedRatio,
      coverageWidth: visual.coverageWidth,
      coverageHeight: visual.coverageHeight,
      visual,
      numeric,
      ...follow,
    };
  } catch (error) {
    return {
      supported: true,
      error: String(error && (error.stack || error.message || error)),
      followLevel: "probe-error",
      followLabel: "检测失败",
      followSummary: ("鼠标跟随：检测失败，" + String(error && (error.message || error))).slice(0, 160),
      parameterSummary: "眼睛Δ0 / 头部Δ0 / 上身Δ0",
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
  if (group === null || group === undefined) {
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
      groupLabel: displayMotionGroupName(group),
      touchLike: /tap|touch|flick|pinch|body|head/i.test(group),
      changedRatio: diff.changedRatio,
      coverageWidth: diff.coverageWidth,
      coverageHeight: diff.coverageHeight,
    };
  } catch (error) {
    return {
      supported: true,
      group,
      groupLabel: displayMotionGroupName(group),
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
      options.motionPreload = PIXI.live2d.MotionPreloadStrategy.ALL;
    }

    if (!PIXI.live2d || !PIXI.live2d.Live2DModel) {
      throw new Error("Live2D runtime missing.");
    }

    const model = await PIXI.live2d.Live2DModel.from(${JSON.stringify(modelUrl)}, options);
    app.stage.addChild(model);
    layoutDeskpet(model, app);
    await advance(app, model, 10);
    const placementProbe = await refineDeskpetLayout(app, model, backdrop);
    await advance(app, model, 4);

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
    const deskpetBounds =
      placementProbe.after?.bounds?.count
        ? placementProbe.after.bounds
        : baseline.bounds;
    const targetDeskpetWidth =
      deskpetBounds.height > 0
        ? Math.round((deskpetBounds.width / deskpetBounds.height) * 340)
        : null;

    document.getElementById("shot-neutral").src = neutralShot;
    document.getElementById("shot-focus").src = focusShot;
    document.getElementById("shot-motion").src = motionShot;
    const profile = deskpetLayoutProfile();

    document.getElementById("stats").textContent =
      "资源比例 " + (profile.sourceSize?.label || "未记录") +
      "\\n预览框 " + Math.round(profile.slot.width) + " x " + Math.round(profile.slot.height) +
      "\\n位置结论 " + (placementProbe.after?.summaryText || "未测") +
      "\\n位置修正 " + (placementProbe.adjusted
        ? placementProbe.after?.issueLevel === "good"
          ? "已自动纠偏"
          : "已自动纠偏，但仍需人工看"
        : "未触发") +
      "\\n鼠标跟随 " + (focusProbe.followLabel || "未测") +
      "\\n跟随可见度 " + (focusProbe.visual?.visibilityText || (focusProbe.supported ? "已测" : "无")) +
      "\\n跟随参数 " + (focusProbe.parameterSummary || "眼睛Δ0 / 头部Δ0 / 上身Δ0") +
      "\\n命中区 " + hitAreas.length +
      " 个\\n表情 " + expressions.length +
      " 个\\n动作组 " + motionEntries.length +
      " 组\\n触发动作 " + (motionProbe.groupLabel || "无") +
      "\\n焦点反应 " + (focusProbe.supported ? (focusProbe.error ? "失败" : "已测") : "无") +
      "\\n建议位宽 " + (targetDeskpetWidth ?? "未知") + " px";
    window.__reportReady = true;

    window.__result = {
      ok: true,
      width: model.width,
      height: model.height,
      visibleBounds: baseline.bounds,
      placementProbe,
      targetDeskpetWidth,
      previewFrame: {
        width: Math.round(profile.slot.width),
        height: Math.round(profile.slot.height),
        ratio: profile.sourceRatio,
      },
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
          url.searchParams.get("sizeLabel") || "",
          Number(url.searchParams.get("sizeRatio")),
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

function formatMotionGroupLabel(name, fallback = "无") {
  if (name === "") {
    return "未命名动作组";
  }
  return name || fallback;
}

function extractAssessmentGrade(assessment) {
  if (!assessment) {
    return "未分级";
  }

  const normalized = String(assessment).replace(/^人工复核：/, "");
  return normalized.split(/[：。]/)[0] || "未分级";
}

function buildAssessment(row, item) {
  if (item.status !== "ok" || !item.result?.ok) {
    return `人工复核：本轮复测失败。${shortError(item.result?.error || item.error)}`;
  }

  const result = item.result;
  const motionGroupCount = result.motionGroups.length;
  const hitAreaCount = result.hitAreas.length;
  const expressionCount = result.expressionsCount;
  const touchLikeCount = result.touchLikeMotionGroups.length;
  const followLevel = result.focusProbe?.followLevel || "none";
  const followAny =
    !["none", "unsupported", "probe-error"].includes(followLevel);
  const followBody =
    ["upper-body-light", "upper-body-clear", "visual-body"].includes(followLevel);
  const motionStrong =
    result.motionProbe?.supported &&
    !result.motionProbe.error &&
    result.motionProbe.changedRatio >= 0.025;
  const motionBody =
    motionStrong &&
    result.motionProbe.coverageHeight >= 0.55;
  const headOnly =
    (followAny || motionStrong) &&
    !followBody &&
    !motionBody;
  const wide =
    /超宽/.test(row.resourceType) ||
    (Number.isFinite(result.targetDeskpetWidth) && result.targetDeskpetWidth >= 320);
  const halfLike = /半身|小挂件|桌宠|精灵|吉祥物/.test(row.resourceType);
  const fullBody = /全身/.test(row.resourceType);
  const heavy =
    result.texturePixels >= 45_000_000;
  const dense =
    result.texturePixels >= 28_000_000;
  const placementProbe = result.placementProbe?.after || result.placementProbe?.before || null;
  const placementIssue = placementProbe?.issueLevel || "good";
  const placementAdjusted = Boolean(result.placementProbe?.adjusted);

  let grade = "可用";
  if (motionBody && hitAreaCount >= 2 && motionGroupCount >= 3 && !wide && !heavy) {
    grade = "强适合";
  } else if ((motionBody || (followBody && motionStrong)) && !wide) {
    grade = heavy ? "适合但偏重" : fullBody ? "适合，建议裁腰" : "适合";
  } else if (headOnly || wide) {
    grade = "不建议";
  } else if (!motionStrong && !followAny && touchLikeCount === 0) {
    grade = halfLike ? "可用但偏静态" : "不建议";
  } else if (heavy) {
    grade = "可用但偏重";
  } else if (!motionStrong) {
    grade = "可用但偏安静";
  }

  if (placementIssue === "missing") {
    grade = "不建议";
  } else if (placementIssue === "overflow") {
    if (grade.startsWith("适合") || grade === "强适合") {
      grade = "适合但需预留边距";
    } else if (grade.startsWith("可用")) {
      grade = "可用但需预留边距";
    }
  }

  const widthText = Number.isFinite(result.targetDeskpetWidth)
    ? `右下角约 ${result.targetDeskpetWidth}x340`
    : "右下角默认摆位";

  let placement = `${widthText} 摆位下主体基本能落进桌宠框`;
  if (placementProbe?.summaryText) {
    placement = `${widthText} 摆位下${placementProbe.summaryText}`;
  } else if (wide) {
    placement = `${widthText} 摆位下横向占位偏大，需要额外留边`;
  } else if (fullBody && Number.isFinite(result.targetDeskpetWidth) && result.targetDeskpetWidth < 210) {
    placement = `${widthText} 摆位下会偏细高，更像立绘缩略位`;
  } else if (halfLike) {
    placement = `${widthText} 摆位下主体集中，半身/小挂件构图天然贴桌角`;
  } else if (fullBody) {
    placement = `${widthText} 摆位下更适合裁到腰部以上使用`;
  }

  if (placementAdjusted) {
    placement += placementIssue === "good" ? "，脚本已自动纠偏" : "，脚本已尝试自动纠偏";
  }
  if (fullBody && Number.isFinite(result.targetDeskpetWidth) && result.targetDeskpetWidth < 210) {
    placement += "，整体会偏细高，更像立绘缩略位";
  } else if (halfLike) {
    placement += "，半身/小挂件构图比较贴桌角";
  } else if (wide) {
    placement += "，横向仍建议留少量边距";
  }

  if (heavy) {
    placement += "，纹理开销偏高";
  } else if (dense) {
    placement += "，细节量够用但更适合桌面端";
  }

  let interaction = "";
  if (motionStrong) {
    const coverage = motionBody ? "变化能带到上半身甚至全身" : "变化主要集中在头肩";
    interaction = `默认交互方面，命中区 ${hitAreaCount} 个、表情 ${expressionCount} 个、动作组 ${motionGroupCount} 组；代表动作 ${formatMotionGroupLabel(result.motionProbe.group)} 可触发，${coverage}`;
  } else if (result.motionProbe?.supported && !result.motionProbe.error) {
    interaction = `默认交互方面，命中区 ${hitAreaCount} 个、表情 ${expressionCount} 个、动作组 ${motionGroupCount} 组；代表动作 ${formatMotionGroupLabel(result.motionProbe.group)} 能跑，但反馈偏轻`;
  } else if (touchLikeCount > 0) {
    interaction = `默认交互方面，命中区 ${hitAreaCount} 个、表情 ${expressionCount} 个、动作组 ${motionGroupCount} 组；虽然有 ${touchLikeCount} 组触摸类动作名，但本轮代表动作没有测到强反馈`;
  } else {
    interaction = `默认交互方面，命中区 ${hitAreaCount} 个、表情 ${expressionCount} 个、动作组 ${motionGroupCount} 组，基本没有可直接依赖的默认互动`;
  }

  if (hitAreaCount === 0 && (touchLikeCount > 0 || motionGroupCount > 0)) {
    interaction += "，接入时仍建议工程侧显式绑定点击 / 悬停 / 闲置逻辑";
  }

  const followSentence = (result.focusProbe?.followSummary || "鼠标跟随：未测。").replace(/[。]+$/u, "");
  const interactionSentence = interaction.replace(/[。]+$/u, "");
  return `人工复核：${grade}。${placement}。${followSentence}。${interactionSentence}。`;
}

async function writeOutput(outputPath, rows, resultsMap) {
  const ordered = rows
    .map((row) => resultsMap.get(row.manifestUrl))
    .filter(Boolean);

  const payload = {
    generatedAt: new Date().toISOString(),
    note: "Reviewed deskpet assessments are kept in this file, including summary-imported manual conclusions and visual+numeric browser probe reruns.",
    stats: {
      reviewed: ordered.length,
    },
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
    const grade = extractAssessmentGrade(item.assessment);
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
    const sizeMeta = parseSizeMetadata(row.sizeText);

    await page.goto(
      `${baseUrl}/test.html?runtime=${encodeURIComponent(row.runtime)}&model=${encodeURIComponent(localUrl)}&resourceType=${encodeURIComponent(row.resourceType)}&title=${encodeURIComponent(`${row.ip} / ${row.model}`)}&sizeLabel=${encodeURIComponent(sizeMeta?.label || "")}&sizeRatio=${encodeURIComponent(sizeMeta?.ratio || "")}`,
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
    if (args.reviewedOnly && !row.existingAssessment?.trim()) {
      return false;
    }

    if (!args.match) {
      return true;
    }

    const haystack = `${row.ip} ${row.model} ${row.resourceType} ${row.manifestUrl}`.toLowerCase();
    return haystack.includes(args.match.toLowerCase());
  });
  const offsetRows = matchedRows.slice(args.offset);
  const rows = args.limit === null ? offsetRows : offsetRows.slice(0, args.limit);

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
      record.reviewMethod = "visual+numeric-browser-probe";
      record.source = "evaluate-live2d-desktop-pet.mjs";
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
