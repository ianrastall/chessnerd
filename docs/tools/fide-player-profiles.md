# FIDE Player Profiles

Public route: https://chessnerd.net/fide-player.html (`?id=<FIDE id>` opens a profile)

A player's full standard-rating history from the archived FIDE lists, 1967 to now,
as a stat block, chart, table, and CSV download. Search by surname or go straight
to a FIDE ID.

## Data

The page reads static files built by `D:\dev\proj\fide-players` (see its `FORMAT.md`)
from the yearly Parquet files in `D:\dev\proj\fide-db-archive`:

- `players/shards.json` lists the rating lists and the first FIDE ID of each shard.
- `players/shard-NNNN.bin` holds about 1000 players each. A profile loads one shard
  (about 135 KB gzipped).
- `names/<xx>.json` is the name index, one file per first two letters of the surname.

`src/lib/fide-players.ts` decodes the shards; `src/scripts/fide-player.ts` is the page.

## Where the files are served from

The page uses `PUBLIC_FIDE_PLAYERS_BASE` (a URL ending in `/`), defaulting to
`/fide-players/`. The shards are about 260 MB raw (around 45 MB gzipped), too large
to commit to this repo on every rebuild, so for local work `public/fide-players` is a
directory junction to the build folder and is git-ignored:

```powershell
cmd /c mklink /J public\fide-players D:\dev\proj\fide-players
```

Do not run `npm run build` with the junction in place unless you want the shards in
`dist` (the build copies `public/`). For deployment, host the `players/` and `names/`
folders somewhere that sends `Access-Control-Allow-Origin: *` (a GitHub Pages site for
its own repo does) and set `PUBLIC_FIDE_PLAYERS_BASE` for the build.

## What a profile does not have

Only what the rating lists contain: rating, games, K-factor, flag, names,
federations, titles as listed, sex, birth year. No results, game lists, or title
award dates; the page links to the player's FIDE profile for those. Rows from before
FIDE IDs existed cannot be linked to a person and are not in any profile. FIDE's
January 2006 list ends with ten placeholder rows ("Name", "Fed"); they stay in the
archive and are skipped in the profiles.

## Rebuilding

```powershell
cd D:\dev\proj\fide-players
python build_players.py        # about 7 minutes
python verify.py
node verify.mjs
```

`npm test` includes `src/lib/fide-players.test.ts`, which checks the decoder against
a small encoder written from the format document and, when the build is on this
machine, against the real Carlsen shard.
