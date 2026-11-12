# Data Refresh

How each tool's data is refreshed today. `docs/data-dependencies.md` has the full source-to-page map and the deploy chain.

## Scheduled jobs

| Tool | Source → output | Schedule | Workflow |
| --- | --- | --- | --- |
| Stockfish Commits | `scripts/stockfish_commits/update_stockfish_commits.py` → `data/stockfish-commits/`, `public/data/stockfish-commits/` | Daily 08:23 UTC | `update-stockfish-commits.yml` |
| Engine Releases | `scripts/engines/update_engines.py` (engine list in `scripts/engines/engines.json`) → `public/data/engines/engines.json` | Daily 08:41 UTC | `update-engines.yml` |
| Chess.com Titled Players | `scripts/sync-titled-players.py` (Chess.com PubAPI) → `public/data/titled-players.json`, `.meta.json` | Daily 03:23 UTC | `sync-titled-players.yml` |

Each job validates with `npm run build` and commits only when its output changed. It rebases on `main` before pushing, so commits that land during a long run don't make the push fail. A successful run on `main` triggers **Deploy to GitHub Pages**.

To find additions to Engine Releases, run `python scripts/engines/discover_engines.py`
from the repository root with an authenticated GitHub CLI. It searches
`topic:uci topic:chess`, `topic:ucichessengine`, `topic:uci-chess-engine`,
`topic:chess-engine` and `topic:chessengine` in order. Results are deduplicated
and omit repositories already in the manifest. Searches with more than 1,000
matches are divided into creation-date ranges and paginated.

Before adding a candidate, verify in its own repository that it plays standard
chess via UCI, has an open-source license and offers a GitHub release with
engine downloads. Record the query and the repository evidence in
`scripts/engines/sources/github_topics.json`, then regenerate the manifest
with `python scripts/engines/build_manifest.py`. The scheduled updater uses
the reviewed manifest.

### Downloadable GitHub chess engine catalogue

The JSON download on Engine Releases covers public repositories for chess
engines, including projects without tagged releases and engines using any
protocol. It searches the five topics above plus `topic:chess-engines` and
repositories with “chess engine” in their description and at least one star.
Topic searches have no star threshold. The existing engine manifest and RWBC
GitHub index supply additional candidates. Results depend on the GitHub
search index and the evidence available in each repository.

Run these commands from the repository root with an authenticated GitHub CLI.
The evidence cache contains upstream README text and stays local.

```sh
mkdir -p .cache/github-chess-engines
python scripts/engines/discover_engines.py --catalog > .cache/github-chess-engines/candidates.json
python scripts/engines/collect_catalog_evidence.py .cache/github-chess-engines/repositories.jsonl --candidates .cache/github-chess-engines/candidates.json
python scripts/engines/build_catalog.py .cache/github-chess-engines/candidates.json .cache/github-chess-engines/repositories.jsonl --report .cache/github-chess-engines/excluded.json
```

Use a fresh evidence cache for each new snapshot. Reuse that cache to resume
an interrupted collection. The builder checks coverage and deduplicates
renamed repositories by their current GitHub name. It screens repository
descriptions, README text and source filenames, and records the basis for
each inclusion. Manual source checks and exclusions are recorded in
`scripts/engines/sources/github_catalog_review.json`. `protocols_mentioned`
records text mentions, and a null
license means GitHub did not report a recognized license. Review the results
and the exclusion report before publishing.

The titled-player sync fetches each player's ratings once per UTC day and profiles weekly. All ten title lists must succeed; a removal above 10% fails the run. Requests are serial, retries and backoff bounded by a five-and-a-half-hour budget inside a six-hour job. Failed requests never zero known ratings or advance freshness timestamps. Accounts returning HTTP 404 are left out of that day's snapshot and counted in metadata; more than 1% of the cohort failing this way fails the run. Progress is saved outside public data in an Actions cache; an incomplete run fails without committing public changes or triggering deployment. A same-UTC-day retry resumes fresh stats checkpoints; older stats require another fetch. The page shows the whole cohort's date range, rather than its newest record.

## On every deployment

| Tool | Source → output | Command |
| --- | --- | --- |
| Titled Tuesday Archive | `ianrastall/titled-tuesday-archive/tt_manifest.json` → `public/data/titled-tuesday-archive/manifest.json` | `npm run sync:tt` |
| Bullet Brawl Archive | `ianrastall/bullet-brawl-archive/bb_manifest.json` → `public/data/bullet-brawl-archive/manifest.json` | `npm run sync:bb` |
| 3-0 Thursday Archive | `ianrastall/3-0-thursday-archive/t30_manifest.json` → `public/data/3-0-thursday-archive/manifest.json` | `npm run sync:t30` |
| CCC Archive | `ianrastall/ccc-archive/ccc_manifest.json` → `public/data/ccc-archive/manifest.json` | `npm run sync:ccc` |
| Chess.com Events | `ianrastall/cc-events-archive/cc_events_manifest.json`, `cc_events_bundles.json` → `public/data/cc-events-archive/` | `npm run sync:events` |

These only mirror and validate published metadata; new PGNs are added in the archive repositories first (see each archive's page in `docs/tools/` and `D:\dev\proj\chessnerd\HOW-TO-ADD-CHESSCOM-PGNS.md`). The same commands run locally. Each writes a provenance receipt to `public/data/archive-sources.json`.

## Manual

| Tool | How | Notes |
| --- | --- | --- |
| FIDE standard archive and 2500+ table | Local `refresh_monthly.py --publish` in the owning archive, then dispatch `sync-fide-ratings.yml` → versioned snapshots and standard-list manifest | Monthly, once FIDE posts the dated lists. Runs by hand because most GitHub runners cannot reach FIDE; see [monthly FIDE operation](fide-monthly-refresh.md). |
| Historical FIDE backfill | `scripts/publish_fide_sqlite.py` from verified per-period databases | New monthly lists use the manual monthly update; historical curation remains explicit. |
| FIDE Player Profiles | Built and published by the separate `fide-players` repository | Nothing to refresh here; see `docs/tools/fide-player-profiles.md`. |
| Tournament Archive | `python scripts/build_tournament_archive_zip.py <tournament>.ctml` → ZIP plus `public/data/tournament-archive/manifest.json` | One curated event at a time. |
| ECO Codes | `python scripts/eco/build_openings.py` (sources in `scripts/eco/sources/`) → `public/data/eco-code/openings.json` | Only when the opening sources change. |
| Software Catalog, Chess.com API reference | Edited in their `.astro` pages | Static content. |

## Adding a scheduled job

1. Start with `workflow_dispatch` only; add `schedule` once manual runs are reliable.
2. Write deterministic output into `data/` or `public/data/`, and commit only when it changed.
3. Run `npm run build` before committing.
4. Rebase before pushing, as the existing jobs do.
5. Add the workflow's name to the `workflow_run` list in `deploy.yml` so its commits get deployed.
