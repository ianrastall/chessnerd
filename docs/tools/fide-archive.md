# FIDE Archive

Public route: https://chessnerd.net/fide-archive.html

One SQLite database per available standard-rating period. The page lists only
period, source row count and an individual SQLite ZIP download. It has no
rapid/blitz columns, player-registry downloads, collection link or fixed-height
scroll region. Period search works on the static table; downloads remain
available without JavaScript.

## Existing data and authority

The existing per-list conversions are reused from
`D:/fide/fide-archive/sqlite`. Their inventory belongs to the independent
`ianrastall/fide-db-archive` repository, locally at
`D:/fide/fide-db-archive/data/inventory.json`. The October 2026 snapshot contains
283 periods, 1967 through October 2026, and 62,312,616 source rows.

Each database has the original 22-column `players` table and key/value `meta`
table. These contain only standard-rating data and player information: names,
FIDE IDs where supplied, federations, sex, titles, birth information, rating,
games, K-factor, flags and original row details. No rapid/blitz ratings or
combined player registries are imported into these files.

Historical partial/change lists remain partial. Year-only dates remain
year-only. Missing names, identifiers or biographical values are not guessed
or copied from later lists. Nulls, zero values, duplicate rows, row order and
original source metadata are retained. The existing converter is
`D:/dev/proj/chessnerd/chessnerd/scripts/fide_to_sqlite.py`; the independent
FIDE workspace also has supplemental XML/HTML converters. Reuse those tools
when adding a new source format rather than changing historical source data.

## Publication

`scripts/publish_fide_sqlite.py` validates each database against the verified
archive inventory: filename, SHA-256, size, schema, SQLite integrity, period
and actual row count. It rejects active/changing databases. Each independent
ZIP contains one SQLite file, whose restored SHA-256 is checked before upload.

```powershell
python -I scripts/publish_fide_sqlite.py prepare
python -I scripts/publish_fide_sqlite.py publish
```

Outputs are outside Git in `D:/fide/standard-list-downloads`. The publication
is a separate GitHub release in the existing `fide-db-archive` repository,
with tag `standard-sqlite-2026-10`. The existing binary release, independent
Git history and unrelated uncommitted local changes are untouched. GitHub
credentials come from the existing `gh` login; no Pixeldrain key is needed.

The script uploads to a draft release and verifies every server-reported
asset SHA-256 and byte count before publishing. An upload or validation failure
blocks publication. Rerunning skips verified completed assets. Published
assets are not overwritten. For a new snapshot, use a new `--tag` and the
verified source archive `--revision`, with the updated `--inventory`.

After successful publication, copy
`D:/fide/standard-list-downloads/standard-lists.json` to
`public/data/fide-archive/standard-lists.json`. This checked-in manifest records
individual download URLs, SQLite and ZIP hashes, row counts, original source
metadata, inventory checksum and archive revision. The website validates it
before building. Run unit tests, build, browser checks and required archive
syncs before deploying the site.

`sourceInventorySha256` hashes the local inventory file exactly as read,
including working-tree line endings. Its JSON content matches the inventory
at `sourceRevision`; a raw Git blob can have different newline bytes. SQLite
and ZIP checksums always describe exact binary bytes.

## Reference material

Original TXT/XML/DBF/MDB/HTML lists, scans and saved `players_list*` files remain
unchanged in the existing local archive and reference stores. Earlier source
manifests, Pixeldrain receipts and download URLs are retained for compatibility
and provenance, but are not the website's rating-list catalogue. Older player
registries are reference material only; no dates or missing player information
are inferred from them for this publication.
