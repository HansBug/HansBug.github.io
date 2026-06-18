import { describe, expect, it } from "vitest";

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, normalize } from "node:path";

const repoRoot = process.cwd();
const auditRoot = join(repoRoot, "src/data/deskpet/bangdream-rendered-resource-audit");

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const [header = [], ...body] = rows;
  const cleanHeader = header.map((item) => item.replace(/^\uFEFF/, ""));
  return body
    .filter((items) => items.some((item) => item !== ""))
    .map((items) => Object.fromEntries(cleanHeader.map((key, index) => [key, items[index] ?? ""])));
}

function readJson(path: string) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function readAudit() {
  return parseCsv(readFileSync(join(auditRoot, "audit.csv"), "utf8"));
}

function parseList(value: string): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return value.split(/[;,]/).map((item) => item.trim()).filter(Boolean);
  }
}

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function insideRepo(path: string): boolean {
  const normalized = normalize(path);
  return !normalized.startsWith("..") && !normalized.startsWith("/");
}

function resolveEvidencePath(value: string): string {
  const repoCandidate = join(repoRoot, value);
  if (existsSync(repoCandidate)) {
    return repoCandidate;
  }
  return join(auditRoot, value);
}

describe("Bang Dream rendered resource audit dataset", () => {
  it("has the expected generated files and schema columns", () => {
    const required = [
      "README.md",
      "audit.csv",
      "audit.parquet",
      "audit.schema.json",
      "classification-policy.json",
      "dedup-clusters.csv",
      "dedup-clusters.parquet",
      "dedup-pairs.csv",
      "dedup-pairs.parquet",
      "evidence-index.csv",
      "evidence-index.parquet",
      "review-queue.csv",
      "review-queue-visual.csv",
      "review-queue-pipeline-pending.csv",
      "review-results.json",
      "source-snapshot.json",
      "summary.json",
      "resource-audit-report.md",
      "samples/index.json",
    ];

    for (const name of required) {
      expect(existsSync(join(auditRoot, name)), name).toBe(true);
    }

    const schema = readJson(join(auditRoot, "audit.schema.json"));
    const audit = readAudit();
    expect(audit.length).toBeGreaterThan(0);
    expect(Object.keys(audit[0])).toEqual(schema.csvColumns);
  });

  it("keeps direct rating as a weak signal instead of a pool decision", () => {
    const audit = readAudit();

    for (const row of audit) {
      const reasons = parseList(row.classification_reason_codes);
      if (["public_candidate", "easter_egg_candidate"].includes(row.recommended_pool)) {
        expect(row.render_image_path, row.resource_key).not.toBe("");
        expect(row.tagger_status, row.resource_key).toBe("completed");
        expect(reasons.length, row.resource_key).toBeGreaterThan(0);
        expect(reasons, row.resource_key).not.toEqual(["direct_rating"]);
      }
      if (row.recommended_pool === "easter_egg_candidate") {
        expect(
          reasons.some((reason) => reason === "hard_easter_tag" || /swimsuit|bikini|bath_towel|onsen|underwear|panties|lingerie/.test(reason)),
          row.resource_key,
        ).toBe(true);
      }
      if (row.direct_rating_predicted_label === "sensitive" && row.recommended_pool === "easter_egg_candidate") {
        expect(reasons.filter((reason) => !reason.includes("direct_rating")).length, row.resource_key).toBeGreaterThan(0);
      }
    }
  });

  it("does not mark pending, excluded, or duplicate rows as runtime eligible", () => {
    const audit = readAudit();
    const keys = new Set(audit.map((row) => row.resource_key));
    const dedupPairs = parseCsv(readFileSync(join(auditRoot, "dedup-pairs.csv"), "utf8"));

    for (const row of audit) {
      if (["pending", "exclude"].includes(row.recommended_pool) || row.dedup_status === "duplicate") {
        expect(row.is_runtime_eligible, row.resource_key).toBe("False");
      }
      if (row.dedup_status === "duplicate") {
        expect(row.recommended_pool, row.resource_key).toBe("exclude");
        expect(keys.has(row.dedup_representative_key), row.resource_key).toBe(true);
        expect(
          dedupPairs.some(
            (pair) =>
              pair.cluster_id === row.dedup_cluster_id &&
              (pair.left_key === row.resource_key || pair.right_key === row.resource_key),
          ),
          row.resource_key,
        ).toBe(true);
      }
    }
  });

  it("keeps animal companion and qualification review signals out of usable pools", () => {
    const audit = readAudit();

    for (const row of audit) {
      const reasons = parseList(row.classification_reason_codes);
      if (row.recommended_pool === "public_candidate") {
        expect(row.qualification_status, row.resource_key).toBe("pass");
        expect(row.review_status, row.resource_key).toBe("not_required");
        expect(reasons.some((reason) => reason.startsWith("animal_companion:")), row.resource_key).toBe(false);
        expect(reasons.some((reason) => ["qualification_review", "mask", "helmet", "faceless", "multiple_girls", "2girls"].includes(reason)), row.resource_key).toBe(false);
      }
      if (row.recommended_pool === "easter_egg_candidate") {
        expect(row.qualification_status, row.resource_key).toBe("pass");
        expect(row.review_status, row.resource_key).toBe("not_required");
        expect(reasons.some((reason) => reason.startsWith("animal_companion:")), row.resource_key).toBe(false);
      }
      if (row.recommended_pool === "soft_review") {
        expect(row.review_status, row.resource_key).toBe("pending");
      }
    }
  });

  it("has resolvable evidence refs and committed sample images", () => {
    const audit = readAudit();
    const evidence = parseCsv(readFileSync(join(auditRoot, "evidence-index.csv"), "utf8"));
    const evidenceIds = new Set(evidence.map((row) => row.evidence_id));
    const sampleIndex = readJson(join(auditRoot, "samples/index.json"));

    for (const row of audit) {
      for (const ref of parseList(row.evidence_refs)) {
        expect(evidenceIds.has(ref), `${row.resource_key}:${ref}`).toBe(true);
      }
    }

    for (const pool of Object.values(sampleIndex.pools) as Array<{ items: Array<{ image_path: string; image_sha256: string }> }>) {
      for (const item of pool.items) {
        expect(insideRepo(item.image_path), item.image_path).toBe(true);
        const fullPath = join(repoRoot, item.image_path);
        expect(existsSync(fullPath), item.image_path).toBe(true);
        expect(readFileSync(fullPath).subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
        expect(sha256(fullPath), item.image_path).toBe(item.image_sha256);
      }
    }

    for (const row of evidence.filter((item) => item.is_committed_to_repo === "True")) {
      const fullPath = resolveEvidencePath(row.evidence_path);
      expect(existsSync(fullPath), row.evidence_path).toBe(true);
      if (row.evidence_sha256) {
        expect(sha256(fullPath), row.evidence_path).toBe(row.evidence_sha256);
      }
    }
  });

  it("uses relative Markdown links for report images", () => {
    const report = readFileSync(join(auditRoot, "resource-audit-report.md"), "utf8");
    const links = [...report.matchAll(/(?:src="|!\[\]\()([^")]+)(?:"|\))/g)].map((match) => match[1]);
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.startsWith("src/"), link).toBe(false);
      expect(link.startsWith("/"), link).toBe(false);
      expect(existsSync(join(auditRoot, link)), link).toBe(true);
    }
  });
});
