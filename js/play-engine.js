(function() {
    'use strict';

    const boardEl = document.getElementById('chessBoard');
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

    function updateBoardStats() {
        if (game.game_over()) {
            boardStatsEl.textContent = 'Game over';
        } else {
            const turn = game.turn() === 'w' ? 'White' : 'Black';
            const inCheck = game.in_check() ? ' • Check' : '';
            boardStatsEl.textContent = `${turn} to move${inCheck}`;
        }

        const humanColor = engineSide === 'w' ? 'Black' : 'White';
        playerSideLabel.textContent = `You: ${humanColor}`;
        engineSideLabel.textContent = `Lozza: ${engineSide === 'w' ? 'White' : 'Black'}`;

        const history = game.history();
        moveStatsEl.textContent = `${history.length} move${history.length === 1 ? '' : 's'}`;

        toolStats.textContent = `Engine: ${engineReady ? 'ready' : 'loading'} • ${engineThinking ? 'thinking' : 'idle'}`;
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
            tag.textContent = `${prefix} ${move.san}`;
            tag.addEventListener('click', () => jumpToPly(ply));
            moveListEl.appendChild(tag);
        });
    }

    function syncPgn() {
        const pgn = game.pgn({ max_width: 80, newline_char: '\n' });
        pgnTextEl.value = pgn || '[No moves yet]';
    }

    function refreshUI() {
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
        return true;
    }

    function stopEngine() {
        if (engine) engine.postMessage('stop');
        engineThinking = false;
    }

    function maybeQueueEngine() {
        if (!engineReady) return;
        if (game.game_over()) return;
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
        if (game.turn() === engineSide) {
            setStatus('Wait for Lozza to move.', 'warning');
            return;
        }

        const move = game.move({ from, to, promotion: 'q' });
        if (!move) {
            setStatus('Illegal move.', 'error');
            return;
        }

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
            return;
        }

        if (line.startsWith('info')) {
            pushEngineLine(describeInfo(line));
            return;
        }

        if (line.startsWith('bestmove')) {
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
        game = new Chess();
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
        const history = game.history({ verbose: true });
        const slice = history.slice(0, ply);
        const next = new Chess();
        slice.forEach((m) => next.move({ from: m.from, to: m.to, promotion: m.promotion }));
        game = next;
        redoStack = [];
        selectedSquare = null;
        legalTargets = [];
        activePly = ply;
        setStatus(`Jumped to move ${ply}.`, 'success');
        refreshUI();
        maybeQueueEngine();
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
