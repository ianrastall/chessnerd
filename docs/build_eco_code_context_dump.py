#!/usr/bin/env python3
"""
Build a plain-text/markdown hybrid context dump for the ECO Code Browser page.

This dump is intended for LLM handoff and review. It includes:
- Full ECO-specific files.
- Selected shared-file sections used for site integration.
- A structured snapshot of js/eco-code.json.
- Recent git history for ECO-relevant files.

Usage:
    python docs/build_eco_code_context_dump.py
    python docs/build_eco_code_context_dump.py --output docs/eco-code-context.txt
    python docs/build_eco_code_context_dump.py --json-sample-size 20
"""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from collections import Counter
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Iterable


@dataclass(frozen=True)
class FullFileSpec:
    path: str
    title: str | None = None


@dataclass(frozen=True)
class MarkerSectionSpec:
    path: str
    title: str
    start_contains: str
    end_contains: str
    start_occurrence: int = 1
    end_occurrence: int = 1
    include_end_line: bool = True


FULL_FILES: tuple[FullFileSpec, ...] = (
    FullFileSpec("docs/eco-code-how-it-works.md"),
    FullFileSpec("docs/build_eco_code_context_dump.py"),
    FullFileSpec("eco-code.html"),
)


MARKER_SECTIONS: tuple[MarkerSectionSpec, ...] = (
    MarkerSectionSpec(
        path="index.html",
        title="ECO tool registration + homepage card routing",
        start_contains="const tools = [",
        end_contains="renderToolGrid();",
        include_end_line=True,
    ),
    MarkerSectionSpec(
        path="sitemap.xml",
        title="ECO route sitemap entry",
        start_contains="<loc>https://chessnerd.net/eco-code.html</loc>",
        end_contains="</url>",
        include_end_line=True,
    ),
    MarkerSectionSpec(
        path="chesscom-api.html",
        title="Chess.com API payload docs where ECO appears",
        start_contains='"eco": "string", //URL pointing to ECO opening (if available),',
        end_contains="}",
        start_occurrence=1,
        end_occurrence=1,
        include_end_line=True,
    ),
)


EXT_TO_LANG = {
    ".html": "html",
    ".js": "javascript",
    ".css": "css",
    ".json": "json",
    ".py": "python",
    ".md": "markdown",
    ".txt": "text",
    ".xml": "xml",
    ".ps1": "powershell",
}


def language_for(path: Path) -> str:
    return EXT_TO_LANG.get(path.suffix.lower(), "text")


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def read_text(repo_root: Path, relative_path: str) -> str:
    return (repo_root / relative_path).read_text(encoding="utf-8")


def read_lines(repo_root: Path, relative_path: str) -> list[str]:
    return read_text(repo_root, relative_path).splitlines()


def find_line_contains(
    lines: Iterable[str],
    needle: str,
    occurrence: int = 1,
    start_from_line: int = 1,
) -> int:
    if occurrence < 1:
        raise ValueError("occurrence must be >= 1")
    if start_from_line < 1:
        raise ValueError("start_from_line must be >= 1")

    count = 0
    for idx, line in enumerate(lines, start=1):
        if idx < start_from_line:
            continue
        if needle in line:
            count += 1
            if count == occurrence:
                return idx
    raise ValueError(f"Unable to find marker '{needle}' occurrence {occurrence}")


def format_with_line_numbers(lines: list[str], start_line: int) -> str:
    rendered: list[str] = []
    for idx, line in enumerate(lines, start=start_line):
        rendered.append(f"{idx:5}: {line}")
    return "\n".join(rendered)


def render_header(repo_root: Path, output: Path) -> list[str]:
    generated = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    return [
        "# ECO Code Browser Context Dump",
        "",
        f"- Generated: {generated}",
        f"- Repo root: {repo_root}",
        f"- Output: {output}",
        "",
        "This dump is intended for LLM context handoff and workflow review.",
        "",
        "## Included Files",
        "",
        "- Full: docs/eco-code-how-it-works.md",
        "- Full: docs/build_eco_code_context_dump.py",
        "- Full: eco-code.html",
        "- Partial: index.html (tool registration + card routing)",
        "- Partial: sitemap.xml (eco-code route)",
        "- Partial: chesscom-api.html (example payload section containing ECO field)",
        "- Snapshot: js/eco-code.json (schema, counts, samples)",
        "",
    ]


def render_full_file(repo_root: Path, spec: FullFileSpec) -> list[str]:
    source_path = repo_root / spec.path
    if not source_path.exists():
        return [
            f"## Full File: `{spec.path}`",
            "",
            f"[MISSING] {source_path}",
            "",
        ]

    body = source_path.read_text(encoding="utf-8")
    title = spec.title or spec.path
    language = language_for(Path(spec.path))
    return [
        f"## Full File: `{title}`",
        "",
        f"Source: `{source_path}`",
        "",
        f"```{language}",
        body,
        "```",
        "",
    ]


def render_marker_section(repo_root: Path, spec: MarkerSectionSpec) -> list[str]:
    source_path = repo_root / spec.path
    if not source_path.exists():
        return [
            f"## Section: `{spec.path}` - {spec.title}",
            "",
            f"[MISSING] {source_path}",
            "",
        ]

    lines = read_lines(repo_root, spec.path)
    try:
        start_line = find_line_contains(lines, spec.start_contains, spec.start_occurrence, 1)
        end_line = find_line_contains(lines, spec.end_contains, spec.end_occurrence, start_line)
        if not spec.include_end_line:
            end_line -= 1
        if end_line < start_line:
            raise ValueError(f"Invalid range {start_line}-{end_line}")
        chunk = lines[start_line - 1 : end_line]
    except ValueError as exc:
        return [
            f"## Section: `{spec.path}` - {spec.title}",
            "",
            f"[ERROR] {exc}",
            "",
        ]

    numbered = format_with_line_numbers(chunk, start_line)
    return [
        f"## Section: `{spec.path}` - {spec.title} (lines {start_line}-{end_line})",
        "",
        f"Source: `{source_path}`",
        "",
        "```text",
        numbered,
        "```",
        "",
    ]


def render_json_snapshot(
    repo_root: Path,
    relative_path: str,
    sample_size: int,
    preferred_codes: list[str],
) -> list[str]:
    source_path = repo_root / relative_path
    if not source_path.exists():
        return [
            "## JSON Snapshot",
            "",
            f"[MISSING] {source_path}",
            "",
        ]

    try:
        payload = json.loads(source_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return [
            "## JSON Snapshot",
            "",
            f"[ERROR] Unable to parse JSON: {exc}",
            "",
        ]

    if not isinstance(payload, dict):
        return [
            "## JSON Snapshot",
            "",
            f"[ERROR] Expected top-level object, got {type(payload).__name__}",
            "",
        ]

    node_count = len(payload)
    sha = sha256_file(source_path)
    schema_keys = sorted(
        {
            key
            for node in payload.values()
            if isinstance(node, dict)
            for key in node.keys()
        }
    )

    roots = sorted([code for code in payload.keys() if len(code) == 1])
    depth_counts: Counter[int] = Counter()
    leaf_count = 0
    max_children = 0
    nodes_with_openings = 0
    openings_total = 0

    for code, node in payload.items():
        if not isinstance(node, dict):
            continue

        depth_counts[len(code)] += 1

        children = node.get("children")
        if not isinstance(children, list):
            children = []
        if not children:
            leaf_count += 1
        max_children = max(max_children, len(children))

        openings = node.get("openings")
        if isinstance(openings, list):
            opening_len = len(openings)
            openings_total += opening_len
            if opening_len > 0:
                nodes_with_openings += 1

    top_children = []
    for root_code in roots:
        children = payload.get(root_code, {}).get("children", [])
        count = len(children) if isinstance(children, list) else 0
        top_children.append((root_code, count))

    requested = [code.strip() for code in preferred_codes if code.strip()]
    sample_codes: list[str] = []
    for code in requested:
        if code in payload and code not in sample_codes:
            sample_codes.append(code)

    if len(sample_codes) < sample_size:
        for code in sorted(payload.keys()):
            if code not in sample_codes:
                sample_codes.append(code)
                if len(sample_codes) >= sample_size:
                    break

    sample_obj = {code: payload[code] for code in sample_codes}
    sample_json = json.dumps(sample_obj, ensure_ascii=False, indent=2)

    out: list[str] = []
    out.extend(
        [
            "## JSON Snapshot",
            "",
            f"Source: `{source_path}`",
            f"- SHA256: `{sha}`",
            f"- Nodes: {node_count}",
            f"- Root volumes: {', '.join(roots) if roots else '(none)'}",
            f"- Schema keys: {', '.join(schema_keys) if schema_keys else '(none)'}",
            f"- Leaf nodes (no children): {leaf_count}",
            f"- Max children on any node: {max_children}",
            f"- Nodes with named openings: {nodes_with_openings}",
            f"- Total named opening entries: {openings_total}",
            "",
            "### Depth Distribution (key length)",
            "",
            "| Key Length | Node Count |",
            "| ---: | ---: |",
        ]
    )
    for depth in sorted(depth_counts.keys()):
        out.append(f"| {depth} | {depth_counts[depth]} |")
    out.extend(
        [
            "",
            "### Volume Child Counts",
            "",
            "| Volume | Direct Children |",
            "| --- | ---: |",
        ]
    )
    for volume, child_count in top_children:
        out.append(f"| {volume} | {child_count} |")

    out.extend(
        [
            "",
            f"### JSON Sample ({len(sample_codes)} nodes)",
            "",
            "```json",
            sample_json,
            "```",
            "",
        ]
    )
    return out


def render_git_history(repo_root: Path, paths: list[str], max_lines: int = 30) -> list[str]:
    out = [
        "## Recent Git History",
        "",
    ]
    cmd = [
        "git",
        "-C",
        str(repo_root),
        "log",
        "--date=short",
        "--pretty=format:- %h | %ad | %s",
        "--",
        *paths,
    ]
    try:
        result = subprocess.run(
            cmd,
            check=False,
            capture_output=True,
            text=True,
            encoding="utf-8",
        )
        if result.returncode != 0:
            err = result.stderr.strip() or "Unknown git error"
            out.extend([f"Unable to collect git history: {err}", ""])
            return out

        rows = [line for line in result.stdout.splitlines() if line.strip()]
        if not rows:
            out.extend(["No history found.", ""])
            return out

        out.extend(rows[:max_lines])
        out.append("")
        return out
    except OSError as exc:
        out.extend([f"Unable to collect git history: {exc}", ""])
        return out


def build_dump(
    repo_root: Path,
    output: Path,
    json_sample_size: int,
    json_sample_codes: list[str],
) -> str:
    out: list[str] = []
    out.extend(render_header(repo_root, output))
    out.extend(
        render_json_snapshot(
            repo_root=repo_root,
            relative_path="js/eco-code.json",
            sample_size=json_sample_size,
            preferred_codes=json_sample_codes,
        )
    )

    for spec in FULL_FILES:
        out.extend(render_full_file(repo_root, spec))

    for spec in MARKER_SECTIONS:
        out.extend(render_marker_section(repo_root, spec))

    out.extend(
        render_git_history(
            repo_root,
            paths=[
                "eco-code.html",
                "js/eco-code.json",
                "index.html",
                "sitemap.xml",
                "docs/eco-code-how-it-works.md",
            ],
            max_lines=35,
        )
    )

    return "\n".join(out).rstrip() + "\n"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build ECO Code Browser context dump text.")
    parser.add_argument(
        "--output",
        default="docs/eco-code-context.txt",
        help="Output path (relative to repo root unless absolute).",
    )
    parser.add_argument(
        "--json-sample-size",
        type=int,
        default=12,
        help="Number of JSON nodes to include in the sample section.",
    )
    parser.add_argument(
        "--json-sample-codes",
        default="A,A00,A00-A09,B,C20,D30,E99",
        help="Comma-separated preferred codes to include first in JSON sample.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    repo_root = Path(__file__).resolve().parents[1]
    output = Path(args.output)
    if not output.is_absolute():
        output = repo_root / output
    output.parent.mkdir(parents=True, exist_ok=True)

    sample_size = max(args.json_sample_size, 1)
    sample_codes = [code.strip() for code in args.json_sample_codes.split(",")]

    dump = build_dump(
        repo_root=repo_root,
        output=output,
        json_sample_size=sample_size,
        json_sample_codes=sample_codes,
    )
    output.write_text(dump, encoding="utf-8")
    print(f"Wrote: {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
