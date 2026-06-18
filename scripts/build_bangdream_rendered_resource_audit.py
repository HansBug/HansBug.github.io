#!/usr/bin/env python3
"""Build the rendered-image BanG Dream deskpet resource audit dataset.

This pipeline intentionally classifies resources from final Live2D render PNGs,
not texture atlases. Direct Danbooru rating labels are recorded only as weak
signals; pool recommendations are based on descriptive tags, qualification
checks, deduplication, and review status.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import io
import json
import math
import os
import platform
import shutil
import subprocess
import sys
import time
import urllib.error
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
except ImportError as error:  # pragma: no cover - CLI guard.
    raise SystemExit("Missing dependency: install pandas and pyarrow.") from error


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT_DIR = REPO_ROOT / "src/data/deskpet/bangdream-rendered-resource-audit"
POOL_PATH = REPO_ROOT / "src/data/bangdreamDeskPetPool.json"
MODELS_DIR = REPO_ROOT / "src/vendor/deskpet/bangdream-models"
RENDER_SCRIPT = REPO_ROOT / "scripts/render_bangdream_resource_images.mjs"
GIST_ID = "0badd50993b2958b635889d6eaa0b34c"
GIST_API_URL = f"https://api.github.com/gists/{GIST_ID}"
USER_AGENT = "HansBugTechBlogRenderedAudit/1.0 (+https://github.com/HansBug/HansBug.github.io)"
TAGGER_MODEL_ID = "animetimm/convnextv2_huge.dbv4-full"
TAGGER_MODEL_REVISION = "18177355d1448a69bafb0410a0608e144f714e8b"
TAGGER_MODEL_NAME = f"hf-hub:{TAGGER_MODEL_ID}"
BESTDORI_SERVERS = ["jp", "cn", "en", "kr", "tw"]
PREFERRED_SERVER_ORDER = ["jp", "cn", "en", "kr", "tw"]
AVE_MUJICA_LOCAL_TO_UPSTREAM = {
    "041": "341",
    "042": "337",
    "043": "338",
    "044": "340",
    "045": "339",
}
UPSTREAM_TO_LOCAL = {value: key for key, value in AVE_MUJICA_LOCAL_TO_UPSTREAM.items()}
RATING_LABELS = ["general", "sensitive", "questionable", "explicit"]
RECOMMENDED_POOLS = ["public_candidate", "easter_egg_candidate", "soft_review", "exclude", "pending"]
PIPELINE_STATUSES = [
    "classified",
    "excluded",
    "pending",
    "render_failed",
    "tagger_failed",
    "out_of_scope",
]
GIST_FILES = [
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
    "README.md",
]

HARD_EASTER_TAGS = {
    "swimsuit",
    "bikini",
    "school_swimsuit",
    "bath_towel",
    "onsen",
    "underwear",
    "panties",
    "lingerie",
}
SOFT_REVIEW_TAGS = {
    "navel",
    "midriff",
    "cleavage",
    "crop_top",
    "garter_straps",
}
NON_DECISIVE_SENSITIVE_TAGS = {"thighhighs", "corset", "bare_shoulders"}
QUALIFICATION_FAIL_TAGS = {
    "no_humans",
    "animal_focus",
    "food_focus",
}
QUALIFICATION_REVIEW_TAGS = {"mask", "helmet", "faceless", "multiple_girls", "2girls"}
ANIMAL_COMPANION_REVIEW_TAGS = {"animal", "bird", "dog", "penguin"}
MASCOT_VARIANT_KEYWORDS = {
    "dog",
    "penguin",
    "animal",
    "mascot",
}
POLICY_VERSION = "rendered-descriptive-v1"
TAG_THRESHOLD = 0.5
DEDUPE_COSINE_THRESHOLD = 0.992
DEDUP_COLUMNS = [
    "cluster_id",
    "representative_key",
    "member_count",
    "members_json",
    "dedup_method",
    "threshold",
    "min_similarity",
    "max_similarity",
    "member_similarities_json",
    "representative_reason",
]
DEDUP_PAIR_COLUMNS = [
    "cluster_id",
    "left_key",
    "right_key",
    "method",
    "similarity",
    "threshold",
    "left_sha256",
    "right_sha256",
]

AUDIT_COLUMNS = [
    "resource_key",
    "model_key",
    "local_code",
    "upstream_code",
    "variant",
    "costume_key",
    "family",
    "character_name_zh",
    "character_name_ja",
    "character_name_romaji",
    "band",
    "row_kind",
    "is_current_pool",
    "is_covered_candidate",
    "is_union_reference",
    "is_runtime_eligible",
    "selection_proxy_score",
    "selection_proxy_bucket",
    "selection_proxy_reasons",
    "legacy_content_safety_hint",
    "bestdori_available_servers",
    "bestdori_available_server_count",
    "bestdori_preferred_server",
    "bestdori_build_data_url",
    "bestdori_costume_metadata_found",
    "bestdori_costume_detail_found",
    "bestdori_costume_id",
    "bestdori_card_match_method",
    "bestdori_costume_detail_card_ids",
    "bestdori_title_matched_card_ids",
    "bestdori_event_ids",
    "bestdori_gacha_ids",
    "pipeline_status",
    "recommended_pool",
    "decision_basis",
    "classification_reason_codes",
    "rating_used_as_signal_only",
    "descriptive_tag_basis",
    "qualification_basis",
    "visual_review_basis",
    "review_required",
    "review_status",
    "review_reason_codes",
    "render_status",
    "render_evidence_ref",
    "render_image_path",
    "render_image_sha256",
    "render_canvas_width",
    "render_canvas_height",
    "render_nonblank_ratio",
    "render_bounds_width",
    "render_bounds_height",
    "render_complete_person_decision",
    "render_attempt_count",
    "render_error",
    "tagger_status",
    "tagger_model_id",
    "tagger_model_revision",
    "tagger_top_tags_top30_json",
    "tagger_policy_tag_scores_json",
    "direct_rating_predicted_label",
    "direct_rating_confidence",
    "direct_rating_margin",
    "direct_rating_scores_json",
    "embedding_ref",
    "embedding_sha256",
    "expected_character_id",
    "expected_character_name",
    "source_model_character_id",
    "rendered_character_match_status",
    "character_match_basis",
    "face_visibility_status",
    "multi_subject_status",
    "qualification_status",
    "qualification_reason_codes",
    "dedup_status",
    "dedup_cluster_id",
    "dedup_representative_key",
    "dedup_similarity",
    "dedup_method",
    "exclude_reason",
    "evidence_refs",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
    parser.add_argument("--verify", action="store_true")
    parser.add_argument("--allow-partial", action="store_true", help="Allow limited pilot outputs to pass verify.")
    parser.add_argument("--refresh", action="store_true", help="Fetch a new Bestdori/gist snapshot.")
    parser.add_argument("--skip-gist-fetch", action="store_true")
    parser.add_argument("--skip-bestdori", action="store_true")
    parser.add_argument("--skip-costume-details", action="store_true")
    parser.add_argument("--skip-render", action="store_true")
    parser.add_argument("--skip-tagger", action="store_true")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--render-limit", type=int, default=None)
    parser.add_argument("--render-offset", type=int, default=0)
    parser.add_argument("--render-concurrency", type=int, default=4)
    parser.add_argument("--tagger-limit", type=int, default=None)
    parser.add_argument("--tagger-batch-size", type=int, default=16)
    parser.add_argument("--tagger-device", default="auto")
    parser.add_argument("--dedup-threshold", type=float, default=DEDUPE_COSINE_THRESHOLD)
    parser.add_argument("--sample-per-pool", type=int, default=40)
    parser.add_argument("--dedup-sample-clusters", type=int, default=20)
    return parser.parse_args()


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def normalize_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and math.isnan(value):
        return ""
    return str(value).strip()


def read_json(path: Path) -> Any:
    return json.loads(path.read_text("utf-8"))


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n", "utf-8")


def display_path(path: Path) -> str:
    try:
        return path.resolve().relative_to(REPO_ROOT).as_posix()
    except ValueError:
        return str(path.resolve())


def markdown_relative_path(target: Path, base_dir: Path) -> str:
    return os.path.relpath(target.resolve(), base_dir.resolve()).replace(os.sep, "/")


def resolve_evidence_path(output_dir: Path, value: str) -> Path:
    path = Path(value)
    if path.is_absolute():
        return path
    repo_path = REPO_ROOT / path
    if repo_path.exists():
        return repo_path
    return output_dir / path


def request_url(url: str, *, timeout: int = 90) -> tuple[bytes, dict[str, str], int]:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.read(), dict(response.headers), int(response.status)
    except urllib.error.HTTPError as error:
        if error.code not in {403, 429}:
            raise
    try:
        result = subprocess.run(
            [
                "curl",
                "-L",
                "--fail",
                "--silent",
                "--show-error",
                "--retry",
                "3",
                "-A",
                USER_AGENT,
                "--max-time",
                str(timeout),
                url,
            ],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        return result.stdout, {"Content-Type": ""}, 200
    except subprocess.CalledProcessError as error:
        raise RuntimeError(error.stderr.decode("utf-8", "replace") or str(error)) from error


def write_gzip(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(path, "wb") as file:
        file.write(data)


def read_gzip_json(path: Path) -> Any:
    return json.loads(gzip.decompress(path.read_bytes()).decode("utf-8"))


def read_csv_bytes(data: bytes) -> pd.DataFrame:
    return pd.read_csv(io.BytesIO(data), keep_default_na=False)


def csv_list(value: Any) -> str:
    if isinstance(value, list):
        return json.dumps([str(item) for item in value if str(item)], ensure_ascii=False)
    text = normalize_text(value)
    if not text:
        return "[]"
    if text.startswith("["):
        try:
            parsed = json.loads(text)
            if isinstance(parsed, list):
                return json.dumps([str(item) for item in parsed if str(item)], ensure_ascii=False)
        except json.JSONDecodeError:
            pass
    return json.dumps([item.strip() for item in text.split(";") if item.strip()], ensure_ascii=False)


def parse_json_list(value: Any) -> list[str]:
    text = normalize_text(value)
    if not text:
        return []
    try:
        parsed = json.loads(text)
        if isinstance(parsed, list):
            return [str(item) for item in parsed if str(item)]
    except json.JSONDecodeError:
        pass
    return [item.strip() for item in text.split(";") if item.strip()]


def normalize_code(value: Any) -> str:
    text = normalize_text(value)
    return text.zfill(3) if text.isdigit() else text


def split_costume_key(costume_key: str) -> tuple[str, str]:
    head, _, tail = costume_key.partition("_")
    return normalize_code(head), tail


def infer_family(variant: str) -> str:
    if "swim" in variant or "mizugi" in variant:
        return "swimsuit"
    if "kirameki_festival" in variant:
        return "kirameki_festival"
    if "dream_festival" in variant:
        return "dream_festival"
    if "birthday" in variant:
        return "birthday"
    if "collabo" in variant or "miku" in variant:
        return "collabo"
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
    return "other"


def build_data_url(server: str, costume_key: str) -> str:
    return f"https://bestdori.com/assets/{server}/live2d/chara/{costume_key}_rip/buildData.asset"


def load_pool() -> dict[str, Any]:
    return read_json(POOL_PATH)


def pool_characters(pool: dict[str, Any]) -> dict[str, dict[str, Any]]:
    rows = {}
    for character in pool["characters"]:
        local_code = normalize_code(character["code"])
        upstream_code = AVE_MUJICA_LOCAL_TO_UPSTREAM.get(local_code, local_code)
        rows[local_code] = {
            "local_code": local_code,
            "upstream_code": upstream_code,
            "character_name_zh": character.get("name", ""),
            "character_name_ja": character.get("nameJa", ""),
            "character_name_romaji": character.get("nameRomaji", ""),
            "band": character.get("band", ""),
            "variants": list(character.get("variants", [])),
        }
    return rows


def current_pool_keys(pool: dict[str, Any]) -> set[str]:
    keys = set()
    for character in pool["characters"]:
        local_code = normalize_code(character["code"])
        for variant in character.get("variants", []):
            keys.add(f"bangdream_{local_code}_{variant}")
    return keys


def fetch_gist(output_dir: Path, skip_fetch: bool) -> tuple[dict[str, bytes], dict[str, Any]]:
    raw_dir = output_dir / "raw/gist"
    if skip_fetch:
        manifests = sorted(raw_dir.glob("*/manifest.json"))
        if not manifests:
            return {}, {"status": "skipped", "files": {}, "gist_revision_sha": ""}
        manifest = read_json(manifests[-1])
        files = {
            name: gzip.decompress((manifests[-1].parent / f"{name}.gz").read_bytes())
            for name in manifest.get("files", {})
        }
        return files, manifest

    try:
        data, _, status = request_url(GIST_API_URL)
        gist = json.loads(data.decode("utf-8"))
    except Exception as error:  # noqa: BLE001
        return {"_error": str(error).encode("utf-8")}, {"status": "failed", "error": str(error), "files": {}, "gist_revision_sha": ""}

    revision = gist["history"][0]["version"]
    gist_dir = raw_dir / revision
    files: dict[str, bytes] = {}
    manifest_files: dict[str, Any] = {}
    for name in GIST_FILES:
        if name not in gist.get("files", {}):
            continue
        info = gist["files"][name]
        raw, headers, raw_status = request_url(info["raw_url"])
        files[name] = raw
        gz_path = gist_dir / f"{name}.gz"
        write_gzip(gz_path, raw)
        manifest_files[name] = {
            "raw_url": info["raw_url"],
            "size": len(raw),
            "sha256": sha256_bytes(raw),
            "content_type": headers.get("Content-Type", ""),
            "http_status": raw_status,
            "raw_payload_path": gz_path.relative_to(output_dir).as_posix(),
        }
    manifest = {
        "status": "fetched",
        "gist_id": GIST_ID,
        "gist_api_url": GIST_API_URL,
        "gist_revision_sha": revision,
        "fetched_at": utc_now(),
        "http_status": status,
        "files": manifest_files,
    }
    write_json(gist_dir / "manifest.json", manifest)
    return files, manifest


def fetch_bestdori(output_dir: Path, skip_bestdori: bool, skip_costume_details: bool, concurrency: int = 16) -> dict[str, Any]:
    raw_root = output_dir / "raw/bestdori"
    if skip_bestdori:
        manifests = sorted(raw_root.glob("*/manifest.json"))
        if not manifests:
            raise SystemExit("--skip-bestdori requested but no snapshot manifest exists.")
        return read_json(manifests[-1])

    fetched_at = utc_now()
    snapshot_id = fetched_at.replace(":", "").replace("-", "")
    raw_dir = raw_root / snapshot_id
    resources = []
    payloads: dict[str, Any] = {}
    urls: list[tuple[str, str, str]] = []
    for server in BESTDORI_SERVERS:
        urls.append((f"explorer_assets_{server}", f"https://bestdori.com/api/explorer/{server}/assets/_info.json", server))
    urls.extend(
        [
            ("costumes_all_5", "https://bestdori.com/api/costumes/all.5.json", ""),
            ("cards_all_5", "https://bestdori.com/api/cards/all.5.json", ""),
            ("events_all_5", "https://bestdori.com/api/events/all.5.json", ""),
            ("gacha_all_5", "https://bestdori.com/api/gacha/all.5.json", ""),
        ]
    )
    for key, url, server in urls:
        raw_path = raw_dir / f"{key}.json.gz"
        item = {"key": key, "api_url": url, "server": server, "fetched_at": fetched_at, "api_version": "all.5/current"}
        try:
            data, headers, status = request_url(url)
            write_gzip(raw_path, data)
            payload = json.loads(data.decode("utf-8"))
            payloads[key] = payload
            item.update(
                {
                    "http_status": status,
                    "content_type": headers.get("Content-Type", ""),
                    "raw_payload_path": raw_path.relative_to(output_dir).as_posix(),
                    "raw_payload_sha256": sha256_bytes(data),
                    "row_count": len(payload) if hasattr(payload, "__len__") else "",
                    "error": "",
                }
            )
        except Exception as error:  # noqa: BLE001
            item.update(
                {
                    "http_status": "failed",
                    "content_type": "",
                    "raw_payload_path": "",
                    "raw_payload_sha256": "",
                    "row_count": "",
                    "error": str(error),
                }
            )
        resources.append(item)

    if not skip_costume_details and isinstance(payloads.get("costumes_all_5"), dict):
        details: dict[str, Any] = {}
        costume_ids = [key for key, value in payloads["costumes_all_5"].items() if value]

        def fetch_detail(costume_id: str) -> tuple[str, Any, str]:
            url = f"https://bestdori.com/api/costumes/{costume_id}.json"
            try:
                data, _, _ = request_url(url, timeout=60)
                return costume_id, json.loads(data.decode("utf-8")), ""
            except Exception as error:  # noqa: BLE001
                return costume_id, None, str(error)

        errors = {}
        with ThreadPoolExecutor(max_workers=max(1, concurrency)) as pool:
            futures = [pool.submit(fetch_detail, costume_id) for costume_id in costume_ids]
            for future in as_completed(futures):
                costume_id, payload, error = future.result()
                if error:
                    errors[costume_id] = error
                else:
                    details[costume_id] = payload
        data = json.dumps(details, ensure_ascii=False, sort_keys=True).encode("utf-8")
        raw_path = raw_dir / "costume_details_all_5.json.gz"
        write_gzip(raw_path, data)
        resources.append(
            {
                "key": "costume_details_all_5",
                "api_url": "https://bestdori.com/api/costumes/{id}.json",
                "server": "",
                "fetched_at": fetched_at,
                "api_version": "all.5",
                "http_status": 200 if not errors else "partial",
                "content_type": "application/json",
                "raw_payload_path": raw_path.relative_to(output_dir).as_posix(),
                "raw_payload_sha256": sha256_bytes(data),
                "row_count": len(details),
                "error": json.dumps(errors, ensure_ascii=False)[:2000],
            }
        )
    manifest = {"snapshot_id": snapshot_id, "fetched_at": fetched_at, "resources": resources}
    write_json(raw_dir / "manifest.json", manifest)
    return manifest


def load_bestdori_payloads(output_dir: Path, manifest: dict[str, Any]) -> dict[str, Any]:
    payloads: dict[str, Any] = {}
    for resource in manifest.get("resources", []):
        path_text = normalize_text(resource.get("raw_payload_path"))
        if not path_text:
            continue
        path = output_dir / path_text
        if path.exists():
            payloads[resource["key"]] = read_gzip_json(path)
    return payloads


def build_gist_lookup(gist_files: dict[str, bytes]) -> dict[str, dict[str, Any]]:
    if "candidate-resource-intelligence.csv" not in gist_files:
        return {}
    df = read_csv_bytes(gist_files["candidate-resource-intelligence.csv"])
    lookup = {}
    for _, row in df.iterrows():
        costume_key = normalize_text(row.get("costume_key"))
        if costume_key:
            lookup[costume_key] = {key: row.get(key, "") for key in row.index}
    return lookup


def build_costume_lookup(payloads: dict[str, Any]) -> dict[str, dict[str, Any]]:
    all_costumes = payloads.get("costumes_all_5") or {}
    details = payloads.get("costume_details_all_5") or {}
    lookup = {}
    for costume_id, item in all_costumes.items():
        if not item:
            continue
        key = normalize_text(item.get("assetBundleName") or item.get("sdResourceName"))
        if not key:
            continue
        lookup[key] = {
            "costume_id": str(costume_id),
            "metadata": item,
            "detail": details.get(str(costume_id)) or {},
        }
    return lookup


def union_costumes(payloads: dict[str, Any]) -> dict[str, list[str]]:
    availability: dict[str, list[str]] = defaultdict(list)
    for server in BESTDORI_SERVERS:
        payload = payloads.get(f"explorer_assets_{server}") or {}
        live2d = ((payload.get("live2d") or {}).get("chara") or {})
        for costume_key in live2d.keys():
            if costume_key.endswith("_general"):
                continue
            availability[costume_key].append(server)
    return dict(availability)


def preferred_server(servers: list[str]) -> str:
    for server in PREFERRED_SERVER_ORDER:
        if server in servers:
            return server
    return servers[0] if servers else ""


def model_key_for(upstream_code: str, variant: str, covered_codes: set[str]) -> tuple[str, str, str]:
    local_code = UPSTREAM_TO_LOCAL.get(upstream_code, upstream_code if upstream_code in covered_codes else f"upstream_{upstream_code}")
    if local_code.startswith("upstream_"):
        model_key = f"{local_code}_{variant}"
    else:
        model_key = f"{local_code}_{variant}"
    return local_code, model_key, f"bangdream_{model_key}"


def build_base_rows(
    pool: dict[str, Any],
    payloads: dict[str, Any],
    gist_lookup: dict[str, dict[str, Any]],
) -> pd.DataFrame:
    characters = pool_characters(pool)
    covered_upstream = {row["upstream_code"] for row in characters.values()}
    covered_local_codes = set(characters)
    current_keys = current_pool_keys(pool)
    costume_lookup = build_costume_lookup(payloads)
    rows = []
    for costume_key, servers in sorted(union_costumes(payloads).items()):
        upstream_code, variant = split_costume_key(costume_key)
        is_covered = upstream_code in covered_upstream
        local_code, model_key, resource_key = model_key_for(upstream_code, variant, covered_local_codes)
        character = characters.get(local_code, {})
        row_kind = "covered_candidate" if is_covered else "union_only"
        if resource_key in current_keys:
            row_kind = "current_pool"
        preferred = preferred_server(servers)
        metadata = costume_lookup.get(costume_key, {})
        detail = metadata.get("detail") or {}
        gist = gist_lookup.get(costume_key, {})
        detail_cards = detail.get("cards") if isinstance(detail.get("cards"), list) else []
        title_cards = parse_json_list(gist.get("title_matched_card_ids") or gist.get("card_ids"))
        row = {
            "resource_key": resource_key,
            "model_key": model_key,
            "local_code": local_code,
            "upstream_code": upstream_code,
            "variant": variant,
            "costume_key": costume_key,
            "family": normalize_text(gist.get("family")) or infer_family(variant),
            "character_name_zh": character.get("character_name_zh", normalize_text(gist.get("name_zh"))),
            "character_name_ja": character.get("character_name_ja", normalize_text(gist.get("name_ja"))),
            "character_name_romaji": character.get("character_name_romaji", ""),
            "band": character.get("band", normalize_text(gist.get("band"))),
            "row_kind": row_kind,
            "is_current_pool": resource_key in current_keys,
            "is_covered_candidate": is_covered,
            "is_union_reference": True,
            "is_runtime_eligible": False,
            "selection_proxy_score": normalize_text(gist.get("selection_proxy_score")),
            "selection_proxy_bucket": normalize_text(gist.get("selection_proxy_bucket")),
            "selection_proxy_reasons": normalize_text(gist.get("selection_proxy_reasons")),
            "legacy_content_safety_hint": normalize_text(gist.get("content_safety_hint")),
            "bestdori_available_servers": csv_list(servers),
            "bestdori_available_server_count": len(servers),
            "bestdori_preferred_server": preferred,
            "bestdori_build_data_url": build_data_url(preferred, costume_key) if preferred else "",
            "bestdori_costume_metadata_found": bool(metadata),
            "bestdori_costume_detail_found": bool(detail),
            "bestdori_costume_id": normalize_text(metadata.get("costume_id")),
            "bestdori_card_match_method": normalize_text(gist.get("card_match_method")),
            "bestdori_costume_detail_card_ids": csv_list(detail_cards),
            "bestdori_title_matched_card_ids": csv_list(title_cards),
            "bestdori_event_ids": csv_list(gist.get("event_ids")),
            "bestdori_gacha_ids": csv_list(gist.get("gacha_ids")),
        }
        rows.append(row)
    df = pd.DataFrame(rows)
    for column in AUDIT_COLUMNS:
        if column not in df.columns:
            df[column] = ""
    return df[AUDIT_COLUMNS]


def write_render_input(audit: pd.DataFrame, output_dir: Path) -> Path:
    path = output_dir / "render-input.jsonl"
    rows = audit[audit["is_covered_candidate"] == True]  # noqa: E712
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file:
        for _, row in rows.iterrows():
            item = {
                "resource_key": row["resource_key"],
                "model_key": row["model_key"],
                "costume_key": row["costume_key"],
                "bestdori_preferred_server": row["bestdori_preferred_server"],
                "bestdori_available_servers": row["bestdori_available_servers"],
                "bestdori_build_data_url": row["bestdori_build_data_url"],
            }
            file.write(json.dumps(item, ensure_ascii=False, sort_keys=True) + "\n")
    return path


def run_render(args: argparse.Namespace, output_dir: Path, render_input: Path) -> dict[str, Any]:
    results_path = output_dir / "render-results.json"
    rendered_dir = output_dir / "rendered"
    command = [
        "node",
        str(RENDER_SCRIPT),
        "--input",
        str(render_input),
        "--output-dir",
        str(rendered_dir),
        "--results",
        str(results_path),
        "--retries",
        "2",
        "--concurrency",
        str(max(1, args.render_concurrency)),
    ]
    if args.render_limit:
        command += ["--limit", str(args.render_limit)]
    if args.render_offset:
        command += ["--offset", str(args.render_offset)]
    if args.force:
        command.append("--force")
    subprocess.run(command, check=True, cwd=REPO_ROOT)
    return read_json(results_path)


def load_render_results(output_dir: Path) -> dict[str, dict[str, Any]]:
    path = output_dir / "render-results.json"
    if not path.exists():
        return {}
    payload = read_json(path)
    return {item["resource_key"]: item for item in payload.get("results", [])}


def apply_render_results(audit: pd.DataFrame, render_results: dict[str, dict[str, Any]], output_dir: Path) -> pd.DataFrame:
    audit = audit.copy()
    for idx, row in audit.iterrows():
        if not bool(row["is_covered_candidate"]):
            audit.at[idx, "pipeline_status"] = "out_of_scope"
            audit.at[idx, "recommended_pool"] = "pending"
            audit.at[idx, "classification_reason_codes"] = csv_list(["out_of_scope"])
            continue
        result = render_results.get(row["resource_key"])
        if not result:
            audit.at[idx, "pipeline_status"] = "pending"
            audit.at[idx, "recommended_pool"] = "pending"
            audit.at[idx, "render_status"] = "pending"
            audit.at[idx, "classification_reason_codes"] = csv_list(["render_pending"])
            continue
        status = normalize_text(result.get("status"))
        audit.at[idx, "render_status"] = status
        audit.at[idx, "render_attempt_count"] = int(result.get("attempt_count") or 0)
        audit.at[idx, "render_error"] = normalize_text(result.get("error"))
        if status in {"rendered", "reused"}:
            image_path = normalize_text(result.get("image_path"))
            audit.at[idx, "render_image_path"] = image_path
            audit.at[idx, "render_image_sha256"] = normalize_text(result.get("image_sha256"))
            audit.at[idx, "render_evidence_ref"] = f"render-{row['resource_key']}"
            audit.at[idx, "render_canvas_width"] = int(result.get("canvas_width") or 0)
            audit.at[idx, "render_canvas_height"] = int(result.get("canvas_height") or 0)
            audit.at[idx, "render_nonblank_ratio"] = float(result.get("nonblank_ratio") or 0)
            audit.at[idx, "render_bounds_width"] = int(result.get("bounds_width") or 0)
            audit.at[idx, "render_bounds_height"] = int(result.get("bounds_height") or 0)
            audit.at[idx, "render_complete_person_decision"] = normalize_text(result.get("complete_person_decision"))
        else:
            audit.at[idx, "pipeline_status"] = "render_failed"
            audit.at[idx, "recommended_pool"] = "exclude"
            audit.at[idx, "exclude_reason"] = status or "render_failed"
            audit.at[idx, "classification_reason_codes"] = csv_list(["render_failed", status])
    return audit


def configure_tagger_cache(output_dir: Path) -> None:
    _ = output_dir
    cache_root = REPO_ROOT / ".cache/deskpet-rendered-resource-audit/tagger"
    os.environ.setdefault("HF_HOME", str(cache_root / "hf"))
    os.environ.setdefault("HF_HUB_CACHE", str(cache_root / "hf/hub"))
    os.environ.setdefault("TORCH_HOME", str(cache_root / "torch"))
    os.environ.setdefault("XDG_CACHE_HOME", str(cache_root / "xdg"))
    os.environ.setdefault("HF_HUB_DISABLE_XET", "1")
    if "HF_TOKEN" not in os.environ and os.environ.get("HF_TOKEN_X"):
        os.environ["HF_TOKEN"] = os.environ["HF_TOKEN_X"]


def tagger_device(name: str):
    import torch

    if name == "auto":
        return "cuda:0" if torch.cuda.is_available() else "cpu"
    if name == "cuda":
        return "cuda:0"
    return name


def load_image_for_tagger(path: Path):
    from PIL import Image

    image = Image.open(path).convert("RGBA")
    background = Image.new("RGBA", image.size, "WHITE")
    background.alpha_composite(image)
    return background.convert("RGB")


def feature_vector(model: Any, tensor: Any):
    import torch

    if not hasattr(model, "forward_features"):
        return None
    features = model.forward_features(tensor)
    if isinstance(features, (list, tuple)):
        features = features[-1]
    if features.ndim == 4:
        if features.shape[1] <= 16 and features.shape[-1] > features.shape[1]:
            features = features.mean(dim=(1, 2))
        else:
            features = features.mean(dim=(-2, -1))
    elif features.ndim == 3:
        features = features.mean(dim=1)
    elif features.ndim != 2:
        features = features.reshape(features.shape[0], -1)
    return torch.nn.functional.normalize(features.float(), dim=1)


def run_tagger_scan(args: argparse.Namespace, audit: pd.DataFrame, output_dir: Path) -> tuple[pd.DataFrame, dict[str, Any]]:
    if args.skip_tagger:
        audit["tagger_status"] = audit["tagger_status"].replace("", "skipped")
        return audit, {"status": "skipped"}

    configure_tagger_cache(output_dir)
    import numpy as np
    import timm
    import torch
    from huggingface_hub import hf_hub_download
    from timm.data import create_transform, resolve_data_config

    selected_tags_path = hf_hub_download(
        TAGGER_MODEL_ID,
        "selected_tags.csv",
        revision=TAGGER_MODEL_REVISION,
        cache_dir=os.environ.get("HF_HUB_CACHE"),
    )
    selected_tags = pd.read_csv(selected_tags_path)
    tag_names = [normalize_text(value) for value in selected_tags["name"].tolist()]
    tag_index = {name: idx for idx, name in enumerate(tag_names)}
    rating_indices = {label: tag_index[label] for label in RATING_LABELS if label in tag_index}
    policy_tags = sorted(
        HARD_EASTER_TAGS
        | SOFT_REVIEW_TAGS
        | NON_DECISIVE_SENSITIVE_TAGS
        | QUALIFICATION_FAIL_TAGS
        | QUALIFICATION_REVIEW_TAGS
        | ANIMAL_COMPANION_REVIEW_TAGS
        | {"1girl", "solo", "looking_at_viewer"}
    )

    model = timm.create_model(TAGGER_MODEL_NAME, pretrained=True).eval()
    device = tagger_device(args.tagger_device)
    model.to(device)
    config = resolve_data_config(model.pretrained_cfg, model=model)
    transform = create_transform(**config, is_training=False)
    jobs = []
    for idx, row in audit.iterrows():
        if normalize_text(row["render_status"]) not in {"rendered", "reused"}:
            continue
        image_path = REPO_ROOT / normalize_text(row["render_image_path"])
        if image_path.exists():
            jobs.append((idx, image_path))
    if args.tagger_limit:
        jobs = jobs[: args.tagger_limit]

    embeddings: dict[str, Any] = {}
    for offset in range(0, len(jobs), args.tagger_batch_size):
        batch = jobs[offset : offset + args.tagger_batch_size]
        images = [transform(load_image_for_tagger(path)) for _, path in batch]
        tensor = torch.stack(images).to(device)
        with torch.inference_mode():
            logits = model(tensor)
            probs_batch = torch.sigmoid(logits).detach().float().cpu().numpy()
            feats = feature_vector(model, tensor)
            feature_batch = feats.detach().float().cpu().numpy() if feats is not None else None
        for item_index, ((idx, _), probs) in enumerate(zip(batch, probs_batch)):
            top_indices = np.argsort(-probs)[:30]
            top_tags = [{"tag": tag_names[int(i)], "score": round(float(probs[int(i)]), 6)} for i in top_indices]
            rating_scores = {label: float(probs[pos]) for label, pos in rating_indices.items()}
            ordered = sorted(rating_scores.items(), key=lambda item: item[1], reverse=True)
            policy_scores = {
                tag: round(float(probs[tag_index[tag]]), 6)
                for tag in policy_tags
                if tag in tag_index
            }
            audit.at[idx, "tagger_status"] = "completed"
            audit.at[idx, "tagger_model_id"] = TAGGER_MODEL_ID
            audit.at[idx, "tagger_model_revision"] = TAGGER_MODEL_REVISION
            audit.at[idx, "tagger_top_tags_top30_json"] = json.dumps(top_tags, ensure_ascii=False)
            audit.at[idx, "tagger_policy_tag_scores_json"] = json.dumps(policy_scores, ensure_ascii=False, sort_keys=True)
            audit.at[idx, "direct_rating_scores_json"] = json.dumps(
                {key: round(value, 6) for key, value in rating_scores.items()},
                ensure_ascii=False,
                sort_keys=True,
            )
            if ordered:
                audit.at[idx, "direct_rating_predicted_label"] = ordered[0][0]
                audit.at[idx, "direct_rating_confidence"] = float(ordered[0][1])
                audit.at[idx, "direct_rating_margin"] = float(ordered[0][1] - (ordered[1][1] if len(ordered) > 1 else 0))
            if feature_batch is not None:
                key = audit.at[idx, "resource_key"]
                embeddings[key] = feature_batch[item_index].astype("float32")
                audit.at[idx, "embedding_ref"] = "embeddings.npz"
        print(f"tagger {min(offset + len(batch), len(jobs))}/{len(jobs)}", file=sys.stderr, flush=True)

    if embeddings:
        emb_path = output_dir / "embeddings.npz"
        np.savez_compressed(emb_path, **embeddings)
        emb_sha = sha256_file(emb_path)
        audit.loc[audit["embedding_ref"] == "embeddings.npz", "embedding_sha256"] = emb_sha
    return audit, {
        "status": "completed",
        "model_id": TAGGER_MODEL_ID,
        "model_revision": TAGGER_MODEL_REVISION,
        "scanned_rows": len(jobs),
        "selected_tags_sha256": sha256_file(Path(selected_tags_path)),
        "embedding_rows": len(embeddings),
        "device": str(device),
    }


def tag_scores(row: pd.Series) -> dict[str, float]:
    text = normalize_text(row.get("tagger_policy_tag_scores_json"))
    if not text:
        return {}
    try:
        payload = json.loads(text)
        return {str(key): float(value) for key, value in payload.items()}
    except Exception:
        return {}


def score_hits(scores: dict[str, float], tags: set[str], threshold: float = TAG_THRESHOLD) -> list[str]:
    return sorted([tag for tag in tags if scores.get(tag, 0.0) >= threshold], key=lambda tag: (-scores.get(tag, 0.0), tag))


def direct_rating_scores(row: pd.Series) -> dict[str, float]:
    text = normalize_text(row.get("direct_rating_scores_json"))
    if not text:
        return {}
    try:
        return {str(key): float(value) for key, value in json.loads(text).items()}
    except Exception:
        return {}


def apply_initial_classification(audit: pd.DataFrame) -> pd.DataFrame:
    audit = audit.copy()
    for idx, row in audit.iterrows():
        refs = [f"source-{row['resource_key']}"]
        if row.get("render_evidence_ref"):
            refs.append(row["render_evidence_ref"])
        audit.at[idx, "evidence_refs"] = json.dumps(refs, ensure_ascii=False)
        audit.at[idx, "is_runtime_eligible"] = False
        audit.at[idx, "rating_used_as_signal_only"] = True
        audit.at[idx, "expected_character_id"] = row["local_code"]
        audit.at[idx, "expected_character_name"] = row["character_name_zh"] or row["character_name_ja"]
        audit.at[idx, "source_model_character_id"] = row["upstream_code"]
        audit.at[idx, "rendered_character_match_status"] = "unknown"
        audit.at[idx, "character_match_basis"] = "metadata" if row["is_covered_candidate"] else "unknown"
        audit.at[idx, "face_visibility_status"] = "unknown"
        audit.at[idx, "multi_subject_status"] = "unknown"
        audit.at[idx, "qualification_status"] = "pending"
        audit.at[idx, "dedup_status"] = "unique"
        audit.at[idx, "review_status"] = "not_required"
        audit.at[idx, "visual_review_basis"] = "rendered_image"

        if row["recommended_pool"] == "exclude" and row["pipeline_status"] == "render_failed":
            audit.at[idx, "qualification_status"] = "fail"
            audit.at[idx, "qualification_reason_codes"] = csv_list(["render_failed"])
            audit.at[idx, "review_status"] = "not_required"
            continue
        if not bool(row["is_covered_candidate"]):
            audit.at[idx, "pipeline_status"] = "out_of_scope"
            audit.at[idx, "recommended_pool"] = "pending"
            audit.at[idx, "review_status"] = "pending"
            continue
        if normalize_text(row["render_status"]) not in {"rendered", "reused"}:
            audit.at[idx, "pipeline_status"] = normalize_text(row["pipeline_status"]) or "pending"
            audit.at[idx, "recommended_pool"] = normalize_text(row["recommended_pool"]) or "pending"
            audit.at[idx, "review_status"] = "pending"
            continue
        if normalize_text(row["tagger_status"]) != "completed":
            audit.at[idx, "pipeline_status"] = "tagger_failed"
            audit.at[idx, "recommended_pool"] = "pending"
            audit.at[idx, "classification_reason_codes"] = csv_list(["tagger_pending"])
            audit.at[idx, "review_status"] = "pending"
            continue

        scores = tag_scores(row)
        hard_hits = score_hits(scores, HARD_EASTER_TAGS)
        soft_hits = score_hits(scores, SOFT_REVIEW_TAGS)
        non_decisive_hits = score_hits(scores, NON_DECISIVE_SENSITIVE_TAGS)
        fail_hits = score_hits(scores, QUALIFICATION_FAIL_TAGS)
        review_hits = score_hits(scores, QUALIFICATION_REVIEW_TAGS)
        animal_companion_hits = score_hits(scores, ANIMAL_COMPANION_REVIEW_TAGS)
        reason_codes = []
        review_reasons = []
        qualification_reasons = []
        variant_text = normalize_text(row["variant"]).lower()
        mascot_keywords = sorted([key for key in MASCOT_VARIANT_KEYWORDS if key in variant_text])
        if mascot_keywords:
            review_hits.extend([f"variant_keyword:{key}" for key in mascot_keywords])
        if animal_companion_hits:
            review_hits.extend([f"animal_companion:{key}" for key in animal_companion_hits])
        if scores.get("multiple_girls", 0.0) >= TAG_THRESHOLD or scores.get("2girls", 0.0) >= TAG_THRESHOLD:
            fail_hits.append("multiple_subject_tag")
        if scores.get("faceless", 0.0) >= TAG_THRESHOLD:
            fail_hits.append("faceless")
        if normalize_text(row.get("render_complete_person_decision")) != "pass":
            review_hits.append("render_complete_person_review")
        if scores.get("1girl", 0.0) < 0.75:
            review_hits.append("low_1girl_score")
        if scores.get("solo", 0.0) < 0.65:
            review_hits.append("low_solo_score")

        if fail_hits:
            audit.at[idx, "pipeline_status"] = "excluded"
            audit.at[idx, "recommended_pool"] = "exclude"
            audit.at[idx, "qualification_status"] = "fail"
            audit.at[idx, "exclude_reason"] = "qualification_failed"
            qualification_reasons = sorted(set(fail_hits))
            reason_codes = ["qualification_failed", *qualification_reasons]
            audit.at[idx, "face_visibility_status"] = "missing" if "faceless" in qualification_reasons else "unknown"
            if any("multiple_subject" in item or item in {"multiple_girls", "2girls"} for item in qualification_reasons):
                audit.at[idx, "multi_subject_status"] = "multiple"
            elif any("animal" in item for item in qualification_reasons):
                audit.at[idx, "multi_subject_status"] = "animal_only"
            elif any("no_humans" in item or "food" in item for item in qualification_reasons):
                audit.at[idx, "multi_subject_status"] = "object_only"
            else:
                audit.at[idx, "multi_subject_status"] = "unknown"
            audit.at[idx, "review_status"] = "not_required"
        elif review_hits:
            audit.at[idx, "pipeline_status"] = "classified"
            audit.at[idx, "recommended_pool"] = "soft_review"
            audit.at[idx, "qualification_status"] = "review"
            qualification_reasons = sorted(set(review_hits))
            reason_codes = ["qualification_review", *qualification_reasons]
            review_reasons = reason_codes
            audit.at[idx, "face_visibility_status"] = "partial_mask_ok" if any(item in {"mask", "helmet"} for item in qualification_reasons) else "unknown"
            audit.at[idx, "multi_subject_status"] = "multiple" if any("multiple" in item or "2girls" in item for item in qualification_reasons) else "single"
            audit.at[idx, "review_required"] = True
            audit.at[idx, "review_status"] = "pending"
        elif hard_hits:
            audit.at[idx, "pipeline_status"] = "classified"
            audit.at[idx, "recommended_pool"] = "easter_egg_candidate"
            audit.at[idx, "qualification_status"] = "pass"
            audit.at[idx, "face_visibility_status"] = "visible"
            audit.at[idx, "multi_subject_status"] = "single"
            reason_codes = ["hard_easter_tag", *hard_hits]
            audit.at[idx, "review_required"] = False
            audit.at[idx, "review_status"] = "not_required"
        elif soft_hits:
            audit.at[idx, "pipeline_status"] = "classified"
            audit.at[idx, "recommended_pool"] = "soft_review"
            audit.at[idx, "qualification_status"] = "pass"
            audit.at[idx, "face_visibility_status"] = "visible"
            audit.at[idx, "multi_subject_status"] = "single"
            reason_codes = ["soft_review_tag", *soft_hits]
            review_reasons = reason_codes
            audit.at[idx, "review_required"] = True
            audit.at[idx, "review_status"] = "pending"
        else:
            direct_scores = direct_rating_scores(row)
            if direct_scores.get("questionable", 0.0) >= 0.35 or direct_scores.get("explicit", 0.0) >= 0.2:
                audit.at[idx, "pipeline_status"] = "classified"
                audit.at[idx, "recommended_pool"] = "soft_review"
                reason_codes = ["direct_rating_high_risk_signal"]
                review_reasons = reason_codes
                audit.at[idx, "qualification_status"] = "review"
                audit.at[idx, "review_required"] = True
                audit.at[idx, "review_status"] = "pending"
            else:
                audit.at[idx, "pipeline_status"] = "classified"
                audit.at[idx, "recommended_pool"] = "public_candidate"
                audit.at[idx, "qualification_status"] = "pass"
                audit.at[idx, "face_visibility_status"] = "visible"
                audit.at[idx, "multi_subject_status"] = "single"
                reason_codes = ["no_hard_or_soft_policy_tags"]
                if non_decisive_hits:
                    reason_codes.extend([f"non_decisive:{tag}" for tag in non_decisive_hits])
                audit.at[idx, "review_required"] = False
                audit.at[idx, "review_status"] = "not_required"

        audit.at[idx, "classification_reason_codes"] = csv_list(sorted(set(reason_codes)))
        audit.at[idx, "review_reason_codes"] = csv_list(sorted(set(review_reasons)))
        audit.at[idx, "qualification_reason_codes"] = csv_list(sorted(set(qualification_reasons)))
        audit.at[idx, "decision_basis"] = "rendered_image_descriptive_tags"
        audit.at[idx, "descriptive_tag_basis"] = csv_list(hard_hits + soft_hits + non_decisive_hits)
        audit.at[idx, "qualification_basis"] = "tagger_policy_tags+metadata+variant_keywords"
    return audit


class UnionFind:
    def __init__(self) -> None:
        self.parent: dict[str, str] = {}

    def find(self, item: str) -> str:
        self.parent.setdefault(item, item)
        if self.parent[item] != item:
            self.parent[item] = self.find(self.parent[item])
        return self.parent[item]

    def union(self, left: str, right: str) -> None:
        root_left = self.find(left)
        root_right = self.find(right)
        if root_left != root_right:
            self.parent[root_right] = root_left


def apply_dedup(audit: pd.DataFrame, output_dir: Path, threshold: float) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    audit = audit.copy()
    rows = []
    pair_rows = []
    uf = UnionFind()
    exact_groups = defaultdict(list)
    exact_sha_by_key = {}
    for _, row in audit.iterrows():
        if normalize_text(row["render_image_sha256"]):
            key = row["resource_key"]
            sha = row["render_image_sha256"]
            exact_groups[sha].append(key)
            exact_sha_by_key[key] = sha
    for members in exact_groups.values():
        if len(members) > 1:
            base = members[0]
            for member in members[1:]:
                uf.union(base, member)
                pair_rows.append(
                    {
                        "cluster_id": "",
                        "left_key": base,
                        "right_key": member,
                        "method": "exact_sha256",
                        "similarity": 1.0,
                        "threshold": threshold,
                        "left_sha256": exact_sha_by_key.get(base, ""),
                        "right_sha256": exact_sha_by_key.get(member, ""),
                    }
                )

    embeddings_path = output_dir / "embeddings.npz"
    embeddings = {}
    if embeddings_path.exists():
        import numpy as np

        loaded = np.load(embeddings_path)
        embeddings = {key: loaded[key].astype("float32") for key in loaded.files}
        by_character = defaultdict(list)
        for key, vector in embeddings.items():
            row = audit[audit["resource_key"] == key]
            if not row.empty:
                by_character[normalize_text(row.iloc[0]["local_code"])].append((key, vector))
        for items in by_character.values():
            for i in range(len(items)):
                left_key, left_vec = items[i]
                for j in range(i + 1, len(items)):
                    right_key, right_vec = items[j]
                    similarity = float((left_vec * right_vec).sum())
                    if similarity >= threshold:
                        uf.union(left_key, right_key)
                        pair_rows.append(
                            {
                                "cluster_id": "",
                                "left_key": left_key,
                                "right_key": right_key,
                                "method": "embedding_cosine",
                                "similarity": similarity,
                                "threshold": threshold,
                                "left_sha256": exact_sha_by_key.get(left_key, ""),
                                "right_sha256": exact_sha_by_key.get(right_key, ""),
                            }
                        )

    grouped = defaultdict(list)
    for key in audit["resource_key"]:
        grouped[uf.find(key)].append(key)
    cluster_index = 0
    for members in grouped.values():
        if len(members) <= 1:
            continue
        cluster_index += 1
        member_rows = audit[audit["resource_key"].isin(members)].copy()
        member_rows["_rank"] = member_rows.apply(
            lambda row: (
                0 if row["recommended_pool"] in {"public_candidate", "easter_egg_candidate"} else 1,
                0 if row["is_current_pool"] else 1,
                normalize_text(row["resource_key"]),
            ),
            axis=1,
        )
        representative = member_rows.sort_values("_rank").iloc[0]["resource_key"]
        cluster_id = f"dedup-{cluster_index:04d}"
        similarities: dict[str, float] = {}
        methods = set()
        cluster_pairs = [
            pair
            for pair in pair_rows
            if pair["left_key"] in set(members) and pair["right_key"] in set(members)
        ]
        for pair in cluster_pairs:
            pair["cluster_id"] = cluster_id
        for key in members:
            idx = audit.index[audit["resource_key"] == key][0]
            audit.at[idx, "dedup_cluster_id"] = cluster_id
            audit.at[idx, "dedup_representative_key"] = representative
            if key == representative:
                similarity = 1.0
                method = "representative"
            elif exact_sha_by_key.get(key) and exact_sha_by_key.get(key) == exact_sha_by_key.get(representative):
                similarity = 1.0
                method = "exact_sha256"
            elif key in embeddings and representative in embeddings:
                similarity = float((embeddings[key] * embeddings[representative]).sum())
                method = "embedding_cosine"
            else:
                similarity = 0.0
                method = "union_chain"
            similarities[key] = round(similarity, 6)
            if method != "representative":
                methods.add(method)
            audit.at[idx, "dedup_similarity"] = similarity
            audit.at[idx, "dedup_method"] = method
            if key == representative:
                audit.at[idx, "dedup_status"] = "representative"
            else:
                audit.at[idx, "dedup_status"] = "duplicate"
                audit.at[idx, "recommended_pool"] = "exclude"
                audit.at[idx, "pipeline_status"] = "excluded"
                audit.at[idx, "review_required"] = False
                audit.at[idx, "review_status"] = "not_required"
                audit.at[idx, "exclude_reason"] = "dedup_member"
                reasons = set(parse_json_list(audit.at[idx, "classification_reason_codes"]))
                reasons.add("dedup_member")
                audit.at[idx, "classification_reason_codes"] = csv_list(sorted(reasons))
        rows.append(
            {
                "cluster_id": cluster_id,
                "representative_key": representative,
                "member_count": len(members),
                "members_json": json.dumps(sorted(members), ensure_ascii=False),
                "dedup_method": "+".join(sorted(methods)) if methods else "exact_or_embedding",
                "threshold": threshold,
                "min_similarity": min(similarities.values()) if similarities else 0.0,
                "max_similarity": max(similarities.values()) if similarities else 0.0,
                "member_similarities_json": json.dumps(similarities, ensure_ascii=False, sort_keys=True),
                "representative_reason": "prefer usable pool candidate, then current_pool, then lexical key",
            }
        )
    return audit, pd.DataFrame(rows, columns=DEDUP_COLUMNS), pd.DataFrame(pair_rows, columns=DEDUP_PAIR_COLUMNS)


def build_evidence_index(
    audit: pd.DataFrame,
    output_dir: Path,
    gist_manifest: dict[str, Any],
    sample_index: dict[str, Any] | None = None,
) -> pd.DataFrame:
    rows = []
    source_created_at = gist_manifest.get("fetched_at", utc_now())
    for _, row in audit.iterrows():
        source_id = f"source-{row['resource_key']}"
        rows.append(
            {
                "evidence_id": source_id,
                "resource_key": row["resource_key"],
                "evidence_type": "source_row",
                "evidence_path": "source-snapshot.json",
                "evidence_sha256": "",
                "evidence_created_at": source_created_at,
                "evidence_created_by": "scripts/build_bangdream_rendered_resource_audit.py",
                "evidence_used_for": "resource_identity",
                "evidence_summary": row["costume_key"],
                "is_committed_to_repo": True,
                "external_artifact_url": "",
            }
        )
        if row.get("render_evidence_ref"):
            rows.append(
                {
                    "evidence_id": row["render_evidence_ref"],
                    "resource_key": row["resource_key"],
                    "evidence_type": "rebuildable_render_cache",
                    "evidence_path": normalize_text(row.get("render_image_path")),
                    "evidence_sha256": normalize_text(row.get("render_image_sha256")),
                    "evidence_created_at": "",
                    "evidence_created_by": "scripts/render_bangdream_resource_images.mjs",
                    "evidence_used_for": "final_render_tagger_and_dedup_rebuildable_cache",
                    "evidence_summary": json.dumps(
                        {
                            "status": row.get("render_status", ""),
                            "bounds": [row.get("render_bounds_width", ""), row.get("render_bounds_height", "")],
                            "nonblank_ratio": row.get("render_nonblank_ratio", ""),
                        },
                        ensure_ascii=False,
                        sort_keys=True,
                    ),
                    "is_committed_to_repo": False,
                    "external_artifact_url": "",
                }
            )
    if sample_index:
        for pool_name, pool in sample_index.get("pools", {}).items():
            contact = normalize_text(pool.get("contactSheet"))
            if contact:
                contact_path = REPO_ROOT / contact
                rows.append(
                    {
                        "evidence_id": f"sample-contact-{pool_name}",
                        "resource_key": "",
                        "evidence_type": "committed_contact_sheet",
                        "evidence_path": contact,
                        "evidence_sha256": sha256_file(contact_path) if contact_path.exists() else "",
                        "evidence_created_at": "",
                        "evidence_created_by": "scripts/build_bangdream_rendered_resource_audit.py",
                        "evidence_used_for": "stratified_visual_review",
                        "evidence_summary": pool_name,
                        "is_committed_to_repo": True,
                        "external_artifact_url": "",
                    }
                )
            for item in pool.get("items", []):
                rows.append(
                    {
                        "evidence_id": f"sample-{item['resource_key']}-{pool_name}",
                        "resource_key": item["resource_key"],
                        "evidence_type": "committed_png",
                        "evidence_path": item["image_path"],
                        "evidence_sha256": item["image_sha256"],
                        "evidence_created_at": "",
                        "evidence_created_by": "scripts/build_bangdream_rendered_resource_audit.py",
                        "evidence_used_for": "stratified_visual_review",
                        "evidence_summary": pool_name,
                        "is_committed_to_repo": True,
                        "external_artifact_url": "",
                    }
                )
        for cluster in sample_index.get("dedupClusters", []):
            contact = normalize_text(cluster.get("contactSheet"))
            if contact:
                contact_path = REPO_ROOT / contact
                rows.append(
                    {
                        "evidence_id": f"sample-contact-{cluster['clusterId']}",
                        "resource_key": cluster.get("representativeKey", ""),
                        "evidence_type": "committed_contact_sheet",
                        "evidence_path": contact,
                        "evidence_sha256": sha256_file(contact_path) if contact_path.exists() else "",
                        "evidence_created_at": "",
                        "evidence_created_by": "scripts/build_bangdream_rendered_resource_audit.py",
                        "evidence_used_for": "dedup_visual_review",
                        "evidence_summary": cluster["clusterId"],
                        "is_committed_to_repo": True,
                        "external_artifact_url": "",
                    }
                )
            for item in cluster.get("items", []):
                rows.append(
                    {
                        "evidence_id": f"sample-{item['resource_key']}-{cluster['clusterId']}",
                        "resource_key": item["resource_key"],
                        "evidence_type": "committed_png",
                        "evidence_path": item["image_path"],
                        "evidence_sha256": item["image_sha256"],
                        "evidence_created_at": "",
                        "evidence_created_by": "scripts/build_bangdream_rendered_resource_audit.py",
                        "evidence_used_for": "dedup_visual_review",
                        "evidence_summary": cluster["clusterId"],
                        "is_committed_to_repo": True,
                        "external_artifact_url": "",
                    }
                )
    return pd.DataFrame(rows)


def schema_for(audit: pd.DataFrame) -> dict[str, Any]:
    fields = []
    for column in audit.columns:
        dtype = str(audit[column].dtype)
        if dtype == "bool":
            kind = "boolean"
        elif dtype.startswith("int"):
            kind = "integer"
        elif dtype.startswith("float"):
            kind = "number"
        else:
            kind = "string"
        fields.append({"name": column, "type": kind, "nullable": True})
    return {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "title": "BanG Dream rendered resource audit row",
        "generatedAt": utc_now(),
        "primaryKey": "resource_key",
        "csvColumns": AUDIT_COLUMNS,
        "recommendedPools": RECOMMENDED_POOLS,
        "pipelineStatuses": PIPELINE_STATUSES,
        "policyVersion": POLICY_VERSION,
        "fields": fields,
    }


def classification_policy(args: argparse.Namespace, tagger_summary: dict[str, Any]) -> dict[str, Any]:
    return {
        "policyVersion": POLICY_VERSION,
        "generatedAt": utc_now(),
        "tagThreshold": TAG_THRESHOLD,
        "hardEasterTags": sorted(HARD_EASTER_TAGS),
        "softReviewTags": sorted(SOFT_REVIEW_TAGS),
        "nonDecisiveSensitiveTags": sorted(NON_DECISIVE_SENSITIVE_TAGS),
        "qualificationFailTags": sorted(QUALIFICATION_FAIL_TAGS),
        "qualificationReviewTags": sorted(QUALIFICATION_REVIEW_TAGS),
        "animalCompanionReviewTags": sorted(ANIMAL_COMPANION_REVIEW_TAGS),
        "mascotVariantKeywords": sorted(MASCOT_VARIANT_KEYWORDS),
        "directRatingUse": "weak_signal_only",
        "dedup": {
            "embeddingModel": TAGGER_MODEL_ID,
            "embeddingModelRevision": TAGGER_MODEL_REVISION,
            "distanceMetric": "cosine_similarity",
            "threshold": args.dedup_threshold,
            "algorithm": "threshold_based_union_find_within_expected_character",
            "crossCharacterBehavior": "report_only_not_auto_merge",
            "pairEvidence": "dedup-pairs.csv/parquet",
        },
        "tagger": tagger_summary,
    }


def normalize_dtypes(audit: pd.DataFrame) -> pd.DataFrame:
    bool_columns = [
        "is_current_pool",
        "is_covered_candidate",
        "is_union_reference",
        "is_runtime_eligible",
        "rating_used_as_signal_only",
        "review_required",
        "bestdori_costume_metadata_found",
        "bestdori_costume_detail_found",
    ]
    int_columns = [
        "bestdori_available_server_count",
        "render_canvas_width",
        "render_canvas_height",
        "render_bounds_width",
        "render_bounds_height",
        "render_attempt_count",
    ]
    float_columns = [
        "render_nonblank_ratio",
        "direct_rating_confidence",
        "direct_rating_margin",
        "dedup_similarity",
    ]
    for column in AUDIT_COLUMNS:
        if column not in audit.columns:
            audit[column] = False if column in bool_columns else 0 if column in int_columns else 0.0 if column in float_columns else ""
    for column in bool_columns:
        audit[column] = audit[column].fillna(False).astype(bool)
    for column in int_columns:
        audit[column] = pd.to_numeric(audit[column], errors="coerce").fillna(0).astype(int)
    for column in float_columns:
        audit[column] = pd.to_numeric(audit[column], errors="coerce").fillna(0.0).astype(float)
    for column in AUDIT_COLUMNS:
        if column not in bool_columns and column not in int_columns and column not in float_columns:
            audit[column] = audit[column].fillna("").astype(str)
    return audit[AUDIT_COLUMNS]


def select_stratified(group: pd.DataFrame, limit: int) -> pd.DataFrame:
    if len(group) <= limit:
        return group
    selected = []
    seen = set()
    for _, row in group.sort_values(["band", "local_code", "family", "resource_key"]).iterrows():
        bucket = (row["band"], row["family"], row["local_code"])
        if bucket in seen:
            continue
        selected.append(row.name)
        seen.add(bucket)
        if len(selected) >= limit:
            break
    if len(selected) < limit:
        for idx in group.sort_values("resource_key").index:
            if idx not in selected:
                selected.append(idx)
            if len(selected) >= limit:
                break
    return group.loc[selected]


def create_contact_sheet(items: list[dict[str, str]], output_path: Path) -> None:
    if not items:
        return
    from PIL import Image, ImageDraw, ImageFont

    cols = 5
    cell_w = 260
    cell_h = 300
    rows = math.ceil(len(items) / cols)
    sheet = Image.new("RGB", (cols * cell_w, rows * cell_h), "white")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    for index, item in enumerate(items):
        x = (index % cols) * cell_w
        y = (index // cols) * cell_h
        image = Image.open(REPO_ROOT / item["image_path"]).convert("RGBA")
        bbox = image.getbbox()
        if bbox:
            image = image.crop(bbox)
        image.thumbnail((cell_w - 20, cell_h - 70), Image.Resampling.LANCZOS)
        bg = Image.new("RGB", image.size, "white")
        bg.paste(image, mask=image.split()[-1])
        sheet.paste(bg, (x + (cell_w - bg.width) // 2, y + 6))
        draw.text((x + 6, y + cell_h - 58), f"{index + 1:02d} {item['resource_key'][:32]}", fill="black", font=font)
        draw.text((x + 6, y + cell_h - 42), item["character"][:36], fill="black", font=font)
        draw.text((x + 6, y + cell_h - 26), item["reason"][:44], fill="black", font=font)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output_path, quality=92)


def write_samples_and_report(args: argparse.Namespace, audit: pd.DataFrame, dedup: pd.DataFrame, output_dir: Path) -> dict[str, Any]:
    samples_root = output_dir / "samples"
    sample_index: dict[str, Any] = {"generatedAt": utc_now(), "pools": {}}
    report = ["# BanG Dream 最终渲染资源审计报告", "", f"生成时间：`{utc_now()}`", ""]
    report.append("本报告只展示审计样例和 contact sheet；完整结论以 `audit.csv` / `audit.parquet` 为准。")
    report.append("")
    report.append("## 分布摘要")
    report.append("")
    report.append("| 项 | 数量 |")
    report.append("| --- | ---: |")
    report.append(f"| 总行数 | {len(audit)} |")
    report.append(f"| covered candidate | {int(audit['is_covered_candidate'].sum())} |")
    for pool_name, count in Counter(audit["recommended_pool"]).items():
        report.append(f"| `{pool_name}` | {count} |")
    report.append("")

    pool_dirs = {
        "public_candidate": "public",
        "easter_egg_candidate": "easter",
        "soft_review": "soft-review",
        "exclude": "exclude",
    }
    for pool_name, dir_name in pool_dirs.items():
        group = audit[(audit["recommended_pool"] == pool_name) & (audit["render_image_path"] != "")]
        selected = select_stratified(group, args.sample_per_pool)
        entries = []
        target_dir = samples_root / dir_name
        target_dir.mkdir(parents=True, exist_ok=True)
        for _, row in selected.iterrows():
            source = REPO_ROOT / row["render_image_path"]
            if not source.exists():
                continue
            target = target_dir / f"{row['resource_key']}.png"
            shutil.copyfile(source, target)
            entries.append(
                {
                    "resource_key": row["resource_key"],
                    "image_path": display_path(target),
                    "image_sha256": sha256_file(target),
                    "character": row["character_name_zh"] or row["character_name_ja"],
                    "reason": ",".join(parse_json_list(row["classification_reason_codes"])[:4]),
                }
            )
        contact_path = target_dir / "contact-sheet.jpg"
        create_contact_sheet(entries, contact_path)
        sample_index["pools"][pool_name] = {
            "totalRows": int(len(group)),
            "sampleRows": len(entries),
            "contactSheet": display_path(contact_path) if contact_path.exists() else "",
            "items": entries,
        }
        report.append(f"## {pool_name}")
        report.append("")
        report.append(f"- 总量：`{len(group)}`")
        report.append(f"- 样例：`{len(entries)}`")
        if contact_path.exists():
            report.append(f"- Contact sheet: ![]({markdown_relative_path(contact_path, output_dir)})")
        report.append("")
        report.append("| 图 | 资源 | 角色 | 理由 |")
        report.append("| --- | --- | --- | --- |")
        for item in entries:
            rel = markdown_relative_path(REPO_ROOT / item["image_path"], output_dir)
            report.append(f"| <img src=\"{rel}\" width=\"120\"> | `{item['resource_key']}` | {item['character']} | `{item['reason']}` |")
        report.append("")

    sample_index["dedupClusters"] = []
    dedup_dir = samples_root / "dedup"
    dedup_dir.mkdir(parents=True, exist_ok=True)
    for _, cluster in dedup.head(args.dedup_sample_clusters).iterrows():
        members = json.loads(cluster["members_json"])
        cluster_dir = dedup_dir / cluster["cluster_id"]
        cluster_dir.mkdir(parents=True, exist_ok=True)
        entries = []
        for key in members[:10]:
            row = audit[audit["resource_key"] == key]
            if row.empty:
                continue
            row = row.iloc[0]
            source = REPO_ROOT / row["render_image_path"]
            if not source.exists():
                continue
            prefix = "representative" if key == cluster["representative_key"] else "member"
            target = cluster_dir / f"{prefix}-{key}.png"
            shutil.copyfile(source, target)
            entries.append(
                {
                    "resource_key": key,
                    "image_path": display_path(target),
                    "image_sha256": sha256_file(target),
                    "character": row["character_name_zh"] or row["character_name_ja"],
                    "reason": f"{row['dedup_status']}:{row['dedup_similarity']}",
                }
            )
        contact_path = cluster_dir / "contact-sheet.jpg"
        create_contact_sheet(entries, contact_path)
        sample_index["dedupClusters"].append(
            {
                "clusterId": cluster["cluster_id"],
                "representativeKey": cluster["representative_key"],
                "memberCount": int(cluster["member_count"]),
                "members": members,
                "contactSheet": display_path(contact_path) if contact_path.exists() else "",
                "items": entries,
            }
        )
    if not dedup.empty:
        report.append("## dedup")
        report.append("")
        report.append(f"- cluster 总量：`{len(dedup)}`")
        report.append(f"- 展示 cluster：`{min(len(dedup), args.dedup_sample_clusters)}`")
        report.append("")
        report.append("| Contact sheet | Cluster | 代表项 | 成员数 | 相似度 | 成员 |")
        report.append("| --- | --- | --- | ---: | --- | --- |")
        for info in sample_index["dedupClusters"]:
            cluster = dedup[dedup["cluster_id"] == info["clusterId"]].iloc[0]
            sheet = (
                f"<img src=\"{markdown_relative_path(REPO_ROOT / info['contactSheet'], output_dir)}\" width=\"180\">"
                if info.get("contactSheet")
                else ""
            )
            sim = f"{float(cluster['min_similarity']):.4f}-{float(cluster['max_similarity']):.4f}"
            members_text = "<br>".join(f"`{member}`" for member in info["members"][:8])
            report.append(
                f"| {sheet} | `{info['clusterId']}` | `{info['representativeKey']}` | {info['memberCount']} | `{sim}` | {members_text} |"
            )
        report.append("")
    write_json(samples_root / "index.json", sample_index)
    (output_dir / "resource-audit-report.md").write_text("\n".join(report) + "\n", "utf-8")
    return sample_index


def build_summary(
    audit: pd.DataFrame,
    dedup: pd.DataFrame,
    dedup_pairs: pd.DataFrame,
    snapshots: dict[str, Any],
    tagger_summary: dict[str, Any],
    render_results: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    return {
        "generatedAt": utc_now(),
        "policyVersion": POLICY_VERSION,
        "rowCount": len(audit),
        "rowKindCounts": dict(Counter(audit["row_kind"])),
        "coveredCandidateRows": int(audit["is_covered_candidate"].sum()),
        "currentPoolRows": int(audit["is_current_pool"].sum()),
        "unionReferenceRows": int(audit["is_union_reference"].sum()),
        "pipelineStatusCounts": dict(Counter(audit["pipeline_status"])),
        "recommendedPoolCounts": dict(Counter(audit["recommended_pool"])),
        "renderStatusCounts": dict(Counter(audit["render_status"])),
        "taggerStatusCounts": dict(Counter(audit["tagger_status"])),
        "qualificationStatusCounts": dict(Counter(audit["qualification_status"])),
        "dedupStatusCounts": dict(Counter(audit["dedup_status"])),
        "reviewStatusCounts": dict(Counter(audit["review_status"])),
        "dedupClusterCount": len(dedup),
        "dedupPairCount": len(dedup_pairs),
        "renderAttemptedRows": len(render_results),
        "renderUnattemptedCoveredRows": int(audit[(audit["is_covered_candidate"] == True) & (audit["render_status"] == "pending")].shape[0]),  # noqa: E712
        "taggerCompletedRows": int((audit["tagger_status"] == "completed").sum()),
        "classifiedRows": int((audit["pipeline_status"] == "classified").sum()),
        "failedOrPendingReasonCounts": dict(
            Counter(
                reason
                for _, row in audit[audit["pipeline_status"].isin(["pending", "render_failed", "tagger_failed"])].iterrows()
                for reason in parse_json_list(row["classification_reason_codes"])
            )
        ),
        "sourceSnapshot": {
            "gist": snapshots.get("gist", {}).get("gist_revision_sha", ""),
            "bestdori": snapshots.get("bestdori", {}).get("snapshot_id", ""),
        },
        "tagger": tagger_summary,
    }


def write_outputs(
    output_dir: Path,
    audit: pd.DataFrame,
    evidence: pd.DataFrame,
    dedup: pd.DataFrame,
    dedup_pairs: pd.DataFrame,
    schema: dict[str, Any],
    source_snapshot: dict[str, Any],
    policy: dict[str, Any],
    summary: dict[str, Any],
) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    pq.write_table(pa.Table.from_pandas(audit, preserve_index=False), output_dir / "audit.parquet", compression="zstd")
    pq.write_table(pa.Table.from_pandas(evidence, preserve_index=False), output_dir / "evidence-index.parquet", compression="zstd")
    pq.write_table(pa.Table.from_pandas(dedup, preserve_index=False), output_dir / "dedup-clusters.parquet", compression="zstd")
    pq.write_table(pa.Table.from_pandas(dedup_pairs, preserve_index=False), output_dir / "dedup-pairs.parquet", compression="zstd")
    audit.to_csv(output_dir / "audit.csv", index=False, encoding="utf-8-sig")
    evidence.to_csv(output_dir / "evidence-index.csv", index=False, encoding="utf-8-sig")
    dedup.to_csv(output_dir / "dedup-clusters.csv", index=False, encoding="utf-8-sig")
    dedup_pairs.to_csv(output_dir / "dedup-pairs.csv", index=False, encoding="utf-8-sig")
    review_queue = audit[audit["review_status"] == "pending"][
        ["resource_key", "pipeline_status", "recommended_pool", "review_reason_codes", "render_status", "render_image_path", "tagger_status", "tagger_policy_tag_scores_json"]
    ].copy()
    review_queue["review_queue_kind"] = (
        review_queue.apply(
            lambda row: "visual_review"
            if row["render_status"] in {"rendered", "reused"} and row["tagger_status"] == "completed"
            else "pipeline_pending",
            axis=1,
        )
        if not review_queue.empty
        else ""
    )
    review_queue.to_csv(output_dir / "review-queue.csv", index=False, encoding="utf-8-sig")
    review_queue[review_queue["review_queue_kind"] == "visual_review"].to_csv(
        output_dir / "review-queue-visual.csv", index=False, encoding="utf-8-sig"
    )
    review_queue[review_queue["review_queue_kind"] == "pipeline_pending"].to_csv(
        output_dir / "review-queue-pipeline-pending.csv", index=False, encoding="utf-8-sig"
    )
    write_json(output_dir / "review-results.json", {"generated_at": utc_now(), "status": "not_run", "items": []})
    write_json(output_dir / "audit.schema.json", schema)
    write_json(output_dir / "source-snapshot.json", source_snapshot)
    write_json(output_dir / "classification-policy.json", policy)
    write_json(output_dir / "summary.json", summary)
    write_readme(output_dir, summary)


def write_readme(output_dir: Path, summary: dict[str, Any]) -> None:
    text = f"""# BanG Dream 最终渲染资源审计数据集

本目录由 `scripts/build_bangdream_rendered_resource_audit.py` 生成，用于 PR #28。

生成时间：`{summary['generatedAt']}`

## 关键口径

- tagger 输入是最终渲染 PNG，不是 texture atlas。
- direct rating 只作为弱信号，不能单独决定 `public_candidate` 或 `easter_egg_candidate`。
- 本 PR 只产出数据侧审计资产，不接入 JS / Astro 运行时消费。
- `public_candidate` / `easter_egg_candidate` 是审计建议，不是线上准入。

## 重跑

```bash
python3 scripts/build_bangdream_rendered_resource_audit.py --refresh
python3 scripts/build_bangdream_rendered_resource_audit.py --verify
```

`--verify` 默认执行严格验收：covered candidate 必须全量渲染尝试，成功渲染行必须完成 tagger，dedup duplicate 必须有 pair 证据。调试小样本只能显式使用 `--allow-partial --verify`。
"""
    (output_dir / "README.md").write_text(text, "utf-8")


def source_snapshot(gist_manifest: dict[str, Any], bestdori_snapshot: dict[str, Any], pool: dict[str, Any]) -> dict[str, Any]:
    return {
        "generated_at": utc_now(),
        "script": "scripts/build_bangdream_rendered_resource_audit.py",
        "gist": gist_manifest,
        "bestdori": bestdori_snapshot,
        "current_pool": {
            "pool_path": display_path(POOL_PATH),
            "models_dir": display_path(MODELS_DIR),
            "qualified_character_count": pool.get("pool", {}).get("qualifiedCharacterCount", ""),
            "qualified_variant_count": pool.get("pool", {}).get("qualifiedVariantCount", ""),
            "ave_mujica_local_to_upstream_map": AVE_MUJICA_LOCAL_TO_UPSTREAM,
        },
        "environment": {
            "python": sys.version.split()[0],
            "platform": platform.platform(),
            "pandas": pd.__version__,
        },
    }


def verify_outputs(output_dir: Path, *, allow_partial: bool = False) -> None:
    required = [
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
    ]
    missing = [name for name in required if not (output_dir / name).exists()]
    if missing:
        raise SystemExit(f"Missing outputs: {', '.join(missing)}")
    audit = pq.read_table(output_dir / "audit.parquet").to_pandas()
    csv_df = pd.read_csv(output_dir / "audit.csv", keep_default_na=False)
    evidence = pd.read_csv(output_dir / "evidence-index.csv", keep_default_na=False)
    dedup = pd.read_csv(output_dir / "dedup-clusters.csv", keep_default_na=False)
    dedup_pairs = pd.read_csv(output_dir / "dedup-pairs.csv", keep_default_na=False)
    schema = read_json(output_dir / "audit.schema.json")
    sample_index = read_json(output_dir / "samples/index.json")
    summary = read_json(output_dir / "summary.json")
    render_results_path = output_dir / "render-results.json"
    render_payload = read_json(render_results_path) if render_results_path.exists() else {"results": []}
    if len(audit) != len(csv_df):
        raise SystemExit("audit.csv and audit.parquet row counts differ")
    if summary.get("rowCount") != len(audit):
        raise SystemExit("summary rowCount differs from audit")
    if schema["csvColumns"] != AUDIT_COLUMNS:
        raise SystemExit("schema csvColumns changed unexpectedly")
    if not set(audit["recommended_pool"]).issubset(RECOMMENDED_POOLS):
        raise SystemExit("Invalid recommended_pool value")
    if not set(audit["pipeline_status"]).issubset(PIPELINE_STATUSES):
        raise SystemExit("Invalid pipeline_status value")
    covered = audit[audit["is_covered_candidate"] == True]  # noqa: E712
    if not allow_partial:
        attempted = len(render_payload.get("results", []))
        if attempted != len(covered):
            raise SystemExit(f"Strict verify requires full render attempts: attempted={attempted}, covered={len(covered)}")
        covered_pending = covered[covered["render_status"] == "pending"]
        if not covered_pending.empty:
            raise SystemExit(f"Strict verify found covered render pending rows: {len(covered_pending)}")
        rendered = covered[covered["render_status"].isin(["rendered", "reused"])]
        missing_tagger = rendered[rendered["tagger_status"] != "completed"]
        if not missing_tagger.empty:
            raise SystemExit(f"Strict verify found rendered rows without completed tagger: {len(missing_tagger)}")
        incomplete_pipeline = covered[covered["pipeline_status"] == "pending"]
        if not incomplete_pipeline.empty:
            raise SystemExit(f"Strict verify found pending covered pipeline rows: {len(incomplete_pipeline)}")
    else:
        if render_payload.get("limit") is None and render_payload.get("attempted_rows") != len(covered):
            raise SystemExit("Partial verify saw unbounded render payload with unexpected attempted row count")
    for _, row in audit.iterrows():
        reasons = parse_json_list(row.get("classification_reason_codes"))
        if row["recommended_pool"] in {"public_candidate", "easter_egg_candidate"}:
            if normalize_text(row["render_image_path"]) == "" or normalize_text(row["tagger_status"]) != "completed":
                raise SystemExit(f"Usable pool row missing render/tagger evidence: {row['resource_key']}")
            if reasons == ["direct_rating"] or not reasons:
                raise SystemExit(f"Usable pool row has invalid decision reasons: {row['resource_key']}")
            if normalize_text(row["qualification_status"]) != "pass" or normalize_text(row["review_status"]) == "pending":
                raise SystemExit(f"Usable pool row is not qualification-clean: {row['resource_key']}")
            if any(reason.startswith("animal_companion:") for reason in reasons):
                raise SystemExit(f"Animal companion signal reached usable pool without review: {row['resource_key']}")
            if any(reason in {"qualification_review", "mask", "helmet", "faceless", "multiple_girls", "2girls"} for reason in reasons):
                raise SystemExit(f"Qualification review signal reached usable pool: {row['resource_key']}")
        if row["recommended_pool"] == "easter_egg_candidate":
            if not any(reason in HARD_EASTER_TAGS or reason == "hard_easter_tag" for reason in reasons):
                raise SystemExit(f"Easter row lacks hard tag/review reason: {row['resource_key']}")
        if row["recommended_pool"] == "public_candidate":
            if any(reason in HARD_EASTER_TAGS or reason == "hard_easter_tag" for reason in reasons):
                raise SystemExit(f"Public row contains hard easter reason: {row['resource_key']}")
        if normalize_text(row["review_status"]) == "pending" and row["recommended_pool"] in {"public_candidate", "easter_egg_candidate"}:
            raise SystemExit(f"Pending review row reached usable pool: {row['resource_key']}")
        if row["dedup_status"] == "duplicate":
            if not row["dedup_representative_key"] or row["recommended_pool"] != "exclude":
                raise SystemExit(f"Dedup duplicate is not excluded: {row['resource_key']}")
            has_pair = not dedup_pairs[
                (dedup_pairs["cluster_id"] == row["dedup_cluster_id"])
                & (
                    (dedup_pairs["left_key"] == row["resource_key"])
                    | (dedup_pairs["right_key"] == row["resource_key"])
                )
            ].empty
            if not has_pair:
                raise SystemExit(f"Dedup duplicate lacks pair evidence: {row['resource_key']}")
        if row["direct_rating_predicted_label"] == "sensitive" and row["recommended_pool"] == "easter_egg_candidate":
            reasons_without_direct = [reason for reason in reasons if "direct_rating" not in reason]
            if not reasons_without_direct:
                raise SystemExit(f"Sensitive direct rating alone selected easter pool: {row['resource_key']}")
    evidence_ids = set(evidence["evidence_id"])
    for refs in audit["evidence_refs"]:
        for ref in parse_json_list(refs):
            if ref not in evidence_ids:
                raise SystemExit(f"Missing evidence ref: {ref}")
    for _, row in evidence[evidence["is_committed_to_repo"] == True].iterrows():  # noqa: E712
        path = resolve_evidence_path(output_dir, row["evidence_path"])
        if not path.exists():
            raise SystemExit(f"Committed evidence path missing: {row['evidence_path']}")
        if row["evidence_sha256"] and sha256_file(path) != row["evidence_sha256"]:
            raise SystemExit(f"Committed evidence sha mismatch: {row['evidence_path']}")
    for pool_info in sample_index.get("pools", {}).values():
        for item in pool_info.get("items", []):
            path = REPO_ROOT / item["image_path"]
            if not path.exists():
                raise SystemExit(f"Sample image missing: {item['image_path']}")
            if sha256_file(path) != item["image_sha256"]:
                raise SystemExit(f"Sample image sha mismatch: {item['image_path']}")
            if path.read_bytes()[:8] != b"\x89PNG\r\n\x1a\n":
                raise SystemExit(f"Sample image is not PNG: {item['image_path']}")
    print(f"Verified {len(audit)} audit rows, {len(evidence)} evidence rows, {len(dedup)} dedup clusters.")


def main() -> None:
    args = parse_args()
    output_dir = Path(args.output_dir).resolve()
    if args.verify:
        verify_outputs(output_dir, allow_partial=args.allow_partial)
        return
    if args.force and output_dir.exists():
        shutil.rmtree(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    pool = load_pool()
    gist_files, gist_manifest = fetch_gist(output_dir, args.skip_gist_fetch and not args.refresh)
    bestdori_snapshot = fetch_bestdori(
        output_dir,
        args.skip_bestdori and not args.refresh,
        args.skip_costume_details,
    )
    payloads = load_bestdori_payloads(output_dir, bestdori_snapshot)
    audit = build_base_rows(pool, payloads, build_gist_lookup(gist_files))
    audit = normalize_dtypes(audit)
    render_input = write_render_input(audit, output_dir)
    if not args.skip_render:
        run_render(args, output_dir, render_input)
    render_results = load_render_results(output_dir)
    audit = apply_render_results(audit, render_results, output_dir)
    audit = normalize_dtypes(audit)
    audit, tagger_summary = run_tagger_scan(args, audit, output_dir)
    audit = normalize_dtypes(audit)
    audit = apply_initial_classification(audit)
    audit = normalize_dtypes(audit)
    audit, dedup, dedup_pairs = apply_dedup(audit, output_dir, args.dedup_threshold)
    audit = normalize_dtypes(audit)
    snapshots = {"gist": gist_manifest, "bestdori": bestdori_snapshot}
    sample_index = write_samples_and_report(args, audit, dedup, output_dir)
    src_snapshot = source_snapshot(gist_manifest, bestdori_snapshot, pool)
    evidence = build_evidence_index(audit, output_dir, gist_manifest, sample_index)
    schema = schema_for(audit)
    policy = classification_policy(args, tagger_summary)
    summary = build_summary(audit, dedup, dedup_pairs, snapshots, tagger_summary, render_results)
    summary["sampleIndex"] = {
        pool_name: {"totalRows": info["totalRows"], "sampleRows": info["sampleRows"]}
        for pool_name, info in sample_index.get("pools", {}).items()
    }
    write_outputs(output_dir, audit, evidence, dedup, dedup_pairs, schema, src_snapshot, policy, summary)
    verify_outputs(output_dir, allow_partial=args.allow_partial)
    print(json.dumps({"output_dir": display_path(output_dir), "rows": len(audit), **summary["recommendedPoolCounts"]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
