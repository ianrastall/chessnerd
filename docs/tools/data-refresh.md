# Data Refresh and Automation Candidates

These tools are the best candidates for scheduled GitHub Actions jobs.

| Tool | Current Source | Suggested Cadence | Notes |
| --- | --- | --- | --- |
| Stockfish Commits | `scripts/stockfish_commits/update_stockfish_commits.py`, `data/stockfish-commits/`, `public/data/stockfish-commits/` | Daily | Implemented in `.github/workflows/update-stockfish-commits.yml`. Fetches GitHub commits only, then writes deterministic canonical and month JSON when data changes. |
| Engine Database | `build_engine_list.py`, `build_engine_list_2.py`, `data/engines.json` | Monthly | Good cron candidate if source pages are stable. Needs validation because engine sources can change shape. |
| FIDE 2200+ Players | `fide-2200.json` | Monthly | FIDE publishes rating lists monthly. Best automated from a clear upstream rating-list source. |
| Chess.com Titled Players | Live Chess.com PubAPI | Weekly cache optional | The page works live. A generated cache could make first render faster and reduce API dependency. |
| Titled Tuesday Archive | `ianrastall/titled-tuesday-archive/tt_manifest.json` → `public/data/titled-tuesday-archive/manifest.json` | Every deployment; manual local sync | Implemented with `npm run sync:tt`. Add missing PGNs in the archive repository first; see `docs/tools/titled-tuesday-archive.md`. |
| Bullet Brawl Archive | `ianrastall/bullet-brawl-archive/bb_manifest.json` → `public/data/bullet-brawl-archive/manifest.json` | Every deployment; manual local sync | Implemented with `npm run sync:bb`. Add PGNs in the archive repository first; see `docs/tools/bullet-brawl-archive.md`. |
| CCC Archive | `ianrastall/ccc-archive/ccc_manifest.json` → `public/data/ccc-archive/manifest.json` | Every deployment; manual local sync | Implemented with `npm run sync:ccc`. Validates and mirrors published metadata; does not ingest new PGNs. See `docs/tools/ccc-archive.md`. |
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
