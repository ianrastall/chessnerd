# Titled Tuesday Archive

Public route: https://chessnerd.net/titled-tuesday-archive.html

## Ownership and refresh

`ianrastall/titled-tuesday-archive` owns event ZIPs and `tt_manifest.json`.
Chess Nerd owns the archive page. `npm run sync:tt` resolves the archive's current
`main` commit and mirrors its manifest to
`public/data/titled-tuesday-archive/manifest.json`. Commit-specific downloads
avoid stale raw GitHub branch caches immediately after an archive upload.

The sync validates real dates, year folders, canonical filenames, early/late
session suffixes, game counts, checksums, uniqueness, and expected download URLs.
It only replaces the local snapshot after the whole manifest passes. It does not
download ZIPs or verify their checksums; the archive repository's generator does
that while building metadata.

GitHub Pages deployment runs the sync before tests and the Astro build. Failed
fetches or validation leave the previously successful deployment live. The
checked-in snapshot supports offline builds; CI's refresh does not commit back
to the site repository. CI uses its GitHub token for the API request; local runs
can use the public API or an existing `GITHUB_TOKEN` environment variable.

## Page behavior

- `src/pages/titled-tuesday-archive.astro` renders every download at build time.
- `src/scripts/titled-tuesday-archive.ts` adds search and 25/50/100-row pagination.
- Search covers event names, filenames, ISO dates, month names, and early/late.
- No JavaScript is needed to read the full table or download a ZIP.
- Dates come from archive filenames. PGN game dates can cross midnight or reflect
  later corrections; they do not redefine the tournament's identity.
- `a` and `b` filename suffixes mean early and late; no suffix is unspecified.
- The page states that this growing collection is incomplete.

## Adding missing PGNs

From `D:\GitHub\titled-tuesday-archive`, preview selected new files with:

```powershell
python archive_metadata.py --import-pgn D:\chessnerd\tt\260714-titled-tuesday.pgn
```

This is an example for when that missing file is available. Add `--write` to
create ZIPs and regenerate all metadata. Source files are kept unchanged;
existing archives and duplicate selections are rejected. The archive README
documents the accepted filename patterns and validation command.

Publish the archive repository first, then run `npm run sync:tt`, `npm test`,
and `npm run build` here. Commit the updated snapshot and push to `main`, or run
the **Deploy to GitHub Pages** workflow manually to refresh the public page.

The September 3, 2026 import used `D:\chessnerd\tt` for January 6,
`D:\dev\proj\chessnerd\New folder` for 26 further events, and
`D:\dev\pgn\cc-events-new` for five July/August events. The 32 added events do not
include July 14, July 21, or September 1, 2026; no local files were found
for those dates at import time. The archive's 412 existing ZIPs were retained.
