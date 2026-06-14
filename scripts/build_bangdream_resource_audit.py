#!/usr/bin/env python3
"""Build the BanG Dream deskpet resource audit dataset.

The audit table is generated from source snapshots, then enriched by actually
running the configured animetimm Danbooru tagger over Bestdori texture evidence.
Rows that the tagger cannot classify confidently are kept fail-closed and added
to the LLM review queue.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import io
import json
import os
import platform
import signal
import shlex
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    import pandas as pd
    import pyarrow as pa
    import pyarrow.parquet as pq
except ImportError as error:  # pragma: no cover - exercised by CLI guard.
    raise SystemExit(
        "Missing Python dependency. Install pandas and pyarrow before running deskpet:audit."
    ) from error


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT_DIR = REPO_ROOT / "src/data/deskpet/bangdream-resource-audit"
POOL_PATH = REPO_ROOT / "src/data/bangdreamDeskPetPool.json"
MODELS_DIR = REPO_ROOT / "src/vendor/deskpet/bangdream-models"
GIST_ID = "0badd50993b2958b635889d6eaa0b34c"
GIST_API_URL = f"https://api.github.com/gists/{GIST_ID}"
USER_AGENT = "HansBugTechBlogDeskpetAudit/1.0 (+https://github.com/HansBug/HansBug.github.io)"
SOURCE_SNAPSHOT_ID_PREFIX = "bangdream-resource-audit"
MAPPING_VERSION = "v1"
TAGGER_MODEL_ID = "animetimm/convnextv2_huge.dbv4-full"
TAGGER_MODEL_REVISION_PLAN = "18177355d1448a69bafb0410a0608e144f714e8b"
TAGGER_MODEL_LAST_MODIFIED_PLAN = "2025-10-22T14:54:23.000Z"
HUGGINGFACE_MODEL_API_URL = f"https://huggingface.co/api/models/{TAGGER_MODEL_ID}"
TAGGER_MODEL_NAME = f"hf-hub:{TAGGER_MODEL_ID}"
TAGGER_CACHE_DIR = REPO_ROOT / ".cache/deskpet-audit/tagger"
TEXTURE_CACHE_DIR = REPO_ROOT / ".cache/deskpet-audit/textures"
DEFAULT_RENDER_COMPLETENESS_CSV = DEFAULT_OUTPUT_DIR / "render-completeness.csv"
RATING_LABELS = ["general", "sensitive", "questionable", "explicit"]
POLICY_TAG_TOP_LIMIT = 30
DEFAULT_TAGGER_BATCH_SIZE = 24
DEFAULT_LLM_REVIEW_BATCH_SIZE = 20
DEFAULT_LLM_REVIEW_TIMEOUT_SECONDS = 240
MIN_LLM_REVIEW_CONFIDENCE = 0.65
BESTDORI_SERVERS = ["jp", "cn", "en", "kr", "tw"]
PREFERRED_SERVER_ORDER = ["jp", "cn", "en", "kr", "tw"]
AVE_MUJICA_LOCAL_TO_UPSTREAM = {
    "041": "341",
    "042": "337",
    "043": "338",
    "044": "340",
    "045": "339",
}
CONTENT_RATINGS = ["general", "sensitive", "questionable", "explicit", "unknown"]
CONTENT_POLICY_DECISIONS = [
    "allow_default",
    "allow_sensitive_easter_egg",
    "quarantine",
    "reject",
    "pending",
]
LLM_REVIEW_STATUSES = [
    "pending",
    "completed",
    "blocked",
    "not_required",
    "skipped",
    "failed",
]
GIST_FILES = [
    "README.md",
    "candidate-resource-intelligence.csv",
    "current-pool-coverage.csv",
    "compatible-candidates-covered-characters.csv",
    "character-candidate-summary.csv",
    "bestdori-live2d-chara-union.csv",
    "candidate-selection-shortlist.csv",
    "candidate-intelligence-by-family.csv",
    "dataset-summary.json",
    "resource-intelligence-summary.json",
    "missing-our-notes-characters.csv",
]


def configure_local_model_caches() -> None:
    """Keep all model caches inside the repository worktree."""
    os.environ.setdefault("HF_HOME", str(TAGGER_CACHE_DIR / "hf"))
    os.environ.setdefault("HF_HUB_CACHE", str(TAGGER_CACHE_DIR / "hf" / "hub"))
    os.environ.setdefault("HUGGINGFACE_HUB_CACHE", str(TAGGER_CACHE_DIR / "hf" / "hub"))
    os.environ.setdefault("TRANSFORMERS_CACHE", str(TAGGER_CACHE_DIR / "hf" / "transformers"))
    os.environ.setdefault("TORCH_HOME", str(TAGGER_CACHE_DIR / "torch"))
    if "HF_TOKEN" not in os.environ and os.environ.get("HF_TOKEN_X"):
        os.environ["HF_TOKEN"] = os.environ["HF_TOKEN_X"]


configure_local_model_caches()
CSV_COLUMNS = [
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
    "tagger_visual_evidence_status",
    "tagger_visual_evidence_count",
    "tagger_visual_evidence_primary_url",
    "tagger_visual_evidence_primary_sha256",
    "download_status",
    "conversion_status",
    "validate_status",
    "render_status",
    "render_complete_person_decision",
    "render_complete_person_reason",
    "render_nonblank_ratio",
    "render_bounds_width",
    "render_bounds_height",
    "render_bounds_inside_ratio",
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
    "llm_review_status",
    "llm_review_reason",
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
]
FAMILY_SUMMARY_COLUMNS = [
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
    "tagger_scanned_count",
    "llm_review_queue_count",
    "needs_llm_review_count",
    "needs_human_review_count",
]
TAG_MAPPING = {
    "mapping_version": MAPPING_VERSION,
    "description": "Fail-closed tag-to-rating policy used for BanG Dream deskpet resource audit.",
    "sensitive_keywords": [
        "swimsuit",
        "mizugi",
        "bikini",
        "beach",
        "bath",
        "bath_towel",
        "towel",
        "lingerie",
        "pajama",
        "yukata",
        "onsen",
    ],
    "low_confidence": {
        "direct_rating_label": {
            "strategy": "max_score_or_margin",
            "max_score_threshold": 0.27,
            "margin_threshold": 0.2,
            "action": "needs_review",
            "notes": "max_score_threshold follows the selected_tags.csv direct rating thresholds; margin_threshold catches ambiguous top-2 ratings.",
        },
        "tag_mapping": {
            "strategy": "policy_tag_threshold_or_manual_hint",
            "default_policy_tag_threshold": 0.35,
            "margin_threshold": 0.15,
            "action": "needs_review",
        },
    },
    "rules": [
        {
            "tag_name": "swimsuit",
            "rating_category": "sensitive",
            "threshold": 0.35,
            "rationale": "泳装类标签至少进入 sensitive 复核。",
        },
        {
            "tag_name": "mizugi",
            "rating_category": "sensitive",
            "threshold": 0.35,
            "rationale": "日文泳装标签至少进入 sensitive 复核。",
        },
        {
            "tag_name": "bikini",
            "rating_category": "sensitive",
            "threshold": 0.35,
            "rationale": "比基尼类服装必须人工复核后才可进入非默认池。",
        },
        {
            "tag_name": "lingerie",
            "rating_category": "questionable",
            "threshold": 0.2,
            "rationale": "内衣类标签默认隔离，除非人工证据显式改判。",
        },
    ],
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
    parser.add_argument("--limit", type=int, default=20, help="Preview row count for command output.")
    parser.add_argument("--offset", type=int, default=0)
    parser.add_argument("--concurrency", type=int, default=16, help="Concurrent Bestdori texture fetches.")
    parser.add_argument("--tagger-batch-size", type=int, default=DEFAULT_TAGGER_BATCH_SIZE)
    parser.add_argument("--tagger-device", default="auto", help="auto, cuda, cuda:<n>, or cpu.")
    parser.add_argument("--skip-tagger", action="store_true", help="Build the base table without model inference.")
    parser.add_argument(
        "--skip-llm-review",
        action="store_true",
        help="Keep low-confidence rows in the review queue without running the LLM recheck step.",
    )
    parser.add_argument(
        "--run-llm-review",
        action="store_true",
        help="Run the external LLM recheck step for low-confidence tagger rows.",
    )
    parser.add_argument(
        "--llm-review-command",
        default=(
            "codex exec --dangerously-bypass-approvals-and-sandbox "
            "--output-last-message {output_path} -"
        ),
        help="Shell command template for review rows; receives a JSON payload on stdin.",
    )
    parser.add_argument(
        "--llm-review-batch-size",
        type=int,
        default=DEFAULT_LLM_REVIEW_BATCH_SIZE,
        help="Batch size for the optional LLM review step.",
    )
    parser.add_argument(
        "--llm-review-timeout",
        type=int,
        default=DEFAULT_LLM_REVIEW_TIMEOUT_SECONDS,
        help="Per-batch timeout in seconds for the optional LLM review step.",
    )
    parser.add_argument(
        "--render-completeness-csv",
        default="",
        help="Optional current-pool render completeness CSV generated by scripts/audit_bangdream_render_completeness.mjs.",
    )
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--skip-bestdori", action="store_true")
    parser.add_argument("--skip-gist-fetch", action="store_true")
    parser.add_argument("--verify", action="store_true", help="Verify existing outputs instead of rebuilding.")
    parser.add_argument(
        "--apply-llm-review-only",
        action="store_true",
        help="Load existing audit outputs, run/apply the LLM recheck step, then rewrite summaries.",
    )
    return parser.parse_args()


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def read_json(path: Path) -> Any:
    return json.loads(path.read_text("utf-8"))


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n", "utf-8")


def request_url(url: str, *, timeout: int = 90) -> tuple[bytes, dict[str, str], int]:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return response.read(), dict(response.headers), int(response.status)


def display_path(path: Path) -> str:
    try:
        return path.resolve().relative_to(REPO_ROOT).as_posix()
    except ValueError:
        return str(path.resolve())


def path_from_display(value: str, output_dir: Path) -> Path:
    text = normalize_text(value)
    if not text:
        return output_dir
    path = Path(text)
    if path.is_absolute():
        return path
    output_dir_names = {
        "audit.csv",
        "audit.parquet",
        "audit.schema.json",
        "evidence-index.csv",
        "evidence-index.parquet",
        "family-summary.csv",
        "llm-review-queue.csv",
        "llm-review-results.json",
        "render-completeness.csv",
        "render-completeness.json",
        "resource-intelligence-summary.json",
        "source-snapshot.json",
        "tag-rating-mapping-v1.json",
    }
    if text.startswith("raw/") or text in output_dir_names:
        return output_dir / text
    return REPO_ROOT / text


def write_gzip(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(path, "wb", compresslevel=9) as file:
        file.write(data)


def read_csv_bytes(data: bytes) -> pd.DataFrame:
    return pd.read_csv(io.BytesIO(data), keep_default_na=False)


def normalize_code(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, float):
        if pd.isna(value):
            return ""
        value = int(value)
    text = str(value).strip()
    if text.endswith(".0") and text.replace(".0", "").isdigit():
        text = text[:-2]
    return text.zfill(3) if text.isdigit() else text


def normalize_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and pd.isna(value):
        return ""
    return str(value)


def bool_from_yes_no(value: Any) -> bool:
    return normalize_text(value).strip().lower() in {"yes", "true", "1"}


def semicolon_json(value: Any) -> str:
    text = normalize_text(value).strip()
    if not text:
        return "[]"
    return json.dumps([item for item in text.split(";") if item], ensure_ascii=False)


def parse_json_list(value: Any) -> list[Any]:
    text = normalize_text(value).strip()
    if not text:
        return []
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        return [item for item in text.split(";") if item]
    return parsed if isinstance(parsed, list) else []


def preferred_server(available_servers: Any) -> str:
    servers = [item for item in normalize_text(available_servers).split(";") if item]
    for server in PREFERRED_SERVER_ORDER:
        if server in servers:
            return server
    return servers[0] if servers else ""


def load_pool() -> dict[str, Any]:
    return read_json(POOL_PATH)


def current_pool_variants(pool: dict[str, Any]) -> dict[str, dict[str, Any]]:
    variants: dict[str, dict[str, Any]] = {}
    for character in pool["characters"]:
        code = normalize_code(character["code"])
        upstream_code = AVE_MUJICA_LOCAL_TO_UPSTREAM.get(code, code)
        for variant in character["variants"]:
            model_key = f"{code}_{variant}"
            resource_key = f"bangdream_{model_key}"
            manifest_path = MODELS_DIR / model_key / "model.json"
            variants[resource_key] = {
                "resource_key": resource_key,
                "model_key": model_key,
                "local_code": code,
                "upstream_code": upstream_code,
                "variant": variant,
                "costume_key": f"{upstream_code}_{variant}",
                "family": infer_family(variant),
                "character_name_zh": character.get("name", ""),
                "character_name_ja": character.get("nameJa", ""),
                "band": character.get("band", ""),
                "manifest_path": manifest_path,
                "manifest_repo_path": manifest_path.relative_to(REPO_ROOT).as_posix(),
                "moc_structure": moc_structure_for_manifest(manifest_path),
            }
    return variants


def infer_family(variant: str) -> str:
    if "kirameki_festival" in variant:
        return "kirameki_festival"
    if "dream_festival" in variant:
        return "dream_festival"
    if "live_event" in variant or "event_" in variant:
        return "event_story"
    if "casual" in variant:
        return "casual"
    if "school" in variant:
        return "school"
    if "summer" in variant:
        return "summer"
    if "winter" in variant:
        return "winter"
    if "birthday" in variant:
        return "birthday"
    if "collabo" in variant:
        return "collabo"
    return "other"


def moc_structure_for_manifest(manifest_path: Path) -> str:
    try:
        manifest = read_json(manifest_path)
    except FileNotFoundError:
        return "unknown"
    model_path = normalize_text(manifest.get("model") or manifest.get("Model"))
    if model_path.startswith("data/") or "/data/" in model_path:
        return "data_model_moc"
    if model_path.startswith("live2d/") or "/live2d/" in model_path:
        return "legacy_live2d_moc"
    return "unknown"


def local_manifest_status(manifest_path: Path) -> str:
    if not manifest_path.exists():
        return "missing"
    try:
        manifest = read_json(manifest_path)
    except json.JSONDecodeError:
        return "invalid"
    referenced_files: list[str] = []
    for key in ["model", "physics"]:
        value = manifest.get(key) or manifest.get(key.capitalize())
        if value:
            referenced_files.append(str(value))
    for texture in manifest.get("textures", []) or []:
        referenced_files.append(str(texture))
    for expression in manifest.get("expressions", []) or []:
        if isinstance(expression, dict) and expression.get("file"):
            referenced_files.append(str(expression["file"]))
    for motions in (manifest.get("motions") or {}).values():
        if isinstance(motions, list):
            for motion in motions:
                if isinstance(motion, dict) and motion.get("file"):
                    referenced_files.append(str(motion["file"]))
    for item in referenced_files:
        if not (manifest_path.parent / item).exists():
            return "invalid"
    return "valid"


def fetch_gist(output_dir: Path, skip_fetch: bool) -> tuple[dict[str, bytes], dict[str, Any]]:
    raw_dir = output_dir / "raw/gist"
    if skip_fetch:
        candidates = list(raw_dir.glob("*/manifest.json"))
        if not candidates:
            raise SystemExit("--skip-gist-fetch requested but no raw gist manifest exists.")
        manifest_path = sorted(candidates)[-1]
        manifest = read_json(manifest_path)
        files = {}
        for name, info in manifest["files"].items():
            files[name] = gzip.decompress((manifest_path.parent / f"{name}.gz").read_bytes())
        return files, manifest

    data, _, status = request_url(GIST_API_URL)
    gist = json.loads(data.decode("utf-8"))
    revision = gist["history"][0]["version"]
    gist_dir = raw_dir / revision
    files: dict[str, bytes] = {}
    manifest_files: dict[str, Any] = {}

    for name in GIST_FILES:
        if name not in gist["files"]:
            raise RuntimeError(f"Gist file missing: {name}")
        file_info = gist["files"][name]
        raw, headers, raw_status = request_url(file_info["raw_url"])
        files[name] = raw
        gz_path = gist_dir / f"{name}.gz"
        write_gzip(gz_path, raw)
        manifest_files[name] = {
            "raw_url": file_info["raw_url"],
            "size": len(raw),
            "sha256": sha256_bytes(raw),
            "content_type": headers.get("Content-Type", ""),
            "http_status": raw_status,
            "raw_payload_path": gz_path.relative_to(output_dir).as_posix(),
        }

    manifest = {
        "gist_id": GIST_ID,
        "gist_api_url": GIST_API_URL,
        "gist_revision_sha": revision,
        "fetched_at": utc_now(),
        "http_status": status,
        "files": manifest_files,
    }
    write_json(gist_dir / "manifest.json", manifest)
    return files, manifest


def fetch_bestdori(output_dir: Path, skip_bestdori: bool) -> dict[str, Any]:
    if skip_bestdori:
        raw_root = output_dir / "raw/bestdori"
        candidates = [
            path for path in raw_root.iterdir() if path.is_dir()
        ] if raw_root.exists() else []
        if not candidates:
            raise SystemExit("--skip-bestdori requested but no raw Bestdori snapshot exists.")
        raw_dir = sorted(candidates)[-1]
        snapshot_id = raw_dir.name
        try:
            fetched_at = (
                datetime.strptime(snapshot_id, "%Y%m%dT%H%M%SZ")
                .replace(tzinfo=timezone.utc)
                .isoformat()
                .replace("+00:00", "Z")
            )
        except ValueError:
            fetched_at = snapshot_id
        resources = []
        resource_defs: list[tuple[str, str, str | None]] = []
        for server in BESTDORI_SERVERS:
            resource_defs.append(
                (
                    f"explorer_assets_{server}",
                    f"https://bestdori.com/api/explorer/{server}/assets/_info.json",
                    server,
                )
            )
        resource_defs.extend(
            [
                ("costumes_all_5", "https://bestdori.com/api/costumes/all.5.json", None),
                ("cards_all_5", "https://bestdori.com/api/cards/all.5.json", None),
                ("events_all_5", "https://bestdori.com/api/events/all.5.json", None),
                ("gacha_all_5", "https://bestdori.com/api/gacha/all.5.json", None),
            ]
        )
        for key, url, server in resource_defs:
            raw_path = raw_dir / f"{key}.json.gz"
            if not raw_path.exists():
                resources.append(
                    {
                        "key": key,
                        "api_url": url,
                        "api_version": "current",
                        "server": server or "",
                        "fetched_at": fetched_at,
                        "derived_fields_version": "v1",
                        "http_status": "missing",
                        "content_type": "",
                        "raw_payload_path": "",
                        "raw_payload_sha256": "",
                        "row_count": "",
                        "key_count": "",
                        "error": "raw Bestdori payload missing in local snapshot",
                    }
                )
                continue
            data = gzip.decompress(raw_path.read_bytes())
            row_count, key_count = json_counts(data)
            resources.append(
                {
                    "key": key,
                    "api_url": url,
                    "api_version": "current",
                    "server": server or "",
                    "fetched_at": fetched_at,
                    "derived_fields_version": "v1",
                    "http_status": "local_snapshot",
                    "content_type": "application/json",
                    "raw_payload_path": raw_path.relative_to(output_dir).as_posix(),
                    "raw_payload_sha256": sha256_bytes(data),
                    "row_count": row_count,
                    "key_count": key_count,
                    "error": "",
                }
            )
        return {"snapshot_id": snapshot_id, "fetched_at": fetched_at, "resources": resources}

    fetched_at = utc_now()
    snapshot_id = fetched_at.replace(":", "").replace("-", "")
    raw_dir = output_dir / "raw/bestdori" / snapshot_id
    resources = []

    urls: list[tuple[str, str, str | None]] = []
    for server in BESTDORI_SERVERS:
        urls.append(
            (
                f"explorer_assets_{server}",
                f"https://bestdori.com/api/explorer/{server}/assets/_info.json",
                server,
            )
        )
    urls.extend(
        [
            ("costumes_all_5", "https://bestdori.com/api/costumes/all.5.json", None),
            ("cards_all_5", "https://bestdori.com/api/cards/all.5.json", None),
            ("events_all_5", "https://bestdori.com/api/events/all.5.json", None),
            ("gacha_all_5", "https://bestdori.com/api/gacha/all.5.json", None),
        ]
    )

    for key, url, server in urls:
        raw_path = raw_dir / f"{key}.json.gz"
        resource: dict[str, Any] = {
            "key": key,
            "api_url": url,
            "api_version": "current",
            "server": server or "",
            "fetched_at": fetched_at,
            "derived_fields_version": "v1",
        }
        try:
            data, headers, status = request_url(url)
            write_gzip(raw_path, data)
            row_count, key_count = json_counts(data)
            resource.update(
                {
                    "http_status": status,
                    "content_type": headers.get("Content-Type", ""),
                    "raw_payload_path": raw_path.relative_to(output_dir).as_posix(),
                    "raw_payload_sha256": sha256_bytes(data),
                    "row_count": row_count,
                    "key_count": key_count,
                    "error": "",
                }
            )
        except (urllib.error.URLError, TimeoutError, RuntimeError) as error:
            resource.update(
                {
                    "http_status": "failed",
                    "content_type": "",
                    "raw_payload_path": "",
                    "raw_payload_sha256": "",
                    "row_count": "",
                    "key_count": "",
                    "error": str(error),
                }
            )
        resources.append(resource)

    return {"snapshot_id": snapshot_id, "fetched_at": fetched_at, "resources": resources}


def fetch_tagger_model_metadata() -> dict[str, Any]:
    fetched_at = utc_now()
    try:
        data, headers, status = request_url(HUGGINGFACE_MODEL_API_URL)
        payload = json.loads(data.decode("utf-8"))
        sibling_names = [item.get("rfilename", "") for item in payload.get("siblings", [])]
        required_files = [
            "selected_tags.csv",
            "categories.json",
            "thresholds.csv",
            "meta.json",
            "metrics.json",
        ]
        return {
            "model_id": TAGGER_MODEL_ID,
            "api_url": HUGGINGFACE_MODEL_API_URL,
            "plan_revision": TAGGER_MODEL_REVISION_PLAN,
            "plan_last_modified": TAGGER_MODEL_LAST_MODIFIED_PLAN,
            "audit_time_revision": payload.get("sha", ""),
            "audit_time_last_modified": payload.get("lastModified", ""),
            "license": payload.get("license") or payload.get("cardData", {}).get("license", ""),
            "revision_checked_at": fetched_at,
            "revision_check_status": "matched"
            if payload.get("sha") == TAGGER_MODEL_REVISION_PLAN
            else "changed",
            "requires_audit_time_recheck": True,
            "metadata_http_status": status,
            "metadata_content_type": headers.get("Content-Type", ""),
            "metadata_sha256": sha256_bytes(data),
            "required_artifact_files": required_files,
            "required_artifact_files_present": {
                name: name in sibling_names for name in required_files
            },
            "artifact_hash_status": "pending_full_model_download",
        }
    except (urllib.error.URLError, TimeoutError, RuntimeError, json.JSONDecodeError) as error:
        return {
            "model_id": TAGGER_MODEL_ID,
            "api_url": HUGGINGFACE_MODEL_API_URL,
            "plan_revision": TAGGER_MODEL_REVISION_PLAN,
            "plan_last_modified": TAGGER_MODEL_LAST_MODIFIED_PLAN,
            "audit_time_revision": TAGGER_MODEL_REVISION_PLAN,
            "audit_time_last_modified": TAGGER_MODEL_LAST_MODIFIED_PLAN,
            "license": "",
            "revision_checked_at": fetched_at,
            "revision_check_status": "failed",
            "requires_audit_time_recheck": True,
            "metadata_http_status": "failed",
            "metadata_content_type": "",
            "metadata_sha256": "",
            "required_artifact_files": [
                "selected_tags.csv",
                "categories.json",
                "thresholds.csv",
                "meta.json",
                "metrics.json",
            ],
            "required_artifact_files_present": {},
            "artifact_hash_status": "pending_full_model_download",
            "error": str(error),
        }


def json_counts(data: bytes) -> tuple[int | str, int | str]:
    try:
        value = json.loads(data.decode("utf-8"))
    except json.JSONDecodeError:
        return "", ""
    if isinstance(value, list):
        return len(value), ""
    if isinstance(value, dict):
        return "", len(value)
    return "", ""


def row_from_candidate(row: pd.Series, current_pool: dict[str, dict[str, Any]], source_snapshot_id: str) -> dict[str, Any]:
    local_code = normalize_code(row.get("local_code"))
    upstream_code = normalize_code(row.get("upstream_code"))
    variant = normalize_text(row.get("variant"))
    resource_key = f"bangdream_{local_code}_{variant}"
    model_key = f"{local_code}_{variant}"
    is_current_pool = resource_key in current_pool or bool_from_yes_no(row.get("currently_in_pool"))
    manifest_info = current_pool.get(resource_key, {})
    render_mode = "current_pool_query" if is_current_pool else "audit_manifest_path"
    converted_manifest_path = manifest_info.get("manifest_repo_path", "")
    validate_status = "passed" if is_current_pool and manifest_info else "pending"
    manifest_status = local_manifest_status(REPO_ROOT / converted_manifest_path) if converted_manifest_path else "pending"
    row_kind = "current_pool" if is_current_pool else "covered_candidate"
    evidence_id = f"raw-gist-candidate-{int(row.name) + 2}"
    base = {
        "resource_key": resource_key,
        "resource_key_strategy": "local_code_variant",
        "model_key": model_key,
        "local_code": local_code,
        "upstream_code": upstream_code,
        "variant": variant,
        "costume_key": normalize_text(row.get("costume_key")),
        "family": normalize_text(row.get("family")),
        "character_name_zh": normalize_text(row.get("name_zh")),
        "character_name_ja": normalize_text(row.get("name_ja")),
        "band": normalize_text(row.get("band")),
        "row_kind": row_kind,
        "is_current_pool": is_current_pool,
        "is_covered_candidate": True,
        "is_union_reference": True,
        "gist_source_file": "candidate-resource-intelligence.csv",
        "gist_row_number": int(row.name) + 2,
        "source_snapshot_id": source_snapshot_id,
        "bestdori_available_servers": semicolon_json(row.get("available_servers")),
        "bestdori_available_server_count": safe_int(row.get("available_server_count")),
        "bestdori_preferred_server": preferred_server(row.get("available_servers")),
        "bestdori_build_data_url": normalize_text(row.get("bestdori_buildData_url_example")),
        "bestdori_build_data_content_type": "",
        "bestdori_build_data_sha256": "",
        "tagger_visual_evidence_status": "pending",
        "tagger_visual_evidence_count": 0,
        "tagger_visual_evidence_primary_url": "",
        "tagger_visual_evidence_primary_sha256": "",
        "bestdori_costume_metadata_found": bool_from_yes_no(row.get("bestdori_costume_metadata_found")),
        "bestdori_costume_detail_found": bool_from_yes_no(row.get("bestdori_costume_detail_found")),
        "bestdori_costume_id": normalize_text(row.get("bestdori_costume_id")),
        "bestdori_costume_raw_ref": "",
        "bestdori_costume_detail_raw_ref": "",
        "bestdori_card_raw_refs": json_ref_list(row.get("card_ids"), "bestdori-card"),
        "bestdori_event_raw_refs": json_ref_list(row.get("event_ids"), "bestdori-event"),
        "bestdori_gacha_raw_refs": json_ref_list(row.get("gacha_ids"), "bestdori-gacha"),
        "bestdori_card_match_method": normalize_text(row.get("card_match_method")),
        "bestdori_mapping_notes": "",
        "download_status": "skipped" if is_current_pool else "pending",
        "downloaded_at": "",
        "download_tool": "",
        "download_tool_version": "",
        "download_source_url": normalize_text(row.get("bestdori_buildData_url_example")),
        "download_output_path": "",
        "download_error": "",
        "conversion_status": "converted" if is_current_pool else "pending",
        "conversion_tool": "current_repository_pool" if is_current_pool else "",
        "conversion_tool_version": "",
        "converted_model_path": manifest_info.get("model_key", ""),
        "converted_manifest_path": converted_manifest_path,
        "conversion_error": "",
        "manifest_status": manifest_status,
        "moc_structure": manifest_info.get("moc_structure", "unknown" if is_current_pool else ""),
        "validate_status": validate_status,
        "validate_log_ref": "",
        "downloader_invocation_mode": "",
        "downloader_command": "",
        "downloader_args_json": "{}",
        "downloader_stdout_ref": "",
        "downloader_stderr_ref": "",
        "downloader_exit_code": "",
        "render_status": "pending",
        "render_complete_person_decision": "not_run",
        "render_complete_person_reason": "",
        "render_nonblank_ratio": "",
        "render_bounds_width": "",
        "render_bounds_height": "",
        "render_bounds_inside_ratio": "",
        "rendered_at": "",
        "render_mode": render_mode,
        "render_url": "",
        "render_url_param": resource_key if is_current_pool else "",
        "render_manifest_path": converted_manifest_path,
        "render_viewport_width": 1440,
        "render_viewport_height": 900,
        "render_device_scale_factor": 1,
        "render_browser": "",
        "render_browser_version": "",
        "render_os": platform.platform(),
        "render_seed": "",
        "render_frame_index": "",
        "render_settle_ms": "",
        "render_motion_group": "",
        "render_expression": "",
        "render_pose_policy": "",
        "render_image_path": "",
        "render_image_sha256_primary": "",
        "render_image_sha256_desktop": "",
        "render_image_sha256_mobile": "",
        "render_canvas_sha256": "",
        "render_log_ref": "",
        "render_error": "",
        "tagger_model_id": TAGGER_MODEL_ID,
        "tagger_model_revision": TAGGER_MODEL_REVISION_PLAN,
        "tagger_model_license": "",
        "tagger_model_artifact_sha256": "",
        "tagger_selected_tags_sha256": "",
        "tagger_categories_sha256": "",
        "tagger_thresholds_sha256": "",
        "tagger_runtime": "",
        "tagger_inference_device": "",
        "tagger_inference_batch_size": "",
        "tagger_top_tags_top30_json": "[]",
        "tagger_policy_tag_probs_json": "{}",
        "tagger_full_probs_ref": "",
        "tagger_inference_error": "",
        "rating_signal_source": "unavailable",
        "rating_label_mapping_version": MAPPING_VERSION,
        "rating_score_general": "",
        "rating_score_sensitive": "",
        "rating_score_questionable": "",
        "rating_score_explicit": "",
        "rating_predicted_label": "unknown",
        "rating_confidence": "",
        "rating_margin": "",
        "rating_entropy": "",
        "needs_llm_review": True,
        "llm_review_reason": "render_and_tagger_pending",
        "llm_review_status": "pending",
        "llm_review_model": "",
        "llm_review_label": "",
        "llm_review_confidence": "",
        "llm_review_notes": "",
        "needs_human_review": True,
        "human_review_status": "pending",
        "human_review_label": "",
        "human_review_notes": "",
        "final_content_rating": "unknown",
        "final_rating_source": "policy_default",
        "content_policy_decision": "pending",
        "eligible_for_default_pool": False,
        "eligible_for_sensitive_easter_egg_pool": False,
        "exclusion_reason": "content review pending",
        "evidence_refs": json.dumps([evidence_id], ensure_ascii=False),
    }
    for column in row.index:
        base[f"gist_{column}"] = normalize_text(row[column])
    return base


def row_from_union_only(row: pd.Series, source_snapshot_id: str) -> dict[str, Any]:
    prefix = normalize_code(row.get("prefix"))
    variant = normalize_text(row.get("variant"))
    costume_key = normalize_text(row.get("costume_key"))
    if prefix:
        resource_key = f"bangdream_upstream_{prefix}_{variant}"
        strategy = "upstream_code_variant"
    else:
        resource_key = f"bangdream_upstream_{costume_key}"
        strategy = "upstream_costume_key_fallback"
    evidence_id = f"raw-gist-union-{int(row.name) + 2}"
    return {
        "resource_key": resource_key,
        "resource_key_strategy": strategy,
        "model_key": "",
        "local_code": "",
        "upstream_code": prefix,
        "variant": variant,
        "costume_key": costume_key,
        "family": normalize_text(row.get("family")),
        "character_name_zh": "",
        "character_name_ja": "",
        "band": "",
        "row_kind": "union_only",
        "is_current_pool": False,
        "is_covered_candidate": False,
        "is_union_reference": True,
        "gist_source_file": "bestdori-live2d-chara-union.csv",
        "gist_row_number": int(row.name) + 2,
        "source_snapshot_id": source_snapshot_id,
        "bestdori_available_servers": semicolon_json(row.get("available_servers")),
        "bestdori_available_server_count": len([x for x in normalize_text(row.get("available_servers")).split(";") if x]),
        "bestdori_preferred_server": preferred_server(row.get("available_servers")),
        "bestdori_build_data_url": normalize_text(row.get("buildData_url_example")),
        "bestdori_build_data_content_type": "",
        "bestdori_build_data_sha256": "",
        "tagger_visual_evidence_status": "pending",
        "tagger_visual_evidence_count": 0,
        "tagger_visual_evidence_primary_url": "",
        "tagger_visual_evidence_primary_sha256": "",
        "bestdori_costume_metadata_found": False,
        "bestdori_costume_detail_found": False,
        "bestdori_costume_id": "",
        "bestdori_costume_raw_ref": "",
        "bestdori_costume_detail_raw_ref": "",
        "bestdori_card_raw_refs": "[]",
        "bestdori_event_raw_refs": "[]",
        "bestdori_gacha_raw_refs": "[]",
        "bestdori_card_match_method": "",
        "bestdori_mapping_notes": "union reference outside covered local characters",
        "download_status": "pending",
        "downloaded_at": "",
        "download_tool": "",
        "download_tool_version": "",
        "download_source_url": normalize_text(row.get("buildData_url_example")),
        "download_output_path": "",
        "download_error": "",
        "conversion_status": "pending",
        "conversion_tool": "",
        "conversion_tool_version": "",
        "converted_model_path": "",
        "converted_manifest_path": "",
        "conversion_error": "",
        "manifest_status": "pending",
        "moc_structure": "",
        "validate_status": "pending",
        "validate_log_ref": "",
        "downloader_invocation_mode": "",
        "downloader_command": "",
        "downloader_args_json": "{}",
        "downloader_stdout_ref": "",
        "downloader_stderr_ref": "",
        "downloader_exit_code": "",
        "render_status": "pending",
        "render_complete_person_decision": "not_run",
        "render_complete_person_reason": "",
        "render_nonblank_ratio": "",
        "render_bounds_width": "",
        "render_bounds_height": "",
        "render_bounds_inside_ratio": "",
        "rendered_at": "",
        "render_mode": "audit_manifest_path",
        "render_url": "",
        "render_url_param": "",
        "render_manifest_path": "",
        "render_viewport_width": 1440,
        "render_viewport_height": 900,
        "render_device_scale_factor": 1,
        "render_browser": "",
        "render_browser_version": "",
        "render_os": platform.platform(),
        "render_seed": "",
        "render_frame_index": "",
        "render_settle_ms": "",
        "render_motion_group": "",
        "render_expression": "",
        "render_pose_policy": "",
        "render_image_path": "",
        "render_image_sha256_primary": "",
        "render_image_sha256_desktop": "",
        "render_image_sha256_mobile": "",
        "render_canvas_sha256": "",
        "render_log_ref": "",
        "render_error": "",
        "tagger_model_id": TAGGER_MODEL_ID,
        "tagger_model_revision": TAGGER_MODEL_REVISION_PLAN,
        "tagger_model_license": "",
        "tagger_model_artifact_sha256": "",
        "tagger_selected_tags_sha256": "",
        "tagger_categories_sha256": "",
        "tagger_thresholds_sha256": "",
        "tagger_runtime": "",
        "tagger_inference_device": "",
        "tagger_inference_batch_size": "",
        "tagger_top_tags_top30_json": "[]",
        "tagger_policy_tag_probs_json": "{}",
        "tagger_full_probs_ref": "",
        "tagger_inference_error": "",
        "rating_signal_source": "unavailable",
        "rating_label_mapping_version": MAPPING_VERSION,
        "rating_score_general": "",
        "rating_score_sensitive": "",
        "rating_score_questionable": "",
        "rating_score_explicit": "",
        "rating_predicted_label": "unknown",
        "rating_confidence": "",
        "rating_margin": "",
        "rating_entropy": "",
        "needs_llm_review": True,
        "llm_review_reason": "union reference requires candidate conversion before rating",
        "llm_review_status": "pending",
        "llm_review_model": "",
        "llm_review_label": "",
        "llm_review_confidence": "",
        "llm_review_notes": "",
        "needs_human_review": True,
        "human_review_status": "pending",
        "human_review_label": "",
        "human_review_notes": "",
        "final_content_rating": "unknown",
        "final_rating_source": "policy_default",
        "content_policy_decision": "pending",
        "eligible_for_default_pool": False,
        "eligible_for_sensitive_easter_egg_pool": False,
        "exclusion_reason": "outside covered local character set; content review pending",
        "evidence_refs": json.dumps([evidence_id], ensure_ascii=False),
    }


def safe_int(value: Any) -> int | str:
    text = normalize_text(value).strip()
    if not text:
        return ""
    try:
        return int(float(text))
    except ValueError:
        return ""


def safe_float(value: Any) -> float | str:
    text = normalize_text(value).strip()
    if not text:
        return ""
    try:
        return float(text)
    except ValueError:
        return ""


def json_ref_list(value: Any, prefix: str) -> str:
    text = normalize_text(value).strip()
    if not text:
        return "[]"
    parts = [item.strip() for item in text.replace(",", ";").split(";") if item.strip()]
    return json.dumps([f"{prefix}-{part}" for part in parts], ensure_ascii=False)


def bundle_base_url(build_data_url: str, bundle_name: str) -> str:
    parsed = urllib.parse.urlparse(build_data_url)
    parts = parsed.path.split("/")
    try:
        assets_index = parts.index("assets")
    except ValueError:
        return build_data_url.rsplit("/", 1)[0]
    if len(parts) <= assets_index + 1:
        return build_data_url.rsplit("/", 1)[0]

    server = parts[assets_index + 1]
    bundle_path = bundle_name.strip("/")
    if bundle_path.endswith("_rip"):
        rip_path = bundle_path
    else:
        rip_path = f"{bundle_path}_rip"
    path_prefix = "/".join(parts[: assets_index + 2])
    return urllib.parse.urlunparse(parsed._replace(path=f"{path_prefix}/{rip_path}"))


def candidate_build_data_urls(build_data_url: str, available_servers: Any) -> list[str]:
    servers = [item for item in normalize_text(available_servers).split(";") if item]
    if not servers:
        servers = list(BESTDORI_SERVERS)
    ordered_servers = []
    for server in [preferred_server(available_servers), *BESTDORI_SERVERS, *servers]:
        if server and server not in ordered_servers:
            ordered_servers.append(server)
    candidates = []
    for server in ordered_servers:
        parsed = urllib.parse.urlparse(build_data_url)
        parts = parsed.path.split("/")
        if "assets" not in parts:
            candidates.append(build_data_url)
            continue
        parts[parts.index("assets") + 1] = server
        candidate = urllib.parse.urlunparse(parsed._replace(path="/".join(parts)))
        candidates.append(candidate)
    # Preserve explicit URL first, then normalized server fallbacks.
    deduped = []
    for candidate in [build_data_url, *candidates]:
        if candidate not in deduped:
            deduped.append(candidate)
    return deduped


def texture_file_candidates(file_name: str) -> list[str]:
    candidates = [file_name]
    if not Path(file_name).suffix:
        candidates.insert(0, f"{file_name}.png")
    return list(dict.fromkeys(candidates))


def build_data_texture_url_candidates(build_data_url: str, build_data: dict[str, Any]) -> list[list[str]]:
    current_base_url = build_data_url.rsplit("/", 1)[0]
    textures = build_data.get("Base", {}).get("textures") or build_data.get("textures") or []
    groups = []
    for texture in textures:
        if not isinstance(texture, dict):
            continue
        file_name = normalize_text(texture.get("fileName") or texture.get("file") or texture.get("name"))
        if not file_name:
            continue
        bundle_name = normalize_text(texture.get("bundleName"))
        base_urls = [bundle_base_url(build_data_url, bundle_name)] if bundle_name else []
        base_urls.append(current_base_url)
        candidates = []
        for base_url in list(dict.fromkeys(base_urls)):
            for candidate_name in texture_file_candidates(file_name):
                candidates.append(f"{base_url}/{urllib.parse.quote(candidate_name)}")
        groups.append(list(dict.fromkeys(candidates)))
    return groups


def texture_cache_path(resource_key: str, index: int, texture_url: str) -> Path:
    suffix = Path(urllib.parse.urlparse(texture_url).path).suffix or ".png"
    digest = hashlib.sha256(texture_url.encode("utf-8")).hexdigest()[:16]
    return TEXTURE_CACHE_DIR / resource_key / f"texture_{index:02d}_{digest}{suffix}"


def fetch_visual_evidence_for_row(row: dict[str, Any]) -> dict[str, Any]:
    resource_key = normalize_text(row.get("resource_key"))
    build_data_url = normalize_text(row.get("bestdori_build_data_url") or row.get("download_source_url"))
    if not build_data_url:
        return {
            "resource_key": resource_key,
            "status": "missing_build_data_url",
            "error": "missing buildData URL",
            "items": [],
        }

    try:
        last_build_error = ""
        build_data_raw = b""
        headers: dict[str, str] = {}
        status = 0
        resolved_build_data_url = ""
        for candidate_url in candidate_build_data_urls(
            build_data_url,
            row.get("gist_available_servers") or row.get("bestdori_available_servers"),
        ):
            try:
                candidate_raw, candidate_headers, candidate_status = request_url(candidate_url, timeout=60)
                content_type = candidate_headers.get("Content-Type", "")
                if candidate_status == 200 and b"<!DOCTYPE" not in candidate_raw[:128].upper():
                    build_data_raw = candidate_raw
                    headers = candidate_headers
                    status = candidate_status
                    resolved_build_data_url = candidate_url
                    break
                last_build_error = (
                    f"buildData fetch returned non-asset payload: url={candidate_url}, "
                    f"status={candidate_status}, content_type={content_type}"
                )
            except Exception as error:  # noqa: BLE001 - try the next server fallback.
                last_build_error = f"buildData fetch failed: url={candidate_url}, error={error}"
        if not build_data_raw:
            raise RuntimeError(last_build_error or "buildData fetch failed for all server fallbacks")
        content_type = headers.get("Content-Type", "")
        build_data = json.loads(build_data_raw.decode("utf-8"))
        texture_url_groups = build_data_texture_url_candidates(resolved_build_data_url, build_data)
        if not texture_url_groups:
            raise RuntimeError("buildData contains no texture references")
        items = []
        for index, texture_url_candidates in enumerate(texture_url_groups):
            texture_raw = b""
            texture_type = ""
            texture_url = ""
            last_error = ""
            for candidate_url in texture_url_candidates:
                try:
                    candidate_raw, texture_headers, texture_status = request_url(candidate_url, timeout=90)
                    candidate_type = texture_headers.get("Content-Type", "")
                    if texture_status == 200 and candidate_raw.startswith(b"\x89PNG"):
                        texture_raw = candidate_raw
                        texture_type = candidate_type
                        texture_url = candidate_url
                        break
                    last_error = (
                        f"texture fetch returned non-PNG payload: url={candidate_url}, "
                        f"status={texture_status}, content_type={candidate_type}"
                    )
                except Exception as error:  # noqa: BLE001 - keep trying per-texture fallbacks.
                    last_error = f"texture fetch failed: url={candidate_url}, error={error}"
            if not texture_raw:
                raise RuntimeError(last_error or "texture fetch failed for all candidate URLs")
            cache_path = texture_cache_path(resource_key, index, texture_url)
            cache_path.parent.mkdir(parents=True, exist_ok=True)
            cache_path.write_bytes(texture_raw)
            items.append(
                {
                    "url": texture_url,
                    "path": cache_path.as_posix(),
                    "repo_path": display_path(cache_path),
                    "sha256": sha256_bytes(texture_raw),
                    "content_type": texture_type,
                    "size_bytes": len(texture_raw),
                }
            )
        return {
            "resource_key": resource_key,
            "status": "ready",
            "build_data_url": resolved_build_data_url,
            "build_data_sha256": sha256_bytes(build_data_raw),
            "build_data_content_type": content_type,
            "items": items,
            "error": "",
        }
    except Exception as error:  # noqa: BLE001 - per-row audit status must preserve unexpected failures.
        return {
            "resource_key": resource_key,
            "status": "failed",
            "error": str(error),
            "items": [],
        }


def collect_visual_evidence(audit: pd.DataFrame, concurrency: int) -> dict[str, dict[str, Any]]:
    rows = audit.to_dict("records")
    evidence: dict[str, dict[str, Any]] = {}
    TEXTURE_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    workers = max(1, concurrency)
    print(f"Fetching visual evidence for {len(rows)} rows with concurrency={workers}...", file=sys.stderr, flush=True)
    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = [executor.submit(fetch_visual_evidence_for_row, row) for row in rows]
        for completed_count, future in enumerate(as_completed(futures), start=1):
            result = future.result()
            evidence[result["resource_key"]] = result
            if completed_count == len(rows) or completed_count % 100 == 0:
                ready_count = sum(1 for value in evidence.values() if value.get("items"))
                failed_count = sum(1 for value in evidence.values() if value.get("status") == "failed")
                print(
                    f"Visual evidence progress: {completed_count}/{len(rows)} "
                    f"ready={ready_count} failed={failed_count}",
                    file=sys.stderr,
                    flush=True,
                )
    return evidence


def load_tagger_artifacts() -> dict[str, Any]:
    TAGGER_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    configure_local_model_caches()
    try:
        from huggingface_hub import hf_hub_download
    except ImportError as error:
        raise SystemExit("Missing Python dependency. Install huggingface_hub before running tagger audit.") from error

    artifact_names = [
        "selected_tags.csv",
        "categories.json",
        "thresholds.csv",
        "meta.json",
        "metrics.json",
        "preprocess.json",
        "config.json",
    ]
    artifacts = {}
    for name in artifact_names:
        path = Path(
            hf_hub_download(
                TAGGER_MODEL_ID,
                name,
                revision=TAGGER_MODEL_REVISION_PLAN,
                cache_dir=os.environ["HF_HUB_CACHE"],
            )
        )
        artifacts[name] = {
            "path": path,
            "sha256": sha256_bytes(path.read_bytes()),
        }
    selected_tags = pd.read_csv(artifacts["selected_tags.csv"]["path"])
    tag_names = [normalize_text(value) for value in selected_tags["name"].tolist()]
    rating_thresholds = {}
    for label in RATING_LABELS:
        match = selected_tags[selected_tags["name"] == label]
        rating_thresholds[label] = float(match.iloc[0]["best_threshold"]) if not match.empty else 0.5
    policy_tags = sorted({rule["tag_name"] for rule in TAG_MAPPING["rules"] if rule.get("tag_name")})
    return {
        "files": artifacts,
        "selected_tags": selected_tags,
        "tag_names": tag_names,
        "rating_thresholds": rating_thresholds,
        "policy_tags": policy_tags,
    }


def open_texture_for_tagger(path: str):
    from PIL import Image

    image = Image.open(path).convert("RGBA")
    background = Image.new("RGBA", image.size, "WHITE")
    background.alpha_composite(image)
    return background.convert("RGB")


def choose_tagger_device(requested: str) -> str:
    import torch

    if requested == "auto":
        return "cuda:0" if torch.cuda.is_available() else "cpu"
    if requested == "cuda":
        return "cuda:0"
    return requested


def rating_policy_decision(label: str) -> tuple[str, bool, bool, str]:
    if label == "general":
        return "allow_default", True, False, ""
    if label == "sensitive":
        return "allow_sensitive_easter_egg", False, True, ""
    if label == "questionable":
        return "quarantine", False, False, "questionable content rating"
    if label == "explicit":
        return "reject", False, False, "explicit content rating"
    return "pending", False, False, "content review pending"


def normalized_entropy(scores: list[float]) -> float:
    import math

    total = sum(max(value, 0.0) for value in scores)
    if total <= 0:
        return 0.0
    entropy = -sum(
        (max(value, 0.0) / total) * math.log(max(max(value, 0.0) / total, 1e-12))
        for value in scores
    )
    return float(entropy / math.log(len(scores)))


def classify_tagger_result(
    probs: list[float],
    tag_names: list[str],
    rating_thresholds: dict[str, float],
    policy_tags: list[str],
) -> dict[str, Any]:
    rating_scores = {label: float(probs[index]) for index, label in enumerate(RATING_LABELS)}
    ordered_ratings = sorted(rating_scores.items(), key=lambda item: item[1], reverse=True)
    label, confidence = ordered_ratings[0]
    margin = confidence - ordered_ratings[1][1]
    threshold = rating_thresholds.get(label, 0.5)
    low_confidence = confidence < threshold or margin < TAG_MAPPING["low_confidence"]["direct_rating_label"]["margin_threshold"]
    top_indices = sorted(range(len(probs)), key=lambda index: probs[index], reverse=True)[:POLICY_TAG_TOP_LIMIT]
    top_tags = [
        {"tag": tag_names[index], "score": round(float(probs[index]), 6)}
        for index in top_indices
    ]
    policy_index = {tag: index for index, tag in enumerate(tag_names)}
    policy_probs = {
        tag: round(float(probs[policy_index[tag]]), 6)
        for tag in policy_tags
        if tag in policy_index
    }
    return {
        "rating_scores": rating_scores,
        "label": label,
        "confidence": float(confidence),
        "margin": float(margin),
        "entropy": normalized_entropy([rating_scores[label] for label in RATING_LABELS]),
        "low_confidence": bool(low_confidence),
        "top_tags": top_tags,
        "policy_probs": policy_probs,
        "threshold": threshold,
    }


def run_tagger_scan(
    audit: pd.DataFrame,
    visual_evidence: dict[str, dict[str, Any]],
    *,
    device_name: str,
    batch_size: int,
) -> tuple[pd.DataFrame, dict[str, Any]]:
    try:
        import timm
        import torch
        from timm.data import create_transform, resolve_data_config
    except ImportError as error:
        raise SystemExit("Missing Python dependency. Install torch, torchvision and timm before running tagger audit.") from error

    artifacts = load_tagger_artifacts()
    device = choose_tagger_device(device_name)
    model = timm.create_model(TAGGER_MODEL_NAME, pretrained=True).eval().to(device)
    data_config = resolve_data_config(model.pretrained_cfg, model=model)
    transform = create_transform(**data_config, is_training=False)
    tag_names = artifacts["tag_names"]
    rating_thresholds = artifacts["rating_thresholds"]
    policy_tags = artifacts["policy_tags"]

    jobs: list[dict[str, Any]] = []
    for idx, row in audit.iterrows():
        evidence = visual_evidence.get(row["resource_key"], {})
        items = evidence.get("items") or []
        audit.at[idx, "tagger_visual_evidence_status"] = evidence.get("status", "failed")
        audit.at[idx, "tagger_visual_evidence_count"] = len(items)
        if evidence.get("build_data_url"):
            audit.at[idx, "bestdori_build_data_url"] = evidence["build_data_url"]
            audit.at[idx, "download_source_url"] = evidence["build_data_url"]
        if evidence.get("build_data_sha256"):
            audit.at[idx, "bestdori_build_data_sha256"] = evidence["build_data_sha256"]
        if evidence.get("build_data_content_type"):
            audit.at[idx, "bestdori_build_data_content_type"] = evidence["build_data_content_type"]
        if items:
            audit.at[idx, "tagger_visual_evidence_primary_url"] = items[0]["url"]
            audit.at[idx, "tagger_visual_evidence_primary_sha256"] = items[0]["sha256"]
            jobs.append({"row_index": idx, "resource_key": row["resource_key"], "path": items[0]["path"], "evidence": evidence})
        else:
            audit.at[idx, "tagger_inference_error"] = evidence.get("error", "visual evidence unavailable")
            audit.at[idx, "llm_review_reason"] = "visual_evidence_unavailable"
            audit.at[idx, "llm_review_status"] = "blocked"

    scanned = 0
    for offset in range(0, len(jobs), max(1, batch_size)):
        batch = jobs[offset : offset + max(1, batch_size)]
        print(
            f"Tagger progress: rows {offset + 1}-{offset + len(batch)} / {len(jobs)}",
            file=sys.stderr,
            flush=True,
        )
        images = [transform(open_texture_for_tagger(job["path"])) for job in batch]
        tensor = torch.stack(images).to(device)
        with torch.inference_mode():
            probs_tensor = torch.sigmoid(model(tensor)).detach().float().cpu()
        for job, probs_row in zip(batch, probs_tensor):
            idx = job["row_index"]
            probs = [float(value) for value in probs_row.tolist()]
            result = classify_tagger_result(probs, tag_names, rating_thresholds, policy_tags)
            scores = result["rating_scores"]
            label = result["label"]
            decision, eligible_default, eligible_sensitive, exclusion = rating_policy_decision(label)
            needs_llm = result["low_confidence"]
            final_rating = "unknown" if needs_llm else label
            if needs_llm:
                decision, eligible_default, eligible_sensitive, exclusion = (
                    "pending",
                    False,
                    False,
                    f"low confidence tagger rating: {label} score={result['confidence']:.6f} margin={result['margin']:.6f}",
                )
            audit.at[idx, "tagger_model_id"] = TAGGER_MODEL_ID
            audit.at[idx, "tagger_model_revision"] = TAGGER_MODEL_REVISION_PLAN
            audit.at[idx, "tagger_model_license"] = "gpl-3.0"
            audit.at[idx, "tagger_selected_tags_sha256"] = artifacts["files"]["selected_tags.csv"]["sha256"]
            audit.at[idx, "tagger_categories_sha256"] = artifacts["files"]["categories.json"]["sha256"]
            audit.at[idx, "tagger_thresholds_sha256"] = artifacts["files"]["thresholds.csv"]["sha256"]
            audit.at[idx, "tagger_runtime"] = "torch_timm"
            audit.at[idx, "tagger_inference_device"] = device
            audit.at[idx, "tagger_inference_batch_size"] = max(1, batch_size)
            audit.at[idx, "tagger_top_tags_top30_json"] = json.dumps(result["top_tags"], ensure_ascii=False)
            audit.at[idx, "tagger_policy_tag_probs_json"] = json.dumps(result["policy_probs"], ensure_ascii=False, sort_keys=True)
            audit.at[idx, "tagger_inference_error"] = ""
            audit.at[idx, "rating_signal_source"] = "direct_rating_label"
            audit.at[idx, "rating_score_general"] = scores["general"]
            audit.at[idx, "rating_score_sensitive"] = scores["sensitive"]
            audit.at[idx, "rating_score_questionable"] = scores["questionable"]
            audit.at[idx, "rating_score_explicit"] = scores["explicit"]
            audit.at[idx, "rating_predicted_label"] = label
            audit.at[idx, "rating_confidence"] = result["confidence"]
            audit.at[idx, "rating_margin"] = result["margin"]
            audit.at[idx, "rating_entropy"] = result["entropy"]
            audit.at[idx, "needs_llm_review"] = needs_llm
            audit.at[idx, "llm_review_reason"] = (
                f"low_confidence_direct_rating threshold={result['threshold']:.2f}"
                if needs_llm
                else "tagger_confident"
            )
            audit.at[idx, "llm_review_status"] = "pending" if needs_llm else "not_required"
            audit.at[idx, "needs_human_review"] = False
            audit.at[idx, "human_review_status"] = "not_required_tagger_confident" if not needs_llm else "pending"
            audit.at[idx, "final_content_rating"] = final_rating
            audit.at[idx, "final_rating_source"] = "tagger_direct_rating" if not needs_llm else "pending_llm_review"
            audit.at[idx, "content_policy_decision"] = decision
            audit.at[idx, "eligible_for_default_pool"] = eligible_default
            audit.at[idx, "eligible_for_sensitive_easter_egg_pool"] = eligible_sensitive
            audit.at[idx, "exclusion_reason"] = exclusion
            scanned += 1

    summary = {
        "status": "completed",
        "model_id": TAGGER_MODEL_ID,
        "model_revision": TAGGER_MODEL_REVISION_PLAN,
        "runtime": "torch_timm",
        "device": device,
        "batch_size": max(1, batch_size),
        "scanned_rows": scanned,
        "visual_evidence_ready_rows": sum(1 for value in visual_evidence.values() if value.get("items")),
        "artifact_sha256": {name: info["sha256"] for name, info in artifacts["files"].items()},
        "rating_thresholds": rating_thresholds,
    }
    return audit, summary


def build_llm_review_queue(audit: pd.DataFrame) -> pd.DataFrame:
    queue = audit[
        (audit["needs_llm_review"] == True) & (audit["llm_review_status"] == "pending")
    ].copy()  # noqa: E712 - pandas identity check.
    columns = [
        "resource_key",
        "row_kind",
        "character_name_zh",
        "character_name_ja",
        "band",
        "costume_key",
        "family",
        "bestdori_build_data_url",
        "tagger_visual_evidence_primary_url",
        "tagger_visual_evidence_primary_sha256",
        "rating_predicted_label",
        "rating_score_general",
        "rating_score_sensitive",
        "rating_score_questionable",
        "rating_score_explicit",
        "rating_confidence",
        "rating_margin",
        "llm_review_reason",
        "tagger_top_tags_top30_json",
        "tagger_policy_tag_probs_json",
    ]
    return queue[columns].reset_index(drop=True)


def llm_review_prompt(rows: list[dict[str, Any]]) -> str:
    payload = {
        "task": (
            "复核 BanG Dream Live2D 资源的 Danbooru-style 内容分级。"
            "输入行已经由 animetimm tagger 给出 direct rating 分数；"
            "只根据 tagger 分数、top tags、policy tags、family/variant 字段做保守复核。"
            "不能看图时必须 fail-closed；如果证据不足，输出 unknown。"
        ),
        "labels": CONTENT_RATINGS,
        "policy": {
            "general": "完全 SFW，允许默认池。",
            "sensitive": "轻度性感/泳装/暗示/轻度不适，只允许低概率彩蛋池。",
            "questionable": "软色情、明显裸露或图形化暴力，隔离。",
            "explicit": "明确性行为、暴露性器官或极端暴力，拒绝。",
            "unknown": "证据不足或冲突，保持待人工复核。",
        },
        "required_output": {
            "items": [
                {
                    "resource_key": "string",
                    "label": "general|sensitive|questionable|explicit|unknown",
                    "confidence": "number from 0 to 1",
                    "notes": "short Chinese reason",
                }
            ]
        },
        "rows": rows,
    }
    return (
        "只输出一个 JSON 对象，不要 Markdown，不要额外解释。\n"
        + json.dumps(payload, ensure_ascii=False, indent=2)
    )


def extract_json_object(text: str) -> dict[str, Any]:
    text = text.strip()
    if not text:
        raise ValueError("empty LLM output")
    try:
        value = json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start < 0 or end < start:
            raise
        value = json.loads(text[start : end + 1])
    if not isinstance(value, dict):
        raise ValueError("LLM output is not a JSON object")
    return value


def normalize_llm_label(value: Any) -> str:
    label = normalize_text(value).strip().lower()
    return label if label in CONTENT_RATINGS else "unknown"


def run_llm_review_command(
    command_template: str,
    prompt: str,
    *,
    output_dir: Path,
    batch_index: int,
    timeout_seconds: int,
) -> tuple[dict[str, Any] | None, dict[str, Any]]:
    tmp_dir = output_dir / ".tmp"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    output_path = tmp_dir / f"llm-review-batch-{batch_index:04d}.json"
    command = command_template.format(output_path=shlex.quote(str(output_path)))
    started = time.time()
    completed_stdout = ""
    completed_stderr = ""
    try:
        process = subprocess.Popen(
            command,
            shell=True,
            cwd=REPO_ROOT,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            start_new_session=True,
        )
        try:
            completed_stdout, completed_stderr = process.communicate(
                input=prompt,
                timeout=timeout_seconds,
            )
        except subprocess.TimeoutExpired as error:
            try:
                os.killpg(process.pid, signal.SIGTERM)
                process.wait(timeout=10)
            except (OSError, subprocess.TimeoutExpired):
                try:
                    os.killpg(process.pid, signal.SIGKILL)
                except OSError:
                    pass
            return None, {
                "status": "failed",
                "command": command,
                "duration_seconds": round(time.time() - started, 2),
                "error": f"timeout after {timeout_seconds}s: {error}",
            }
    except OSError as error:
        return None, {
            "status": "failed",
            "command": command,
            "duration_seconds": round(time.time() - started, 2),
            "error": str(error),
        }

    output_text = output_path.read_text("utf-8") if output_path.exists() else completed_stdout
    record = {
        "status": "completed" if process.returncode == 0 else "failed",
        "command": command,
        "duration_seconds": round(time.time() - started, 2),
        "exit_code": process.returncode,
        "stdout_tail": completed_stdout[-2000:],
        "stderr_tail": completed_stderr[-2000:],
        "output_path": display_path(output_path),
    }
    if process.returncode != 0:
        return None, record
    try:
        return extract_json_object(output_text), record
    except (json.JSONDecodeError, ValueError) as error:
        record["status"] = "failed"
        record["error"] = f"invalid JSON output: {error}"
        record["output_tail"] = output_text[-2000:]
        return None, record


def scrub_llm_batch_text(value: Any) -> str:
    text = normalize_text(value)
    if not text:
        return ""
    text = text.replace(str(REPO_ROOT), "<repo>")
    text = text.replace(
        "src/data/deskpet/bangdream-resource-audit/.tmp/llm-review-batch",
        "<batch-output>",
    )
    text = text.replace(
        "<repo>/src/data/deskpet/bangdream-resource-audit/.tmp/llm-review-batch",
        "<batch-output>",
    )
    return text[-1000:]


def summarize_llm_batch_record(record: dict[str, Any]) -> dict[str, Any]:
    summary: dict[str, Any] = {
        "status": normalize_text(record.get("status")) or "unknown",
        "reviewer": "codex exec",
        "duration_seconds": record.get("duration_seconds", ""),
        "output_artifact": "llm-review-results.json:items",
    }
    if "exit_code" in record:
        summary["exit_code"] = record.get("exit_code")
    if record.get("command"):
        summary["command"] = (
            "codex exec --dangerously-bypass-approvals-and-sandbox "
            "--output-last-message <batch-output> -"
        )
    if record.get("error"):
        summary["error"] = scrub_llm_batch_text(record.get("error"))
    if record.get("output_tail"):
        summary["output_tail"] = scrub_llm_batch_text(record.get("output_tail"))
    if record.get("stderr_tail") and summary["status"] != "completed":
        summary["stderr_tail"] = scrub_llm_batch_text(record.get("stderr_tail"))
    return summary


def llm_review_rows(audit: pd.DataFrame) -> pd.DataFrame:
    return audit[
        (audit["needs_llm_review"] == True)
        & (audit["llm_review_status"] == "pending")
        & (audit["rating_signal_source"] == "direct_rating_label")
        & (audit["tagger_visual_evidence_status"] == "ready")
    ].copy()  # noqa: E712 - pandas identity check.


def row_for_llm_review(row: pd.Series) -> dict[str, Any]:
    return {
        "resource_key": row["resource_key"],
        "row_kind": row["row_kind"],
        "character_name_zh": row["character_name_zh"],
        "character_name_ja": row["character_name_ja"],
        "band": row["band"],
        "costume_key": row["costume_key"],
        "family": row["family"],
        "variant": row["variant"],
        "gist_content_safety_hint": row.get("gist_content_safety_hint", ""),
        "rating_predicted_label": row["rating_predicted_label"],
        "rating_scores": {
            "general": row["rating_score_general"],
            "sensitive": row["rating_score_sensitive"],
            "questionable": row["rating_score_questionable"],
            "explicit": row["rating_score_explicit"],
        },
        "rating_confidence": row["rating_confidence"],
        "rating_margin": row["rating_margin"],
        "tagger_top_tags_top30": parse_json_list(row["tagger_top_tags_top30_json"]),
        "tagger_policy_tag_probs": json.loads(row["tagger_policy_tag_probs_json"] or "{}"),
        "visual_evidence_url": row["tagger_visual_evidence_primary_url"],
    }


def apply_llm_review_results(
    audit: pd.DataFrame,
    results: list[dict[str, Any]],
    *,
    model_name: str,
) -> pd.DataFrame:
    audit = audit.copy()
    by_key = {normalize_text(result.get("resource_key")): result for result in results}
    for idx, row in audit.iterrows():
        result = by_key.get(normalize_text(row["resource_key"]))
        if not result:
            continue
        label = normalize_llm_label(result.get("label"))
        confidence = safe_float(result.get("confidence"))
        notes = normalize_text(result.get("notes"))
        audit.at[idx, "llm_review_status"] = "completed"
        audit.at[idx, "llm_review_model"] = model_name
        audit.at[idx, "llm_review_label"] = label
        audit.at[idx, "llm_review_confidence"] = confidence
        audit.at[idx, "llm_review_notes"] = notes
        refs = json.loads(audit.at[idx, "evidence_refs"])
        review_evidence_id = f"llm-review-{normalize_text(row['resource_key'])}"
        if review_evidence_id not in refs:
            refs.append(review_evidence_id)
            audit.at[idx, "evidence_refs"] = json.dumps(refs, ensure_ascii=False)
        if label != "unknown" and confidence != "" and float(confidence) >= MIN_LLM_REVIEW_CONFIDENCE:
            decision, eligible_default, eligible_sensitive, exclusion = rating_policy_decision(label)
            audit.at[idx, "needs_llm_review"] = False
            audit.at[idx, "needs_human_review"] = label in {"questionable", "explicit"}
            audit.at[idx, "human_review_status"] = "pending_policy_review" if label in {"questionable", "explicit"} else "not_required_llm_reviewed"
            audit.at[idx, "final_content_rating"] = label
            audit.at[idx, "final_rating_source"] = "llm_review"
            audit.at[idx, "content_policy_decision"] = decision
            audit.at[idx, "eligible_for_default_pool"] = eligible_default
            audit.at[idx, "eligible_for_sensitive_easter_egg_pool"] = eligible_sensitive
            audit.at[idx, "exclusion_reason"] = exclusion
        else:
            audit.at[idx, "needs_llm_review"] = False
            audit.at[idx, "needs_human_review"] = True
            audit.at[idx, "human_review_status"] = "pending"
            audit.at[idx, "final_content_rating"] = "unknown"
            audit.at[idx, "final_rating_source"] = "llm_review_inconclusive"
            audit.at[idx, "content_policy_decision"] = "pending"
            audit.at[idx, "eligible_for_default_pool"] = False
            audit.at[idx, "eligible_for_sensitive_easter_egg_pool"] = False
            audit.at[idx, "exclusion_reason"] = (
                f"LLM review inconclusive: label={label} confidence={confidence}"
            )
    return audit


def run_llm_review(
    audit: pd.DataFrame,
    *,
    output_dir: Path,
    command_template: str,
    batch_size: int,
    timeout_seconds: int,
) -> tuple[pd.DataFrame, dict[str, Any]]:
    audit = audit.copy()
    review_df = llm_review_rows(audit)
    existing_items: list[dict[str, Any]] = []
    existing_batches: list[dict[str, Any]] = []
    previous_results_path = output_dir / "llm-review-results.json"
    if previous_results_path.exists():
        try:
            previous_results = read_json(previous_results_path)
            existing_batches = [
                summarize_llm_batch_record(item)
                for item in previous_results.get("batches", [])
                if isinstance(item, dict)
            ]
            for item in previous_results.get("items", []):
                if not isinstance(item, dict):
                    continue
                resource_key = normalize_text(item.get("resource_key"))
                if not resource_key:
                    continue
                existing_items.append(
                    {
                        "resource_key": resource_key,
                        "label": normalize_llm_label(item.get("label")),
                        "confidence": safe_float(item.get("confidence")),
                        "notes": normalize_text(item.get("notes")),
                    }
                )
        except json.JSONDecodeError:
            existing_items = []
            existing_batches = []
    existing_reviewed_keys = {item["resource_key"] for item in existing_items}
    total_eligible_rows = len(existing_reviewed_keys) + int(len(review_df))
    summary: dict[str, Any] = {
        "generated_at": utc_now(),
        "status": "not_required" if len(review_df) == 0 else "completed",
        "reviewer": "codex exec",
        "reviewed_rows": 0,
        "eligible_rows": total_eligible_rows,
        "applied_rows": 0,
        "completed_batches": sum(1 for item in existing_batches if item.get("status") == "completed"),
        "failed_batches": sum(1 for item in existing_batches if item.get("status") == "failed"),
        "min_confidence": MIN_LLM_REVIEW_CONFIDENCE,
        "results_path": "llm-review-results.json",
        "batches": existing_batches,
        "items": [],
    }
    if not command_template.strip() or len(review_df) == 0:
        summary["reviewed_rows"] = len({result["resource_key"] for result in existing_items})
        summary["applied_rows"] = int((audit["llm_review_status"] == "completed").sum())
        summary["items"] = sorted(existing_items, key=lambda item: item["resource_key"])
        if len(review_df) > 0:
            summary["status"] = "skipped"
        elif existing_items:
            summary["status"] = "completed"
        write_json(output_dir / "llm-review-results.json", summary)
        return audit, summary

    all_results: list[dict[str, Any]] = list(existing_items)
    rows = [row_for_llm_review(row) for _, row in review_df.iterrows()]
    batch_size = max(1, batch_size)
    for batch_index, offset in enumerate(range(0, len(rows), batch_size), start=1):
        batch_rows = rows[offset : offset + batch_size]
        prompt = llm_review_prompt(batch_rows)
        print(
            f"LLM review progress: batch {batch_index} "
            f"rows {offset + 1}-{offset + len(batch_rows)} / {len(rows)}",
            file=sys.stderr,
            flush=True,
        )
        payload, record = run_llm_review_command(
            command_template,
            prompt,
            output_dir=output_dir,
            batch_index=batch_index,
            timeout_seconds=timeout_seconds,
        )
        summary["batches"].append(summarize_llm_batch_record(record))
        if not payload:
            summary["failed_batches"] += 1
            continue
        summary["completed_batches"] += 1
        for item in payload.get("items", []):
            if not isinstance(item, dict):
                continue
            resource_key = normalize_text(item.get("resource_key"))
            if not resource_key:
                continue
            result = {
                "resource_key": resource_key,
                "label": normalize_llm_label(item.get("label")),
                "confidence": safe_float(item.get("confidence")),
                "notes": normalize_text(item.get("notes")),
            }
            all_results.append(result)

    deduped_results = {result["resource_key"]: result for result in all_results}
    all_results = [deduped_results[key] for key in sorted(deduped_results)]
    audit = apply_llm_review_results(audit, all_results, model_name="codex exec")
    summary["reviewed_rows"] = len({result["resource_key"] for result in all_results})
    summary["applied_rows"] = int((audit["llm_review_status"] == "completed").sum())
    summary["items"] = all_results
    if (
        summary["eligible_rows"] > 0
        and summary["reviewed_rows"] >= summary["eligible_rows"]
        and summary["applied_rows"] >= summary["eligible_rows"]
    ):
        summary["status"] = "completed"
    elif summary["failed_batches"] and not all_results:
        summary["status"] = "failed"
    elif summary["failed_batches"]:
        summary["status"] = "partial"
    write_json(output_dir / "llm-review-results.json", summary)
    return audit, summary


def render_completeness_default_path(output_dir: Path) -> Path:
    if output_dir == DEFAULT_OUTPUT_DIR:
        return DEFAULT_RENDER_COMPLETENESS_CSV
    return output_dir / "render-completeness.csv"


def run_render_completeness_audit(output_dir: Path) -> dict[str, Any]:
    csv_path = render_completeness_default_path(output_dir)
    json_path = output_dir / "render-completeness.json"
    command = [
        "node",
        "scripts/audit_bangdream_render_completeness.mjs",
        "--direct-probe",
        "--output-csv",
        str(csv_path),
        "--output-json",
        str(json_path),
        "--screenshots-dir",
        str(REPO_ROOT / ".cache/deskpet-audit/render-screenshots"),
    ]
    started = time.time()
    try:
        completed = subprocess.run(
            command,
            cwd=REPO_ROOT,
            check=False,
            capture_output=True,
            text=True,
            timeout=60 * 45,
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        return {
            "status": "failed",
            "csv_path": display_path(csv_path),
            "json_path": display_path(json_path),
            "command": " ".join(command),
            "duration_seconds": round(time.time() - started, 2),
            "error": str(error),
        }
    return {
        "status": "completed" if completed.returncode == 0 else "failed",
        "csv_path": display_path(csv_path),
        "json_path": display_path(json_path),
        "command": " ".join(command),
        "duration_seconds": round(time.time() - started, 2),
        "exit_code": completed.returncode,
        "stdout": completed.stdout[-4000:],
        "stderr": completed.stderr[-4000:],
    }


def copy_render_completeness_outputs(source_csv_path: Path, output_dir: Path) -> Path:
    target_csv_path = render_completeness_default_path(output_dir)
    target_json_path = output_dir / "render-completeness.json"
    source_csv_path = source_csv_path.resolve()

    if source_csv_path != target_csv_path.resolve():
        target_csv_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source_csv_path, target_csv_path)

    source_json_path = source_csv_path.with_suffix(".json")
    if source_json_path.exists() and source_json_path.resolve() != target_json_path.resolve():
        shutil.copyfile(source_json_path, target_json_path)
    elif not target_json_path.exists():
        render_rows = pd.read_csv(target_csv_path, keep_default_na=False)
        write_json(
            target_json_path,
            {
                "generatedAt": utc_now(),
                "script": "scripts/build_bangdream_resource_audit.py",
                "sourceCsvPath": display_path(source_csv_path),
                "scope": "current_pool_only",
                "stats": {
                    "total": len(render_rows),
                    "pass": int((render_rows["complete_person_decision"] == "pass").sum()),
                    "review": int((render_rows["complete_person_decision"] == "review").sum()),
                    "fail": int((render_rows["complete_person_decision"] == "fail").sum()),
                },
            },
        )

    return target_csv_path


def apply_render_completeness(
    audit: pd.DataFrame,
    render_csv_path: Path,
) -> tuple[pd.DataFrame, dict[str, Any]]:
    audit = audit.copy()
    if not render_csv_path.exists():
        current_pool_count = int(audit["is_current_pool"].sum())
        return audit, {
            "status": "not_run",
            "scope": "current_pool_only",
            "csv_path": display_path(render_csv_path),
            "expected_current_pool_rows": current_pool_count,
            "matched_rows": 0,
            "notes": "render-completeness.csv was not found; current_pool render_status remains pending.",
        }

    render = pd.read_csv(render_csv_path, keep_default_na=False)
    render_by_key = {normalize_text(row["resource_key"]): row for _, row in render.iterrows()}
    matched = 0
    for idx, row in audit.iterrows():
        if not bool(row["is_current_pool"]):
            continue
        record = render_by_key.get(normalize_text(row["resource_key"]))
        if record is None:
            audit.at[idx, "render_status"] = "pending"
            audit.at[idx, "render_complete_person_decision"] = "not_run"
            audit.at[idx, "render_complete_person_reason"] = "current pool render audit row missing"
            continue
        matched += 1
        decision = normalize_text(record.get("complete_person_decision"))
        render_status = normalize_text(record.get("render_status"))
        audit.at[idx, "render_status"] = render_status or ("rendered" if decision == "pass" else "failed")
        audit.at[idx, "render_complete_person_decision"] = decision
        audit.at[idx, "render_complete_person_reason"] = normalize_text(record.get("complete_person_reason"))
        audit.at[idx, "render_nonblank_ratio"] = safe_float(record.get("nonblank_ratio"))
        audit.at[idx, "render_bounds_width"] = safe_int(record.get("bounds_width"))
        audit.at[idx, "render_bounds_height"] = safe_int(record.get("bounds_height"))
        audit.at[idx, "render_bounds_inside_ratio"] = safe_float(record.get("bounds_inside_ratio"))
        audit.at[idx, "render_viewport_width"] = safe_int(record.get("canvas_width"))
        audit.at[idx, "render_viewport_height"] = safe_int(record.get("canvas_height"))
        audit.at[idx, "render_browser"] = "chromium"
        audit.at[idx, "render_browser_version"] = "puppeteer-core"
        audit.at[idx, "render_seed"] = "deterministic-layout-v1"
        audit.at[idx, "render_frame_index"] = "12"
        audit.at[idx, "render_settle_ms"] = "192"
        audit.at[idx, "render_pose_policy"] = "static-idle-layout-v1"
        audit.at[idx, "render_image_path"] = normalize_text(record.get("screenshot_path"))
        audit.at[idx, "render_image_sha256_primary"] = normalize_text(record.get("render_canvas_sha256"))
        audit.at[idx, "render_image_sha256_desktop"] = normalize_text(record.get("render_canvas_sha256"))
        audit.at[idx, "render_image_sha256_mobile"] = ""
        audit.at[idx, "render_canvas_sha256"] = normalize_text(record.get("render_canvas_sha256"))
        audit.at[idx, "rendered_at"] = normalize_text(record.get("audited_at"))
        audit.at[idx, "render_log_ref"] = render_csv_path.name
        audit.at[idx, "render_error"] = normalize_text(record.get("error_message"))
        refs = json.loads(audit.at[idx, "evidence_refs"])
        render_evidence_id = f"render-completeness-{normalize_text(row['resource_key'])}"
        if render_evidence_id not in refs:
            refs.append(render_evidence_id)
            audit.at[idx, "evidence_refs"] = json.dumps(refs, ensure_ascii=False)

    return audit, {
        "status": "completed",
        "scope": "current_pool_only",
        "csv_path": display_path(render_csv_path),
        "row_count": len(render),
        "matched_rows": matched,
        "decision_counts": dict(Counter(render["complete_person_decision"])),
        "render_status_counts": dict(Counter(render["render_status"])),
    }


def normalize_output_dtypes(audit: pd.DataFrame) -> pd.DataFrame:
    audit = audit.copy()
    int_columns = [
        "gist_row_number",
        "bestdori_available_server_count",
        "render_viewport_width",
        "render_viewport_height",
        "render_device_scale_factor",
        "tagger_visual_evidence_count",
        "tagger_inference_batch_size",
        "render_bounds_width",
        "render_bounds_height",
    ]
    float_columns = [
        "rating_score_general",
        "rating_score_sensitive",
        "rating_score_questionable",
        "rating_score_explicit",
        "rating_confidence",
        "rating_margin",
        "rating_entropy",
        "render_nonblank_ratio",
        "render_bounds_inside_ratio",
    ]
    bool_columns = [
        "is_current_pool",
        "is_covered_candidate",
        "is_union_reference",
        "bestdori_costume_metadata_found",
        "bestdori_costume_detail_found",
        "needs_llm_review",
        "needs_human_review",
        "eligible_for_default_pool",
        "eligible_for_sensitive_easter_egg_pool",
    ]
    for column in int_columns:
        if column in audit.columns:
            audit[column] = pd.to_numeric(audit[column], errors="coerce").fillna(0).astype("int64")
    for column in float_columns:
        if column in audit.columns:
            audit[column] = pd.to_numeric(audit[column], errors="coerce")
    for column in bool_columns:
        if column in audit.columns:
            audit[column] = audit[column].astype(bool)
    for column in audit.columns:
        if column not in int_columns and column not in float_columns and column not in bool_columns:
            audit[column] = audit[column].fillna("").astype(str)
    return audit


def build_audit_table(
    files: dict[str, bytes],
    current_pool: dict[str, dict[str, Any]],
    source_snapshot_id: str,
) -> pd.DataFrame:
    candidate_df = read_csv_bytes(files["candidate-resource-intelligence.csv"])
    union_df = read_csv_bytes(files["bestdori-live2d-chara-union.csv"])
    rows = [row_from_candidate(row, current_pool, source_snapshot_id) for _, row in candidate_df.iterrows()]
    covered_costume_keys = {normalize_text(row["costume_key"]) for _, row in candidate_df.iterrows()}

    for _, row in union_df.iterrows():
        if normalize_text(row.get("costume_key")) in covered_costume_keys:
            continue
        rows.append(row_from_union_only(row, source_snapshot_id))

    df = pd.DataFrame(rows)
    df = df.sort_values(["row_kind", "resource_key"], kind="stable").reset_index(drop=True)
    return normalize_output_dtypes(df)


def build_evidence_index(
    audit: pd.DataFrame,
    output_dir: Path,
    *,
    gist_revision_sha: str,
) -> pd.DataFrame:
    rows = []
    llm_review_results_path = output_dir / "llm-review-results.json"
    llm_review_results_sha = sha256_bytes(llm_review_results_path.read_bytes()) if llm_review_results_path.exists() else ""
    llm_review_created_at = ""
    if llm_review_results_path.exists():
        try:
            llm_review_created_at = read_json(llm_review_results_path).get("generated_at", "")
        except json.JSONDecodeError:
            llm_review_created_at = ""
    for _, row in audit.iterrows():
        refs = json.loads(row["evidence_refs"])
        source_file = row["gist_source_file"]
        rows.append(
            {
                "evidence_id": refs[0],
                "resource_key": row["resource_key"],
                "evidence_type": "raw_source",
                "evidence_path": f"raw/gist/{gist_revision_sha}/{source_file}.gz",
                "evidence_sha256": "",
                "evidence_created_at": "",
                "evidence_created_by": "build_bangdream_resource_audit.py",
                "evidence_used_for": "source_row_identity",
                "evidence_summary": f"{source_file}:{row['gist_row_number']}",
                "is_committed_to_repo": True,
                "external_artifact_url": "",
            }
        )
        for evidence_id in refs[1:]:
            evidence_id = normalize_text(evidence_id)
            if evidence_id.startswith("render-completeness-"):
                rows.append(
                    {
                        "evidence_id": evidence_id,
                        "resource_key": row["resource_key"],
                        "evidence_type": "render_completeness",
                        "evidence_path": row.get("render_log_ref", "render-completeness.csv"),
                        "evidence_sha256": row.get("render_canvas_sha256", ""),
                        "evidence_created_at": row.get("rendered_at", ""),
                        "evidence_created_by": "scripts/audit_bangdream_render_completeness.mjs",
                        "evidence_used_for": "complete_person_render_validation",
                        "evidence_summary": json.dumps(
                            {
                                "decision": row.get("render_complete_person_decision", ""),
                                "reason": row.get("render_complete_person_reason", ""),
                                "nonblank_ratio": row.get("render_nonblank_ratio", ""),
                                "bounds_width": row.get("render_bounds_width", ""),
                                "bounds_height": row.get("render_bounds_height", ""),
                                "bounds_inside_ratio": row.get("render_bounds_inside_ratio", ""),
                                "screenshot_path": row.get("render_image_path", ""),
                            },
                            ensure_ascii=False,
                            sort_keys=True,
                        ),
                        "is_committed_to_repo": (REPO_ROOT / row.get("render_log_ref", "")).exists(),
                        "external_artifact_url": "",
                    }
                )
            elif evidence_id.startswith("llm-review-"):
                rows.append(
                    {
                        "evidence_id": evidence_id,
                        "resource_key": row["resource_key"],
                        "evidence_type": "llm_review",
                        "evidence_path": llm_review_results_path.as_posix(),
                        "evidence_sha256": llm_review_results_sha,
                        "evidence_created_at": llm_review_created_at,
                        "evidence_created_by": "codex exec",
                        "evidence_used_for": "llm_content_review",
                        "evidence_summary": json.dumps(
                            {
                                "label": row.get("llm_review_label", ""),
                                "confidence": row.get("llm_review_confidence", ""),
                                "notes": row.get("llm_review_notes", ""),
                            },
                            ensure_ascii=False,
                            sort_keys=True,
                        ),
                        "is_committed_to_repo": llm_review_results_path.exists(),
                        "external_artifact_url": "",
                    }
                )
    return pd.DataFrame(rows)


def apply_evidence_hashes(evidence: pd.DataFrame, gist_manifest: dict[str, Any]) -> pd.DataFrame:
    hash_by_source = {
        name: info.get("sha256", "") for name, info in gist_manifest.get("files", {}).items()
    }
    for idx, row in evidence.iterrows():
        if normalize_text(row.get("evidence_type")) == "raw_source":
            summary = str(row["evidence_summary"])
            source = summary.split(":", 1)[0]
            evidence.at[idx, "evidence_sha256"] = hash_by_source.get(source, "")
            evidence.at[idx, "evidence_created_at"] = gist_manifest.get("fetched_at", "")
    return evidence


def build_family_summary(audit: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for family, group in audit.groupby("family", dropna=False):
        rating_counts = Counter(group["final_content_rating"])
        policy_counts = Counter(group["content_policy_decision"])
        rows.append(
            {
                "family": family or "unknown",
                "row_count": len(group),
                "current_pool_count": int(group["is_current_pool"].sum()),
                "covered_candidate_count": int(group["is_covered_candidate"].sum()),
                "union_reference_count": int(group["is_union_reference"].sum()),
                "general_count": rating_counts.get("general", 0),
                "sensitive_count": rating_counts.get("sensitive", 0),
                "questionable_count": rating_counts.get("questionable", 0),
                "explicit_count": rating_counts.get("explicit", 0),
                "unknown_count": rating_counts.get("unknown", 0),
                "allow_default_count": policy_counts.get("allow_default", 0),
                "allow_sensitive_easter_egg_count": policy_counts.get(
                    "allow_sensitive_easter_egg", 0
                ),
                "quarantine_count": policy_counts.get("quarantine", 0),
                "policy_reject_count": policy_counts.get("reject", 0),
                "pending_count": policy_counts.get("pending", 0),
                "render_success_rate": round(float((group["render_status"] == "rendered").mean()), 6),
                "validate_success_rate": round(float((group["validate_status"] == "passed").mean()), 6),
                "tagger_scanned_count": int((group["rating_signal_source"] == "direct_rating_label").sum()),
                "llm_review_queue_count": int(((group["needs_llm_review"] == True) & (group["llm_review_status"] == "pending")).sum()),  # noqa: E712
                "needs_llm_review_count": int(group["needs_llm_review"].sum()),
                "needs_human_review_count": int(group["needs_human_review"].sum()),
            }
        )
    return pd.DataFrame(rows, columns=FAMILY_SUMMARY_COLUMNS).sort_values("family")


def build_resource_summary(
    audit: pd.DataFrame,
    gist_files: dict[str, bytes],
    bestdori_snapshot: dict[str, Any],
    tagger_scan_summary: dict[str, Any] | None,
    render_summary: dict[str, Any] | None,
) -> dict[str, Any]:
    by_kind = Counter(audit["row_kind"])
    return {
        "generatedAt": utc_now(),
        "source": "scripts/build_bangdream_resource_audit.py",
        "rowCount": len(audit),
        "rowKindCounts": dict(sorted(by_kind.items())),
        "currentPoolRows": int(audit["is_current_pool"].sum()),
        "coveredCandidateRows": int(audit["is_covered_candidate"].sum()),
        "unionReferenceRows": int(audit["is_union_reference"].sum()),
        "finalContentRatingCounts": dict(Counter(audit["final_content_rating"])),
        "contentPolicyDecisionCounts": dict(Counter(audit["content_policy_decision"])),
        "ratingSignalSourceCounts": dict(Counter(audit["rating_signal_source"])),
        "taggerVisualEvidenceStatusCounts": dict(Counter(audit["tagger_visual_evidence_status"])),
        "taggerPredictedLabelCounts": dict(Counter(audit["rating_predicted_label"])),
        "llmReviewStatusCounts": dict(Counter(audit["llm_review_status"])),
        "llmReviewQueueRows": int(((audit["needs_llm_review"] == True) & (audit["llm_review_status"] == "pending")).sum()),  # noqa: E712
        "llmReviewResultsRows": int((audit["llm_review_status"] == "completed").sum()),
        "taggerScan": tagger_scan_summary or {"status": "skipped"},
        "renderCompleteness": render_summary or {"status": "not_run"},
        "gistResourceIntelligenceSummary": json.loads(
            gist_files["resource-intelligence-summary.json"].decode("utf-8")
        ),
        "gistDatasetSummary": json.loads(gist_files["dataset-summary.json"].decode("utf-8")),
        "bestdoriSnapshot": {
            "snapshot_id": bestdori_snapshot["snapshot_id"],
            "fetched_at": bestdori_snapshot["fetched_at"],
            "failed_resources": [
                item for item in bestdori_snapshot["resources"] if item["http_status"] == "failed"
            ],
        },
    }


def schema_for_audit(audit: pd.DataFrame) -> dict[str, Any]:
    fields = []
    for name in audit.columns:
        dtype = str(audit[name].dtype)
        if dtype == "bool":
            field_type = "boolean"
        elif dtype.startswith("int"):
            field_type = "integer"
        elif dtype.startswith("float"):
            field_type = "number"
        else:
            field_type = "string"
        fields.append({"name": name, "type": field_type, "nullable": True})
    return {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "title": "BanG Dream deskpet resource audit row",
        "generatedAt": utc_now(),
        "primaryKey": "resource_key",
        "rowKind": ["current_pool", "covered_candidate", "union_only"],
        "contentRatings": CONTENT_RATINGS,
        "contentPolicyDecisions": CONTENT_POLICY_DECISIONS,
        "csvColumns": CSV_COLUMNS,
        "familySummaryColumns": FAMILY_SUMMARY_COLUMNS,
        "fields": fields,
        "notes": [
            "gist_* columns preserve candidate-resource-intelligence.csv source names with the gist_ prefix.",
            "is_union_reference means the costume key appears in the five-server Bestdori live2d.chara union and may overlap current_pool/covered_candidate.",
            "render_image_sha256_primary is the first successful desktop screenshot in render time order.",
        ],
    }


def write_outputs(
    output_dir: Path,
    audit: pd.DataFrame,
    evidence: pd.DataFrame,
    family_summary: pd.DataFrame,
    llm_review_queue: pd.DataFrame,
    schema: dict[str, Any],
    source_snapshot: dict[str, Any],
    resource_summary: dict[str, Any],
) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    audit_path = output_dir / "audit.parquet"
    evidence_path = output_dir / "evidence-index.parquet"
    pq.write_table(pa.Table.from_pandas(audit, preserve_index=False), audit_path, compression="zstd")
    pq.write_table(pa.Table.from_pandas(evidence, preserve_index=False), evidence_path, compression="zstd")
    audit[CSV_COLUMNS].to_csv(output_dir / "audit.csv", index=False, encoding="utf-8-sig")
    evidence.to_csv(output_dir / "evidence-index.csv", index=False, encoding="utf-8-sig")
    family_summary.to_csv(output_dir / "family-summary.csv", index=False, encoding="utf-8-sig")
    llm_review_queue.to_csv(output_dir / "llm-review-queue.csv", index=False, encoding="utf-8-sig")
    write_json(output_dir / "audit.schema.json", schema)
    write_json(output_dir / "source-snapshot.json", source_snapshot)
    write_json(output_dir / "resource-intelligence-summary.json", resource_summary)
    write_json(output_dir / "tag-rating-mapping-v1.json", TAG_MAPPING)
    write_readme(output_dir, resource_summary)


def write_readme(output_dir: Path, resource_summary: dict[str, Any]) -> None:
    text = f"""# BanG Dream 桌宠资源分级审计数据集

本目录由 `scripts/build_bangdream_resource_audit.py` 生成，用来承载 PR #24 的资源审计主表和证据索引。

当前生成时间：`{resource_summary['generatedAt']}`

## 入口命令

```bash
npm run deskpet:audit -- --limit 20
npm run deskpet:audit -- --skip-gist-fetch
npm run deskpet:audit -- --verify
```

默认命令会生成完整审计表，并对 Bestdori `buildData.asset` 中可取得的纹理运行 `animetimm/convnextv2_huge.dbv4-full` direct rating 推理；`--limit` 只控制终端预览行数，不裁剪输出数据。低置信或无法取得视觉证据的行保持 fail-closed，并进入 `llm-review-queue.csv` 或阻塞状态。
低置信且已经有 tagger 视觉证据的行会进入 `llm-review-queue.csv`；显式传入 `--run-llm-review` 时才调用外部 LLM 复核，结果写入 `llm-review-results.json` 并回填主表。无法取得视觉证据的行不会被 LLM 自动放行。
`render-completeness.csv` / `render-completeness.json` 由 JS 离线浏览器审计脚本生成，Python 端只负责消费并回填 current_pool 的真实渲染完整性证据。

## 关键口径

- `row_kind` 是单值主分类：`current_pool | covered_candidate | union_only`。
- `is_union_reference` 表示资源是否存在于 Bestdori 五服 `live2d.chara` union 中，可以和 `is_current_pool` / `is_covered_candidate` 同时为 `true`。
- `final_content_rating` 只允许 `general | sensitive | questionable | explicit | unknown`；`content_policy_decision=reject` 表示工程拒绝，不是内容分级。
- `policy_reject_count` 来自 `content_policy_decision`，不是 content rating。
- direct rating 来自 animetimm 模型的 `general/sensitive/questionable/explicit` 输出；`tag-rating-mapping-v1.json` 仍是 policy tag 和低置信阈值的唯一事实源。

## 文件

- `audit.parquet`：完整主表。
- `audit.csv`：reviewer 轻量视图，UTF-8 with BOM。
- `audit.schema.json`：字段、枚举和 CSV 列约束。
- `source-snapshot.json`：gist / Bestdori / current pool / tagger source snapshot。
- `evidence-index.parquet` / `evidence-index.csv`：证据索引。
- `family-summary.csv`：按 family 汇总的快速检查表。
- `llm-review-queue.csv`：tagger 低置信或需要二次视觉判断的行。
- `llm-review-results.json`：外部 LLM 对低置信 tagger 结果的结构化复核输出。
- `render-completeness.csv` / `render-completeness.json`：current_pool 的真实浏览器渲染完整性审计结果。
- `resource-intelligence-summary.json`：机器可读统计摘要。
"""
    (output_dir / "README.md").write_text(text, "utf-8")


def build_source_snapshot(
    output_dir: Path,
    gist_manifest: dict[str, Any],
    bestdori_snapshot: dict[str, Any],
    pool: dict[str, Any],
    tag_mapping_hash: str,
    tagger_snapshot: dict[str, Any],
    tagger_scan_summary: dict[str, Any] | None,
    render_summary: dict[str, Any] | None,
    llm_review_summary: dict[str, Any] | None = None,
) -> dict[str, Any]:
    snapshot_id = f"{SOURCE_SNAPSHOT_ID_PREFIX}-{gist_manifest['gist_revision_sha']}"
    model_dirs = sorted(path.name for path in MODELS_DIR.iterdir() if path.is_dir())
    return {
        "source_snapshot_id": snapshot_id,
        "generated_at": utc_now(),
        "script": "scripts/build_bangdream_resource_audit.py",
        "gist": gist_manifest,
        "bestdori": bestdori_snapshot,
        "current_pool": {
            "pool_path": POOL_PATH.relative_to(REPO_ROOT).as_posix(),
            "models_dir": MODELS_DIR.relative_to(REPO_ROOT).as_posix(),
            "pool_validated_at": pool["pool"]["validatedAt"],
            "qualified_character_count": pool["pool"]["qualifiedCharacterCount"],
            "qualified_variant_count": pool["pool"]["qualifiedVariantCount"],
            "model_directory_count": len(model_dirs),
            "model_keys": model_dirs,
            "ave_mujica_local_to_upstream_map": AVE_MUJICA_LOCAL_TO_UPSTREAM,
            "validator": "scripts/validate_live2d_models.mjs",
        },
        "tagger": {
            **tagger_snapshot,
            "scan": tagger_scan_summary or {"status": "skipped"},
        },
        "render_completeness": render_summary or {"status": "not_run"},
        "llm_review": llm_review_summary or {"status": "not_run"},
        "tag_rating_mapping": {
            "path": "tag-rating-mapping-v1.json",
            "mapping_version": MAPPING_VERSION,
            "sha256": tag_mapping_hash,
        },
        "environment": {
            "python": sys.version.split()[0],
            "platform": platform.platform(),
            "pandas": pd.__version__,
            "pyarrow": pa.__version__,
        },
    }


def verify_outputs(output_dir: Path) -> None:
    required = [
        "audit.parquet",
        "audit.csv",
        "audit.schema.json",
        "source-snapshot.json",
        "tag-rating-mapping-v1.json",
        "evidence-index.parquet",
        "evidence-index.csv",
        "family-summary.csv",
        "llm-review-queue.csv",
        "llm-review-results.json",
        "render-completeness.csv",
        "render-completeness.json",
        "resource-intelligence-summary.json",
    ]
    missing = [name for name in required if not (output_dir / name).exists()]
    if missing:
        raise SystemExit(f"Missing audit outputs: {', '.join(missing)}")
    audit = pq.read_table(output_dir / "audit.parquet").to_pandas()
    csv_df = pd.read_csv(output_dir / "audit.csv", keep_default_na=False)
    schema = read_json(output_dir / "audit.schema.json")
    evidence = pd.read_csv(output_dir / "evidence-index.csv", keep_default_na=False)
    evidence_parquet = pq.read_table(output_dir / "evidence-index.parquet").to_pandas()
    family = pd.read_csv(output_dir / "family-summary.csv", keep_default_na=False)
    llm_queue = pd.read_csv(output_dir / "llm-review-queue.csv", keep_default_na=False)
    llm_review_results = read_json(output_dir / "llm-review-results.json")
    source_snapshot = read_json(output_dir / "source-snapshot.json")
    tag_mapping = read_json(output_dir / "tag-rating-mapping-v1.json")
    render_csv_path = output_dir / "render-completeness.csv"
    llm_results_path = output_dir / "llm-review-results.json"
    if len(audit) != len(csv_df):
        raise SystemExit(f"audit.parquet rows ({len(audit)}) != audit.csv rows ({len(csv_df)})")
    if list(schema["csvColumns"]) != list(csv_df.columns):
        raise SystemExit("audit.csv columns do not match schema csvColumns")
    schema_fields = [field["name"] for field in schema["fields"]]
    if schema_fields != list(audit.columns):
        raise SystemExit("audit.parquet columns do not match audit.schema.json fields")
    if set(schema["csvColumns"]) - set(csv_df.columns):
        raise SystemExit("audit.csv is missing schema csvColumns")
    if list(family.columns) != FAMILY_SUMMARY_COLUMNS:
        raise SystemExit("family-summary.csv columns do not match the expected order")
    if len(evidence) != len(evidence_parquet):
        raise SystemExit("evidence-index.csv rows do not match evidence-index.parquet rows")
    if not set(audit["final_content_rating"]).issubset(CONTENT_RATINGS):
        raise SystemExit("Invalid final_content_rating value found")
    if not set(audit["content_policy_decision"]).issubset(CONTENT_POLICY_DECISIONS):
        raise SystemExit("Invalid content_policy_decision value found")
    if not set(audit["llm_review_status"]).issubset(LLM_REVIEW_STATUSES):
        raise SystemExit("Invalid llm_review_status value found")
    evidence_ids = set(evidence["evidence_id"])
    for refs in audit["evidence_refs"]:
        for evidence_id in json.loads(refs):
            if evidence_id not in evidence_ids:
                raise SystemExit(f"Evidence reference missing: {evidence_id}")
    for _, row in evidence.iterrows():
        path = path_from_display(row["evidence_path"], output_dir)
        if not path.exists():
            raise SystemExit(f"Evidence path missing: {row['evidence_path']}")
    for name, info in source_snapshot.get("gist", {}).get("files", {}).items():
        raw_path = output_dir / info.get("raw_payload_path", "")
        if not raw_path.exists():
            raise SystemExit(f"Raw gist snapshot missing: {name}")
        raw = gzip.decompress(raw_path.read_bytes())
        if sha256_bytes(raw) != info.get("sha256"):
            raise SystemExit(f"Raw gist snapshot hash mismatch: {name}")
    for resource in source_snapshot.get("bestdori", {}).get("resources", []):
        if not isinstance(resource, dict):
            continue
        raw_payload_path = normalize_text(resource.get("raw_payload_path"))
        expected_sha = normalize_text(resource.get("raw_payload_sha256"))
        if not raw_payload_path:
            if normalize_text(resource.get("http_status")) in {"failed", "missing"}:
                continue
            raise SystemExit(f"Bestdori raw payload path missing: {resource.get('key', '')}")
        raw_path = output_dir / raw_payload_path
        if not raw_path.exists():
            raise SystemExit(f"Raw Bestdori snapshot missing: {resource.get('key', '')}")
        raw = gzip.decompress(raw_path.read_bytes())
        if expected_sha and sha256_bytes(raw) != expected_sha:
            raise SystemExit(f"Raw Bestdori snapshot hash mismatch: {resource.get('key', '')}")
    mapping_bytes = json.dumps(tag_mapping, ensure_ascii=False, sort_keys=True).encode("utf-8")
    if sha256_bytes(mapping_bytes) != source_snapshot.get("tag_rating_mapping", {}).get("sha256"):
        raise SystemExit("tag-rating-mapping-v1.json sha256 does not match source-snapshot.json")
    if not set(audit["rating_signal_source"]).issubset({"direct_rating_label", "tag_mapping", "unavailable"}):
        raise SystemExit("Invalid rating_signal_source value found")
    tagger_scan = source_snapshot.get("tagger", {}).get("scan", {})
    if tagger_scan.get("status") == "completed":
        if int(tagger_scan.get("scanned_rows", 0)) <= 0:
            raise SystemExit("tagger scan is completed but scanned_rows is not positive")
        if int((audit["rating_signal_source"] == "direct_rating_label").sum()) <= 0:
            raise SystemExit("tagger scan is completed but audit.csv has no direct_rating_label rows")
    expected_queue = int(((audit["needs_llm_review"] == True) & (audit["llm_review_status"] == "pending")).sum())  # noqa: E712
    if len(llm_queue) != expected_queue:
        raise SystemExit(f"llm-review-queue.csv rows ({len(llm_queue)}) != expected pending rows ({expected_queue})")
    llm_completed = int((audit["llm_review_status"] == "completed").sum())
    if llm_review_results.get("applied_rows", 0) != llm_completed:
        raise SystemExit("llm-review-results.json applied_rows does not match completed rows")
    if len(llm_review_results.get("items", [])) != llm_completed:
        raise SystemExit("llm-review-results.json items do not match completed rows")
    if not llm_results_path.exists():
        raise SystemExit("llm-review-results.json missing")
    current_pool_rows = audit[audit["is_current_pool"] == True]  # noqa: E712
    if render_csv_path.exists():
        render_rows = pd.read_csv(render_csv_path, keep_default_na=False)
        if len(render_rows) != len(current_pool_rows):
            raise SystemExit(
                f"render-completeness.csv rows ({len(render_rows)}) != current_pool rows ({len(current_pool_rows)})"
            )
        if not set(render_rows["resource_key"]).issubset(set(current_pool_rows["resource_key"])):
            raise SystemExit("render-completeness.csv contains resource_key outside current_pool")
    current_pool_rendered = current_pool_rows[current_pool_rows["render_complete_person_decision"] != "not_run"]
    if len(current_pool_rendered) != len(current_pool_rows):
        raise SystemExit(
            f"current_pool render completeness not fully populated ({len(current_pool_rendered)}/{len(current_pool_rows)})"
        )
    if set(current_pool_rows["render_status"]) == {"pending"}:
        raise SystemExit("current_pool render_status remained pending after render completeness application")
    print(
        f"Verified {len(audit)} audit rows, {len(evidence)} evidence rows, "
        f"{len(llm_queue)} LLM queue rows and {llm_completed} LLM review rows."
    )


def apply_llm_review_only(args: argparse.Namespace, output_dir: Path) -> None:
    audit = pq.read_table(output_dir / "audit.parquet").to_pandas()
    source_snapshot = read_json(output_dir / "source-snapshot.json")
    resource_summary = read_json(output_dir / "resource-intelligence-summary.json")
    gist_manifest = source_snapshot["gist"]
    audit, llm_review_summary = run_llm_review(
        audit,
        output_dir=output_dir,
        command_template=args.llm_review_command,
        batch_size=args.llm_review_batch_size,
        timeout_seconds=args.llm_review_timeout,
    )
    audit = normalize_output_dtypes(audit)
    source_snapshot["generated_at"] = utc_now()
    if any(
        normalize_text(item.get("http_status")) == "skipped"
        for item in source_snapshot.get("bestdori", {}).get("resources", [])
        if isinstance(item, dict)
    ):
        source_snapshot["bestdori"] = fetch_bestdori(output_dir, skip_bestdori=True)
    tagger_scan = dict(source_snapshot.get("tagger", {}).get("scan", {}))
    if tagger_scan:
        tagger_scan.setdefault("status", "completed")
        source_snapshot.setdefault("tagger", {})["scan"] = tagger_scan
    source_snapshot["llm_review"] = llm_review_summary
    evidence = apply_evidence_hashes(
        build_evidence_index(
            audit,
            output_dir,
            gist_revision_sha=gist_manifest["gist_revision_sha"],
        ),
        gist_manifest,
    )
    family_summary = build_family_summary(audit)
    llm_review_queue = build_llm_review_queue(audit)
    schema = schema_for_audit(audit)
    resource_summary["generatedAt"] = utc_now()
    resource_summary["finalContentRatingCounts"] = dict(Counter(audit["final_content_rating"]))
    resource_summary["contentPolicyDecisionCounts"] = dict(Counter(audit["content_policy_decision"]))
    resource_summary["llmReviewStatusCounts"] = dict(Counter(audit["llm_review_status"]))
    resource_summary["llmReviewQueueRows"] = int(
        ((audit["needs_llm_review"] == True) & (audit["llm_review_status"] == "pending")).sum()
    )  # noqa: E712
    resource_summary["llmReviewResultsRows"] = int((audit["llm_review_status"] == "completed").sum())
    resource_summary["taggerScan"] = dict(source_snapshot.get("tagger", {}).get("scan", {"status": "skipped"}))
    resource_summary["bestdoriSnapshot"] = {
        "snapshot_id": source_snapshot["bestdori"]["snapshot_id"],
        "fetched_at": source_snapshot["bestdori"]["fetched_at"],
        "failed_resources": [
            item
            for item in source_snapshot["bestdori"]["resources"]
            if item["http_status"] == "failed"
        ],
    }
    resource_summary["llmReview"] = llm_review_summary
    write_outputs(
        output_dir,
        audit,
        evidence,
        family_summary,
        llm_review_queue,
        schema,
        source_snapshot,
        resource_summary,
    )
    verify_outputs(output_dir)


def main() -> None:
    args = parse_args()
    output_dir = Path(args.output_dir).resolve()
    if args.verify:
        verify_outputs(output_dir)
        return
    if args.apply_llm_review_only:
        apply_llm_review_only(args, output_dir)
        return

    if args.concurrency < 1:
        raise SystemExit("--concurrency must be >= 1")
    if args.limit is not None and args.limit < 1:
        raise SystemExit("--limit must be >= 1")
    if args.offset < 0:
        raise SystemExit("--offset must be >= 0")
    if output_dir.exists() and args.force:
        shutil.rmtree(output_dir)

    started = time.time()
    pool = load_pool()
    current_pool = current_pool_variants(pool)
    files, gist_manifest = fetch_gist(output_dir, args.skip_gist_fetch)
    tag_mapping_bytes = json.dumps(TAG_MAPPING, ensure_ascii=False, sort_keys=True).encode("utf-8")
    bestdori_snapshot = fetch_bestdori(output_dir, args.skip_bestdori)
    tagger_snapshot = fetch_tagger_model_metadata()
    source_snapshot_stub = build_source_snapshot(
        output_dir,
        gist_manifest,
        bestdori_snapshot,
        pool,
        sha256_bytes(tag_mapping_bytes),
        tagger_snapshot,
        None,
        None,
    )
    source_snapshot_id = source_snapshot_stub["source_snapshot_id"]
    audit = build_audit_table(files, current_pool, source_snapshot_id)
    tagger_scan_summary = None
    if not args.skip_tagger:
        visual_evidence = collect_visual_evidence(audit, args.concurrency)
        audit, tagger_scan_summary = run_tagger_scan(
            audit,
            visual_evidence,
            device_name=args.tagger_device,
            batch_size=args.tagger_batch_size,
        )
    render_csv_path = (
        Path(args.render_completeness_csv).expanduser().resolve()
        if args.render_completeness_csv
        else render_completeness_default_path(output_dir)
    )
    render_runner_summary = None
    if args.render_completeness_csv:
        if not render_csv_path.exists():
            raise SystemExit(f"--render-completeness-csv does not exist: {render_csv_path}")
        render_csv_path = copy_render_completeness_outputs(render_csv_path, output_dir)
    else:
        render_runner_summary = run_render_completeness_audit(output_dir)
        if render_runner_summary.get("status") != "completed" or not render_csv_path.exists():
            raise SystemExit(
                "Render completeness audit failed; rerun with CHROME_PATH set if Chromium is installed elsewhere. "
                + json.dumps(render_runner_summary, ensure_ascii=False)
            )
    audit, render_summary = apply_render_completeness(audit, render_csv_path)
    if render_runner_summary:
        render_summary = {**render_summary, "runner": render_runner_summary}
    audit = normalize_output_dtypes(audit)
    if args.skip_llm_review or not args.run_llm_review:
        llm_review_summary = {
            "generated_at": utc_now(),
            "status": "skipped",
            "reviewer": "codex exec",
            "eligible_rows": int(len(llm_review_rows(audit))),
            "reviewed_rows": 0,
            "applied_rows": 0,
            "failed_batches": 0,
            "min_confidence": MIN_LLM_REVIEW_CONFIDENCE,
            "results_path": "llm-review-results.json",
            "batches": [],
            "items": [],
        }
        write_json(output_dir / "llm-review-results.json", llm_review_summary)
    else:
        audit, llm_review_summary = run_llm_review(
            audit,
            output_dir=output_dir,
            command_template=args.llm_review_command,
            batch_size=args.llm_review_batch_size,
            timeout_seconds=args.llm_review_timeout,
        )
    source_snapshot = build_source_snapshot(
        output_dir,
        gist_manifest,
        bestdori_snapshot,
        pool,
        sha256_bytes(tag_mapping_bytes),
        tagger_snapshot,
        tagger_scan_summary,
        render_summary,
        llm_review_summary,
    )
    evidence = apply_evidence_hashes(
        build_evidence_index(
            audit,
            output_dir,
            gist_revision_sha=gist_manifest["gist_revision_sha"],
        ),
        gist_manifest,
    )
    family_summary = build_family_summary(audit)
    llm_review_queue = build_llm_review_queue(audit)
    schema = schema_for_audit(audit)
    resource_summary = build_resource_summary(audit, files, bestdori_snapshot, tagger_scan_summary, render_summary)
    resource_summary["llmReview"] = llm_review_summary
    write_outputs(output_dir, audit, evidence, family_summary, llm_review_queue, schema, source_snapshot, resource_summary)
    verify_outputs(output_dir)

    preview = audit.iloc[args.offset : args.offset + args.limit][
        ["resource_key", "row_kind", "final_content_rating", "content_policy_decision"]
    ]
    print(preview.to_string(index=False))
    print(
        json.dumps(
            {
                "output_dir": display_path(output_dir),
                "rows": len(audit),
                "current_pool_rows": int(audit["is_current_pool"].sum()),
                "covered_candidate_rows": int(audit["is_covered_candidate"].sum()),
                "union_reference_rows": int(audit["is_union_reference"].sum()),
                "tagger_scanned_rows": int((audit["rating_signal_source"] == "direct_rating_label").sum()),
                "llm_review_queue_rows": len(llm_review_queue),
                "duration_seconds": round(time.time() - started, 2),
                "full_current_pool_requested": args.all_current_pool,
                "full_candidates_requested": args.all_candidates,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
