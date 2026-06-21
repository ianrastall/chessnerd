# Data Refresh and Automation Candidates

These tools are the best candidates for scheduled GitHub Actions jobs.

| Tool | Current Source | Suggested Cadence | Notes |
| --- | --- | --- | --- |
| Stockfish Commits | `scripts/stockfish_commits/update_stockfish_commits.py`, `data/stockfish-commits/`, `public/data/stockfish-commits/` | Daily | Implemented in `.github/workflows/update-stockfish-commits.yml`. Fetches GitHub commits only, then writes deterministic canonical and month JSON when data changes. |
| Engine Database | `build_engine_list.py`, `build_engine_list_2.py`, `data/engines.json` | Monthly | Good cron candidate if source pages are stable. Needs validation because engine sources can change shape. |
| FIDE 2200+ Players | `fide-2200.json` | Monthly | FIDE publishes rating lists monthly. Best automated from a clear upstream rating-list source. |
| Chess.com Titled Players | Live Chess.com PubAPI | Weekly cache optional | The page works live. A generated cache could make first render faster and reduce API dependency. |
| Titled Tuesday Archive | `tt_links.txt`, `tt_events.txt`, `tt_game_counts.txt` | Weekly or manual | Automate only once the upstream naming/download pattern is stable. |
| CCC Archive | `ccc_manifest.json`, `ccc_links.txt` | Weekly | Likely cron-friendly if CCC URLs stay scrapeable. |
| Tournament Archive | `rebuild_tournaments.py`, `tours/*.pgn` | Manual with helper | Curated PGNs make full automation riskier. A validation job may be better than an update job. |
| Software Catalog | GitHub releases | On deploy or weekly | Can be generated from GitHub release metadata once the intended project list is fixed. |
| Chess.com API Reference | Static transcript | Manual | Low urgency. Could occasionally diff against the upstream docs if needed. |

## GitHub Actions Shape

A safe refresh job should:

1. Run on `workflow_dispatch` first.
2. Add `schedule` only after the manual run is reliable.
3. Generate files into `data/` or `public/data/`.
4. Run `npm run build`.
5. Commit only if generated files changed.

Avoid cron jobs that rewrite large files every run without content changes.
