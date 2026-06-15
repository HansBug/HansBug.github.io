import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const repoRoot = new URL("..", import.meta.url).pathname;
const skillRoot = join(repoRoot, "agent-skills/hansbug-writing-voice");
const referencesRoot = join(skillRoot, "references");
const fixturesRoot = join(repoRoot, "tests/fixtures/hansbug-voice-pr3");
const checkScript = join(skillRoot, "scripts/check_hansbug_voice.py");
const lintScript = join(skillRoot, "scripts/lint_voice_references.py");
const manifestPath = join(referencesRoot, "sample-manifest.json");

async function runPython(args: string[]) {
  try {
    const result = await execFileAsync("python3", args, {
      cwd: repoRoot,
      maxBuffer: 8 * 1024 * 1024,
    });
    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    const err = error as Error & { code?: number; stdout?: string; stderr?: string };
    return { code: err.code ?? 1, stdout: err.stdout ?? "", stderr: err.stderr ?? "" };
  }
}

async function runCheck(file: string, extraArgs: string[] = []) {
  return runPython([
    checkScript,
    file,
    "--skill-root",
    skillRoot,
    "--manifest",
    manifestPath,
    "--format",
    "json",
    "--pretty",
    ...extraArgs,
  ]);
}

function parseJson(stdout: string) {
  return JSON.parse(stdout);
}

function allFindings(report: Record<string, unknown>) {
  return [
    ...(report.blockingFindings as Array<Record<string, string>>),
    ...(report.warnings as Array<Record<string, string>>),
    ...(report.missingMacroSections as Array<Record<string, string>>),
    ...(report.overusedMicroPatterns as Array<Record<string, string>>),
    ...(report.aiClicheHits as Array<Record<string, string>>),
    ...(report.possibleUnsupportedExperienceClaims as Array<Record<string, string>>),
  ];
}

function expectFinding(report: Record<string, unknown>, code: string) {
  expect(allFindings(report).some((finding) => finding.code === code), JSON.stringify(report, null, 2)).toBe(true);
}

function expectBlockingFinding(report: Record<string, unknown>, code: string) {
  const blocking = report.blockingFindings as Array<Record<string, string>>;
  expect(blocking.some((finding) => finding.code === code), JSON.stringify(report, null, 2)).toBe(true);
}

async function readReference(file: string) {
  return readFile(join(referencesRoot, file), "utf8");
}

function countChineseChars(text: string) {
  return [...text].filter((char) => /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u.test(char)).length;
}

describe("HansBug writing voice skill PR-3", () => {
  let fixtureRoot: string | undefined;

  afterEach(async () => {
    if (fixtureRoot) {
      await rm(fixtureRoot, { recursive: true, force: true });
      fixtureRoot = undefined;
    }
  });

  it("adds Chinese rubric and prompt recipes with executable review anchors", async () => {
    const rubric = await readReference("review-rubric.md");
    const recipes = await readReference("prompt-recipes.md");

    for (const text of [rubric, recipes]) {
      expect(text.startsWith("# ")).toBe(true);
      expect(countChineseChars(text)).toBeGreaterThan(600);
      expect(text).not.toContain("TODO");
      expect(text).not.toContain("后续 PR 占位");
    }

    expect(rubric).toContain("C 级");
    expect(rubric).toContain("I 级");
    expect(rubric).toContain("M 级");
    expect(rubric).toContain("事实 / 经历来源");
    expect(rubric).toContain("高口癖密度 + 低判断密度");
    expect(rubric).toContain("编造作者经历");

    for (const recipe of ["构思", "初稿写作", "改写", "风格增强", "风格审稿", "反向批评", "检查 / CLI gate"]) {
      expect(recipes).toContain(`## ${recipe}`);
    }
    for (const marker of ["适用场景", "必须读取", "样本版本", "sample ids", "最后更新", "输出格式", "事实缺口", "不编造经历"]) {
      expect(recipes).toContain(marker);
    }
  });

  it("updates SKILL.md to expose PR-3 references and CLI progressively", async () => {
    const skill = await readFile(join(skillRoot, "SKILL.md"), "utf8");

    expect(skill).toContain("references/review-rubric.md");
    expect(skill).toContain("references/prompt-recipes.md");
    expect(skill).toContain("scripts/check_hansbug_voice.py");
    expect(skill).not.toContain("references/review-rubric.md`（后续 PR 占位）");
    expect(skill).not.toContain("references/prompt-recipes.md`（后续 PR 占位）");
    expect(skill).toContain("PR-3");
    expect(skill).toContain("不要默认全量加载");
    expect(skill.split("\n").length).toBeLessThanOrEqual(620);
  });

  it("provides Chinese help and deterministic JSON schema", async () => {
    const help = await runPython([checkScript, "--help"]);
    expect(help.code).toBe(0);
    expect(help.stdout).toContain("HansBug");
    expect(help.stdout).toContain("--format");
    expect(help.stdout).toContain("--manifest");

    const first = await runCheck(join(fixturesRoot, "pass/technical-practice.md"));
    const second = await runCheck(join(fixturesRoot, "pass/technical-practice.md"));
    expect(first.code).toBe(0);
    expect(second.code).toBe(0);
    expect(first.stdout).toBe(second.stdout);
    const report = parseJson(first.stdout);

    expect(report.status).toBe("pass");
    expect(Number.isInteger(report.score)).toBe(true);
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
    expect(report.scoreMeaning).toBe("rough-gate-only-not-style-similarity");
    for (const field of [
      "blockingFindings",
      "warnings",
      "matchedSamples",
      "missingMacroSections",
      "overusedMicroPatterns",
      "aiClicheHits",
      "possibleUnsupportedExperienceClaims",
    ]) {
      expect(Array.isArray(report[field]), field).toBe(true);
    }
    expect(report.matchedSamples.length).toBeGreaterThan(0);
  });

  it("returns non-empty Chinese text summaries with matching exit codes", async () => {
    const pass = await runPython([
      checkScript,
      join(fixturesRoot, "pass/technical-practice.md"),
      "--skill-root",
      skillRoot,
      "--manifest",
      manifestPath,
      "--format",
      "text",
    ]);
    expect(pass.code).toBe(0);
    expect(pass.stdout).toContain("检查通过");

    const fail = await runPython([
      checkScript,
      join(fixturesRoot, "fail/ai-cliche.md"),
      "--skill-root",
      skillRoot,
      "--manifest",
      manifestPath,
      "--format",
      "text",
    ]);
    expect(fail.code).not.toBe(0);
    expect(fail.stdout).toContain("检查失败");
    expect(fail.stdout).toContain("missing-core-judgement");
  });

  it("fails AI cliche with explicit finding codes", async () => {
    const result = await runCheck(join(fixturesRoot, "fail/ai-cliche.md"));
    expect(result.code).not.toBe(0);
    const report = parseJson(result.stdout);
    expect(report.status).toBe("fail");
    expectFinding(report, "ai-cliche-generic-summary");
    expectFinding(report, "missing-core-judgement");
    expectBlockingFinding(report, "ai-cliche-generic-summary");
    expectBlockingFinding(report, "missing-core-judgement");
  });

  it("fails catchphrase stuffing without judgement", async () => {
    const result = await runCheck(join(fixturesRoot, "fail/catchphrase-stuffing.md"));
    expect(result.code).not.toBe(0);
    const report = parseJson(result.stdout);
    expectFinding(report, "catchphrase-without-judgement");
    expectBlockingFinding(report, "catchphrase-without-judgement");
  });

  it("fails unsupported first-person project or course experience claims", async () => {
    const result = await runCheck(join(fixturesRoot, "fail/unsupported-experience.md"));
    expect(result.code).not.toBe(0);
    const report = parseJson(result.stdout);
    expectFinding(report, "unsupported-first-person-experience");
    expectBlockingFinding(report, "unsupported-first-person-experience");
    const experience = report.possibleUnsupportedExperienceClaims as Array<Record<string, string>>;
    expect(experience.some((finding) => finding.severity === "C")).toBe(true);
  });

  it("fails missing macro structure with section-specific findings", async () => {
    const result = await runCheck(join(fixturesRoot, "fail/missing-macro.md"));
    expect(result.code).not.toBe(0);
    const report = parseJson(result.stdout);
    expectFinding(report, "missing-h2-structure");
    expectFinding(report, "missing-boundary-section");
    expectFinding(report, "missing-closing-lift");
    expectBlockingFinding(report, "missing-h2-structure");
    expectBlockingFinding(report, "missing-boundary-section");
    expectBlockingFinding(report, "missing-closing-lift");
  });

  it("fails missing sample comparison", async () => {
    const result = await runCheck(join(fixturesRoot, "fail/no-sample-comparison.md"));
    expect(result.code).not.toBe(0);
    const report = parseJson(result.stdout);
    expectFinding(report, "missing-sample-comparison");
    expectBlockingFinding(report, "missing-sample-comparison");
  });

  it("fails unknown sample ids referenced by drafts", async () => {
    const result = await runCheck(join(fixturesRoot, "fail/unknown-sample.md"));
    expect(result.code).not.toBe(0);
    const report = parseJson(result.stdout);
    expectFinding(report, "unknown-sample-id");
    expectBlockingFinding(report, "unknown-sample-id");
  });

  it("fails manifests that let holdout or negative samples participate in the positive profile", async () => {
    const badManifest = join(fixturesRoot, "manifests/invalid-positive-role.json");
    const result = await runCheck(join(fixturesRoot, "pass/technical-practice.md"), ["--manifest", badManifest]);
    expect(result.code).not.toBe(0);
    const report = parseJson(result.stdout);
    expectFinding(report, "invalid-positive-sample-role");
    expectBlockingFinding(report, "invalid-positive-sample-role");
  });

  it("fails references lint errors through the PR-3 gate", async () => {
    const result = await runCheck(join(fixturesRoot, "pass/technical-practice.md"), [
      "--references-dir",
      join(fixturesRoot, "references-invalid"),
    ]);
    expect(result.code).not.toBe(0);
    const report = parseJson(result.stdout);
    expectFinding(report, "reference-lint-failed");
    expectBlockingFinding(report, "reference-lint-failed");
    const blocking = report.blockingFindings as Array<Record<string, string>>;
    const lintFinding = blocking.find((finding) => finding.code === "reference-lint-failed");
    expect(lintFinding?.evidence).toContain("120");
  });

  it("keeps source markers local instead of bypassing unsupported experience globally", async () => {
    const result = await runCheck(join(fixturesRoot, "fail/unsupported-experience-bypass.md"));
    expect(result.code).not.toBe(0);
    const report = parseJson(result.stdout);
    expectFinding(report, "unsupported-first-person-experience");
    expectBlockingFinding(report, "unsupported-first-person-experience");
  });

  it("ignores frontmatter when detecting style and unsupported experience", async () => {
    const result = await runCheck(join(fixturesRoot, "pass/frontmatter-trap.md"));
    expect(result.code).toBe(0);
    const report = parseJson(result.stdout);
    expect(report.status).toBe("pass");
    expect(report.blockingFindings).toEqual([]);
    expect(report.possibleUnsupportedExperienceClaims).toEqual([]);
  });

  it("accepts long closing sections and non-summary closing headings", async () => {
    for (const fixture of ["pass/long-closing.md", "pass/quick-start-window.md"]) {
      const result = await runCheck(join(fixturesRoot, fixture));
      expect(result.code).toBe(0);
      const report = parseJson(result.stdout);
      expect(report.status).toBe("pass");
      expect(report.missingMacroSections).toEqual([]);
    }
  });

  it("does not treat code-block sample declaration examples as real sample comparison", async () => {
    const result = await runCheck(join(fixturesRoot, "pass/codeblock-sample-literal.md"));
    expect(result.code).not.toBe(0);
    const report = parseJson(result.stdout);
    expectFinding(report, "missing-sample-comparison");
  });

  it("reports manifest path type errors as JSON instead of traceback", async () => {
    fixtureRoot = await mkdtemp(join(tmpdir(), "hansbug-voice-pr3-"));
    const manifestDir = join(fixtureRoot, "manifest-dir");
    await rm(manifestDir, { recursive: true, force: true });
    await mkdir(manifestDir, { recursive: true });
    const result = await runCheck(join(fixturesRoot, "pass/technical-practice.md"), ["--manifest", manifestDir]);
    expect(result.code).not.toBe(0);
    expect(result.stderr).not.toContain("Traceback");
    const report = parseJson(result.stdout);
    expectFinding(report, "manifest-not-readable");
    expectBlockingFinding(report, "manifest-not-readable");
  });

  it("keeps PR-2 holdout and negative guard terms from regressing", async () => {
    const result = await runPython([lintScript, referencesRoot]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("OK");

    const positiveText = await Promise.all([
      readReference("voice-profile.md"),
      readReference("article-archetypes.md"),
      readReference("micro-patterns.md"),
      readReference("macro-logic.md"),
    ]).then((texts) => texts.join("\n"));
    expect(positiveText).not.toContain("近取Key");
    expect(positiveText).not.toContain("函数树化");
  });
});
