# Bullet Brawl Archive

Public route: https://chessnerd.net/chesscom-tournaments.html#bullet-brawl
(the old `/bullet-brawl-archive.html` route redirects there)

## Ownership and refresh

`ianrastall/bullet-brawl-archive` owns the event ZIPs and `bb_manifest.json`.
Chess Nerd owns the archive page. `npm run sync:bb` resolves the archive's current
`main` commit and mirrors its manifest to
`public/data/bullet-brawl-archive/manifest.json`. Commit-specific reads avoid
stale raw GitHub branch caches immediately after an archive upload.

The sync validates real dates, year folders, canonical filenames, event names,
game counts, checksums, uniqueness, and expected download URLs. It only replaces
the local snapshot after the complete manifest passes. GitHub Pages runs this
sync before tests and the Astro build on every deployment.

## Public link

The [Tournament Archive](https://chessnerd.net/tournament-archive.html#bullet-brawl)
shows the full series with search, pagination, and individual event ZIP links.
The series is also included in the full metadata index at `/data/archive-search.json`.

## Adding PGNs

Archive filenames follow `bullet-brawl_YYYY-MM-DD.zip` (one event per date; no
suffix needed).

The step-by-step import, publish, and site-sync procedure for every Chess.com
series lives in one runbook: `D:\dev\proj\chessnerd\HOW-TO-ADD-CHESSCOM-PGNS.md`.
Follow it rather than the notes here.

The importer (`archive_metadata.py --import-pgn` in
`D:\dev\proj\chessnerd\bullet-brawl-archive`) keeps the source file unchanged,
verifies the PGN copied into the ZIP, and rejects duplicate dates. It still
accepts the raw Chess.com export names and the older `cc_bullet-brawl_YYMMDD`
and `bullet-brawl-YYYY-MM-DD` names. The archive README documents accepted
filename formats.

As of the September 30, 2026 sync, the published snapshot contains 171 events and
512,016 games from January 28, 2023, through September 26, 2026. Coverage is
complete for 2024–2026 except January 27 and October 26, 2024, where no source
PGN is currently available; 2023 is partial (30 events).
