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
    const gameMovesEl = document.getElementById('gameMoves');

    const puzzleLabelEl = document.getElementById('puzzleLabel');
    const puzzleMetaPrimary = document.getElementById('puzzleMetaPrimary');
    const puzzleMetaSecondary = document.getElementById('puzzleMetaSecondary');
    const puzzleGameLink = document.getElementById('puzzleGameLink');

    const ratingInput = document.getElementById('ratingInput');
    const loadRatingBtn = document.getElementById('loadRatingBtn');
    const themeSelect = document.getElementById('themeSelect');

    const prevPuzzleBtn = document.getElementById('prevPuzzleBtn');
    const nextPuzzleBtn = document.getElementById('nextPuzzleBtn');

    const showSolutionBtn = document.getElementById('showSolutionBtn');
    const resetPuzzleBtn = document.getElementById('resetPuzzleBtn');
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');

    const backButton = document.getElementById('backButton');

    // Root for split EPD files; adjust if you used a different folder name.
    const PUZZLE_ROOT = 'data/lichess-buckets';

    // Chess state
    let game = new Chess();
    let orientation = 'white';
    let selectedSquare = null;
    let legalTargets = [];
    let redoStack = [];
    let activePly = 0;

    // Puzzles state
    const ratingCache = new Map(); // rating -> { puzzles, themes }
    let currentRating = null;
    let currentPuzzles = [];
    let currentFiltered = [];
    let currentPuzzleIndex = -1;
    let currentPuzzle = null;
    let playerColor = 'w'; // color controlled by the user for the active puzzle
    let solutionMoves = []; // principal variation (SAN tokens)
    let solutionIndex = 0; // next expected ply in solutionMoves
    let puzzleHistory = [];
    let historyPos = -1;
    let puzzleComplete = false; // whether the puzzle line is finished

    // ---------------------------------------------------------------------
    // Utility: status + stats
    // ---------------------------------------------------------------------

    function setStatus(msg, type = 'success') {
        if (!statusMessage) return;
        statusMessage.textContent = msg;
        statusMessage.className = type;
    }

    function updateToolStats() {
        if (!toolStats) return;
        if (currentRating == null || !currentPuzzles.length) {
            toolStats.textContent = 'No puzzles loaded.';
            return;
        }
        const total = currentPuzzles.length;
        const filtered = currentFiltered.length;
        toolStats.textContent =
            `Rating ${currentRating}: ${total} puzzles • ${filtered} match current theme filter`;
    }

    function updateBoardStats() {
        if (!boardStatsEl) return;

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

    // ---------------------------------------------------------------------
    // Board rendering
    // ---------------------------------------------------------------------

    function findKingSquare(color) {
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        const ranks = ['1', '2', '3', '4', '5', '6', '7', '8'];
        for (const rank of ranks) {
            for (const file of files) {
                const sq = `${file}${rank}`;
                const piece = game.get(sq);
                if (piece && piece.type === 'k' && piece.color === color) {
                    return sq;
                }
            }
        }
        return null;
    }

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
        const isCheckmate = game.in_checkmate();
        const matedColor = isCheckmate ? game.turn() : null;
        const matedSquare = isCheckmate ? findKingSquare(matedColor) : null;

        boardEl.classList.toggle('game-over', puzzleComplete || game.game_over());

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
                if (isCheckmate && square === matedSquare) squareEl.classList.add('mated');

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

    function clearGameMoves() {
        if (!gameMovesEl) return;
        gameMovesEl.innerHTML = '';
        gameMovesEl.classList.add('hidden');
    }

    function renderGameMoves(moves) {
        if (!gameMovesEl) return;
        gameMovesEl.innerHTML = '';

        if (!moves || !moves.length) {
            gameMovesEl.classList.add('hidden');
            return;
        }

        moves.forEach((san, idx) => {
            const moveNum = Math.floor(idx / 2) + 1;
            const prefix = idx % 2 === 0 ? `${moveNum}.` : `${moveNum}...`;
            const tag = document.createElement('button');
            tag.className = 'move-tag';
            tag.textContent = `${prefix} ${san}`;
            gameMovesEl.appendChild(tag);
        });

        gameMovesEl.classList.remove('hidden');
    }

    function showSolutionMovesOnComplete() {
        if (!currentPuzzle) return;
        
        // Show the full PV (principal variation) as the solution moves
        const pvMoves = currentPuzzle.pvMoves || [];
        if (pvMoves.length > 0) {
            renderGameMoves(pvMoves);
        }
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

    function sanEqual(a, b) {
        if (!a || !b) return false;
        return a.replace(/[+#]/g, '') === b.replace(/[+#]/g, '');
    }

    function autoPlayOpponentLine() {
        if (!currentPuzzle || !solutionMoves.length) return;

        let lastAuto = null;
        while (solutionIndex < solutionMoves.length && game.turn() !== playerColor) {
            const expected = solutionMoves[solutionIndex];
            const move = game.move(expected);
            if (!move) {
                setStatus(`Opponent move "${expected}" is illegal from this position.`, 'error');
                refreshBoard();
                return;
            }
            lastAuto = move.san;
            solutionIndex = game.history().length;
            activePly = solutionIndex;
        }

        refreshBoard();

        if (solutionIndex >= solutionMoves.length) {
            puzzleComplete = true;
            setStatus('Puzzle completed!', 'success');
            showSolutionMovesOnComplete();
        } else if (lastAuto) {
            setStatus(`Opponent played ${lastAuto}. Your move.`, 'success');
        }
    }

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
        const expected = solutionMoves[game.history().length];
        const move = game.move({ from, to, promotion: 'q' });
        if (!move) {
            setStatus('Illegal move.', 'error');
            return;
        }

        if (expected && !sanEqual(expected, move.san)) {
            game.undo();
            selectedSquare = null;
            legalTargets = [];
            activePly = game.history().length;
            solutionIndex = activePly;
            puzzleComplete = false;
            refreshBoard();
            setStatus(`Incorrect move. Expected ${expected}.`, 'error');
            return;
        }

        redoStack = [];
        selectedSquare = null;
        legalTargets = [];
        activePly = game.history().length;
        solutionIndex = activePly;
        puzzleComplete = solutionIndex >= solutionMoves.length || game.game_over();

        setStatus(`You played ${move.san}`, 'success');
        refreshBoard();

        if (solutionIndex >= solutionMoves.length) {
            puzzleComplete = true;
            setStatus('Puzzle completed!', 'success');
            showSolutionMovesOnComplete();
            return;
        }

        autoPlayOpponentLine();
    }

    function undoMove() {
        const move = game.undo();
        if (!move) {
            setStatus('Nothing to undo.', 'warning');
            return;
        }
        redoStack.push(move);
        activePly = game.history().length;
        solutionIndex = activePly;
        puzzleComplete = game.game_over() || (solutionIndex >= solutionMoves.length);
        setStatus('Move undone.', 'success');
        refreshBoard();
    }

    function redoMove() {
        const move = redoStack.pop();
        if (!move) {
            setStatus('Nothing to redo.', 'warning');
            return;
        }
        game.move({ from: move.from, to: move.to, promotion: move.promotion });
        activePly = game.history().length;
        solutionIndex = activePly;
        puzzleComplete = game.game_over() || (solutionIndex >= solutionMoves.length);
        setStatus('Move redone.', 'success');
        refreshBoard();

        if (puzzleComplete) {
            showSolutionMovesOnComplete();
        }
    }

    function jumpToPly(ply) {
        if (!currentPuzzle) return;

        // Rebuild from the original FEN + prefix of moves
        const fullHistory = game.history({ verbose: true });
        const slice = fullHistory.slice(0, ply);

        const next = new Chess();
        if (!next.load(currentPuzzle.fen)) {
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
        solutionIndex = game.history().length;
        puzzleComplete = game.game_over() || (solutionIndex >= solutionMoves.length);
        setStatus(`Jumped to move ${ply}.`, 'success');
        refreshBoard();

        if (puzzleComplete) {
            showSolutionMovesOnComplete();
        }
    }

    function resetPuzzle() {
        if (!currentPuzzle) return;
        loadPuzzleIntoBoard(currentPuzzle);
        setStatus('Puzzle reset to starting position.', 'success');
    }

    // ---------------------------------------------------------------------
    // EPD parsing (new format)
    // ---------------------------------------------------------------------

    const OP_KEYS = new Set(['id', 'bm', 'pv', 'c0', 'c1', 'c2', 'c3']);

    function parseLichessEpdLine(line) {
        const raw = line.trim();
        if (!raw || raw.startsWith('#')) return null;

        // Split into tokens, keeping quoted strings intact.
        const tokens = raw.match(/"[^"]*"|\S+/g);
        if (!tokens || tokens.length < 4) return null;

        // Find where the EPD operations (id, bm, c0, etc.) start.
        let opsStart = -1;
        for (let i = 4; i < tokens.length; i++) {
            if (OP_KEYS.has(tokens[i])) {
                opsStart = i;
                break;
            }
        }
        if (opsStart === -1) return null;

        const fenParts = tokens.slice(0, opsStart);
        if (fenParts.length < 4) return null;

        let fen = fenParts.join(' ');
        if (fenParts.length === 4) {
            // Append default halfmove/fullmove for Chess.js if missing.
            fen += ' 0 1';
        }

        const opTokens = tokens.slice(opsStart);
        const ops = {};

        // Scan operations: id, bm, pv, c0, c1, c2, c3.
        for (let i = 0; i < opTokens.length;) {
            const key = opTokens[i++];
            if (!OP_KEYS.has(key)) continue;

            if (key === 'bm' || key === 'pv') {
                const values = [];
                while (i < opTokens.length && !OP_KEYS.has(opTokens[i])) {
                    let v = opTokens[i++];
                    // Strip trailing semicolon on the last token.
                    if (v.endsWith(';')) {
                        v = v.slice(0, -1);
                    }
                    values.push(v);
                }
                ops[key] = values;
            } else {
                if (i >= opTokens.length) break;
                let v = opTokens[i++];
                if (v.endsWith(';')) v = v.slice(0, -1);
                if (v.startsWith('"') && v.endsWith('"')) {
                    v = v.slice(1, -1);
                }
                ops[key] = v;
            }
        }

        const id = ops.id || '';

        const c0 = ops.c0 || '';
        const c1 = ops.c1 || '';
        const c2 = ops.c2 || '';
        const c3 = ops.c3 || '';

        let rating = null;
        let popularity = null;
        let plays = null;

        if (c0) {
            const mRating = c0.match(/Rating:\s*(\d+)/i);
            if (mRating) rating = parseInt(mRating[1], 10);

            const mPopularity = c0.match(/Popularity:\s*(\d+)/i);
            if (mPopularity) popularity = parseInt(mPopularity[1], 10);

            const mPlays = c0.match(/Plays:\s*(\d+)/i);
            if (mPlays) plays = parseInt(mPlays[1], 10);
        }

        let themes = [];
        if (c1) {
            const mThemes = c1.match(/Themes:\s*(.+)$/i);
            if (mThemes) {
                themes = mThemes[1].split(/\s+/).filter(Boolean);
            }
        }

        let gameUrl = null;
        const gameText = c2 || c3 || '';
        if (gameText) {
            const mUrl = gameText.match(/https?:\/\/\S+/);
            if (mUrl) gameUrl = mUrl[0];
        }

        const bestMoves = ops.bm ? ops.bm.slice() : [];
        const pvMoves = ops.pv ? ops.pv.slice() : [];

        return {
            source: 'lichess',
            id,
            fen,
            rating,
            popularity,
            plays,
            themes,
            bestMoves,
            pvMoves,
            gameUrl,
            description: c2 || ''
        };
    }

    function ratingToPath(rating) {
        const low = Math.floor(rating / 100) * 100;
        const high = low + 99;
        const folder = `${low.toString().padStart(4, '0')}-${high.toString().padStart(4, '0')}`;
        const file = `lichess-${rating.toString().padStart(4, '0')}.epd`;
        return `${PUZZLE_ROOT}/${folder}/${file}`;
    }

    async function loadRatingFile(rating) {
        if (ratingCache.has(rating)) {
            return ratingCache.get(rating);
        }

        const url = ratingToPath(rating);
        setStatus(`Loading puzzles for rating ${rating}…`, 'warning');

        let resp;
        try {
            resp = await fetch(url);
        } catch (err) {
            throw new Error(`Failed to fetch ${url}: ${err && err.message ? err.message : err}`);
        }

        if (!resp.ok) {
            throw new Error(`Failed to load ${url}: HTTP ${resp.status}`);
        }

        const text = await resp.text();
        const lines = text.split(/\r?\n/);
        const puzzles = [];
        const themeSet = new Set();

        for (const line of lines) {
            const p = parseLichessEpdLine(line);
            if (!p) continue;
            puzzles.push(p);
            if (p.themes && p.themes.length) {
                p.themes.forEach((t) => themeSet.add(t));
            }
        }

        const themes = Array.from(themeSet).sort((a, b) => a.localeCompare(b));

        const bundle = { puzzles, themes };
        ratingCache.set(rating, bundle);

        setStatus(`Loaded ${puzzles.length} puzzles for rating ${rating}.`, 'success');
        return bundle;
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

        themeSelect.disabled = false;
        themeSelect.value = '';
    }

    function applyThemeFilter() {
        if (!currentPuzzles.length) {
            currentFiltered = [];
            currentPuzzleIndex = -1;
            currentPuzzle = null;
            puzzleHistory = [];
            historyPos = -1;
            updateToolStats();
            return;
        }

        const theme = themeSelect ? themeSelect.value : '';
        if (!theme) {
            currentFiltered = currentPuzzles.slice();
        } else {
            currentFiltered = currentPuzzles.filter((p) =>
                p.themes && p.themes.includes(theme)
            );
        }

        currentPuzzleIndex = -1;
        currentPuzzle = null;
        puzzleHistory = [];
        historyPos = -1;

        if (!currentFiltered.length) {
            updateToolStats();
            puzzleLabelEl.textContent =
                'No puzzles match this theme at the current rating.';
            puzzleMetaPrimary.textContent = 'Rating: –';
            puzzleMetaSecondary.textContent = 'Themes: –';
            if (puzzleGameLink) puzzleGameLink.classList.add('hidden');
            setStatus('No puzzles match the selected theme.', 'warning');
            refreshBoard(); // clears board state but keeps FEN if any
            return;
        }

        showRandomPuzzle();
    }

    function showPuzzleAtIndex(idx, trackHistory = true) {
        if (!currentFiltered.length) return;

        if (idx < 0 || idx >= currentFiltered.length) return;

        currentPuzzleIndex = idx;
        const puzzle = currentFiltered[idx];
        currentPuzzle = puzzle;

        if (trackHistory) {
            if (historyPos < puzzleHistory.length - 1) {
                puzzleHistory = puzzleHistory.slice(0, historyPos + 1);
            }
            puzzleHistory.push(idx);
            historyPos = puzzleHistory.length - 1;
        }

        loadPuzzleIntoBoard(puzzle);

        const ratingText = puzzle.rating != null ? `Rating: ${puzzle.rating}` : 'Rating: n/a';
        const popText = puzzle.popularity != null ? `Popularity: ${puzzle.popularity}` : 'Popularity: n/a';
        const playsText = puzzle.plays != null ? `Plays: ${puzzle.plays}` : 'Plays: n/a';

        puzzleLabelEl.textContent =
            `Lichess • ${puzzle.id || 'Puzzle'} • ${idx + 1} of ${currentFiltered.length}`;

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

    function showRandomPuzzle() {
        if (!currentFiltered.length) return;
        const idx = Math.floor(Math.random() * currentFiltered.length);
        showPuzzleAtIndex(idx);
    }

    function loadPuzzleIntoBoard(puzzle) {
        const next = new Chess();
        if (!next.load(puzzle.fen)) {
            setStatus('Unable to load puzzle FEN.', 'error');
            return;
        }

        game = next;
        redoStack = [];
        selectedSquare = null;
        legalTargets = [];
        activePly = 0;
        playerColor = next.turn();
        puzzleComplete = false;
        clearGameMoves();

        if (puzzle.pvMoves && puzzle.pvMoves.length) {
            solutionMoves = puzzle.pvMoves.slice();
        } else if (puzzle.bestMoves && puzzle.bestMoves.length) {
            solutionMoves = puzzle.bestMoves.slice();
        } else {
            solutionMoves = [];
        }
        solutionIndex = 0;

        const sideToMove = next.turn(); // 'w' or 'b'
        orientation = sideToMove === 'w' ? 'white' : 'black';

        refreshBoard();
        if (game.in_checkmate()) {
            puzzleComplete = true;
            setStatus('Puzzle completed!', 'success');
            showSolutionMovesOnComplete();
        }
    }

    // ---------------------------------------------------------------------
    // Solution preview: EPD "bm" candidates
    // ---------------------------------------------------------------------

    function showSolutionPreview() {
        solutionMovesEl.innerHTML = '';

        if (!currentPuzzle) {
            setStatus('No puzzle selected.', 'warning');
            return;
        }

        const candidates = currentPuzzle.bestMoves || [];
        if (!candidates.length) {
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

        candidates.forEach((san) => {
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
        solutionIndex = activePly;

        refreshBoard();
        setStatus(`Applied best-move candidate: ${san}`, 'success');
    }

    // ---------------------------------------------------------------------
    // Controls / init
    // ---------------------------------------------------------------------

    function parseRatingInput() {
        if (!ratingInput) return null;
        const raw = ratingInput.value.trim();
        if (!raw) return null;
        let r = parseInt(raw, 10);
        if (!Number.isFinite(r)) return null;
        if (r < 300) r = 300;
        if (r > 3399) r = 3399;
        ratingInput.value = String(r);
        return r;
    }

    async function loadCurrentRating() {
        const rating = parseRatingInput();
        if (rating == null) {
            setStatus('Enter a rating between 300 and 3399.', 'warning');
            return;
        }

        let bundle;
        try {
            bundle = await loadRatingFile(rating);
        } catch (err) {
            setStatus(err && err.message ? err.message : String(err), 'error');
            currentRating = null;
            currentPuzzles = [];
            currentFiltered = [];
            currentPuzzleIndex = -1;
            currentPuzzle = null;
            refreshBoard();
            updateToolStats();
            return;
        }

        currentRating = rating;
        currentPuzzles = bundle.puzzles || [];
        currentFiltered = currentPuzzles.slice();
        currentPuzzleIndex = -1;
        currentPuzzle = null;
        puzzleHistory = [];
        historyPos = -1;
        clearGameMoves();

        if (!currentPuzzles.length) {
            puzzleLabelEl.textContent = `No puzzles found for rating ${rating}.`;
            puzzleMetaPrimary.textContent = 'Rating: -';
            puzzleMetaSecondary.textContent = 'Themes: -';
            if (puzzleGameLink) puzzleGameLink.classList.add('hidden');
            setStatus(`No puzzles available for rating ${rating}.`, 'warning');
            refreshBoard();
            updateToolStats();
            return;
        }

        populateThemeSelect(bundle.themes || []);
        updateToolStats();
        showRandomPuzzle();
    }

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
                if (historyPos > 0) {
                    historyPos -= 1;
                    const idx = puzzleHistory[historyPos];
                    showPuzzleAtIndex(idx, false);
                } else {
                    setStatus('No previous puzzle in history.', 'warning');
                }
            });
        }

        if (nextPuzzleBtn) {
            nextPuzzleBtn.addEventListener('click', () => {
                if (!currentFiltered.length) return;
                if (historyPos < puzzleHistory.length - 1) {
                    historyPos += 1;
                    const idx = puzzleHistory[historyPos];
                    showPuzzleAtIndex(idx, false);
                } else {
                    showRandomPuzzle();
                }
            });
        }

        if (showSolutionBtn) {
            showSolutionBtn.addEventListener('click', showSolutionPreview);
        }

        if (loadRatingBtn) {
            loadRatingBtn.addEventListener('click', () => {
                loadCurrentRating();
            });
        }

        if (ratingInput) {
            ratingInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    loadCurrentRating();
                }
            });
        }

        if (themeSelect) {
            themeSelect.addEventListener('change', () => {
                applyThemeFilter();
            });
        }
    }

    function init() {
        initControls();
        setStatus('Select a rating and click “Load rating”.', 'warning');
        updateToolStats();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
