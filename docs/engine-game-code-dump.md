# Engine Game Code Dump

This dump contains all full files dedicated to the Engine Game page, plus targeted sections from shared files that implement the board/Lozza interface.

## Full File: `play-engine.html`

```html
<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
    <!-- Google tag (gtag.js) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-XQ7B0Z9FK3"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());

      gtag('config', 'G-XQ7B0Z9FK3');
    </script>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Engine Game - Chess Nerd</title>
    <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <div class="container">
        <header>
            <div class="logo">
                <a href="index.html" style="color: inherit; text-decoration: none;">
                    <span>Chess Nerd</span>
                </a>
            </div>
            <nav class="site-network" aria-label="Network sites">
                <a href="https://text-utils.net" class="site-network-link" target="_blank" rel="noopener noreferrer">
                    <img src="img/text-utils-icon.png" class="site-network-icon" alt="" width="16" height="16">
                    <span>Text Utilities</span>
                    <span class="material-icons" aria-hidden="true">open_in_new</span>
                </a>
                <a href="https://github.com/ianrastall/chessnerd" class="site-network-link" target="_blank" rel="noopener noreferrer">
                    <img src="img/github.png" class="site-network-icon" alt="" width="16" height="16">
                    <span>GitHub</span>
                    <span class="material-icons" aria-hidden="true">open_in_new</span>
                </a>
            </nav>
            <div class="controls">
                <div class="accent-selector">
                    <span class="material-icons">palette</span>
                    <select id="accentColor" class="color-dropdown"></select>
                </div>
                <button id="themeToggle" class="btn btn-secondary">
                    <span class="material-icons">dark_mode</span>
                </button>
            </div>
        </header>

        <main>
            <div id="toolView">
                <div class="tool-header">
                    <div class="tool-title">
                        <span class="material-icons" id="toolIcon">smart_toy</span>
                        <h2 id="toolName">Engine Game</h2>
                    </div>
                    <div class="tool-actions">
                        <button id="backButton" class="btn btn-secondary">
                            <span class="material-icons">arrow_back</span>
                            Back
                        </button>
                    </div>
                </div>

                <div class="tool-description">
                    Play a quick game against the Lozza JavaScript engine. Click or drag pieces to move, follow the PGN on the right, and click any move to jump the board to that position.
                </div>

                <div class="options-panel">
                    <div class="options-grid">
                        <div class="option-group">
                            <label for="engineColor">Engine side</label>
                            <select id="engineColor">
                                <option value="b">Black (you start as White)</option>
                                <option value="w">White (you start as Black)</option>
                            </select>
                        </div>
                        <div class="option-group">
                            <label for="moveTime">Engine think time</label>
                            <input type="range" id="moveTime" min="200" max="3000" step="100" value="1500">
                            <span class="stats" id="moveTimeLabel">1.5s</span>
                        </div>
                        <div class="option-group">
                            <label>Board actions</label>
                            <div class="pgn-actions">
                                <button id="newGameBtn" class="btn btn-secondary btn-compact">
                                    <span class="material-icons" style="font-size: 1rem;">refresh</span> New Game
                                </button>
                                <button id="flipBoardBtn" class="btn btn-secondary btn-compact">
                                    <span class="material-icons" style="font-size: 1rem;">flip_camera_android</span> Flip Board
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="io-container engine-grid">
                    <div class="io-panel">
                        <div class="io-label">
                            <span>Board</span>
                            <span class="stats" id="boardStats">White to move</span>
                        </div>
                        <div class="board-wrapper">
                            <div class="board-toolbar">
                                <div id="engineStatus" class="engine-chip warning">Lozza warming up...</div>
                                <div class="board-buttons">
                                    <button id="undoBtn" class="btn btn-secondary btn-compact">
                                        <span class="material-icons" style="font-size: 1rem;">undo</span> Undo
                                    </button>
                                    <button id="redoBtn" class="btn btn-secondary btn-compact">
                                        <span class="material-icons" style="font-size: 1rem;">redo</span> Redo
                                    </button>
                                </div>
                            </div>
                            <div class="board-shell">
                                <div class="board-files" id="filesTop"></div>
                                <div class="board-mid">
                                    <div class="board-ranks" id="ranksLeft"></div>
                                    <div id="chessBoard" class="chess-board" data-orientation="white"></div>
                                    <div class="board-ranks" id="ranksRight"></div>
                                </div>
                                <div class="board-files" id="filesBottom"></div>
                            </div>
                            <div class="board-footer">
                                <div id="playerSide" class="color-pill">You: White</div>
                                <div id="engineSideLabel" class="color-pill engine">Lozza: Black</div>
                            </div>
                        </div>
                    </div>
                    <div class="io-panel">
                        <div class="io-label">
                            <span>Moves & Log</span>
                            <span class="stats" id="moveStats">0 moves</span>
                        </div>
                        <div class="pgn-panel">
                            <div class="pgn-actions">
                                <button id="loadPgnBtn" class="btn btn-secondary btn-compact">
                                    <span class="material-icons" style="font-size: 1rem;">file_upload</span> Load PGN
                                </button>
                                <button id="copyPgnBtn" class="btn btn-secondary btn-compact">
                                    <span class="material-icons" style="font-size: 1rem;">content_copy</span> Copy PGN
                                </button>
                                <button id="analyzeGameBtn" class="btn btn-secondary btn-compact" disabled>
                                    <span class="material-icons" style="font-size: 1rem;">analytics</span>
                                    <span class="btn-label">Analyze Game</span>
                                </button>
                            </div>
                            <div id="moveList" class="move-list"></div>
                            <textarea id="pgnText" class="output visually-hidden" readonly aria-hidden="true" tabindex="-1"></textarea>
                            <div class="engine-log" id="engineLog"></div>
                        </div>
                    </div>
                </div>

                <div class="status-bar">
                    <div id="statusMessage" class="success">Initializing Lozza...</div>
                    <div id="toolStats"></div>
                </div>
            </div>
        </main>

        <footer class="site-footer">
            <p>&copy; Ian Rastall 2025<br>Contact: moving.form.of.dust@gmail.com<br>Donate: PayPal to merastall@gmail.com</p>
        </footer>
    </div>

    <script src="js/theme.js"></script>
    <script src="js/chess.min.js"></script>
    <script src="js/play-engine.js"></script>
</body>
</html>

```

## Full File: `js/play-engine.js`

```javascript
(function() {
    'use strict';

    const boardEl = document.getElementById('chessBoard');
    const filesTopEl = document.getElementById('filesTop');
    const filesBottomEl = document.getElementById('filesBottom');
    const ranksLeftEl = document.getElementById('ranksLeft');
    const ranksRightEl = document.getElementById('ranksRight');
    const moveListEl = document.getElementById('moveList');
    const pgnTextEl = document.getElementById('pgnText');
    const moveStatsEl = document.getElementById('moveStats');
    const boardStatsEl = document.getElementById('boardStats');
    const statusMessage = document.getElementById('statusMessage');
    const toolStats = document.getElementById('toolStats');
    const engineStatusEl = document.getElementById('engineStatus');
    const moveTimeInput = document.getElementById('moveTime');
    const moveTimeLabel = document.getElementById('moveTimeLabel');
    const engineColorSelect = document.getElementById('engineColor');
    const playerSideLabel = document.getElementById('playerSide');
    const engineSideLabel = document.getElementById('engineSideLabel');
    const engineLogEl = document.getElementById('engineLog');
    const analyzeGameBtn = document.getElementById('analyzeGameBtn');
    const dragThreshold = 6;

    if (!boardEl) return;

    let game = new Chess();
    let engine;
    let engineSide = 'b';
    let orientation = 'white';
    let engineReady = false;
    let engineThinking = false;
    let moveTime = parseInt(moveTimeInput?.value || '1500', 10);
    let selectedSquare = null;
    let legalTargets = [];
    let activePly = 0;
    let redoStack = [];
    let engineLines = [];
    let gameDateTag = formatDateTag(new Date());
    let analysisActive = false;
    let analysisIndex = 0;
    let analysisTotal = 0;
    let analysisPositions = [];
    let analysisResults = [];
    let analysisCurrent = null;
    let analysisMoveTime = 0;
    let dragState = null;
    let suppressPieceClick = false;

    function setStatus(msg, type = 'success') {
        statusMessage.textContent = msg;
        statusMessage.className = type;
    }

    function updateEngineStatus(text, mode = '') {
        engineStatusEl.textContent = text;
        engineStatusEl.className = `engine-chip ${mode}`.trim();
    }

    function getUciMoves() {
        return game.history({ verbose: true }).map((m) => m.from + m.to + (m.promotion ? m.promotion : ''));
    }

    function renderEngineLog() {
        engineLogEl.innerHTML = '';
        engineLines.slice(-8).forEach((line) => {
            const div = document.createElement('div');
            div.className = 'engine-log-entry';
            div.textContent = line;
            engineLogEl.appendChild(div);
        });
    }

    function pushEngineLine(line) {
        engineLines.push(line);
        if (engineLines.length > 12) {
            engineLines = engineLines.slice(-12);
        }
        renderEngineLog();
    }

    function describeInfo(line) {
        const depth = (line.match(/\bdepth\s+(\d+)/) || [])[1];
        const nodes = (line.match(/\bnodes\s+(\d+)/) || [])[1];
        const nps = (line.match(/\bnps\s+(\d+)/) || [])[1];
        const score = line.match(/\bscore\s+(cp|mate)\s+(-?\d+)/);
        const pv = (line.match(/\bpv\s+(.+)/) || [])[1];

        const parts = [];
        if (depth) parts.push(`d${depth}`);
        if (score) {
            const type = score[1];
            const raw = parseInt(score[2], 10);
            const pretty = type === 'cp' ? (raw / 100).toFixed(2) : `#${raw}`;
            parts.push(`eval ${pretty}`);
        }
        if (nodes) parts.push(`${Number(nodes).toLocaleString()} nodes`);
        if (nps) parts.push(`${Number(nps).toLocaleString()} nps`);
        if (pv) {
            const shortened = pv.split(' ').slice(0, 6).join(' ');
            parts.push(shortened);
        }
        return parts.length ? parts.join(' | ') : line;
    }

    function parseInfoLine(line) {
        const score = line.match(/\bscore\s+(cp|mate)\s+(-?\d+)/);
        if (!score) return null;
        const depth = (line.match(/\bdepth\s+(\d+)/) || [])[1];
        const pv = (line.match(/\bpv\s+(.+)/) || [])[1];
        return {
            scoreType: score[1],
            scoreValue: parseInt(score[2], 10),
            depth: depth ? parseInt(depth, 10) : null,
            pv: pv || null
        };
    }

    function normalizeEval(result, ply) {
        if (!result || !result.scoreType) return null;
        const sideToMove = ply % 2 === 0 ? 'w' : 'b';
        const sign = sideToMove === 'b' ? -1 : 1;
        return {
            type: result.scoreType,
            value: result.scoreValue * sign
        };
    }

    function formatEvalValue(result, ply) {
        const normalized = normalizeEval(result, ply);
        if (!normalized) return null;
        if (normalized.type === 'mate') {
            return `#${normalized.value}`;
        }
        const value = normalized.value / 100;
        const sign = value > 0 ? '+' : '';
        return `${sign}${value.toFixed(2)}`;
    }

    function formatEvalComment(result, ply) {
        const evalText = formatEvalValue(result, ply);
        return evalText ? `{${evalText}}` : null;
    }

    function formatAnalysisTitle(result, ply) {
        if (!result || !result.scoreType) return '';
        const parts = [];
        const evalText = formatEvalValue(result, ply);
        if (evalText) parts.push(`Eval ${evalText}`);
        if (result.depth) parts.push(`Depth ${result.depth}`);
        if (result.pv) parts.push(`PV ${result.pv}`);
        return parts.join(' | ');
    }

    function formatDateTag(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}.${month}.${day}`;
    }

    function computeResultTag() {
        if (!game.game_over()) return '*';
        if (game.in_checkmate()) {
            return game.turn() === 'w' ? '0-1' : '1-0';
        }
        if (game.in_draw() || game.in_stalemate() || game.insufficient_material() || game.in_threefold_repetition()) {
            return '1/2-1/2';
        }
        return '*';
    }

    function ensureDefaultHeaders() {
        const headers = game.header();
        const defaults = {
            Event: 'Casual Game',
            Site: 'Chess Nerd',
            Date: gameDateTag,
            Round: '-',
            White: engineSide === 'w' ? 'Lozza' : 'You',
            Black: engineSide === 'w' ? 'You' : 'Lozza',
            Result: '*'
        };

        Object.keys(defaults).forEach((key) => {
            if (!headers[key]) {
                game.header(key, defaults[key]);
            }
        });

        if (game.game_over()) {
            game.header('Result', computeResultTag());
        }
    }

    function buildHeaderMap() {
        const headers = game.header();
        const defaults = {
            Event: 'Casual Game',
            Site: 'Chess Nerd',
            Date: gameDateTag,
            Round: '-',
            White: engineSide === 'w' ? 'Lozza' : 'You',
            Black: engineSide === 'w' ? 'You' : 'Lozza',
            Result: computeResultTag()
        };
        const merged = { ...defaults };

        Object.keys(headers).forEach((key) => {
            const value = headers[key];
            if (value) {
                merged[key] = value;
            }
        });

        if (!merged.Result) {
            merged.Result = computeResultTag();
        } else if (game.game_over()) {
            merged.Result = computeResultTag();
        }

        return merged;
    }

    function buildPgnHeaders(headerMap) {
        const order = ['Event', 'Site', 'Date', 'Round', 'White', 'Black', 'Result'];
        const used = new Set();
        const lines = [];

        order.forEach((key) => {
            if (!headerMap[key]) return;
            lines.push(`[${key} "${headerMap[key]}"]`);
            used.add(key);
        });

        Object.keys(headerMap).sort().forEach((key) => {
            if (used.has(key) || !headerMap[key]) return;
            lines.push(`[${key} "${headerMap[key]}"]`);
        });

        return lines.join('\n');
    }

    function buildAnnotatedMovetext(history, resultTag) {
        const tokens = [];

        history.forEach((move, idx) => {
            const ply = idx + 1;
            const moveNum = Math.floor(idx / 2) + 1;
            if (move.color === 'w') {
                tokens.push(`${moveNum}.`);
            } else if (idx === 0) {
                tokens.push(`${moveNum}...`);
            }

            let san = move.san;
            const comment = formatEvalComment(analysisResults[ply - 1], ply);
            if (comment) san += ` ${comment}`;
            tokens.push(san);
        });

        tokens.push(resultTag || '*');
        return tokens.join(' ');
    }

    function buildAnnotatedPgn() {
        const history = game.history({ verbose: true });
        if (!history.length) {
            return '[No moves yet]';
        }

        const headerMap = buildHeaderMap();
        const headers = buildPgnHeaders(headerMap);
        const moves = buildAnnotatedMovetext(history, headerMap.Result);

        return headers ? `${headers}\n\n${moves}` : moves;
    }

    function buildViewGame(ply) {
        const history = game.history({ verbose: true });
        if (ply >= history.length) return game;
        const next = new Chess();
        const slice = history.slice(0, ply);
        slice.forEach((m) => next.move({ from: m.from, to: m.to, promotion: m.promotion }));
        return next;
    }

    function isViewingPast() {
        return activePly < game.history().length;
    }

    function updateBoardStats() {
        const fullHistory = game.history({ verbose: true });
        const viewGame = buildViewGame(activePly);
        if (viewGame.game_over()) {
            boardStatsEl.textContent = 'Game over';
        } else {
            const turn = viewGame.turn() === 'w' ? 'White' : 'Black';
            const inCheck = viewGame.in_check() ? '  Check' : '';
            boardStatsEl.textContent = `${turn} to move${inCheck}`;
        }

        if (isViewingPast()) {
            boardStatsEl.textContent += ` (viewing ${activePly}/${fullHistory.length})`;
        }

        const humanColor = engineSide === 'w' ? 'Black' : 'White';
        playerSideLabel.textContent = `You: ${humanColor}`;
        engineSideLabel.textContent = `Lozza: ${engineSide === 'w' ? 'White' : 'Black'}`;

        moveStatsEl.textContent = `${fullHistory.length} move${fullHistory.length === 1 ? '' : 's'}`;

        toolStats.textContent = `Engine: ${engineReady ? 'ready' : 'loading'}  ${engineThinking ? 'thinking' : 'idle'}`;
        updateAnalyzeButton();
    }

    function updateAnalyzeButton() {
        if (!analyzeGameBtn) return;
        const iconEl = analyzeGameBtn.querySelector('.material-icons');
        const labelEl = analyzeGameBtn.querySelector('.btn-label');

        if (analysisActive) {
            analyzeGameBtn.disabled = false;
            if (iconEl) iconEl.textContent = 'stop_circle';
            if (labelEl) labelEl.textContent = 'Stop Analysis';
            return;
        }

        const canAnalyze = engineReady && game.game_over() && game.history().length > 0;
        analyzeGameBtn.disabled = !canAnalyze;
        if (iconEl) iconEl.textContent = 'analytics';
        if (labelEl) labelEl.textContent = 'Analyze Game';
    }

    function renderCoords(files, ranks) {
        if (filesTopEl) filesTopEl.innerHTML = files.map((f) => `<span>${f}</span>`).join('');
        if (filesBottomEl) filesBottomEl.innerHTML = files.map((f) => `<span>${f}</span>`).join('');
        if (ranksLeftEl) ranksLeftEl.innerHTML = ranks.map((r) => `<span>${r}</span>`).join('');
        if (ranksRightEl) ranksRightEl.innerHTML = ranks.map((r) => `<span>${r}</span>`).join('');
    }

    function updateSelectionIndicators() {
        const targetSet = new Set(legalTargets);
        boardEl.querySelectorAll('.square').forEach((sq) => {
            const coord = sq.dataset.coord;
            sq.classList.toggle('selected', coord === selectedSquare);
            sq.classList.toggle('target', targetSet.has(coord));
        });
    }

    function getSquareFromPoint(x, y) {
        const el = document.elementFromPoint(x, y);
        return el ? el.closest('.square') : null;
    }

    function canDragFrom(square) {
        if (game.game_over()) return false;
        if (activePly !== game.history().length) return false;
        if (engineThinking && game.turn() === engineSide) return false;
        const piece = game.get(square);
        if (!piece) return false;
        if (piece.color === engineSide) return false;
        return piece.color === game.turn();
    }

    function createDragGhost(pieceEl) {
        const ghost = pieceEl.cloneNode(true);
        ghost.classList.add('drag-ghost');
        const rect = pieceEl.getBoundingClientRect();
        ghost.style.width = `${rect.width}px`;
        ghost.style.height = `${rect.height}px`;
        document.body.appendChild(ghost);
        return ghost;
    }

    function positionDragGhost(ghost, x, y) {
        ghost.style.left = `${x}px`;
        ghost.style.top = `${y}px`;
    }

    function clearDragVisuals(state) {
        if (state?.ghost) state.ghost.remove();
        if (state?.pieceEl) state.pieceEl.classList.remove('drag-source');
    }

    function resetSuppressClick() {
        if (!suppressPieceClick) return;
        setTimeout(() => {
            suppressPieceClick = false;
        }, 0);
    }

    function detachDragListeners() {
        window.removeEventListener('pointermove', handleDragMove);
        window.removeEventListener('pointerup', handleDragEnd);
        window.removeEventListener('pointercancel', handleDragCancel);
    }

    function beginDrag(ev, square, pieceEl) {
        if (ev.button !== 0) return;
        if (!canDragFrom(square)) return;
        dragState = {
            from: square,
            pointerId: ev.pointerId,
            startX: ev.clientX,
            startY: ev.clientY,
            pieceEl,
            ghost: null,
            started: false
        };
        window.addEventListener('pointermove', handleDragMove);
        window.addEventListener('pointerup', handleDragEnd);
        window.addEventListener('pointercancel', handleDragCancel);
    }

    function handleDragMove(ev) {
        if (!dragState || ev.pointerId !== dragState.pointerId) return;
        const dx = ev.clientX - dragState.startX;
        const dy = ev.clientY - dragState.startY;
        if (!dragState.started) {
            if (Math.hypot(dx, dy) < dragThreshold) return;
            dragState.started = true;
            suppressPieceClick = true;
            selectedSquare = dragState.from;
            legalTargets = game.moves({ square: dragState.from, verbose: true }).map((m) => m.to);
            updateSelectionIndicators();
            dragState.ghost = createDragGhost(dragState.pieceEl);
            dragState.pieceEl.classList.add('drag-source');
        }
        if (dragState.ghost) {
            positionDragGhost(dragState.ghost, ev.clientX, ev.clientY);
        }
        ev.preventDefault();
    }

    function handleDragEnd(ev) {
        if (!dragState || ev.pointerId !== dragState.pointerId) return;
        const state = dragState;
        dragState = null;
        detachDragListeners();

        if (!state.started) {
            return;
        }

        clearDragVisuals(state);
        resetSuppressClick();

        const dropSquareEl = getSquareFromPoint(ev.clientX, ev.clientY);
        const target = dropSquareEl?.dataset.coord;
        if (!target || !legalTargets.includes(target)) {
            if (target) {
                setStatus('Illegal move.', 'error');
            }
            selectedSquare = null;
            legalTargets = [];
            renderBoard();
            return;
        }

        attemptMove(state.from, target);
    }

    function handleDragCancel(ev) {
        if (!dragState || (ev && ev.pointerId !== dragState.pointerId)) return;
        const state = dragState;
        dragState = null;
        detachDragListeners();
        clearDragVisuals(state);
        resetSuppressClick();
        selectedSquare = null;
        legalTargets = [];
        renderBoard();
    }

    function cancelActiveDrag() {
        if (!dragState) return;
        const state = dragState;
        dragState = null;
        detachDragListeners();
        clearDragVisuals(state);
        suppressPieceClick = false;
    }

    function renderBoard() {
        boardEl.innerHTML = '';
        boardEl.dataset.orientation = orientation;

        const viewGame = buildViewGame(activePly);
        const files = orientation === 'white'
            ? ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
            : ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'];
        const ranks = orientation === 'white'
            ? ['8', '7', '6', '5', '4', '3', '2', '1']
            : ['1', '2', '3', '4', '5', '6', '7', '8'];

        const history = viewGame.history({ verbose: true });
        const lastMove = history[history.length - 1];
        const highlights = lastMove ? [lastMove.from, lastMove.to] : [];
        const targetSet = new Set(legalTargets);

        ranks.forEach((rank) => {
            files.forEach((file) => {
                const square = `${file}${rank}`;
                const squareEl = document.createElement('div');
                const isLight = ((file.charCodeAt(0) - 97) + parseInt(rank, 10)) % 2 === 0;

                squareEl.className = `square ${isLight ? 'light-square' : 'dark-square'}`;
                squareEl.dataset.coord = square;

                if (highlights.includes(square)) squareEl.classList.add('highlight');
                if (square === selectedSquare) squareEl.classList.add('selected');
                if (targetSet.has(square)) squareEl.classList.add('target');

                const piece = viewGame.get(square);
                if (piece) {
                    const pieceEl = document.createElement('div');
                    pieceEl.className = 'piece';
                    pieceEl.dataset.piece = piece.color + piece.type.toUpperCase();
                    pieceEl.addEventListener('pointerdown', (ev) => beginDrag(ev, square, pieceEl));
                    pieceEl.addEventListener('click', (ev) => {
                        ev.stopPropagation();
                        if (suppressPieceClick) {
                            ev.preventDefault();
                            suppressPieceClick = false;
                            return;
                        }
                        handleSquareClick(square);
                    });
                    squareEl.appendChild(pieceEl);
                }

                squareEl.addEventListener('click', () => handleSquareClick(square));
                boardEl.appendChild(squareEl);
            });
        });

        renderCoords(files, ranks);
    }

    function renderMoveList() {
        const history = game.history({ verbose: true });
        moveListEl.innerHTML = '';

        const startBtn = document.createElement('button');
        startBtn.className = `move-tag ${activePly === 0 ? 'active' : ''}`;
        startBtn.textContent = 'Start';
        startBtn.addEventListener('click', () => jumpToPly(0));
        moveListEl.appendChild(startBtn);

        history.forEach((move, idx) => {
            const ply = idx + 1;
            const moveNum = Math.floor(idx / 2) + 1;
            const prefix = move.color === 'w' ? `${moveNum}.` : `${moveNum}...`;
            const tag = document.createElement('button');
            tag.className = `move-tag ${activePly === ply ? 'active' : ''}`;
            const result = analysisResults[ply - 1];
            const comment = formatEvalComment(result, ply);
            tag.textContent = comment ? `${prefix} ${move.san} ${comment}` : `${prefix} ${move.san}`;
            const title = formatAnalysisTitle(result, ply);
            if (title) {
                tag.title = title;
            } else {
                tag.removeAttribute('title');
            }
            tag.addEventListener('click', () => jumpToPly(ply));
            moveListEl.appendChild(tag);
        });
    }

    function syncPgn() {
        ensureDefaultHeaders();
        pgnTextEl.value = buildAnnotatedPgn();
    }

    function refreshUI() {
        cancelActiveDrag();
        renderBoard();
        renderMoveList();
        syncPgn();
        updateBoardStats();
    }

    function checkGameEnd() {
        if (!game.game_over()) return false;

        let msg = 'Game over.';
        let type = 'warning';

        if (game.in_checkmate()) {
            const winner = game.turn() === 'w' ? 'Black' : 'White';
            msg = `${winner} wins by checkmate.`;
            type = 'success';
        } else if (game.in_stalemate()) {
            msg = 'Draw by stalemate.';
        } else if (game.insufficient_material()) {
            msg = 'Draw by insufficient material.';
        } else if (game.in_threefold_repetition()) {
            msg = 'Draw by threefold repetition.';
        } else if (game.in_draw()) {
            msg = 'Draw.';
        }

        setStatus(msg, type);
        boardStatsEl.textContent = msg;
        updateEngineStatus('Game over', '');
        engineThinking = false;
        ensureDefaultHeaders();
        syncPgn();
        return true;
    }

    function stopEngine() {
        if (engine) engine.postMessage('stop');
        engineThinking = false;
    }

    function buildAnalysisPositions(history) {
        const uciMoves = history.map((m) => m.from + m.to + (m.promotion ? m.promotion : ''));
        const positions = [];
        let movesText = '';
        uciMoves.forEach((move) => {
            movesText = movesText ? `${movesText} ${move}` : move;
            positions.push(`position startpos moves ${movesText}`);
        });
        return positions;
    }

    function runAnalysisStep() {
        if (!analysisActive) return;
        if (analysisIndex >= analysisTotal) {
            finishAnalysis();
            return;
        }

        analysisCurrent = null;
        const position = analysisPositions[analysisIndex];
        setStatus(`Analyzing ${analysisIndex + 1}/${analysisTotal}...`, 'warning');
        engine.postMessage(position);
        engine.postMessage(`go movetime ${analysisMoveTime}`);
    }

    function startAnalysis() {
        if (analysisActive) return;
        if (!engineReady) {
            setStatus('Lozza is still loading.', 'warning');
            return;
        }
        if (!game.game_over()) {
            setStatus('Finish the game before analyzing.', 'warning');
            return;
        }
        const history = game.history({ verbose: true });
        if (!history.length) {
            setStatus('No moves to analyze.', 'warning');
            return;
        }

        stopEngine();
        engine.postMessage('ucinewgame');

        analysisPositions = buildAnalysisPositions(history);
        analysisResults = new Array(history.length).fill(null);
        analysisIndex = 0;
        analysisTotal = analysisPositions.length;
        analysisMoveTime = moveTime;
        analysisCurrent = null;
        analysisActive = true;

        renderMoveList();
        updateEngineStatus('Analyzing...', 'busy');
        updateAnalyzeButton();
        runAnalysisStep();
    }

    function finishAnalysis() {
        analysisActive = false;
        analysisCurrent = null;
        updateEngineStatus(engineReady ? 'Lozza ready' : 'Engine unavailable', engineReady ? 'ready' : '');
        updateAnalyzeButton();
        setStatus(`Analysis complete (${analysisTotal} positions).`, 'success');
    }

    function stopAnalysis(silent = false) {
        if (!analysisActive) return;
        analysisActive = false;
        analysisCurrent = null;
        engine?.postMessage('stop');
        updateEngineStatus(engineReady ? 'Lozza ready' : 'Engine unavailable', engineReady ? 'ready' : '');
        updateAnalyzeButton();
        if (!silent) {
            setStatus('Analysis canceled.', 'warning');
        }
    }

    function resetAnalysisResults() {
        stopAnalysis(true);
        analysisPositions = [];
        analysisResults = [];
        analysisIndex = 0;
        analysisTotal = 0;
        analysisCurrent = null;
        updateAnalyzeButton();
    }

    function maybeQueueEngine() {
        if (!engineReady) return;
        if (game.game_over()) return;
        if (activePly !== game.history().length) return;
        if (game.turn() !== engineSide) return;
        if (engineThinking) return;

        engineThinking = true;
        updateEngineStatus('Lozza thinking...', 'busy');

        const moves = getUciMoves();
        const position = moves.length ? `position startpos moves ${moves.join(' ')}` : 'position startpos';

        engine.postMessage(position);
        engine.postMessage(`go movetime ${moveTime}`);
    }

    function attemptMove(from, to) {
        if (activePly !== game.history().length) {
            setStatus('Jump to latest move to play.', 'warning');
            return;
        }
        if (game.turn() === engineSide) {
            setStatus('Wait for Lozza to move.', 'warning');
            return;
        }

        const move = game.move({ from, to, promotion: 'q' });
        if (!move) {
            setStatus('Illegal move.', 'error');
            return;
        }

        resetAnalysisResults();
        redoStack = [];
        selectedSquare = null;
        legalTargets = [];
        activePly = game.history().length;

        setStatus(`You played ${move.san}`, 'success');
        refreshUI();
        if (!checkGameEnd()) {
            maybeQueueEngine();
        }
    }

    function applyEngineMove(uciMove) {
        const from = uciMove.slice(0, 2);
        const to = uciMove.slice(2, 4);
        const promotion = uciMove.length > 4 ? uciMove[4] : undefined;

        const move = game.move({ from, to, promotion });
        if (!move) {
            setStatus('Engine returned an invalid move.', 'error');
            return;
        }

        resetAnalysisResults();
        redoStack = [];
        selectedSquare = null;
        legalTargets = [];
        activePly = game.history().length;

        setStatus(`Lozza played ${move.san}`, 'success');
        refreshUI();
        checkGameEnd();
    }

    function handleEngineMessage(e) {
        const line = (e.data || '').toString().trim();
        if (!line) return;

        if (line === 'uciok') {
            updateEngineStatus('Syncing...', 'busy');
            engine.postMessage('isready');
            return;
        }

        if (line === 'readyok') {
            engineReady = true;
            updateEngineStatus('Lozza ready', 'ready');
            setStatus('Lozza is ready.', 'success');
            engine.postMessage('ucinewgame');
            maybeQueueEngine();
            updateAnalyzeButton();
            return;
        }

        if (line.startsWith('info')) {
            if (analysisActive) {
                const parsed = parseInfoLine(line);
                if (parsed && (!analysisCurrent || (parsed.depth || 0) >= (analysisCurrent.depth || 0))) {
                    analysisCurrent = parsed;
                }
            }
            pushEngineLine(describeInfo(line));
            return;
        }

        if (line.startsWith('bestmove')) {
            if (analysisActive) {
                analysisResults[analysisIndex] = analysisCurrent;
                analysisCurrent = null;
                analysisIndex += 1;
                renderMoveList();
                syncPgn();
                if (analysisIndex >= analysisTotal) {
                    finishAnalysis();
                } else {
                    runAnalysisStep();
                }
                return;
            }
            if (!engineThinking) return;
            engineThinking = false;
            updateEngineStatus('Lozza ready', 'ready');

            const parts = line.split(' ');
            const move = parts[1];
            if (!move || move === '(none)') {
                setStatus('No legal moves for engine.', 'warning');
                return;
            }
            applyEngineMove(move);
            return;
        }
    }

    function handleSquareClick(square) {
        if (game.game_over()) return;
        if (activePly !== game.history().length) {
            setStatus('Jump to latest move to play.', 'warning');
            return;
        }
        if (engineThinking && game.turn() === engineSide) {
            setStatus('Lozza is thinking...', 'warning');
            return;
        }

        if (selectedSquare) {
            if (selectedSquare === square) {
                selectedSquare = null;
                legalTargets = [];
                renderBoard();
                return;
            }
            attemptMove(selectedSquare, square);
            return;
        }

        const piece = game.get(square);
        if (piece && piece.color !== engineSide && piece.color === game.turn()) {
            selectedSquare = square;
            legalTargets = game.moves({ square, verbose: true }).map((m) => m.to);
        } else {
            selectedSquare = null;
            legalTargets = [];
        }
        renderBoard();
    }

    function newGame(keepOrientation = false) {
        stopEngine();
        resetAnalysisResults();
        game = new Chess();
        gameDateTag = formatDateTag(new Date());
        ensureDefaultHeaders();
        redoStack = [];
        selectedSquare = null;
        legalTargets = [];
        activePly = 0;
        if (!keepOrientation) {
            orientation = engineSide === 'w' ? 'black' : 'white';
        }
        engineReady && engine.postMessage('ucinewgame');
        setStatus('New game started.', 'success');
        refreshUI();
        maybeQueueEngine();
    }

    function jumpToPly(ply) {
        stopEngine();
        selectedSquare = null;
        legalTargets = [];
        activePly = ply;
        setStatus(`Jumped to move ${ply}.`, 'success');
        refreshUI();
        if (activePly === game.history().length) {
            maybeQueueEngine();
        }
    }

    function loadPgnFromPrompt() {
        stopEngine();
        const text = prompt('Paste a PGN to load into the board:');
        if (!text) return;

        const next = new Chess();
        const ok = next.load_pgn(text, { sloppy: true });
        if (!ok) {
            setStatus('Unable to parse PGN.', 'error');
            return;
        }

        game = next;
        gameDateTag = next.header().Date || formatDateTag(new Date());
        ensureDefaultHeaders();
        resetAnalysisResults();
        redoStack = [];
        selectedSquare = null;
        legalTargets = [];
        activePly = game.history().length;

        setStatus('PGN loaded.', 'success');
        refreshUI();
        checkGameEnd();
        maybeQueueEngine();
    }

    function copyPgnToClipboard() {
        if (!navigator.clipboard) {
            setStatus('Clipboard not available in this browser.', 'warning');
            return;
        }
        syncPgn();
        navigator.clipboard.writeText(pgnTextEl.value || '')
            .then(() => setStatus('PGN copied to clipboard.', 'success'))
            .catch(() => setStatus('Copy failed.', 'error'));
    }

    function undoMove() {
        stopEngine();
        const move = game.undo();
        if (!move) {
            setStatus('Nothing to undo.', 'warning');
            return;
        }
        redoStack.push(move);
        activePly = game.history().length;
        setStatus('Move undone.', 'success');
        refreshUI();
        maybeQueueEngine();
    }

    function redoMove() {
        const move = redoStack.pop();
        if (!move) {
            setStatus('Nothing to redo.', 'warning');
            return;
        }
        game.move({ from: move.from, to: move.to, promotion: move.promotion });
        activePly = game.history().length;
        setStatus('Move redone.', 'success');
        refreshUI();
        maybeQueueEngine();
    }

    function flipBoard() {
        orientation = orientation === 'white' ? 'black' : 'white';
        renderBoard();
    }

    function updateMoveTimeLabel() {
        if (!moveTimeInput) return;
        moveTime = parseInt(moveTimeInput.value, 10);
        moveTimeLabel.textContent = `${(moveTime / 1000).toFixed(1)}s`;
    }

    function initEngine() {
        try {
            engine = new Worker('js/lozza.js');
        } catch (err) {
            setStatus('Failed to start Lozza worker.', 'error');
            updateEngineStatus('Engine unavailable', '');
            return;
        }
        engine.onmessage = handleEngineMessage;
        engine.onerror = (err) => setStatus(`Engine error: ${err.message || err}`, 'error');
        engine.postMessage('uci');
        updateEngineStatus('Lozza warming up...', 'busy');
    }

    function initControls() {
        document.getElementById('backButton')?.addEventListener('click', () => {
            window.location.href = 'index.html';
        });

        document.getElementById('flipBoardBtn')?.addEventListener('click', flipBoard);
        document.getElementById('newGameBtn')?.addEventListener('click', () => newGame(true));
        document.getElementById('loadPgnBtn')?.addEventListener('click', loadPgnFromPrompt);
        document.getElementById('copyPgnBtn')?.addEventListener('click', copyPgnToClipboard);
        document.getElementById('undoBtn')?.addEventListener('click', undoMove);
        document.getElementById('redoBtn')?.addEventListener('click', redoMove);
        analyzeGameBtn?.addEventListener('click', () => {
            if (analysisActive) {
                stopAnalysis();
                return;
            }
            startAnalysis();
        });

        moveTimeInput?.addEventListener('input', () => {
            updateMoveTimeLabel();
        });
        updateMoveTimeLabel();

        engineColorSelect?.addEventListener('change', (e) => {
            engineSide = e.target.value;
            newGame(false);
        });
    }

    function init() {
        initControls();
        initEngine();
        engineLogEl.textContent = 'Engine info will appear here during search.';
        newGame(false);
        setStatus('Initializing Lozza...', 'warning');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

```

## Full File: `js/chess.min.js`

```javascript
var Chess=function(r){var u="b",s="w",l=-1,_="p",A="n",S="b",m="r",y="q",p="k",t="pnbrqkPNBRQK",e="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",g=["1-0","0-1","1/2-1/2","*"],C={b:[16,32,17,15],w:[-16,-32,-17,-15]},T={n:[-18,-33,-31,-14,18,33,31,14],b:[-17,-15,17,15],r:[-16,1,16,-1],q:[-17,-16,-15,1,17,16,15,-1],k:[-17,-16,-15,1,17,16,15,-1]},c=[20,0,0,0,0,0,0,24,0,0,0,0,0,0,20,0,0,20,0,0,0,0,0,24,0,0,0,0,0,20,0,0,0,0,20,0,0,0,0,24,0,0,0,0,20,0,0,0,0,0,0,20,0,0,0,24,0,0,0,20,0,0,0,0,0,0,0,0,20,0,0,24,0,0,20,0,0,0,0,0,0,0,0,0,0,20,2,24,2,20,0,0,0,0,0,0,0,0,0,0,0,2,53,56,53,2,0,0,0,0,0,0,24,24,24,24,24,24,56,0,56,24,24,24,24,24,24,0,0,0,0,0,0,2,53,56,53,2,0,0,0,0,0,0,0,0,0,0,0,20,2,24,2,20,0,0,0,0,0,0,0,0,0,0,20,0,0,24,0,0,20,0,0,0,0,0,0,0,0,20,0,0,0,24,0,0,0,20,0,0,0,0,0,0,20,0,0,0,0,24,0,0,0,0,20,0,0,0,0,20,0,0,0,0,0,24,0,0,0,0,0,20,0,0,20,0,0,0,0,0,0,24,0,0,0,0,0,0,20],v=[17,0,0,0,0,0,0,16,0,0,0,0,0,0,15,0,0,17,0,0,0,0,0,16,0,0,0,0,0,15,0,0,0,0,17,0,0,0,0,16,0,0,0,0,15,0,0,0,0,0,0,17,0,0,0,16,0,0,0,15,0,0,0,0,0,0,0,0,17,0,0,16,0,0,15,0,0,0,0,0,0,0,0,0,0,17,0,16,0,15,0,0,0,0,0,0,0,0,0,0,0,0,17,16,15,0,0,0,0,0,0,0,1,1,1,1,1,1,1,0,-1,-1,-1,-1,-1,-1,-1,0,0,0,0,0,0,0,-15,-16,-17,0,0,0,0,0,0,0,0,0,0,0,0,-15,0,-16,0,-17,0,0,0,0,0,0,0,0,0,0,-15,0,0,-16,0,0,-17,0,0,0,0,0,0,0,0,-15,0,0,0,-16,0,0,0,-17,0,0,0,0,0,0,-15,0,0,0,0,-16,0,0,0,0,-17,0,0,0,0,-15,0,0,0,0,0,-16,0,0,0,0,0,-17,0,0,-15,0,0,0,0,0,0,-16,0,0,0,0,0,0,-17],h={p:0,n:1,b:2,r:3,q:4,k:5},o={NORMAL:"n",CAPTURE:"c",BIG_PAWN:"b",EP_CAPTURE:"e",PROMOTION:"p",KSIDE_CASTLE:"k",QSIDE_CASTLE:"q"},I={NORMAL:1,CAPTURE:2,BIG_PAWN:4,EP_CAPTURE:8,PROMOTION:16,KSIDE_CASTLE:32,QSIDE_CASTLE:64},P=7,w=6,L=1,R=0,N={a8:0,b8:1,c8:2,d8:3,e8:4,f8:5,g8:6,h8:7,a7:16,b7:17,c7:18,d7:19,e7:20,f7:21,g7:22,h7:23,a6:32,b6:33,c6:34,d6:35,e6:36,f6:37,g6:38,h6:39,a5:48,b5:49,c5:50,d5:51,e5:52,f5:53,g5:54,h5:55,a4:64,b4:65,c4:66,d4:67,e4:68,f4:69,g4:70,h4:71,a3:80,b3:81,c3:82,d3:83,e3:84,f3:85,g3:86,h3:87,a2:96,b2:97,c2:98,d2:99,e2:100,f2:101,g2:102,h2:103,a1:112,b1:113,c1:114,d1:115,e1:116,f1:117,g1:118,h1:119},E={w:[{square:N.a1,flag:I.QSIDE_CASTLE},{square:N.h1,flag:I.KSIDE_CASTLE}],b:[{square:N.a8,flag:I.QSIDE_CASTLE},{square:N.h8,flag:I.KSIDE_CASTLE}]},O=new Array(128),k={w:l,b:l},q=s,D={w:0,b:0},K=l,d=0,b=1,Q=[],U={};function x(r){void 0===r&&(r=!1),O=new Array(128),k={w:l,b:l},q=s,D={w:0,b:0},K=l,d=0,b=1,Q=[],r||(U={}),F(M())}function j(){B(e)}function B(r,e){void 0===e&&(e=!1);var n=r.split(/\s+/),t=n[0],o=0;if(!$(r).valid)return!1;x(e);for(var i=0;i<t.length;i++){var f=t.charAt(i);if("/"===f)o+=8;else if(-1!=="0123456789".indexOf(f))o+=parseInt(f,10);else{var a=f<"a"?s:u;W({type:f.toLowerCase(),color:a},fr(o)),o++}}return q=n[1],-1<n[2].indexOf("K")&&(D.w|=I.KSIDE_CASTLE),-1<n[2].indexOf("Q")&&(D.w|=I.QSIDE_CASTLE),-1<n[2].indexOf("k")&&(D.b|=I.KSIDE_CASTLE),-1<n[2].indexOf("q")&&(D.b|=I.QSIDE_CASTLE),K="-"===n[3]?l:N[n[3]],d=parseInt(n[4],10),b=parseInt(n[5],10),F(M()),!0}function $(r){var e="No errors.",n="FEN string must contain six space-delimited fields.",t="6th field (move number) must be a positive integer.",o="5th field (half move counter) must be a non-negative integer.",i="4th field (en-passant square) is invalid.",f="3rd field (castling availability) is invalid.",a="2nd field (side to move) is invalid.",l="1st field (piece positions) does not contain 8 '/'-delimited rows.",u="1st field (piece positions) is invalid [consecutive numbers].",s="1st field (piece positions) is invalid [invalid piece].",p="1st field (piece positions) is invalid [row too large].",c="Illegal en-passant square",v=r.split(/\s+/);if(6!==v.length)return{valid:!1,error_number:1,error:n};if(isNaN(v[5])||parseInt(v[5],10)<=0)return{valid:!1,error_number:2,error:t};if(isNaN(v[4])||parseInt(v[4],10)<0)return{valid:!1,error_number:3,error:o};if(!/^(-|[abcdefgh][36])$/.test(v[3]))return{valid:!1,error_number:4,error:i};if(!/^(KQ?k?q?|Qk?q?|kq?|q|-)$/.test(v[2]))return{valid:!1,error_number:5,error:f};if(!/^(w|b)$/.test(v[1]))return{valid:!1,error_number:6,error:a};var g=v[0].split("/");if(8!==g.length)return{valid:!1,error_number:7,error:l};for(var h=0;h<g.length;h++){for(var E=0,d=!1,b=0;b<g[h].length;b++)if(isNaN(g[h][b])){if(!/^[prnbqkPRNBQK]$/.test(g[h][b]))return{valid:!1,error_number:9,error:s};E+=1,d=!1}else{if(d)return{valid:!1,error_number:8,error:u};E+=parseInt(g[h][b],10),d=!0}if(8!==E)return{valid:!1,error_number:10,error:p}}return"3"==v[3][1]&&"w"==v[1]||"6"==v[3][1]&&"b"==v[1]?{valid:!1,error_number:11,error:c}:{valid:!0,error_number:0,error:e}}function M(){for(var r=0,e="",n=N.a8;n<=N.h1;n++){if(null==O[n])r++;else{0<r&&(e+=r,r=0);var t=O[n].color,o=O[n].type;e+=t===s?o.toUpperCase():o.toLowerCase()}n+1&136&&(0<r&&(e+=r),n!==N.h1&&(e+="/"),r=0,n+=8)}var i="";D[s]&I.KSIDE_CASTLE&&(i+="K"),D[s]&I.QSIDE_CASTLE&&(i+="Q"),D[u]&I.KSIDE_CASTLE&&(i+="k"),D[u]&I.QSIDE_CASTLE&&(i+="q"),i=i||"-";var f=K===l?"-":fr(K);return[e,q,i,f,d,b].join(" ")}function G(r){for(var e=0;e<r.length;e+=2)"string"==typeof r[e]&&"string"==typeof r[e+1]&&(U[r[e]]=r[e+1]);return U}function F(r){0<Q.length||(r!==e?(U.SetUp="1",U.FEN=r):(delete U.SetUp,delete U.FEN))}function i(r){var e=O[N[r]];return e?{type:e.type,color:e.color}:null}function W(r,e){if(!("type"in r&&"color"in r))return!1;if(-1===t.indexOf(r.type.toLowerCase()))return!1;if(!(e in N))return!1;var n=N[e];return(r.type!=p||k[r.color]==l||k[r.color]==n)&&(O[n]={type:r.type,color:r.color},r.type===p&&(k[r.color]=n),F(M()),!0)}function H(r,e,n,t,o){var i={color:q,from:e,to:n,flags:t,piece:r[e].type};return o&&(i.flags|=I.PROMOTION,i.promotion=o),r[n]?i.captured=r[n].type:t&I.EP_CAPTURE&&(i.captured=_),i}function Z(r){function e(r,e,n,t,o){if(r[n].type!==_||or(t)!==R&&or(t)!==P)e.push(H(r,n,t,o));else for(var i=[y,m,S,A],f=0,a=i.length;f<a;f++)e.push(H(r,n,t,o,i[f]))}var n=[],t=q,o=ar(t),i={b:L,w:w},f=N.a8,a=N.h1,l=!1,u=!(void 0!==r&&"legal"in r)||r.legal;if(void 0!==r&&"square"in r){if(!(r.square in N))return[];f=a=N[r.square],l=!0}for(var s=f;s<=a;s++)if(136&s)s+=7;else{var p=O[s];if(null!=p&&p.color===t)if(p.type===_){var c=s+C[t][0];if(null==O[c]){e(O,n,s,c,I.NORMAL);c=s+C[t][1];i[t]===or(s)&&null==O[c]&&e(O,n,s,c,I.BIG_PAWN)}for(v=2;v<4;v++){136&(c=s+C[t][v])||(null!=O[c]&&O[c].color===o?e(O,n,s,c,I.CAPTURE):c===K&&e(O,n,s,K,I.EP_CAPTURE))}}else for(var v=0,g=T[p.type].length;v<g;v++){var h=T[p.type][v];for(c=s;!(136&(c+=h));){if(null!=O[c]){if(O[c].color===t)break;e(O,n,s,c,I.CAPTURE);break}if(e(O,n,s,c,I.NORMAL),"n"===p.type||"k"===p.type)break}}}if(!l||a===k[t]){if(D[t]&I.KSIDE_CASTLE){var E=(d=k[t])+2;null!=O[d+1]||null!=O[E]||V(o,k[t])||V(o,d+1)||V(o,E)||e(O,n,k[t],E,I.KSIDE_CASTLE)}if(D[t]&I.QSIDE_CASTLE){var d;E=(d=k[t])-2;null!=O[d-1]||null!=O[d-2]||null!=O[d-3]||V(o,k[t])||V(o,d-1)||V(o,E)||e(O,n,k[t],E,I.QSIDE_CASTLE)}}if(!u)return n;var b=[];for(s=0,g=n.length;s<g;s++)er(n[s]),X(t)||b.push(n[s]),nr();return b}function z(r,e){var n="";if(r.flags&I.KSIDE_CASTLE)n="O-O";else if(r.flags&I.QSIDE_CASTLE)n="O-O-O";else{var t=function(r,e){for(var n=Z({legal:!e}),t=r.from,o=r.to,i=r.piece,f=0,a=0,l=0,u=0,s=n.length;u<s;u++){var p=n[u].from,c=n[u].to,v=n[u].piece;i===v&&t!==p&&o===c&&(f++,or(t)===or(p)&&a++,ir(t)===ir(p)&&l++)}if(0<f)return 0<a&&0<l?fr(t):0<l?fr(t).charAt(1):fr(t).charAt(0);return""}(r,e);r.piece!==_&&(n+=r.piece.toUpperCase()+t),r.flags&(I.CAPTURE|I.EP_CAPTURE)&&(r.piece===_&&(n+=fr(r.from)[0]),n+="x"),n+=fr(r.to),r.flags&I.PROMOTION&&(n+="="+r.promotion.toUpperCase())}return er(r),f()&&(a()?n+="#":n+="+"),nr(),n}function J(r){return r.replace(/=/,"").replace(/[+#]?[?!]*$/,"")}function V(r,e){for(var n=N.a8;n<=N.h1;n++)if(136&n)n+=7;else if(null!=O[n]&&O[n].color===r){var t=O[n],o=n-e,i=119+o;if(c[i]&1<<h[t.type]){if(t.type===_){if(0<o){if(t.color===s)return!0}else if(t.color===u)return!0;continue}if("n"===t.type||"k"===t.type)return!0;for(var f=v[i],a=n+f,l=!1;a!==e;){if(null!=O[a]){l=!0;break}a+=f}if(!l)return!0}}return!1}function X(r){return V(ar(r),k[r])}function f(){return X(q)}function a(){return f()&&0===Z().length}function n(){return!f()&&0===Z().length}function Y(){for(var r={},e=[],n=0,t=0,o=N.a8;o<=N.h1;o++)if(t=(t+1)%2,136&o)o+=7;else{var i=O[o];i&&(r[i.type]=i.type in r?r[i.type]+1:1,i.type===S&&e.push(t),n++)}if(2===n)return!0;if(3===n&&(1===r[S]||1===r[A]))return!0;if(n===r[S]+2){var f=0,a=e.length;for(o=0;o<a;o++)f+=e[o];if(0===f||f===a)return!0}return!1}function rr(){for(var r=[],e={},n=!1;;){var t=nr();if(!t)break;r.push(t)}for(;;){var o=M().split(" ").slice(0,4).join(" ");if(e[o]=o in e?e[o]+1:1,3<=e[o]&&(n=!0),!r.length)break;er(r.pop())}return n}function er(r){var e,n=q,t=ar(n);if(e=r,Q.push({move:e,kings:{b:k.b,w:k.w},turn:q,castling:{b:D.b,w:D.w},ep_square:K,half_moves:d,move_number:b}),O[r.to]=O[r.from],O[r.from]=null,r.flags&I.EP_CAPTURE&&(q===u?O[r.to-16]=null:O[r.to+16]=null),r.flags&I.PROMOTION&&(O[r.to]={type:r.promotion,color:n}),O[r.to].type===p){if(k[O[r.to].color]=r.to,r.flags&I.KSIDE_CASTLE){var o=r.to-1,i=r.to+1;O[o]=O[i],O[i]=null}else if(r.flags&I.QSIDE_CASTLE){o=r.to+1,i=r.to-2;O[o]=O[i],O[i]=null}D[n]=""}if(D[n])for(var f=0,a=E[n].length;f<a;f++)if(r.from===E[n][f].square&&D[n]&E[n][f].flag){D[n]^=E[n][f].flag;break}if(D[t])for(f=0,a=E[t].length;f<a;f++)if(r.to===E[t][f].square&&D[t]&E[t][f].flag){D[t]^=E[t][f].flag;break}K=r.flags&I.BIG_PAWN?"b"===q?r.to-16:r.to+16:l,r.piece===_||r.flags&(I.CAPTURE|I.EP_CAPTURE)?d=0:d++,q===u&&b++,q=ar(q)}function nr(){var r=Q.pop();if(null==r)return null;var e=r.move;k=r.kings,q=r.turn,D=r.castling,K=r.ep_square,d=r.half_moves,b=r.move_number;var n,t,o=q,i=ar(q);if(O[e.from]=O[e.to],O[e.from].type=e.piece,O[e.to]=null,e.flags&I.CAPTURE)O[e.to]={type:e.captured,color:i};else if(e.flags&I.EP_CAPTURE){var f;f=o===u?e.to-16:e.to+16,O[f]={type:_,color:i}}e.flags&(I.KSIDE_CASTLE|I.QSIDE_CASTLE)&&(e.flags&I.KSIDE_CASTLE?(n=e.to+1,t=e.to-1):e.flags&I.QSIDE_CASTLE&&(n=e.to-2,t=e.to+1),O[n]=O[t],O[t]=null);return e}function tr(r,e){var n=J(r);if(e){var t=n.match(/([pnbrqkPNBRQK])?([a-h][1-8])x?-?([a-h][1-8])([qrbnQRBN])?/);if(t)var o=t[1],i=t[2],f=t[3],a=t[4]}for(var l=Z(),u=0,s=l.length;u<s;u++){if(n===J(z(l[u]))||e&&n===J(z(l[u],!0)))return l[u];if(t&&(!o||o.toLowerCase()==l[u].piece)&&N[i]==l[u].from&&N[f]==l[u].to&&(!a||a.toLowerCase()==l[u].promotion))return l[u]}return null}function or(r){return r>>4}function ir(r){return 15&r}function fr(r){var e=ir(r),n=or(r);return"abcdefgh".substring(e,e+1)+"87654321".substring(n,n+1)}function ar(r){return r===s?u:s}function lr(r){var e=function r(e){var n=e instanceof Array?[]:{};for(var t in e)n[t]="object"==typeof t?r(e[t]):e[t];return n}(r);e.san=z(e,!1),e.to=fr(e.to),e.from=fr(e.from);var n="";for(var t in I)I[t]&e.flags&&(n+=o[t]);return e.flags=n,e}function ur(r){return r.replace(/^\s+|\s+$/g,"")}return B(void 0===r?e:r),{WHITE:s,BLACK:u,PAWN:_,KNIGHT:A,BISHOP:S,ROOK:m,QUEEN:y,KING:p,SQUARES:function(){for(var r=[],e=N.a8;e<=N.h1;e++)136&e?e+=7:r.push(fr(e));return r}(),FLAGS:o,load:function(r){return B(r)},reset:function(){return j()},moves:function(r){for(var e=Z(r),n=[],t=0,o=e.length;t<o;t++)void 0!==r&&"verbose"in r&&r.verbose?n.push(lr(e[t])):n.push(z(e[t],!1));return n},in_check:function(){return f()},in_checkmate:function(){return a()},in_stalemate:function(){return n()},in_draw:function(){return 100<=d||n()||Y()||rr()},insufficient_material:function(){return Y()},in_threefold_repetition:function(){return rr()},game_over:function(){return 100<=d||a()||n()||Y()||rr()},validate_fen:function(r){return $(r)},fen:function(){return M()},board:function(){for(var r=[],e=[],n=N.a8;n<=N.h1;n++)null==O[n]?e.push(null):e.push({type:O[n].type,color:O[n].color}),n+1&136&&(r.push(e),e=[],n+=8);return r},pgn:function(r){var e="object"==typeof r&&"string"==typeof r.newline_char?r.newline_char:"\n",n="object"==typeof r&&"number"==typeof r.max_width?r.max_width:0,t=[],o=!1;for(var i in U)t.push("["+i+' "'+U[i]+'"]'+e),o=!0;o&&Q.length&&t.push(e);for(var f=[];0<Q.length;)f.push(nr());for(var a=[],l="";0<f.length;){var u=f.pop();Q.length||"b"!==u.color?"w"===u.color&&(l.length&&a.push(l),l=b+"."):l=b+". ...",l=l+" "+z(u,!1),er(u)}if(l.length&&a.push(l),void 0!==U.Result&&a.push(U.Result),0===n)return t.join("")+a.join(" ");var s=0;for(i=0;i<a.length;i++)s+a[i].length>n&&0!==i?(" "===t[t.length-1]&&t.pop(),t.push(e),s=0):0!==i&&(t.push(" "),s++),t.push(a[i]),s+=a[i].length;return t.join("")},load_pgn:function(r,e){var n=void 0!==e&&"sloppy"in e&&e.sloppy;function l(r){return r.replace(/\\/g,"\\")}var t="object"==typeof e&&"string"==typeof e.newline_char?e.newline_char:"\r?\n",o=new RegExp("^(\\[((?:"+l(t)+")|.)*\\])(?:"+l(t)+"){2}"),i=o.test(r)?o.exec(r)[1]:"";j();var f=function(r,e){for(var n="object"==typeof e&&"string"==typeof e.newline_char?e.newline_char:"\r?\n",t={},o=r.split(new RegExp(l(n))),i="",f="",a=0;a<o.length;a++)i=o[a].replace(/^\[([A-Z][A-Za-z]*)\s.*\]$/,"$1"),f=o[a].replace(/^\[[A-Za-z]+\s"(.*)"\]$/,"$1"),0<ur(i).length&&(t[i]=f);return t}(i,e);for(var a in f)G([a,f[a]]);if("1"===f.SetUp&&!("FEN"in f&&B(f.FEN,!0)))return!1;var u=r.replace(i,"").replace(new RegExp(l(t),"g")," ");u=u.replace(/(\{[^}]+\})+?/g,"");for(var s=/(\([^\(\)]+\))+?/g;s.test(u);)u=u.replace(s,"");var p=ur(u=(u=(u=u.replace(/\d+\.(\.\.)?/g,"")).replace(/\.\.\./g,"")).replace(/\$\d+/g,"")).split(new RegExp(/\s+/));p=p.join(",").replace(/,,+/g,",").split(",");for(var c="",v=0;v<p.length-1;v++){if(null==(c=tr(p[v],n)))return!1;er(c)}if(c=p[p.length-1],-1<g.indexOf(c))!function(r){for(var e in r)return 1}(U)||void 0!==U.Result||G(["Result",c]);else{if(null==(c=tr(c,n)))return!1;er(c)}return!0},header:function(){return G(arguments)},ascii:function(){return function(){for(var r="   +------------------------+\n",e=N.a8;e<=N.h1;e++){if(0===ir(e)&&(r+=" "+"87654321"[or(e)]+" |"),null==O[e])r+=" . ";else{var n=O[e].type;r+=" "+(O[e].color===s?n.toUpperCase():n.toLowerCase())+" "}e+1&136&&(r+="|\n",e+=8)}return r+="   +------------------------+\n",r+="     a  b  c  d  e  f  g  h\n"}()},turn:function(){return q},move:function(r,e){var n=void 0!==e&&"sloppy"in e&&e.sloppy,t=null;if("string"==typeof r)t=tr(r,n);else if("object"==typeof r)for(var o=Z(),i=0,f=o.length;i<f;i++)if(!(r.from!==fr(o[i].from)||r.to!==fr(o[i].to)||"promotion"in o[i]&&r.promotion!==o[i].promotion)){t=o[i];break}if(!t)return null;var a=lr(t);return er(t),a},undo:function(){var r=nr();return r?lr(r):null},clear:function(){return x()},put:function(r,e){return W(r,e)},get:function(r){return i(r)},remove:function(r){return n=i(e=r),O[N[e]]=null,n&&n.type===p&&(k[n.color]=l),F(M()),n;var e,n},perft:function(r){return function r(e){for(var n=Z({legal:!1}),t=0,o=q,i=0,f=n.length;i<f;i++)er(n[i]),X(o)||(0<e-1?t+=r(e-1):t++),nr();return t}(r)},square_color:function(r){if(r in N){var e=N[r];return(or(e)+ir(e))%2==0?"light":"dark"}return null},history:function(r){for(var e=[],n=[],t=(void 0!==r&&"verbose"in r&&r.verbose);0<Q.length;)e.push(nr());for(;0<e.length;){var o=e.pop();t?n.push(lr(o)):n.push(z(o)),er(o)}return n}}};"undefined"!=typeof exports&&(exports.Chess=Chess),"undefined"!=typeof define&&define(function(){return Chess});
```

## Section: `css/style.css` (lines 1-35, board color tokens)

```css
:root {
    --bg-primary: #121212;
    --bg-secondary: #1e1e1e;
    --bg-tertiary: #252525;
    --text-primary: #e0e0e0;
    --text-secondary: #a0a0a0;
    --border-color: #333;
    --accent: #0d9488;
    --accent-light: #14b8a6;
    --puzzle-accent: #8b5cf6;
    --success: #059669;
    --warning: #d97706;
    --error: #dc2626;
    --board-light: #d9c39a;
    --board-dark: #8a6a44;
    --board-highlight: rgba(13, 148, 136, 0.35);
    --board-selected: rgba(255, 255, 255, 0.18);
    --board-target: rgba(13, 148, 136, 0.45);
}

[data-theme="light"] {
    --bg-primary: #ffffff;
    --bg-secondary: #f8fafc;
    --bg-tertiary: #f1f5f9;
    --text-primary: #1e293b;
    --text-secondary: #64748b;
    --border-color: #e2e8f0;
    --accent: #0d9488;
    --accent-light: #14b8a6;
    --puzzle-accent: #7c3aed;
    --board-light: #f1e3c2;
    --board-dark: #c2965a;
    --board-highlight: rgba(13, 148, 136, 0.28);
    --board-selected: rgba(0, 0, 0, 0.1);
    --board-target: rgba(13, 148, 136, 0.32);
```

## Section: `css/style.css` (lines 470-914, Engine Game board/move/log UI)

```css
.engine-grid {
    grid-template-columns: minmax(440px, 1.3fr) minmax(260px, 0.9fr);
    align-items: start;
}

.board-wrapper {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.board-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
}

.board-buttons {
    display: flex;
    gap: 0.35rem;
    flex-wrap: wrap;
}

.board-buttons.compact .btn {
    padding: 0.3rem 0.45rem;
}

.puzzle-top {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.puzzle-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
}

.puzzle-metrics {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 0.4rem;
}

.puzzle-metrics.textual {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem 1rem;
    align-items: center;
}

.puzzle-metrics.textual span {
    font-size: 0.95rem;
}

.puzzle-metrics.textual .muted {
    color: var(--text-secondary);
}

.puzzle-metrics.textual .accent {
    color: var(--accent);
}

.puzzle-moves {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.io-label.tight {
    margin: 0;
}

.puzzle-header-panel {
    padding: 0.75rem 0.85rem;
}

.move-list.slim {
    padding: 0.5rem;
    gap: 0.25rem;
}

.puzzle-info {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.puzzle-info-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 0.75rem;
}

.puzzle-info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 0.5rem;
}

.pill {
    padding: 0.35rem 0.75rem;
    border-radius: 999px;
    border: 1px solid var(--accent);
    background: var(--bg-tertiary);
    color: var(--text-primary);
}

.pill.engine {
    border-color: var(--accent);
    color: var(--accent);
}

.pill.muted {
    color: var(--text-secondary);
}

.engine-chip {
    padding: 0.35rem 0.75rem;
    border-radius: 999px;
    border: 1px solid var(--accent);
    background: var(--bg-secondary);
    font-size: 0.85rem;
    color: var(--accent);
}

.engine-chip.ready {
    color: var(--success);
    border-color: var(--success);
}

.engine-chip.busy {
    color: var(--warning);
    border-color: var(--warning);
}

.btn-compact {
    padding: 0.35rem 0.75rem;
    font-size: 0.85rem;
}

.chess-board {
    position: relative;
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    aspect-ratio: 1 / 1;
    width: 100%;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    overflow: hidden;
    background: var(--bg-primary);
    user-select: none;
    touch-action: none;
}

.square {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0;
    cursor: pointer;
    transition: background 0.15s, box-shadow 0.15s;
}

.light-square {
    background: var(--board-light);
}

.dark-square {
    background: var(--board-dark);
}

.piece {
    width: 90%;
    height: 90%;
    background-size: contain;
    background-repeat: no-repeat;
    background-position: center;
    pointer-events: auto;
    cursor: grab;
    touch-action: none;
}

.piece.drag-ghost {
    position: fixed;
    pointer-events: none;
    z-index: 9999;
    transform: translate(-50%, -50%);
    opacity: 0.9;
    cursor: grabbing;
}

.piece.drag-source {
    opacity: 0.35;
}

.square.highlight {
    box-shadow: inset 0 0 0 3px var(--board-highlight);
}

.square.selected {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
    background: linear-gradient(135deg, var(--board-selected), transparent);
}

.square.target {
    box-shadow: inset 0 0 0 3px var(--board-target);
    background: linear-gradient(135deg, var(--board-highlight), transparent);
}

.chess-board.game-over {
    filter: brightness(0.75);
    position: relative;
}

.square.mated {
    box-shadow:
        inset 0 0 0 3px rgba(220, 38, 38, 0.75),
        0 0 12px 5px rgba(220, 38, 38, 0.45);
    background: linear-gradient(135deg, rgba(220, 38, 38, 0.25), transparent);
}

.board-footer {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    flex-wrap: wrap;
    font-size: 0.9rem;
}

.color-pill {
    padding: 0.25rem 0.75rem;
    border-radius: 999px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
}

.color-pill.engine {
    border-color: var(--accent);
    color: var(--accent);
}

.move-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    padding: 0.75rem;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    min-height: 64px;
}

.move-tag {
    padding: 0.25rem 0.6rem;
    background: var(--bg-secondary);
    border: 1px solid var(--accent);
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
    transition: border 0.2s, transform 0.2s;
    color: var(--accent);
}

.move-tag:hover {
    border-color: var(--accent-light);
    background: var(--bg-tertiary);
    color: var(--accent-light);
    transform: translateY(-1px);
}

.move-tag.active {
    background: var(--accent);
    border-color: var(--accent);
    color: #ffffff;
}
.move-tag.puzzle-segment {
    border-color: var(--puzzle-accent);
    color: var(--puzzle-accent);
}

.move-tag.puzzle-segment:hover {
    border-color: var(--puzzle-accent);
    background: rgba(139, 92, 246, 0.14);
    color: var(--puzzle-accent);
}

.pgn-panel {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.pgn-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
}

.engine-log {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 0.75rem;
    min-height: 80px;
    max-height: 200px;
    overflow-y: auto;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 0.85rem;
}

.engine-log-entry {
    margin-bottom: 0.35rem;
    color: var(--text-secondary);
}

.engine-log-entry:last-child {
    margin-bottom: 0;
}

.piece[data-piece="wP"] { background-image: url('../img/merida/wP.svg'); }
.piece[data-piece="wN"] { background-image: url('../img/merida/wN.svg'); }
.piece[data-piece="wB"] { background-image: url('../img/merida/wB.svg'); }
.piece[data-piece="wR"] { background-image: url('../img/merida/wR.svg'); }
.piece[data-piece="wQ"] { background-image: url('../img/merida/wQ.svg'); }
.piece[data-piece="wK"] { background-image: url('../img/merida/wK.svg'); }
.piece[data-piece="bP"] { background-image: url('../img/merida/bP.svg'); }
.piece[data-piece="bN"] { background-image: url('../img/merida/bN.svg'); }
.piece[data-piece="bB"] { background-image: url('../img/merida/bB.svg'); }
.piece[data-piece="bR"] { background-image: url('../img/merida/bR.svg'); }
.piece[data-piece="bQ"] { background-image: url('../img/merida/bQ.svg'); }
.piece[data-piece="bK"] { background-image: url('../img/merida/bK.svg'); }

.board-shell {
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: center;
    width: min(100%, 640px);
    margin: 0 auto;
}

.board-mid {
    display: flex;
    width: 100%;
    gap: 6px;
    align-items: stretch;
}

.board-files {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    width: 100%;
    text-align: center;
    color: var(--text-secondary);
    font-size: 0.85rem;
    letter-spacing: 0.5px;
}

.board-ranks {
    display: grid;
    grid-template-rows: repeat(8, 1fr);
    gap: 2px;
    width: 26px;
    text-align: center;
    color: var(--text-secondary);
    font-size: 0.85rem;
}

.hidden {
    display: none !important;
}

.visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
}

.success {
    color: var(--success);
}

.warning {
    color: var(--warning);
}

.error {
    color: var(--error);
}

/* Responsive */
@media (max-width: 768px) {
    .main-grid {
        grid-template-columns: 1fr;
    }
    
    .sidebar {
        position: static;
    }
    
    .tool-header {
        flex-direction: column;
        gap: 1rem;
        align-items: flex-start;
    }

    .site-network {
        position: static;
        transform: none;
        order: 3;
        width: 100%;
        margin-top: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        justify-content: center;
        align-items: center;
    }

    header {
        flex-wrap: wrap;
    }
}
```

## Section: `js/lozza.js` (lines 1079-1204, search `info` + `bestmove` emission)

```javascript
//{{{  report

function report (units, value, depth) {

  let pvStr = 'pv';
  for (let i=rootNode.pvLen-1; i >= 0; i--)
    pvStr += ' ' + formatMove(rootNode.pv[i]);

  const tim     = now() - statsStartTime;
  const nps     = (statsNodes * 1000) / tim | 0;
  const nodeStr = 'nodes ' + statsNodes + ' time ' + tim + ' nps ' + nps;

  const depthStr = 'depth ' + depth + ' seldepth ' + statsSelDepth;
  const scoreStr = 'score ' + units + ' ' + value;
  const hashStr  = 'hashfull ' + (1000 * ttHashUsed / TTSIZE | 0);

  uciSend('info', depthStr, scoreStr, nodeStr, hashStr, pvStr);

}

//}}}
//{{{  go

function go (maxPly) {

  var lastScore   = 0;
  var lastDepth   = 0;
  var bestMoveStr = '';

  var alpha = 0;
  var beta  = 0;
  var score = 0;
  var delta = 0;
  var depth = 0;

  for (let ply=1; ply <= maxPly; ply++) {

    alpha = -INFINITY;
    beta  = INFINITY;
    delta = 10;

    if (ply >= 4) {
      alpha = Math.max(-INFINITY, score - delta);
      beta  = Math.min(INFINITY,  score + delta);
    }

    depth = ply;

    while (1) {

      score = rootSearch(rootNode, depth, bdTurn, alpha, beta);

      if (statsTimeOut !== 0)
        break;

      lastScore = score;
      lastDepth = depth;

      //{{{  better?
      
      if (score > alpha && score < beta) {
      
        report('cp',score,depth);
      
        if (statsBestMove && statsMaxNodes > 0 && statsNodes >= statsMaxNodes)
          statsTimeOut = 1;
      
        break;
      }
      
      //}}}
      //{{{  mate?
      
      if (Math.abs(score) >= MINMATE && Math.abs(score) <= MATE) {
      
        var mateScore = (MATE - Math.abs(score)) / 2 | 0;
        if (score < 0)
          mateScore = -mateScore;
      
        report('mate',mateScore,depth);
      
        break;
      }
      
      //}}}

      delta += delta/2 | 0;

      //{{{  upper bound?
      
      if (score <= alpha) {
      
        beta  = Math.min(INFINITY, ((alpha + beta) / 2) | 0);
        alpha = Math.max(-INFINITY, alpha - delta);
      
        //report('upperbound',score,depth);
      
        if (!statsMaxNodes)
          statsBestMove = 0;
      }
      
      //}}}
      //{{{  lower bound?
      
      else if (score >= beta) {
      
        beta = Math.min(INFINITY, beta + delta);
      
        //report('lowerbound',score,depth);
      
        depth = Math.max(1,depth-1);
      }
      
      //}}}
    }

    if (statsTimeOut !== 0)
      break;
  }

  bestMoveStr = formatMove(statsBestMove);

  //uciSend('info score cp', statsBestScore);
  uciSend('bestmove',bestMoveStr);

}
```

## Section: `js/lozza.js` (lines 8803-9028, `position(...)` FEN/moves ingestion)

```javascript
//{{{  position

function position (bd, turn, rights, ep, moves) {

  for (let i=0; i < nodes.length; i++)
    initNode(nodes[i]);

  loHash = 0;
  hiHash = 0;

  //{{{  turn
  
  if (turn == 'w')
    bdTurn = WHITE;
  
  else {
    bdTurn = BLACK;
    loHash ^= loTurn;
    hiHash ^= hiTurn;
  }
  
  //}}}
  //{{{  rights
  
  bdRights = 0;
  
  for (let i=0; i < rights.length; i++) {
  
    var ch = rights.charAt(i);
  
    if (ch == 'K') bdRights |= WHITE_RIGHTS_KING;
    if (ch == 'Q') bdRights |= WHITE_RIGHTS_QUEEN;
    if (ch == 'k') bdRights |= BLACK_RIGHTS_KING;
    if (ch == 'q') bdRights |= BLACK_RIGHTS_QUEEN;
  }
  
  loHash ^= loRights[bdRights];
  hiHash ^= hiRights[bdRights];
  
  //}}}
  //{{{  board
  
  bdB.fill(EDGE);
  
  for (var i=0; i < B88.length; i++)
    bdB[B88[i]] = 0;
  
  bdZ.fill(NO_Z);
  
  wCounts.fill(0);
  bCounts.fill(0);
  
  wList.fill(EMPTY);
  bList.fill(EMPTY);
  
  wCount = 1;
  bCount = 1;
  
  let sq = 0;
  
  for (let j=0; j < bd.length; j++) {
  
    const ch  = bd.charAt(j);
    const chn = parseInt(ch);
  
    while (bdB[sq] === EDGE)
      sq++;
  
    if (isNaN(chn)) {
  
      if (ch != '/') {
  
        const obj   = MAP[ch];
        const piece = obj & PIECE_MASK;
        const col   = obj & COLOR_MASK;
  
        bdB[sq] = obj;
  
        if (col === WHITE) {
          if (piece === KING) {
            wList[0] = sq;
            bdZ[sq] = 0;
            wCounts[KING]++;
          }
          else {
            wList[wCount] = sq;
            bdZ[sq] = wCount;
            wCounts[piece]++;
            wCount++;
          }
        }
  
        else {
          if (piece === KING) {
            bList[0] = sq;
            bdZ[sq] = 0;
            bCounts[KING]++;
          }
          else {
            bList[bCount] = sq;
            bdZ[sq] = bCount;
            bCounts[piece]++;
            bCount++;
          }
        }
  
        loHash ^= loObjPieces[(obj << 8) + sq];
        hiHash ^= hiObjPieces[(obj << 8) + sq];
  
        sq++;
      }
    }
  
    else {
  
      for (let k=0; k < chn; k++) {
        bdB[sq] = 0;
        sq++;
      }
    }
  
  }
  
  //}}}
  //{{{  ep
  
  if (ep.length === 2)
    bdEp = COORDS.indexOf(ep)
  else
    bdEp = 0;
  
  loHash ^= loEP[bdEp];
  hiHash ^= hiEP[bdEp];
  
  //}}}

  repLo = 0;
  repHi = 0;

  for (let i=0; i < moves.length; i++) {
    //{{{  play move
    
    const moveStr = moves[i];
    
    let move = 0;
    
    genMoves(rootNode, bdTurn);
    
    while ((move = getNextMove(rootNode)) !== 0) {
    
      const moveStr2 = formatMove(move);
    
      if (moveStr == moveStr2) {
        makeMoveA(rootNode, move);
        bdTurn ^= COLOR_MASK;
        break;
      }
    
    }
    
    //}}}
  }

  //{{{  compact
  
  const wList2 = new Uint8Array(16);
  const bList2 = new Uint8Array(16);
  
  let next = 0;
  
  for (let i=0; i < 16; i++) {
    const sq = wList[i];
    if (sq) {
      bdZ[sq] = next;
      wList2[next++] = sq;
    }
  }
  
  wList.set(wList2);
  
  next = 0;
  
  for (let i=0; i < 16; i++) {
    const sq = bList[i];
    if (sq) {
      bdZ[sq] = next;
      bList2[next++] = sq;
    }
  }
  
  bList.set(bList2);
  
  //}}}
  //{{{  ue
  
  net_h1_a.set(net_h1_b);
  net_h2_a.set(net_h1_b);
  
  for (let sq=0; sq < 64; sq++) {
  
    const fr    = B88[sq];
    const frObj = bdB[fr];
  
    if (frObj === 0)
      continue;
  
    const off1 = IMAP[(frObj << 8) + fr];
  
    for (let h=0; h < NET_H1_SIZE; h++) {
      const idx1 = off1 + h;
      net_h1_a[h] += net_h1_w_flat[idx1];
      net_h2_a[h] += net_h2_w_flat[idx1];
    }
  
  }
  
  //}}}

  initNode(rootNode);
  objHistory.fill(BASE_HISSLIDE);

}

//}}}
//{{{  genMoves

```

## Section: `js/lozza.js` (lines 10636-11278, move formatting + UCI command handling + worker `onmessage`)

```javascript
//{{{  formatMove

function formatMove (move) {

  let moveStr = 'NULL';

  if (move !== 0) {

    const fr = (move & MOVE_FR_MASK) >>> MOVE_FR_BITS;
    const to = (move & MOVE_TO_MASK) >>> MOVE_TO_BITS;

    moveStr = COORDS[fr] + COORDS[to];

    if ((move & MOVE_PROMOTE_MASK) !== 0)
      moveStr = moveStr + PROMOTES[(move & MOVE_PROMAS_MASK) >>> MOVE_PROMAS_BITS];

  }

  return moveStr;

}

//}}}
//{{{  flipFen
//
// flipFen is slow. Only use for init/test/datagen.
//

function flipFen (fen) {

  const [board, color, castling, enPassant, halfmove, fullmove] = fen.split(' ');

  const mirroredBoard = board.split('/').reverse().map(row => {
    return row.split('').map(char => {
      if (char === char.toUpperCase()) {
        return char.toLowerCase();
      } else if (char === char.toLowerCase()) {
        return char.toUpperCase();
      }
      return char;
    }).join('');
  }).join('/');

  const mirroredColor = color === 'w' ? 'b' : 'w';

  const mirrorCastling = castling.split('').map(right => {
    switch(right) {
      case 'K': return 'k';
      case 'Q': return 'q';
      case 'k': return 'K';
      case 'q': return 'Q';
      default: return right;
    }
  }).join('');

  const mirroredEnPassant = enPassant === '-' ? '-' :
    enPassant[0] + (9 - parseInt(enPassant[1]));

  const newFen = [
    mirroredBoard,
    mirroredColor,
    mirrorCastling || '-',
    mirroredEnPassant,
    halfmove,
    fullmove
  ].join(' ');

  return newFen;
};

//}}}

//}}}
//{{{  stats

let statsStartTime = 0;
let statsNodes     = 0;
let statsMoveTime  = 0;
let statsMaxNodes  = 0;
let statsTimeOut   = 0;
let statsSelDepth  = 0;
let statsBestMove  = 0;
let statsBestScore = 0;

//{{{  initStats

function initStats () {

  statsStartTime = now();
  statsNodes     = 0;
  statsMoveTime  = 0;
  statsMaxNodes  = 0;
  statsTimeOut   = 0;
  statsSelDepth  = 0;
  statsBestMove  = 0;
  statsBestScore = 0;

}

//}}}
//{{{  checkTime

function checkTime () {

  if (statsBestMove && statsMoveTime > 0 && ((now() - statsStartTime) >= statsMoveTime))

    statsTimeOut = 1;

  if (statsBestMove && statsMaxNodes > 0 && statsNodes >= statsMaxNodes * 100)

    statsTimeOut = 1;

}

//}}}

//}}}
//{{{  uci

//{{{  uciSend

function uciSend () {

  if (silentMode)
    return;

  var s = '';

  for (var i = 0; i < arguments.length; i++)
    s += arguments[i] + ' ';

  //fs.writeSync(1, s + '\n');

  if (nodeHost)
    console.log(s);
  else
    postMessage(s);

}

//}}}
//{{{  uciGetInt

function uciGetInt (tokens, key, def) {

  for (let i=0; i < tokens.length; i++)
    if (tokens[i] == key)
      if (i < tokens.length - 1)
        return parseInt(tokens[i+1]);

  return def;

}

//}}}
//{{{  uciGetStr

function uciGetStr (tokens, key, def) {

  for (let i=0; i < tokens.length; i++)
    if (tokens[i] == key)
      if (i < tokens.length - 1)
        return tokens[i+1];

  return def;

}

//}}}
//{{{  uciGetArr

function uciGetArr (tokens, key, to) {

  var lo = 0;
  var hi = 0;

  for (let i=0; i < tokens.length; i++) {
    if (tokens[i] == key) {
      lo = i + 1;  //assumes at least one item
      hi = lo;
      for (let j=lo; j < tokens.length; j++) {
        if (tokens[j] == to)
          break;
        hi = j;
      }
    }
  }

  return {lo:lo, hi:hi};

}

//}}}
//{{{  uciExec

function uciExec (commands) {

  const cmdList = commands.split('\n');

  for (let c=0; c < cmdList.length; c++ ) {

    let cmdStr = cmdList[c].replace(/(\r\n|\n|\r)/gm,"");

    cmdStr = cmdStr.trim();
    cmdStr = cmdStr.replace(/\s+/g,' ');

    const tokens = cmdStr.split(' ');

    let cmd = tokens[0];

    if (!cmd)
      continue;

    switch (cmd) {

      case 'isready': {
        //{{{  isready
        
        uciSend('readyok');
        
        break;
        
        //}}}
      }

      case 'position':
      case 'p': {
        //{{{  position
        
        let bd     = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
        let turn   = 'w';
        let rights = 'KQkq';
        let ep     = '-';
        
        let arr = uciGetArr(tokens, 'fen', 'moves');
        
        if (arr.lo > 0) {
          if (arr.lo <= arr.hi) bd     = tokens[arr.lo]; arr.lo++;
          if (arr.lo <= arr.hi) turn   = tokens[arr.lo]; arr.lo++;
          if (arr.lo <= arr.hi) rights = tokens[arr.lo]; arr.lo++;
          if (arr.lo <= arr.hi) ep     = tokens[arr.lo]; arr.lo++;
        }
        
        const moves = [];
        
        arr = uciGetArr(tokens, 'moves', 'fen');
        
        if (arr.lo > 0) {
          for (var i=arr.lo; i <= arr.hi; i++)
            moves.push(tokens[i]);
        }
        
        position(bd, turn, rights, ep, moves);
        
        break;
        
        //}}}
      }

      case 'go':
      case 'g': {
        //{{{  go
        
        initStats();
        
        let depth     = Math.max(uciGetInt(tokens, 'depth', 0), uciGetInt(tokens, 'd', 0));
        let moveTime  = uciGetInt(tokens, 'movetime', 0);
        let maxNodes  = uciGetInt(tokens, 'nodes', 0);
        let wTime     = uciGetInt(tokens, 'wtime', 0);
        let bTime     = uciGetInt(tokens, 'btime', 0);
        let wInc      = uciGetInt(tokens, 'winc', 0);
        let bInc      = uciGetInt(tokens, 'binc', 0);
        let movesToGo = uciGetInt(tokens, 'movestogo', 0);
        
        let totTime = 0;
        let movTime = 0;
        let incTime = 0;
        
        if (depth <= 0)
          depth = MAX_PLY;
        
        if (moveTime > 0)
          statsMoveTime = moveTime;
        
        if (maxNodes > 0)
          statsMaxNodes = maxNodes;
        
        if (moveTime === 0) {
        
          if (movesToGo > 0)
            movesToGo += 2;
          else
            movesToGo = 30;
        
          if (bdTurn === WHITE) {
            totTime = wTime;
            incTime = wInc;
          }
          else {
            totTime = bTime;
            incTime = bInc;
          }
        
          movTime = myround(totTime / movesToGo) + incTime;
          movTime = movTime * 0.95;
        
          if (movTime > 0)
            statsMoveTime = movTime | 0;
        
          if (statsMoveTime < 1 && (wTime || bTime))
            statsMoveTime = 1;
        }
        
        go(depth);
        
        break;
        
        //}}}
      }

      case 'ucinewgame':
      case 'u': {
        //{{{  ucinewgame
        
        ttInit();
        
        break;
        
        //}}}
      }

      case 'quit':
      case 'q': {
        //{{{  quit
        
        process.exit();
        
        break;
        
        //}}}
      }

      case 'stop': {
        //{{{  stop
        
        break;
        
        //}}}
      }

      case 'uci': {
        //{{{  uci
        
        uciSend('id name Lozza', BUILD);
        uciSend('id author Colin Jenkins');
        uciSend('uciok');
        
        break;
        
        //}}}
      }

      case 'perft': {
        //{{{  perft
        
        uciExec('b');
        
        const depth1 = uciGetInt(tokens, 'depth', 0);
        const depth2 = uciGetInt(tokens, 'to', depth1);
        const warm = uciGetInt(tokens, 'warm', 0);
        
        for (let w=0; w < warm; w++) {
          for (let depth=depth1; depth <= depth2; depth++) {
            const nodes = perft(rootNode, depth, bdTurn);
          }
        }
        
        for (let depth=depth1; depth <= depth2; depth++) {
          const start = now();
          const nodes = perft(rootNode, depth, bdTurn);
          const elapsed = now() - start;
          const nps = nodes / elapsed * 1000 | 0;
          uciSend('depth', depth, 'nodes', nodes, 'time', elapsed, 'nps', nps);
        }
        
        break;
        
        //}}}
      }

      case 'eval':
      case 'e': {
        //{{{  eval
        
        const e = netEval(bdTurn);
        
        uciSend(e);
        
        break;
        
        //}}}
      }

      case 'board':
      case 'b': {
        //{{{  board
        
        uciSend(formatFen(bdTurn));
        
        break;
        
        //}}}
      }

      case 'bench': {
        //{{{  bench
        
        silentMode = 1;
        
        const depth = uciGetInt(tokens, 'depth', BENCH_DEPTH);
        const warm  = uciGetInt(tokens, 'warm', 1);
        
        //{{{  warmup
        
        for (let w=0; w < warm; w++) {
        
          for (var i=0; i < BENCHFENS.length; i++) {
        
            const fen = BENCHFENS[i];
        
            uciExec('ucinewgame');
            uciExec('position fen ' + fen);
            uciExec('id bench' + i);
            uciExec('go depth ' + depth);
        
          }
        
        }
        
        //}}}
        
        let nodes = 0;
        let start = now();
        
        for (let i=0; i < BENCHFENS.length; i++) {
        
          const fen = BENCHFENS[i];
        
          process.stdout.write(i.toString() + '\r');
        
          uciExec('ucinewgame');
          uciExec('position fen ' + fen);
          uciExec('id bench' + i);
          uciExec('go depth ' + depth);
        
          nodes += statsNodes;
        
        }
        
        silentMode = 0;
        
        const elapsed = now() - start;
        const nps = nodes/elapsed * 1000 | 0;
        
        uciSend('warm', warm, 'depth', depth, 'nodes', nodes, 'time', elapsed, 'nps', nps);
        
        break;
        
        //}}}
      }

      case 'qb': {
        //{{{  quick bench
        
        uciExec('bench warm 0');
        
        break;
        
        //}}}
      }


      case 'pt': {
        //{{{  perft tests
        
        let n = uciGetInt(tokens, 'n', PERFTFENS.length);
        
        silentMode = 1;
        
        const t1 = now();
        
        let errors = 0;
        let tot    = 0;
        
        for (let i=0; i < n; i++) {
        
          const p = PERFTFENS[i];
        
          const fen   = p[0];
          const depth = p[1];
          const moves = p[2];
          const id    = p[3];
        
          uciExec('ucinewgame');
          uciExec('position ' + fen);
        
          const nodes = perft(rootNode, depth, bdTurn);
        
          tot += nodes;
        
          const t2     = now();
          const sec    = Math.round((t2-t1)/100)/10;
          const secStr = sec.toString().padStart(6, ' ');
        
          let diff = nodes - moves;
        
          if (diff) {
            errors += Math.abs(diff);
            diff = '\x1b[1m' + diff + '\x1b[0m';
          }
        
          silentMode = 0;
          uciSend(secStr, id, fen, depth, diff, nodes, moves);
          silentMode = 1;
        }
        
        silentMode = 0;
        
        const elapsed = now() - t1;
        const nps = tot/elapsed * 1000 | 0;
        
        uciSend('errors', errors, 'nodes', tot, 'nps', nps);
        
        break;
        
        //}}}
      }

      case 'et': {
        //{{{  eval tests
        
        for (let i=0; i < BENCHFENS.length; i++) {
        
          uciSend();
        
          const fen = BENCHFENS[i];
        
          uciExec('ucinewgame');
          uciExec('position fen ' + fen);
          uciSend(fen, 'fen')
          uciExec('e');
        
          const flippedFen = flipFen(fen);
        
          uciExec('ucinewgame');
          uciExec('position fen ' + flippedFen);
          uciSend(flippedFen, 'flipped fen')
          uciExec('e');
        
        }
        
        break;
        
        //}}}
      }

      case 'network':
      case 'n': {
        //{{{  network
        
        uciSend('weights file', NET_WEIGHTS_FILE);
        uciSend('i_size, h1_size', NET_I_SIZE, NET_H1_SIZE);
        uciSend('qa, qb', NET_QA, NET_QB);
        uciSend('scale', NET_SCALE);
        uciSend('local', NET_LOCAL);
        
        uciExec('u');
        uciExec('p s');
        uciExec('e');
        
        break;
        
        //}}}
      }

      case 'moves':
      case 'm': {
        //{{{  moves
        
        initNode(rootNode);
        
        rootNode.inCheck = 1;
        
        let move = 0;
        
        genMoves(rootNode, bdTurn);
        
        while(move = getNextMove(rootNode))
          console.log(formatMove(move));
        
        initNode(rootNode);
        
        break;
        
        //}}}
      }

      case 'datagen': {
        //{{{  datagen
        
        datagen();
        
        break;
        
        //}}}
      }

      default: {
        //{{{  ?
        
        uciSend('unknown command', cmd);
        
        break;
        
        //}}}
      }
    }
  }

}

//}}}

//}}}
//{{{  init

const nodeHost = (typeof process) != 'undefined';

if (!nodeHost) {
  onmessage = function(e) {
    uciExec(e.data);
  }
}
```
