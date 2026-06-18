import crypto from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { spawn } from "node:child_process";

import puppeteer from "puppeteer-core";

const CHROME_PATH_CANDIDATES = [
  process.env.CHROME_PATH,
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/home/ubuntu/.cache/rod/browser/chromium-1321438/chrome",
  "/home/ubuntu/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome",
].filter(Boolean);
const DEFAULT_POOL_PATH = "src/data/bangdreamDeskPetPool.json";
const DEFAULT_MODELS_DIR = "src/vendor/deskpet/bangdream-models";
const DEFAULT_OUTPUT_CSV = "src/data/deskpet/bangdream-resource-audit/render-completeness.csv";
const DEFAULT_OUTPUT_JSON = "src/data/deskpet/bangdream-resource-audit/render-completeness.json";
const DEFAULT_SCREENSHOTS_DIR = ".cache/deskpet-audit/render-screenshots";
const DEFAULT_TIMEOUT = 120000;

const THRESHOLDS = {
  alphaThreshold: 8,
  minNonblankRatio: 0.035,
  minBoundsWidth: 80,
  minBoundsHeight: 180,
  minInsideRatio: 0.72,
};

const CSV_COLUMNS = [
  "resource_key",
  "model_key",
  "character_code",
  "character_name",
  "variant",
  "resource_type",
  "runtime",
  "manifest_path",
  "render_status",
  "complete_person_decision",
  "complete_person_reason",
  "canvas_width",
  "canvas_height",
  "model_width",
  "model_height",
  "nonblank_pixels",
  "nonblank_ratio",
  "bounds_min_x",
  "bounds_min_y",
  "bounds_max_x",
  "bounds_max_y",
  "bounds_width",
  "bounds_height",
  "slot_x",
  "slot_y",
  "slot_width",
  "slot_height",
  "bounds_inside_ratio",
  "fill_width_ratio",
  "fill_height_ratio",
  "left_overflow",
  "right_overflow",
  "top_overflow",
  "bottom_overflow",
  "issue_level",
  "texture_count",
  "texture_pixels",
  "render_canvas_sha256",
  "screenshot_path",
  "error_stage",
  "error_message",
  "audited_at",
  "duration_ms",
];

function usage() {
  console.error(
    [
      "Usage:",
      "  node scripts/audit_bangdream_render_completeness.mjs [options]",
      "",
      "Options:",
      `  --pool <path>             Pool JSON path. Default: ${DEFAULT_POOL_PATH}`,
      `  --models-dir <path>       Local model directory. Default: ${DEFAULT_MODELS_DIR}`,
      `  --output-csv <path>       CSV output. Default: ${DEFAULT_OUTPUT_CSV}`,
      `  --output-json <path>      JSON output. Default: ${DEFAULT_OUTPUT_JSON}`,
      `  --screenshots-dir <path>  Screenshot output directory. Default: ${DEFAULT_SCREENSHOTS_DIR}`,
      `  --timeout <ms>            Per-model timeout. Default: ${DEFAULT_TIMEOUT}`,
      "  --limit <n>               Only audit the first n matched models",
      "  --match <text>            Only audit resource/model/character entries containing text",
      "  --no-screenshots          Do not write PNG screenshots",
      "  --direct-probe             Use the built-in minimal Pixi page. This is the default.",
      "  --real-page                Use the real Astro page as a smoke check instead of direct probe",
      "  --headed                  Run Chrome in headed mode; use xvfb-run in CI/headless shells",
      "  --help, -h                Show this help message",
    ].join("\n"),
  );
}

function parseArgs(argv) {
  const args = {
    poolPath: DEFAULT_POOL_PATH,
    modelsDir: DEFAULT_MODELS_DIR,
    outputCsv: DEFAULT_OUTPUT_CSV,
    outputJson: DEFAULT_OUTPUT_JSON,
    screenshotsDir: DEFAULT_SCREENSHOTS_DIR,
    timeout: DEFAULT_TIMEOUT,
    limit: null,
    match: "",
    screenshots: true,
    directProbe: true,
    headed: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--pool") {
      args.poolPath = argv[index + 1];
      index += 1;
      continue;
    }
    if (item === "--models-dir") {
      args.modelsDir = argv[index + 1];
      index += 1;
      continue;
    }
    if (item === "--output-csv") {
      args.outputCsv = argv[index + 1];
      index += 1;
      continue;
    }
    if (item === "--output-json") {
      args.outputJson = argv[index + 1];
      index += 1;
      continue;
    }
    if (item === "--screenshots-dir") {
      args.screenshotsDir = argv[index + 1];
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
    if (item === "--no-screenshots") {
      args.screenshots = false;
      continue;
    }
    if (item === "--direct-probe") {
      args.directProbe = true;
      continue;
    }
    if (item === "--real-page") {
      args.directProbe = false;
      continue;
    }
    if (item === "--headed") {
      args.headed = true;
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

function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".moc")) return "application/octet-stream";
  if (filePath.endsWith(".mtn")) return "application/octet-stream";
  if (filePath.endsWith(".exp")) return "application/json; charset=utf-8";
  return "application/octet-stream";
}

function toPosix(filePath) {
  return filePath.split(path.sep).join("/");
}

function relativePath(filePath) {
  return toPosix(path.relative(process.cwd(), filePath));
}

function csvEscape(value) {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll("\"", "\"\"")}"`;
  }
  return text;
}

function csvText(rows) {
  const lines = [CSV_COLUMNS.join(",")];
  for (const row of rows) {
    lines.push(CSV_COLUMNS.map((column) => csvEscape(row[column])).join(","));
  }
  return `${lines.join("\n")}\n`;
}

function sha256(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
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
  throw new Error(
    `No Chrome/Chromium executable found. Set CHROME_PATH explicitly. Tried: ${CHROME_PATH_CANDIDATES.join(", ")}`,
  );
}

function chromeLaunchArgs() {
  return [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-web-security",
    "--enable-webgl",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--use-gl=swiftshader",
    "--disable-dev-shm-usage",
  ];
}

async function assertWebglSupport(page, timeoutMs) {
  await page.goto("data:text/html,<canvas id='probe' width='8' height='8'></canvas>", {
    waitUntil: "load",
    timeout: timeoutMs,
  });
  const result = await page.evaluate(() => {
    const canvas = document.getElementById("probe");
    const gl =
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl") ||
      canvas.getContext("webgl2");
    return {
      ok: Boolean(gl),
      userAgent: navigator.userAgent,
      renderer: gl ? gl.getParameter(gl.RENDERER) : "",
      vendor: gl ? gl.getParameter(gl.VENDOR) : "",
    };
  });
  if (!result.ok) {
    throw new Error(
      `Chromium WebGL is unavailable; Live2D render audit cannot distinguish blank resources from an environment failure. userAgent=${result.userAgent}`,
    );
  }
  return result;
}

function dataUrlToBuffer(value) {
  const base64 = String(value).replace(/^data:image\/png;base64,/, "");
  return Buffer.from(base64, "base64");
}

function sleepNode(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHttp(url, timeoutMs) {
  const started = performance.now();
  let lastError = null;
  while (performance.now() - started < timeoutMs) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleepNode(500);
  }
  throw new Error(`Timed out waiting for ${url}: ${String(lastError && (lastError.message || lastError))}`);
}

async function startAstroServer(timeoutMs) {
  const port = 4327 + Math.floor(Math.random() * 1000);
  const child = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(port)], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
    stdout = stdout.slice(-8000);
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
    stderr = stderr.slice(-8000);
  });

  try {
    const baseUrl = `http://127.0.0.1:${port}`;
    await waitForHttp(baseUrl, timeoutMs);
    return {
      baseUrl,
      stop: async () => {
        child.kill("SIGTERM");
        await Promise.race([
          new Promise((resolve) => child.once("exit", resolve)),
          sleepNode(3000).then(() => child.kill("SIGKILL")),
        ]);
      },
    };
  } catch (error) {
    child.kill("SIGTERM");
    throw new Error(
      `Failed to start Astro dev server: ${String(error && (error.message || error))}\nstdout:\n${stdout}\nstderr:\n${stderr}`,
    );
  }
}

function modelTargets(pool, modelsDir) {
  const results = [];
  for (const character of pool.characters || []) {
    const code = String(character.code).padStart(3, "0");
    for (const variant of character.variants || []) {
      const modelKey = `${code}_${variant}`;
      const resourceKey = `bangdream_${modelKey}`;
      const manifestPath = path.resolve(modelsDir, modelKey, "model.json");
      results.push({
        resource_key: resourceKey,
        model_key: modelKey,
        character_code: code,
        character_name: character.name || "",
        variant,
        resource_type: variantResourceType(variant),
        runtime: "cubism2",
        manifest_path: relativePath(manifestPath),
        manifest_abs_path: manifestPath,
      });
    }
  }
  results.sort((left, right) => left.resource_key.localeCompare(right.resource_key));
  return results;
}

function variantResourceType(variant) {
  if (/sumimi/i.test(variant)) return "半身 / 偶像舞台装";
  if (/event_\d+_story_/i.test(variant)) return "半身 / 剧情立绘";
  if (/casual.*summer|school_summer/i.test(variant)) return "半身 / 夏装立绘";
  if (/casual.*winter|school_winter/i.test(variant)) return "半身 / 冬装立绘";
  if (/casual/i.test(variant)) return "半身 / 私服立绘";
  if (/school/i.test(variant)) return "半身 / 校服立绘";
  if (/kirameki_festival/i.test(variant)) return "半身 / 辉彩祭立绘";
  if (/dream_festival/i.test(variant)) return "半身 / 梦祭立绘";
  if (/live_event_|live_default|live_sr_|live_ssr_/i.test(variant)) return "半身 / 活动立绘";
  if (/collabo/i.test(variant)) return "半身 / 联动立绘";
  if (/birthday/i.test(variant)) return "半身 / 生日立绘";
  if (/furisode/i.test(variant)) return "半身 / 振袖立绘";
  if (/arbeit/i.test(variant)) return "半身 / 打工立绘";
  return "半身 / 角色立绘";
}

function pageHtml(modelUrl) {
  return `<!doctype html>
<meta charset="utf-8" />
<canvas id="view" width="440" height="520"></canvas>
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
const THRESHOLDS = ${JSON.stringify(THRESHOLDS)};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function getExtractor(app) {
  return app.renderer.plugins?.extract || app.renderer.extract;
}

function layoutModel(model) {
  const bounds = model.getLocalBounds();
  const width = Math.max(bounds.width, 1);
  const height = Math.max(bounds.height, 1);
  const slot = { x: 52, y: 34, width: 344, height: 430 };
  const targetHeight = slot.height * 1.14;
  const scale = targetHeight / height;
  model.pivot.set(bounds.x + width / 2, bounds.y + height);
  model.position.set(slot.x + slot.width * 0.66, slot.y + slot.height + slot.height * 0.10);
  model.scale.set(scale);
  return slot;
}

function captureModelBounds(app) {
  const extractor = getExtractor(app);
  if (!extractor || typeof extractor.pixels !== "function") {
    throw new Error("Pixi extract plugin is unavailable.");
  }
  app.renderer.render(app.stage);
  const pixels = extractor.pixels(app.stage);
  return trimmedAlphaBounds(pixels, app.renderer.width, app.renderer.height, THRESHOLDS.alphaThreshold);
}

function evaluateBounds(bounds, slot, canvasWidth, canvasHeight) {
  const nonblankRatio = bounds.count / Math.max(canvasWidth * canvasHeight, 1);
  const intersectWidth = Math.max(0, Math.min(bounds.maxX, slot.x + slot.width) - Math.max(bounds.minX, slot.x));
  const intersectHeight = Math.max(0, Math.min(bounds.maxY, slot.y + slot.height) - Math.max(bounds.minY, slot.y));
  const boundsArea = Math.max(bounds.width * bounds.height, 1);
  const insideRatio = (intersectWidth * intersectHeight) / boundsArea;
  const fillWidthRatio = bounds.width / Math.max(slot.width, 1);
  const fillHeightRatio = bounds.height / Math.max(slot.height, 1);
  const leftOverflow = Math.max(0, slot.x - bounds.minX);
  const rightOverflow = Math.max(0, bounds.maxX - (slot.x + slot.width));
  const topOverflow = Math.max(0, slot.y - bounds.minY);
  const bottomOverflow = Math.max(0, bounds.maxY - (slot.y + slot.height));

  let issueLevel = "good";
  let decision = "pass";
  let reason = "runtime loaded and alpha bounds match a visible half-body character";

  if (!bounds.count || nonblankRatio < THRESHOLDS.minNonblankRatio) {
    issueLevel = "missing";
    decision = "fail";
    reason = "blank or nearly blank canvas";
  } else if (bounds.width < THRESHOLDS.minBoundsWidth || bounds.height < THRESHOLDS.minBoundsHeight) {
    issueLevel = "missing";
    decision = "fail";
    reason = "visible alpha bounds are too small to be a complete person";
  } else if (insideRatio < THRESHOLDS.minInsideRatio) {
    issueLevel = "overflow";
    decision = insideRatio < 0.45 ? "fail" : "review";
    reason = "subject bounds are not sufficiently inside the deskpet slot";
  } else if (fillHeightRatio < 0.45 || fillWidthRatio < 0.18) {
    issueLevel = "offset";
    decision = "review";
    reason = "subject is visible but too small for a confident complete-person pass";
  }

  return {
    issueLevel,
    decision,
    reason,
    nonblankRatio,
    insideRatio,
    fillWidthRatio,
    fillHeightRatio,
    leftOverflow,
    rightOverflow,
    topOverflow,
    bottomOverflow,
  };
}

async function advance(app, model, frames = 8) {
  for (let index = 0; index < frames; index += 1) {
    if (typeof model.update === "function") model.update(16);
    app.renderer.render(app.stage);
    await sleep(32);
  }
}

(async () => {
  try {
    const app = new PIXI.Application({
      view: document.getElementById("view"),
      width: 440,
      height: 520,
      transparent: true,
      autoStart: true,
      forceCanvas: false,
      preserveDrawingBuffer: true,
    });
    const options = { autoUpdate: true };
    if (PIXI.live2d?.MotionPreloadStrategy) {
      options.motionPreload = PIXI.live2d.MotionPreloadStrategy.NONE;
    }
    if (!PIXI.live2d || !PIXI.live2d.Live2DModel) {
      throw new Error("Live2D runtime missing: " + JSON.stringify({ pixiVersion: PIXI.VERSION, earlyErrors: window.__earlyErrors }));
    }
    const model = await PIXI.live2d.Live2DModel.from(${JSON.stringify(modelUrl)}, options);
    app.stage.addChild(model);
    const slot = layoutModel(model);
    await advance(app, model, 12);
    const bounds = captureModelBounds(app);
    const probe = evaluateBounds(bounds, slot, app.renderer.width, app.renderer.height);
    const textures = Array.isArray(model.textures) ? model.textures : [];
    const texturePixels = textures.reduce((total, texture) => {
      const base = texture.baseTexture;
      return total + Math.round((base?.width || 0) * (base?.height || 0));
    }, 0);
    app.renderer.render(app.stage);
    window.__result = {
      ok: true,
      canvasWidth: app.renderer.width,
      canvasHeight: app.renderer.height,
      modelWidth: model.width,
      modelHeight: model.height,
      bounds,
      slot,
      textureCount: textures.length,
      texturePixels,
      ...probe,
      screenshotDataUrl: app.renderer.view.toDataURL("image/png"),
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

function localModelUrl(filePath) {
  return `/__fs__${encodeURI(path.resolve(filePath))}`;
}

async function startServer() {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    if (url.pathname === "/test.html") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(pageHtml(url.searchParams.get("model")));
      return;
    }
    if (url.pathname.startsWith("/__repo__/")) {
      const filePath = path.resolve(process.cwd(), decodeURI(url.pathname.slice("/__repo__/".length)));
      if (!filePath.startsWith(process.cwd())) {
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

function resultRow(target, result, durationMs, screenshotPath, screenshotHash, auditedAt) {
  if (!result.ok) {
    return {
      ...target,
      render_status: "failed",
      complete_person_decision: "fail",
      complete_person_reason: "runtime or model load failed",
      canvas_width: "",
      canvas_height: "",
      model_width: "",
      model_height: "",
      nonblank_pixels: 0,
      nonblank_ratio: 0,
      bounds_min_x: 0,
      bounds_min_y: 0,
      bounds_max_x: 0,
      bounds_max_y: 0,
      bounds_width: 0,
      bounds_height: 0,
      slot_x: "",
      slot_y: "",
      slot_width: "",
      slot_height: "",
      bounds_inside_ratio: 0,
      fill_width_ratio: 0,
      fill_height_ratio: 0,
      left_overflow: 0,
      right_overflow: 0,
      top_overflow: 0,
      bottom_overflow: 0,
      issue_level: "load_failed",
      texture_count: "",
      texture_pixels: "",
      render_canvas_sha256: "",
      screenshot_path: "",
      error_stage: result.stage || "load",
      error_message: result.error || "unknown render failure",
      audited_at: auditedAt,
      duration_ms: durationMs,
    };
  }

  return {
    ...target,
    render_status: result.decision === "pass" ? "rendered" : "needs_review",
    complete_person_decision: result.decision,
    complete_person_reason: result.reason,
    canvas_width: result.canvasWidth,
    canvas_height: result.canvasHeight,
    model_width: Math.round(result.modelWidth),
    model_height: Math.round(result.modelHeight),
    nonblank_pixels: result.bounds.count,
    nonblank_ratio: Number(result.nonblankRatio.toFixed(6)),
    bounds_min_x: result.bounds.minX,
    bounds_min_y: result.bounds.minY,
    bounds_max_x: result.bounds.maxX,
    bounds_max_y: result.bounds.maxY,
    bounds_width: result.bounds.width,
    bounds_height: result.bounds.height,
    slot_x: Math.round(result.slot.x),
    slot_y: Math.round(result.slot.y),
    slot_width: Math.round(result.slot.width),
    slot_height: Math.round(result.slot.height),
    bounds_inside_ratio: Number(result.insideRatio.toFixed(6)),
    fill_width_ratio: Number(result.fillWidthRatio.toFixed(6)),
    fill_height_ratio: Number(result.fillHeightRatio.toFixed(6)),
    left_overflow: Math.round(result.leftOverflow),
    right_overflow: Math.round(result.rightOverflow),
    top_overflow: Math.round(result.topOverflow),
    bottom_overflow: Math.round(result.bottomOverflow),
    issue_level: result.issueLevel,
    texture_count: result.textureCount,
    texture_pixels: result.texturePixels,
    render_canvas_sha256: screenshotHash,
    screenshot_path: screenshotPath,
    error_stage: "",
    error_message: "",
    audited_at: auditedAt,
    duration_ms: durationMs,
  };
}

async function auditTarget(page, baseUrl, target, args) {
  const started = performance.now();
  const auditedAt = new Date().toISOString();
  try {
    await fs.access(target.manifest_abs_path);
  } catch {
    return resultRow(
      target,
      { ok: false, stage: "manifest", error: "manifest file missing" },
      Math.round(performance.now() - started),
      "",
      "",
      auditedAt,
    );
  }

  try {
    await page.goto(
      `${baseUrl}/test.html?model=${encodeURIComponent(`${baseUrl}${localModelUrl(target.manifest_abs_path)}`)}`,
      { waitUntil: "networkidle2", timeout: args.timeout },
    );
    await page.waitForFunction("window.__result !== undefined", { timeout: args.timeout });
    const result = await page.evaluate("window.__result");
    let screenshotPath = "";
    let screenshotHash = "";
    if (result.ok && result.screenshotDataUrl) {
      const screenshotBuffer = dataUrlToBuffer(result.screenshotDataUrl);
      screenshotHash = sha256(screenshotBuffer);
      if (args.screenshots) {
        await fs.mkdir(args.screenshotsDir, { recursive: true });
        const absoluteScreenshotPath = path.resolve(args.screenshotsDir, `${target.resource_key}.png`);
        await fs.writeFile(absoluteScreenshotPath, screenshotBuffer);
        screenshotPath = relativePath(absoluteScreenshotPath);
      }
    }
    return resultRow(
      target,
      result,
      Math.round(performance.now() - started),
      screenshotPath,
      screenshotHash,
      auditedAt,
    );
  } catch (error) {
    return resultRow(
      target,
      { ok: false, stage: "driver", error: String(error && (error.stack || error.message || error)) },
      Math.round(performance.now() - started),
      "",
      "",
      auditedAt,
    );
  }
}

async function auditRealPageTarget(page, siteBaseUrl, target, args) {
  const started = performance.now();
  const auditedAt = new Date().toISOString();
  try {
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await page.goto(`${siteBaseUrl}/?deskpet=${encodeURIComponent(target.resource_key)}`, {
      waitUntil: "networkidle2",
      timeout: args.timeout,
    });
    await page.waitForSelector(".deskpet-stage__canvas", { timeout: args.timeout });
    await page.waitForFunction(
      () => {
        const overlay = document.querySelector(".deskpet-overlay");
        return (
          overlay &&
          !overlay.classList.contains("is-booting") &&
          !overlay.classList.contains("is-materializing") &&
          !overlay.classList.contains("has-error")
        );
      },
      { timeout: args.timeout },
    );
    await new Promise((resolve) => setTimeout(resolve, 250));
    const canvasHandle = await page.$(".deskpet-stage__canvas");
    if (!canvasHandle) {
      throw new Error("deskpet stage canvas not found");
    }
    const screenshotBase64 = await canvasHandle.screenshot({ encoding: "base64" });
    const result = await page.evaluate(
      ({ thresholds, screenshotBase64 }) => {
      function alphaBounds(data, width, height, alphaThreshold) {
        let minX = width;
        let minY = height;
        let maxX = -1;
        let maxY = -1;
        let count = 0;
        for (let offset = 3, index = 0; offset < data.length; offset += 4, index += 1) {
          if (data[offset] <= alphaThreshold) continue;
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

      return new Promise((resolve, reject) => {
        const sample = document.createElement("canvas");
        const image = new Image();
        const dataUrl = `data:image/png;base64,${screenshotBase64}`;
        image.onload = () => {
          sample.width = image.width;
          sample.height = image.height;
          const context = sample.getContext("2d");
          context.drawImage(image, 0, 0);
          const imageData = context.getImageData(0, 0, sample.width, sample.height);
          const bounds = alphaBounds(imageData.data, sample.width, sample.height, thresholds.alphaThreshold);
          const slot = { x: 0, y: 0, width: sample.width, height: sample.height };
          const nonblankRatio = bounds.count / Math.max(sample.width * sample.height, 1);
          const insideRatio = bounds.count > 0 ? 1 : 0;
          const fillWidthRatio = bounds.width / Math.max(slot.width, 1);
          const fillHeightRatio = bounds.height / Math.max(slot.height, 1);
          let issueLevel = "good";
          let decision = "pass";
          let reason = "real Astro page rendered a nonblank complete deskpet canvas";
          if (!bounds.count || nonblankRatio < thresholds.minNonblankRatio) {
            issueLevel = "missing";
            decision = "fail";
            reason = "real page canvas is blank or nearly blank";
          } else if (bounds.width < thresholds.minBoundsWidth || bounds.height < thresholds.minBoundsHeight) {
            issueLevel = "missing";
            decision = "fail";
            reason = "real page visible alpha bounds are too small to be a complete person";
          } else if (fillHeightRatio < 0.55 || fillWidthRatio < 0.25) {
            issueLevel = "offset";
            decision = "review";
            reason = "real page rendered the character, but bounds are too small for an automatic complete-person pass";
          }
          resolve({
            ok: true,
            canvasWidth: sample.width,
            canvasHeight: sample.height,
            modelWidth: bounds.width,
            modelHeight: bounds.height,
            bounds,
            slot,
            textureCount: "",
            texturePixels: "",
            issueLevel,
            decision,
            reason,
            nonblankRatio,
            insideRatio,
            fillWidthRatio,
            fillHeightRatio,
            leftOverflow: 0,
            rightOverflow: 0,
            topOverflow: 0,
            bottomOverflow: 0,
            screenshotDataUrl: dataUrl,
          });
        };
        image.onerror = () => reject(new Error("failed to decode canvas screenshot"));
        image.src = dataUrl;
      });
    },
      { thresholds: THRESHOLDS, screenshotBase64 },
    );
    let screenshotPath = "";
    let screenshotHash = "";
    if (result.ok && result.screenshotDataUrl) {
      const screenshotBuffer = dataUrlToBuffer(result.screenshotDataUrl);
      screenshotHash = sha256(screenshotBuffer);
      if (args.screenshots) {
        await fs.mkdir(args.screenshotsDir, { recursive: true });
        const absoluteScreenshotPath = path.resolve(args.screenshotsDir, `${target.resource_key}.png`);
        await fs.writeFile(absoluteScreenshotPath, screenshotBuffer);
        screenshotPath = relativePath(absoluteScreenshotPath);
      }
    }
    return resultRow(
      target,
      result,
      Math.round(performance.now() - started),
      screenshotPath,
      screenshotHash,
      auditedAt,
    );
  } catch (error) {
    return resultRow(
      target,
      { ok: false, stage: "real-page", error: String(error && (error.stack || error.message || error)) },
      Math.round(performance.now() - started),
      "",
      "",
      auditedAt,
    );
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const pool = JSON.parse(await fs.readFile(args.poolPath, "utf8"));
  const match = args.match.toLowerCase();
  const allTargets = modelTargets(pool, args.modelsDir).filter((target) => {
    if (!match) return true;
    return [
      target.resource_key,
      target.model_key,
      target.character_code,
      target.character_name,
      target.variant,
    ].some((value) => String(value).toLowerCase().includes(match));
  });
  const targets = args.limit === null ? allTargets : allTargets.slice(0, args.limit);
  if (targets.length === 0) {
    throw new Error("No current-pool model matched the current filters.");
  }

  const server = args.directProbe ? await startServer() : null;
  const address = server?.address();
  const baseUrl = server ? `http://127.0.0.1:${address.port}` : "";
  const astroServer = args.directProbe ? null : await startAstroServer(args.timeout);
  const chromePath = await findChromePath();
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: args.headed ? false : true,
    args: chromeLaunchArgs(),
    timeout: args.timeout,
    protocolTimeout: args.timeout,
  });

  const rows = [];
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(args.timeout);
    page.setDefaultNavigationTimeout(args.timeout);
    await assertWebglSupport(page, args.timeout);
    for (const [index, target] of targets.entries()) {
      const row = args.directProbe
        ? await auditTarget(page, baseUrl, target, args)
        : await auditRealPageTarget(page, astroServer.baseUrl, target, args);
      rows.push(row);
      console.error(
        `${index + 1}/${targets.length} ${target.resource_key} ${row.complete_person_decision} ${row.issue_level}`,
      );
    }
  } finally {
    await browser.close();
    if (server) server.close();
    if (astroServer) await astroServer.stop();
  }

  const stats = {
    total: rows.length,
    pass: rows.filter((row) => row.complete_person_decision === "pass").length,
    review: rows.filter((row) => row.complete_person_decision === "review").length,
    fail: rows.filter((row) => row.complete_person_decision === "fail").length,
  };
  const payload = {
    generatedAt: new Date().toISOString(),
    script: "scripts/audit_bangdream_render_completeness.mjs",
    scope: "current_pool_only",
    thresholds: THRESHOLDS,
    stats,
    results: rows,
  };

  await fs.mkdir(path.dirname(args.outputCsv), { recursive: true });
  await fs.writeFile(args.outputCsv, csvText(rows), "utf8");
  await fs.mkdir(path.dirname(args.outputJson), { recursive: true });
  await fs.writeFile(args.outputJson, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.error(`Audited ${stats.total} current-pool models: ${stats.pass} pass, ${stats.review} review, ${stats.fail} fail.`);
}

await main();
