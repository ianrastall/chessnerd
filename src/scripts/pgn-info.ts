import type { PgnAnalysis } from '../lib/pgn-report';

type View = 'summary' | 'players' | 'events';
type StatusKind = '' | 'success' | 'warning' | 'error';

const maxBytes = 50 * 1024 * 1024;

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element as T;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function reportSections(stats: PgnAnalysis) {
  const number = (value: number) => value.toLocaleString();
  const share = (value: number) => `${number(value)} (${(value / stats.games * 100).toFixed(1)}%)`;
  const ecoCoverage = (stats.uniqueEcoCodes / 500 * 100).toFixed(1);
  return [
    { title: 'Overview', rows: [
      ['Total games', number(stats.games)],
      ['Unique players', number(stats.players.length)],
      ['Unique events', number(stats.events.length)],
      ['PGN size', formatBytes(stats.totalBytes)],
    ] },
    { title: 'Results', rows: [
      ['White wins', share(stats.whiteWins)],
      ['Black wins', share(stats.blackWins)],
      ['Draws', share(stats.draws)],
      ['Unfinished (*)', share(stats.inProgress)],
      ['Other or missing', share(stats.otherResults)],
    ] },
    { title: 'Tags and annotations', rows: [
      ['Games with an ECO code', share(stats.gamesWithEco)],
      ['Distinct ECO codes', `${number(stats.uniqueEcoCodes)} of 500 (${ecoCoverage}%)`],
      ['Games with comments', share(stats.withComments)],
      ['Games with numeric annotations ($)', share(stats.withNags)],
      ['Games with symbols (!?)', share(stats.annotated)],
    ] },
  ];
}

function renderReport(output: HTMLElement, stats: PgnAnalysis, view: View): string {
  output.replaceChildren();
  if (stats.games === 0) {
    output.textContent = 'No games found.';
    return 'No games found.';
  }

  if (view !== 'summary') {
    const names = stats[view];
    const title = document.createElement('h3');
    title.textContent = `${view === 'players' ? 'Players' : 'Events'} (${names.length.toLocaleString()})`;
    output.append(title);
    if (names.length === 0) {
      const empty = document.createElement('p');
      empty.textContent = `No ${view} found in the PGN tags.`;
      output.append(empty);
    } else {
      const list = document.createElement('ul');
      list.className = 'pgn-name-list';
      for (const name of names) {
        const item = document.createElement('li');
        item.textContent = name;
        list.append(item);
      }
      output.append(list);
    }
    return [`EXTRACTED ${view.toUpperCase()} (${names.length})`, ...names].join('\n');
  }

  const sections = reportSections(stats);
  for (const { title, rows } of sections) {
    const section = document.createElement('section');
    const heading = document.createElement('h3');
    heading.textContent = title;
    const metrics = document.createElement('dl');
    metrics.className = 'pgn-metrics';
    for (const [label, value] of rows) {
      const row = document.createElement('div');
      const term = document.createElement('dt');
      term.textContent = label;
      const description = document.createElement('dd');
      description.textContent = value;
      row.append(term, description);
      metrics.append(row);
    }
    section.append(heading, metrics);
    output.append(section);
  }

  return ['PGN STATISTICS REPORT', ...sections.map(({ title, rows }) =>
    [title.toUpperCase(), ...rows.map(([label, value]) => `${label}: ${value}`)].join('\n'))].join('\n\n');
}

function initPgnInfo() {
  const fileInput = byId<HTMLInputElement>('pgnFile');
  const textInput = byId<HTMLTextAreaElement>('pgnText');
  const plainText = byId<HTMLTextAreaElement>('statsOutput');
  const report = byId<HTMLElement>('pgnReport');
  const reportHeading = byId<HTMLElement>('pgnReportHeading');
  const analyzeButton = byId<HTMLButtonElement>('analyzeBtn');
  const reportActions = byId<HTMLElement>('pgnReportActions');
  const status = byId<HTMLElement>('statusMessage');
  const inputStats = byId<HTMLElement>('inputStats');
  const views: Record<View, HTMLButtonElement> = {
    summary: byId('pgnSummaryBtn'), players: byId('extractPlayersBtn'), events: byId('extractEventsBtn'),
  };
  let analysis: PgnAnalysis | null = null;
  let fileRequest = 0;
  let worker: Worker | null = null;
  let requestedView: View = 'summary';

  function setStatus(message: string, kind: StatusKind = '') {
    status.textContent = message;
    status.className = `pgn-status ${kind}`.trim();
  }

  function updateInput() {
    worker?.terminate();
    worker = null;
    analysis = null;
    inputStats.textContent = `${textInput.value.length.toLocaleString()} characters`;
    plainText.value = '';
    reportActions.hidden = true;
    report.textContent = 'Results appear here after analysis.';
    for (const button of Object.values(views)) button.setAttribute('aria-pressed', 'false');
  }

  function showReport(stats: PgnAnalysis, view: View) {
    plainText.value = renderReport(report, stats, view);
    reportActions.hidden = false;
    for (const [name, button] of Object.entries(views)) button.setAttribute('aria-pressed', String(name === view));
    setStatus(stats.games === 0 ? 'No games found.' : 'Analysis complete.', stats.games === 0 ? 'warning' : 'success');
    if (document.activeElement === analyzeButton) reportHeading.focus();
  }

  function show(view: View) {
    if (!textInput.value.trim()) {
      setStatus('Paste PGN text or choose a file.', 'warning');
      return;
    }
    if (analysis) {
      showReport(analysis, view);
      return;
    }
    requestedView = view;
    if (worker) return;
    setStatus('Analyzing PGN…');
    try {
      const request = new Worker(new URL('./pgn-report-worker.ts', import.meta.url), { type: 'module' });
      worker = request;
      request.addEventListener('message', (event: MessageEvent<PgnAnalysis>) => {
        if (worker !== request) return;
        request.terminate();
        worker = null;
        analysis = event.data;
        showReport(analysis, requestedView);
      });
      request.addEventListener('error', () => {
        if (worker !== request) return;
        request.terminate();
        worker = null;
        setStatus('Could not analyze the PGN. Select Analyze to try again.', 'error');
      });
      request.postMessage(textInput.value);
    } catch {
      worker?.terminate();
      worker = null;
      setStatus('Could not start PGN analysis.', 'error');
    }
  }

  textInput.addEventListener('input', () => {
    fileRequest += 1;
    fileInput.value = '';
    updateInput();
    setStatus('');
  });

  fileInput.addEventListener('change', async () => {
    const request = ++fileRequest;
    const file = fileInput.files?.[0];
    if (!file) return;
    if (file.size > maxBytes) {
      setStatus(`File is ${formatBytes(file.size)}. Limit is 50 MB.`, 'warning');
      fileInput.value = '';
      return;
    }
    setStatus('Reading file…');
    try {
      const text = await file.text();
      if (request !== fileRequest) return;
      textInput.value = text;
      updateInput();
      setStatus('File loaded. Select Analyze.');
    } catch {
      if (request === fileRequest) setStatus('Could not read the file.', 'error');
    }
  });

  analyzeButton.addEventListener('click', () => show('summary'));
  views.summary.addEventListener('click', () => show('summary'));
  views.players.addEventListener('click', () => show('players'));
  views.events.addEventListener('click', () => show('events'));

  byId('copyBtn').addEventListener('click', async () => {
    const text = plainText.value;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      if (plainText.value === text) setStatus('Report copied.', 'success');
    } catch {
      if (plainText.value === text) setStatus('Open Plain text to select and copy the report.', 'warning');
    }
  });

  byId('clearBtn').addEventListener('click', () => {
    fileRequest += 1;
    textInput.value = '';
    fileInput.value = '';
    updateInput();
    setStatus('');
    textInput.focus();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPgnInfo, { once: true });
} else {
  initPgnInfo();
}
