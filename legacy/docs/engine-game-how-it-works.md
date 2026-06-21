# Engine Game Page: Full Under-the-Hood Walkthrough

## Scope
This document explains how the Engine Game page works internally, from UI rendering to engine protocol handling.

Primary page files:
- `play-engine.html`
- `js/play-engine.js`

Supporting files used by this page:
- `js/chess.min.js` (position legality, PGN/history, game termination checks)
- `js/lozza.js` (Lozza engine running in a Web Worker, UCI protocol)
- `css/style.css` (board/piece/toolbar/move-log styles)
- `js/theme.js` (global site theme/accent behavior)

## High-Level Architecture

### 1. UI Layer (HTML + CSS)
`play-engine.html` defines a two-panel layout:
- Left panel: board, coordinate labels, engine status chip, undo/redo, board orientation labels.
- Right panel: move list, PGN operations, engine log, analysis button.

Important DOM nodes:
- Board: `#chessBoard` (`play-engine.html:119`)
- Engine status chip: `#engineStatus` (`play-engine.html:105`)
- Move list: `#moveList` (`play-engine.html:148`)
- Hidden PGN text area: `#pgnText` (`play-engine.html:149`)
- Engine log: `#engineLog` (`play-engine.html:150`)
- Controls: engine side select, move-time slider, new game, flip, load/copy PGN, undo/redo, analyze (`play-engine.html:72-147`)

CSS responsibilities:
- Board geometry and squares: `css/style.css` (`.chess-board`, `.square`, `.light-square`, `.dark-square`)
- Piece sprites: `.piece[data-piece="..."]` mappings to SVGs
- Selection/highlights/targets: `.square.selected`, `.square.highlight`, `.square.target`
- Drag visuals: `.piece.drag-ghost`, `.piece.drag-source`
- Move log and engine info panel styling

### 2. Game State Layer (`js/play-engine.js`)
The script is an IIFE that initializes once DOM is ready.

Core state variables (`js/play-engine.js:27-48`):
- `game`: `new Chess()` object (authoritative legal state)
- `engine`: Worker handle (`new Worker('js/lozza.js')`)
- `engineSide`: `'w'` or `'b'`
- `orientation`: `'white'` or `'black'` board render direction
- `engineReady`, `engineThinking`: worker readiness/activity flags
- `moveTime`: per-move engine think budget (ms)
- `selectedSquare`, `legalTargets`: click/drag selection model
- `activePly`: timeline cursor (current viewed half-move)
- `redoStack`: redo state after undos
- analysis state: `analysisActive`, `analysisIndex`, `analysisPositions`, `analysisResults`, etc.

### 3. Engine Layer (`js/lozza.js` in Worker)
Lozza is not called via direct JS API; it is treated as a UCI endpoint over worker messages.

`play-engine.js` sends commands like:
- `uci`
- `isready`
- `ucinewgame`
- `position startpos moves ...`
- `go movetime <ms>`
- `stop`

Lozza replies with lines such as:
- `uciok`
- `readyok`
- `info depth ... score ... pv ...`
- `bestmove e2e4`

Worker bridge in engine code:
- `onmessage = function(e) { uciExec(e.data); }` (`js/lozza.js:11275-11277`)
- Output dispatch uses `postMessage(...)` via `uciSend(...)` (`js/lozza.js:10757-10773`)

## Initialization Sequence

1. Script loads and exits early if `#chessBoard` is missing (`js/play-engine.js:25`).
2. `init()` runs after DOM ready (`js/play-engine.js:1018-1030`):
   - attaches control listeners (`initControls()`)
   - starts engine worker (`initEngine()`)
   - seeds engine log placeholder text
   - calls `newGame(false)`
   - sets top-level status text
3. `initEngine()` (`js/play-engine.js:974-986`):
   - creates worker `js/lozza.js`
   - wires `onmessage` to `handleEngineMessage`
   - posts `uci`
4. Engine handshake in `handleEngineMessage()` (`js/play-engine.js:774-832`):
   - on `uciok`: send `isready`
   - on `readyok`: set `engineReady = true`, send `ucinewgame`, maybe queue first engine move

## Rendering Model

### Board Rendering
`renderBoard()` (`js/play-engine.js:485`) is a full rebuild renderer:
- Clears board DOM and repopulates all 64 squares every refresh.
- Determines file/rank iteration order from `orientation`.
- Builds a temporary view position with `buildViewGame(activePly)` so you can inspect past plies while preserving canonical `game` state.
- Highlights last move squares (`from` + `to`) in that viewed position.
- Adds piece nodes with `data-piece` (`wP`, `bK`, etc.) for CSS sprite lookup.
- Attaches click and pointer handlers for each piece/square.

Coordinate rails (`a-h`, `1-8`) are rendered in `renderCoords()` and update with orientation.

### Move List Rendering
`renderMoveList()` (`js/play-engine.js:541`):
- Rebuilds all move tags from `game.history({ verbose: true })`.
- Adds a `Start` button for ply `0`.
- Highlights currently viewed ply (`activePly`).
- Appends eval comments (`{+0.23}`, `{-1.10}`, `#{mate}` style) from analysis results when present.

### PGN Rendering
`syncPgn()` (`js/play-engine.js:571`) writes `pgnTextEl.value` using `buildAnnotatedPgn()` (`js/play-engine.js:266`).

The PGN builder:
- Ensures default headers exist (`ensureDefaultHeaders()`)
- Merges defaults with existing game headers
- Serializes ordered standard tags first (`Event/Site/Date/Round/White/Black/Result`)
- Serializes movetext and optional engine-eval comments per ply

## Interaction Model

### Click Moves
`handleSquareClick(square)` (`js/play-engine.js:834`):
- Blocks input if game is over.
- Blocks while viewing historical ply (`activePly != history length`).
- Blocks if engine is thinking and it is engine turn.
- First click selects own movable piece and computes legal targets.
- Second click attempts move via `attemptMove(from, to)`.

### Drag-and-Drop Moves
Drag pipeline functions:
- Start: `beginDrag()` (`js/play-engine.js:399`)
- Move: `handleDragMove()` (`js/play-engine.js:416`)
- End: `handleDragEnd()` (`js/play-engine.js:436`)
- Cancel: `handleDragCancel()` (`js/play-engine.js:464`)

Key mechanics:
- Drag starts only after threshold (`dragThreshold = 6`) to avoid accidental drags.
- A floating cloned piece (`drag-ghost`) tracks pointer.
- Source piece gets reduced opacity (`drag-source`).
- Drop target is derived from `document.elementFromPoint(...)`.
- Invalid drop clears selection and rerenders without changing game state.

## Engine Move Pipeline

### When engine is queued
`maybeQueueEngine()` (`js/play-engine.js:706`) exits unless all are true:
- engine is ready
- game is not over
- user is at latest ply (not browsing history)
- it is engine's turn
- engine is not already thinking

Then it sends:
1. `position startpos moves <uci history>`
2. `go movetime <moveTime>`

### Applying engine reply
When `bestmove ...` arrives in non-analysis mode (`handleEngineMessage`):
- `engineThinking` resets to false
- UCI move is parsed (`from`, `to`, optional promotion)
- move is applied with `game.move(...)` in `applyEngineMove()` (`js/play-engine.js:752`)
- UI refresh and game-end check run

### Human move path
`attemptMove(from, to)` (`js/play-engine.js:723`):
- validates that user is at live ply and it is human turn
- executes `game.move(..., promotion: 'q')` (forced queen promotion on user move)
- clears redo and analysis caches
- refreshes UI
- queues engine if game is still active

## Analysis Mode (Post-Game)

Analysis is explicit and gated:
- Start button enabled only if `engineReady && game.game_over() && history.length > 0` (`updateAnalyzeButton()`, `js/play-engine.js:317`).

Flow:
1. `startAnalysis()` (`js/play-engine.js:643`) validates preconditions.
2. Sends `stop`, then `ucinewgame` to reset engine search context.
3. Builds all incremental positions:
   - Ply 1: `position startpos moves <m1>`
   - Ply 2: `position startpos moves <m1 m2>`
   - ...
4. For each position, `runAnalysisStep()` sends:
   - `position ...`
   - `go movetime <analysisMoveTime>`
5. While searching, incoming `info` lines are parsed; deepest line seen is kept as current result.
6. On each `bestmove`, stored result is committed into `analysisResults[plyIndex]`, then next ply is analyzed.
7. At completion: status chip returns to ready and move tags/PGN now include eval comments.

Stop behavior:
- `stopAnalysis()` sends `stop` and returns UI to non-analysis state.
- Any real game mutation (new move/load/new game) calls `resetAnalysisResults()` to invalidate stale analysis.

## PGN/Timeline Semantics

`activePly` is a "view cursor" independent of canonical game state:
- Canonical game is full latest state in `game`.
- Board view can be historical by reconstructing a temporary `Chess` instance from first `activePly` moves (`buildViewGame`).
- While historical view is active, play attempts are blocked to avoid editing from the middle.

Undo/redo:
- Undo uses `game.undo()` and pushes returned move objects to `redoStack`.
- Redo pops from `redoStack` and replays with `game.move(...)`.
- Any newly played move clears `redoStack`.

## Lozza-Side Details Relevant to This Page

### UCI ingestion in worker
In `js/lozza.js`, `uciExec(...)` handles commands used by this page:
- `isready` -> sends `readyok` (`js/lozza.js:10851-10855`)
- `position ...` -> builds board state (`js/lozza.js:10861-10890`, `js/lozza.js:8805+`)
- `go movetime ...` -> sets `statsMoveTime`, starts search (`js/lozza.js:10895-10950`)
- `ucinewgame` -> hash reset (`ttInit`) (`js/lozza.js:10956-10962`)
- `uci` -> sends id/author and `uciok` (`js/lozza.js:10986-10992`)

### Output lines consumed by page
Lozza sends:
- `info ...` from `report(...)` (`js/lozza.js:1081-1096`)
- final `bestmove ...` from `go(...)` (`js/lozza.js:1199-1202`)

Move encoding:
- `formatMove(move)` emits UCI string `from+to(+promotion)` (`js/lozza.js:10638-10655`).

## Status and UX Feedback

Status channels:
- Main status line (`#statusMessage`): user-oriented action/result feedback.
- Engine chip (`#engineStatus`): readiness/thinking/analysis state.
- Bottom right tool stats (`#toolStats`): compact engine state string.
- Engine log (`#engineLog`): rolling simplified `info` summaries (keeps 12 lines, renders last 8).

## Important Behavioral Constraints

1. Only latest-ply position is playable.
2. User promotions are always queen on manual moves.
3. Engine move generation uses fixed `movetime`; no adaptive time management in UI layer.
4. Analysis mode is only allowed after game end.
5. Analysis data is invalidated whenever game state changes.
6. Engine and UI synchronization assumes strict UCI line protocol over worker messages.

## Practical Debug Map
If something breaks, check in this order:
1. Worker start + handshake: `initEngine()` and `handleEngineMessage()` in `js/play-engine.js`.
2. Outbound commands: `maybeQueueEngine()`, `runAnalysisStep()`.
3. Inbound parsing: `handleEngineMessage()`, `parseInfoLine()`.
4. Move legality/state drift: `game.move(...)`, `buildViewGame(...)`, `activePly` checks.
5. Board interaction and event wiring: `renderBoard()`, drag handlers, `handleSquareClick()`.
6. UI rendering consistency: `refreshUI()` and CSS classes for board pieces/highlights.
