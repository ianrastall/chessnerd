#!/usr/bin/env python3
"""Print GitHub topic search candidates for review before adding engines."""

import json
import sys
from urllib.parse import urlencode

from update_engines import DEFAULT_MANIFEST, fetch_json, github_token


QUERIES = (
    "topic:uci topic:chess",
    "topic:ucichessengine",
    "topic:uci-chess-engine",
    "topic:chess-engine",
    "topic:chessengine",
)
PAGE_SIZE = 100
SEARCH_LIMIT = 1000


def main() -> None:
    token = github_token()
    known = {
        entry["repo"].casefold()
        for entry in json.loads(DEFAULT_MANIFEST.read_text(encoding="utf-8"))
    }
    candidates = {}
    for query in QUERIES:
        for page in range(1, SEARCH_LIMIT // PAGE_SIZE + 1):
            params = urlencode({
                "q": f"{query} is:public", "sort": "stars", "order": "desc",
                "per_page": PAGE_SIZE, "page": page,
            })
            status, result = fetch_json(f"https://api.github.com/search/repositories?{params}", token)
            if status != 200 or result["incomplete_results"]:
                raise RuntimeError(f"GitHub returned an incomplete search for {query} (HTTP {status})")
            total = result["total_count"]
            if page == 1:
                print(f"{query}: reviewing up to {min(total, SEARCH_LIMIT)} of {total} matches", file=sys.stderr)
            for item in result["items"]:
                repo = item["full_name"]
                key = repo.casefold()
                if key in known:
                    continue
                candidate = candidates.setdefault(key, {
                    "repo": repo,
                    "description": item.get("description"),
                    "license": (item.get("license") or {}).get("spdx_id"),
                    "queries": [],
                })
                if query not in candidate["queries"]:
                    candidate["queries"].append(query)
            if page * PAGE_SIZE >= total or len(result["items"]) < PAGE_SIZE:
                break
    print(json.dumps(list(candidates.values()), indent=2))


if __name__ == "__main__":
    main()
