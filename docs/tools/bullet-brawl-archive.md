# Bullet Brawl Archive

Public route: https://chessnerd.net/bullet-brawl-archive.html

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

## Page behavior

- `src/pages/bullet-brawl-archive.astro` renders every download at build time.
- `src/scripts/bullet-brawl-archive.ts` adds search and 25/50/100-row pagination.
- Search covers event names, filenames, ISO dates, and month names.
- No JavaScript is needed to read the full table or download a ZIP.
- The page identifies the collection as growing while older events are added.

## Adding PGNs

Archive filenames follow `cc_bullet-brawl_YYMMDD.zip` (one event per date; no
suffix needed).

From `D:\dev\proj\chessnerd\bullet-brawl-archive`, preview selected new files. For example:

```powershell
python archive_metadata.py --import-pgn D:\dev\pgn\bb\Bullet_Brawl_2025-08-02-11-00.pgn
```

Add `--write` to create ZIPs and regenerate all metadata. The importer keeps the
source file unchanged, verifies the PGN copied into the ZIP, and rejects
duplicate dates. The archive README documents accepted filename formats.

Publish the archive repository first, then run `npm run sync:bb`, `npm test`, and
`npm run build` in Chess Nerd. The current published snapshot contains 137 events
and 421,095 games from January 6, 2024, through August 29, 2026. No source PGN is
currently available for January 27 or October 26, 2024.
