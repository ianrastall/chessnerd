#!/usr/bin/env python3
"""Refresh the GitHub Chess Engines dataset for the Chess Nerd static site.

Reads a curated manifest of open-source chess-engine repositories and pulls
public metadata (description, language, license, stars, last activity) plus the
latest tagged release (version, date, download assets) from the GitHub API.

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
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


API_ROOT = "https://api.github.com/repos"
DEFAULT_MANIFEST = Path("scripts/engines/engines.json")
DEFAULT_OUTPUT = Path("public/data/engines/engines.json")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fetch GitHub chess-engine metadata.")
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--sleep", type=float, default=0.1, help="Seconds between API calls.")
    return parser.parse_args()


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def github_token() -> str | None:
    return os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")


def fetch_json(url: str, token: str | None) -> tuple[int, Any]:
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "chessnerd-engine-updater",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = Request(url, headers=headers)
    try:
        with urlopen(request, timeout=30) as response:
            return response.status, json.load(response)
    except HTTPError as exc:
        if exc.code == 404:
            return 404, None
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"GitHub API request failed ({exc.code}) for {url}: {body}") from exc
    except URLError as exc:
        raise RuntimeError(f"GitHub API request failed for {url}: {exc}") from exc


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


def build_engine(entry: dict[str, Any], repo: dict[str, Any], release: Any) -> dict[str, Any]:
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
        "latest_release": normalize_release(release),
    }


def main() -> int:
    args = parse_args()
    token = github_token()
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))

    engines: list[dict[str, Any]] = []
    missing: list[str] = []

    for entry in manifest:
        repo_path = entry.get("repo")
        if not repo_path:
            continue
        status, repo = fetch_json(f"{API_ROOT}/{repo_path}", token)
        time.sleep(max(args.sleep, 0))
        if status == 404 or not isinstance(repo, dict):
            print(f"  ! {repo_path}: repository not found", file=sys.stderr)
            missing.append(repo_path)
            continue

        rel_status, release = fetch_json(f"{API_ROOT}/{repo_path}/releases/latest", token)
        time.sleep(max(args.sleep, 0))
        if rel_status == 404:
            release = None

        engine = build_engine(entry, repo, release)
        engines.append(engine)
        ver = (engine["latest_release"] or {}).get("tag") or "no release"
        print(f"  + {engine['name']:<20} {engine['repo']:<34} {ver}")

    engines.sort(key=lambda e: (e.get("name") or "").lower())

    payload = {
        "generated": now_iso(),
        "source": "https://github.com",
        "count": len(engines),
        "engines": engines,
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(payload, indent=2, ensure_ascii=True) + "\n", encoding="utf-8"
    )

    print(f"\nWrote {len(engines)} engines to {args.output}.")
    if missing:
        print(f"Missing repositories ({len(missing)}): {', '.join(missing)}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
