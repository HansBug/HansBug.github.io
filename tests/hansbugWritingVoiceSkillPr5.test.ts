import { lstat, readFile, readdir, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = new URL("..", import.meta.url).pathname;
const skillRoot = join(repoRoot, "agent-skills/hansbug-writing-voice");
const dryRunsRoot = join(skillRoot, "dry-runs");
const agentsPath = join(repoRoot, "AGENTS.md");
const requiredFiles = [
  "input.md",
  "prompt.md",
  "command.md",
  "result.json",
  "exit-code.txt",
  "stdout.log",
  "stderr.log",
  "draft.md",
  "review.md",
  "revision.md",
];
const expectedMatrix = [
  ["conceive", "codex"],
  ["conceive", "claude"],
  ["write", "codex"],
  ["write", "claude"],
  ["rewrite", "codex"],
  ["rewrite", "claude"],
  ["review", "codex"],
  ["review", "claude"],
  ["fix-ai-cliche", "codex"],
  ["fix-ai-cliche", "claude"],
  ["fact-gap", "codex"],
  ["fact-gap", "claude"],
] as const;
const expectedMatrixSlugs = expectedMatrix.map(([task, cli]) => `${task}-${cli}-001`);
const rewriteMarkers = ["官方文档", "资料", "步骤如下", "功能说明", "参数"];
const aiClicheMarkers = ["总体而言", "值得注意的是", "可以看出", "咳咳", "好吧", "高口癖密度", "低判断密度", "无边界"];
const forbiddenOldBlogFullTextMarkers = [
  "<div id=\"cnblogs_post_body\"",
  "<div class=\"cnblogs_post_body\"",
];

type DryRunResult = {
  schemaVersion: number;
  taskSlug: string;
  taskType: string;
  cli: "codex" | "claude";
  command: string;
  exitCode: number;
  status: "pass" | "fail";
  role: "matrix" | "failure-evidence";
  independentEntryOnly?: boolean;
  usedEntryPoints: string[];
  usedReferences: string[];
  check: {
    applicable: boolean;
    exitCode: number;
    status: "pass" | "fail" | "skipped";
    blockingFindings: number;
    importantFindings: number;
    minorFindings: number;
    checkSkipReason?: string;
  };
  review: {
    critical: number;
    important: number;
    minor: number;
  };
  parseIssues?: string[];
  notes?: string;
};

async function read(path: string) {
  return readFile(path, "utf8");
}

async function existsFile(path: string) {
  try {
    const fileStat = await stat(path);
    return fileStat.isFile();
  } catch {
    return false;
  }
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await read(path)) as T;
}

function sha256(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

function hasAny(text: string, markers: string[]) {
  return markers.some((marker) => text.includes(marker));
}

function parseReviewCounts(text: string) {
  const normalized = text.replace(/[：:]/g, "=");
  const readLast = (label: "C" | "I" | "M") => {
    const matches = [...normalized.matchAll(new RegExp(`(?:^|[^A-Za-z])${label}\\s*=\\s*(\\d+)`, "gim"))];
    if (matches.length === 0) return null;
    return Number(matches[matches.length - 1][1]);
  };
  return {
    critical: readLast("C"),
    important: readLast("I"),
    minor: readLast("M"),
  };
}

describe("HansBug writing voice skill PR-5 dry-runs", () => {
  it("keeps AGENTS.md as the CLAUDE.md symlink while adding dry-run guidance", async () => {
    const link = await lstat(agentsPath);
    expect(link.isSymbolicLink()).toBe(true);
    const readme = await read(join(dryRunsRoot, "README.md"));
    for (const marker of ["真实 CLI forward-test", "matrix", "failure-evidence", "C/I/M", "失败样本", "codex exec", "claude -p"]) {
      expect(readme).toContain(marker);
    }
  });

  it("keeps the runner from silently normalizing failed CLI output into pass evidence", async () => {
    const runner = await read(join(skillRoot, "scripts/run_forward_tests.py"));
    expect(runner).toContain("parse_review_counts");
    expect(runner).toContain("draft/review/revision 仅从 stdout 标准三段切分");
    for (const forbidden of [
      "sanitize_for_mechanical_gate",
      "normalize_for_check",
      "ensure_minimal_draft",
      "空泛套话",
      "本文解决的是仓库维护文本和脚本失败路径的表达问题",
    ]) {
      expect(runner).not.toContain(forbidden);
    }
  });

  it("contains the full 6 by 2 matrix with pass matrix results", async () => {
    const entries = await readdir(dryRunsRoot, { withFileTypes: true });
    const dirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);

    for (const slug of expectedMatrixSlugs) {
      expect(dirs, `missing ${slug}`).toContain(slug);
    }

    const matrixResults: DryRunResult[] = [];
    for (const slug of dirs) {
      const resultPath = join(dryRunsRoot, slug, "result.json");
      if (await existsFile(resultPath)) {
        const result = await readJson<DryRunResult>(resultPath);
        if (result.role === "matrix") matrixResults.push(result);
      }
    }

    expect(matrixResults).toHaveLength(12);
    for (const [taskType, cli] of expectedMatrix) {
      const matching = matrixResults.filter((result) => result.taskType === taskType && result.cli === cli);
      expect(matching, `${taskType}/${cli}`).toHaveLength(1);
      expect(matching[0].taskSlug).toBe(`${taskType}-${cli}-001`);
      expect(matching[0].status).toBe("pass");
      expect(matching[0].exitCode).toBe(0);
      expect(matching[0].review.critical).toBe(0);
      expect(matching[0].review.important).toBe(0);
      expect(matching[0].parseIssues ?? []).toHaveLength(0);
    }
  });

  it("keeps every dry-run directory reproducible and linked to real commands", async () => {
    for (const slug of expectedMatrixSlugs) {
      const dir = join(dryRunsRoot, slug);
      for (const file of requiredFiles) {
        expect(await existsFile(join(dir, file)), `${slug}/${file}`).toBe(true);
      }

      const result = await readJson<DryRunResult>(join(dir, "result.json"));
      const command = await read(join(dir, "command.md"));
      const prompt = await read(join(dir, "prompt.md"));
      const stdout = await read(join(dir, "stdout.log"));
      const exitCode = (await read(join(dir, "exit-code.txt"))).trim();

      expect(result.schemaVersion).toBe(1);
      expect(result.taskSlug).toBe(slug);
      expect(result.role).toBe("matrix");
      expect(exitCode).toBe(String(result.exitCode));
      expect(stdout.length, `${slug} stdout too short`).toBeGreaterThanOrEqual(200);
      expect(command).toContain(result.cli === "codex" ? "codex exec" : "claude -p");
      expect(result.command).toContain(result.cli === "codex" ? "codex exec" : "claude -p");
      expect(prompt + stdout).toContain("CLAUDE.md");
      expect(prompt + stdout).toContain("agent-skills/hansbug-writing-voice/SKILL.md");
      expect(result.usedEntryPoints).toContain("CLAUDE.md");
      expect(result.usedEntryPoints).toContain("agent-skills/hansbug-writing-voice/SKILL.md");
      expect(result.usedReferences.length).toBeGreaterThan(0);

      const review = await read(join(dir, "review.md"));
      const parsedReview = parseReviewCounts(review);
      expect(parsedReview.critical, `${slug} review critical`).toBe(result.review.critical);
      expect(parsedReview.important, `${slug} review important`).toBe(result.review.important);
      expect(parsedReview.minor, `${slug} review minor`).toBe(result.review.minor);
      expect(result.notes ?? "").toContain("不做正文补写、关键词替换或静默修复");

      if (result.check.applicable) {
        expect(result.check.exitCode).toBe(0);
        expect(result.check.status).toBe("pass");
        expect(result.check.blockingFindings).toBe(0);
      } else {
        expect(`${result.check.checkSkipReason ?? ""}${result.notes ?? ""}`.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("keeps human review artifacts non-empty without generic placeholders", async () => {
    for (const slug of expectedMatrixSlugs) {
      for (const file of ["draft.md", "review.md", "revision.md"]) {
        const text = await read(join(dryRunsRoot, slug, file));
        expect(text.trim().length, `${slug}/${file}`).toBeGreaterThan(80);
        if (!slug.startsWith("fact-gap-")) {
          expect(text).not.toContain("TODO");
          expect(text).not.toContain("待补充");
        }
      }
    }
  });

  it("separates rewrite and reverse-pressure inputs mechanically", async () => {
    for (const cli of ["codex", "claude"] as const) {
      const rewrite = await read(join(dryRunsRoot, `rewrite-${cli}-001`, "input.md"));
      const fix = await read(join(dryRunsRoot, `fix-ai-cliche-${cli}-001`, "input.md"));
      expect(sha256(rewrite)).not.toBe(sha256(fix));
      expect(hasAny(rewrite, rewriteMarkers), `rewrite ${cli} markers`).toBe(true);
      expect(hasAny(fix, aiClicheMarkers), `fix-ai-cliche ${cli} markers`).toBe(true);
    }
  });

  it("records the independent-entry-only run and failure-evidence policy", async () => {
    const readme = await read(join(dryRunsRoot, "README.md"));
    const results = await Promise.all(
      expectedMatrixSlugs.map((slug) => readJson<DryRunResult>(join(dryRunsRoot, slug, "result.json"))),
    );
    const independent = results.filter((result) => result.independentEntryOnly === true);
    expect(independent.length).toBeGreaterThanOrEqual(1);
    for (const result of independent) {
      const prompt = await read(join(dryRunsRoot, result.taskSlug, "prompt.md"));
      expect(prompt).toContain("CLAUDE.md");
      expect(prompt).toContain("agent-skills/hansbug-writing-voice/SKILL.md");
      expect(prompt).not.toContain("审阅反馈如下");
      expect(prompt).not.toContain("参考答案如下");
      expect(prompt).not.toContain("预期输出如下");
    }
    expect(readme).toContain("failure-evidence");
    expect(readme).toContain("如果本 PR 没有失败证据目录");
  });

  it("does not commit old blog full text or cache artifacts into dry-runs", async () => {
    const entries = await readdir(dryRunsRoot, { recursive: true, withFileTypes: true });
    for (const entry of entries) {
      const path = join(entry.parentPath ?? dryRunsRoot, entry.name);
      expect(path).not.toContain(".cache/hansbug-writing-voice/corpus");
      if (!entry.isFile()) continue;
      const text = await read(path);
      for (const marker of forbiddenOldBlogFullTextMarkers) {
        expect(text, `${path} contains ${marker}`).not.toContain(marker);
      }
    }
  });
});
