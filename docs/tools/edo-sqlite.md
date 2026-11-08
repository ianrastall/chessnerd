# Edo Historical Chess Ratings SQLite archive

The builder reads the saved Edo snapshot in `public/data/edo` and writes a
standalone SQLite file to `.cache/edo/edo.sqlite`. It runs offline. The database
includes Edo's original HTML, including notes and citations. Keep it local
pending a redistribution rights review.

From the repository root, run the following with Python 3.12 and lxml installed
(tested with lxml 6.1.3).

```powershell
python scripts/edo/build_sqlite.py
```

Use `--source` or `--output` to override the paths. Use `--replace` to replace
an existing output after the new build passes SQLite integrity and foreign key
checks.

## What the database contains

| Tables and views | Contents |
| --- | --- |
| `players`, `years`, `locations` | Original Edo IDs and available profile and location fields. A null `file_id` identifies an ID found in a link without a usable detail page. |
| `ratings`, `rating_observations`, `rating_disagreements` | One preferred rating per player and year, every observation from both player and year pages, and a comparison of the two sources. The preferred view gives the player page priority and uses the year page when needed. |
| `events`, `matches`, `match_results` | Edo event IDs such as `m1` and `t1`, with available match dates, status, location and participant results. Date text retains the source's precision and wording. |
| `tournaments`, `tournament_entries`, `event_listing_details` | Tournament records assembled from the player, year and location listings in the snapshot. Player listings may include scores, games and subordinate results. |
| `event_listings`, `event_players`, `event_years`, `event_locations` | Individual source listings and deduplicated relationships. Year associations come from annual indexes. Location associations also include linked match venues. |
| `page_notes`, `citations`, `source_rows`, `source_links` | Notes, citations, parsed table cells in source order, and links with original and resolved targets. Row IDs trace individual values back to a file and HTML line. |
| `source_files`, `source_manifest_entries` | Every local file, its original bytes compressed with zlib, SHA-256, byte count, source URL when known, and the four original URL inventories. |

The verified build contains 21,589 source files, 15,194 players, 970 locations,
105,164 player-year ratings from 1814–1948, and 5,225 match pages with 10,450
result rows. Of those results, 321 list a participant by name without an Edo
player link. The result rows preserve those names with a null `player_id`.

The two rating sources agree on all rating and deviation values. They differ
on 358 ranks and 28 games values. Both values remain in
`rating_observations`. The fractional games values appear on the year pages.

The 7,226 tournament records come from available listings. The snapshot has
no tournament detail pages or PGN files. The match URL inventory includes 4,714
entries without local files and 61 saved 404 responses. An absent manifest
target has a null `target_file_id`. A saved 404 has a matching `source_files`
row with `page_status = 'http_404'`.

## Example queries

Rating history for Edo player 1, with the original page URL.

```sql
SELECT p.name, r.year, r.rank, r.rating, r.deviation, r.games, f.source_url
FROM ratings AS r
JOIN players AS p USING (player_id)
JOIN source_rows AS s USING (row_id)
JOIN source_files AS f ON f.file_id = s.file_id
WHERE r.player_id = 1
ORDER BY r.year;
```

Available results for match `m1`.

```sql
SELECT m.title, m.start_date, m.status, r.player_name, r.score_text, r.games_text
FROM matches AS m
JOIN match_results AS r USING (event_id)
WHERE m.event_id = 'm1'
ORDER BY r.row_id;
```

To recover a source file, select its `content_zlib` by `path` and decompress the
BLOB with Python's `zlib.decompress`. Compare the resulting bytes with the
`byte_count` and `sha256` in the same row.
