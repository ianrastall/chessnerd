#!/usr/bin/env python3
"""Build a downloadable catalogue from reviewed GitHub repository evidence."""

import argparse
from collections import Counter
from datetime import datetime, timezone
import json
from pathlib import Path
import re
from urllib.parse import quote

from build_manifest import load_github_list
from discover_engines import CATALOG_QUERIES
from update_engines import DEFAULT_MANIFEST


OUTPUT = Path("public/data/engines/github-chess-engines.json")
REVIEW = Path(__file__).parent / "sources" / "github_catalog_review.json"
ENGINE = re.compile(
    r"\b(?:"
    r"(?:chess|chess960)[\s_-]+(?:(?:ai|playing|variant)[\s_-]+)?engine|"
    r"(?:UCI|XBoard|WinBoard)[\s_-]+(?:(?:compliant|compatible)[\s_-]+)?engine|"
    r"chess (?:game |program )?and engine|chess\s*\+\s*antichess engine|"
    r"chess[- ]playing program|engine (?:for|to play) chess|"
    r"moteur d['’]échecs|(?:motor|engine) de (?:ajedrez|xadrez)|Schach[ -]?engine|"
    r"шахматный движок"
    r")\b|国际象棋引擎|チェスエンジン", re.I
)
IMPLEMENTATION = re.compile(
    r"\b(?:alpha[-– ]beta|minimax|nega(?:max|scout)|quiescence|move generation|"
    r"transposition tables?|monte carlo tree search|MCTS)\b", re.I
)
BUILT_IN_ENGINE = re.compile(r"\b(?:own|custom|built[- ]?in|builtin|self[- ]written) (?:chess )?engine\b", re.I)
RULES_ONLY = re.compile(
    r"\b(?:everything but the AI|no (?:AI|computer) opponent|"
    r"(?:two.player|turn.based local multiplayer) chess game|local two.player)\b", re.I
)
COMPUTER_PLAY = re.compile(r"\b(?:minimax|nega(?:max|scout)|alpha[- ]beta|"
                           r"AI opponent|computer opponent|vs\.? (?:computer|AI)|single.player)\b", re.I)
RELATED_PROJECT = re.compile(
    r"\b(?:"
    r"(?:graphical|web|browser|command.line) (?:user )?interface (?:\(GUI\) )?for|"
    r"(?:GUI|front.end|wrapper|bindings?|library|client|benchmark|tester|manager|"
    r"template|dataset|protocol|API|toolkit|tournament|website|collection|list|"
    r"interface|adapter|driver|launcher|bot) (?:for|of|to|on|around|between|that uses|using)|"
    r"(?:chess|engine) (?:GUI|front.end|wrapper|bindings?|client|template|"
    r"manager|tester|tournament|dataset|playground|library|"
    r"comparison|compilation|integration)|"
    r"using (?:the )?(?:Stockfish|Leela Chess Zero|Fairy.Stockfish)|"
    r"powered by (?:the )?(?:Stockfish|Leela Chess Zero|Fairy.Stockfish)|"
    r"remotely run|(?:allows?|lets?) you (?:to )?run (?:a|an) (?:UCI|chess) engine|"
    r"client.server solution to run|GUI chess application built on top of|"
    r"templates for measuring|scripts for measuring|"
    r"chess server powered by|Paper plugin[^\n]{0,80}chess|play against a chess engine|"
    r"(?:eventual(?:l)?y I want to|plan to) (?:add|create|implement) (?:an? )?(?:AI|engine)|"
    r"any decent UCI chess engine|your favorite UCI engine|"
    r"connects? to (?:a|an|the) (?:UCI|chess) engine"
    r")\b", re.I
)
VARIANT_ONLY = re.compile(r"\b(?:xiangqi|janggi|shogi|chinese chess|korean chess|japanese chess)\b", re.I)
STANDARD = re.compile(r"\b(?:standard|orthodox|classical|western|regular) chess\b", re.I)
CHESS_VARIANTS = re.compile(r"\bchess variant engine\b", re.I)
SOURCE_SUFFIXES = {".c", ".cc", ".cpp", ".cs", ".go", ".h", ".hpp", ".java", ".js",
                   ".lua", ".nim", ".py", ".rs", ".scala", ".swift", ".ts", ".zig"}
SOURCE_SIGNALS = ("search", "movegen", "move_generator", "minimax", "negamax", "evaluate", "evaluation", "uci")
PROTOCOLS = {"UCI": re.compile(r"\b(?:UCI|Universal Chess Interface)\b", re.I),
             "XBoard/WinBoard": re.compile(r"\b(?:xboard|winboard|CECP)\b", re.I)}


def intro(text: str) -> str:
    lines = [line.strip() for line in text.splitlines() if line.strip() and "shield" not in line.lower()]
    return "\n".join(lines[:14])[:1800]


def assess(record: dict, known_name: str | None) -> tuple[str, str | None]:
    description = record["description"] or ""
    readmes = record["readme"]
    readme_path, readme = next(iter(readmes.items()), (None, ""))
    opening = intro(readme)
    title = f"{record['nameWithOwner'].split('/')[1].replace('-', ' ')}\n{description}"
    if record["isTemplate"]:
        return "template", None
    if not record["defaultBranchRef"]:
        return "empty", None
    if VARIANT_ONLY.search(title) and not (STANDARD.search(title) or CHESS_VARIANTS.search(title)):
        return "variant", None
    if RULES_ONLY.search(opening) and not COMPUTER_PLAY.search(readme):
        return "related", None
    if RELATED_PROJECT.search(title):
        return ("existing-manifest", None) if known_name else ("related", None)
    if ENGINE.search(description):
        if ENGINE.search(opening):
            return "readme", readme_path
        return "description", None
    if "chess" in title.lower() and BUILT_IN_ENGINE.search(description):
        return "description", None
    if ENGINE.search(opening) and (not RELATED_PROJECT.search(opening) or IMPLEMENTATION.search(readme)):
        return "readme", readme_path
    for path, content in readmes.items():
        if IMPLEMENTATION.search(content) and (
            ENGINE.search(content) or re.search(r"\bchess (?:game engine|program)\b", intro(content), re.I)
        ):
            return "readme", path
    sources = [
        entry["name"] for entry in (record["root"] or {}).get("entries", [])
        if entry["type"] == "blob" and Path(entry["name"]).suffix.lower() in SOURCE_SUFFIXES
    ]
    signals = [stem for stem in SOURCE_SIGNALS if any(stem in name.lower() for name in sources)]
    if len(signals) >= 2:
        return "source", next(name for name in sources if any(stem in name.lower() for stem in signals))
    if known_name:
        return "existing-manifest", None
    return "unresolved", None


def build(
    candidates: list[dict], evidence: list[dict], manifest: list[dict],
    rwbc: set[str], review: dict | None = None,
) -> tuple[list[dict], Counter, list[dict]]:
    names = {entry["repo"].casefold(): entry["name"] for entry in manifest}
    queries = {entry["repo"].casefold(): entry["queries"] for entry in candidates}
    expected = names.keys() | queries.keys() | rwbc
    by_requested = {entry["requested"].casefold(): entry["repository"] for entry in evidence}
    if missing := expected - by_requested.keys():
        raise ValueError(f"Missing evidence checks for {len(missing)} repositories")

    canonical = {}
    counts = Counter()
    for key in sorted(expected):
        record = by_requested[key]
        if not record:
            counts["unavailable"] += 1
            continue
        canonical_key = record["nameWithOwner"].casefold()
        combined = canonical.setdefault(canonical_key, {
            "record": record, "name": None, "queries": set(), "rwbc": False,
        })
        combined["name"] = combined["name"] or names.get(key)
        combined["queries"].update(queries.get(key, ()))
        combined["rwbc"] |= key in rwbc

    engines = []
    excluded = []
    review = review or {"include": {}, "exclude": {}}
    include = {key.casefold(): path for key, path in review["include"].items()}
    exclude = {key.casefold(): reason for key, reason in review["exclude"].items()}
    for item in canonical.values():
        record = item["record"]
        key = record["nameWithOwner"].casefold()
        if key in exclude:
            method, path = "review-excluded", None
        elif key in include and record["defaultBranchRef"]:
            method, path = "reviewed-source", include[key]
        else:
            method, path = assess(record, item["name"])
        counts[method] += 1
        if method in {"empty", "related", "review-excluded", "template", "unresolved", "variant"}:
            excluded.append({
                "repository": record["nameWithOwner"],
                "reason": exclude.get(key, method),
                "description": record["description"],
                "intro": intro(next(iter(record["readme"].values()), "")),
                "queries": sorted(item["queries"]),
                "root": record["root"],
            })
            continue
        repo = record["nameWithOwner"]
        url = f"https://github.com/{repo}"
        commit = record["defaultBranchRef"]["target"]["oid"]
        source = f"{url}/blob/{commit}/{quote(path)}" if path else url
        description = record["description"]
        text = "\n".join([description or "", *record["readme"].values()])
        license_id = (record["licenseInfo"] or {}).get("spdxId")
        seeds = []
        if item["name"]:
            seeds.append("existing-manifest")
        if item["rwbc"]:
            seeds.append("RWBC GitHub index")
        engines.append({
            "name": item["name"] or repo.split("/")[1],
            "repository": repo,
            "url": url,
            "description": description,
            "language": (record["primaryLanguage"] or {}).get("name"),
            "license": license_id if license_id != "NOASSERTION" else None,
            "protocols_mentioned": [name for name, pattern in PROTOCOLS.items() if pattern.search(text)],
            "archived": record["isArchived"],
            "fork": record["isFork"],
            "evidence": {"type": method, "url": source},
            "found_by": [query for query in CATALOG_QUERIES if query in item["queries"]],
            "seed_sources": seeds,
        })
    engines.sort(key=lambda engine: (engine["name"].casefold(), engine["repository"].casefold()))
    return engines, counts, excluded


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("candidates", type=Path)
    parser.add_argument("evidence", type=Path)
    parser.add_argument("--report", type=Path)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    args = parser.parse_args()
    candidates = json.loads(args.candidates.read_text(encoding="utf-8-sig"))
    evidence = [json.loads(line) for line in args.evidence.read_text(encoding="utf-8").splitlines()]
    manifest = json.loads(DEFAULT_MANIFEST.read_text(encoding="utf-8"))
    rwbc = {repo.casefold() for _, repo in load_github_list().values()}
    review = json.loads(REVIEW.read_text(encoding="utf-8"))
    engines, counts, excluded = build(candidates, evidence, manifest, rwbc, review)
    if not engines:
        raise ValueError("The catalogue is empty")
    payload = {
        "schema": 1,
        "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": "https://github.com",
        "search_queries": list(CATALOG_QUERIES),
        "repositories_checked": len({row["repo"].casefold() for row in candidates + manifest} | rwbc),
        "screening_counts": dict(sorted(counts.items())),
        "count": len(engines),
        "engines": engines,
    }
    temp = args.output.with_suffix(".json.tmp")
    temp.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temp.replace(args.output)
    if args.report:
        args.report.write_text(json.dumps(excluded, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"included": len(engines), "review": counts}, sort_keys=True))


if __name__ == "__main__":
    main()
