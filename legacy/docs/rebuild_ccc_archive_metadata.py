#!/usr/bin/env python3
"""
Rebuild CCC archive metadata from ZIP files, with optional raw PGN ingest.

This script regenerates:
- ccc_links.txt
- events.txt
- game_counts.txt
- ccc_manifest.json

Source of truth is the local ccc-archive ZIP corpus and PGN headers inside each ZIP.

Default ingest mode imports raw PGNs from a staging folder into canonical
`YYMMDD-YYMMDD-slug.zip` files in year folders before metadata rebuild.

Usage:
    python docs/rebuild_ccc_archive_metadata.py
    python docs/rebuild_ccc_archive_metadata.py --no-ingest-raw
    python docs/rebuild_ccc_archive_metadata.py --no-sync-chessnerd
    python docs/rebuild_ccc_archive_metadata.py --check
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import shutil
import zipfile
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path


ZIP_NAME_RE = re.compile(r"^(?P<start>\d{6})-(?P<end>\d{6})-(?P<slug>.+)\.zip$")
EVENT_TAG_RE = re.compile(r'^\[Event\s+"(.*)"\]$')
TAG_LINE_RE = re.compile(r'^\[(?P<tag>[A-Za-z0-9_]+)\s+"(?P<value>.*)"\]$')
YEAR_DIR_RE = re.compile(r"^\d{4}$")
SLUG_BAD_CHARS_RE = re.compile(r"[^a-z0-9-]")
SLUG_MULTI_DASH_RE = re.compile(r"-+")

METADATA_FILES: tuple[str, ...] = (
    "ccc_links.txt",
    "events.txt",
    "game_counts.txt",
    "ccc_manifest.json",
)


@dataclass(frozen=True)
class ExistingManifestEntry:
    sha256: str | None


@dataclass(frozen=True)
class ZipMeta:
    zip_path: Path
    year: int
    start: str
    end: str
    slug: str
    zip_name: str
    pgn_name: str
    event: str
    games: int
    sha256: str
    url: str


@dataclass(frozen=True)
class RawPgnMeta:
    source_path: Path
    event: str
    start: str
    end: str
    slug: str
    year: int
    zip_name: str
    pgn_name: str


@dataclass(frozen=True)
class RawIngestResult:
    source_path: Path
    zip_path: Path
    pgn_name: str
    event: str
    raw_action: str
    check_only: bool


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        while True:
            chunk = f.read(1024 * 1024)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def choose_pgn_member(zf: zipfile.ZipFile, expected_name: str) -> str:
    names = zf.namelist()
    if expected_name in names:
        return expected_name

    lower_map = {name.lower(): name for name in names}
    if expected_name.lower() in lower_map:
        return lower_map[expected_name.lower()]

    pgn_names = [name for name in names if name.lower().endswith(".pgn")]
    if len(pgn_names) == 1:
        return pgn_names[0]
    if len(pgn_names) > 1:
        raise ValueError(
            f"ZIP has multiple PGNs and none matched expected '{expected_name}': {pgn_names}"
        )
    raise ValueError("ZIP contains no PGN file")


def parse_event_and_games_from_zip(zip_path: Path, expected_pgn_name: str) -> tuple[str, int]:
    first_event: str | None = None
    games = 0

    with zipfile.ZipFile(zip_path, "r") as zf:
        pgn_member = choose_pgn_member(zf, expected_pgn_name)
        with zf.open(pgn_member, "r") as raw:
            stream = io.TextIOWrapper(raw, encoding="utf-8", errors="replace", newline="")
            for line in stream:
                stripped = line.strip()
                if stripped.startswith('[Event "'):
                    games += 1
                    if first_event is None:
                        m = EVENT_TAG_RE.match(stripped)
                        first_event = m.group(1) if m else stripped

    if first_event is None:
        raise ValueError(f"No [Event \"...\"] tags found in {zip_path}")
    return first_event, games


def slugify_event_name(event_name: str) -> str:
    normalized = event_name.lower().strip().replace(" ", "-")
    normalized = SLUG_BAD_CHARS_RE.sub("", normalized)
    normalized = SLUG_MULTI_DASH_RE.sub("-", normalized)
    normalized = normalized.strip("-")
    return normalized or "untitled-event"


def parse_header_date_to_yymmdd(value: str) -> str | None:
    raw = value.strip().strip('"')
    if not raw:
        return None
    token = raw.split()[0].replace("/", ".").replace("-", ".")

    for fmt in ("%Y.%m.%d", "%Y%m%d", "%y%m%d"):
        try:
            dt = datetime.strptime(token, fmt)
        except ValueError:
            continue
        if fmt == "%y%m%d" and dt.year < 2000:
            dt = dt.replace(year=dt.year + 100)
        return dt.strftime("%y%m%d")
    return None


def extract_raw_pgn_meta(path: Path) -> RawPgnMeta:
    first_event: str | None = None
    first_start: str | None = None
    last_end: str | None = None
    first_date: str | None = None
    last_date: str | None = None

    with path.open("r", encoding="utf-8", errors="replace", newline="") as f:
        for line in f:
            stripped = line.strip()
            match = TAG_LINE_RE.match(stripped)
            if not match:
                continue

            tag = match.group("tag")
            value = match.group("value")

            if tag == "Event":
                if first_event is None:
                    first_event = value.strip()
                continue

            parsed = parse_header_date_to_yymmdd(value)
            if parsed is None:
                continue

            if tag == "GameStartTime":
                if first_start is None:
                    first_start = parsed
            elif tag == "GameEndTime":
                last_end = parsed
            elif tag == "Date":
                if first_date is None:
                    first_date = parsed
                last_date = parsed

    if not first_event:
        raise ValueError(f"Unable to extract first [Event \"...\"] from {path}")

    start = first_start or first_date
    if not start:
        raise ValueError(
            f"Unable to extract start date from {path} "
            "(expected GameStartTime or Date tags)."
        )

    end = last_end or last_date or start
    if end < start:
        end = start

    slug = slugify_event_name(first_event)
    year = 2000 + int(start[:2])
    stem = f"{start}-{end}-{slug}"
    return RawPgnMeta(
        source_path=path,
        event=first_event,
        start=start,
        end=end,
        slug=slug,
        year=year,
        zip_name=f"{stem}.zip",
        pgn_name=f"{stem}.pgn",
    )


def path_is_relative_to(path: Path, parent: Path) -> bool:
    try:
        path.relative_to(parent)
        return True
    except ValueError:
        return False


def discover_raw_pgn_files(raw_root: Path, recursive: bool, exclude_roots: list[Path]) -> list[Path]:
    if not raw_root.exists():
        return []
    pattern = "**/*.pgn" if recursive else "*.pgn"
    files = [p for p in raw_root.glob(pattern) if p.is_file()]
    filtered: list[Path] = []
    for path in files:
        if any(path_is_relative_to(path, ex) for ex in exclude_roots):
            continue
        filtered.append(path)
    filtered.sort(key=lambda p: p.as_posix().lower())
    return filtered


def unique_target_path(target: Path) -> Path:
    if not target.exists():
        return target
    base = target.stem
    suffix = target.suffix
    idx = 2
    while True:
        candidate = target.with_name(f"{base}__{idx}{suffix}")
        if not candidate.exists():
            return candidate
        idx += 1


def ingest_raw_pgns(
    archive_root: Path,
    raw_root: Path,
    raw_archive_dir: Path,
    raw_archive_mode: str,
    check_only: bool,
    raw_recursive: bool,
    overwrite_existing_zips: bool,
) -> list[RawIngestResult]:
    exclude_roots = [raw_archive_dir] if raw_archive_mode == "move" else []
    source_files = discover_raw_pgn_files(
        raw_root=raw_root,
        recursive=raw_recursive,
        exclude_roots=exclude_roots,
    )

    pending: list[tuple[RawPgnMeta, Path]] = []
    target_to_source: dict[Path, Path] = {}
    for source in source_files:
        meta = extract_raw_pgn_meta(source)
        zip_path = archive_root / str(meta.year) / meta.zip_name
        if zip_path in target_to_source:
            prev = target_to_source[zip_path]
            raise ValueError(
                "Two raw PGNs resolve to the same ZIP target:\n"
                f"- {prev}\n"
                f"- {source}\n"
                f"Target: {zip_path}"
            )
        target_to_source[zip_path] = source
        pending.append((meta, zip_path))

    out: list[RawIngestResult] = []
    for meta, zip_path in pending:
        if zip_path.exists() and not overwrite_existing_zips:
            raise FileExistsError(
                f"ZIP already exists: {zip_path}\n"
                "Use --overwrite-existing-zips to replace it."
            )

        if not check_only:
            zip_path.parent.mkdir(parents=True, exist_ok=True)
            with zipfile.ZipFile(
                zip_path,
                "w",
                compression=zipfile.ZIP_DEFLATED,
                compresslevel=9,
            ) as zf:
                zf.write(meta.source_path, arcname=meta.pgn_name)

        raw_action = "kept"
        if raw_archive_mode == "move":
            desired = raw_archive_dir / meta.pgn_name
            destination = unique_target_path(desired) if not check_only else desired
            raw_action = f"moved->{destination}"
            if not check_only:
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.move(str(meta.source_path), str(destination))

        out.append(
            RawIngestResult(
                source_path=meta.source_path,
                zip_path=zip_path,
                pgn_name=meta.pgn_name,
                event=meta.event,
                raw_action=raw_action,
                check_only=check_only,
            )
        )
    return out


def discover_zip_files(archive_root: Path) -> list[Path]:
    year_dirs = [
        p
        for p in archive_root.iterdir()
        if p.is_dir() and YEAR_DIR_RE.match(p.name)
    ]
    year_dirs.sort(key=lambda p: int(p.name))

    zip_paths: list[Path] = []
    for ydir in year_dirs:
        files = sorted(ydir.glob("*.zip"))
        zip_paths.extend(files)
    return zip_paths


def parse_zip_filename(zip_name: str) -> tuple[str, str, str]:
    m = ZIP_NAME_RE.match(zip_name)
    if not m:
        raise ValueError(
            f"Invalid ZIP filename format (expected YYMMDD-YYMMDD-slug.zip): {zip_name}"
        )
    return m.group("start"), m.group("end"), m.group("slug")


def validate_year_folder(year_folder: int, start: str, zip_name: str) -> None:
    inferred = 2000 + int(start[:2])
    if inferred != year_folder:
        raise ValueError(
            f"Year folder mismatch for {zip_name}: folder={year_folder}, inferred_from_start={inferred}"
        )


def build_zip_meta(
    zip_path: Path,
    archive_root: Path,
    owner: str,
    repo: str,
    branch: str,
) -> ZipMeta:
    rel = zip_path.relative_to(archive_root)
    year_folder = int(rel.parts[0])
    zip_name = zip_path.name
    start, end, slug = parse_zip_filename(zip_name)
    validate_year_folder(year_folder, start, zip_name)

    pgn_name = f"{Path(zip_name).stem}.pgn"
    event, games = parse_event_and_games_from_zip(zip_path, pgn_name)
    digest = sha256_file(zip_path)

    url = f"https://github.com/{owner}/{repo}/raw/{branch}/{rel.as_posix()}"

    return ZipMeta(
        zip_path=zip_path,
        year=year_folder,
        start=start,
        end=end,
        slug=slug,
        zip_name=zip_name,
        pgn_name=pgn_name,
        event=event,
        games=games,
        sha256=digest,
        url=url,
    )


def render_links(metas: list[ZipMeta]) -> str:
    return "\n".join(meta.url for meta in metas) + "\n"


def render_events(metas: list[ZipMeta]) -> str:
    return "\n".join(f"{meta.pgn_name}: {meta.event}" for meta in metas) + "\n"


def render_game_counts(metas: list[ZipMeta]) -> str:
    return "\n".join(f"{meta.pgn_name}: {meta.games}" for meta in metas) + "\n"


def load_existing_manifest(path: Path) -> dict[str, ExistingManifestEntry]:
    if not path.exists():
        return {}
    try:
        rows = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}
    if not isinstance(rows, list):
        return {}
    out: dict[str, ExistingManifestEntry] = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        zip_name = row.get("zip")
        if not isinstance(zip_name, str) or not zip_name:
            continue
        sha = row.get("sha256")
        if sha is not None and not isinstance(sha, str):
            sha = None
        out[zip_name] = ExistingManifestEntry(sha256=sha)
    return out


def apply_sha_policy(
    metas: list[ZipMeta],
    existing_manifest: dict[str, ExistingManifestEntry],
    recompute_sha256: bool,
) -> tuple[list[ZipMeta], int]:
    if recompute_sha256:
        return metas, 0

    rewritten: list[ZipMeta] = []
    mismatch_count = 0
    for meta in metas:
        existing = existing_manifest.get(meta.zip_name)
        if existing and existing.sha256:
            if existing.sha256 != meta.sha256:
                mismatch_count += 1
            rewritten.append(
                ZipMeta(
                    zip_path=meta.zip_path,
                    year=meta.year,
                    start=meta.start,
                    end=meta.end,
                    slug=meta.slug,
                    zip_name=meta.zip_name,
                    pgn_name=meta.pgn_name,
                    event=meta.event,
                    games=meta.games,
                    sha256=existing.sha256,
                    url=meta.url,
                )
            )
        else:
            rewritten.append(meta)
    return rewritten, mismatch_count


def render_manifest_with_rows(metas: list[ZipMeta]) -> str:
    rows = [
        {
            "pgn": meta.pgn_name,
            "zip": meta.zip_name,
            "year": meta.year,
            "start": meta.start,
            "end": meta.end,
            "event": meta.event,
            "games": meta.games,
            "url": meta.url,
            "sha256": meta.sha256,
        }
        for meta in metas
    ]
    # Existing manifest files in these repos are stored without trailing newline.
    return json.dumps(rows, indent=2, ensure_ascii=False)


def read_text_if_exists(path: Path) -> str | None:
    if not path.exists():
        return None
    return path.read_text(encoding="utf-8")


def write_if_changed(path: Path, content: str, check_only: bool) -> tuple[bool, str]:
    existing = read_text_if_exists(path)
    changed = existing != content
    if changed and not check_only:
        path.write_text(content, encoding="utf-8")
    state = "changed" if changed else "unchanged"
    if check_only:
        state = "would-change" if changed else "ok"
    return changed, state


def sync_file(src: Path, dst: Path, check_only: bool) -> tuple[bool, str]:
    src_text = src.read_text(encoding="utf-8")
    dst_text = read_text_if_exists(dst)
    changed = dst_text != src_text
    if changed and not check_only:
        dst.write_text(src_text, encoding="utf-8")
    state = "synced" if changed else "up-to-date"
    if check_only:
        state = "would-sync" if changed else "ok"
    return changed, state


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Rebuild CCC archive metadata from ZIP files. By default this ingests raw "
            "PGNs from ccc-archive/raw and syncs metadata to chessnerd."
        )
    )
    parser.add_argument(
        "--archive-root",
        default=None,
        help="Path to local ccc-archive repo (default: ../ccc-archive).",
    )
    parser.add_argument(
        "--chessnerd-root",
        default=None,
        help="Path to chessnerd repo for sync (default: this script's repo root).",
    )
    parser.add_argument(
        "--owner",
        default="ianrastall",
        help="GitHub owner used in generated raw URLs.",
    )
    parser.add_argument(
        "--repo",
        default="ccc-archive",
        help="GitHub repo name used in generated raw URLs.",
    )
    parser.add_argument(
        "--branch",
        default="main",
        help="GitHub branch used in generated raw URLs.",
    )
    parser.add_argument(
        "--no-sync-chessnerd",
        dest="sync_chessnerd",
        action="store_false",
        help="Do not copy generated metadata files into chessnerd root.",
    )
    parser.set_defaults(sync_chessnerd=True)
    parser.add_argument(
        "--check",
        action="store_true",
        help="Do not write files; exit non-zero if files would change.",
    )
    parser.add_argument(
        "--recompute-sha256",
        action="store_true",
        help=(
            "Recompute and rewrite sha256 from local ZIP bytes for all entries. "
            "Default behavior preserves existing manifest sha256 when present."
        ),
    )
    parser.add_argument(
        "--no-ingest-raw",
        dest="ingest_raw",
        action="store_false",
        help=(
            "Skip raw PGN ingest and only rebuild from existing ZIPs."
        ),
    )
    parser.set_defaults(ingest_raw=True)
    parser.add_argument(
        "--raw-root",
        default=None,
        help=(
            "Raw PGN staging folder (default: <archive-root>/raw). "
            "Used when ingest is enabled."
        ),
    )
    parser.add_argument(
        "--raw-recursive",
        action="store_true",
        help="Recursively scan --raw-root for .pgn files during ingest.",
    )
    parser.add_argument(
        "--raw-archive-mode",
        choices=("move", "keep"),
        default="move",
        help=(
            "After ingest, either move raw files to archive folder or keep them in place "
            "(default: move)."
        ),
    )
    parser.add_argument(
        "--raw-archive-dir",
        default=None,
        help=(
            "Archive folder for moved raw PGNs (default: <archive-root>/raw/processed). "
            "Used when --raw-archive-mode=move and ingest is enabled."
        ),
    )
    parser.add_argument(
        "--overwrite-existing-zips",
        action="store_true",
        help="Allow ingest to overwrite already-existing ZIP targets.",
    )
    return parser.parse_args()


def resolve_roots(args: argparse.Namespace) -> tuple[Path, Path]:
    script_repo_root = Path(__file__).resolve().parents[1]
    chessnerd_root = (
        Path(args.chessnerd_root).expanduser().resolve()
        if args.chessnerd_root
        else script_repo_root
    )
    archive_root = (
        Path(args.archive_root).expanduser().resolve()
        if args.archive_root
        else (chessnerd_root.parent / "ccc-archive").resolve()
    )
    return chessnerd_root, archive_root


def main() -> int:
    args = parse_args()
    chessnerd_root, archive_root = resolve_roots(args)

    if not archive_root.exists():
        raise SystemExit(f"ccc-archive root does not exist: {archive_root}")
    if not (archive_root / ".git").exists():
        raise SystemExit(f"Not a git repo: {archive_root}")

    changed_any = False

    if args.ingest_raw:
        raw_root = (
            Path(args.raw_root).expanduser().resolve()
            if args.raw_root
            else (archive_root / "raw").resolve()
        )
        raw_archive_dir = (
            Path(args.raw_archive_dir).expanduser().resolve()
            if args.raw_archive_dir
            else (archive_root / "raw" / "processed").resolve()
        )
        if not raw_root.exists():
            if args.check:
                print(f"Raw ingest source missing (check mode): {raw_root}")
            else:
                raw_root.mkdir(parents=True, exist_ok=True)
                print(f"Raw ingest source created: {raw_root}")

        ingest_results = ingest_raw_pgns(
            archive_root=archive_root,
            raw_root=raw_root,
            raw_archive_dir=raw_archive_dir,
            raw_archive_mode=args.raw_archive_mode,
            check_only=args.check,
            raw_recursive=args.raw_recursive,
            overwrite_existing_zips=args.overwrite_existing_zips,
        )
        ingest_count = len(ingest_results)
        changed_any = changed_any or ingest_count > 0
        print(f"Raw ingest source: {raw_root}")
        print(f"Raw ingest files: {ingest_count}")
        for result in ingest_results:
            action_prefix = "would-ingest" if result.check_only else "ingested"
            print(
                f"[ingest] {action_prefix}: {result.source_path.name} -> "
                f"{result.zip_path} ({result.raw_action})"
            )

    zip_paths = discover_zip_files(archive_root)
    if not zip_paths:
        raise SystemExit(f"No ZIP files found in: {archive_root}")

    metas = [
        build_zip_meta(
            zip_path=zp,
            archive_root=archive_root,
            owner=args.owner,
            repo=args.repo,
            branch=args.branch,
        )
        for zp in zip_paths
    ]

    existing_manifest = load_existing_manifest(archive_root / "ccc_manifest.json")
    metas_for_manifest, preserved_sha_mismatches = apply_sha_policy(
        metas,
        existing_manifest=existing_manifest,
        recompute_sha256=args.recompute_sha256,
    )

    outputs = {
        "ccc_links.txt": render_links(metas),
        "events.txt": render_events(metas),
        "game_counts.txt": render_game_counts(metas),
        "ccc_manifest.json": render_manifest_with_rows(metas_for_manifest),
    }

    print(f"Archive root: {archive_root}")
    print(f"Discovered ZIP files: {len(metas)}")

    for name, content in outputs.items():
        target = archive_root / name
        changed, state = write_if_changed(target, content, check_only=args.check)
        changed_any = changed_any or changed
        print(f"[archive] {name}: {state}")

    if args.sync_chessnerd:
        if not chessnerd_root.exists():
            raise SystemExit(f"chessnerd root does not exist: {chessnerd_root}")
        if not (chessnerd_root / ".git").exists():
            raise SystemExit(f"Not a git repo: {chessnerd_root}")

        for name in METADATA_FILES:
            src = archive_root / name
            dst = chessnerd_root / name
            changed, state = sync_file(src, dst, check_only=args.check)
            changed_any = changed_any or changed
            print(f"[chessnerd] {name}: {state}")

    print(f"First ZIP: {metas[0].zip_name}")
    print(f"Last ZIP:  {metas[-1].zip_name}")
    if not args.recompute_sha256:
        print(
            "sha256 mode: preserve-existing "
            f"(local hash mismatches against existing manifest: {preserved_sha_mismatches})"
        )
    else:
        print("sha256 mode: recompute-all")

    if args.check and changed_any:
        print("Check failed: at least one file would change.")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
