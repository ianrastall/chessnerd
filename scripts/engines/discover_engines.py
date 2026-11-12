#!/usr/bin/env python3
"""Print GitHub topic search candidates for review before adding engines."""

import argparse
from datetime import date, datetime, timedelta, timezone
import json
import subprocess
import sys
import time
from urllib.parse import urlencode

from update_engines import DEFAULT_MANIFEST


QUERIES = (
    "topic:uci topic:chess",
    "topic:ucichessengine",
    "topic:uci-chess-engine",
    "topic:chess-engine",
    "topic:chessengine",
)
PAGE_SIZE = 100
SEARCH_LIMIT = 1000
CATALOG_QUERIES = QUERIES + (
    "topic:chess-engines",
    '"chess engine" in:description stars:>=1',
)


def search_candidates(queries: tuple[str, ...]) -> dict[str, dict]:
    last_request = 0.0

    def search(query: str, page: int) -> dict:
        nonlocal last_request
        time.sleep(max(0, last_request + 2.1 - time.monotonic()))
        last_request = time.monotonic()
        params = urlencode({
            "q": f"{query} is:public", "sort": "updated", "order": "asc",
            "per_page": PAGE_SIZE, "page": page,
        })
        response = subprocess.run(
            ["gh", "api", f"search/repositories?{params}"], capture_output=True,
            encoding="utf-8", timeout=90,
        )
        if response.returncode:
            raise RuntimeError(f"GitHub search failed for {query}: {response.stderr.strip()}")
        result = json.loads(response.stdout)
        return result

    def collect(query: str, start: date, end: date):
        window = f"{query} created:{start}..{end}"
        result = search(window, 1)
        total = result["total_count"]
        if not result["incomplete_results"] and total <= SEARCH_LIMIT:
            items = list(result["items"])
            for page in range(2, (total + PAGE_SIZE - 1) // PAGE_SIZE + 1):
                result = search(window, page)
                if result["incomplete_results"] or result["total_count"] != total:
                    break
                items.extend(result["items"])
            if len({item["full_name"].casefold() for item in items}) == len(items) == total:
                yield from items
                return
        if start == end:
            raise RuntimeError(f"Could not retrieve all GitHub search results for {window}")
        midpoint = start + (end - start) // 2
        yield from collect(query, start, midpoint)
        yield from collect(query, midpoint + timedelta(days=1), end)

    candidates = {}
    today = datetime.now(timezone.utc).date()
    for query in queries:
        matched = set()
        for item in collect(query, date(2000, 1, 1), today):
            key = item["full_name"].casefold()
            matched.add(key)
            candidate = candidates.setdefault(key, {
                "repo": item["full_name"],
                "description": item.get("description"),
                "license": (item.get("license") or {}).get("spdx_id"),
                "queries": [],
            })
            if query not in candidate["queries"]:
                candidate["queries"].append(query)
        print(f"{query}: {len(matched)} distinct matches", file=sys.stderr)
    return candidates


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalog", action="store_true", help="Include existing engines and broader discovery queries.")
    args = parser.parse_args()
    known = {
        entry["repo"].casefold()
        for entry in json.loads(DEFAULT_MANIFEST.read_text(encoding="utf-8"))
    }
    candidates = search_candidates(CATALOG_QUERIES if args.catalog else QUERIES)
    print(json.dumps([entry for key, entry in candidates.items() if args.catalog or key not in known], indent=2))


if __name__ == "__main__":
    main()
