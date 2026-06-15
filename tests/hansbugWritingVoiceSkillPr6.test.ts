import { lstat, readFile, readdir, readlink, stat } from "node:fs/promises";
import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const repoRoot = new URL("..", import.meta.url).pathname;
const skillRoot = join(repoRoot, "agent-skills/hansbug-writing-voice");
const referencesRoot = join(skillRoot, "references");
const scriptsRoot = join(skillRoot, "scripts");
const dryRunsRoot = join(skillRoot, "dry-runs");
const acceptanceRoot = join(skillRoot, "acceptance-runs");
const finalReportPath = join(skillRoot, "final-acceptance-report.md");

const requiredReferences = [
  "corpus-policy.md",
  "sample-manifest.json",
  "voice-profile.md",
  "article-archetypes.md",
  "micro-patterns.md",
  "macro-logic.md",
  "anti-patterns.md",
  "review-rubric.md",
  "prompt-recipes.md",
  "derived/voice-features.json",
];

const requiredScripts = [
  "lint_voice_references.py",
  "fetch_voice_corpus.py",
  "extract_voice_features.py",
  "check_hansbug_voice.py",
  "run_forward_tests.py",
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
const writingMatrixSlugs = expectedMatrixSlugs.filter((slug) =>
  /^(write|rewrite|fix-ai-cliche)-/.test(slug),
);
const expectedFailureSlugs = [
  "write-claude-failed-001",
  "rewrite-claude-failed-001",
  "fix-ai-cliche-claude-failed-001",
];
const acceptanceSlugs = ["pr6-codex-final-smoke", "pr6-claude-final-smoke"];
const acceptanceFiles = [
  "prompt.md",
  "command.md",
  "stdout.log",
  "stderr.log",
  "exit-code.txt",
  "result.json",
];
const forbiddenOldBlogFullTextMarkers = [
  '<div id="cnblogs_post_body"',
  '<div class="cnblogs_post_body"',
];

type RunResult = {
  schemaVersion: number;
  taskSlug: string;
  taskType: string;
  cli: "codex" | "claude";
  command: string;
  exitCode: number;
  status: "pass" | "fail";
  role: string;
  usedEntryPoints: string[];
  usedReferences: string[];
  check?: {
    applicable: boolean;
    exitCode: number;
    status: "pass" | "fail" | "skipped";
    blockingFindings: number;
    importantFindings: number;
    minorFindings: number;
  };
  review: {
    critical: number;
    important: number;
    minor: number;
  };
  parseIssues?: string[];
  criteria?: string[];
  evidenceFiles?: string[];
};

async function existsFile(path: string) {
  try {
    const fileStat = await stat(path);
    return fileStat.isFile();
  } catch {
    return false;
  }
}

async function existsDirectory(path: string) {
  try {
    const dirStat = await stat(path);
    return dirStat.isDirectory();
  } catch {
    return false;
  }
}

async function read(path: string) {
  return readFile(path, "utf8");
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await read(path)) as T;
}

async function runPython(args: string[]) {
  try {
    const result = await execFileAsync("python3", args, {
      cwd: repoRoot,
      maxBuffer: 10 * 1024 * 1024,
    });
    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    const err = error as Error & { code?: number; stdout?: string; stderr?: string };
    return { code: err.code ?? 1, stdout: err.stdout ?? "", stderr: err.stderr ?? "" };
  }
}

describe("HansBug writing voice skill PR-6 final acceptance", () => {
  it("keeps AGENTS.md as the single CLAUDE.md symlink and keeps the hard Skill entry", async () => {
    const link = await lstat(join(repoRoot, "AGENTS.md"));
    expect(link.isSymbolicLink()).toBe(true);
    expect(await readlink(join(repoRoot, "AGENTS.md"))).toBe("CLAUDE.md");

    const claude = await read(join(repoRoot, "CLAUDE.md"));
    expect(claude).toContain("### HansBug 文风 Skill 强入口");
    expect(claude).toContain("agent-skills/hansbug-writing-voice/SKILL.md");
    expect(claude).toContain("不得宣称");
    expect(claude).toContain("check_hansbug_voice.py");
  });

  it("keeps SKILL.md discoverable, Chinese-first, and wired to PR-0..PR-5 commands", async () => {
    const skill = await read(join(skillRoot, "SKILL.md"));

    expect(skill).toMatch(/^---\nname: hansbug-writing-voice\ndescription: .+\n---/s);
    for (const mode of ["构思", "写作", "改写", "审阅", "检查"]) {
      expect(skill).toContain(`\`${mode}\``);
    }
    for (const command of [
      "lint_voice_references.py",
      "fetch_voice_corpus.py",
      "extract_voice_features.py",
      "check_hansbug_voice.py",
    ]) {
      expect(skill).toContain(command);
    }
    expect(skill).toContain("不要默认全量加载");
    expect(skill).toContain("中文技术博客正文");
    expect(skill).not.toContain("English writing as a primary target");
  });

  it("keeps all references and scripts required by PR-0 through PR-5", async () => {
    for (const ref of requiredReferences) {
      expect(await existsFile(join(referencesRoot, ref)), ref).toBe(true);
    }
    for (const script of requiredScripts) {
      expect(await existsFile(join(scriptsRoot, script)), script).toBe(true);
    }
  });

  it("keeps script smoke commands executable without touching real CLI matrix", async () => {
    const lint = await runPython([join(scriptsRoot, "lint_voice_references.py"), referencesRoot]);
    expect(lint.code).toBe(0);
    expect(lint.stdout).toContain("OK");

    const fetch = await runPython([join(scriptsRoot, "fetch_voice_corpus.py"), "--dry-run", "--limit", "1"]);
    expect(fetch.code).toBe(0);
    expect(fetch.stdout).toContain("DRY-RUN");

    const extract = await runPython([join(scriptsRoot, "extract_voice_features.py"), "--allow-catalog-summary"]);
    expect(extract.code).toBe(0);
    expect(extract.stdout).toContain("schemaVersion");

    const checkHelp = await runPython([join(scriptsRoot, "check_hansbug_voice.py"), "--help"]);
    expect(checkHelp.code).toBe(0);
    expect(checkHelp.stdout).toContain("HansBug");

    const runner = await runPython([join(scriptsRoot, "run_forward_tests.py"), "--only", "__none__", "--timeout", "1"]);
    expect(runner.code).toBe(0);
  });

  it("mechanically verifies the PR-5 12-run matrix and three failure-evidence directories", async () => {
    const readme = await read(join(dryRunsRoot, "README.md"));
    for (const slug of expectedMatrixSlugs) {
      expect(await existsDirectory(join(dryRunsRoot, slug)), slug).toBe(true);
      expect(readme).toContain(`\`${slug}\``);
      const result = await readJson<RunResult>(join(dryRunsRoot, slug, "result.json"));
      expect(result.role, slug).toBe("matrix");
      expect(result.status, slug).toBe("pass");
      expect(result.exitCode, slug).toBe(0);
      expect(result.parseIssues ?? [], slug).toHaveLength(0);
      expect(result.review.critical, slug).toBe(0);
      expect(result.review.important, slug).toBe(0);
      expect(result.usedEntryPoints, slug).toContain("CLAUDE.md");
      expect(result.usedEntryPoints, slug).toContain("agent-skills/hansbug-writing-voice/SKILL.md");
    }

    for (const slug of writingMatrixSlugs) {
      const result = await readJson<RunResult>(join(dryRunsRoot, slug, "result.json"));
      expect(result.check?.status, slug).toBe("pass");
      expect(result.check?.blockingFindings, slug).toBe(0);
    }

    for (const slug of expectedFailureSlugs) {
      expect(await existsDirectory(join(dryRunsRoot, slug)), slug).toBe(true);
      expect(readme).toContain(`\`${slug}\``);
      const result = await readJson<RunResult>(join(dryRunsRoot, slug, "result.json"));
      expect(result.role, slug).toBe("failure-evidence");
      expect(result.status, slug).toBe("fail");
      expect(result.usedEntryPoints, slug).toContain("CLAUDE.md");
      expect(result.usedEntryPoints, slug).toContain("agent-skills/hansbug-writing-voice/SKILL.md");
    }
  });

  it("records PR-6 real CLI smoke evidence in acceptance-runs", async () => {
    const readme = await read(join(acceptanceRoot, "README.md"));
    expect(readme).toContain("PR-6 acceptance-runs");
    expect(readme).toContain("不是 PR-5 的 12 项 matrix");

    for (const slug of acceptanceSlugs) {
      const dir = join(acceptanceRoot, slug);
      for (const file of acceptanceFiles) {
        expect(await existsFile(join(dir, file)), `${slug}/${file}`).toBe(true);
      }
      const result = await readJson<RunResult>(join(dir, "result.json"));
      const prompt = await read(join(dir, "prompt.md"));
      const command = await read(join(dir, "command.md"));
      const stdout = await read(join(dir, "stdout.log"));
      const stderr = await read(join(dir, "stderr.log"));
      const exitCode = (await read(join(dir, "exit-code.txt"))).trim();

      expect(result.schemaVersion, slug).toBe(1);
      expect(result.taskSlug, slug).toBe(slug);
      expect(result.role, slug).toBe("pr6-final-smoke");
      expect(result.status, slug).toBe("pass");
      expect(result.exitCode, slug).toBe(0);
      expect(exitCode, slug).toBe("0");
      expect(result.review.critical, slug).toBe(0);
      expect(result.review.important, slug).toBe(0);
      expect(result.usedEntryPoints, slug).toContain("CLAUDE.md");
      expect(result.usedEntryPoints, slug).toContain("agent-skills/hansbug-writing-voice/SKILL.md");
      expect(prompt + command + stdout + stderr, slug).toContain("CLAUDE.md");
      expect(prompt + command + stdout + stderr, slug).toContain("agent-skills/hansbug-writing-voice/SKILL.md");
      for (const ref of result.usedReferences) {
        expect(prompt + stdout + stderr, `${slug} missing ${ref}`).toContain(ref);
      }
      expect(stdout, slug).toContain("最终自审");
      expect(stdout.replace(/[：:]/g, "="), slug).toMatch(/C\s*=\s*0/);
      expect(stdout.replace(/[：:]/g, "="), slug).toMatch(/I\s*=\s*0/);
      expect(stdout, slug).not.toContain("★ Insight");
    }

    const codexStdout = await read(join(acceptanceRoot, "pr6-codex-final-smoke/stdout.log"));
    expect(codexStdout).toContain("AI 式正确废话");
    expect(codexStdout).toContain("缺少边界");
    expect(codexStdout).toContain("缺少核心判断");

    const claudeStdout = await read(join(acceptanceRoot, "pr6-claude-final-smoke/stdout.log"));
    expect(claudeStdout).toContain("cnblogs-8701447");
    expect(claudeStdout).toContain("cnblogs-14711869");
    expect(claudeStdout).toContain("不会写");
    expect(claudeStdout).toContain("上线现场");
  });

  it("records the final acceptance report with CI, issue and umbrella links", async () => {
    const report = await read(finalReportPath);

    for (const marker of [
      "# HansBug 文风 Skill PR-6 最终验收报告",
      "PR-0",
      "PR-1",
      "PR-2",
      "PR-3",
      "PR-4",
      "PR-5",
      "PR-6",
      "https://github.com/HansBug/HansBug.github.io/issues/25#issuecomment-4711395657",
      "https://github.com/HansBug/HansBug.github.io/pull/26#issuecomment-4711395670",
      "https://github.com/HansBug/HansBug.github.io/actions/runs/27568416029",
      "https://github.com/HansBug/HansBug.github.io/actions/runs/27568146702",
      "git status --ignored -- .cache/hansbug-writing-voice/",
      "C=0 / I=0",
    ]) {
      expect(report).toContain(marker);
    }
    for (const slug of [...acceptanceSlugs, ...expectedFailureSlugs]) {
      expect(report).toContain(slug);
    }
  });

  it("does not commit old blog full text or corpus cache artifacts", async () => {
    const gitignore = await read(join(repoRoot, ".gitignore"));
    expect(gitignore.split(/\r?\n/)).toContain(".cache/hansbug-writing-voice/");

    for (const root of [skillRoot]) {
      const entries = await readdir(root, { recursive: true, withFileTypes: true });
      for (const entry of entries) {
        const path = join(entry.parentPath ?? root, entry.name);
        expect(path).not.toContain(".cache/hansbug-writing-voice/corpus");
        if (!entry.isFile()) continue;
        const text = await read(path);
        for (const marker of forbiddenOldBlogFullTextMarkers) {
          expect(text, `${path} contains ${marker}`).not.toContain(marker);
        }
      }
    }
  });
});
