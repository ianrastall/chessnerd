#!/usr/bin/env python3
"""Cross-reference the GitHub-URL list with the CCRL open-source name list to
produce the engine manifest (scripts/engines/engines.json).

- sources/rwbc_github.txt : "Name<whitespace>https://github.com/owner/repo"
  (the GitHub URLs only; supplies the repo for each engine)
- sources/ccrl_open_single.txt : CCRL single-CPU open-source engine names
  (the quality / notability filter)

An engine is kept when its name matches between both lists. The CCRL spelling is
used as the display name; the repo comes from the URL list.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

HERE = Path(__file__).parent
RWBC = HERE / "sources" / "rwbc_github.txt"
CCRL = HERE / "sources" / "ccrl_open_single.txt"
OUTPUT = HERE / "engines.json"

REPO_RE = re.compile(r"github\.com/([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+)", re.I)
NAME_URL_RE = re.compile(r'^(.*?)\s*"?(https?://\S+)\s*$')
# Path segments that are not a repository name (e.g. /owner/repo/releases).
NON_REPO_TAILS = {
    "releases", "tree", "blob", "commit", "commits", "archive",
    "actions", "files", "wiki", "tags", "pages",
}


def normalize(name: str) -> str:
    """Lowercase, drop a trailing '#', strip version qualifiers and punctuation."""
    name = name.strip().rstrip("#").strip()
    # Drop trailing version / revision qualifiers: "rev4", "r142", "III", "Mk8",
    # "TCEC v2", "P3n", "m1.8", "Neuchatel", standalone numbers, roman numerals.
    name = re.sub(
        r"\s+("
        r"rev\s*\d+|r\d+|v?\d+(\.\d+)*|mk\s*\d+|svn\d+|tcec.*|"
        r"m\d+(\.\d+)*|p\d+\w*|i\d+\w*|"
        r"[ivx]+|neuchatel|starfish|fusion|recharged"
        r")$",
        "",
        name,
        flags=re.I,
    )
    return re.sub(r"[^a-z0-9]", "", name.lower())


def parse_repo(url: str) -> str | None:
    match = REPO_RE.search(url)
    if not match:
        return None
    owner, repo = match.group(1), match.group(2)
    repo = repo.removesuffix(".git")
    if repo.lower() in NON_REPO_TAILS:
        return None
    return f"{owner}/{repo}"


def load_github_list() -> dict[str, tuple[str, str]]:
    """normalized name -> (display name, owner/repo). First repo per name wins."""
    out: dict[str, tuple[str, str]] = {}
    for raw in RWBC.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line:
            continue
        match = NAME_URL_RE.match(line)
        if not match:
            continue
        name = match.group(1).strip().strip('"').rstrip("#").strip()
        repo = parse_repo(match.group(2))
        if not name or not repo:
            continue
        key = normalize(name)
        if key and key not in out:
            out[key] = (name, repo)
    return out


def load_ccrl_names() -> list[str]:
    return [
        line.strip()
        for line in CCRL.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]


# CCRL names too generic to map to a single repository reliably.
DENYLIST = {"chess"}


def candidate_keys(display: str) -> list[str]:
    """Keys to try, dropping trailing qualifier words one at a time.

    "Quanticade Aurora" -> ["quanticadeaurora", "quanticade"]. Only whole
    trailing words are removed, so single words can't match by substring.
    """
    words = display.split()
    keys = []
    for i in range(len(words), 0, -1):
        key = normalize(" ".join(words[:i]))
        if key and key not in keys:
            keys.append(key)
    return keys


def main() -> int:
    github = load_github_list()
    ccrl = load_ccrl_names()

    manifest: list[dict[str, str]] = []
    seen_repos: set[str] = set()
    unmatched: list[str] = []

    for display in ccrl:
        hit = None
        for key in candidate_keys(display):
            if key in DENYLIST:
                continue
            if key in github:
                hit = github[key]
                break
        if not hit:
            unmatched.append(display)
            continue
        name, repo = hit
        if repo in seen_repos:
            continue
        seen_repos.add(repo)
        manifest.append({"name": name, "repo": repo})

    manifest.sort(key=lambda e: e["name"].lower())
    OUTPUT.write_text(json.dumps(manifest, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")

    print(f"GitHub URL entries parsed : {len(github)}")
    print(f"CCRL names                : {len(ccrl)}")
    print(f"Matched (manifest size)   : {len(manifest)}")
    print(f"Unmatched CCRL names      : {len(unmatched)}")
    print("\nSample matched:")
    for entry in manifest[:12]:
        print(f"  {entry['name']:<22} -> {entry['repo']}")
    print("\nUnmatched (no GitHub repo found):")
    print("  " + ", ".join(unmatched))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
