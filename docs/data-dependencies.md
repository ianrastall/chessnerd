# Chess Nerd data and publication dependencies

Inspected 21 October 2026. This map describes the retained website and its actual source contracts. The redesign changes discovery, styling and site verification; it does not merge or rename archive repositories.

## Authority and consumers

| Publication / owner | Website input | Producer / refresh | Website consumer |
| --- | --- | --- | --- |
| `ianrastall/ccc-archive` | `ccc_manifest.json` → `public/data/ccc-archive/manifest.json` | Independent archive maintenance; `npm run sync:ccc` reads a resolved main commit | Legacy archive index and original series link |
| `ianrastall/titled-tuesday-archive` | `tt_manifest.json` → `public/data/titled-tuesday-archive/manifest.json` | Independent archive maintenance; `npm run sync:tt` | Legacy archive index and original series link |
| `ianrastall/bullet-brawl-archive` | `bb_manifest.json` → `public/data/bullet-brawl-archive/manifest.json` | Independent archive maintenance; `npm run sync:bb` | Legacy archive index and original series link |
| `ianrastall/3-0-thursday-archive` | `t30_manifest.json` → `public/data/3-0-thursday-archive/manifest.json` | Independent archive maintenance; `npm run sync:t30` | Legacy archive index and original series link |
| `ianrastall/cc-events-archive` | `cc_events_manifest.json`, `cc_events_bundles.json` → corresponding `public/data/cc-events-archive/` files | Independent curation/publication; `npm run sync:events` | Curated Tournament Archive and legacy archive index |
| `ianrastall/PgnTours` and canonical CTML sources | `public/data/tournament-archive/manifest.json`; ZIP URLs stay in PgnTours | Curated/manual `scripts/build_tournament_archive_zip.py` from canonical CTML; no new automatic sync introduced | Curated Tournament Archive and legacy archive index |
| `ianrastall/fide-db-archive` → `ianrastall/fide-players` | Player name files and binary shards at `https://ianrastall.github.io/fide-players/` | Independent offline FIDE pipeline and publication | `/fide-player.html`; names load on search, relevant shards on profile selection |
| `ianrastall/fide-db-archive` standard SQLite sources → individual release downloads | `public/data/fide-archive/standard-lists.json` | Existing per-period databases at `D:/fide/fide-archive/sqlite`; `scripts/publish_fide_sqlite.py` verifies against the owning archive inventory, packages and publishes a verified release | Historical FIDE lists page: one standard-rating SQLite download per available period |
| FIDE / Olimpbase originals and saved player registries | Existing source manifests, Pixeldrain receipts and local reference files retained unchanged | Reference preservation only; not used to infer missing historical player fields or dates | Provenance/reference material; no player-registry or raw-format download table on the FIDE page |
| Dated FIDE XML lists plus rolling player registry | Owner `standard-sqlite-YYYY-MM-monthly` release → versioned `public/data/fide-monthly/`, index and standard-list manifest; current `fide-players.json` retained | Manual: owner `refresh_monthly.py --publish` run locally, then site `Sync FIDE Ratings Data` by dispatch; 00:00 UTC browser activation; verified immutable releases | Standard SQLite archive and FIDE 2500+ table |
| Chess.com PubAPI | `public/data/titled-players.json`, `.meta.json` | Daily 03:23 UTC `Sync Titled Players Data`; daily stats, weekly profiles, serial requests, private checkpoints; complete snapshots only | Chess.com titled players |
| Public engine repositories | `public/data/engines/engines.json`, `public/data/engines/release-history.json` | Daily `Update Chess Engine Data`, Python, GitHub token in Actions, validated bot commit | Engine Releases |
| `official-stockfish/Stockfish` | `data/stockfish-commits`, `public/data/stockfish-commits` | Daily `Update Stockfish Commit Data`, Python, validated bot commit | Stockfish commits browser |
| Opening sources under `scripts/eco/sources` | `public/data/eco-code` | Explicit opening-data build | Opening explorer |

Associated archive working copies remain under `D:/dev/proj/chessnerd/`; their original Git histories and workflows are untouched. Shared FIDE and CTML repositories retain their independent ownership. No new visitor-facing backend, paid service or anonymous Actions processing endpoint is introduced.

## Deploy chain

The site workflow runs on main pushes, manual dispatch, and completion of the Stockfish, engine, daily titled-player and manually dispatched FIDE workflows; bot commits cannot themselves trigger a push workflow with the default Actions token. A `workflow_run` deployment requires a successful refresh on main. A failed refresh does not trigger publication. See [monthly FIDE operation](tools/fide-monthly-refresh.md) and [data refresh schedules](tools/data-refresh.md).

Every site deployment restores the lockfile, runs all five archive syncs, audits dependencies (report only), runs unit tests, builds once, runs browser regression checks against that output, uploads that artifact, and deploys it. The same syncs can run locally. Inputs resolve each archive's main branch to an immutable Git commit before reading the manifest. The Events manifest and prepared bundles use the same resolved commit. Existing parsers validate names, dates, counts, URL ownership and checksums; failed HTTP requests or validation stop the build/deployment. Earlier deployed Pages content stays available.

Archive pushes have no new direct cross-repository dispatch in this change. They are picked up on the next site deployment, including deployments following the existing scheduled refreshes. A maintainer can manually run Deploy to GitHub Pages for immediate publication.

## Reconstructing an artifact

`/data/archive-sources.json` records the resolved revision, immutable source URL, normalized local-manifest SHA-256 and count for each of the five synced archives. These receipts are written only after successful sync processing and are included in the deployed artifact. They are not claims about the completeness of an archive or a new source of authority.

`/data/archive-search.json` is a build-time projection of those five validated manifests plus the checked-in Tournament Archive snapshot. It contains searchable event metadata, original download URLs and checksums. It does not copy ZIPs, PGNs, CTML corpora or FIDE shards into the site. Counts represent entries across collections, which may overlap, rather than unique games or tournaments. Historical year/month precision is retained. Tournament Archive and other checked-in snapshots remain reproducible from the site's Git commit; this redesign does not invent missing historical upstream revision records.

## Curated Tournament Archive

`/tournament-archive.html` and `/downloads/tournaments.zip` use the same build-time projection of
the validated cc-events-archive and PgnTours manifests. The ZIP contains the table as a UTF-8
CSV with source repositories, original game ZIP URLs and SHA-256 checksums. Games counts
refer to the games in the downloaded file. Dates keep their source precision and historical
coverage and rating estimates reflect the source.

The catalogue includes archives with games and a reported Elo average of at least 2700,
plus selected major events. Exceptions cover Chess Olympiads, Candidates events, FIDE World Cups,
world championship events and the early American Chess Congresses. The rules and known
duplicate replacements live in `src/lib/curated-tournaments.ts`. Separate draws, stages and
time controls can have their own rows. Old tournament routes and series fragments point to
the curated table or the original series, and `/data/archive-search.json` remains the full
metadata index. The prepared event bundles remain in the owning repository and the synced
bundle manifest.

When adding or refreshing PgnTours ZIPs, run
`python scripts/update_tournament_player_counts.py D:/dev/proj/chessnerd/PgnTours` after updating
the local tournament manifest. It records the CTML participant or legacy standings count
against the verified ZIP hash in `public/data/tournament-archive/player-counts.json`. An
unavailable count is displayed as a dash, including if the ZIP has changed since the
counts were collected.

## Operational boundaries

The existing consolidated historical FIDE SQLite master, its verified scope,
and a publication/update proposal are documented in
[the historical database assessment](tools/fide-history-master.md). It is a
local preservation artifact; the website still consumes compact player shards
and the existing per-list release downloads.

The restored local inbox is `D:/jupiter/chessnerd/workspace/`: drop Chess.com
PGNs there and run `File PGNs.bat`. Its Python script delegates to the existing
archive importers under `D:/dev/proj/chessnerd`, pushes archives before website
syncs, and stops website publication if a sync, test or build fails. Preview
with `python workspace/file_pgns.py --dry-run`; this uses local archive state
without pulling. See [the workspace instructions](../workspace/README.md).

Keep acquisition, curation, manifest validation and presentation distinct. Add events in the owning archive before refreshing the site. Do not publish empty substitutes after a failed fetch. Do not run heavyweight corpus rebuilds merely to change a homepage. Existing source-specific documentation under `docs/tools/` remains authoritative for archive maintenance and file formats.
