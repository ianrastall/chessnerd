#!/usr/bin/env python3
"""Cache public repository metadata and documentation for catalogue review."""

import argparse
import json
from pathlib import Path
import subprocess
import time

from build_manifest import load_github_list
from update_engines import DEFAULT_MANIFEST


README_PATHS = ("README.md", "README", "readme.md")
BATCH_SIZE = 36


def collect_batch(repositories: list[str]) -> list[dict]:
    readmes = " ".join(
        f"readme{i}: object(expression:{json.dumps('HEAD:' + path)}) {{ ... on Blob {{ text }} }}"
        for i, path in enumerate(README_PATHS)
    )
    fields = f"""
        nameWithOwner description isPrivate isArchived isFork isTemplate
        primaryLanguage {{ name }} licenseInfo {{ spdxId }}
        defaultBranchRef {{ target {{ oid }} }}
        root: object(expression:"HEAD:") {{ ... on Tree {{ entries {{ name type }} }} }}
        {readmes}
    """
    aliases = []
    for i, repo in enumerate(repositories):
        owner, name = repo.split("/")
        aliases.append(f"r{i}: repository(owner:{json.dumps(owner)},name:{json.dumps(name)}) {{ {fields} }}")
    payload = json.dumps({"query": "query {" + " ".join(aliases) + "}"})
    command = ["gh", "api", "graphql", "--include", "--input", "-"]
    for attempt in range(3):
        process = subprocess.run(
            command, input=payload, capture_output=True, encoding="utf-8", timeout=90,
        )
        header_block, _, body = process.stdout.partition("\n\n")
        headers = {}
        for line in header_block.splitlines():
            key, separator, value = line.partition(":")
            if separator:
                headers[key.lower()] = value.strip()
        error_text = process.stderr + body
        rate_limited = "secondary rate limit" in error_text.lower() or headers.get("x-ratelimit-remaining") == "0"
        if rate_limited:
            if attempt == 2:
                raise RuntimeError("GitHub GraphQL is still rate-limited; resume from the saved cache later")
            wait = max(60 * 2 ** attempt, int(headers.get("retry-after", "0")))
            if headers.get("x-ratelimit-remaining") == "0":
                wait = max(wait, int(headers.get("x-ratelimit-reset", "0")) - int(time.time()) + 1)
            print(f"GitHub rate limit reached. Resuming in {wait} seconds.", flush=True)
            time.sleep(wait)
            continue
        transient = (
            any(f"HTTP {code}" in process.stderr for code in (500, 502, 503, 504))
            or "unexpected end of json input" in process.stderr.lower()
            or "unexpected eof" in process.stderr.lower()
        )
        if transient:
            if len(repositories) > 8:
                mid = len(repositories) // 2
                return collect_batch(repositories[:mid]) + collect_batch(repositories[mid:])
            if attempt < 2:
                time.sleep(2 ** attempt)
                continue
        break
    try:
        response = json.loads(body)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"GitHub GraphQL returned no usable response: {process.stderr.strip()}") from exc
    errors = [error for error in response.get("errors", []) if error.get("type") != "NOT_FOUND"]
    if errors or "data" not in response:
        raise RuntimeError(f"GitHub GraphQL lookup failed: {errors or process.stderr}")
    rows = []
    for i, repo in enumerate(repositories):
        record = response["data"][f"r{i}"]
        if not record or record["isPrivate"]:
            rows.append({"requested": repo, "repository": None})
            continue
        readme = {}
        for j, path in enumerate(README_PATHS):
            blob = record.pop(f"readme{j}")
            if blob and blob.get("text"):
                readme[path] = blob["text"][:32000]
        record["readme"] = readme
        rows.append({"requested": repo, "repository": record})
    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("cache", type=Path)
    parser.add_argument("--candidates", type=Path)
    args = parser.parse_args()
    repos = [{"repo": repo} for _, repo in load_github_list().values()]
    repos.extend(json.loads(DEFAULT_MANIFEST.read_text(encoding="utf-8")))
    if args.candidates:
        repos.extend(json.loads(args.candidates.read_text(encoding="utf-8-sig")))
    repos = {entry["repo"].casefold(): entry["repo"] for entry in repos}
    cached = set()
    if args.cache.exists():
        with args.cache.open(encoding="utf-8") as stream:
            cached = {json.loads(line)["requested"].casefold() for line in stream}
    pending = [repo for key, repo in repos.items() if key not in cached]
    args.cache.parent.mkdir(parents=True, exist_ok=True)
    with args.cache.open("a", encoding="utf-8") as stream:
        for start in range(0, len(pending), BATCH_SIZE):
            rows = collect_batch(pending[start:start + BATCH_SIZE])
            for row in rows:
                stream.write(json.dumps(row) + "\n")
            stream.flush()
            print(f"Cached {start + len(rows)}/{len(pending)} repositories", flush=True)


if __name__ == "__main__":
    main()
