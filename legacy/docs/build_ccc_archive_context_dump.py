#!/usr/bin/env python3
"""
Build a plain-text/markdown hybrid context dump for the CCC Archive workflow.

This dump is intended for LLM handoff and includes:
- Full CCC page + data files.
- Selected shared-file sections that affect CCC Archive integration.
- Cross-repo mirror checks between chessnerd and ccc-archive.

Usage:
    python docs/build_ccc_archive_context_dump.py
    python docs/build_ccc_archive_context_dump.py --output docs/ccc-archive-context.txt
    python docs/build_ccc_archive_context_dump.py --archive-root ..\\ccc-archive
"""

from __future__ import annotations

import argparse
import hashlib
import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Iterable


@dataclass(frozen=True)
class FullFileSpec:
    repo: str
    path: str
    title: str | None = None


@dataclass(frozen=True)
class MarkerSectionSpec:
    repo: str
    path: str
    title: str
    start_contains: str
    end_contains: str
    start_occurrence: int = 1
    end_occurrence: int = 1
    include_end_line: bool = False


@dataclass(frozen=True)
class MarkerToEndSectionSpec:
    repo: str
    path: str
    title: str
    start_contains: str
    start_occurrence: int = 1


MIRRORED_DATA_FILES: tuple[str, ...] = (
    "ccc_links.txt",
    "events.txt",
    "game_counts.txt",
    "ccc_manifest.json",
)


FULL_FILES: tuple[FullFileSpec, ...] = (
    FullFileSpec("chessnerd", "docs/ccc-archive-how-it-works.md"),
    FullFileSpec("chessnerd", "docs/rebuild_ccc_archive_metadata.py"),
    FullFileSpec("chessnerd", "ccc-archive.html"),
    FullFileSpec("chessnerd", "ccc_links.txt"),
    FullFileSpec("chessnerd", "events.txt"),
    FullFileSpec("chessnerd", "game_counts.txt"),
    FullFileSpec("chessnerd", "ccc_manifest.json"),
    FullFileSpec("archive", "README.md", title="ccc-archive/README.md"),
    FullFileSpec("archive", "ccc_links.txt"),
    FullFileSpec("archive", "events.txt"),
    FullFileSpec("archive", "game_counts.txt"),
    FullFileSpec("archive", "ccc_manifest.json"),
)


MARKER_SECTIONS: tuple[MarkerSectionSpec, ...] = (
    MarkerSectionSpec(
        repo="chessnerd",
        path="index.html",
        title="CCC tool registration + homepage card routing",
        start_contains="const tools = [",
        end_contains="renderToolGrid();",
        include_end_line=True,
    ),
    MarkerSectionSpec(
        repo="chessnerd",
        path="sitemap.xml",
        title="CCC sitemap entry",
        start_contains="<loc>https://chessnerd.net/ccc-archive.html</loc>",
        end_contains="</url>",
        include_end_line=True,
    ),
    MarkerSectionSpec(
        repo="chessnerd",
        path="css/style.css",
        title="Shared layout/header/controls/search/status styles used by CCC page",
        start_contains=":root {",
        end_contains="/* Tool Cards (for homepage) */",
        include_end_line=False,
    ),
)


MARKER_TO_END_SECTIONS: tuple[MarkerToEndSectionSpec, ...] = (
    MarkerToEndSectionSpec(
        repo="chessnerd",
        path="css/style.css",
        title="Responsive rules affecting CCC page layout",
        start_contains="/* Responsive */",
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


def resolve_repo_roots(chessnerd_root: Path, archive_root_arg: str | None) -> dict[str, Path]:
    if archive_root_arg:
        archive_root = Path(archive_root_arg).expanduser().resolve()
    else:
        archive_root = (chessnerd_root.parent / "ccc-archive").resolve()

    if not archive_root.exists():
        raise FileNotFoundError(
            f"ccc-archive repo not found at: {archive_root}\n"
            "Pass --archive-root to point at the local ccc-archive clone."
        )

    return {
        "chessnerd": chessnerd_root,
        "archive": archive_root,
    }


def resolve_source_path(repo_roots: dict[str, Path], repo: str, relative_path: str) -> Path:
    if repo not in repo_roots:
        raise KeyError(f"Unknown repo key: {repo}")
    return repo_roots[repo] / relative_path


def read_file_text(repo_roots: dict[str, Path], repo: str, relative_path: str) -> str:
    target = resolve_source_path(repo_roots, repo, relative_path)
    return target.read_text(encoding="utf-8")


def read_file_lines(repo_roots: dict[str, Path], repo: str, relative_path: str) -> list[str]:
    return read_file_text(repo_roots, repo, relative_path).splitlines()


def file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        while True:
            chunk = f.read(1024 * 1024)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def format_with_line_numbers(lines: list[str], start_line: int) -> str:
    rendered: list[str] = []
    for idx, line in enumerate(lines, start=start_line):
        rendered.append(f"{idx:5}: {line}")
    return "\n".join(rendered)


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


def slice_lines_by_markers(lines: list[str], spec: MarkerSectionSpec) -> tuple[list[str], int, int]:
    start_line = find_line_contains(lines, spec.start_contains, spec.start_occurrence, 1)
    end_line = find_line_contains(lines, spec.end_contains, spec.end_occurrence, start_line)
    if not spec.include_end_line:
        end_line -= 1
    if end_line < start_line:
        raise ValueError(
            f"Computed invalid marker range for {spec.path}: {start_line}-{end_line}"
        )
    chunk = lines[start_line - 1 : end_line]
    return chunk, start_line, end_line


def slice_lines_from_marker_to_end(
    lines: list[str],
    spec: MarkerToEndSectionSpec,
) -> tuple[list[str], int, int]:
    start_line = find_line_contains(lines, spec.start_contains, spec.start_occurrence, 1)
    end_line = len(lines)
    chunk = lines[start_line - 1 : end_line]
    return chunk, start_line, end_line


def render_header(repo_roots: dict[str, Path]) -> list[str]:
    generated = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    return [
        "# CCC Archive Context Dump",
        "",
        f"- Generated: {generated}",
        f"- Chess Nerd root: {repo_roots['chessnerd']}",
        f"- ccc-archive root: {repo_roots['archive']}",
        "",
        "This dump is designed for LLM context sharing.",
        "It includes full files and selected partial sections spanning both repos.",
        "",
    ]


def render_mirror_status(repo_roots: dict[str, Path]) -> tuple[list[str], list[str]]:
    out = [
        "## Mirror Status (chessnerd <-> ccc-archive)",
        "",
        "| File | Status | SHA256 (chessnerd) | SHA256 (ccc-archive) |",
        "| --- | --- | --- | --- |",
    ]
    mismatches: list[str] = []

    for rel in MIRRORED_DATA_FILES:
        chess_path = repo_roots["chessnerd"] / rel
        archive_path = repo_roots["archive"] / rel

        if not chess_path.exists() or not archive_path.exists():
            out.append(f"| `{rel}` | MISSING | - | - |")
            mismatches.append(rel)
            continue

        chess_hash = file_sha256(chess_path)
        archive_hash = file_sha256(archive_path)
        if chess_hash == archive_hash:
            out.append(f"| `{rel}` | MATCH | `{chess_hash}` | `{archive_hash}` |")
        else:
            out.append(f"| `{rel}` | MISMATCH | `{chess_hash}` | `{archive_hash}` |")
            mismatches.append(rel)

    out.extend(
        [
            "",
            "Note: By default, identical mirror files from ccc-archive are omitted later in this dump.",
            "",
        ]
    )
    return out, mismatches


def render_manifest_snapshot(repo_roots: dict[str, Path]) -> list[str]:
    manifest_path = repo_roots["chessnerd"] / "ccc_manifest.json"
    if not manifest_path.exists():
        return []

    try:
        rows = json.loads(manifest_path.read_text(encoding="utf-8"))
        if not isinstance(rows, list) or not rows:
            return []
    except (json.JSONDecodeError, OSError):
        return []

    years = sorted({int(row.get("year", 0)) for row in rows if "year" in row})
    first = rows[0]
    last = rows[-1]

    return [
        "## Manifest Snapshot (from chessnerd/ccc_manifest.json)",
        "",
        f"- Entries: {len(rows)}",
        f"- Year range: {years[0]} to {years[-1]}" if years else "- Year range: unknown",
        f"- First zip in order: `{first.get('zip', '')}`",
        f"- Last zip in order: `{last.get('zip', '')}`",
        "",
    ]


def render_full_file(
    repo_roots: dict[str, Path],
    spec: FullFileSpec,
) -> list[str]:
    source_path = resolve_source_path(repo_roots, spec.repo, spec.path)
    if not source_path.exists():
        return [
            f"## Full File: `[{spec.repo}] {spec.path}`",
            "",
            f"[MISSING] {source_path}",
            "",
        ]

    body = source_path.read_text(encoding="utf-8")
    path = Path(spec.path)
    language = language_for(path)
    title = spec.title or f"[{spec.repo}] {path.as_posix()}"

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


def render_marker_section(repo_roots: dict[str, Path], spec: MarkerSectionSpec) -> list[str]:
    source_path = resolve_source_path(repo_roots, spec.repo, spec.path)
    if not source_path.exists():
        return [
            f"## Section: `[{spec.repo}] {spec.path}` — {spec.title}",
            "",
            f"[MISSING] {source_path}",
            "",
        ]

    lines = read_file_lines(repo_roots, spec.repo, spec.path)
    chunk, start_line, end_line = slice_lines_by_markers(lines, spec)
    numbered = format_with_line_numbers(chunk, start_line)
    return [
        f"## Section: `[{spec.repo}] {spec.path}` — {spec.title} (lines {start_line}-{end_line})",
        "",
        f"Source: `{source_path}`",
        "",
        "```text",
        numbered,
        "```",
        "",
    ]


def render_marker_to_end_section(
    repo_roots: dict[str, Path],
    spec: MarkerToEndSectionSpec,
) -> list[str]:
    source_path = resolve_source_path(repo_roots, spec.repo, spec.path)
    if not source_path.exists():
        return [
            f"## Section: `[{spec.repo}] {spec.path}` — {spec.title}",
            "",
            f"[MISSING] {source_path}",
            "",
        ]

    lines = read_file_lines(repo_roots, spec.repo, spec.path)
    chunk, start_line, end_line = slice_lines_from_marker_to_end(lines, spec)
    numbered = format_with_line_numbers(chunk, start_line)
    return [
        f"## Section: `[{spec.repo}] {spec.path}` — {spec.title} (lines {start_line}-{end_line})",
        "",
        f"Source: `{source_path}`",
        "",
        "```text",
        numbered,
        "```",
        "",
    ]


def should_skip_identical_archive_mirror(
    repo_roots: dict[str, Path],
    spec: FullFileSpec,
    include_identical_mirrors: bool,
) -> bool:
    if include_identical_mirrors:
        return False
    if spec.repo != "archive":
        return False
    if spec.path not in MIRRORED_DATA_FILES:
        return False

    chess_path = repo_roots["chessnerd"] / spec.path
    archive_path = repo_roots["archive"] / spec.path
    if not chess_path.exists() or not archive_path.exists():
        return False

    return file_sha256(chess_path) == file_sha256(archive_path)


def render_archive_skip_note(repo_roots: dict[str, Path], spec: FullFileSpec) -> list[str]:
    chess_path = repo_roots["chessnerd"] / spec.path
    archive_path = repo_roots["archive"] / spec.path
    digest = file_sha256(chess_path)
    return [
        f"## Full File: `[{spec.repo}] {spec.path}`",
        "",
        "Skipped because it is byte-identical to the chessnerd mirror file.",
        f"- chessnerd: `{chess_path}`",
        f"- ccc-archive: `{archive_path}`",
        f"- sha256: `{digest}`",
        "",
    ]


def build_dump(
    repo_roots: dict[str, Path],
    include_identical_mirrors: bool,
) -> str:
    out: list[str] = []
    out.extend(render_header(repo_roots))

    mirror_lines, _mismatches = render_mirror_status(repo_roots)
    out.extend(mirror_lines)
    out.extend(render_manifest_snapshot(repo_roots))

    for spec in FULL_FILES:
        if should_skip_identical_archive_mirror(repo_roots, spec, include_identical_mirrors):
            out.extend(render_archive_skip_note(repo_roots, spec))
            continue
        out.extend(render_full_file(repo_roots, spec))

    for spec in MARKER_SECTIONS:
        out.extend(render_marker_section(repo_roots, spec))

    for spec in MARKER_TO_END_SECTIONS:
        out.extend(render_marker_to_end_section(repo_roots, spec))

    return "\n".join(out).rstrip() + "\n"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build CCC Archive context dump text.")
    parser.add_argument(
        "--output",
        default="docs/ccc-archive-context.txt",
        help="Output path (relative to chessnerd root unless absolute).",
    )
    parser.add_argument(
        "--archive-root",
        default=None,
        help="Path to local ccc-archive repo (defaults to ../ccc-archive).",
    )
    parser.add_argument(
        "--include-identical-mirrors",
        action="store_true",
        help="Include ccc-archive mirror files even when identical to chessnerd copies.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    chessnerd_root = Path(__file__).resolve().parents[1]
    repo_roots = resolve_repo_roots(chessnerd_root, args.archive_root)

    output = Path(args.output)
    if not output.is_absolute():
        output = chessnerd_root / output
    output.parent.mkdir(parents=True, exist_ok=True)

    dump = build_dump(repo_roots, include_identical_mirrors=args.include_identical_mirrors)
    output.write_text(dump, encoding="utf-8")
    print(f"Wrote: {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
