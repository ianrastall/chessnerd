# CCC Archive

Public route: https://chessnerd.net/ccc-archive.html

## Ownership and data flow

`ianrastall/ccc-archive` is the canonical data repository. It stores event ZIPs in
year folders and describes them in `ccc_manifest.json`. Chess Nerd hosts the UI;
download links go directly to the archive repository.

Run `npm run sync:ccc` with Node 24 to fetch the published manifest, validate it,
sort events newest first, and update `public/data/ccc-archive/manifest.json`.
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

- `src/pages/ccc-archive.astro` validates and renders the entire table at build time.
- `src/scripts/ccc-archive.ts` adds case-insensitive search and pagination (25, 50,
  or 100 rows; 100 by default). Search matches event names, filenames, and ISO dates.
- With JavaScript disabled, every event and download remains available.
- `src/lib/ccc-archive.ts` owns the data contract and pagination boundaries.
- `src/data/tools.ts` lists CCC Archive as ready on the home and Data pages.

The latest archived date describes the games in the source repository, not the
date of the last website deployment. Refreshing metadata does not fetch new games
from Chess.com.

## Adding tournaments

1. Ingest and publish event ZIPs and the updated manifest in `ccc-archive` first.
2. Run `npm run sync:ccc` here, then `npm test` and `npm run build`.
3. Commit the snapshot with any site changes and push to `main`, or manually run
   **Deploy to GitHub Pages** to refresh the live page from the published archive.
4. Verify the latest event and its ZIP at the public route.

The legacy ingest helper remains at `legacy/docs/rebuild_ccc_archive_metadata.py`.
Its default paths predate the Astro migration. If using it, pass explicit paths:

```powershell
python legacy/docs/rebuild_ccc_archive_metadata.py --archive-root D:\GitHub\ccc-archive --no-sync-chessnerd
```

That helper can move ingested raw PGNs into `raw/processed`; use
`--raw-archive-mode keep` when they should stay in place. Review its output and
publish the archive repository before running the site sync. The old root-level
`ccc_links.txt`, `events.txt`, and `game_counts.txt` mirrors are no longer required
by the active page.
