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
    let skipBestmoveCount = 0;
    let skipInfoUntilBestmove = false;
    let initialFen = game.fen();
    let initialFenUci = toUciFen(initialFen);
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

    function toUciFen(fen) {
        const parts = (fen || '').trim().split(/\s+/);
        if (parts.length < 4) return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -';
        return parts.slice(0, 4).join(' ');
    }

    function normalizeFenInput(fen) {
        const trimmed = (fen || '').trim();
        if (!trimmed) return '';
        const parts = trimmed.split(/\s+/);
        if (parts.length === 4) {
            return `${parts.join(' ')} 0 1`;
        }
        return trimmed;
    }

    function setInitialFen(fen) {
        const candidate = normalizeFenInput(fen);
        if (candidate) {
            const test = new Chess();
            if (test.load(candidate)) {
                initialFen = test.fen();
                initialFenUci = toUciFen(initialFen);
                return;
            }
        }
        const start = new Chess();
        initialFen = start.fen();
        initialFenUci = toUciFen(initialFen);
    }

    function setInitialFenFromHeaders(headers) {
        const fen = headers?.FEN;
        setInitialFen(fen || '');
    }

    function buildPositionCommand(moves) {
        if (!moves.length) {
            return `position fen ${initialFenUci}`;
        }
        return `position fen ${initialFenUci} moves ${moves.join(' ')}`;
    }

    function markEngineUnavailable(message) {
        engineReady = false;
        engineThinking = false;
        analysisActive = false;
        analysisCurrent = null;
        skipBestmoveCount = 0;
        skipInfoUntilBestmove = false;
        updateEngineStatus('Engine unavailable', '');
        updateAnalyzeButton();
        setStatus(message, 'error');
    }

    function postEngineCommand(command, reportError = true) {
        if (!engine) {
            if (reportError) {
                markEngineUnavailable('Engine worker is not available.');
            }
            return false;
        }
        try {
            engine.postMessage(command);
            return true;
        } catch (err) {
            if (reportError) {
                markEngineUnavailable(`Engine communication failed: ${err.message || err}`);
            }
            return false;
        }
    }

    function markSearchCanceled() {
        skipBestmoveCount += 1;
        skipInfoUntilBestmove = true;
    }

    function resetEngineLog(message = 'Engine info will appear here during search.') {
        engineLines = [];
        engineLogEl.textContent = message;
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

        if (!merged.Result || game.game_over()) {
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
        const headerMap = buildHeaderMap();
        const headers = buildPgnHeaders(headerMap);
        if (!history.length) {
            const emptyMovetext = headerMap.Result || '*';
            return headers ? `${headers}\n\n${emptyMovetext}` : emptyMovetext;
        }
        const moves = buildAnnotatedMovetext(history, headerMap.Result);

        return headers ? `${headers}\n\n${moves}` : moves;
    }

    function buildViewGame(ply) {
        const history = game.history({ verbose: true });
        if (ply >= history.length) return game;
        const next = new Chess(initialFen);
        const slice = history.slice(0, ply);
        slice.forEach((m) => {
            next.move({ from: m.from, to: m.to, promotion: m.promotion });
        });
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
            const inCheck = viewGame.in_check() ? ' | Check' : '';
            boardStatsEl.textContent = `${turn} to move${inCheck}`;
        }

        if (isViewingPast()) {
            boardStatsEl.textContent += ` (viewing ${activePly}/${fullHistory.length})`;
        }

        const humanColor = engineSide === 'w' ? 'Black' : 'White';
        playerSideLabel.textContent = `You: ${humanColor}`;
        engineSideLabel.textContent = `Lozza: ${engineSide === 'w' ? 'White' : 'Black'}`;

        moveStatsEl.textContent = `${fullHistory.length} move${fullHistory.length === 1 ? '' : 's'}`;

        toolStats.textContent = `Engine: ${engineReady ? 'ready' : 'loading'} | ${engineThinking ? 'thinking' : 'idle'}`;
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
        if (engineThinking) {
            markSearchCanceled();
        }
        postEngineCommand('stop', false);
        engineThinking = false;
    }

    function buildAnalysisPositions(history) {
        const uciMoves = history.map((m) => m.from + m.to + (m.promotion ? m.promotion : ''));
        const positions = [];
        let movesText = '';
        uciMoves.forEach((move) => {
            movesText = movesText ? `${movesText} ${move}` : move;
            positions.push(`position fen ${initialFenUci} moves ${movesText}`);
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
        if (!postEngineCommand(position) || !postEngineCommand(`go movetime ${analysisMoveTime}`)) {
            stopAnalysis(true);
        }
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
        if (!postEngineCommand('ucinewgame')) {
            return;
        }

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
        markSearchCanceled();
        analysisActive = false;
        analysisCurrent = null;
        postEngineCommand('stop', false);
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
        if (analysisActive) return;

        engineThinking = true;
        updateEngineStatus('Lozza thinking...', 'busy');

        const moves = getUciMoves();
        const position = buildPositionCommand(moves);
        if (!postEngineCommand(position) || !postEngineCommand(`go movetime ${moveTime}`)) {
            engineThinking = false;
            updateEngineStatus(engineReady ? 'Lozza ready' : 'Engine unavailable', engineReady ? 'ready' : '');
        }
    }

    function resolvePromotionChoice(from, to) {
        const piece = game.get(from);
        if (!piece || piece.type !== 'p') return undefined;

        const promotionRank = piece.color === 'w' ? '8' : '1';
        if (to[1] !== promotionRank) return undefined;

        const options = game.moves({ square: from, verbose: true })
            .filter((m) => m.to === to && m.promotion)
            .map((m) => m.promotion);
        if (!options.length) return undefined;

        const picked = (prompt('Promote to: q, r, b, n', 'q') || 'q').toLowerCase();
        return options.includes(picked) ? picked : 'q';
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

        const promotion = resolvePromotionChoice(from, to);
        const move = game.move({ from, to, promotion });
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
            postEngineCommand('isready');
            return;
        }

        if (line === 'readyok') {
            engineReady = true;
            updateEngineStatus('Lozza ready', 'ready');
            setStatus('Lozza is ready.', 'success');
            postEngineCommand('ucinewgame');
            maybeQueueEngine();
            updateAnalyzeButton();
            return;
        }

        if (line.startsWith('info')) {
            if (skipInfoUntilBestmove) return;
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
            if (skipBestmoveCount > 0) {
                skipBestmoveCount -= 1;
                if (skipBestmoveCount === 0) {
                    skipInfoUntilBestmove = false;
                }
                return;
            }
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
            if (!move || move === '(none)' || move === 'NULL') {
                setStatus('No legal moves for engine.', 'warning');
                return;
            }
            if (!/^[a-h][1-8][a-h][1-8][nbrq]?$/.test(move)) {
                setStatus('Engine returned a malformed move.', 'error');
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
        setInitialFen(game.fen());
        gameDateTag = formatDateTag(new Date());
        ensureDefaultHeaders();
        resetEngineLog();
        redoStack = [];
        selectedSquare = null;
        legalTargets = [];
        activePly = 0;
        if (!keepOrientation) {
            orientation = engineSide === 'w' ? 'black' : 'white';
        }
        if (engineReady) postEngineCommand('ucinewgame');
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
        setInitialFenFromHeaders(next.header());
        gameDateTag = next.header().Date || formatDateTag(new Date());
        ensureDefaultHeaders();
        resetAnalysisResults();
        resetEngineLog();
        redoStack = [];
        selectedSquare = null;
        legalTargets = [];
        activePly = game.history().length;

        setStatus('PGN loaded.', 'success');
        refreshUI();
        if (engineReady) postEngineCommand('ucinewgame');
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
        resetAnalysisResults();
        const move = game.undo();
        if (!move) {
            setStatus('Nothing to undo.', 'warning');
            return;
        }
        redoStack.push(move);
        selectedSquare = null;
        legalTargets = [];
        activePly = game.history().length;
        setStatus('Move undone.', 'success');
        refreshUI();
        maybeQueueEngine();
    }

    function redoMove() {
        stopEngine();
        resetAnalysisResults();
        const move = redoStack.pop();
        if (!move) {
            setStatus('Nothing to redo.', 'warning');
            return;
        }
        game.move({ from: move.from, to: move.to, promotion: move.promotion });
        selectedSquare = null;
        legalTargets = [];
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
        engineReady = false;
        engineThinking = false;
        try {
            engine = new Worker('js/lozza.js');
        } catch (err) {
            markEngineUnavailable('Failed to start Lozza worker.');
            return;
        }
        engine.onmessage = handleEngineMessage;
        engine.onerror = (err) => markEngineUnavailable(`Engine error: ${err.message || err}`);
        if (!postEngineCommand('uci')) {
            return;
        }
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
        resetEngineLog();
        newGame(false);
        setStatus('Initializing Lozza...', 'warning');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
