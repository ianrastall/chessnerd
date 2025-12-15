# WPF .NET 8 Desktop Plan (fresh start)

Goal: Build a standalone WPF (.NET 8, C#) desktop app (single EXE distribution) that lets a user pick and solve Lichess puzzles by rating/theme, verify their moves, and then view the full source game movelist. No reliance on the existing web asset layout; data is prepackaged for desktop use (no CORS). Source data is the official Lichess puzzles CSV (last updated 2025-12-03) plus a moves database for source games.

## Source data (Lichess puzzles CSV)
- Fields: `PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags`.
- Moves: UCI tokens. The first move is the opponent move from the given FEN; the second move starts the solution. Convert to SAN for display. Player moves are “only moves”; mates in one may have multiple options.
- FEN: position before the opponent move; the position shown to the user is after applying the first move.
- Themes: space- or comma-separated tags.
- GameUrl: points to the source game and ply (e.g., `...#<ply>`).
- OpeningTags: optional; only set when the game starts before move 20.

## Recommended data format (desktop-friendly)
- Use SQLite (or LiteDB if preferred) to hold both puzzles and game movelists:
  - `Puzzles(id TEXT PRIMARY KEY, fen TEXT, rating INT, ratingDev INT, themes TEXT, bestMoves TEXT, pvMoves TEXT, popularity INT, plays INT, gameUrl TEXT, openingTags TEXT, movesCsv TEXT)`
  - `Games(id TEXT PRIMARY KEY, moves BLOB)` where `moves` is a compressed JSON array or MessagePack of UCI moves.
  - Index `Puzzles(rating)` for fast rating-range queries. For faster theme queries, either store themes as CSV and filter client-side or normalize to a join table.
- Bucketization: optional. If the DB is large, ship one DB per 100-point rating band; else a single DB file.
- Compression: SQLite page compression or gzipped blobs for `moves` if size is high.
- Provenance: keep a checksum or raw CSV line if you want traceability.

## Conversion pipeline (one-time, offline)
1) Parse the puzzles CSV:
   - `id` = PuzzleId
   - `fen` = FEN
   - `movesCsv` = Moves (UCI list split on space or comma)
   - `rating`, `ratingDev`, `popularity`, `plays` = NbPlays
   - `themes` = Themes split on space or comma
   - `gameUrl`, `openingTags`
   - Derive `pvMoves` from `movesCsv`: the solution line is moves from index 1 onward; index 0 is the opponent move applied to reach the displayed position.
   - `bestMoves` can mirror `pvMoves` unless you later add specific best-move tagging.
2) Parse JSONL game movelists (from your builder): `{ "id": "...", "moves": ["e2e4", ...] }`.
3) Write to SQLite:
   - Insert into `Puzzles` per CSV row.
   - Insert into `Games` with moves stored as JSON or MessagePack (optionally gzipped).
4) Optionally split into per-100 rating band DB files.

### Conversion helper (Python sketch)
```python
import sqlite3, json, gzip

def pack_moves(moves, compress=True):
    raw = json.dumps(moves).encode("utf-8")
    return gzip.compress(raw) if compress else raw

conn = sqlite3.connect("lichess.db")
c = conn.cursor()
c.executescript("""
CREATE TABLE IF NOT EXISTS Puzzles (
  id TEXT PRIMARY KEY,
  fen TEXT,
  rating INT,
  ratingDev INT,
  themes TEXT,
  bestMoves TEXT,
  pvMoves TEXT,
  popularity INT,
  plays INT,
  gameUrl TEXT,
  openingTags TEXT,
  movesCsv TEXT
);
CREATE TABLE IF NOT EXISTS Games (
  id TEXT PRIMARY KEY,
  moves BLOB
);
CREATE INDEX IF NOT EXISTS idx_puzzles_rating ON Puzzles(rating);
""")
# Insert rows from parsed CSV and JSONL here...
conn.commit()
conn.close()
```

## App architecture (MVVM)
- Models: `Puzzle`, `GameMoves`, `Settings`.
- Services:
  - `PuzzleStore` (SQLite reader): query by rating/theme, return random puzzle.
  - `GameStore`: fetch moves by gameId (lazy load).
  - `RateLimiter`: only if you add live fetching later.
  - `SettingsStore`: `%APPDATA%/ChessNerd/config.json`.
  - `Logger`: Serilog to rolling file.
- ViewModels: `MainViewModel`, `SettingsViewModel`.
- Views: `MainWindow`, `SettingsDialog`.
- Themes: `Themes/Dark.xaml` (default), optional `Light.xaml`.

## UI/UX (dark mode first)
- Controls: rating picker (exact or range), theme dropdown, “Load puzzle”, “Next random”, Undo/Redo, Reset, Show solution preview, “View full game”.
- Status: board status text, move counts, result messages.
- Movelist: clickable move tags; after completion, swap to full-game movelist and highlight the puzzle segment.
- Log pane: recent events; button to open log folder.
- Layout: left controls, center board, right movelist/log, bottom actions.

## Data flow (runtime)
1) User selects rating (and optional theme).
2) App queries `Puzzles` for that rating (and theme), picks a random puzzle.
3) Apply the first UCI move to the FEN to set the displayed position; solution line uses `pvMoves` (or `bestMoves` fallback).
4) User plays; validate against solution; auto-play opponent moves.
5) On completion, resolve `gameUrl` to `gameId`, load moves from `Games`, convert to SAN, highlight the puzzle segment, render full movelist (clickable).

## API handling (if adding online fetch)
- Headers: `Accept: application/x-chess-pgn`; `Authorization: Bearer <token>` for authenticated calls.
- Bulk endpoint: `POST /api/games/export/_ids` with `Content-Type: text/plain`, params `moves=true&clocks=false&evals=false&opening=false`.
- Single: `GET /game/export/{id}` with same params.
- Rate limit: throttle to configured RPS (e.g., 15/s); wait 30s on HTTP 429; retry up to 3 with backoff.
- For a packaged desktop app, prefer prebuilt data; live fetch is optional.

## Scaffolding (PowerShell)
Run from repo root; adjust names as needed.
```powershell
$project = "ChessNerd.Desktop"
$solution = "ChessNerd.sln"

dotnet new sln -n $solution
dotnet new wpf -n $project -f net8.0
dotnet sln $solution add "$project/$project.csproj"

dotnet add "$project/$project.csproj" package CommunityToolkit.Mvvm
dotnet add "$project/$project.csproj" package Newtonsoft.Json
dotnet add "$project/$project.csproj" package Serilog
dotnet add "$project/$project.csproj" package Serilog.Sinks.File
dotnet add "$project/$project.csproj" package System.Data.SQLite.Core # or LiteDB if preferred

"Models","Services","ViewModels","Themes","Views","Assets","Logs" | ForEach-Object {
    New-Item -ItemType Directory -Path "$project/$_" -Force | Out-Null
}
```
Enable nullable in csproj:
```xml
<PropertyGroup>
  <TargetFramework>net8.0-windows</TargetFramework>
  <Nullable>enable</Nullable>
  <ImplicitUsings>enable</ImplicitUsings>
  <UseWPF>true</UseWPF>
</PropertyGroup>
```

## Scaffolding (Python, files only)
```python
import os
project = "ChessNerd.Desktop"
folders = ["Models","Services","ViewModels","Themes","Views","Assets","Logs"]
for f in folders:
    os.makedirs(os.path.join(project, f), exist_ok=True)

stubs = {
    "Services/PuzzleStore.cs": "// TODO: SQLite query by rating/theme\n",
    "Services/GameStore.cs": "// TODO: SQLite lookup gameId -> moves\n",
    "Services/RateLimiter.cs": "// TODO: if online fetch is added\n",
    "Services/SettingsStore.cs": "// TODO: read/write %APPDATA%/ChessNerd/config.json\n",
    "ViewModels/MainViewModel.cs": "// TODO: MVVM Toolkit props + commands\n",
    "Views/MainWindow.xaml": "<Window xmlns=\"http://schemas.microsoft.com/winfx/2006/xaml/presentation\"></Window>\n",
    "Themes/Dark.xaml": "<ResourceDictionary><!-- TODO: brushes --></ResourceDictionary>\n",
}
for rel, content in stubs.items():
    full = os.path.join(project, rel)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    if not os.path.exists(full):
        with open(full, "w", encoding="utf-8") as f:
            f.write(content)
```

## Service responsibilities (desktop, offline-first)
- PuzzleStore: open SQLite, query by rating (and theme), return random puzzle; lightweight reader, no EF needed.
- GameStore: open SQLite, fetch moves blob by gameId, decompress/deserialize to UCI list.
- LichessClient (optional): bulk/single fetch with rate limiting if you add live updates.
- RateLimiter: sliding window/token bucket; only used if live fetch is on.
- Converter tool: turn CSV + JSONL into SQLite bundle(s).

## Minimal dark theme palette (for Themes/Dark.xaml)
- Background: #111111
- Surface: #1A1A1A
- SurfaceAlt: #222222
- Border: #2E2E2E
- Text: #E8E8E8
- SubtleText: #B0B0B0
- Primary: #16A085
- PrimaryHover: #1EC89A
- AccentWarn: #E67E22
- AccentError: #E74C3C

## Testing
- Unit: PuzzleStore queries (rating/theme filters), GameStore decode, UCI->SAN conversion, rate limiter (if used).
- Integration: end-to-end load of a puzzle, solve it, then render full game movelist from Games table.
- Manual: try multiple ratings and themes; ensure random selection and full-game lookup behave.

## Distribution
- Publish self-contained: `dotnet publish -c Release -r win-x64 --self-contained true`.
- Bundle DB file(s) beside the EXE (or in an installer via MSIX/WiX). Keep paths configurable in settings.
