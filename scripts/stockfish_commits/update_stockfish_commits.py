#!/usr/bin/env python3
"""Refresh Stockfish commit metadata for the Chess Nerd static site."""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from collections import OrderedDict, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


OWNER = "official-stockfish"
REPO = "Stockfish"
SOURCE_URL = f"https://github.com/{OWNER}/{REPO}"
COMMITS_API = f"https://api.github.com/repos/{OWNER}/{REPO}/commits"
DEFAULT_CANONICAL = Path("data/stockfish-commits/commits.json")
DEFAULT_OUTDIR = Path("public/data/stockfish-commits")
LEGACY_SEED = Path("legacy/static-site/tools/stockfish_commits_full.json")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fetch new Stockfish commits and write site-ready JSON shards."
    )
    parser.add_argument(
        "--canonical",
        type=Path,
        default=DEFAULT_CANONICAL,
        help=f"Canonical commit JSON file. Default: {DEFAULT_CANONICAL}",
    )
    parser.add_argument(
        "--outdir",
        type=Path,
        default=DEFAULT_OUTDIR,
        help=f"Public month-shard directory. Default: {DEFAULT_OUTDIR}",
    )
    parser.add_argument(
        "--max-pages",
        type=int,
        default=10,
        help="Maximum GitHub commit pages to fetch. Use 0 for a local no-network rewrite.",
    )
    parser.add_argument(
        "--sleep",
        type=float,
        default=0.15,
        help="Seconds to sleep between GitHub API pages.",
    )
    return parser.parse_args()


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def json_bytes(data: Any) -> bytes:
    return (json.dumps(data, indent=2, ensure_ascii=True) + "\n").encode("utf-8")


def write_json_if_changed(path: Path, data: Any) -> bool:
    path.parent.mkdir(parents=True, exist_ok=True)
    new_bytes = json_bytes(data)
    if path.exists() and path.read_bytes() == new_bytes:
        return False
    path.write_bytes(new_bytes)
    return True


def author_display(name: str | None, email: str | None, fallback: str | None = None) -> str:
    name = (name or "").strip()
    email = (email or "").strip()
    fallback = (fallback or "").strip()
    if name and email:
        return f"{name} <{email}>"
    if name:
        return name
    if email:
        return email
    if fallback:
        return fallback
    return "Unknown"


def normalized_message(message: Any) -> str:
    if not isinstance(message, str):
        return ""
    cleaned = message.replace("\r\n", "\n").replace("\r", "\n").rstrip()
    return f"{cleaned}\n" if cleaned else ""


def subject_from_message(message: str) -> str:
    subject = next((line.strip() for line in message.splitlines() if line.strip()), "")
    if len(subject) <= 160:
        return subject
    return f"{subject[:157]}..."


def source_code_links(commit_hash: str) -> list[dict[str, str]]:
    return [
        {
            "label": "ZIP",
            "type": "zip",
            "url": f"{SOURCE_URL}/archive/{commit_hash}.zip",
        },
        {
            "label": "TAR.GZ",
            "type": "tar.gz",
            "url": f"{SOURCE_URL}/archive/{commit_hash}.tar.gz",
        },
    ]


def normalize_commit(record: dict[str, Any]) -> dict[str, Any] | None:
    commit_hash = (
        record.get("hash")
        or record.get("sha")
        or record.get("commit_hash")
        or record.get("commit_sha")
        or ""
    )
    if not isinstance(commit_hash, str):
        return None
    commit_hash = commit_hash.strip()
    if len(commit_hash) < 7:
        return None

    commit_data = record.get("commit") if isinstance(record.get("commit"), dict) else {}
    api_author = commit_data.get("author") if isinstance(commit_data.get("author"), dict) else {}

    author = record.get("author")
    if not isinstance(author, str):
        author = author_display(
            record.get("author_name") or api_author.get("name"),
            record.get("author_email") or api_author.get("email"),
        )

    date = record.get("date") or api_author.get("date") or ""
    message = normalized_message(record.get("message") or commit_data.get("message"))

    return {
        "hash": commit_hash,
        "short": commit_hash[:8],
        "author": author,
        "date": date,
        "github_url": record.get("github_url") or record.get("html_url") or f"{SOURCE_URL}/commit/{commit_hash}",
        "source_code": source_code_links(commit_hash),
        "message": message,
        "subject": subject_from_message(message),
    }


def normalize_commits(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    commits_by_hash: OrderedDict[str, dict[str, Any]] = OrderedDict()
    for record in records:
        normalized = normalize_commit(record)
        if normalized and normalized["hash"] not in commits_by_hash:
            commits_by_hash[normalized["hash"]] = normalized

    return sorted(
        commits_by_hash.values(),
        key=lambda commit: (commit.get("date") or "", commit.get("hash") or ""),
        reverse=True,
    )


def load_seed_commits(canonical: Path) -> list[dict[str, Any]]:
    if canonical.exists():
        print(f"Loading canonical commits from {canonical}.")
        return read_json(canonical, [])
    if LEGACY_SEED.exists():
        print(f"Seeding canonical commits from {LEGACY_SEED}.")
        return read_json(LEGACY_SEED, [])
    return []


def github_token() -> str | None:
    return os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")


def fetch_json(url: str, token: str | None) -> Any:
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "chessnerd-stockfish-commit-updater",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"

    request = Request(url, headers=headers)
    try:
        with urlopen(request, timeout=30) as response:
            return json.load(response)
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"GitHub API request failed ({exc.code}) for {url}: {body}") from exc
    except URLError as exc:
        raise RuntimeError(f"GitHub API request failed for {url}: {exc}") from exc


def fetch_new_commits(known_hashes: set[str], max_pages: int, sleep_seconds: float) -> list[dict[str, Any]]:
    if max_pages <= 0:
        print("Skipping GitHub fetch because --max-pages is 0.")
        return []

    token = github_token()
    fetched: list[dict[str, Any]] = []

    for page in range(1, max_pages + 1):
        query = urlencode({"sha": "master", "per_page": 100, "page": page})
        url = f"{COMMITS_API}?{query}"
        page_data = fetch_json(url, token)
        if not isinstance(page_data, list):
            raise RuntimeError(f"Unexpected GitHub API response for {url}")
        if not page_data:
            break

        print(f"Fetched GitHub commit page {page} ({len(page_data)} commits).")
        for item in page_data:
            commit_hash = item.get("sha") if isinstance(item, dict) else None
            if commit_hash in known_hashes:
                print(f"Reached known commit {commit_hash}; stopping fetch.")
                return fetched
            if isinstance(item, dict):
                fetched.append(item)

        if page < max_pages:
            time.sleep(max(sleep_seconds, 0))

    return fetched


def month_key(commit: dict[str, Any]) -> str:
    date = commit.get("date") or ""
    if isinstance(date, str) and len(date) >= 7:
        return date[:7]
    return "unknown"


def existing_generated(outdir: Path) -> str | None:
    index = read_json(outdir / "index.json", {})
    if isinstance(index, dict) and isinstance(index.get("generated"), str):
        return index["generated"]
    return None


def build_index(commits: list[dict[str, Any]], month_counts: OrderedDict[str, int], generated: str) -> dict[str, Any]:
    latest = commits[0] if commits else {}
    return {
        "generated": generated,
        "source": SOURCE_URL,
        "total_commits": len(commits),
        "latest_commit_sha": latest.get("hash"),
        "latest_commit_date": latest.get("date"),
        "months": list(month_counts.keys()),
        "month_counts": month_counts,
    }


def same_index_except_generated(a: dict[str, Any], b: dict[str, Any]) -> bool:
    a_copy = dict(a)
    b_copy = dict(b)
    a_copy.pop("generated", None)
    b_copy.pop("generated", None)
    return a_copy == b_copy


def write_public_data(outdir: Path, commits: list[dict[str, Any]]) -> list[Path]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for commit in commits:
        grouped[month_key(commit)].append(commit)

    months = sorted(grouped.keys(), reverse=True)
    month_counts: OrderedDict[str, int] = OrderedDict((month, len(grouped[month])) for month in months)

    generated = now_iso()
    index_path = outdir / "index.json"
    previous_index = read_json(index_path, {})
    new_index = build_index(commits, month_counts, generated)
    if isinstance(previous_index, dict) and same_index_except_generated(previous_index, new_index):
        preserved = existing_generated(outdir)
        if preserved:
            new_index["generated"] = preserved

    changed: list[Path] = []
    for month in months:
        path = outdir / f"{month}.json"
        payload = {
            "month": month,
            "commits": grouped[month],
        }
        if write_json_if_changed(path, payload):
            changed.append(path)

    if write_json_if_changed(index_path, new_index):
        changed.append(index_path)

    keep = {f"{month}.json" for month in months}
    keep.add("index.json")
    for path in outdir.glob("*.json"):
        if path.name not in keep:
            path.unlink()
            changed.append(path)

    return changed


def main() -> int:
    args = parse_args()
    seed_records = load_seed_commits(args.canonical)
    existing_commits = normalize_commits(seed_records)
    if not existing_commits:
        print("No existing Stockfish commit data found.", file=sys.stderr)
        return 1

    known_hashes = {commit["hash"] for commit in existing_commits}
    new_records = fetch_new_commits(known_hashes, args.max_pages, args.sleep)
    all_commits = normalize_commits(new_records + existing_commits)

    print(f"Canonical commit count: {len(all_commits)} ({len(new_records)} fetched before dedupe).")
    changed: list[Path] = []
    if write_json_if_changed(args.canonical, all_commits):
        changed.append(args.canonical)
    changed.extend(write_public_data(args.outdir, all_commits))

    if changed:
        print("Changed generated data:")
        for path in changed:
            print(f"- {path}")
    else:
        print("No generated data changed.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
