# Titled Tuesday Archive

Public route: https://chessnerd.net/chesscom-tournaments.html#titled-tuesday
(the old `/titled-tuesday-archive.html` route redirects there)

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

- `src/components/TitledTuesdayArchivePanel.astro` renders every download at build
  time as a tab of `src/pages/chesscom-tournaments.astro`.
- `src/scripts/titled-tuesday-archive.ts` adds search and 25/50/100-row pagination.
- Search covers event names, filenames, ISO dates, month names, and early/late.
- No JavaScript is needed to read the full table or download a ZIP.
- Dates come from archive filenames. PGN game dates can cross midnight or reflect
  later corrections; they do not redefine the tournament's identity.
- Archive filenames follow `titled-tuesday_YYYY-MM-DD[a|b].zip`; `a` and `b` are
  early and late sessions, and no suffix means the session is unspecified.
- The page states that this growing collection is incomplete.

## Adding missing PGNs

The step-by-step import, publish, and site-sync procedure for every Chess.com
series lives in one runbook: `D:\dev\proj\chessnerd\HOW-TO-ADD-CHESSCOM-PGNS.md`.
Follow it rather than the notes here.

The importer (`archive_metadata.py --import-pgn` in
`D:\dev\proj\chessnerd\titled-tuesday-archive`) produces
`titled-tuesday_YYYY-MM-DD[a|b].zip` regardless of the input filename shape. It
still accepts the raw Chess.com export names and the older
`cc_titled-tuesday_YYMMDD[a|b]` and `titled-tuesday-YYYY-MM-DD[a|b]` names.
Source files are kept unchanged; existing archives and duplicate selections are
rejected. The archive README documents the accepted filename patterns and
validation command.

The initial September 3, 2026 import used `D:\chessnerd\tt` for January 6,
`D:\dev\proj\chessnerd\New folder` for 26 further events, and
`D:\dev\pgn\cc-events-new` for five July/August events. It added 32 events and
retained the archive's 412 existing ZIPs.

The follow-up import added July 14, July 21, and September 1 from
`D:\dev\pgn\cc-events-new`, and refreshed July 7 with its newer export. The other
five supplied files already matched the archive. The resulting snapshot contains
447 events and 825,726 games, including 35 events in 2026 through September 1.
