import {
  dateToYear,
  decodeShard,
  gunzipIfNeeded,
  matchNames,
  nameFileName,
  nameKey,
  parseNameEntries,
  shardFileName,
  shardIndexFor,
  type NameEntry,
  type Player,
  type RatingSeries,
  type RatingType,
  type Shard,
  type ShardDirectory
} from '../lib/fide-players';

const root = document.getElementById('fpRoot') as HTMLElement;
const BASE = (root.dataset.base || '/fide-players/').replace(/\/?$/, '/');
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const searchInput = el<HTMLInputElement>('fpSearch');
const idInput = el<HTMLInputElement>('fpId');
const idForm = el<HTMLFormElement>('fpIdForm');
const statusLine = el('fpStatus');
const results = el('fpResults');
const profile = el('fpProfile');

const TYPE_LABEL: Record<RatingType, string> = { standard: 'Standard', rapid: 'Rapid', blitz: 'Blitz' };
const TYPE_COLOR: Record<RatingType, string> = { standard: 'var(--accent)', rapid: '#e0a030', blitz: '#d05a8a' };

let directory: ShardDirectory | null = null;
const shards = new Map<number, Promise<Shard>>();
const nameFiles = new Map<string, Promise<NameEntry[]>>();

function node<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, string> = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v;
    else e.setAttribute(k, v);
  }
  e.append(...children);
  return e;
}

function setStatus(text: string) {
  statusLine.textContent = text;
}

async function getJson(path: string): Promise<unknown> {
  const response = await fetch(BASE + path);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}

async function loadDirectory(): Promise<ShardDirectory> {
  if (!directory) {
    const value = (await getJson('players/shards.json')) as ShardDirectory;
    if (value.version !== 1 || !Array.isArray(value.shards) || !Array.isArray(value.lists)) throw new Error('Unsupported player data version.');
    directory = value;
  }
  return directory;
}

function loadShard(index: number, dir: ShardDirectory): Promise<Shard> {
  let pending = shards.get(index);
  if (!pending) {
    pending = fetch(`${BASE}players/${shardFileName(index)}`).then(async (r) => {
      if (!r.ok) throw new Error(`Shard ${index}: HTTP ${r.status}`);
      return decodeShard(await gunzipIfNeeded(await r.arrayBuffer()), dir.lists);
    });
    shards.set(index, pending);
  }
  return pending;
}

function loadNames(key: string): Promise<NameEntry[]> {
  let pending = nameFiles.get(key);
  if (!pending) {
    pending = fetch(`${BASE}names/${nameFileName(key)}`).then(async (r) => {
      if (r.status === 404) return [];
      if (!r.ok) throw new Error(`names/${key}: HTTP ${r.status}`);
      return parseNameEntries(JSON.parse(new TextDecoder().decode(await gunzipIfNeeded(await r.arrayBuffer()))));
    });
    nameFiles.set(key, pending);
  }
  return pending;
}

// ── search ───────────────────────────────────────────────────────────────────

let searchToken = 0;
async function runSearch() {
  const query = searchInput.value.trim();
  const token = ++searchToken;
  results.replaceChildren();
  if (query.length < 2) {
    setStatus('Type at least two letters of a surname.');
    return;
  }
  const words = query.split(/[\s,]+/).filter(Boolean);
  // Names are "Surname, Given". Try the first word as the surname, then the last.
  const keys = [...new Set([nameKey(words[0]), nameKey(words[words.length - 1])])];
  try {
    let found = { rows: [] as NameEntry[], total: 0 };
    for (const key of keys) {
      found = matchNames(await loadNames(key), query);
      if (token !== searchToken) return;
      if (found.total) break;
    }
    if (!found.total) {
      setStatus('No players match. Try the surname alone, or search by FIDE ID.');
      return;
    }
    setStatus(found.total > found.rows.length ? `${found.total.toLocaleString('en-US')} matches, showing the first ${found.rows.length}. Add more of the name to narrow it.` : `${found.total} ${found.total === 1 ? 'match' : 'matches'}`);
    const table = node('table', { class: 'fp-table' });
    table.append(
      node('thead', {}, node('tr', {}, ...['Name', 'Fed', 'Title', 'Peak', 'Last list', 'Born'].map((h) => node('th', { scope: 'col' }, h)))),
      node(
        'tbody',
        {},
        ...found.rows.map((row) => {
          const link = node('a', { href: `?id=${row.id}` }, row.name || `(no name) ${row.id}`);
          link.addEventListener('click', (event) => {
            event.preventDefault();
            void showPlayer(row.id, true);
          });
          return node('tr', {}, node('th', { scope: 'row' }, link), node('td', {}, row.fed), node('td', {}, row.title), node('td', { class: 'fp-num' }, row.peak ? String(row.peak) : ''), node('td', {}, row.last), node('td', {}, row.birth ? String(row.birth) : ''));
        })
      )
    );
    results.append(node('div', { class: 'fp-table-wrap' }, table));
  } catch (error) {
    setStatus(`Search failed: ${(error as Error).message}`);
  }
}

// ── profile ──────────────────────────────────────────────────────────────────

function titleLine(p: Player, dir: ShardDirectory): string {
  const parts = p.titles.map((t) => {
    const labels = [t.title, t.wTitle, t.oTitle && `(${t.oTitle})`, t.foaTitle].filter(Boolean).join(' ');
    return `${labels || 'none'} from ${dir.lists[t.from]?.date ?? '?'}`;
  });
  return parts.join(' → ');
}

function chart(p: Player, shown: Set<RatingType>): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const W = 800;
  const H = 300;
  const pad = { l: 46, r: 12, t: 12, b: 26 };
  const points = (Object.entries(p.series) as [RatingType, RatingSeries][])
    .filter(([type]) => shown.has(type))
    .map(([type, s]) => ({ type, pts: s.date.map((d, i) => ({ x: dateToYear(d), y: s.rating[i], d })).filter((q): q is { x: number; y: number; d: string } => q.y !== null && q.y > 0 && Number.isFinite(q.x)) }));
  const all = points.flatMap((s) => s.pts);
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'fp-chart');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Rating history');
  if (!all.length) return svg;
  const x0 = Math.min(...all.map((q) => q.x));
  const x1 = Math.max(...all.map((q) => q.x), x0 + 1);
  const lo = Math.floor((Math.min(...all.map((q) => q.y)) - 20) / 100) * 100;
  const hi = Math.ceil((Math.max(...all.map((q) => q.y)) + 20) / 100) * 100;
  const sx = (x: number) => pad.l + ((x - x0) / (x1 - x0)) * (W - pad.l - pad.r);
  const sy = (y: number) => H - pad.b - ((y - lo) / (hi - lo)) * (H - pad.t - pad.b);
  const add = (tag: string, attrs: Record<string, string>, text?: string) => {
    const e = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (text) e.textContent = text;
    svg.append(e);
    return e;
  };
  const rStep = hi - lo > 1000 ? 200 : 100;
  for (let y = lo; y <= hi; y += rStep) {
    add('line', { x1: String(pad.l), x2: String(W - pad.r), y1: String(sy(y)), y2: String(sy(y)), class: 'fp-grid' });
    add('text', { x: String(pad.l - 6), y: String(sy(y) + 4), 'text-anchor': 'end', class: 'fp-axis' }, String(y));
  }
  const yearStep = Math.max(1, Math.ceil((x1 - x0) / 8));
  for (let year = Math.ceil(x0 / yearStep) * yearStep; year <= x1; year += yearStep) {
    add('text', { x: String(sx(year)), y: String(H - 8), 'text-anchor': 'middle', class: 'fp-axis' }, String(year));
  }
  for (const s of points) {
    if (s.pts.length === 1) add('circle', { cx: String(sx(s.pts[0].x)), cy: String(sy(s.pts[0].y)), r: '3', fill: TYPE_COLOR[s.type] });
    else add('polyline', { points: s.pts.map((q) => `${sx(q.x).toFixed(1)},${sy(q.y).toFixed(1)}`).join(' '), fill: 'none', stroke: TYPE_COLOR[s.type], 'stroke-width': '1.8', 'stroke-linejoin': 'round' });
  }
  const readout = add('text', { x: String(pad.l + 6), y: String(pad.t + 12), class: 'fp-readout' }, '');
  const cursor = add('line', { y1: String(pad.t), y2: String(H - pad.b), class: 'fp-cursor', visibility: 'hidden' });
  svg.addEventListener('pointermove', (event) => {
    const box = svg.getBoundingClientRect();
    const x = x0 + (((event.clientX - box.left) / box.width) * W - pad.l) / (W - pad.l - pad.r) * (x1 - x0);
    let best: { type: RatingType; x: number; y: number; d: string } | null = null;
    for (const s of points) for (const q of s.pts) if (!best || Math.abs(q.x - x) < Math.abs(best.x - x)) best = { type: s.type, ...q };
    if (!best) return;
    cursor.setAttribute('x1', String(sx(best.x)));
    cursor.setAttribute('x2', String(sx(best.x)));
    cursor.setAttribute('visibility', 'visible');
    readout.textContent = `${best.d}  ${TYPE_LABEL[best.type]} ${best.y}`;
  });
  svg.addEventListener('pointerleave', () => {
    cursor.setAttribute('visibility', 'hidden');
    readout.textContent = '';
  });
  return svg;
}

function historyRows(p: Player): { date: string; cells: Partial<Record<RatingType, { rating: number | null; games: number | null; k: number | null; flag: string | null; section: string | null }>> }[] {
  const byDate = new Map<string, Partial<Record<RatingType, { rating: number | null; games: number | null; k: number | null; flag: string | null; section: string | null }>>>();
  for (const [type, s] of Object.entries(p.series) as [RatingType, RatingSeries][]) {
    s.date.forEach((d, i) => {
      const row = byDate.get(d) ?? {};
      row[type] = { rating: s.rating[i], games: s.games[i], k: s.k[i], flag: s.flag[i], section: s.section[i] };
      byDate.set(d, row);
    });
  }
  return [...byDate.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([date, cells]) => ({ date, cells }));
}

function csv(p: Player): string {
  const lines = ['list,type,rating,games,k,flag,section'];
  for (const row of historyRows(p).reverse()) {
    for (const [type, c] of Object.entries(row.cells) as [RatingType, NonNullable<ReturnType<typeof historyRows>[number]['cells'][RatingType]>][]) {
      lines.push([row.date, type, c.rating ?? '', c.games ?? '', c.k ?? '', c.flag ?? '', c.section ?? ''].join(','));
    }
  }
  return lines.join('\n') + '\n';
}

function render(p: Player, dir: ShardDirectory) {
  const name = p.names[p.names.length - 1]?.name || `FIDE ID ${p.id}`;
  const fed = p.feds[p.feds.length - 1]?.fed;
  const std = p.series.standard;
  const stdRatings = (std?.rating ?? []).filter((r): r is number => r !== null && r > 0);
  const peak = stdRatings.length ? Math.max(...stdRatings) : null;
  const peakDate = peak && std ? std.date[std.rating.indexOf(peak)] : '';
  const last = std ? std.rating[std.rating.length - 1] : null;
  const lastTitle = p.titles[p.titles.length - 1];
  const bestTitle = lastTitle ? [lastTitle.title, lastTitle.wTitle].filter(Boolean).join(' ') : '';

  document.title = `${name} - FIDE Archive - Chess Nerd`;
  const stats: [string, string][] = [
    ['FIDE ID', String(p.id)],
    ['Federation', fed ?? ''],
    ['Born', p.birthYear ? String(p.birthYear) : ''],
    ['Standard peak', peak ? `${peak} (${peakDate})` : ''],
    ['Last standard', last ? `${last} (${std!.date[std!.date.length - 1]})` : ''],
    ['In lists', Object.entries(p.series).map(([t, s]) => `${s!.list.length} ${t}`).join(', ')]
  ];
  const head = node('div', { class: 'fp-head' }, node('h2', {}, name), bestTitle ? node('span', { class: 'fp-title-badge' }, bestTitle) : '');
  const grid = node('dl', { class: 'fp-stats' });
  for (const [k, v] of stats) if (v) grid.append(node('div', {}, node('dt', {}, k), node('dd', {}, v)));

  const notes: Node[] = [];
  if (p.titles.length) notes.push(node('p', {}, node('strong', {}, 'Titles in the lists: '), titleLine(p, dir)));
  if (p.names.length > 1) notes.push(node('p', {}, node('strong', {}, 'Also listed as: '), p.names.slice(0, -1).map((n) => n.name).join('; ')));
  if (p.feds.length > 1) notes.push(node('p', {}, node('strong', {}, 'Federations: '), p.feds.map((f) => `${f.fed} from ${dir.lists[f.from]?.date ?? '?'}`).join(' → ')));

  const types = Object.keys(p.series) as RatingType[];
  const shown = new Set<RatingType>(types);
  const chartHost = node('div', { class: 'fp-chart-wrap' });
  const redraw = () => chartHost.replaceChildren(chart(p, shown));
  const toggles = node('div', { class: 'fp-toggles' });
  if (types.length > 1) {
    for (const t of types) {
      const box = node('input', { type: 'checkbox', checked: '' });
      box.addEventListener('change', () => {
        if (box.checked) shown.add(t);
        else shown.delete(t);
        redraw();
      });
      toggles.append(node('label', {}, box, ` ${TYPE_LABEL[t]}`));
    }
  }
  redraw();

  const rows = historyRows(p);
  const table = node('table', { class: 'fp-table' });
  const heads = ['List', ...types.flatMap((t) => (t === 'standard' ? ['Standard', 'Games', 'K', 'Flag'] : [TYPE_LABEL[t]]))];
  table.append(node('thead', {}, node('tr', {}, ...heads.map((h) => node('th', { scope: 'col' }, h)))));
  const body = node('tbody');
  const initial = 40;
  const addRows = (from: number, to: number) => {
    for (const row of rows.slice(from, to)) {
      const cells: HTMLElement[] = [node('th', { scope: 'row' }, row.date)];
      for (const t of types) {
        const c = row.cells[t];
        const rating = node('td', { class: 'fp-num' }, c?.rating != null ? String(c.rating) : '');
        if (t === 'standard') {
          cells.push(rating, node('td', { class: 'fp-num' }, c?.games != null ? String(c.games) : ''), node('td', { class: 'fp-num' }, c?.k != null ? String(c.k) : ''), node('td', { title: c?.section ?? '' }, c?.flag ?? (c?.section ? '•' : '')));
        } else cells.push(rating);
      }
      body.append(node('tr', {}, ...cells));
    }
  };
  addRows(0, initial);
  table.append(body);
  const more = node('button', { type: 'button', class: 'btn btn-secondary' }, `Show all ${rows.length} lists`);
  more.addEventListener('click', () => {
    addRows(initial, rows.length);
    more.remove();
  });

  const download = node('button', { type: 'button', class: 'btn btn-secondary btn-compact' }, 'Download CSV');
  download.addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([csv(p)], { type: 'text/csv' }));
    const a = node('a', { href: url, download: `fide-${p.id}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  });
  const fideLink = node('a', { class: 'btn btn-secondary btn-compact', href: `https://ratings.fide.com/profile/${p.id}`, target: '_blank', rel: 'noopener noreferrer' }, 'FIDE profile ↗');

  profile.replaceChildren(
    head,
    grid,
    ...notes,
    node('h3', {}, 'Rating history'),
    toggles,
    chartHost,
    node('div', { class: 'fp-actions' }, download, fideLink),
    node('div', { class: 'fp-table-wrap' }, table),
    rows.length > initial ? more : '',
    node('p', { class: 'fp-note' }, 'From the rating lists only, as FIDE published them. Flag: i = inactive, w = woman player. Blank cells mean the list had no value. Results, game lists and title award dates are not in these files; the FIDE profile has them.')
  );
  profile.hidden = false;
}

async function showPlayer(id: number, push: boolean) {
  profile.hidden = true;
  if (!Number.isSafeInteger(id) || id <= 0) {
    setStatus('Enter a FIDE ID (digits only).');
    return;
  }
  setStatus(`Loading FIDE ID ${id}…`);
  try {
    const dir = await loadDirectory();
    const index = shardIndexFor(dir, id);
    const player = index < 0 ? null : (await loadShard(index, dir)).find(id);
    if (!player) {
      setStatus(`No player with FIDE ID ${id} in the archive.`);
      return;
    }
    if (push) history.pushState({ id }, '', `?id=${id}`);
    setStatus('');
    results.replaceChildren();
    render(player, dir);
  } catch (error) {
    setStatus(`Could not load player data from ${BASE}: ${(error as Error).message}`);
  }
}

searchInput.addEventListener('input', () => {
  window.clearTimeout((runSearch as unknown as { t?: number }).t);
  (runSearch as unknown as { t?: number }).t = window.setTimeout(() => void runSearch(), 200);
});
idForm.addEventListener('submit', (event) => {
  event.preventDefault();
  void showPlayer(Number(idInput.value.trim()), true);
});
window.addEventListener('popstate', () => {
  const id = Number(new URLSearchParams(location.search).get('id'));
  if (id) void showPlayer(id, false);
  else {
    profile.hidden = true;
    setStatus('');
  }
});

const initial = Number(new URLSearchParams(location.search).get('id'));
if (initial) void showPlayer(initial, false);
else setStatus('Search by surname, or enter a FIDE ID.');
