// Named opening lines from the frozen dataset built by scripts/eco/build_openings.py.

interface Opening {
  eco: string;
  name: string;
  pgn: string;
}

interface OpeningsPayload {
  count: number;
  openings: Opening[];
}

// Minimal shape of the bundled chess.js global (js/chess.min.js).
interface ChessGame {
  move(move: string): PlayedMove | null;
  get(square: string): { type: string; color: string } | null;
  fen(): string;
}

interface PlayedMove {
  from: string;
  to: string;
  san: string;
}

interface Position {
  fen: string;
  move?: PlayedMove;
}

type ChessConstructor = new (fen?: string) => ChessGame;

const DATA_URL = '/data/eco-code/openings.json';
const PAGE_SIZE = 50;

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

let openings: Opening[] = [];
let query: string[] = [];
let page = 0;
// Three cascading filter levels, each a single character of the ECO code:
// volume = code[0] (A–E), tens = code[1] (0–9), ones = code[2] (0–9).
let volume = '';
let tens = '';
let ones = '';

const searchEl = document.getElementById('ecoSearch') as HTMLInputElement | null;
const statusEl = document.getElementById('ecoStatus');
const listEl = document.getElementById('ecoList');
const paginationEl = document.getElementById('ecoPagination');
const previousPage = document.querySelector<HTMLButtonElement>('#ecoPreviousPage');
const nextPage = document.querySelector<HTMLButtonElement>('#ecoNextPage');

const volumesEl = document.getElementById('ecoVolumes');
const tensEl = document.getElementById('ecoTens');
const onesEl = document.getElementById('ecoOnes');
const tensRowEl = document.getElementById('ecoTensRow');
const onesRowEl = document.getElementById('ecoOnesRow');

function getChess(): ChessConstructor | null {
  return (window as unknown as { Chess?: ChessConstructor }).Chess ?? null;
}

function searchText(text: string): string {
  return text.normalize('NFD').replace(/[\p{M}'’]/gu, '').toLowerCase();
}

function matches(opening: Opening): boolean {
  const eco = opening.eco;
  if (volume && eco[0] !== volume) return false;
  if (tens && eco[1] !== tens) return false;
  if (ones && eco[2] !== ones) return false;
  if (query.length === 0) return true;
  const haystack = searchText(`${eco} ${opening.name}`);
  return query.every((word) => haystack.includes(word));
}

function positionsFromPgn(pgn: string, Chess: ChessConstructor): Position[] | null {
  const game = new Chess();
  const positions: Position[] = [{ fen: game.fen() }];
  const tokens = pgn.replace(/\d+\.+/g, ' ').split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    if (token === '*' || /^(1-0|0-1|1\/2-1\/2)$/.test(token)) break;
    const move = game.move(token);
    if (!move) return null;
    positions.push({ fen: game.fen(), move });
  }
  return positions;
}

function buildBoard(game: ChessGame, move?: PlayedMove): HTMLElement {
  const board = document.createElement('div');
  board.className = 'chess-board eco-board';
  board.dataset.orientation = 'white';

  RANKS.forEach((rank) => {
    FILES.forEach((file) => {
      const square = `${file}${rank}`;
      const squareEl = document.createElement('div');
      squareEl.dataset.square = square;
      const isLight = (file.charCodeAt(0) - 97 + parseInt(rank, 10)) % 2 === 0;
      squareEl.className = `square ${isLight ? 'light-square' : 'dark-square'}`;
      if (move?.from === square || move?.to === square) squareEl.classList.add('highlight');

      const piece = game.get(square);
      if (piece) {
        const pieceEl = document.createElement('div');
        pieceEl.className = 'piece';
        pieceEl.dataset.piece = piece.color + piece.type.toUpperCase();
        squareEl.appendChild(pieceEl);
      }
      board.appendChild(squareEl);
    });
  });

  return board;
}

function copyButton(label: string, getText: () => string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn-secondary btn-compact';
  btn.textContent = label;
  let resetTimer: number | undefined;
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(getText());
      btn.textContent = 'Copied';
    } catch {
      btn.textContent = 'Copy failed';
    }
    window.clearTimeout(resetTimer);
    resetTimer = window.setTimeout(() => { btn.textContent = label; }, 1200);
  });
  return btn;
}

function buildDetail(opening: Opening): HTMLElement {
  const detail = document.createElement('div');
  detail.className = 'eco-detail';

  const Chess = getChess();
  const positions = Chess && positionsFromPgn(opening.pgn, Chess);
  const side = document.createElement('div');
  side.className = 'eco-detail-side';
  const actions = document.createElement('div');
  actions.className = 'eco-detail-actions';
  actions.appendChild(copyButton('Copy PGN', () => opening.pgn));

  if (Chess && positions) {
    const boardSlot = document.createElement('div');
    detail.appendChild(boardSlot);
    const positionLabel = document.createElement('p');
    positionLabel.className = 'eco-position';
    positionLabel.setAttribute('role', 'status');
    const controls = document.createElement('div');
    controls.className = 'eco-replay';
    controls.setAttribute('role', 'group');
    controls.setAttribute('aria-label', 'Opening moves');
    const end = positions.length - 1;
    let current = end;
    const buttons = [
      { label: 'Start', target: () => 0 },
      { label: 'Previous move', target: () => current - 1 },
      { label: 'Next move', target: () => current + 1 },
      { label: 'End', target: () => end },
    ].map(({ label, target }) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn-secondary btn-compact';
      button.textContent = label;
      button.addEventListener('click', () => showPosition(target()));
      controls.appendChild(button);
      return { button, target };
    });

    const showPosition = (index: number) => {
      current = index;
      const { fen, move } = positions[current];
      boardSlot.replaceChildren(buildBoard(new Chess(fen), move));
      const moveLabel = move ? `${Math.ceil(current / 2)}${current % 2 === 0 ? '...' : '.'} ${move.san}` : 'Starting position';
      positionLabel.textContent = `${moveLabel} · ${current} of ${end} moves`;
      for (const { button, target } of buttons) {
        const destination = target();
        button.disabled = destination < 0 || destination > end || destination === current;
      }
    };

    showPosition(current);
    side.append(positionLabel, controls);
    actions.appendChild(copyButton('Copy FEN', () => positions[current].fen));
  } else {
    const note = document.createElement('p');
    note.className = 'eco-detail-note';
    note.textContent = 'Board preview unavailable for this line.';
    detail.appendChild(note);
  }

  const moves = document.createElement('p');
  moves.className = 'eco-detail-moves';
  moves.textContent = opening.pgn;
  side.appendChild(moves);

  side.appendChild(actions);

  detail.appendChild(side);
  return detail;
}

function render(): void {
  if (!listEl || !statusEl) return;

  const filtered = openings.filter(matches);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const offset = page * PAGE_SIZE;
  const shown = filtered.slice(offset, offset + PAGE_SIZE);
  if (paginationEl) paginationEl.hidden = totalPages <= 1;
  if (previousPage) previousPage.disabled = page === 0;
  if (nextPage) nextPage.disabled = page + 1 >= totalPages;
  if (filtered.length === 0) {
    statusEl.textContent = 'No openings match your search or ECO filters.';
  } else if (totalPages > 1) {
    statusEl.textContent = `${filtered.length.toLocaleString()} openings · Page ${page + 1} of ${totalPages}`;
  } else {
    statusEl.textContent = `${filtered.length} opening${filtered.length === 1 ? '' : 's'}.`;
  }

  const fragment = document.createDocumentFragment();
  let expanded: { header: HTMLButtonElement; detail: HTMLElement } | null = null;

  shown.forEach((opening) => {
    const row = document.createElement('div');
    row.className = 'eco-row';

    const header = document.createElement('button');
    header.type = 'button';
    header.className = 'eco-row-header';
    header.setAttribute('aria-expanded', 'false');

    const badge = document.createElement('span');
    badge.className = 'eco-badge';
    badge.textContent = opening.eco;

    const name = document.createElement('span');
    name.className = 'eco-name';
    name.textContent = opening.name;

    const movesPreview = document.createElement('span');
    movesPreview.className = 'eco-moves-preview';
    movesPreview.textContent = opening.pgn;

    header.append(badge, name, movesPreview);
    header.addEventListener('click', () => {
      const wasOpen = expanded?.header === header;
      expanded?.header.setAttribute('aria-expanded', 'false');
      expanded?.detail.remove();
      expanded = null;
      if (!wasOpen) {
        const detail = buildDetail(opening);
        header.setAttribute('aria-expanded', 'true');
        row.appendChild(detail);
        expanded = { header, detail };
      }
    });

    row.appendChild(header);
    fragment.appendChild(row);
  });

  listEl.replaceChildren(fragment);
}

// Distinct values present in the data at one position of the ECO code, given a
// fixed prefix. prefix '' → volumes (code[0]); 'A' → tens digits under A;
// 'A3' → ones digits under A3.
function valuesForPrefix(prefix: string): string[] {
  const found = new Set<string>();
  const pos = prefix.length;
  for (const opening of openings) {
    const eco = opening.eco;
    if (eco.length <= pos) continue;
    if (prefix && !eco.startsWith(prefix)) continue;
    found.add(eco[pos]);
  }
  return [...found].sort();
}

interface PillItem {
  value: string;
  label: string;
}

function renderPillRow(
  container: HTMLElement,
  items: PillItem[],
  selected: string,
  onSelect: (value: string) => void
): void {
  container.innerHTML = '';
  const all: PillItem = { value: '', label: 'All' };
  [all, ...items].forEach((item) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'eco-chip';
    btn.textContent = item.label;
    const isSelected = item.value === selected;
    btn.setAttribute('aria-pressed', String(isSelected));
    if (isSelected) btn.classList.add('active');
    btn.addEventListener('click', () => {
      const wasFocused = document.activeElement === btn;
      onSelect(item.value);
      if (wasFocused) container.querySelector<HTMLButtonElement>('button.active')?.focus();
    });
    container.appendChild(btn);
  });
}

// Rebuild all three filter rows from the current volume/tens/ones selection.
// Lower rows are hidden until their parent level is chosen.
function refreshFilters(): void {
  if (volumesEl) {
    const items = valuesForPrefix('').map((v) => ({ value: v, label: v }));
    renderPillRow(volumesEl, items, volume, (value) => {
      volume = value;
      tens = '';
      ones = '';
      page = 0;
      refreshFilters();
      render();
    });
  }

  if (tensEl && tensRowEl) {
    if (volume) {
      const items = valuesForPrefix(volume).map((d) => ({
        value: d,
        label: `${volume}${d}`
      }));
      renderPillRow(tensEl, items, tens, (value) => {
        tens = value;
        ones = '';
        page = 0;
        refreshFilters();
        render();
      });
      tensRowEl.hidden = items.length === 0;
    } else {
      tensRowEl.hidden = true;
      tensEl.innerHTML = '';
    }
  }

  if (onesEl && onesRowEl) {
    if (volume && tens) {
      const items = valuesForPrefix(`${volume}${tens}`).map((o) => ({
        value: o,
        label: `${volume}${tens}${o}`
      }));
      renderPillRow(onesEl, items, ones, (value) => {
        ones = value;
        page = 0;
        refreshFilters();
        render();
      });
      onesRowEl.hidden = items.length === 0;
    } else {
      onesRowEl.hidden = true;
      onesEl.innerHTML = '';
    }
  }
}

function init(): void {
  if (!listEl || !statusEl) return;

  if (searchEl) {
    searchEl.addEventListener('input', () => {
      query = searchText(searchEl.value).split(/\s+/).filter(Boolean);
      page = 0;
      render();
    });
  }

  previousPage?.addEventListener('click', () => { page -= 1; render(); });
  nextPage?.addEventListener('click', () => { page += 1; render(); });

  statusEl.textContent = 'Loading openings…';
  fetch(DATA_URL, { headers: { Accept: 'application/json' } })
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json() as Promise<OpeningsPayload>;
    })
    .then((payload) => {
      openings = Array.isArray(payload.openings) ? payload.openings : [];
      refreshFilters();
      render();
    })
    .catch((error) => {
      console.error('Failed to load ECO openings:', error);
      statusEl.textContent = 'Could not load ECO opening data.';
    });
}

init();
