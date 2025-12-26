#!/usr/bin/env python3
"""
build_stockfish_commits_json.py

Converts a "STOCKFISH COMMIT COLLECTION" text file into:
  - index.json (small)
  - YYYY-MM.json month files (or "unknown.json" if a commit has no parseable date)

Designed to be tolerant of:
  - blank lines at the start of separator-delimited blocks
  - minor formatting variations in bullet lists
"""

import argparse
import json
import os
import re
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

SEP = "================================================================================"

RE_COMMIT_HDR = re.compile(r"^COMMIT\s+#(\d+):\s+([0-9a-f]{8,40})\.\.\.\s*$")
RE_AUTHOR = re.compile(r"^Author:\s+(.*)\s*$")
RE_DATE = re.compile(r"^Date:\s+(.*)\s*$")
RE_GITHUB = re.compile(r"^GitHub:\s+(https?://\S+)\s*$")
RE_SECTION = re.compile(r"^(SOURCE CODE|ABROK\.EU BINARIES|GITHUB ACTIONS ARTIFACTS):\s*$")
RE_BULLET = re.compile(r"^\s*•\s+(.*?):\s+(https?://\S+)\s*$")
RE_BULLET_BYTES = re.compile(r"^\s*•\s+(.*?)\s+\((\d+)\s+bytes\):\s+(https?://\S+)\s*$")
RE_COMMIT_MESSAGE = re.compile(r"^COMMIT MESSAGE:\s*$")

# Some collections include other dividers; we ignore unknown sections gracefully.


def parse_args() -> argparse.Namespace:
    ap = argparse.ArgumentParser()
    ap.add_argument("--infile", required=True, help="Your STOCKFISH COMMIT COLLECTION .txt")
    ap.add_argument("--outdir", required=True, help="Output dir (e.g., ./data/stockfish-commits)")
    ap.add_argument(
        "--rewrite-abrok",
        action="store_true",
        help="Attempt to normalize abrok URLs from 'abrok.eubuilds' to 'abrok.eu/stockfish/builds'",
    )
    return ap.parse_args()


def normalize_abrok(url: str) -> str:
    """
    Conservative rewrite for the commonly-seen typo-domain form:
      https://abrok.eubuilds/<hash>/win64bmi2/stockfish_....zip
    to:
      https://abrok.eu/stockfish/builds/<hash>/win64bmi2/stockfish_....zip
    """
    if "abrok.eubuilds/" in url:
        url = url.replace("https://abrok.eubuilds/", "https://abrok.eu/stockfish/builds/")
        url = url.replace("http://abrok.eubuilds/", "https://abrok.eu/stockfish/builds/")
    return url


def month_key(iso: str) -> str:
    # Typically 'YYYY-MM-DDTHH:MM:SSZ' => 'YYYY-MM'
    return iso[:7] if len(iso) >= 7 else "unknown"


def pick_subject(message: str) -> str:
    for line in (message or "").splitlines():
        s = line.strip()
        if s:
            return s[:160]
    return ""


def first_nonempty_line(lines: List[str]) -> str:
    for l in lines:
        s = l.strip()
        if s:
            return s
    return ""


def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def write_json(path: str, payload: Any) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)


def main() -> None:
    args = parse_args()
    ensure_dir(args.outdir)

    with open(args.infile, "r", encoding="utf-8", errors="replace") as f:
        text = f.read()

    # Split into separator-delimited blocks; many begin with a blank line.
    blocks = [b.strip("\n") for b in text.split(SEP) if b.strip()]

    commits: List[Dict[str, Any]] = []
    totals = {"total_commits": 0, "total_binaries": 0, "total_artifacts": 0}

    current: Optional[Dict[str, Any]] = None
    section: Optional[str] = None
    collecting_message = False
    msg_lines: List[str] = []

    def flush_current() -> None:
        nonlocal current, section, collecting_message, msg_lines
        if not current:
            return

        if msg_lines:
            # Keep message formatting stable for display; ensure trailing newline for readability.
            current["message"] = "\n".join(msg_lines).rstrip() + "\n"

        current["subject"] = current.get("subject") or pick_subject(current.get("message", ""))

        commits.append(current)

        current = None
        section = None
        collecting_message = False
        msg_lines = []

    for blk in blocks:
        lines = blk.splitlines()
        header_line = first_nonempty_line(lines)

        # Detect commit header even if the block starts with blank lines
        m0 = RE_COMMIT_HDR.match(header_line) if header_line else None
        if m0:
            flush_current()
            num = int(m0.group(1))
            h = m0.group(2)

            current = {
                "commit_num": num,
                "hash": h,
                "short": h[:8],
                "author": "",
                "date": "",
                "github_url": "",
                "source_code": [],  # [{label,type,url}]
                "downloads": {
                    "abrok_eu": [],  # [{label,url}]
                    "github_actions_artifacts": [],  # [{label,bytes?,url}]
                },
                "message": "",
                "subject": "",
            }
            section = None
            collecting_message = False
            msg_lines = []
            # Continue to parse the rest of this block too; the header line is in `lines`
            # and will be ignored by subsequent matchers anyway.
            # (No `continue`.)
        if current is None:
            # Not inside a commit; ignore.
            continue

        for raw in lines:
            line = raw.rstrip("\n")

            if collecting_message:
                msg_lines.append(line)
                continue

            m = RE_AUTHOR.match(line)
            if m:
                current["author"] = m.group(1).strip()
                continue

            m = RE_DATE.match(line)
            if m:
                current["date"] = m.group(1).strip()
                continue

            m = RE_GITHUB.match(line)
            if m:
                current["github_url"] = m.group(1).strip()
                continue

            m = RE_SECTION.match(line.strip())
            if m:
                section = m.group(1)
                continue

            if RE_COMMIT_MESSAGE.match(line.strip()):
                collecting_message = True
                msg_lines = []
                continue

            # Bullets with bytes (primarily Actions artifacts)
            mb = RE_BULLET_BYTES.match(line)
            if mb and section:
                label = mb.group(1).strip()
                size = int(mb.group(2))
                url = mb.group(3).strip()
                if args.rewrite_abrok:
                    url = normalize_abrok(url)

                if section == "GITHUB ACTIONS ARTIFACTS":
                    current["downloads"]["github_actions_artifacts"].append(
                        {"label": label, "bytes": size, "url": url}
                    )
                    totals["total_artifacts"] += 1
                elif section == "SOURCE CODE":
                    current["source_code"].append({"label": label, "type": "source", "url": url})
                elif section == "ABROK.EU BINARIES":
                    current["downloads"]["abrok_eu"].append({"label": f"{label} ({size} bytes)", "url": url})
                    totals["total_binaries"] += 1
                continue

            # Simple bullets
            mb = RE_BULLET.match(line)
            if mb and section:
                label = mb.group(1).strip()
                url = mb.group(2).strip()
                if args.rewrite_abrok:
                    url = normalize_abrok(url)

                if section == "SOURCE CODE":
                    # label examples: "ZIP", "TAR.GZ"
                    current["source_code"].append({"label": label, "type": label.lower(), "url": url})
                elif section == "ABROK.EU BINARIES":
                    current["downloads"]["abrok_eu"].append({"label": label, "url": url})
                    totals["total_binaries"] += 1
                elif section == "GITHUB ACTIONS ARTIFACTS":
                    current["downloads"]["github_actions_artifacts"].append({"label": label, "url": url})
                    totals["total_artifacts"] += 1
                continue

    flush_current()

    totals["total_commits"] = len(commits)

    # Group by month
    by_month: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for c in commits:
        d = c.get("date") or ""
        mk = month_key(d) if d else "unknown"
        by_month[mk].append(c)

    # Sort commits newest-first per month if dates are parseable
    for m, lst in by_month.items():
        lst.sort(key=lambda x: (x.get("date") or ""), reverse=True)

    # Sort months newest-first (YYYY-MM sorts lexicographically)
    months = sorted([m for m in by_month.keys() if m != "unknown"], reverse=True)
    if "unknown" in by_month:
        months.append("unknown")

    month_counts = {m: len(by_month[m]) for m in months}

    index = {
        "generated": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        **totals,
        "months": months,
        "month_counts": month_counts,
    }

    write_json(os.path.join(args.outdir, "index.json"), index)

    for m in months:
        payload = {"month": m, "commits": by_month[m]}
        write_json(os.path.join(args.outdir, f"{m}.json"), payload)

    print(f"Wrote: {os.path.join(args.outdir, 'index.json')}")
    print(f"Wrote: {len(months)} month files into {args.outdir}")


if __name__ == "__main__":
    main()
