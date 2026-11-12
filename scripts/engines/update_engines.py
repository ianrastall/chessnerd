#!/usr/bin/env python3
"""Refresh the GitHub Chess Engines dataset for the Chess Nerd static site.

Reads a curated manifest of open-source chess-engine repositories and pulls
public metadata (description, language, license, stars, last activity) plus the
latest tagged release (version, date, download assets) from the GitHub API.
The optional history snapshot includes all public GitHub releases.

The data is entirely self-sourced from each engine's own public repository, so
the resulting catalog and "latest releases" feed are original to this site.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from http.client import HTTPException
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


API_ROOT = "https://api.github.com/repos"
DEFAULT_MANIFEST = Path("scripts/engines/engines.json")
DEFAULT_OUTPUT = Path("public/data/engines/engines.json")
RELEASE_PAGE_SIZE = 100
MAX_ATTEMPTS = 4
MAX_BACKOFF_SECONDS = 30.0
RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fetch GitHub chess-engine metadata.")
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--history-output", type=Path, help="Write the full public release history to this path.")
    parser.add_argument("--sleep", type=float, default=0.1, help="Seconds between API calls.")
    return parser.parse_args()


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def github_token() -> str | None:
    return os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")


def retry_delay(attempt: int, retry_after: str | None = None) -> float:
    if retry_after and retry_after.isdigit():
        return min(MAX_BACKOFF_SECONDS, max(1.0, float(retry_after)))
    return min(MAX_BACKOFF_SECONDS, float(2 ** attempt))


def fetch_json(url: str, token: str | None, *, payload: dict[str, Any] | None = None) -> tuple[int, Any]:
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "chessnerd-engine-updater",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    if body is not None:
        headers["Content-Type"] = "application/json"

    for attempt in range(MAX_ATTEMPTS):
        request = Request(url, data=body, headers=headers)
        try:
            with urlopen(request, timeout=30) as response:
                return response.status, json.load(response)
        except HTTPError as exc:
            if exc.code == 404:
                return 404, None
            error_body = exc.read().decode("utf-8", errors="replace")
            if exc.code in RETRYABLE_STATUS_CODES and attempt < MAX_ATTEMPTS - 1:
                retry_after = exc.headers.get("Retry-After") if exc.headers else None
                delay = retry_delay(attempt, retry_after)
                print(
                    f"  ! transient HTTP {exc.code} for {url}; retrying in {delay:.1f}s "
                    f"({attempt + 1}/{MAX_ATTEMPTS - 1})",
                    file=sys.stderr,
                )
                time.sleep(delay)
                continue
            raise RuntimeError(f"GitHub API request failed ({exc.code}) for {url}: {error_body}") from exc
        except (URLError, HTTPException, TimeoutError, ConnectionError, OSError) as exc:
            if attempt < MAX_ATTEMPTS - 1:
                delay = retry_delay(attempt)
                print(
                    f"  ! transient connection error for {url} ({exc}); retrying in {delay:.1f}s "
                    f"({attempt + 1}/{MAX_ATTEMPTS - 1})",
                    file=sys.stderr,
                )
                time.sleep(delay)
                continue
            raise RuntimeError(f"GitHub API request failed for {url}: {exc}") from exc

    raise RuntimeError(f"GitHub API retries exhausted for {url}")


def license_label(license_obj: Any) -> str | None:
    if not isinstance(license_obj, dict):
        return None
    spdx = license_obj.get("spdx_id")
    if spdx and spdx != "NOASSERTION":
        return spdx
    name = license_obj.get("name")
    return name if name and name != "Other" else None


def normalize_release(release: Any) -> dict[str, Any] | None:
    if not isinstance(release, dict):
        return None
    assets = []
    for asset in release.get("assets") or []:
        if not isinstance(asset, dict):
            continue
        assets.append(
            {
                "name": asset.get("name"),
                "url": asset.get("browser_download_url"),
                "size": asset.get("size"),
                "downloads": asset.get("download_count"),
            }
        )
    return {
        "tag": release.get("tag_name"),
        "name": (release.get("name") or "").strip() or release.get("tag_name"),
        "published_at": release.get("published_at"),
        "url": release.get("html_url"),
        "prerelease": bool(release.get("prerelease")),
        "assets": assets,
    }


def fetch_releases(repo: str, token: str | None, delay: float) -> list[dict[str, Any]]:
    releases = {}
    page = 1
    while True:
        url = f"{API_ROOT}/{repo}/releases?per_page={RELEASE_PAGE_SIZE}&page={page}"
        status, rows = fetch_json(url, token)
        time.sleep(delay)
        if status != 200 or not isinstance(rows, list):
            raise RuntimeError(f"Invalid release history response for {repo} (HTTP {status})")
        for row in rows:
            if not isinstance(row, dict):
                raise ValueError(f"Invalid release record for {repo}")
            if row.get("draft"):
                continue
            release = normalize_release(row)
            if not release["tag"] or not release["url"] or not release["published_at"]:
                raise ValueError(f"Missing public release details for {repo}")
            releases[release["tag"]] = release
        if len(rows) < RELEASE_PAGE_SIZE:
            break
        page += 1
    return sorted(releases.values(), key=lambda release: (release["published_at"], release["tag"]), reverse=True)


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(payload, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
    temporary.replace(path)


def write_history(path: Path, generated: str, releases: dict[str, list[dict[str, Any]]]) -> None:
    count = sum(len(history) for history in releases.values())
    if not count:
        raise RuntimeError("Refusing to publish an empty release history")
    write_json(path, {
        "generated": generated,
        "source": "https://github.com",
        "count": count,
        "releases": dict(sorted(releases.items())),
    })
    print(f"Wrote {count} public releases to {path}.")


def include_latest(history: list[dict[str, Any]], latest: dict[str, Any] | None) -> list[dict[str, Any]]:
    if latest and latest["published_at"] and not any(row["tag"] == latest["tag"] for row in history):
        # The latest endpoint can expose a release absent from the paginated list.
        return sorted([*history, latest], key=lambda release: (release["published_at"], release["tag"]), reverse=True)
    return history


def fetch_latest_tags(repos: list[str], token: str) -> dict[str, str | None]:
    """Read GitHub's latest-release designation in batches to save REST requests."""
    tags = {}
    for start in range(0, len(repos), 30):
        batch = repos[start:start + 30]
        fields = []
        for index, repo in enumerate(batch):
            owner, name = repo.split("/")
            fields.append(f"r{index}: repository(owner:{json.dumps(owner)}, name:{json.dumps(name)}) "
                          "{ latestRelease { tagName } }")
        status, response = fetch_json(
            "https://api.github.com/graphql", token, payload={"query": "query { " + " ".join(fields) + " }"},
        )
        if status != 200 or not isinstance(response, dict) or "data" not in response:
            raise RuntimeError("Invalid GitHub latest-release lookup")
        errors = [error for error in response.get("errors", []) if error.get("type") != "NOT_FOUND"]
        if errors:
            raise RuntimeError(f"GitHub latest-release lookup failed: {errors}")
        for index, repo in enumerate(batch):
            record = response["data"][f"r{index}"]
            if record is not None:
                latest = record["latestRelease"]
                tags[repo] = latest["tagName"] if latest else None
    return tags


def build_engine(entry: dict[str, Any], repo: dict[str, Any], latest: dict[str, Any] | None) -> dict[str, Any]:
    owner = repo.get("owner") if isinstance(repo.get("owner"), dict) else {}
    return {
        "name": entry.get("name") or repo.get("name"),
        "repo": repo.get("full_name"),
        "author": owner.get("login"),
        "url": repo.get("html_url"),
        "homepage": (repo.get("homepage") or "").strip() or None,
        "description": (repo.get("description") or "").strip() or None,
        "language": repo.get("language"),
        "license": license_label(repo.get("license")),
        "stars": repo.get("stargazers_count"),
        "pushed_at": repo.get("pushed_at"),
        "created_at": repo.get("created_at"),
        "archived": bool(repo.get("archived")),
        "latest_release": latest,
    }


def main() -> int:
    args = parse_args()
    token = github_token()
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))

    engines: list[dict[str, Any]] = []
    missing: list[str] = []
    histories = {}
    delay = max(args.sleep, 0)
    latest_tags = {}
    if args.history_output and token:
        latest_tags = fetch_latest_tags([entry["repo"] for entry in manifest if entry.get("repo")], token)

    for entry in manifest:
        repo_path = entry.get("repo")
        if not repo_path:
            continue
        status, repo = fetch_json(f"{API_ROOT}/{repo_path}", token)
        time.sleep(delay)
        if status == 404 or not isinstance(repo, dict):
            print(f"  ! {repo_path}: repository not found", file=sys.stderr)
            missing.append(repo_path)
            continue

        history = fetch_releases(repo["full_name"], token, delay) if args.history_output else []
        latest_tag = latest_tags.get(repo_path)
        latest = next((row for row in history if row["tag"] == latest_tag), None)
        # Use REST when the batched designation cannot be resolved against the list,
        # or when a stable release appeared while the refresh was running.
        newest_stable = next((row for row in history if not row["prerelease"]), None)
        stable_appeared = newest_stable and (not latest or newest_stable["published_at"] > latest["published_at"])
        if repo_path not in latest_tags or (latest_tag and not latest) or stable_appeared:
            rel_status, release = fetch_json(f"{API_ROOT}/{repo_path}/releases/latest", token)
            time.sleep(delay)
            latest = normalize_release(release) if rel_status == 200 else None

        engine = build_engine(entry, repo, latest)
        engines.append(engine)
        if args.history_output:
            history = include_latest(history, latest)
            if history:
                histories[engine["repo"]] = history
        ver = (engine["latest_release"] or {}).get("tag") or "no release"
        print(f"  + {engine['name']:<20} {engine['repo']:<34} {ver}")

    engines.sort(key=lambda e: (e.get("name") or "").lower())

    payload = {
        "generated": now_iso(),
        "source": "https://github.com",
        "count": len(engines),
        "engines": engines,
    }

    if args.history_output:
        write_history(args.history_output, payload["generated"], histories)
    write_json(args.output, payload)

    print(f"\nWrote {len(engines)} engines to {args.output}.")
    if missing:
        print(f"Missing repositories ({len(missing)}): {', '.join(missing)}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
