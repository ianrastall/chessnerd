# FIDE Archive

Public route: https://chessnerd.net/fide-archive.html

A mirror of old FIDE rating lists from two sources, kept as downloaded:

- **FIDE** (`https://ratings.fide.com/download/`): every list from January 2001,
  as TXT and XML zips for standard, rapid and blitz, plus the rolling combined
  files (`players_list*.zip`, snapshots of the current month).
- **Olimpbase** (`https://www.olimpbase.org/Elo/`): the raw lists in `Elo/data/`
  (TXT, DBF, MDB, scanned-GIF ZIPs, 1971–2009) and the `Elo*.html` list pages.

## Where things live

| What | Where |
| --- | --- |
| The files (about 8 GB) | `D:\fide-archive` (not in git) |
| Public copy | Pixeldrain ZIP bundles; published IDs and checksums in `public/data/fide-archive/pixeldrain.json` |
| Manifest for the page | `public/data/fide-archive/manifest.json` (in git) |
| Script | `scripts/fide_archive.py` |

The files are too big for GitHub Pages. The site holds metadata, links to
Pixeldrain bundles and links to original source downloads. The source manifest
retains the planned Internet Archive URLs for compatibility and provenance;
those URLs are not used as the site's download targets after publication.

## Naming FIDE uses

| Period | Name |
| --- | --- |
| 2001 – early 2012 | `jan01frl.zip` (combined TXT only; quarterly, then bimonthly, then monthly) |
| 2012 – now | `standard_sep26frl.zip`, `standard_sep26frl_xml.zip`, and `rapid_` / `blitz_` likewise |
| Current month only | `players_list.zip`, `players_list_xml.zip`, `players_list_legacy.zip`, `players_list_xml_legacy.zip`, `players_list_foa.zip`, `players_list_xml_foa.zip` |

FIDE's download page lists Feb 2015 onwards in its dropdown; older files are
reachable by name but are not linked from it. A missing name returns an HTML
404 page with status 404, which the script treats as "not published".

## Run it

```powershell
cd D:\jupiter\chessnerd
python -I scripts/fide_archive.py discover   # probes every candidate name (about 2.5 minutes), writes plan.json
python -I scripts/fide_archive.py fetch      # resumable; add --source fide or --source olimpbase
python -I scripts/fide_archive.py manifest   # zip test, SHA-256, writes manifests
npm test
git add public/data/fide-archive scripts/fide_archive.py
```

`fetch` skips files whose size matches the plan, so interrupt and re-run freely.
`manifest` re-hashes only files whose size changed, and fails on a corrupt zip.

## Adding the next month

FIDE publishes on the 1st. Re-run the three steps; discovery adds the new month.
Prepare and upload updated Pixeldrain bundles, copy the verified publication
metadata to the site, then commit both manifests. A source manifest refresh
without matching bundle coverage blocks the website build.

## Pixeldrain publication

The Internet Archive location above was planned but has not been verified as
published. Do not treat its URLs as evidence of a completed upload.

Prepare independent ZIP bundles from exactly the files in the local manifest:

```powershell
python -I scripts/publish_fide_pixeldrain.py prepare
python -I scripts/publish_fide_pixeldrain.py upload
```

The preparation step checks every original SHA-256, groups whole years by
source with a 2 GB input-size target, and verifies the ZIP contents against
those checksums. Each ZIP contains its own source manifest and can be extracted
independently. Outputs go to `D:/fide-archive/pixeldrain`, outside Git. The
derived SQLite databases are not part of the original-file archive. Existing
bundles are reused when their checksums and embedded file records still match,
so unchanged historical groups retain their existing upload IDs.

Save the API key alone in
`C:/Users/Ian/.config/chessnerd/pixeldrain-api-key.txt`, or supply the
`PIXELDRAIN_API_KEY` environment variable. The script never prints the key.
Uploads use Pixeldrain's authenticated PUT endpoint; the public file metadata
must match the bundle's size, name and SHA-256 before an upload is recorded.
Verified receipts are saved locally after each upload. Rerunning uploads
rechecks and skips those completed files. After all files have been verified,
the script creates and verifies a Pixeldrain collection and writes
`D:/fide-archive/pixeldrain/pixeldrain.json`. Copy that file to
`public/data/fide-archive/pixeldrain.json` before building the site. Website links
must be updated only after all required uploads have succeeded and been
verified. The account's regular-file inactivity expiry applies; local originals
and upload receipts remain available for restoration.

### Saved player lists

Twelve distinct original ZIPs were recovered from `D:/tournaments` (including
`playchess`), `D:/tools` (including `EDO-SSP`) and `D:/__pgn-extract/cegt`.
Their bytes were copied into `D:/fide-archive/local-snapshots`, using checksum
directories to preserve duplicate filenames. Their separate manifest records
ZIP member timestamps and explicitly does not claim those are publication
dates. Originals at their discovery locations were left untouched.

The same prepare/upload script supports this store with `--store` and
`--output` overrides. Its verified supplemental bundle and file metadata are
published separately in `public/data/fide-archive/local-snapshots.json`; these
locally recovered copies do not replace the authoritative source manifest.

Nine distinct TXT/XML files were also recovered from
`D:/__Chess Nerd/site/fide/players_list_xml.xml` and
`D:/fide/fide_old/players-lists`. These are copied to
`D:/fide-archive/local-text-snapshots`, preserving names and recording local
modification times without inferring publication dates. An independent ZIP
holds these files; SHA-256 duplicates are omitted. Its preparation uses
`--max-bytes 8000000000` because the uncompressed inputs exceed the normal
target; the resulting download is compressed. Both supplemental bundles are
listed in the site's local-snapshot metadata after remote verification.

## Caveats

- Olimpbase says its data is unofficial and carries the errors of the original
  lists; they are mirrored as is.
- Some FIDE months do not exist (pre-2012 lists were not monthly).
- The page deliberately does not parse or rehost the contents; it is a backup.
