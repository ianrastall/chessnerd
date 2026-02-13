# CCC Archive Page: Under-the-Hood and Workflow

## Scope
This document explains:

1. How the CCC Archive page works at runtime on Chess Nerd.
2. How data is structured across `chessnerd` and `ccc-archive`.
3. A repeatable update workflow for adding/changing events.

It is written from the current local state as of **February 13, 2026**.

## Repos and Responsibilities

### `chessnerd` (site repo)
- Hosts the page UI: `ccc-archive.html`.
- Hosts mirrored metadata files consumed by the page:
  - `ccc_links.txt`
  - `events.txt`
  - `game_counts.txt`
  - `ccc_manifest.json` (currently not consumed by page JS)
- Publishes the route through:
  - `index.html` (tool card registration/routing)
  - `sitemap.xml`

### `ccc-archive` (data repo)
- Stores ZIP archives under year folders (`2018/`, `2019/`, ..., `2025/`).
- Stores metadata files with the same names as above.
- Provides raw GitHub download URLs referenced by `ccc_links.txt`.

## Current Data Snapshot

From current files:
- Entries: **426**
- Year range: **2018-2025**
- Ordering: defined by line order in `ccc_links.txt`
- Mirror status (`chessnerd` vs `ccc-archive`): currently byte-identical for:
  - `ccc_links.txt`
  - `events.txt`
  - `game_counts.txt`
  - `ccc_manifest.json`

## Cross-Repo History Markers

Key commits that explain how this became a two-repo flow:

1. `chessnerd` on **2025-12-16**:
   - `fa355da` added `ccc-archive.html` + initial CCC files.
   - `a20a060` added `game_counts.txt` usage to the page.
2. `ccc-archive` on **2026-01-04**:
   - `5a10963` added archive metadata files (`ccc_links.txt`, `events.txt`, `game_counts.txt`).
   - `2806ccb` removed one event and deleted metadata files (later restored).
3. `ccc-archive` on **2026-01-06**:
   - `f7aff1b` reran the full archive process.
   - `fc2b97c` updated `ccc_links.txt` + `ccc_manifest.json`.
4. `chessnerd` on **2026-01-06**:
   - `ce0f20b` synced new links and added `ccc_manifest.json`.

## Runtime Architecture (Chess Nerd)

### Page shell and UI
- Page: `ccc-archive.html`
- Table/search/pagination controls are all in this single file.
- The note in UI explicitly states the build inputs: `ccc-archive.html:220`.

### Data loading path
The page fetches three local files in parallel:
- `fetch('ccc_links.txt')` at `ccc-archive.html:401`
- `fetch('events.txt')` at `ccc-archive.html:402`
- `fetch('game_counts.txt')` at `ccc-archive.html:403`

Important: runtime JS does **not** currently fetch `ccc_manifest.json`.

### In-memory model
- `allEntries`, `filteredEntries`, `currentPage`, `rowsPerPage`:
  - `ccc-archive.html:251`
  - `ccc-archive.html:252`
  - `ccc-archive.html:253`
  - `ccc-archive.html:254`

### Parsing and normalization
1. Date conversion:
   - `toIsoDate()` converts `YYMMDD -> 20YY-MM-DD`: `ccc-archive.html:258`
2. Event map from `events.txt`:
   - `buildEventMap()`: `ccc-archive.html:273`
3. Game count map from `game_counts.txt`:
   - `buildGameCountMap()`: `ccc-archive.html:288`
4. Entry construction from URLs:
   - `buildEntries()`: `ccc-archive.html:305`

### Rendering and interactions
- Pagination/render core: `renderPage()` at `ccc-archive.html:341`
- Search/filter: `applyFilter()` at `ccc-archive.html:388`
- Full async load flow: `loadCCCArchive()` at `ccc-archive.html:397`
- Error state writes exception text directly into table body: `ccc-archive.html:425`

## Data Contracts

### `ccc_links.txt`
- One raw GitHub ZIP URL per line.
- Filename convention assumed by parser:
  - `<start>-<end>-<slug>.zip`
  - `start` and `end` expected as 6-digit `YYMMDD`.
- Ordering is preserved and drives display order (no date sorting step).

### `events.txt`
- Format per line:
  - `<basename>.pgn: <event display name>`
- Only the first `:` is treated as separator (`indexOf(':')` parsing).

### `game_counts.txt`
- Format per line:
  - `<basename>.pgn: <integer>`
- Parser takes the first whitespace-delimited token after `:` and `parseInt`s it.

### `ccc_manifest.json`
- Object fields currently present:
  - `pgn`, `zip`, `year`, `start`, `end`, `event`, `games`, `url`, `sha256`
- Current frontend page does not use this file, but it is useful for:
  - consistency checks
  - future migration to single-source metadata loading

## Site Integration Points

- Tool card registration in homepage list:
  - `index.html:98` (`id: 'ccc-archive'`)
- Tool card route convention:
  - `index.html:198` (`card.href = \`${tool.id}.html\`;`)
- Sitemap entry:
  - `sitemap.xml:29` (`https://chessnerd.net/ccc-archive.html`)

## Two-Repo Workflow (Repeatable)

This is the practical workflow to keep both repos aligned.

### Automated path with raw staging (recommended)

Run from `chessnerd`:

```powershell
python docs/rebuild_ccc_archive_metadata.py
```

What it does:
1. Scans raw PGNs in `../ccc-archive/raw` (default behavior).
2. For each raw PGN, derives canonical archive names:
   - ZIP: `YYMMDD-YYMMDD-slug.zip`
   - Internal PGN: `YYMMDD-YYMMDD-slug.pgn`
   - Dates come from `GameStartTime` / `GameEndTime` (fallback `Date` tags).
3. Writes ZIPs into `../ccc-archive/<year>/` where `year = 20YY`.
4. Moves ingested raw PGNs to `../ccc-archive/raw/processed` by default.
5. Scans `../ccc-archive/<year>/*.zip`.
6. Parses each ZIP's PGN headers to derive:
   - event name (first `[Event "..."]`)
   - game count (number of `[Event "..."]` tags)
7. Rebuilds in `ccc-archive`:
   - `ccc_links.txt`
   - `events.txt`
   - `game_counts.txt`
   - `ccc_manifest.json`
8. Syncs those four files into `chessnerd` root.

Validation-only mode:
```powershell
python docs/rebuild_ccc_archive_metadata.py --check
```

Rare override options:
- Skip raw ingest for one run:
  ```powershell
  python docs/rebuild_ccc_archive_metadata.py --no-ingest-raw
  ```
- Skip chessnerd sync for one run:
  ```powershell
  python docs/rebuild_ccc_archive_metadata.py --no-sync-chessnerd
  ```
- Keep raw files in place (no move to `raw/processed`):
  ```powershell
  python docs/rebuild_ccc_archive_metadata.py --raw-archive-mode keep
  ```
- Use a different raw folder:
  ```powershell
  python docs/rebuild_ccc_archive_metadata.py --raw-root D:\path\to\raw
  ```
- Replace an already-existing target ZIP:
  ```powershell
  python docs/rebuild_ccc_archive_metadata.py --overwrite-existing-zips
  ```

SHA behavior:
- Default: preserves existing `sha256` fields when present in manifest (stable/no churn).
- Optional full SHA refresh:
  ```powershell
  python docs/rebuild_ccc_archive_metadata.py --recompute-sha256
  ```

### Phase 1: Stage new raw files in `ccc-archive`

1. Place incoming PGNs into `..\ccc-archive\raw\`.
2. Run:
   ```powershell
   python docs/rebuild_ccc_archive_metadata.py
   ```
3. Review generated ZIPs under `..\ccc-archive\<year>\`.
4. Confirm metadata regenerated in `ccc-archive`:
   - `ccc_links.txt`
   - `events.txt`
   - `game_counts.txt`
   - `ccc_manifest.json`

### Phase 2: Sync metadata into `chessnerd`

1. Verify mirror hashes match (script syncs automatically by default):
   ```powershell
   Get-FileHash .\ccc_links.txt -Algorithm SHA256
   Get-FileHash ..\ccc-archive\ccc_links.txt -Algorithm SHA256
   ```
2. Commit + push `ccc-archive`.
3. Commit + push `chessnerd`.

### Phase 3: Smoke test page behavior

1. Serve `chessnerd` locally (or use deployed preview).
2. Open `ccc-archive.html`.
3. Confirm:
   - status transitions to `Ready`
   - row count matches expected total
   - search works
   - pagination works
   - latest event appears and downloads correctly

## Known Pitfalls

1. Ordering surprises:
   - Table order is input-file order, not sorted by start date.
2. Date assumptions:
   - JS assumes 6-digit dates map to `20YY-*` (`ccc-archive.html:258`).
3. Silent metadata drift risk:
   - Page does not consume manifest; `manifest` can drift without visible UI break.
4. Format fragility:
   - `events.txt` and `game_counts.txt` rely on simple `:` split logic.
5. Cross-repo drift:
   - If only one repo is updated, site and source archive can diverge.

## Practical Recommendation

Use `ccc-archive` as the canonical ingest/build target with a local raw staging area (`raw` + `raw/processed`), then sync metadata into `chessnerd` as the second step. This keeps your workflow to two repos (`chessnerd`, `ccc-archive`) and removes the third workspace (`D:\chessnerd\ccc`) while preserving the current frontend design.

## LLM Context Dump Tool

Use this helper in `chessnerd`:
- `docs/build_ccc_archive_context_dump.py`
- `docs/rebuild_ccc_archive_metadata.py`

Default run:
```powershell
python docs/build_ccc_archive_context_dump.py
```

Default output:
- `docs/ccc-archive-context.txt`

Behavior:
- Includes full CCC page/data files.
- Includes selected partial shared-file sections (routing, sitemap, shared CSS).
- Checks mirror integrity against sibling `../ccc-archive`.
- Skips duplicate mirrored full files by default when they are byte-identical.
