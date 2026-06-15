#!/usr/bin/env python3
"""Lint committed HansBug writing voice reference excerpts."""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

MAX_SINGLE_CHINESE_CHARS = 120
MAX_SOURCE_CHINESE_CHARS = 300

EXCERPT_FENCE_RE = re.compile(
    r"^(?P<fence>`{3,}|~{3,})[ \t]*json[ \t]+hansbug-voice-excerpt[^\n]*\n"
    r"(?P<body>[\s\S]*?)"
    r"^(?P=fence)[ \t]*$",
    re.MULTILINE,
)
CJK_RE = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]")


@dataclass(frozen=True)
class Excerpt:
    file: Path
    location: str
    text: str
    source_url: str
    chinese_chars: int


def count_chinese_chars(text: str) -> int:
    return len(CJK_RE.findall(text))


def as_nonempty_string(value: Any) -> str:
    return value.strip() if isinstance(value, str) else ""


def format_path(path: Path) -> str:
    return str(path)


def iter_reference_files(root: Path) -> Iterable[Path]:
    for path in sorted(root.rglob("*")):
        if path.is_file() and path.suffix.lower() in {".md", ".json"}:
            yield path


def get_excerpt_text(data: dict[str, Any]) -> str:
    text = data.get("text", data.get("excerpt", ""))
    return text if isinstance(text, str) else ""


def validate_excerpt_object(data: Any, file: Path, location: str, errors: list[str]) -> Excerpt | None:
    if not isinstance(data, dict):
        errors.append(f"{format_path(file)}:{location}: excerpt must be a JSON object")
        return None

    text = get_excerpt_text(data)
    if not text:
        errors.append(f"{format_path(file)}:{location}: missing text/excerpt")
        return None

    source_url = as_nonempty_string(data.get("sourceUrl")) or as_nonempty_string(data.get("url"))
    if not source_url:
        errors.append(f"{format_path(file)}:{location}: missing sourceUrl/url")

    purpose = as_nonempty_string(data.get("purpose")) or as_nonempty_string(data.get("useFor"))
    if not purpose:
        errors.append(f"{format_path(file)}:{location}: missing purpose/useFor")

    chinese_chars = count_chinese_chars(text)
    if chinese_chars > MAX_SINGLE_CHINESE_CHARS:
        errors.append(
            f"{format_path(file)}:{location}: excerpt has {chinese_chars} Chinese chars; "
            f"limit is {MAX_SINGLE_CHINESE_CHARS}"
        )

    if not source_url or not purpose or chinese_chars > MAX_SINGLE_CHINESE_CHARS:
        return None

    return Excerpt(file=file, location=location, text=text, source_url=source_url, chinese_chars=chinese_chars)


def collect_markdown_excerpts(file: Path, errors: list[str]) -> list[Excerpt]:
    text = file.read_text(encoding="utf-8")
    excerpts: list[Excerpt] = []
    for index, match in enumerate(EXCERPT_FENCE_RE.finditer(text), start=1):
        location = f"fence#{index}"
        try:
            parsed = json.loads(match.group("body"))
        except json.JSONDecodeError as exc:
            errors.append(f"{format_path(file)}:{location}: invalid JSON: {exc.msg}")
            continue

        if isinstance(parsed, list):
            for item_index, item in enumerate(parsed, start=1):
                excerpt = validate_excerpt_object(item, file, f"{location}[{item_index}]", errors)
                if excerpt:
                    excerpts.append(excerpt)
        else:
            excerpt = validate_excerpt_object(parsed, file, location, errors)
            if excerpt:
                excerpts.append(excerpt)
    return excerpts


def looks_like_excerpt_object(data: dict[str, Any], in_excerpts_array: bool) -> bool:
    if in_excerpts_array:
        return True
    has_body = isinstance(data.get("text"), str) or isinstance(data.get("excerpt"), str)
    has_metadata = any(isinstance(data.get(key), str) for key in ("sourceUrl", "url", "purpose", "useFor"))
    return has_body and has_metadata


def collect_json_excerpts_from_value(
    value: Any,
    file: Path,
    location: str,
    errors: list[str],
    *,
    in_excerpts_array: bool = False,
) -> list[Excerpt]:
    excerpts: list[Excerpt] = []
    if isinstance(value, dict):
        if looks_like_excerpt_object(value, in_excerpts_array):
            excerpt = validate_excerpt_object(value, file, location, errors)
            if excerpt:
                excerpts.append(excerpt)

        for key, child in value.items():
            child_in_excerpts = key == "excerpts" and isinstance(child, list)
            excerpts.extend(
                collect_json_excerpts_from_value(
                    child,
                    file,
                    f"{location}.{key}",
                    errors,
                    in_excerpts_array=child_in_excerpts,
                )
            )
    elif isinstance(value, list):
        for index, child in enumerate(value):
            excerpts.extend(
                collect_json_excerpts_from_value(
                    child,
                    file,
                    f"{location}[{index}]",
                    errors,
                    in_excerpts_array=in_excerpts_array,
                )
            )
    return excerpts


def collect_json_excerpts(file: Path, errors: list[str]) -> list[Excerpt]:
    try:
        parsed = json.loads(file.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        errors.append(f"{format_path(file)}: invalid JSON: {exc.msg}")
        return []
    return collect_json_excerpts_from_value(parsed, file, "$", errors)


def validate_cumulative_limits(excerpts: list[Excerpt], errors: list[str]) -> None:
    totals: dict[str, int] = {}
    files: dict[str, list[Path]] = {}
    for excerpt in excerpts:
        totals[excerpt.source_url] = totals.get(excerpt.source_url, 0) + excerpt.chinese_chars
        files.setdefault(excerpt.source_url, []).append(excerpt.file)

    for source_url, total in sorted(totals.items()):
        if total > MAX_SOURCE_CHINESE_CHARS:
            file_list = ", ".join(sorted({format_path(path) for path in files[source_url]}))
            errors.append(
                f"{file_list}: sourceUrl {source_url} has {total} Chinese chars across committed excerpts; "
                f"limit is {MAX_SOURCE_CHINESE_CHARS}"
            )


def lint_references(root: Path) -> list[str]:
    errors: list[str] = []
    if not root.exists():
        return [f"{format_path(root)}: references path does not exist"]
    if not root.is_dir():
        return [f"{format_path(root)}: references path must be a directory"]

    excerpts: list[Excerpt] = []
    for file in iter_reference_files(root):
        if file.suffix.lower() == ".md":
            excerpts.extend(collect_markdown_excerpts(file, errors))
        elif file.suffix.lower() == ".json":
            excerpts.extend(collect_json_excerpts(file, errors))

    validate_cumulative_limits(excerpts, errors)
    return errors


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "references",
        nargs="?",
        default=str(Path(__file__).resolve().parents[1] / "references"),
        help="References directory to scan",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = Path(args.references).resolve()
    errors = lint_references(root)
    if errors:
        for error in errors:
            print(error, file=sys.stderr)
        return 1
    print(f"OK: linted {root}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
