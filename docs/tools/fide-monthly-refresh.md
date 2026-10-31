# Monthly FIDE refresh

The standard-rating archive and FIDE 2500+ table use the same verified monthly
publication, updated by hand each month; see [Monthly update](#monthly-update).
A period takes effect at **00:00 UTC on the first of the month**, or as soon as
it is deployed if that is later. The separate player-history shard publication
is outside this refresh's scope.

There is no schedule. Most GitHub-hosted runner addresses cannot reach
`ratings.fide.com`, and the producer's scheduled workflow was removed on
31 October 2026 for that reason: in an eight-runner probe, six timed out on
every attempt and two connected on every attempt.

## Acquisition and ownership

`ianrastall/fide-db-archive/refresh_monthly.py` is the owning producer, run
locally. It downloads `https://ratings.fide.com/download/players_list_xml.zip`
and explicitly dated standard, rapid and blitz XML ZIPs (for example
`standard_nov26frl_xml.zip`). It checks ZIP integrity, unique IDs and agreement
of each rating in both directions between registry and dated lists. Neither
download time nor a ZIP timestamp is taken as proof of a rating period.
Missing or disagreeing sources fail preparation and preserve the previous
publication. A dated list that returns 404 means FIDE has not posted that period.

Undated downloads such as `standard_rating_list_xml.zip` are not accepted. Their
names carry no period and they keep serving the previous list until FIDE rolls
over; on 31 October 2026 they still held the October ratings.

The standard XML becomes one SQLite database with the existing 22-column
`players` table, three indexes and `meta` provenance. No fields are filled from
other months. The rolling registry supplies the 2500+ shortlist using the
existing standard/rapid/blitz threshold and title precedence. All original ZIPs
are retained as release assets, with URL, SHA-256 and size receipts.

The immutable tag is `standard-sqlite-YYYY-MM-monthly`. Assets include the
individual SQLite ZIP, `players.json`, `players.meta.json`, the four original
downloads and `monthly.json`. Uploads go to a draft release; every server asset
digest and size is checked before publication. A failed upload leaves a draft
for retry. A month that is already published is skipped. Releases do not replace
the existing binary archive or its latest-release designation. Publishing uses
the local `gh` sign-in; no additional API key is needed.

## Website staging and activation

The site workflow `Sync FIDE Ratings Data` runs only by manual dispatch and
needs a `period`. It consumes the owner's public release, which it reaches from
any runner; no cross-repository write token is required.
`scripts/sync_fide_monthly.py` checks release asset digests, downloaded payload
hashes, restored SQLite integrity/schema/count/date/meta, player data and source
provenance before writing public files. A missing release or a validation
failure blocks commit and deployment.

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
loaded table. A sync on or after the effective date updates the existing
`/data/fide-players.json` and `.meta.json` URLs for other consumers, and the
deployment refreshes the archive's non-JavaScript HTML.

Until a period is synced and deployed, the previous month remains available.
There is no invented next-month dataset.

## Monthly update

Run these once FIDE has posted the new period. No files need downloading by
hand; the producer fetches the dated lists itself, and a `FIDE has not posted`
error means it is too early. Both commands are safe to repeat.

```powershell
# In D:\fide\fide-db-archive:
python refresh_monthly.py --period 2026-11 --publish --output D:\fide\monthly-2026-11
```

```powershell
gh workflow run sync-fide-ratings.yml --repo ianrastall/chessnerd -f period=2026-11
```

A successful site sync chains to deployment; a failed one does not. If the sync
ran before the first of the month, dispatch it again after 00:00 UTC to update
the legacy URLs above.

To reproduce a month from saved originals without publishing, pass `--source`
with a folder holding the four files under FIDE's original names:

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
