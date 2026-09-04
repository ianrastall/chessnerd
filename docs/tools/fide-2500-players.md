# FIDE 2500+ Players

Public route: https://chessnerd.net/fide-2500.html

## Ownership and refresh

The FIDE monthly `standard_rating_list` XML dump is the source. Chess Nerd owns
the tool and the derived JSON snapshot.

Regenerate the snapshot from a downloaded XML with:

```powershell
python scripts/build_fide_players.py D:\fide\fide_players_list-YYYY-MM.xml
```

The script filters players whose standard, rapid, or blitz rating is at least
2500, sorts them by best rating desc / name asc, and writes:

- `public/data/fide-players.json` — the compact array of player rows.
- `public/data/fide-players.meta.json` — `{source, period, generated, count, min_rating}`
  used to render the "Data as of…" line on the page.

The XML is ~800 MB, so the script uses `xml.etree.ElementTree.iterparse` and
clears each `<player>` element after handling. Runtime is roughly 30–60 s on the
current XML.

To generate at a different threshold or write to a different file, use the
optional flags:

```powershell
python scripts/build_fide_players.py <xml> --min 2400 --out public/data/custom.json
```

## Page behavior

- `src/pages/fide-2500.astro` renders an empty table shell and loads the JSON
  client-side; no build-time data dependency.
- Filters: title checkboxes (GM, WGM, IM, WIM, FM, WFM, CM, WCM, NM, WNM,
  Untitled), rating format (standard/rapid/blitz/best-of-three), min Elo,
  country (FIDE federation code), sex, activity status, and text search over
  name or FIDE ID.
- Sortable columns: title (priority order), name, country, sex, standard,
  rapid, blitz, born, status.
- 100 rows per page with a "Show more" that appends the next 100.
- CSV export honours the current filter set.
- The name column links to https://ratings.fide.com/profile/&lt;id&gt;.

## Data fields

Each row in `fide-players.json` is:

```json
{
  "id": 1503014,
  "name": "Carlsen, Magnus",
  "country": "NOR",
  "sex": "M",
  "title": "GM",
  "std": 2839,
  "rapid": 2837,
  "blitz": 2887,
  "born": 1990,
  "active": true
}
```

`title` is the highest-priority open or women title on file (GM > IM > WGM > FM
> WIM > CM > WFM > NM > WCM > WNM); an empty string means untitled. `active` is
`false` when FIDE's `<flag>` contains `i`.
