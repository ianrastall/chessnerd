# Chess.com Titled Players Page: Under-the-Hood and Workflow

## Scope
This document explains:

1. How the Titled Players page works at runtime.
2. How `titled-players.json` is generated.
3. What the likely historical workflow was.
4. A repeatable current workflow for updates.

It is based on the local repository state as of **February 13, 2026**.

## Files and Responsibilities

### Page/UI
- `titled-players.html`
  - Loads the JSON database.
  - Applies client-side filters/sorting.
  - Renders and paginates the table.
  - Exports filtered rows to clipboard (TSV).

### Data build
- `titled-players.py`
  - Calls Chess.com PubAPI endpoints.
  - Builds/updates `titled-players.json`.
  - Supports resume behavior by reusing existing JSON.

### Data file
- `titled-players.json`
  - Flat array of player objects consumed directly by the page.

### Site integration
- `index.html` (tool registration/card)
- `sitemap.xml` (public route entry)

## Current Data Snapshot

From current `titled-players.json`:
- Entries: **15,570**
- Distinct titles: **10** (`GM`, `WGM`, `IM`, `WIM`, `FM`, `WFM`, `NM`, `WNM`, `CM`, `WCM`)
- Distinct countries: **230**
- Status counts: **15,564 active**, **6 inactive**

Schema keys per row:
- `username`
- `name`
- `avatar`
- `country`
- `rapid`
- `blitz`
- `bullet`
- `status`
- `title`

## Runtime Architecture (`titled-players.html`)

### Data load
- Fetches `titled-players.json` once on page load.
- On success, stores dataset in memory (`allPlayers`) and applies filters.
- On failure, shows an error in `#countDisplay`.

### In-memory state
- `allPlayers`: full database
- `filteredPlayers`: active filtered/sorted subset
- `displayLimit`: current render limit (starts at 100)
- `BATCH_SIZE`: 100 rows per "Show More"

### Filters/sort
Inputs:
- Title checkboxes (10 title types)
- Rating type (`rapid` / `blitz` / `bullet`)
- Minimum Elo (default 2500)
- Country code filter (2-letter uppercase exact match)

Behavior:
- Filters happen fully client-side.
- Sort order is descending by selected rating field.
- "Show More" increases rendered rows by 100.

### Export
- `copyList()` writes filtered rows as TSV for Excel-compatible paste.
- Columns exported:
  - Username
  - Name
  - Title
  - Country
  - Rating (selected type)
  - Status
  - Profile Link
  - Avatar URL

## Build Script Behavior (`titled-players.py`)

## External API inputs
For each title in:
- `GM`, `WGM`, `IM`, `WIM`, `FM`, `WFM`, `NM`, `WNM`, `CM`, `WCM`

Script calls:
1. `https://api.chess.com/pub/titled/{title}` (username list)
2. `https://api.chess.com/pub/player/{username}/stats`
3. `https://api.chess.com/pub/player/{username}`

## Request handling
- `safe_request()` retries up to 3 times.
- On `429`, sleeps 10 seconds.
- On request exception, sleeps 2 seconds.
- Per-user pacing: `time.sleep(0.15)`.

## Record construction
Defaults:
- `name = ""`
- `avatar = ""`
- `country = "??"`
- ratings default to `0`
- `status = "inactive"`

Profile mapping:
- `country` from trailing segment of `profile.country` URL.
- `status` is mapped to `active` only for:
  - `basic`, `premium`, `staff`, `gold`, `platinum`, `diamond`
  - everything else -> `inactive`

## Resume/incremental semantics
Script logic:
1. If `titled-players.json` exists, load it and build `processed_usernames`.
2. Fetch titled username lists.
3. Only fetch details for usernames not already in `processed_usernames`.
4. Append new records.
5. Save JSON.

Important consequence:
- Existing rows are **not refreshed** during normal runs.
- Ratings/profile values can become stale unless you do a full rebuild.
- Players no longer in titled lists are not removed by incremental runs.

## Save behavior
- Writes progress every 500 processed users.
- Final save at end.
- Output is compact JSON (no pretty indentation).

## Reconstructed Workflow (Current + Legacy)

## Likely current workflow (inferred from code and commits)
1. Run `python titled-players.py` from repo root.
2. Script updates/extends `titled-players.json`.
3. Open `titled-players.html` and smoke-test filters/results.
4. Commit updated JSON (and any page changes).

## Legacy clue
A now-deleted script (`examine.py`, removed Jan 1, 2026) referenced:
- `D:\chessnerd\players.db`
- tables: `players`, `aliases`

This suggests an earlier external SQLite workflow before the current flat JSON-only path stabilized.

## Git History Markers

Notable commits:
1. **2025-12-07** `7b97dc0`
   - Added titled player database UI and initial JSON (`titled_players.json`).
2. **2025-12-08** `1874e46`
   - Renamed to `titled-players.json`.
   - Added `titled-players.py` generator.
3. **2026-01-04** `f4483fa`
   - JSON data refresh.
4. **2026-01-05** `66df300`
   - JSON data refresh.

## Repeatable Update Workflows

## A) Incremental update (fastest, may leave stale existing rows)
```powershell
python titled-players.py
```

Use when:
- You mainly want newly added titled accounts.
- You accept stale existing ratings/profile data.

## B) Full refresh (slowest, highest fidelity)
```powershell
Remove-Item .\titled-players.json
python titled-players.py
```

Use when:
- You want current ratings/profile values for all titled players.
- You want dropped titles/accounts naturally pruned by fresh source lists.

## C) Smoke test before commit
1. Open `titled-players.html`.
2. Confirm row count loads.
3. Test filters:
   - title toggles
   - rating type changes
   - min Elo
   - country code
4. Test "Show More".
5. Test clipboard export.

## Known Risks and Drift Points

1. Incremental staleness:
   - existing rows are not refreshed unless full rebuild.
2. Removal drift:
   - users no longer present in titled endpoints remain until full rebuild.
3. Status mapping is opinionated:
   - only select profile statuses count as active.
4. Rate-limit resilience is basic:
   - simple retry/sleep strategy only.
5. Large JSON client payload:
   - all filtering happens in browser after full-file download.

## Practical Recommendation

Use a two-mode policy:
1. Daily/quick: incremental run.
2. Periodic (for accuracy): full rebuild run.

That preserves speed while preventing long-term data drift.

## LLM Context Dump

Use:
- `docs/build_titled_players_context_dump.ps1`

Default:
```powershell
powershell -ExecutionPolicy Bypass -File .\docs\build_titled_players_context_dump.ps1
```

Default output:
- `docs/titled-players-context.txt`
