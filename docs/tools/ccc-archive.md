# CCC Archive

Public route: https://chessnerd.net/chesscom-tournaments.html#ccc
(the old `/ccc-archive.html` route redirects there)

## Ownership and data flow

`ianrastall/ccc-archive` is the canonical data repository. It stores event ZIPs in
year folders and describes them in `ccc_manifest.json`. Chess Nerd hosts the UI;
download links go directly to the archive repository.

Run `npm run sync:ccc` with Node 24 to fetch the published manifest, validate it,
sort events newest first, and update `public/data/ccc-archive/manifest.json`.
The sync resolves the archive's current `main` commit through GitHub's API and
downloads that immutable revision, avoiding stale branch content in the raw-file
cache. CI supplies its GitHub token for the API request; local runs can use the
public API or an existing `GITHUB_TOKEN` environment variable.
The output is deterministic and is only replaced after validation succeeds.
Validation covers real dates, date order, year folders, filenames, nonnegative
integer game counts, checksums, duplicate archives, and expected GitHub URLs.
The checksums are metadata; the sync does not download ZIPs or recalculate hashes.

The GitHub Pages deployment workflow runs this sync before tests and the build,
so each deployment picks up metadata already published to `ccc-archive`. Existing
daily site data workflows also trigger deployments. No separate CCC scheduler is
needed. A failed fetch or invalid manifest fails that build, leaving the previous
successful deployment live.

The checked-in manifest supports offline local builds. A deployment refresh does
not commit its copy back to the site repository. Run `npm run sync:ccc` and commit
the generated file when updating the local snapshot.

## Page implementation

- `src/components/CccArchivePanel.astro` validates and renders the entire table at
  build time as a tab of `src/pages/chesscom-tournaments.astro`.
- `src/scripts/ccc-archive.ts` adds case-insensitive search and pagination (25, 50,
  or 100 rows; 100 by default). Search matches event names, filenames, and ISO dates.
- With JavaScript disabled, every event and download remains available.
- `src/lib/ccc-archive.ts` owns the data contract and pagination boundaries.
- `src/data/tools.ts` lists CCC Archive as ready on the home and Data pages.

The latest archived date describes the games in the source repository, not the
date of the last website deployment. Refreshing metadata does not fetch new games
from Chess.com.

## Adding tournaments

The step-by-step import, publish, and site-sync procedure for every Chess.com
series lives in one runbook: `D:\dev\proj\chessnerd\HOW-TO-ADD-CHESSCOM-PGNS.md`.
Follow it rather than the notes here.

Archive filenames follow `ccc_YYYY-MM-DD_<slug>[a|b|c…].zip`: the event start
date, then a slug derived from the event name. The slug drops the leading `CCC`
label and any trailing parenthesised time control, removes `#`, lowercases, and
reduces everything else to hyphen-separated words, so `CCC 26 Blitz: Qualifier #3`
starting September 23, 2026 becomes `ccc_2026-09-23_26-blitz-qualifier-3.zip`.
Events that share a start date normally differ by slug; an `a`, `b`, `c…` suffix
is appended only when both the start date and the slug repeat. The manifest keeps
the full `start` and `end` date range (as `YYMMDD`) and the event name.

The importer is `scripts/import_pgn.py` in `D:\dev\proj\chessnerd\ccc-archive`.
It ignores the source filename and reads the event name and dates from the PGN
tags. It leaves the source files in place, refuses existing or overlapping
archives, and derives the date range across all games. Bare Event-only stubs are
omitted from the ZIP copy and game counts; other game bytes are preserved.
The old root-level `ccc_links.txt`, `events.txt`, and `game_counts.txt` mirrors
are no longer required by the active page.

The September 3, 2026 refresh imported 27 available files numbered 469–503 from
`D:\dev\pgn\ccc2`. `event-501.pgn` is CCC 26 Bullet: Qualifier #3
(August 20–24; 1,056 games), and `event-503.pgn` is CCC 26 Bullet: Main
(August 24–29; 1,584 games). The gap in event numbers reflects the local files
available, not a claim that every numbered event exists. The all-stub
`event-408.pgn` is not an importable game collection.
