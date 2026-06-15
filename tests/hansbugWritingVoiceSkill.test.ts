import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const repoRoot = new URL("..", import.meta.url).pathname;
const skillRoot = join(repoRoot, "agent-skills/hansbug-writing-voice");
const lintScript = join(skillRoot, "scripts/lint_voice_references.py");

async function runLint(referencesDir: string) {
  try {
    const result = await execFileAsync("python3", [lintScript, referencesDir], {
      cwd: repoRoot,
      maxBuffer: 1024 * 1024,
    });
    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    const err = error as Error & { code?: number; stdout?: string; stderr?: string };
    return { code: err.code ?? 1, stdout: err.stdout ?? "", stderr: err.stderr ?? "" };
  }
}

function excerptBlock(data: Record<string, string>) {
  return ["```json hansbug-voice-excerpt", JSON.stringify(data, null, 2), "```", ""].join("\n");
}

async function makeReferencesFixture() {
  const root = await mkdtemp(join(tmpdir(), "hansbug-voice-references-"));
  await mkdir(join(root, "references"), { recursive: true });
  return { root, references: join(root, "references") };
}

describe("HansBug writing voice skill", () => {
  let fixtureRoot: string | undefined;

  afterEach(async () => {
    if (fixtureRoot) {
      await rm(fixtureRoot, { recursive: true, force: true });
      fixtureRoot = undefined;
    }
  });

  it("keeps the repo-local skill entry compact and manually discoverable", async () => {
    const skill = await readFile(join(skillRoot, "SKILL.md"), "utf8");

    expect(skill).toMatch(/^---\nname: hansbug-writing-voice\ndescription: .+\n---\n/s);
    expect(skill).toContain("如果本仓库内的 Skill 不能被自动发现");
    expect(skill).toContain("构思");
    expect(skill).toContain("写作");
    expect(skill).toContain("改写");
    expect(skill).toContain("审阅");
    expect(skill).toContain("检查");
    expect(skill).toContain("后续 PR 占位");
    expect(skill.split("\n").length).toBeLessThanOrEqual(500);
  });

  it("documents corpus compliance, audit fields and cache boundaries", async () => {
    const policy = await readFile(join(skillRoot, "references/corpus-policy.md"), "utf8");

    expect(policy).toContain("抓取可行性审计");
    expect(policy).toContain("ToS");
    expect(policy).toContain("robots");
    expect(policy).toContain(".cache/hansbug-writing-voice/corpus/");
    expect(policy).toContain("手动摘录");
    expect(policy).toContain("120");
    expect(policy).toContain("300");
    expect(policy).toContain("sourceUrl");
    expect(policy).toMatch(/purpose|useFor/);
  });

  it("keeps the full corpus cache ignored by git", async () => {
    const gitignore = await readFile(join(repoRoot, ".gitignore"), "utf8");

    expect(gitignore.split(/\r?\n/)).toContain(".cache/hansbug-writing-voice/");
  });

  it("passes valid markdown excerpt blocks with source URL and purpose", async () => {
    const fixture = await makeReferencesFixture();
    fixtureRoot = fixture.root;
    await writeFile(
      join(fixture.references, "valid.md"),
      excerptBlock({
        sourceUrl: "https://www.cnblogs.com/HansBug/p/demo.html",
        purpose: "macro-logic",
        text: "这是一段用于测试的短摘录，只保留判断方式，不提交旧文全文。",
      }),
    );

    const result = await runLint(fixture.references);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("OK");
  });

  it("rejects a single excerpt longer than 120 Chinese characters", async () => {
    const fixture = await makeReferencesFixture();
    fixtureRoot = fixture.root;
    await writeFile(
      join(fixture.references, "too-long.md"),
      excerptBlock({
        sourceUrl: "https://www.cnblogs.com/HansBug/p/demo.html",
        useFor: "micro-pattern",
        text: "字".repeat(121),
      }),
    );

    const result = await runLint(fixture.references);

    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain("too-long.md");
    expect(result.stderr).toContain("120");
  });

  it("rejects cumulative excerpts longer than 300 Chinese characters for one source article", async () => {
    const fixture = await makeReferencesFixture();
    fixtureRoot = fixture.root;
    const sourceUrl = "https://www.cnblogs.com/HansBug/p/same-source.html";
    await writeFile(
      join(fixture.references, "cumulative.md"),
      [
        excerptBlock({ sourceUrl, purpose: "macro-logic", text: "甲".repeat(100) }),
        excerptBlock({ sourceUrl, purpose: "micro-pattern", text: "乙".repeat(100) }),
        excerptBlock({ sourceUrl, purpose: "tone", text: "丙".repeat(101) }),
      ].join("\n"),
    );

    const result = await runLint(fixture.references);

    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain("cumulative.md");
    expect(result.stderr).toContain("300");
    expect(result.stderr).toContain(sourceUrl);
  });

  it("rejects excerpt blocks without a source URL", async () => {
    const fixture = await makeReferencesFixture();
    fixtureRoot = fixture.root;
    await writeFile(
      join(fixture.references, "missing-url.md"),
      excerptBlock({
        purpose: "macro-logic",
        text: "这段摘录缺少来源 URL。",
      }),
    );

    const result = await runLint(fixture.references);

    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain("missing-url.md");
    expect(result.stderr).toContain("sourceUrl");
  });

  it("rejects excerpt blocks without purpose or useFor", async () => {
    const fixture = await makeReferencesFixture();
    fixtureRoot = fixture.root;
    await writeFile(
      join(fixture.references, "missing-purpose.md"),
      excerptBlock({
        sourceUrl: "https://www.cnblogs.com/HansBug/p/demo.html",
        text: "这段摘录缺少用途字段。",
      }),
    );

    const result = await runLint(fixture.references);

    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain("missing-purpose.md");
    expect(result.stderr).toMatch(/purpose|useFor/);
  });

  it("validates JSON manifest excerpts with the same rules", async () => {
    const fixture = await makeReferencesFixture();
    fixtureRoot = fixture.root;
    await writeFile(
      join(fixture.references, "manifest.json"),
      JSON.stringify(
        {
          excerpts: [
            {
              url: "https://www.cnblogs.com/HansBug/p/json.html",
              useFor: "review-rubric",
              excerpt: "JSON manifest 里的短摘录也应被同一套规则扫描。",
            },
          ],
        },
        null,
        2,
      ),
    );

    const result = await runLint(fixture.references);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("OK");
  });

  it("rejects non-UTF-8 reference files with a clear lint error", async () => {
    const fixture = await makeReferencesFixture();
    fixtureRoot = fixture.root;
    await writeFile(join(fixture.references, "bad.md"), Buffer.from([0xff, 0xfe, 0x00]));

    const result = await runLint(fixture.references);

    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain("bad.md");
    expect(result.stderr).toContain("invalid UTF-8");
    expect(result.stderr).not.toContain("Traceback");
  });
});
