#!/usr/bin/env python3
"""
Rebuild the Engine Game codebase dump as a Markdown file.

Includes:
- Full files dedicated to the Engine Game page.
- Relevant sections from shared files (Lozza worker + shared CSS).

Usage:
    python docs/build_engine_game_codebase_dump.py
    python docs/build_engine_game_codebase_dump.py --output docs/engine-game-code-dump.md
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Iterable


@dataclass(frozen=True)
class FullFileSpec:
    path: str
    title: str | None = None


@dataclass(frozen=True)
class LineSectionSpec:
    path: str
    title: str
    start_line: int
    end_line: int


@dataclass(frozen=True)
class MarkerSectionSpec:
    path: str
    title: str
    start_contains: str
    end_contains: str
    start_occurrence: int = 1
    end_occurrence: int = 1
    include_end_line: bool = False


FULL_FILES: tuple[FullFileSpec, ...] = (
    FullFileSpec("play-engine.html"),
    FullFileSpec("js/play-engine.js"),
    FullFileSpec("js/chess.min.js"),
)


LINE_SECTIONS: tuple[LineSectionSpec, ...] = (
    LineSectionSpec(
        path="css/style.css",
        title="Board color tokens",
        start_line=1,
        end_line=35,
    ),
)


MARKER_SECTIONS: tuple[MarkerSectionSpec, ...] = (
    MarkerSectionSpec(
        path="css/style.css",
        title="Engine Game board/move/log UI",
        start_contains=".engine-grid {",
        end_contains=".io-container.puzzle-grid {",
        include_end_line=False,
    ),
    MarkerSectionSpec(
        path="js/lozza.js",
        title="Search info + bestmove emission",
        start_contains="function report (units, value, depth) {",
        end_contains="function rootSearch (node, depth, turn, alpha, beta) {",
        include_end_line=False,
    ),
    MarkerSectionSpec(
        path="js/lozza.js",
        title="position(...) FEN/moves ingestion",
        start_contains="function position (bd, turn, rights, ep, moves) {",
        end_contains="function genMoves (node, turn) {",
        include_end_line=False,
    ),
    MarkerSectionSpec(
        path="js/lozza.js",
        title="Move formatting + UCI handling + worker bridge",
        start_contains="function formatMove (move) {",
        end_contains="function initOnce () {",
        include_end_line=False,
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
}


def language_for(path: Path) -> str:
    return EXT_TO_LANG.get(path.suffix.lower(), "text")


def read_file_text(repo_root: Path, relative_path: str) -> str:
    target = repo_root / relative_path
    return target.read_text(encoding="utf-8")


def read_file_lines(repo_root: Path, relative_path: str) -> list[str]:
    return read_file_text(repo_root, relative_path).splitlines()


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


def slice_lines_by_range(lines: list[str], start_line: int, end_line: int) -> tuple[str, int, int]:
    if start_line < 1 or end_line < start_line:
        raise ValueError(f"Invalid line range {start_line}-{end_line}")
    if end_line > len(lines):
        raise ValueError(f"Requested end_line {end_line} > file length {len(lines)}")
    chunk = "\n".join(lines[start_line - 1 : end_line])
    return chunk, start_line, end_line


def slice_lines_by_markers(lines: list[str], spec: MarkerSectionSpec) -> tuple[str, int, int]:
    start_line = find_line_contains(lines, spec.start_contains, spec.start_occurrence, 1)
    end_line = find_line_contains(lines, spec.end_contains, spec.end_occurrence, start_line)
    if not spec.include_end_line:
        end_line -= 1
    if end_line < start_line:
        raise ValueError(
            f"Computed invalid marker range for {spec.path}: {start_line}-{end_line}"
        )
    chunk = "\n".join(lines[start_line - 1 : end_line])
    return chunk, start_line, end_line


def render_header() -> list[str]:
    generated = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    return [
        "# Engine Game Code Dump",
        "",
        f"- Generated: {generated}",
        "",
        "This dump contains full Engine Game files plus relevant sections from shared files.",
        "",
    ]


def render_full_file(repo_root: Path, spec: FullFileSpec) -> list[str]:
    path = Path(spec.path)
    language = language_for(path)
    title = spec.title or path.as_posix()
    body = read_file_text(repo_root, spec.path)
    return [
        f"## Full File: `{title}`",
        "",
        f"```{language}",
        body,
        "```",
        "",
    ]


def render_line_section(repo_root: Path, spec: LineSectionSpec) -> list[str]:
    path = Path(spec.path)
    language = language_for(path)
    lines = read_file_lines(repo_root, spec.path)
    chunk, start_line, end_line = slice_lines_by_range(lines, spec.start_line, spec.end_line)
    return [
        f"## Section: `{path.as_posix()}` — {spec.title} (lines {start_line}-{end_line})",
        "",
        f"```{language}",
        chunk,
        "```",
        "",
    ]


def render_marker_section(repo_root: Path, spec: MarkerSectionSpec) -> list[str]:
    path = Path(spec.path)
    language = language_for(path)
    lines = read_file_lines(repo_root, spec.path)
    chunk, start_line, end_line = slice_lines_by_markers(lines, spec)
    return [
        f"## Section: `{path.as_posix()}` — {spec.title} (lines {start_line}-{end_line})",
        "",
        f"```{language}",
        chunk,
        "```",
        "",
    ]


def build_markdown(repo_root: Path) -> str:
    out: list[str] = []
    out.extend(render_header())

    for spec in FULL_FILES:
        out.extend(render_full_file(repo_root, spec))

    for spec in LINE_SECTIONS:
        out.extend(render_line_section(repo_root, spec))

    for spec in MARKER_SECTIONS:
        out.extend(render_marker_section(repo_root, spec))

    return "\n".join(out).rstrip() + "\n"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build Engine Game code dump markdown.")
    parser.add_argument(
        "--output",
        default="docs/engine-game-code-dump.md",
        help="Output markdown path (relative to repo root unless absolute).",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    repo_root = Path(__file__).resolve().parents[1]
    output = Path(args.output)
    if not output.is_absolute():
        output = repo_root / output
    output.parent.mkdir(parents=True, exist_ok=True)
    markdown = build_markdown(repo_root)
    output.write_text(markdown, encoding="utf-8")
    print(f"Wrote: {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

