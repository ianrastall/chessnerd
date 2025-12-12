(function () {
    'use strict';

    const boardEl = document.getElementById('chessBoard');
    if (!boardEl) return;

    // Coordinate labels
    const filesTopEl = document.getElementById('filesTop');
    const filesBottomEl = document.getElementById('filesBottom');
    const ranksLeftEl = document.getElementById('ranksLeft');
    const ranksRightEl = document.getElementById('ranksRight');

    // UI elements
    const puzzleMoveListEl = document.getElementById('puzzleMoveList');
    const solutionMovesEl = document.getElementById('solutionMoves');
    const moveStatsEl = document.getElementById('moveStats');
    const boardStatsEl = document.getElementById('boardStats');
    const statusMessage = document.getElementById('statusMessage');
    const toolStats = document.getElementById('toolStats');

    const puzzleLabelEl = document.getElementById('puzzleLabel');
    const puzzleMetaPrimary = document.getElementById('puzzleMetaPrimary');
    const puzzleMetaSecondary = document.getElementById('puzzleMetaSecondary');
    const puzzleGameLink = document.getElementById('puzzleGameLink');

    const ratingBucketSelect = document.getElementById('ratingBucket');
    const themeSelect = document.getElementById('themeSelect');

    const prevPuzzleBtn = document.getElementById('prevPuzzleBtn');
    const nextPuzzleBtn = document.getElementById('nextPuzzleBtn');
    const randomPuzzleBtn = document.getElementById('randomPuzzleBtn');

    const showSolutionBtn = document.getElementById('showSolutionBtn');
    const resetPuzzleBtn = document.getElementById('resetPuzzleBtn');
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');

    const backButton = document.getElementById('backButton');

    // Chess state
    let game = new Chess();
    let orientation = 'white';
    let selectedSquare = null;
    let legalTargets = [];
    let redoStack = [];
    let activePly = 0;
    let engine = null;
    let engineReady = false;
    let engineThinking = false;

    // Puzzles state
    const bucketCache = {}; // key -> { puzzles, themes, skipped }
    let currentBucketKey = null;
    let currentPuzzles = [];
    let currentFiltered = [];
    let currentPuzzleIndex = -1;
    let currentPuzzle = null;

    // ---------------------------------------------------------------------
    // Status / stats
    // ---------------------------------------------------------------------

    function setStatus(msg, type = 'success') {
        if (!statusMessage) return;
        statusMessage.textContent = msg;
        statusMessage.className = type;
    }

    function updateToolStats() {
        if (!toolStats) return;
        if (!currentBucketKey || !currentPuzzles.length) {
            toolStats.textContent = 'No puzzles loaded.';
            return;
        }
        const filtered = currentFiltered.length;
        toolStats.textContent =
            `Bucket ${currentBucketKey}: ${currentPuzzles.length} puzzles • ` +
            `${filtered} match current filters`;
    }

    function resetUiToBlank(message = 'No puzzle loaded.') {
        currentPuzzle = null;
        currentPuzzleIndex = -1;
        selectedSquare = null;
        legalTargets = [];
        redoStack = [];
        activePly = 0;
        orientation = 'white';
        stopEngineSearch();

        const blank = new Chess();
        blank.clear();
        game = blank;

        if (puzzleMoveListEl) puzzleMoveListEl.innerHTML = '';
        if (solutionMovesEl) solutionMovesEl.innerHTML = '';

        refreshBoard();
        if (boardStatsEl) boardStatsEl.textContent = message;
        if (moveStatsEl) moveStatsEl.textContent = '0 moves';

        if (puzzleLabelEl) puzzleLabelEl.textContent = message;
        if (puzzleMetaPrimary) puzzleMetaPrimary.textContent = 'Rating: -';
        if (puzzleMetaSecondary) puzzleMetaSecondary.textContent = 'Themes: -';
        if (puzzleGameLink) {
            puzzleGameLink.href = '#';
            puzzleGameLink.textContent = '';
            puzzleGameLink.classList.add('hidden');
        }
    }

    function updateBoardStats() {
        if (!boardStatsEl) return;

        if (!currentPuzzle) {
            boardStatsEl.textContent = 'No puzzle loaded.';
            if (moveStatsEl) {
                moveStatsEl.textContent = '0 moves';
            }
            return;
        }

        if (game.game_over()) {
            let msg = 'Game over.';
            if (game.in_checkmate()) {
                msg = 'Checkmate.';
            } else if (game.in_stalemate()) {
                msg = 'Draw by stalemate.';
            } else if (game.insufficient_material()) {
                msg = 'Draw by insufficient material.';
            } else if (game.in_threefold_repetition()) {
                msg = 'Draw by threefold repetition.';
            } else if (game.in_draw()) {
                msg = 'Draw.';
            }
            boardStatsEl.textContent = msg;
        } else {
            const turn = game.turn() === 'w' ? 'White' : 'Black';
            const inCheck = game.in_check() ? ' • Check' : '';
            boardStatsEl.textContent = `${turn} to move${inCheck}`;
        }

        const history = game.history();
        if (moveStatsEl) {
            moveStatsEl.textContent = `${history.length} move${history.length === 1 ? '' : 's'}`;
        }
    }

    function normalizeSan(san) {
        return (san || '')
            .replace(/0/g, 'O')
            .replace(/[+#?!]/g, '')
            .trim()
            .toLowerCase();
    }

    function isCorrectFirstMove(moveSan, plyBefore) {
        if (plyBefore > 0) return true; // Only validate the very first move; later moves are free play.
        if (!currentPuzzle) return true;
        const best = currentPuzzle.bestMoves || [];
        if (!best.length) return true;
        const norm = normalizeSan(moveSan);
        return best.some((bm) => normalizeSan(bm) === norm);
    }

    // ---------------------------------------------------------------------
    // Board rendering
    // ---------------------------------------------------------------------

    function renderCoords(files, ranks) {
        if (filesTopEl) filesTopEl.innerHTML = files.map((f) => `<span>${f}</span>`).join('');
        if (filesBottomEl) filesBottomEl.innerHTML = files.map((f) => `<span>${f}</span>`).join('');
        if (ranksLeftEl) ranksLeftEl.innerHTML = ranks.map((r) => `<span>${r}</span>`).join('');
        if (ranksRightEl) ranksRightEl.innerHTML = ranks.map((r) => `<span>${r}</span>`).join('');
    }

    function renderBoard() {
        boardEl.innerHTML = '';
        boardEl.dataset.orientation = orientation;

        const files = orientation === 'white'
            ? ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
            : ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'];
        const ranks = orientation === 'white'
            ? ['8', '7', '6', '5', '4', '3', '2', '1']
            : ['1', '2', '3', '4', '5', '6', '7', '8'];

        const history = game.history({ verbose: true });
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

                const piece = game.get(square);
                if (piece) {
                    const pieceEl = document.createElement('div');
                    pieceEl.className = 'piece';
                    pieceEl.dataset.piece = piece.color + piece.type.toUpperCase();
                    squareEl.appendChild(pieceEl);
                }

                squareEl.addEventListener('click', () => handleSquareClick(square));
                boardEl.appendChild(squareEl);
            });
        });

        renderCoords(files, ranks);
    }

    function renderMoveHistory() {
        if (!puzzleMoveListEl) return;
        const history = game.history({ verbose: true });

        puzzleMoveListEl.innerHTML = '';

        const startBtn = document.createElement('button');
        startBtn.className = `move-tag ${activePly === 0 ? 'active' : ''}`;
        startBtn.textContent = 'Start';
        startBtn.addEventListener('click', () => jumpToPly(0));
        puzzleMoveListEl.appendChild(startBtn);

        history.forEach((move, idx) => {
            const ply = idx + 1;
            const moveNum = Math.floor(idx / 2) + 1;
            const prefix = move.color === 'w' ? `${moveNum}.` : `${moveNum}...`;
            const tag = document.createElement('button');
            tag.className = `move-tag ${activePly === ply ? 'active' : ''}`;
            tag.textContent = `${prefix} ${move.san}`;
            tag.addEventListener('click', () => jumpToPly(ply));
            puzzleMoveListEl.appendChild(tag);
        });
    }

    function refreshBoard() {
        renderBoard();
        renderMoveHistory();
        updateBoardStats();
    }

    // ---------------------------------------------------------------------
    // Board interaction
    // ---------------------------------------------------------------------

    function handleSquareClick(square) {
        if (game.game_over()) return;

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
        if (piece && piece.color === game.turn()) {
            selectedSquare = square;
            legalTargets = game.moves({ square, verbose: true }).map((m) => m.to);
        } else {
            selectedSquare = null;
            legalTargets = [];
        }
        renderBoard();
    }

    function attemptMove(from, to) {
        if (engineThinking) {
            setStatus('Wait for the puzzle reply first.', 'warning');
            return;
        }

        const plyBefore = game.history().length;
        const move = game.move({ from, to, promotion: 'q' });
        if (!move) {
            setStatus('Illegal move.', 'error');
            return;
        }

        if (!isCorrectFirstMove(move.san, plyBefore)) {
            game.undo();
            selectedSquare = null;
            legalTargets = [];
            setStatus('That is not one of the puzzle\'s best moves. Try again.', 'error');
            renderBoard();
            return;
        }

        redoStack = [];
        selectedSquare = null;
        legalTargets = [];
        activePly = game.history().length;

        const validated = (currentPuzzle?.bestMoves || []).length
            ? 'Correct best move! Puzzle replying…'
            : `You played ${move.san}`;

        setStatus(validated, 'success');
        refreshBoard();
        queuePuzzleReply();
    }

    function undoMove() {
        stopEngineSearch();
        const move = game.undo();
        if (!move) {
            setStatus('Nothing to undo.', 'warning');
            return;
        }
        redoStack.push(move);
        activePly = game.history().length;
        setStatus('Move undone.', 'success');
        refreshBoard();
    }

    function redoMove() {
        stopEngineSearch();
        const move = redoStack.pop();
        if (!move) {
            setStatus('Nothing to redo.', 'warning');
            return;
        }
        game.move({ from: move.from, to: move.to, promotion: move.promotion });
        activePly = game.history().length;
        setStatus('Move redone.', 'success');
        refreshBoard();
    }

    function stopEngineSearch() {
        if (engine) {
            try {
                engine.postMessage('stop');
            } catch (err) {
                // ignore
            }
        }
        engineThinking = false;
    }

    function pickReplyMove(moves) {
        const value = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
        let best = moves[0];
        let bestScore = -1;
        moves.forEach((m) => {
            let score = 0;
            if (m.flags && (m.flags.includes('c') || m.flags.includes('e'))) {
                score += 10 + (value[m.captured?.toLowerCase()] || 0);
            }
            if (m.san.includes('#')) score += 50;
            else if (m.san.includes('+')) score += 5;
            if (score > bestScore) {
                bestScore = score;
                best = m;
            }
        });
        return best;
    }

    function applyReplyMove(reply) {
        let move;
        if (typeof reply === 'string') {
            const from = reply.slice(0, 2);
            const to = reply.slice(2, 4);
            const promotion = reply.length > 4 ? reply[4] : undefined;
            move = game.move({ from, to, promotion });
        } else {
            move = game.move({ from: reply.from, to: reply.to, promotion: reply.promotion });
        }

        if (!move) {
            setStatus('Puzzle could not find a valid reply.', 'warning');
            engineThinking = false;
            refreshBoard();
            return;
        }

        redoStack = [];
        selectedSquare = null;
        legalTargets = [];
        activePly = game.history().length;
        engineThinking = false;

        setStatus(`Puzzle played ${move.san}`, 'success');
        refreshBoard();
    }

    function autoReplyFallback() {
        const replies = game.moves({ verbose: true });
        if (!replies.length) {
            engineThinking = false;
            refreshBoard();
            return;
        }
        const reply = pickReplyMove(replies);
        applyReplyMove(reply);
    }

    function queuePuzzleReply() {
        if (game.game_over()) {
            updateBoardStats();
            return;
        }

        const replies = game.moves({ verbose: true });
        if (!replies.length) {
            updateBoardStats();
            return;
        }

        if (engineReady && engine) {
            engineThinking = true;
            const fen = game.fen();
            try {
                engine.postMessage('stop');
                engine.postMessage(`position fen ${fen}`);
                engine.postMessage('go movetime 800');
                setStatus('Puzzle is thinking of a reply…', 'warning');
                return;
            } catch (err) {
                engineThinking = false;
            }
        }

        // Fallback if engine not ready or failed
        autoReplyFallback();
    }

    function jumpToPly(ply) {
        if (!currentPuzzle) return;
        stopEngineSearch();
        const fullHistory = game.history({ verbose: true });
        const slice = fullHistory.slice(0, ply);

        const next = new Chess();
        const ok = next.load(currentPuzzle.fen);
        if (!ok) {
            setStatus('Unable to reload puzzle FEN.', 'error');
            return;
        }

        slice.forEach((m) => {
            next.move({ from: m.from, to: m.to, promotion: m.promotion });
        });

        game = next;
        redoStack = [];
        selectedSquare = null;
        legalTargets = [];
        activePly = ply;
        setStatus(`Jumped to move ${ply}.`, 'success');
        refreshBoard();
    }

    function resetPuzzle() {
        if (!currentPuzzle) return;
        loadPuzzleIntoBoard(currentPuzzle);
        setStatus('Puzzle reset to starting position.', 'success');
    }

    // ---------------------------------------------------------------------
    // EPD parsing (Lichess)
    // ---------------------------------------------------------------------

    function parseOps(rest) {
        const ops = {};
        if (!rest) return ops;

        const chunks = rest.split(';');
        for (const chunk of chunks) {
            const s = chunk.trim();
            if (!s) continue;
            const spaceIndex = s.indexOf(' ');
            if (spaceIndex < 0) continue;
            const key = s.slice(0, spaceIndex);
            let value = s.slice(spaceIndex + 1).trim();

            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith('\'') && value.endsWith('\''))) {
                value = value.slice(1, -1);
            }

            ops[key] = value;
        }
        return ops;
    }

    function parseLichessEpdLine(line) {
        const raw = line.trim();
        if (!raw || raw.startsWith('#')) return null;

        const tokens = raw.split(/\s+/);
        if (tokens.length < 5) return null;

        // Detect 4-field vs 6-field FEN
        let fenFields = 4;
        if (tokens.length >= 6 && /^[0-9]+$/.test(tokens[4])) {
            // token[4] is halfmove clock, so we have 6-field FEN
            fenFields = 6;
        }

        const fenTokens = tokens.slice(0, fenFields);
        let fen = fenTokens.join(' ');

        // If only 4-field FEN, append default halfmove/fullmove
        if (fenFields === 4) {
            fen = fen + ' 0 1';
        }

        let rest = '';
        if (tokens.length > fenFields) {
            const firstOpToken = tokens[fenFields];
            const restIndex = raw.indexOf(firstOpToken);
            rest = restIndex >= 0 ? raw.slice(restIndex) : '';
        }

        const ops = parseOps(rest);

        const id = ops.id || '';

        let rating = null;
        let popularity = null;
        let plays = null;

        if (ops.c0) {
            const mRating = ops.c0.match(/Rating:\s*(\d+)/i);
            if (mRating) rating = parseInt(mRating[1], 10);

            const mPopularity = ops.c0.match(/Popularity:\s*(\d+)/i);
            if (mPopularity) popularity = parseInt(mPopularity[1], 10);

            const mPlays = ops.c0.match(/Plays:\s*(\d+)/i);
            if (mPlays) plays = parseInt(mPlays[1], 10);
        }

        let themes = [];
        if (ops.c1) {
            const mThemes = ops.c1.match(/Themes:\s*(.+)$/i);
            if (mThemes) {
                themes = mThemes[1].split(/\s+/).filter(Boolean);
            }
        }

        const gameUrlMatch = ops.c3 ? ops.c3.match(/https?:\/\/\S+/) : null;
        const gameUrl = gameUrlMatch ? gameUrlMatch[0] : null;

        const bmRaw = ops.bm || '';
        const bestMoves = bmRaw ? bmRaw.split(/\s+/).filter(Boolean) : [];

        const description = ops.c2 || '';

        const puzzle = {
            source: 'lichess',
            id,
            fen,
            rating,
            popularity,
            plays,
            themes,
            bestMoves,
            gameUrl,
            description
        };

        return puzzle;
    }

    async function loadBucket(bucketKey, url) {
        if (bucketCache[bucketKey]) {
            const cached = bucketCache[bucketKey];
            setStatus(`Loaded ${cached.puzzles.length} puzzles for ${bucketKey} (cached).`, 'success');
            return cached;
        }

        setStatus(`Loading puzzles for ${bucketKey}…`, 'warning');

        const resp = await fetch(url);
        if (!resp.ok) {
            throw new Error(`Failed to load ${url}: HTTP ${resp.status}`);
        }

        const text = await resp.text();
        const lines = text.split(/\r?\n/);
        const puzzles = [];
        const themeSet = new Set();
        let skipped = 0;

        for (const line of lines) {
            const p = parseLichessEpdLine(line);
            if (!p) {
                if (line.trim()) skipped += 1;
                continue;
            }
            puzzles.push(p);
            if (p.themes && p.themes.length) {
                p.themes.forEach((t) => themeSet.add(t));
            }
        }

        const themes = Array.from(themeSet).sort((a, b) => a.localeCompare(b));

        bucketCache[bucketKey] = { puzzles, themes, skipped };
        const skippedText = skipped ? ` Skipped ${skipped} invalid lines.` : '';
        setStatus(`Loaded ${puzzles.length} puzzles for ${bucketKey}.${skippedText}`, 'success');
        return bucketCache[bucketKey];
    }

    // ---------------------------------------------------------------------
    // Filtering + puzzle selection
    // ---------------------------------------------------------------------

    function populateThemeSelect(themes) {
        if (!themeSelect) return;

        themeSelect.innerHTML = '';
        const anyOpt = document.createElement('option');
        anyOpt.value = '';
        anyOpt.textContent = 'Any theme';
        themeSelect.appendChild(anyOpt);

        themes.forEach((t) => {
            const opt = document.createElement('option');
            opt.value = t;
            opt.textContent = t;
            themeSelect.appendChild(opt);
        });

        themeSelect.value = '';
    }

    async function handleRatingBucketChange() {
        if (!ratingBucketSelect) return;
        const opt = ratingBucketSelect.options[ratingBucketSelect.selectedIndex];
        if (!opt) return;

        const bucketKey = opt.value;
        const url = opt.dataset.file;
        if (!url) {
            setStatus('No EPD file configured for this rating range.', 'error');
            resetUiToBlank('No puzzle loaded.');
            updateToolStats();
            return;
        }

        currentBucketKey = bucketKey;

        let bucketData;
        try {
            bucketData = await loadBucket(bucketKey, url);
        } catch (err) {
            setStatus(err.message || String(err), 'error');
            resetUiToBlank('Unable to load puzzles.');
            updateToolStats();
            return;
        }

        currentPuzzles = bucketData.puzzles || [];
        currentFiltered = currentPuzzles.slice();
        currentPuzzleIndex = -1;
        currentPuzzle = null;

        populateThemeSelect(bucketData.themes || []);
        updateToolStats();

        if (!currentFiltered.length) {
            resetUiToBlank(`No puzzles found for ${bucketKey}.`);
            setStatus(`No puzzles available for ${bucketKey}.`, 'warning');
            return;
        }

        showPuzzleAtIndex(0);
    }

    function handleThemeChange() {
        if (!currentPuzzles.length) {
            setStatus('Load a rating range first.', 'warning');
            return;
        }
        if (!themeSelect) return;

        const theme = themeSelect.value;
        if (!theme) {
            currentFiltered = currentPuzzles.slice();
        } else {
            currentFiltered = currentPuzzles.filter((p) =>
                p.themes && p.themes.includes(theme)
            );
        }

        currentPuzzleIndex = -1;
        currentPuzzle = null;

        if (!currentFiltered.length) {
            updateToolStats();
            resetUiToBlank('No puzzles match this theme in the current rating range.');
            setStatus('No puzzles match the selected theme.', 'warning');
            return;
        }

        showPuzzleAtIndex(0);
    }

    function showPuzzleAtIndex(idx) {
        if (!currentFiltered.length) return;

        if (idx < 0) idx = currentFiltered.length - 1;
        if (idx >= currentFiltered.length) idx = 0;

        currentPuzzleIndex = idx;
        const puzzle = currentFiltered[idx];
        currentPuzzle = puzzle;

        loadPuzzleIntoBoard(puzzle);

        const ratingText = puzzle.rating != null ? `Rating: ${puzzle.rating}` : 'Rating: n/a';
        const popText = puzzle.popularity != null ? `Popularity: ${puzzle.popularity}` : 'Popularity: n/a';
        const playsText = puzzle.plays != null ? `Plays: ${puzzle.plays}` : 'Plays: n/a';

        puzzleLabelEl.textContent =
            `Lichess • ${puzzle.id || 'Puzzle'} • #${idx + 1} of ${currentFiltered.length}`;

        puzzleMetaPrimary.textContent = `${ratingText} • ${popText} • ${playsText}`;

        const themeText = (puzzle.themes && puzzle.themes.length)
            ? `Themes: ${puzzle.themes.join(', ')}`
            : 'Themes: n/a';
        puzzleMetaSecondary.textContent = themeText;

        if (puzzle.gameUrl) {
            puzzleGameLink.href = puzzle.gameUrl;
            puzzleGameLink.textContent = 'View source game';
            puzzleGameLink.classList.remove('hidden');
        } else {
            puzzleGameLink.href = '#';
            puzzleGameLink.textContent = '';
            puzzleGameLink.classList.add('hidden');
        }

        solutionMovesEl.innerHTML = '';
        updateToolStats();
        setStatus(`Loaded puzzle ${idx + 1} of ${currentFiltered.length}.`, 'success');
    }

    function loadPuzzleIntoBoard(puzzle) {
        const next = new Chess();
        const ok = next.load(puzzle.fen);
        if (!ok) {
            setStatus('Unable to load puzzle FEN.', 'error');
            return;
        }

        game = next;
        redoStack = [];
        selectedSquare = null;
        legalTargets = [];
        activePly = 0;
        stopEngineSearch();

        const fenParts = puzzle.fen.split(/\s+/);
        const sideToMove = fenParts[1] || 'w';
        orientation = sideToMove === 'w' ? 'white' : 'black';

        if (engineReady && engine) {
            engine.postMessage('ucinewgame');
        }

        refreshBoard();
    }

    // ---------------------------------------------------------------------
    // Solution preview: Lichess "bm" candidates
    // ---------------------------------------------------------------------

    function showSolutionPreview() {
        solutionMovesEl.innerHTML = '';

        if (!currentPuzzle) {
            setStatus('No puzzle selected.', 'warning');
            return;
        }

        if (!currentPuzzle.bestMoves || !currentPuzzle.bestMoves.length) {
            const info = document.createElement('div');
            info.className = 'stats';
            info.textContent = 'No best-move information available for this puzzle.';
            solutionMovesEl.appendChild(info);
            setStatus('No best-move information in EPD.', 'warning');
            return;
        }

        const info = document.createElement('div');
        info.className = 'stats';
        info.style.width = '100%';
        info.textContent = 'Click a best-move candidate to apply it from the starting position:';
        solutionMovesEl.appendChild(info);

        currentPuzzle.bestMoves.forEach((san) => {
            const tag = document.createElement('button');
            tag.className = 'move-tag';
            tag.textContent = san;
            tag.addEventListener('click', () => {
                previewBestMoveFromStart(san);
            });
            solutionMovesEl.appendChild(tag);
        });

        setStatus('Showing best-move candidates from EPD.', 'success');
    }

    function previewBestMoveFromStart(san) {
        if (!currentPuzzle) return;

        const next = new Chess();
        if (!next.load(currentPuzzle.fen)) {
            setStatus('Unable to reload puzzle FEN for preview.', 'error');
            return;
        }

        const move = next.move(san);
        if (!move) {
            setStatus(`Failed to apply best move "${san}".`, 'error');
            return;
        }

        game = next;
        redoStack = [];
        selectedSquare = null;
        legalTargets = [];
        activePly = game.history().length;

        refreshBoard();
        setStatus(`Applied best-move candidate: ${san}`, 'success');
    }

    // ---------------------------------------------------------------------
    // Lightweight puzzle reply engine (Lozza)
    // ---------------------------------------------------------------------

    function handleEngineMessage(e) {
        const line = (e.data || '').toString().trim();
        if (!line) return;

        if (line === 'uciok') {
            engine?.postMessage('isready');
            return;
        }

        if (line === 'readyok') {
            engineReady = true;
            setStatus('Puzzle reply engine ready.', 'success');
            engine?.postMessage('ucinewgame');
            return;
        }

        if (line.startsWith('bestmove')) {
            const parts = line.split(/\s+/);
            const mv = parts[1];
            engineThinking = false;
            if (!mv || mv === '(none)') {
                autoReplyFallback();
                return;
            }
            applyReplyMove(mv);
        }
    }

    function initEngine() {
        try {
            engine = new Worker('js/lozza.js');
            engine.onmessage = handleEngineMessage;
            engine.onerror = (err) => setStatus(`Puzzle engine error: ${err.message || err}`, 'error');
            engine.postMessage('uci');
            setStatus('Starting puzzle reply engine…', 'warning');
        } catch (err) {
            engine = null;
            engineReady = false;
            setStatus('Puzzle reply engine unavailable; using fallback replies.', 'warning');
        }
    }

    // ---------------------------------------------------------------------
    // Controls / init
    // ---------------------------------------------------------------------

    function initControls() {
        if (backButton) {
            backButton.addEventListener('click', () => {
                window.location.href = 'index.html';
            });
        }

        if (undoBtn) undoBtn.addEventListener('click', undoMove);
        if (redoBtn) redoBtn.addEventListener('click', redoMove);
        if (resetPuzzleBtn) resetPuzzleBtn.addEventListener('click', resetPuzzle);

        if (prevPuzzleBtn) {
            prevPuzzleBtn.addEventListener('click', () => {
                if (!currentFiltered.length) return;
                showPuzzleAtIndex(currentPuzzleIndex - 1);
            });
        }

        if (nextPuzzleBtn) {
            nextPuzzleBtn.addEventListener('click', () => {
                if (!currentFiltered.length) return;
                showPuzzleAtIndex(currentPuzzleIndex + 1);
            });
        }

        if (randomPuzzleBtn) {
            randomPuzzleBtn.addEventListener('click', () => {
                if (!currentFiltered.length) return;
                const idx = Math.floor(Math.random() * currentFiltered.length);
                showPuzzleAtIndex(idx);
            });
        }

        if (showSolutionBtn) {
            showSolutionBtn.addEventListener('click', showSolutionPreview);
        }

        if (ratingBucketSelect) {
            ratingBucketSelect.addEventListener('change', () => {
                handleRatingBucketChange();
            });
        }

        if (themeSelect) {
            themeSelect.addEventListener('change', () => {
                handleThemeChange();
            });
        }
    }

    async function init() {
        initControls();
        initEngine();
        setStatus('Loading initial rating bucket…', 'warning');

        // Auto-load the first bucket so the user sees something immediately.
        if (ratingBucketSelect && ratingBucketSelect.options.length > 0) {
            await handleRatingBucketChange();
        } else {
            setStatus('No rating buckets configured.', 'error');
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
