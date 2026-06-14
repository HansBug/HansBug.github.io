import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const DESKPET_AUDIT_DIR = "src/data/deskpet/bangdream-resource-audit";
const AUDIT_CSV_COLUMNS = [
  "resource_key",
  "resource_key_strategy",
  "model_key",
  "local_code",
  "upstream_code",
  "variant",
  "costume_key",
  "family",
  "character_name_zh",
  "character_name_ja",
  "band",
  "row_kind",
  "is_current_pool",
  "is_covered_candidate",
  "is_union_reference",
  "gist_selection_proxy_bucket",
  "gist_selection_proxy_score",
  "gist_content_safety_hint",
  "bestdori_available_servers",
  "bestdori_preferred_server",
  "download_status",
  "conversion_status",
  "validate_status",
  "render_status",
  "render_image_sha256_primary",
  "render_image_sha256_desktop",
  "render_image_sha256_mobile",
  "tagger_model_id",
  "tagger_model_revision",
  "rating_signal_source",
  "rating_score_general",
  "rating_score_sensitive",
  "rating_score_questionable",
  "rating_score_explicit",
  "rating_predicted_label",
  "rating_confidence",
  "rating_margin",
  "needs_llm_review",
  "llm_review_label",
  "needs_human_review",
  "human_review_label",
  "final_content_rating",
  "content_policy_decision",
  "eligible_for_default_pool",
  "eligible_for_sensitive_easter_egg_pool",
  "exclusion_reason",
  "evidence_refs",
] as const;
const FAMILY_SUMMARY_COLUMNS = [
  "family",
  "row_count",
  "current_pool_count",
  "covered_candidate_count",
  "union_reference_count",
  "general_count",
  "sensitive_count",
  "questionable_count",
  "explicit_count",
  "unknown_count",
  "allow_default_count",
  "allow_sensitive_easter_egg_count",
  "quarantine_count",
  "policy_reject_count",
  "pending_count",
  "render_success_rate",
  "validate_success_rate",
  "needs_llm_review_count",
  "needs_human_review_count",
] as const;
const CONTENT_RATINGS = ["general", "sensitive", "questionable", "explicit", "unknown"] as const;
const CONTENT_POLICY_DECISIONS = [
  "allow_default",
  "allow_sensitive_easter_egg",
  "quarantine",
  "reject",
  "pending",
] as const;

const auditDir = path.resolve(DESKPET_AUDIT_DIR);

function readAuditFile(name: string) {
  return fs.readFileSync(path.join(auditDir, name), "utf8");
}

type CsvRecord = Record<string, string>;

function parseCsv(text: string): CsvRecord[] {
  const normalized = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
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

  const [header, ...body] = rows.filter((item) => item.some((cellValue) => cellValue.length > 0));
  if (!header) return [];

  return body.map((values) =>
    Object.fromEntries(header.map((name, index) => [name, values[index] ?? ""])),
  );
}

function parseJsonArrayCell(value: string): unknown[] {
  const parsed = JSON.parse(value || "[]");
  if (!Array.isArray(parsed)) {
    throw new Error(`Expected JSON array cell, got: ${value}`);
  }
  return parsed;
}

function assertAllowedValues(
  rows: readonly CsvRecord[],
  column: string,
  allowedValues: readonly string[],
) {
  const allowed = new Set(allowedValues);
  const invalid = rows.filter((row) => !allowed.has(row[column]));
  if (invalid.length > 0) {
    throw new Error(`Invalid ${column}: ${invalid[0][column]}`);
  }
}

function countBy(rows: readonly CsvRecord[], column: string) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row[column], (counts.get(row[column]) ?? 0) + 1);
  }
  return counts;
}

describe("BanG Dream deskpet audit dataset", () => {
  it("commits the required audit artifacts", () => {
    for (const name of [
      "README.md",
      "audit.parquet",
      "audit.csv",
      "audit.schema.json",
      "source-snapshot.json",
      "tag-rating-mapping-v1.json",
      "evidence-index.parquet",
      "evidence-index.csv",
      "family-summary.csv",
      "resource-intelligence-summary.json",
    ]) {
      expect(fs.existsSync(path.join(auditDir, name)), name).toBe(true);
    }
  });

  it("keeps audit.csv aligned with the schema and fail-closed enums", () => {
    const rows = parseCsv(readAuditFile("audit.csv"));
    const schema = JSON.parse(readAuditFile("audit.schema.json"));
    const header = Object.keys(rows[0] ?? {});

    expect(rows).toHaveLength(3443);
    expect(header).toEqual([...AUDIT_CSV_COLUMNS]);
    expect(schema.csvColumns).toEqual([...AUDIT_CSV_COLUMNS]);
    expect(schema.contentRatings).toEqual([...CONTENT_RATINGS]);
    expect(schema.contentPolicyDecisions).toEqual([...CONTENT_POLICY_DECISIONS]);

    assertAllowedValues(rows, "final_content_rating", CONTENT_RATINGS);
    assertAllowedValues(rows, "content_policy_decision", CONTENT_POLICY_DECISIONS);
    expect([...countBy(rows, "row_kind").entries()].sort()).toEqual([
      ["covered_candidate", 3175],
      ["current_pool", 165],
      ["union_only", 103],
    ]);
    expect(rows.every((row) => row.final_content_rating === "unknown")).toBe(true);
    expect(rows.every((row) => row.content_policy_decision === "pending")).toBe(true);
  });

  it("preserves overlapping union-reference scope for current and covered rows", () => {
    const rows = parseCsv(readAuditFile("audit.csv"));
    const currentPoolRows = rows.filter((row) => row.row_kind === "current_pool");
    const coveredRows = rows.filter((row) => row.row_kind === "covered_candidate");
    const unionOnlyRows = rows.filter((row) => row.row_kind === "union_only");

    expect(currentPoolRows.every((row) => row.is_current_pool === "True")).toBe(true);
    expect(currentPoolRows.every((row) => row.is_covered_candidate === "True")).toBe(true);
    expect(currentPoolRows.every((row) => row.is_union_reference === "True")).toBe(true);
    expect(coveredRows.every((row) => row.is_union_reference === "True")).toBe(true);
    expect(unionOnlyRows.every((row) => row.is_current_pool === "False")).toBe(true);
    expect(unionOnlyRows.every((row) => row.resource_key.startsWith("bangdream_upstream_"))).toBe(
      true,
    );
  });

  it("records source snapshot, tag mapping and family summary with stable semantics", () => {
    const sourceSnapshot = JSON.parse(readAuditFile("source-snapshot.json"));
    const tagMapping = JSON.parse(readAuditFile("tag-rating-mapping-v1.json"));
    const familyRows = parseCsv(readAuditFile("family-summary.csv"));

    expect(sourceSnapshot.gist.gist_id).toBe("0badd50993b2958b635889d6eaa0b34c");
    expect(sourceSnapshot.gist.files["README.md"].sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(sourceSnapshot.current_pool.qualified_variant_count).toBe(165);
    expect(sourceSnapshot.current_pool.ave_mujica_local_to_upstream_map).toEqual({
      "041": "341",
      "042": "337",
      "043": "338",
      "044": "340",
      "045": "339",
    });
    expect(sourceSnapshot.tagger.requires_audit_time_recheck).toBe(true);
    expect(tagMapping.low_confidence.direct_rating_label.max_score_threshold).toBe(0.8);
    expect(Object.keys(familyRows[0] ?? {})).toEqual([...FAMILY_SUMMARY_COLUMNS]);
    expect(Object.keys(familyRows[0] ?? {})).toContain("policy_reject_count");
    expect(Object.keys(familyRows[0] ?? {})).not.toContain("reject_count");
  });

  it("keeps evidence references as JSON arrays backed by evidence-index.csv", () => {
    const rows = parseCsv(readAuditFile("audit.csv"));
    const evidenceRows = parseCsv(readAuditFile("evidence-index.csv"));
    const evidenceIds = new Set(evidenceRows.map((row) => row.evidence_id));

    for (const row of rows.slice(0, 100)) {
      const refs = parseJsonArrayCell(row.evidence_refs);
      expect(refs.length).toBeGreaterThan(0);
      for (const ref of refs) {
        expect(evidenceIds.has(String(ref))).toBe(true);
      }
    }
  });
});
