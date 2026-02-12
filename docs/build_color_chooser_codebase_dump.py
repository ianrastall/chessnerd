#!/usr/bin/env python3
"""
Rebuild the Color Chooser codebase dump as a Markdown file.

Includes:
- Full files dedicated to the color/theme chooser behavior.
- Relevant sections from shared HTML/CSS files.

Usage:
    python docs/build_color_chooser_codebase_dump.py
    python docs/build_color_chooser_codebase_dump.py --output docs/color-chooser-code-dump.md
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path


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


FULL_FILES: tuple[FullFileSpec, ...] = (
    FullFileSpec("js/theme.js"),
)


LINE_SECTIONS: tuple[LineSectionSpec, ...] = (
    LineSectionSpec(
        path="index.html",
        title="Page shell and shared stylesheet include",
        start_line=1,
        end_line=18,
    ),
    LineSectionSpec(
        path="index.html",
        title="Header controls for accent dropdown + theme toggle",
        start_line=21,
        end_line=48,
    ),
    LineSectionSpec(
        path="index.html",
        title="Theme script include",
        start_line=61,
        end_line=61,
    ),
    LineSectionSpec(
        path="css/style.css",
        title="Theme and accent CSS variables (dark + light)",
        start_line=1,
        end_line=36,
    ),
    LineSectionSpec(
        path="css/style.css",
        title="Base page background/text styles",
        start_line=42,
        end_line=57,
    ),
    LineSectionSpec(
        path="css/style.css",
        title="Header, controls, and accent dropdown styling",
        start_line=69,
        end_line=154,
    ),
    LineSectionSpec(
        path="css/style.css",
        title="Button styles used by theme toggle",
        start_line=264,
        end_line=299,
    ),
    LineSectionSpec(
        path="css/style.css",
        title="Responsive header/network behavior",
        start_line=882,
        end_line=914,
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


def slice_lines_by_range(lines: list[str], start_line: int, end_line: int) -> tuple[str, int, int]:
    if start_line < 1 or end_line < start_line:
        raise ValueError(f"Invalid line range {start_line}-{end_line}")
    if end_line > len(lines):
        raise ValueError(f"Requested end_line {end_line} > file length {len(lines)}")
    chunk = "\n".join(lines[start_line - 1 : end_line])
    return chunk, start_line, end_line


def render_header() -> list[str]:
    generated = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    return [
        "# Color Chooser Code Dump",
        "",
        f"- Generated: {generated}",
        "",
        "This dump contains full Color Chooser files plus relevant sections from shared files.",
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
        "{% raw %}",
        f"```{language}",
        body,
        "```",
        "{% endraw %}",
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
        "{% raw %}",
        f"```{language}",
        chunk,
        "```",
        "{% endraw %}",
        "",
    ]


def build_markdown(repo_root: Path) -> str:
    out: list[str] = []
    out.extend(render_header())

    for spec in FULL_FILES:
        out.extend(render_full_file(repo_root, spec))

    for spec in LINE_SECTIONS:
        out.extend(render_line_section(repo_root, spec))

    return "\n".join(out).rstrip() + "\n"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build Color Chooser code dump markdown.")
    parser.add_argument(
        "--output",
        default="docs/color-chooser-code-dump.md",
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
