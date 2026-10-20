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
| Public copy | Internet Archive item `fide-rating-lists-archive` (set `ITEM` in the script) |
| Manifest for the page | `public/data/fide-archive/manifest.json` (in git) |
| Script | `scripts/fide_archive.py` |

The files are far too big for GitHub or Pages, so the site holds only the
manifest and links to `https://archive.org/download/<item>/<path>`. The path
inside the item is the path under `D:\fide-archive`, so uploading the folder
as it is makes every link resolve.

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
cd D:\dev\proj\chessnerd\chessnerd
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
Upload the new files to the Internet Archive item, then commit the manifest.

## Caveats

- Olimpbase says its data is unofficial and carries the errors of the original
  lists; they are mirrored as is.
- Some FIDE months do not exist (pre-2012 lists were not monthly).
- The page deliberately does not parse or rehost the contents; it is a backup.
