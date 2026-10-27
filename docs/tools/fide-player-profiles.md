# FIDE Player Profiles

Public route: https://chessnerd.net/fide-player.html (`?id=<FIDE id>` opens a profile)

A player's full standard-rating history from the archived FIDE lists, 1967 to now,
as a stat block, date lookup, chart, detailed table, and CSV download. Search by surname or go straight
to a FIDE ID.

## Data

The page reads static files built by `D:\dev\proj\fide-players` (see its `FORMAT.md`)
from the yearly Parquet files in `D:\dev\proj\fide-db-archive`:

- `players/shards.json` lists the rating lists and the first FIDE ID of each shard.
- `players/shard-NNNN.bin.gz` holds about 1000 players each, gzipped. A profile loads one
  shard (about 135 KB).
- `names/<xx>.json.gz` is the name index, one file per first two letters of the surname.

`src/lib/fide-players.ts` unpacks (`DecompressionStream`) and decodes the shards;
`src/scripts/fide-player.ts` is the page. A server that already decodes the gzip
(`Content-Encoding`) is handled: plain bytes are used as they are.

## Where the files are served from

The files are about 58 MB gzipped, kept in their own repository (`ianrastall/fide-players`)
and served by GitHub Pages at `https://ianrastall.github.io/fide-players/`, which is the
page's default. Set `PUBLIC_FIDE_PLAYERS_BASE` (a URL ending in `/`) to read them from
somewhere else.

Local development reads them from disk instead. `.env.development` (git-ignored) sets
`PUBLIC_FIDE_PLAYERS_BASE=/fide-players/`, and `public/fide-players` is a directory junction
to the build folder (also git-ignored):

```powershell
cmd /c mklink /J public\fide-players D:\dev\proj\fide-players
```

Remove the junction (`rmdir public\fide-players`) before `npm run build` on this machine,
because the build copies `public/` into `dist`. CI never has it.

## Profile layout and biographical sources

Profiles show archive identity and standard peak/latest values first. A year
and archived-list selector gives direct access to individual observations;
missing periods are not filled in and year-only dates are labelled as such.
The compact trend chart follows. Detailed history starts collapsed, initially
renders twelve lists, and can show every list in a bounded scroll region.
The CSV always includes all observations regardless of the selected date or
whether the detail table is expanded. Archive names/title/federation changes
have their own disclosure.

`src/lib/fide-biography.ts` optionally queries Wikidata through its public
SPARQL endpoint, matching only the exact FIDE ID (P1440). It supplies an English
description, birth/death dates at the precision recorded, birthplace and an
English Wikipedia biography link when available. Ambiguous entity matches are
rejected. These fields are separate from archive facts, with a Wikidata source
link. Availability varies by player and by the external service.

Photos use Wikidata's image claim and Wikimedia Commons imageinfo metadata.
A thumbnail is displayed only with author/credit, license and source links.
Third-party HTML metadata is converted to text, never inserted as live HTML.
Missing photos are stated explicitly. A failed biography request has a retry;
neither biography nor image failures prevent archive rating lookup or export.
These requests run in the visitor's browser, with twelve-second timeouts; they
are not archived biographical snapshots. No new paid API or server is required.

Source contracts: https://www.wikidata.org/wiki/Property:P1440 and
https://www.mediawiki.org/wiki/API:Imageinfo.

## What the rating archive does not have

Only what the rating lists contain: rating, games, K-factor, flag, names,
federations, titles as listed, sex, birth year. No results, game lists, or title
award dates in the archive itself; the page links to the player's FIDE profile for those. Rows from before
FIDE IDs existed cannot be linked to a person and are not in any profile. FIDE's
January 2006 list ends with ten placeholder rows ("Name", "Fed"); they stay in the
archive and are skipped in the profiles.

## Rebuilding

```powershell
cd D:\dev\proj\fide-players
python build_players.py        # about 8 minutes
python verify.py
node verify.mjs
```

`npm test` includes `src/lib/fide-players.test.ts`, which checks the decoder against
a small encoder written from the format document and, when the build is on this
machine, against the real Carlsen shard.
