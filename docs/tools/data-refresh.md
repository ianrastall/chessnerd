# Data Refresh

How each tool's data is refreshed today. `docs/data-dependencies.md` has the full source-to-page map and the deploy chain.

## Scheduled jobs

| Tool | Source → output | Schedule | Workflow |
| --- | --- | --- | --- |
| Stockfish Commits | `scripts/stockfish_commits/update_stockfish_commits.py` → `data/stockfish-commits/`, `public/data/stockfish-commits/` | Daily 08:23 UTC | `update-stockfish-commits.yml` |
| Engine Releases | `scripts/engines/update_engines.py` (engine list in `scripts/engines/engines.json`) → `public/data/engines/engines.json` | Daily 08:41 UTC | `update-engines.yml` |
| Chess.com Titled Players | `scripts/sync-titled-players.py` (Chess.com PubAPI) → `public/data/titled-players.json`, `.meta.json` | Daily 03:23 UTC | `sync-titled-players.yml` |
| FIDE standard archive and 2500+ table | Owning archive monthly release → `scripts/sync_fide_monthly.py` → versioned snapshots and standard-list manifest | Last day of month: prepare ahead of midnight; activate at 00:00 UTC | Owner `refresh-monthly.yml`, site `sync-fide-ratings.yml` |

Each job validates with `npm run build` and commits only when its output changed. It rebases on `main` before pushing, so commits that land during a long run don't make the push fail. A successful run on `main` triggers **Deploy to GitHub Pages**.

The titled-player sync fetches each player's ratings once per UTC day and profiles weekly. All ten title lists must succeed; a removal above 10% fails the run. Requests are serial, retries and backoff bounded by the five-hour budget. Failed requests never zero known ratings or advance freshness timestamps. Progress is saved outside public data in an Actions cache; an incomplete run fails without committing public changes or triggering deployment. A later run resumes valid checkpoints. The page shows the whole cohort's date range, rather than its newest record.

See [monthly FIDE operation](fide-monthly-refresh.md) for source validation, UTC activation, schedules and recovery. Both workflows can be dispatched manually; scheduled Actions runs may be delayed, so FIDE activation uses already deployed versioned data rather than depending on a midnight deployment.

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
| Historical FIDE backfill | `scripts/publish_fide_sqlite.py` from verified per-period databases | New monthly lists use the scheduled producer; historical curation remains explicit. |
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
