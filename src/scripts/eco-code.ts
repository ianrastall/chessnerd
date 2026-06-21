// ECO Codes browser: search-first flat list of named opening lines, with a
// board diagram derived on demand from each line's moves. The dataset is a
// frozen snapshot (see scripts/eco/build_openings.py); nothing is fetched live.

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
  move(move: string | { from: string; to: string; promotion?: string }): unknown;
  get(square: string): { type: string; color: string } | null;
  fen(): string;
  history(options?: { verbose?: boolean }): Array<{ from: string; to: string }>;
}

type ChessConstructor = new (fen?: string) => ChessGame;

const DATA_URL = '/data/eco-code/openings.json';
const VOLUMES = ['A', 'B', 'C', 'D', 'E'] as const;
const RENDER_CAP = 250;

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

let openings: Opening[] = [];
let query = '';
let volume = '';
let expandedKey: string | null = null;

const searchEl = document.getElementById('ecoSearch') as HTMLInputElement | null;
const volumesEl = document.getElementById('ecoVolumes');
const statusEl = document.getElementById('ecoStatus');
const listEl = document.getElementById('ecoList');

function getChess(): ChessConstructor | null {
  return (window as unknown as { Chess?: ChessConstructor }).Chess ?? null;
}

function keyFor(opening: Opening, index: number): string {
  return `${opening.eco}-${index}`;
}

function matches(opening: Opening): boolean {
  if (volume && opening.eco[0] !== volume) return false;
  if (!query) return true;
  const haystack = `${opening.eco} ${opening.name}`.toLowerCase();
  return haystack.includes(query);
}

// Replay the SAN moves so we can read the final position. Returns the game at
// the end of the line, or null if the moves could not be parsed.
function gameFromPgn(pgn: string): ChessGame | null {
  const Chess = getChess();
  if (!Chess) return null;
  const game = new Chess();
  const tokens = pgn.replace(/\d+\.+/g, ' ').split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    if (token === '*' || /^(1-0|0-1|1\/2-1\/2)$/.test(token)) break;
    const ok = game.move(token);
    if (!ok) return null;
  }
  return game;
}

function buildBoard(game: ChessGame): HTMLElement {
  const board = document.createElement('div');
  board.className = 'chess-board eco-board';
  board.dataset.orientation = 'white';

  const history = game.history({ verbose: true });
  const last = history[history.length - 1];
  const highlights = last ? [last.from, last.to] : [];

  RANKS.forEach((rank) => {
    FILES.forEach((file) => {
      const square = `${file}${rank}`;
      const squareEl = document.createElement('div');
      const isLight = (file.charCodeAt(0) - 97 + parseInt(rank, 10)) % 2 === 0;
      squareEl.className = `square ${isLight ? 'light-square' : 'dark-square'}`;
      if (highlights.includes(square)) squareEl.classList.add('highlight');

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
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(getText());
      const original = btn.textContent;
      btn.textContent = 'Copied';
      window.setTimeout(() => {
        btn.textContent = original;
      }, 1200);
    } catch {
      btn.textContent = 'Copy failed';
    }
  });
  return btn;
}

function buildDetail(opening: Opening): HTMLElement {
  const detail = document.createElement('div');
  detail.className = 'eco-detail';

  const game = gameFromPgn(opening.pgn);
  if (game) {
    detail.appendChild(buildBoard(game));
  } else {
    const note = document.createElement('p');
    note.className = 'eco-detail-note';
    note.textContent = 'Board preview unavailable for this line.';
    detail.appendChild(note);
  }

  const side = document.createElement('div');
  side.className = 'eco-detail-side';

  const moves = document.createElement('p');
  moves.className = 'eco-detail-moves';
  moves.textContent = opening.pgn;
  side.appendChild(moves);

  const actions = document.createElement('div');
  actions.className = 'eco-detail-actions';
  actions.appendChild(copyButton('Copy PGN', () => opening.pgn));
  if (game) actions.appendChild(copyButton('Copy FEN', () => game.fen()));
  side.appendChild(actions);

  detail.appendChild(side);
  return detail;
}

function render(): void {
  if (!listEl || !statusEl) return;

  const filtered: Array<{ opening: Opening; key: string }> = [];
  openings.forEach((opening, index) => {
    if (matches(opening)) filtered.push({ opening, key: keyFor(opening, index) });
  });

  const shown = filtered.slice(0, RENDER_CAP);
  if (filtered.length === 0) {
    statusEl.textContent = 'No openings match your search.';
  } else if (filtered.length > shown.length) {
    statusEl.textContent = `Showing ${shown.length} of ${filtered.length} openings — refine your search to narrow.`;
  } else {
    statusEl.textContent = `${filtered.length} opening${filtered.length === 1 ? '' : 's'}.`;
  }

  listEl.innerHTML = '';
  const fragment = document.createDocumentFragment();

  shown.forEach(({ opening, key }) => {
    const row = document.createElement('div');
    row.className = 'eco-row';

    const header = document.createElement('button');
    header.type = 'button';
    header.className = 'eco-row-header';
    header.setAttribute('aria-expanded', String(expandedKey === key));

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
      expandedKey = expandedKey === key ? null : key;
      render();
    });

    row.appendChild(header);
    if (expandedKey === key) row.appendChild(buildDetail(opening));
    fragment.appendChild(row);
  });

  listEl.appendChild(fragment);
}

function buildVolumeChips(): void {
  if (!volumesEl) return;
  const make = (value: string, label: string): HTMLButtonElement => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'eco-chip';
    btn.dataset.volume = value;
    btn.textContent = label;
    if (value === volume) btn.classList.add('active');
    btn.addEventListener('click', () => {
      volume = value;
      expandedKey = null;
      volumesEl.querySelectorAll('.eco-chip').forEach((chip) => {
        chip.classList.toggle('active', (chip as HTMLElement).dataset.volume === volume);
      });
      render();
    });
    return btn;
  };

  volumesEl.appendChild(make('', 'All'));
  VOLUMES.forEach((vol) => volumesEl.appendChild(make(vol, vol)));
}

function init(): void {
  if (!listEl || !statusEl) return;
  buildVolumeChips();

  if (searchEl) {
    searchEl.addEventListener('input', () => {
      query = searchEl.value.trim().toLowerCase();
      expandedKey = null;
      render();
    });
  }

  statusEl.textContent = 'Loading openings…';
  fetch(DATA_URL, { headers: { Accept: 'application/json' } })
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json() as Promise<OpeningsPayload>;
    })
    .then((payload) => {
      openings = Array.isArray(payload.openings) ? payload.openings : [];
      render();
    })
    .catch((error) => {
      console.error('Failed to load ECO openings:', error);
      statusEl.textContent = 'Could not load ECO opening data.';
    });
}

init();
