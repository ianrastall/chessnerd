#!/usr/bin/env python3
"""Build the ECO openings dataset for the ECO Codes tool.

Reads the named-opening lines from scripts/eco/sources/{a..e}.tsv (a frozen
snapshot of lichess-org/chess-openings, CC0) and writes a single flat JSON
array to public/data/eco-code/openings.json.

This is a build-once / regenerate-on-demand step. The ECO taxonomy does not
change, so there is no schedule or cron behind it. To refresh from upstream,
replace the TSVs in scripts/eco/sources/ and re-run:

    python scripts/eco/build_openings.py

Each output record is the minimum the page needs:
    { "eco": "B90", "name": "Sicilian Defense: Najdorf", "pgn": "1. e4 c5 ..." }

The board diagram is derived client-side from `pgn`, so no FEN is stored.
"""

from __future__ import annotations

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCES = Path(__file__).resolve().parent / "sources"
OUTPUT = ROOT / "public" / "data" / "eco-code" / "openings.json"

VOLUMES = ("a", "b", "c", "d", "e")


def load_rows() -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for volume in VOLUMES:
        path = SOURCES / f"{volume}.tsv"
        with path.open(encoding="utf-8", newline="") as handle:
            reader = csv.DictReader(handle, delimiter="\t")
            for record in reader:
                eco = (record.get("eco") or "").strip()
                name = (record.get("name") or "").strip()
                pgn = (record.get("pgn") or "").strip()
                if not (eco and name and pgn):
                    continue
                rows.append({"eco": eco, "name": name, "pgn": pgn})
    return rows


def main() -> None:
    rows = load_rows()
    rows.sort(key=lambda row: (row["eco"], row["name"]))

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {"count": len(rows), "openings": rows}
    with OUTPUT.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))
        handle.write("\n")

    print(f"Wrote {len(rows)} openings to {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
