# 3-0 Thursday Archive

Public route: https://chessnerd.net/chesscom-tournaments.html#three-zero-thursday

## Ownership and refresh

`ianrastall/3-0-thursday-archive` owns the session ZIPs and `t30_manifest.json`.
`npm run sync:t30` resolves the archive's current
`main` commit and mirrors its manifest to
`public/data/3-0-thursday-archive/manifest.json`. Commit-specific reads avoid
stale raw GitHub branch caches immediately after an archive upload.

The sync validates real dates, year folders, canonical filenames, session
suffixes, event names, game counts, checksums, uniqueness, and expected download
URLs. It only replaces the local snapshot after the complete manifest passes.
GitHub Pages runs this sync before tests and the Astro build on every deployment.

## Public link

The old series URL opens the Tournament Archive with a link to the original
`ianrastall/3-0-thursday-archive` repository. The series manifest remains available
through the full archive metadata index at `/data/archive-search.json`.
The series began November 13, 2025.

## Adding PGNs

Archive filenames follow `3-0-thursday_YYYY-MM-DD[a|b|c].zip`: the ISO date of the
Thursday plus a session letter. Three tournaments run each Thursday (11 a.m.,
4 p.m., and 9 p.m. ET); `a`, `b`, and `c` are the First, Second, and Third
sessions, and every archive carries one. The filename date is the Thursday even
when the Third session's games are already dated Friday in UTC.

The step-by-step import, publish, and site-sync procedure for every Chess.com
series lives in one runbook: `D:\dev\proj\chessnerd\HOW-TO-ADD-CHESSCOM-PGNS.md`.
Follow it rather than the notes here.

The importer (`archive_metadata.py --import-pgn` in
`D:\dev\proj\chessnerd\3-0-thursday-archive`) accepts the canonical names and the
raw Chess.com export names (`YYYY-3-0-thursday-<month>-DD-<first|second|third>.pgn`),
keeps the source file unchanged, verifies the PGN copied into the ZIP, and
rejects duplicate sessions. The archive README documents accepted filename
formats.

As of the September 30, 2026 sync, the published snapshot contains 135 sessions
and 82,873 games from November 13, 2025, through September 24, 2026.
