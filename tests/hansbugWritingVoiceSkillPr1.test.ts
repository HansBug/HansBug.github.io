import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { createServer } from "node:http";
import type { Socket } from "node:net";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const repoRoot = new URL("..", import.meta.url).pathname;
const skillRoot = join(repoRoot, "agent-skills/hansbug-writing-voice");
const manifestPath = join(skillRoot, "references/sample-manifest.json");
const derivedPath = join(skillRoot, "references/derived/voice-features.json");
const fetchScript = join(skillRoot, "scripts/fetch_voice_corpus.py");
const extractScript = join(skillRoot, "scripts/extract_voice_features.py");

async function runPython(args: string[], cwd = repoRoot) {
  try {
    const result = await execFileAsync("python3", args, {
      cwd,
      maxBuffer: 8 * 1024 * 1024,
    });
    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    const err = error as Error & {
      code?: number;
      stdout?: string;
      stderr?: string;
    };
    return {
      code: err.code ?? 1,
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? "",
    };
  }
}

async function readJson(path: string) {
  return JSON.parse(await readFile(path, "utf8"));
}

describe("HansBug writing voice skill PR-1", () => {
  let fixtureRoot: string | undefined;

  afterEach(async () => {
    if (fixtureRoot) {
      await rm(fixtureRoot, { recursive: true, force: true });
      fixtureRoot = undefined;
    }
  });

  it("defines a four-layer executable sample manifest with required fields", async () => {
    const manifest = await readJson(manifestPath);
    expect(
      manifest.sources.some(
        (source: { id: string; url: string }) =>
          source.id === "cnblogs-14748624" || source.url.includes("/14748624.html"),
      ),
    ).toBe(false);
    expect(manifest.schemaVersion).toBe(2);
    expect(manifest.stage).toBe("pr-1-sample-manifest");
    expect(manifest.description).toContain("中文博客文风");
    expect(manifest.description).toContain("不提交旧博客完整正文");

    const sources = manifest.sources as Array<Record<string, unknown>>;
    expect(sources.length).toBeGreaterThanOrEqual(50);
    const roles = new Map<string, number>();
    for (const source of sources) {
      for (const field of [
        "id",
        "title",
        "url",
        "year",
        "articleType",
        "sampleRole",
        "useFor",
        "participatesInProfile",
        "holdoutForDryRun",
        "cacheKey",
        "sourceSelector",
        "notes",
      ]) {
        expect(
          source,
          `missing ${field} in ${JSON.stringify(source)}`,
        ).toHaveProperty(field);
      }
      expect(source.sourceSelector).toBe("#cnblogs_post_body");
      expect(String(source.notes)).toMatch(/[\u4e00-\u9fff]/);
      roles.set(
        String(source.sampleRole),
        (roles.get(String(source.sampleRole)) ?? 0) + 1,
      );
    }

    expect(roles.get("core")).toBeGreaterThanOrEqual(10);
    expect(roles.get("statistical")).toBeGreaterThanOrEqual(40);
    expect(roles.get("negative")).toBeGreaterThanOrEqual(1);
    expect(roles.get("holdout")).toBeGreaterThanOrEqual(2);
  });

  it("keeps the CLAUDE.md core ten old posts in core samples", async () => {
    const manifest = await readJson(manifestPath);
    const coreTitles = new Set(
      manifest.sources
        .filter(
          (source: { sampleRole: string }) => source.sampleRole === "core",
        )
        .map((source: { title: string }) => source.title),
    );

    for (const title of [
      "【技巧】Java工程中的Debug信息分级输出接口及部署模式",
      "【作业】HansBug的前三次OO作业分析与小结",
      "【作业2.0】HansBug的5-7次OO作业分析与小结，以及一些个人体会",
      "【学习笔记】Latex各平台2020实战攻略",
      "【开源系列】项目开源实战记录-序",
      "【助教工作】2021团队项目助教跟班全攻略",
      "【项目管理】关于Issue/Milestone的使用指导",
      "沉舟侧畔千帆过，病树前头万木春——对【题士】产品的深度测评与解析",
      "姗姗来迟的一个总结",
      "treevalue——Master Nested Data Like Tensor",
    ]) {
      expect(coreTitles.has(title), title).toBe(true);
    }
  });

  it("marks holdout and negative samples outside profile derivation", async () => {
    const manifest = await readJson(manifestPath);
    const holdouts = manifest.sources.filter(
      (source: { holdoutForDryRun: boolean }) => source.holdoutForDryRun,
    );
    expect(holdouts.length).toBeGreaterThanOrEqual(2);
    for (const source of holdouts) {
      expect(source.sampleRole).toBe("holdout");
      expect(source.participatesInProfile).toBe(false);
    }

    const negative = manifest.sources.filter(
      (source: { sampleRole: string }) => source.sampleRole === "negative",
    );
    expect(negative.length).toBeGreaterThanOrEqual(1);
    for (const source of negative) {
      expect(source.participatesInProfile).toBe(false);
      expect(source.useFor).toContain("anti-pattern-boundary");
      expect(String(source.notes)).toMatch(/反例|边界|不应学习|不要/);
    }
  });

  it("provides Chinese CLI help for fetch and extract scripts", async () => {
    const fetchHelp = await runPython([fetchScript, "--help"]);
    expect(fetchHelp.code).toBe(0);
    expect(fetchHelp.stdout).toContain("完整正文只写入");
    expect(fetchHelp.stdout).toContain("--dry-run");
    expect(fetchHelp.stdout).toContain("--user-agent");
    expect(fetchHelp.stdout).toContain("--source-timeout");

    const extractHelp = await runPython([extractScript, "--help"]);
    expect(extractHelp.code).toBe(0);
    expect(extractHelp.stdout).toContain("机械统计特征");
    expect(extractHelp.stdout).toContain("--write-derived");
    expect(extractHelp.stdout).toContain("--allow-catalog-summary");
  });

  it("dry-runs fetch plans without creating cache files", async () => {
    fixtureRoot = await mkdtemp(join(tmpdir(), "hansbug-voice-pr1-"));
    const cacheDir = join(fixtureRoot, "cache");
    const result = await runPython([
      fetchScript,
      "--manifest",
      manifestPath,
      "--cache-dir",
      cacheDir,
      "--limit",
      "2",
      "--dry-run",
    ]);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("DRY-RUN");
    expect(result.stdout).toContain("将处理 2 篇样本");
    await expect(
      readFile(join(cacheDir, "cnblogs-8701447.txt"), "utf8"),
    ).rejects.toThrow();
  });

  it("fails fast for malformed manifest items with a clear Chinese error", async () => {
    fixtureRoot = await mkdtemp(join(tmpdir(), "hansbug-voice-pr1-"));
    const badManifest = join(fixtureRoot, "bad-manifest.json");
    await writeFile(
      badManifest,
      JSON.stringify(
        {
          sources: [
            {
              id: "bad-one",
              title: "坏样本",
              url: "https://example.invalid/post.html",
              year: 2026,
              articleType: "technical-practice",
              sampleRole: "core",
              useFor: ["macro-logic"],
              participatesInProfile: true,
              holdoutForDryRun: false,
              cacheKey: "bad-one",
              notes: "故意缺少 sourceSelector。",
            },
          ],
          excerpts: [],
        },
        null,
        2,
      ),
    );

    const result = await runPython([
      fetchScript,
      "--manifest",
      badManifest,
      "--dry-run",
    ]);

    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain("缺少字段");
    expect(result.stderr).toContain("sourceSelector");
    expect(result.stderr).not.toContain("Traceback");
  });

  it("rejects invalid cacheKey before dry-run prints a partial fetch plan", async () => {
    fixtureRoot = await mkdtemp(join(tmpdir(), "hansbug-voice-pr1-"));
    const badManifest = join(fixtureRoot, "bad-cachekey-manifest.json");
    await writeFile(
      badManifest,
      JSON.stringify(
        {
          sources: [
            {
              id: "bad-cachekey",
              title: "坏 cacheKey 样本",
              url: "https://example.invalid/post.html",
              year: 2026,
              articleType: "technical-practice",
              sampleRole: "core",
              useFor: ["macro-logic"],
              participatesInProfile: true,
              holdoutForDryRun: false,
              cacheKey: "bad/key",
              sourceSelector: "#cnblogs_post_body",
              notes: "用于确认 dry-run 不输出半截计划。",
            },
          ],
          excerpts: [],
        },
        null,
        2,
      ),
    );

    const result = await runPython([
      fetchScript,
      "--manifest",
      badManifest,
      "--dry-run",
    ]);

    expect(result.code).not.toBe(0);
    expect(result.stdout).not.toContain("DRY-RUN");
    expect(result.stderr).toContain("cacheKey 只能包含");
    expect(result.stderr).not.toContain("Traceback");
  });

  it("keeps fetch cache target paths inside the selected cache directory", async () => {
    fixtureRoot = await mkdtemp(join(tmpdir(), "hansbug-voice-pr1-"));
    const htmlPath = join(fixtureRoot, "post.html");
    await writeFile(
      htmlPath,
      `<html><body><article id="cnblogs_post_body"><p>首先，这是一段足够长的 fixture 正文，用来确认 fetch 不会沿着 cache 目录里的符号链接写到目录外面。换句话说，这里验证的是 cache target 的 resolve 防御。</p></article></body></html>`,
    );
    const manifest = join(fixtureRoot, "manifest-symlink.json");
    await writeFile(
      manifest,
      JSON.stringify(
        {
          sources: [
            {
              id: "symlink-target",
              title: "symlink fixture",
              url: htmlPath,
              year: 2026,
              articleType: "technical-practice",
              sampleRole: "core",
              useFor: ["macro-logic"],
              participatesInProfile: true,
              holdoutForDryRun: false,
              cacheKey: "evil",
              sourceSelector: "#cnblogs_post_body",
              notes: "用于验证 fetch cache target 不会越界。",
            },
          ],
          excerpts: [],
        },
        null,
        2,
      ),
    );
    const cacheDir = join(fixtureRoot, "cache");
    await mkdir(cacheDir, { recursive: true });
    await writeFile(
      join(fixtureRoot, "outside.txt"),
      "原内容不应被覆盖。",
      "utf8",
    );
    await symlink(join(fixtureRoot, "outside.txt"), join(cacheDir, "evil.txt"));

    const result = await runPython([
      fetchScript,
      "--manifest",
      manifest,
      "--cache-dir",
      cacheDir,
      "--min-chars",
      "20",
      "--delay",
      "0",
    ]);

    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain("cacheKey 指向 cache 目录之外");
    expect(result.stderr).not.toContain("Traceback");
    await expect(
      readFile(join(fixtureRoot, "outside.txt"), "utf8"),
    ).resolves.toBe("原内容不应被覆盖。");
  });

  it("retries broken chunked responses and reports a Chinese error without traceback", async () => {
    fixtureRoot = await mkdtemp(join(tmpdir(), "hansbug-voice-pr1-"));
    let requestCount = 0;
    const server = createServer((_request, response) => {
      requestCount += 1;
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Transfer-Encoding": "chunked",
      });
      response.write(
        `<html><body><article id="cnblogs_post_body"><p>首先，这是一段故意被截断的 chunked fixture，用来模拟博客园偶发的 IncompleteRead 网络断流。</p>`,
      );
      response.socket?.destroy();
    });
    try {
      await new Promise<void>((resolve) =>
        server.listen(0, "127.0.0.1", resolve),
      );
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("unexpected test server address");
      }
      const manifest = join(fixtureRoot, "manifest-broken-chunk.json");
      await writeFile(
        manifest,
        JSON.stringify(
          {
            sources: [
              {
                id: "broken-chunk",
                title: "断流 fixture",
                url: `http://127.0.0.1:${address.port}/broken.html`,
                year: 2026,
                articleType: "technical-practice",
                sampleRole: "core",
                useFor: ["macro-logic"],
                participatesInProfile: true,
                holdoutForDryRun: false,
                cacheKey: "broken-chunk",
                sourceSelector: "#cnblogs_post_body",
                notes: "用于测试 chunked 断流时进入重试和中文错误路径。",
              },
            ],
            excerpts: [],
          },
          null,
          2,
        ),
      );

      const result = await runPython([
        fetchScript,
        "--manifest",
        manifest,
        "--cache-dir",
        join(fixtureRoot, "cache"),
        "--delay",
        "0",
        "--max-retries",
        "2",
        "--retry-backoff",
        "0",
      ]);

      expect(result.code).not.toBe(0);
      expect(requestCount).toBe(3);
      expect(result.stderr).toContain("抓取失败：broken-chunk");
      expect(result.stderr).toMatch(/网络读取异常|IncompleteRead|RemoteDisconnected/);
      expect(result.stderr).not.toContain("Traceback");
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it("aborts a slow endless response with per-source timeout instead of hanging", async () => {
    fixtureRoot = await mkdtemp(join(tmpdir(), "hansbug-voice-pr1-"));
    let requestCount = 0;
    const sockets = new Set<Socket>();
    const intervals: NodeJS.Timeout[] = [];
    const server = createServer((_request, response) => {
      requestCount += 1;
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Transfer-Encoding": "chunked",
      });
      response.write(
        `<html><body><article id="cnblogs_post_body"><p>首先，这是一段永远不会正常结束的慢响应 fixture，用来证明单篇 deadline 会切断卡住的旧博客抓取。</p>`,
      );
      intervals.push(setInterval(() => response.write(" "), 50));
    });
    server.on("connection", (socket) => {
      sockets.add(socket);
      socket.on("close", () => sockets.delete(socket));
    });
    try {
      await new Promise<void>((resolve) =>
        server.listen(0, "127.0.0.1", resolve),
      );
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("unexpected test server address");
      }
      const manifest = join(fixtureRoot, "manifest-slow-endless.json");
      await writeFile(
        manifest,
        JSON.stringify(
          {
            sources: [
              {
                id: "slow-endless",
                title: "慢响应 fixture",
                url: `http://127.0.0.1:${address.port}/slow.html`,
                year: 2026,
                articleType: "technical-practice",
                sampleRole: "core",
                useFor: ["macro-logic"],
                participatesInProfile: true,
                holdoutForDryRun: false,
                cacheKey: "slow-endless",
                sourceSelector: "#cnblogs_post_body",
                notes: "用于测试单篇整体超时。",
              },
            ],
            excerpts: [],
          },
          null,
          2,
        ),
      );

      const result = await runPython([
        fetchScript,
        "--manifest",
        manifest,
        "--cache-dir",
        join(fixtureRoot, "cache"),
        "--delay",
        "0",
        "--timeout",
        "5",
        "--source-timeout",
        "0.5",
        "--max-retries",
        "2",
        "--retry-backoff",
        "0",
      ]);

      expect(result.code).not.toBe(0);
      expect(requestCount).toBe(3);
      expect(result.stderr).toContain("抓取失败：slow-endless");
      expect(result.stderr).toContain("单篇抓取超时：slow-endless");
      expect(result.stderr).not.toContain("Traceback");
    } finally {
      for (const interval of intervals) clearInterval(interval);
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it("fails fast on abnormal HTTP status without retrying or printing a Python traceback", async () => {
    fixtureRoot = await mkdtemp(join(tmpdir(), "hansbug-voice-pr1-"));
    let requestCount = 0;
    const server = createServer((_request, response) => {
      requestCount += 1;
      response.statusCode = 404;
      response.end("missing");
    });
    try {
      await new Promise<void>((resolve) =>
        server.listen(0, "127.0.0.1", resolve),
      );
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("unexpected test server address");
      }
      const manifest = join(fixtureRoot, "manifest-http-404.json");
      await writeFile(
        manifest,
        JSON.stringify(
          {
            sources: [
              {
                id: "http-404",
                title: "404 fixture",
                url: `http://127.0.0.1:${address.port}/missing.html`,
                year: 2026,
                articleType: "technical-practice",
                sampleRole: "core",
                useFor: ["macro-logic"],
                participatesInProfile: true,
                holdoutForDryRun: false,
                cacheKey: "http-404",
                sourceSelector: "#cnblogs_post_body",
                notes: "用于测试 HTTP 状态码异常时的 fail-fast。",
              },
            ],
            excerpts: [],
          },
          null,
          2,
        ),
      );

      const result = await runPython([
        fetchScript,
        "--manifest",
        manifest,
        "--cache-dir",
        join(fixtureRoot, "cache"),
        "--delay",
        "0",
        "--max-retries",
        "3",
        "--retry-backoff",
        "0",
      ]);

      expect(result.code).not.toBe(0);
      expect(requestCount).toBe(1);
      expect(result.stderr).toContain("HTTP 状态码异常：404");
      expect(result.stderr).not.toContain("Traceback");
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it("extracts selected HTML into ignored cache and reports selector failures", async () => {
    fixtureRoot = await mkdtemp(join(tmpdir(), "hansbug-voice-pr1-"));
    const htmlPath = join(fixtureRoot, "post.html");
    await writeFile(
      htmlPath,
      `<html><body><article id="cnblogs_post_body"><h2>写在前面</h2><p>首先，笔者在这里放一段测试正文，用来模拟旧博客文章的正文区域。</p><p>换句话说，这不是文风画像，只是抓取脚本的 selector 验证。</p></article></body></html>`,
    );
    const manifest = join(fixtureRoot, "manifest.json");
    await writeFile(
      manifest,
      JSON.stringify(
        {
          sources: [
            {
              id: "fixture-post",
              title: "fixture 文章",
              url: htmlPath,
              year: 2026,
              articleType: "technical-practice",
              sampleRole: "core",
              useFor: ["macro-logic"],
              participatesInProfile: true,
              holdoutForDryRun: false,
              cacheKey: "fixture-post",
              sourceSelector: "#cnblogs_post_body",
              notes: "用于测试 selector 命中后的 cache 写入。",
            },
          ],
          excerpts: [],
        },
        null,
        2,
      ),
    );
    const cacheDir = join(fixtureRoot, "cache");

    const ok = await runPython([
      fetchScript,
      "--manifest",
      manifest,
      "--cache-dir",
      cacheDir,
      "--min-chars",
      "20",
      "--delay",
      "0",
    ]);
    expect(ok.code).toBe(0);
    expect(ok.stdout).toContain("fixture-post");
    const cached = await readFile(join(cacheDir, "fixture-post.txt"), "utf8");
    expect(cached).toContain("写在前面");
    expect(cached).toContain("换句话说");

    const brokenManifest = JSON.parse(await readFile(manifest, "utf8"));
    brokenManifest.sources[0].sourceSelector = "#missing";
    await writeFile(manifest, JSON.stringify(brokenManifest, null, 2));
    const bad = await runPython([
      fetchScript,
      "--manifest",
      manifest,
      "--cache-dir",
      cacheDir,
      "--min-chars",
      "20",
      "--delay",
      "0",
    ]);
    expect(bad.code).not.toBe(0);
    expect(bad.stderr).toContain("selector 未命中");
    expect(bad.stderr).not.toContain("Traceback");
  });

  it("generates non-empty mechanical features from a local fixture cache", async () => {
    fixtureRoot = await mkdtemp(join(tmpdir(), "hansbug-voice-pr1-"));
    const cacheDir = join(fixtureRoot, "cache");
    await mkdir(cacheDir, { recursive: true });
    await writeFile(
      join(cacheDir, "fixture-post.txt"),
      [
        "# 写在前面",
        "首先，笔者这里用一个较短的 fixture 来模拟 HansBug 文章的开头。",
        "",
        "## 为什么这事不能糊弄",
        "具体来说，这段文本需要有段落、有句子，也要有一点转场词。换句话说，它只服务机械统计，不服务语义画像。",
      ].join("\n"),
    );
    const manifest = join(fixtureRoot, "manifest.json");
    await writeFile(
      manifest,
      JSON.stringify(
        {
          sources: [
            {
              id: "fixture-post",
              title: "fixture 文章",
              url: "https://example.invalid/fixture-post.html",
              year: 2026,
              articleType: "technical-practice",
              sampleRole: "core",
              useFor: ["macro-logic"],
              participatesInProfile: true,
              holdoutForDryRun: false,
              cacheKey: "fixture-post",
              sourceSelector: "#cnblogs_post_body",
              notes: "用于测试 fixture 到 features 的非空路径。",
            },
          ],
          excerpts: [],
        },
        null,
        2,
      ),
    );

    const result = await runPython([
      extractScript,
      "--manifest",
      manifest,
      "--cache-dir",
      cacheDir,
    ]);

    expect(result.code).toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(payload.schemaVersion).toBe(1);
    expect(payload.sampleIds).toEqual(["fixture-post"]);
    expect(payload.features.sampleCount).toBe(1);
    expect(payload.features.paragraphLength.stats.count).toBeGreaterThan(0);
    expect(payload.features.sentenceLength.stats.count).toBeGreaterThan(0);
    expect(payload.features.headingPatterns["markdown-h1"]).toBe(1);
    expect(
      payload.features.transitionTerms.some(
        (item: { term: string; count: number }) =>
          item.term === "首先" && item.count === 1,
      ),
    ).toBe(true);
  });

  it("keeps extract cacheKey reads inside the selected cache directory", async () => {
    fixtureRoot = await mkdtemp(join(tmpdir(), "hansbug-voice-pr1-"));
    const cacheDir = join(fixtureRoot, "cache");
    await mkdir(cacheDir, { recursive: true });
    await writeFile(
      join(fixtureRoot, "outside.txt"),
      "首先，这段文本不在 cache 目录内，不能被 cacheKey 越界读取。\n",
    );
    const manifest = join(fixtureRoot, "manifest-escape.json");
    await writeFile(
      manifest,
      JSON.stringify(
        {
          sources: [
            {
              id: "escape",
              title: "越界 fixture",
              url: "https://example.invalid/escape.html",
              year: 2026,
              articleType: "technical-practice",
              sampleRole: "core",
              useFor: ["macro-logic"],
              participatesInProfile: true,
              holdoutForDryRun: false,
              cacheKey: "../outside",
              sourceSelector: "#cnblogs_post_body",
              notes: "用于验证 extract 是否限制 cacheKey。",
            },
          ],
          excerpts: [],
        },
        null,
        2,
      ),
    );

    const result = await runPython([
      extractScript,
      "--manifest",
      manifest,
      "--cache-dir",
      cacheDir,
    ]);

    expect(result.code).not.toBe(0);
    expect(result.stdout).not.toContain("outside");
    expect(result.stderr).toContain("cacheKey 只能包含");
    expect(result.stderr).not.toContain("Traceback");
  });

  it("keeps derived voice features schema stable and excludes holdout samples by default", async () => {
    const derived = await readJson(derivedPath);
    expect(derived.schemaVersion).toBe(1);
    expect(derived.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(derived.manifest).toBe(
      "agent-skills/hansbug-writing-voice/references/sample-manifest.json",
    );
    expect(Array.isArray(derived.sampleIds)).toBe(true);
    expect(derived.sampleIds.length).toBeGreaterThanOrEqual(50);
    expect(derived.features.sampleCount).toBe(derived.sampleIds.length);
    expect(derived.features.paragraphLength.stats.count).toBeGreaterThan(0);
    expect(derived.features.sentenceLength.stats.count).toBeGreaterThan(0);
    expect(derived.features.topNgrams.char2.length).toBeGreaterThan(0);
    expect(derived.limitations.join("\n")).toContain("机械统计");

    const manifest = await readJson(manifestPath);
    const holdoutIds = new Set(
      manifest.sources
        .filter(
          (source: { holdoutForDryRun: boolean }) => source.holdoutForDryRun,
        )
        .map((source: { id: string }) => source.id),
    );
    for (const id of holdoutIds) {
      expect(derived.sampleIds).not.toContain(id);
    }
  });

  it("does not overwrite derived output unless --write-derived is explicit", async () => {
    fixtureRoot = await mkdtemp(join(tmpdir(), "hansbug-voice-pr1-"));
    const outputPath = join(fixtureRoot, "voice-features.json");
    const result = await runPython([
      extractScript,
      "--manifest",
      manifestPath,
      "--allow-catalog-summary",
      "--output",
      outputPath,
      "--id",
      "cnblogs-8701447",
    ]);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("cnblogs-8701447");
    await expect(readFile(outputPath, "utf8")).rejects.toThrow();

    const writeResult = await runPython([
      extractScript,
      "--manifest",
      manifestPath,
      "--allow-catalog-summary",
      "--output",
      outputPath,
      "--id",
      "cnblogs-8701447",
      "--write-derived",
    ]);
    expect(writeResult.code).toBe(0);
    expect(writeResult.stdout).toContain("已写入");
    const written = JSON.parse(await readFile(outputPath, "utf8"));
    expect(written.sampleIds).toEqual(["cnblogs-8701447"]);
  });

  it("reports derived write errors as clear Chinese messages", async () => {
    fixtureRoot = await mkdtemp(join(tmpdir(), "hansbug-voice-pr1-"));
    const outputDir = join(fixtureRoot, "output-is-directory.json");
    await mkdir(outputDir, { recursive: true });

    const result = await runPython([
      extractScript,
      "--manifest",
      manifestPath,
      "--allow-catalog-summary",
      "--output",
      outputDir,
      "--id",
      "cnblogs-8701447",
      "--write-derived",
    ]);

    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain("无法写入派生特征文件");
    expect(result.stderr).not.toContain("Traceback");
  });

  it("documents PR-1 scripts in the skill entry and corpus policy", async () => {
    const skill = await readFile(join(skillRoot, "SKILL.md"), "utf8");
    expect(skill).toContain("fetch_voice_corpus.py");
    expect(skill).toContain("extract_voice_features.py");
    expect(skill).toContain("--write-derived");
    expect(skill).toContain("机械统计");

    const policy = await readFile(
      join(skillRoot, "references/corpus-policy.md"),
      "utf8",
    );
    expect(policy).toContain("PR-1 脚本边界");
    expect(policy).toContain("fetch_voice_corpus.py");
    expect(policy).toContain("extract_voice_features.py");
    expect(policy).toContain(".cache/hansbug-writing-voice/corpus/");
  });
});
