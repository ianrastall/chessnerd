# FIDE historical database assessment

Inspected 27 October 2026. The independent archive repository is
https://github.com/ianrastall/fide-db-archive; player shards are published by
https://github.com/ianrastall/fide-players.

## Existing master

A single historical SQLite database already exists locally at
`D:/fide/complete/fide-complete.sqlite` (23,633,838,080 bytes, about 22 GiB).
`D:/fide/COMPLETE.md` documents its schema and build process;
`D:/fide/complete/fide-complete.report.json` records the completed audit of
23 October 2026. Its builder is `D:/fide/build_complete.py`, with dependencies
`build_yearly.py` and `prepare_supplemental.py` in that directory.

The catalogue was queried read-only on 27 October and agrees with the report:

| Rating type | Lists | Rating rows | Available dates |
| --- | ---: | ---: | --- |
| Standard | 283 | 62,312,616 | 1967-06 through 2026-10 |
| Rapid | 172 | 31,020,723 | 2012-07 through 2026-10 |
| Blitz | 172 | 21,948,433 | 2012-07 through 2026-10 |

This is 115,281,772 rating observations, separate from 5,306,700 registry
records across three registry sources. Another 1,852 files are retained as
original source artifacts. A registry snapshot is not a substitute for dated
ratings. A current registry value must never overwrite an earlier observation.

`rating_lists` stores dates, time controls, counts, hashes, source paths and
metadata. `rating_entries` stores the original 22 columns plus `list_id`.
The `players` compatibility view joins these tables. `registry_sources` and
`registry_players` retain registry data separately. `artifacts` retains raw
or zlib-compressed original files with their hashes. Duplicate source rows,
nulls, zeroes and year-only date precision are preserved.

Read-only spot checks found pre-ID June 1967 rows (including Spassky, Fischer
and Petrosian) and Carlsen's latest standard observations. SQLite's query plan
uses `entries_player` for FIDE-ID history lookup. This inspection did not rerun
the full 22 GiB integrity/hash audit; the existing report records those checks.

```sql
SELECT list_date, rating_type, rating, games, k, name, fed, source_db
FROM players
WHERE fide_id = 1503014
ORDER BY list_date, rating_type;
```

## Coverage and identity

The master spans the available archive, not an independently complete
transcription of every FIDE list ever issued. Historical partial lists remain
partial. Some scans and alternate formats are preserved only as artifacts.
Year-only dates must not be converted into invented months. Rows without FIDE
IDs stay queryable in the archive, but must not be attached to modern players
using names alone. Biographical enrichment belongs in a separate dataset,
joined by an explicit FIDE ID, with sources and photo attribution.

## Recommended next publication step

Use this master rather than create another competing consolidation. Before
publishing it, bring its existing builder, dependencies, tests and schema
documentation under version control in the owning archive repository in a
separate commit. That checkout currently has unrelated modifications; they
were left untouched during this profile change.

Keep the preservation master as the canonical downloadable artifact. A smaller
query-only SQLite distribution can omit the source blobs while retaining
source hashes and metadata. It should be explicitly named as a derived edition,
with rating-row parity checked against the master. The site should continue
loading compact per-player shards rather than download either database.

The master is too large for a single GitHub release asset: GitHub documents a
2 GiB per-file limit. Measure compressed size before choosing packaging. If
needed, publish checksummed parts below that limit with a reassembly tool and
instructions producing one SQLite file. Publish a manifest with schema version,
build revision, date coverage, counts, uncompressed hash and each part's hash.
Verify reassembly and SQLite integrity before exposing a download link. Keep
all existing individual-list download URLs and archive formats available.

For monthly updates, produce a new versioned master from immutable verified
inputs. Reuse validated checkpoints, reject changed inputs, and publish only
after per-list counts, source coverage, integrity, foreign keys and retained
artifact hashes pass. A failed refresh must retain the last good release.
The existing monthly website refresh does not currently rebuild this master.

GitHub release limits:
https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases
