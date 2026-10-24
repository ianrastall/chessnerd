# Monthly FIDE refresh

The standard-rating archive and FIDE 2500+ table use the same verified monthly
publication. Activation is **00:00 UTC on the first of the month**. The separate
player-history shard publication is outside this refresh's scope.

## Acquisition and ownership

`ianrastall/fide-db-archive/refresh_monthly.py` is the owning producer. Its
`Prepare monthly FIDE ratings` workflow prepares the next period only on the
actual last calendar day (including leap years), with current-month recovery
on days 1 and 2. Cron attempts are 12:17, 18:17, 21:17 and 23:17 UTC on days
28–31, and 00:17 and 03:17 on days 1–2. Other dates in the cron range exit
without acquiring data. A manual `period` input allows explicit YYYY-MM runs.

The producer downloads `https://ratings.fide.com/download/players_list_xml.zip`
and explicitly dated standard, rapid and blitz XML ZIPs (for example
`standard_nov26frl_xml.zip`). It checks ZIP integrity, unique IDs and agreement
of each rating in both directions between registry and dated lists. Neither
download time nor a ZIP timestamp is taken as proof of a rating period. Missing
or disagreeing sources fail preparation and preserve the previous publication.

The standard XML becomes one SQLite database with the existing 22-column
`players` table, three indexes and `meta` provenance. No fields are filled from
other months. The rolling registry supplies the 2500+ shortlist using the
existing standard/rapid/blitz threshold and title precedence. All original ZIPs
are retained as release assets, with URL, SHA-256 and size receipts.

The immutable tag is `standard-sqlite-YYYY-MM-monthly`. Assets include the
individual SQLite ZIP, `players.json`, `players.meta.json`, the four original
downloads and `monthly.json`. Uploads go to a draft release; every server asset
digest and size is checked before publication. A failed upload leaves a draft
for retry. A published month is skipped on subsequent scheduled runs. Releases
do not replace the existing binary archive or its latest-release designation.
No additional API key is needed; the owning workflow uses its own Actions token.

## Website staging and activation

The site workflow `Sync FIDE Ratings Data` runs at 12:43, 18:43, 21:43 and 23:43
UTC on the last day, with 00:43 and 03:43 recovery on days 1–2. It consumes the
owner's public release; no cross-repository write token is required.
`scripts/sync_fide_monthly.py` checks release asset digests, downloaded payload
hashes, restored SQLite integrity/schema/count/date/meta, player data and source
provenance before writing public files. Validation failures block commit and
deployment.

Versioned JSON is stored byte-for-byte with Git text normalization disabled
for that directory. The site build independently checks those payload hashes
in the actual checkout, including on Linux, before deployment.

Versioned files live at `/data/fide-monthly/YYYY-MM/`; `/data/fide-monthly.json`
indexes effective dates and payload hashes. The archive manifest gains a new
period with its own release/revision/effective date. Existing periods and their
download URLs remain unchanged. On bootstrap of an existing period, its row
count must agree; the XML-derived database is kept in the monthly release while
the established archive download remains authoritative. The historical root
manifest revision/inventory hash still describes the original baseline; each
monthly addition has its own provenance rather than rewriting that receipt.

Pre-staged future data stays out of both visible tables until midnight UTC.
The 2500+ page chooses the latest effective snapshot, verifies its payload
hashes and switches on a UTC timer; the archive reveals its staged period on
the same boundary. Pages also re-evaluate when restored from a background tab.
The visitor's clock defines browser activation. A failed refresh retains the
loaded table. The first post-midnight sync updates the existing
`/data/fide-players.json` and `.meta.json` URLs for other consumers, and the
deployment refreshes the archive's non-JavaScript HTML.

GitHub scheduled workflows can be delayed. Midnight activation works when the
new month has been successfully staged and deployed beforehand. If FIDE has
not published consistent files, or preparation/deployment fails, the previous
month remains available and the workflow reports failure. There is no invented
next-month dataset or unconditional midnight availability promise.

## Manual recovery

Dispatch `Prepare monthly FIDE ratings` in the owning archive with `period`
set to the desired YYYY-MM. Wait for a published monthly release, then dispatch
`Sync FIDE Ratings Data` in Chess Nerd with the same period. A successful site
refresh chains to deployment; a failed refresh does not.

Local reproduction from downloaded originals:

```powershell
# In a clean checkout of the owning archive:
python refresh_monthly.py --period 2026-10 --source D:\fide\fide-archive\fide\2026-10 --output D:\fide\monthly-2026-10
# In Chess Nerd, after reviewing/verifying the producer output:
python scripts/sync_fide_monthly.py --period 2026-10 --directory D:\fide\monthly-2026-10
```

The producer needs Python's standard library and authenticated `gh` for
publication (`--publish`). It runs independently of the archive's Parquet
dependencies. Published corrections require deliberate review/new publication;
the normal pipeline refuses to replace a staged month's hashes.
