#!/usr/bin/env python3
"""Build the BanG Dream deskpet resource audit dataset.

This script intentionally generates a fail-closed audit table first. Full
browser rendering and animetimm inference can enrich the table later without
changing the base row identity or source snapshot contracts.
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
import shutil
import sys
import time
import urllib.error
import urllib.request
from collections import Counter, defaultdict
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
STATUS_VALUES = ["pending", "downloaded", "converted", "rendered", "skipped", "failed"]
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
            "max_score_threshold": 0.8,
            "margin_threshold": 0.2,
            "action": "needs_review",
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
    parser.add_argument("--concurrency", type=int, default=1)
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--all-current-pool", action="store_true")
    parser.add_argument("--all-candidates", action="store_true")
    parser.add_argument("--skip-bestdori", action="store_true")
    parser.add_argument("--skip-gist-fetch", action="store_true")
    parser.add_argument("--verify", action="store_true", help="Verify existing outputs instead of rebuilding.")
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
        if skip_bestdori:
            resource.update(
                {
                    "http_status": "skipped",
                    "content_type": "",
                    "raw_payload_path": "",
                    "raw_payload_sha256": "",
                    "row_count": "",
                    "key_count": "",
                    "error": "skipped by --skip-bestdori",
                }
            )
            resources.append(resource)
            continue
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


def json_ref_list(value: Any, prefix: str) -> str:
    text = normalize_text(value).strip()
    if not text:
        return "[]"
    parts = [item.strip() for item in text.replace(",", ";").split(";") if item.strip()]
    return json.dumps([f"{prefix}-{part}" for part in parts], ensure_ascii=False)


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
    return df


def build_evidence_index(audit: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for _, row in audit.iterrows():
        refs = json.loads(row["evidence_refs"])
        evidence_id = refs[0]
        source_file = row["gist_source_file"]
        rows.append(
            {
                "evidence_id": evidence_id,
                "resource_key": row["resource_key"],
                "evidence_type": "raw_source",
                "evidence_path": f"raw/gist/{row['source_snapshot_id'].split('-', 4)[-1]}/{source_file}.gz",
                "evidence_sha256": "",
                "evidence_created_at": "",
                "evidence_created_by": "build_bangdream_resource_audit.py",
                "evidence_used_for": "source_row_identity",
                "evidence_summary": f"{source_file}:{row['gist_row_number']}",
                "is_committed_to_repo": True,
                "external_artifact_url": "",
            }
        )
    return pd.DataFrame(rows)


def apply_evidence_hashes(evidence: pd.DataFrame, gist_manifest: dict[str, Any]) -> pd.DataFrame:
    hash_by_source = {
        name: info.get("sha256", "") for name, info in gist_manifest.get("files", {}).items()
    }
    for idx, row in evidence.iterrows():
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
                "needs_llm_review_count": int(group["needs_llm_review"].sum()),
                "needs_human_review_count": int(group["needs_human_review"].sum()),
            }
        )
    return pd.DataFrame(rows, columns=FAMILY_SUMMARY_COLUMNS).sort_values("family")


def build_resource_summary(
    audit: pd.DataFrame,
    gist_files: dict[str, bytes],
    bestdori_snapshot: dict[str, Any],
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
npm run deskpet:audit -- --all-current-pool
npm run deskpet:audit -- --verify
```

默认命令会生成完整基础审计表，但只在终端输出 `--limit` 控制的小批量预览；下载、转换、真实浏览器渲染、animetimm 推理和复核字段保持 fail-closed 的 `pending` / `unknown`。

## 关键口径

- `row_kind` 是单值主分类：`current_pool | covered_candidate | union_only`。
- `is_union_reference` 表示资源是否存在于 Bestdori 五服 `live2d.chara` union 中，可以和 `is_current_pool` / `is_covered_candidate` 同时为 `true`。
- `final_content_rating` 只允许 `general | sensitive | questionable | explicit | unknown`；工程拒绝写入 `content_policy_decision=reject`。
- `policy_reject_count` 来自 `content_policy_decision`，不是 content rating。
- `tag-rating-mapping-v1.json` 是 tag->rating 和低置信阈值的唯一事实源。

## 文件

- `audit.parquet`：完整主表。
- `audit.csv`：reviewer 轻量视图，UTF-8 with BOM。
- `audit.schema.json`：字段、枚举和 CSV 列约束。
- `source-snapshot.json`：gist / Bestdori / current pool / tagger source snapshot。
- `evidence-index.parquet` / `evidence-index.csv`：证据索引。
- `family-summary.csv`：按 family 汇总的快速检查表。
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
        "tagger": tagger_snapshot,
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
        "resource-intelligence-summary.json",
    ]
    missing = [name for name in required if not (output_dir / name).exists()]
    if missing:
        raise SystemExit(f"Missing audit outputs: {', '.join(missing)}")
    audit = pq.read_table(output_dir / "audit.parquet").to_pandas()
    csv_df = pd.read_csv(output_dir / "audit.csv", keep_default_na=False)
    schema = read_json(output_dir / "audit.schema.json")
    evidence = pd.read_csv(output_dir / "evidence-index.csv", keep_default_na=False)
    family = pd.read_csv(output_dir / "family-summary.csv", keep_default_na=False)
    if len(audit) != len(csv_df):
        raise SystemExit(f"audit.parquet rows ({len(audit)}) != audit.csv rows ({len(csv_df)})")
    if set(schema["csvColumns"]) - set(csv_df.columns):
        raise SystemExit("audit.csv is missing schema csvColumns")
    if list(family.columns) != FAMILY_SUMMARY_COLUMNS:
        raise SystemExit("family-summary.csv columns do not match the expected order")
    if not set(audit["final_content_rating"]).issubset(CONTENT_RATINGS):
        raise SystemExit("Invalid final_content_rating value found")
    if not set(audit["content_policy_decision"]).issubset(CONTENT_POLICY_DECISIONS):
        raise SystemExit("Invalid content_policy_decision value found")
    evidence_ids = set(evidence["evidence_id"])
    for refs in audit["evidence_refs"]:
        for evidence_id in json.loads(refs):
            if evidence_id not in evidence_ids:
                raise SystemExit(f"Evidence reference missing: {evidence_id}")
    print(f"Verified {len(audit)} audit rows and {len(evidence)} evidence rows.")


def main() -> None:
    args = parse_args()
    output_dir = Path(args.output_dir).resolve()
    if args.verify:
        verify_outputs(output_dir)
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
    source_snapshot = build_source_snapshot(
        output_dir,
        gist_manifest,
        bestdori_snapshot,
        pool,
        sha256_bytes(tag_mapping_bytes),
        tagger_snapshot,
    )
    source_snapshot_id = source_snapshot["source_snapshot_id"]
    audit = build_audit_table(files, current_pool, source_snapshot_id)
    evidence = apply_evidence_hashes(build_evidence_index(audit), gist_manifest)
    family_summary = build_family_summary(audit)
    schema = schema_for_audit(audit)
    resource_summary = build_resource_summary(audit, files, bestdori_snapshot)
    write_outputs(output_dir, audit, evidence, family_summary, schema, source_snapshot, resource_summary)
    verify_outputs(output_dir)

    preview = audit.iloc[args.offset : args.offset + args.limit][
        ["resource_key", "row_kind", "final_content_rating", "content_policy_decision"]
    ]
    print(preview.to_string(index=False))
    print(
        json.dumps(
            {
                "output_dir": str(output_dir.relative_to(REPO_ROOT)),
                "rows": len(audit),
                "current_pool_rows": int(audit["is_current_pool"].sum()),
                "covered_candidate_rows": int(audit["is_covered_candidate"].sum()),
                "union_reference_rows": int(audit["is_union_reference"].sum()),
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
