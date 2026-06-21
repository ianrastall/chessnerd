interface PgnStats {
  games: number;
  whiteWins: number;
  blackWins: number;
  draws: number;
  otherResults: number;
  inProgress: number;
  annotated: number;
  withNags: number;
  withComments: number;
  gamesWithEco: number;
  totalBytes: number;
  totalPlayers: number;
  uniqueEcoCodes: number;
}

type ExtractKind = 'players' | 'events';
type StatusKind = '' | 'success' | 'warning' | 'error';

const maxBytes = 50 * 1024 * 1024;

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element as T;
}

function setStatus(element: HTMLElement, message: string, kind: StatusKind = '') {
  element.textContent = message;
  element.className = kind;
}

function gameChunksFrom(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const chunks = trimmed.split(/(?=\[Event\s+")/gi).map((chunk) => chunk.trim()).filter(Boolean);
  return chunks.length > 0 ? chunks : [trimmed];
}

function tagValue(chunk: string, tag: string): string | undefined {
  const match = chunk.match(new RegExp(`^\\[${tag}\\s+"([^"]*)"\\]`, 'im'));
  return match?.[1]?.trim();
}

function analyzePgn(text: string): PgnStats {
  const stats: PgnStats = {
    games: 0,
    whiteWins: 0,
    blackWins: 0,
    draws: 0,
    otherResults: 0,
    inProgress: 0,
    annotated: 0,
    withNags: 0,
    withComments: 0,
    gamesWithEco: 0,
    totalBytes: new Blob([text]).size,
    totalPlayers: 0,
    uniqueEcoCodes: 0
  };

  const playerNames = new Set<string>();
  const ecoCodes = new Set<string>();
  const chunks = gameChunksFrom(text);

  for (const chunk of chunks) {
    if (!/\[[A-Za-z0-9_]+\s+"/.test(chunk)) continue;
    stats.games += 1;

    const white = tagValue(chunk, 'White');
    const black = tagValue(chunk, 'Black');
    const eco = tagValue(chunk, 'ECO');
    const result = tagValue(chunk, 'Result');

    if (white && white !== '?') playerNames.add(white);
    if (black && black !== '?') playerNames.add(black);

    if (eco && /^[A-E]\d{2}$/.test(eco)) {
      stats.gamesWithEco += 1;
      ecoCodes.add(eco);
    }

    if (result === '1-0') stats.whiteWins += 1;
    else if (result === '0-1') stats.blackWins += 1;
    else if (result === '1/2-1/2') stats.draws += 1;
    else if (result === '*') stats.inProgress += 1;
    else if (result) stats.otherResults += 1;

    if (/\$\d+/.test(chunk)) stats.withNags += 1;
    if (/[{}]/.test(chunk)) stats.withComments += 1;
    if (/(^|\s)[!?]{1,2}(\s|$)/.test(chunk)) stats.annotated += 1;
  }

  stats.totalPlayers = playerNames.size;
  stats.uniqueEcoCodes = ecoCodes.size;
  return stats;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatStats(stats: PgnStats): string {
  if (stats.games === 0) return 'No games found.';

  const pct = (value: number) => `${((value / stats.games) * 100).toFixed(1)}%`;
  const ecoCompleteness = `${((stats.uniqueEcoCodes / 500) * 100).toFixed(1)}%`;

  return [
    'PGN STATISTICS REPORT',
    '=====================',
    '',
    `Total Games:      ${stats.games}`,
    `Total Players:    ${stats.totalPlayers} unique`,
    `File Size:        ${formatBytes(stats.totalBytes)}`,
    '',
    'RESULTS SUMMARY',
    '---------------',
    `White Wins:       ${String(stats.whiteWins).padEnd(8)} (${pct(stats.whiteWins)})`,
    `Black Wins:       ${String(stats.blackWins).padEnd(8)} (${pct(stats.blackWins)})`,
    `Draws:            ${String(stats.draws).padEnd(8)} (${pct(stats.draws)})`,
    `Unfinished (*):   ${stats.inProgress}`,
    stats.otherResults > 0 ? `Other Results:     ${stats.otherResults}` : '',
    '',
    'CONTENT DETAILS',
    '---------------',
    `ECO Coverage:     ${stats.uniqueEcoCodes}/500 (${ecoCompleteness})`,
    `Has ECO Tag:      ${String(stats.gamesWithEco).padEnd(8)} (${pct(stats.gamesWithEco)})`,
    `Has Comments:     ${String(stats.withComments).padEnd(8)} (${pct(stats.withComments)})`,
    `Has NAGs ($):     ${String(stats.withNags).padEnd(8)} (${pct(stats.withNags)})`,
    `Has Symbols (!?): ${String(stats.annotated).padEnd(8)} (${pct(stats.annotated)})`
  ].filter(Boolean).join('\n');
}

function extractList(text: string, kind: ExtractKind): string {
  const items = new Set<string>();
  const regex = kind === 'players'
    ? /\[(?:White|Black)\s+"([^"]*)"\]/gi
    : /\[Event\s+"([^"]*)"\]/gi;

  for (const match of text.matchAll(regex)) {
    const value = match[1]?.trim();
    if (value && value !== '?') items.add(value);
  }

  const sorted = [...items].sort((a, b) => a.localeCompare(b));
  return [
    `EXTRACTED ${kind.toUpperCase()} (${sorted.length})`,
    '==========================',
    ...sorted
  ].join('\n');
}

function updateInputStats(textInput: HTMLTextAreaElement, statsElement: HTMLElement) {
  statsElement.textContent = `${textInput.value.length.toLocaleString()} chars`;
}

function initPgnInfo() {
  const fileInput = byId<HTMLInputElement>('pgnFile');
  const textInput = byId<HTMLTextAreaElement>('pgnText');
  const output = byId<HTMLTextAreaElement>('statsOutput');
  const analyzeButton = byId<HTMLButtonElement>('analyzeBtn');
  const clearButton = byId<HTMLButtonElement>('clearBtn');
  const playersButton = byId<HTMLButtonElement>('extractPlayersBtn');
  const eventsButton = byId<HTMLButtonElement>('extractEventsBtn');
  const copyButton = byId<HTMLButtonElement>('copyBtn');
  const status = byId<HTMLElement>('statusMessage');
  const inputStats = byId<HTMLElement>('inputStats');

  textInput.addEventListener('input', () => {
    updateInputStats(textInput, inputStats);
    if (textInput.value.length > 0) setStatus(status, 'Content changed');
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    if (file.size > maxBytes) {
      setStatus(status, `File is ${formatBytes(file.size)}. Limit is 50 MB.`, 'warning');
      fileInput.value = '';
      return;
    }

    setStatus(status, 'Reading file...');
    const reader = new FileReader();

    reader.addEventListener('load', () => {
      textInput.value = String(reader.result ?? '');
      updateInputStats(textInput, inputStats);
      setStatus(status, 'File loaded');
    });

    reader.addEventListener('error', () => setStatus(status, 'Error reading file', 'error'));
    reader.readAsText(file);
  });

  analyzeButton.addEventListener('click', () => {
    if (!textInput.value.trim()) {
      setStatus(status, 'Paste PGN text or choose a file', 'warning');
      return;
    }

    setStatus(status, 'Analyzing...');
    window.setTimeout(() => {
      const started = performance.now();
      output.value = formatStats(analyzePgn(textInput.value));
      setStatus(status, `Analysis complete (${Math.round(performance.now() - started)}ms)`, 'success');
    }, 10);
  });

  playersButton.addEventListener('click', () => {
    if (!textInput.value.trim()) {
      setStatus(status, 'No PGN text to extract from', 'warning');
      return;
    }

    output.value = extractList(textInput.value, 'players');
    setStatus(status, 'Player list extracted', 'success');
  });

  eventsButton.addEventListener('click', () => {
    if (!textInput.value.trim()) {
      setStatus(status, 'No PGN text to extract from', 'warning');
      return;
    }

    output.value = extractList(textInput.value, 'events');
    setStatus(status, 'Event list extracted', 'success');
  });

  copyButton.addEventListener('click', async () => {
    if (!output.value) return;

    try {
      await navigator.clipboard.writeText(output.value);
      setStatus(status, 'Output copied', 'success');
    } catch {
      setStatus(status, 'Clipboard access unavailable', 'warning');
    }
  });

  clearButton.addEventListener('click', () => {
    textInput.value = '';
    output.value = '';
    fileInput.value = '';
    updateInputStats(textInput, inputStats);
    setStatus(status, 'Ready');
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPgnInfo, { once: true });
} else {
  initPgnInfo();
}
