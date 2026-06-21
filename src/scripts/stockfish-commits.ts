interface SourceLink {
  label: string;
  type: string;
  url: string;
}

interface StockfishCommit {
  hash: string;
  short: string;
  author: string;
  date: string;
  github_url: string;
  source_code: SourceLink[];
  message: string;
  subject: string;
}

interface StockfishIndex {
  generated: string;
  source: string;
  total_commits: number;
  latest_commit_sha: string;
  latest_commit_date: string;
  months: string[];
  month_counts: Record<string, number>;
}

interface StockfishMonth {
  month: string;
  commits: StockfishCommit[];
}

const DATA_ROOT = '/data/stockfish-commits';

interface EloResult {
  /** Measured Elo difference of this patch versus the previous version. */
  elo: number;
  /** 95% confidence half-width (the "plus/minus"). */
  error: number;
  /** Time control of the test the figure came from, if identifiable. */
  label: string | null;
}

const PENTANOMIAL = /Ptnml\(0-2\):\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g;
const TOTAL_WLD = /Total:\s*\d+\s*W:\s*(\d+)\s*L:\s*(\d+)\s*D:\s*(\d+)/gi;
const STATED_ELO = /(?<![a-z])(?:elo(?:\s+difference)?)\s*[:=]?\s*([+-]?\d+(?:\.\d+)?)\s*(?:±|\+\/-|\+-)\s*(\d+(?:\.\d+)?)/gi;
const TC_LABEL = /\b(VVLTC|VLTC|LTC|STC)\b/gi;
const Z_95 = 1.959963985;

/** Convert a per-game score in (0,1) to an Elo difference and its 95% error. */
function scoreToElo(mu: number, variance: number, samples: number): EloResult | null {
  if (!(mu > 0 && mu < 1) || variance <= 0 || samples <= 0) {
    return null;
  }
  const standardError = Math.sqrt(variance / samples);
  const derivative = 400 / (Math.LN10 * mu * (1 - mu));
  return {
    elo: -400 * Math.log10((1 - mu) / mu),
    error: Z_95 * derivative * standardError,
    label: null
  };
}

/** Elo from fishtest pentanomial pair counts (the modern, most accurate source). */
function eloFromPentanomial(counts: number[]): EloResult | null {
  const pairs = counts.reduce((sum, value) => sum + value, 0);
  if (pairs === 0) {
    return null;
  }
  const values = [0, 0.25, 0.5, 0.75, 1];
  const mu = counts.reduce((sum, count, i) => sum + count * values[i], 0) / pairs;
  const variance = counts.reduce((sum, count, i) => sum + count * (values[i] - mu) ** 2, 0) / pairs;
  return scoreToElo(mu, variance, pairs);
}

/** Elo from win/loss/draw counts (older fishtest results without pentanomial data). */
function eloFromWld(wins: number, losses: number, draws: number): EloResult | null {
  const games = wins + losses + draws;
  if (games === 0) {
    return null;
  }
  const mu = (wins + 0.5 * draws) / games;
  const variance =
    (wins * (1 - mu) ** 2 + draws * (0.5 - mu) ** 2 + losses * mu ** 2) / games;
  return scoreToElo(mu, variance, games);
}

function labelBefore(message: string, index: number): string | null {
  const head = message.slice(0, index);
  let match: RegExpExecArray | null;
  let found: string | null = null;
  TC_LABEL.lastIndex = 0;
  while ((match = TC_LABEL.exec(head)) !== null) {
    found = match[1].toUpperCase();
  }
  return found;
}

/**
 * Pull the headline Elo gain out of a commit message. Stockfish patches report
 * their strength change through fishtest SPRT results; we recover the same
 * "Elo +/- error" figure the testing framework shows. Long time control results
 * are preferred because they best reflect real playing strength.
 */
function extractElo(message: string): EloResult | null {
  const candidates: EloResult[] = [];
  let match: RegExpExecArray | null;

  PENTANOMIAL.lastIndex = 0;
  while ((match = PENTANOMIAL.exec(message)) !== null) {
    const counts = [1, 2, 3, 4, 5].map((group) => Number(match![group]));
    const result = eloFromPentanomial(counts);
    if (result) {
      result.label = labelBefore(message, match.index);
      candidates.push(result);
    }
  }

  if (candidates.length === 0) {
    TOTAL_WLD.lastIndex = 0;
    while ((match = TOTAL_WLD.exec(message)) !== null) {
      const result = eloFromWld(Number(match[1]), Number(match[2]), Number(match[3]));
      if (result) {
        result.label = labelBefore(message, match.index);
        candidates.push(result);
      }
    }
  }

  if (candidates.length > 0) {
    for (const preferred of ['VVLTC', 'VLTC', 'LTC']) {
      for (let i = candidates.length - 1; i >= 0; i -= 1) {
        if (candidates[i].label === preferred) {
          return candidates[i];
        }
      }
    }
    return candidates[candidates.length - 1];
  }

  STATED_ELO.lastIndex = 0;
  match = STATED_ELO.exec(message);
  if (match) {
    return { elo: Number(match[1]), error: Number(match[2]), label: labelBefore(message, match.index) };
  }

  return null;
}

function makeEloBadge(result: EloResult): HTMLSpanElement {
  const badge = document.createElement('span');
  badge.className = 'stockfish-elo';

  let color = 'var(--text-secondary)';
  let tint = 'var(--bg-tertiary)';
  let line = 'var(--border-color)';
  if (result.elo > 0.05) {
    color = '#4ade80';
    tint = 'rgba(74, 222, 128, 0.12)';
    line = 'rgba(74, 222, 128, 0.45)';
  } else if (result.elo < -0.05) {
    color = '#f87171';
    tint = 'rgba(248, 113, 113, 0.12)';
    line = 'rgba(248, 113, 113, 0.45)';
  }

  // Styled inline so the badge renders independently of the page's scoped CSS,
  // which does not reach these dynamically created elements.
  badge.style.cssText = [
    'display:inline-flex',
    'align-items:center',
    'margin-left:0.4rem',
    'padding:0.02rem 0.4rem',
    'border-radius:999px',
    'font-size:0.78em',
    'font-weight:600',
    'white-space:nowrap',
    'cursor:help',
    `color:${color}`,
    `background:${tint}`,
    `border:1px solid ${line}`
  ].join(';');

  const sign = result.elo >= 0 ? '+' : '−';
  const value = Math.abs(result.elo).toFixed(2);
  const error = result.error.toFixed(1);
  badge.textContent = `${sign}${value} ± ${error} Elo`;

  const where = result.label ? `${result.label} test` : 'testing';
  badge.title =
    `Measured strength change versus the previous version, from the fishtest ${where} ` +
    `(± is the 95% confidence interval). Positive means stronger.`;
  return badge;
}

function byId<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value || 'Unknown date';
  }
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  }).format(date);
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

function makeIcon(name: string): HTMLSpanElement {
  const icon = document.createElement('span');
  icon.className = 'material-icons';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = name;
  return icon;
}

function makeButtonLink(label: string, href: string, iconName: string): HTMLAnchorElement {
  const link = document.createElement('a');
  link.className = 'btn btn-secondary btn-compact';
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.append(makeIcon(iconName), document.createTextNode(label));
  return link;
}

function commitMatches(commit: StockfishCommit, filter: string): boolean {
  if (!filter) {
    return true;
  }
  const haystack = [
    commit.hash,
    commit.short,
    commit.author,
    commit.date,
    commit.subject,
    commit.message
  ].join('\n').toLowerCase();
  return haystack.includes(filter);
}

function initStockfishCommits() {
  const monthSelect = byId<HTMLSelectElement>('stockfishMonth');
  const searchInput = byId<HTMLInputElement>('stockfishSearch');
  const status = byId<HTMLDivElement>('stockfishStatus');
  const generated = byId<HTMLDivElement>('stockfishGenerated');
  const list = byId<HTMLElement>('stockfishList');

  if (!monthSelect || !searchInput || !status || !generated || !list) {
    return;
  }

  const monthSelectEl: HTMLSelectElement = monthSelect;
  const searchInputEl: HTMLInputElement = searchInput;
  const statusEl: HTMLDivElement = status;
  const generatedEl: HTMLDivElement = generated;
  const listEl: HTMLElement = list;

  let index: StockfishIndex | null = null;
  let activeMonth = '';
  let activeCommits: StockfishCommit[] = [];

  function setStatus(text: string) {
    statusEl.textContent = text;
  }

  function setGenerated(text: string) {
    generatedEl.textContent = text;
  }

  function renderCommits() {
    const filter = searchInputEl.value.trim().toLowerCase();
    const visible = activeCommits.filter((commit) => commitMatches(commit, filter));
    const totalForMonth = activeCommits.length.toLocaleString();
    setStatus(`${visible.length.toLocaleString()} of ${totalForMonth} commits in ${activeMonth}`);

    if (index) {
      setGenerated(`${index.total_commits.toLocaleString()} total commits - refreshed ${formatDate(index.generated)}`);
    }

    listEl.replaceChildren();
    if (visible.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'stockfish-empty';
      empty.textContent = 'No commits match the current filters.';
      listEl.append(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const commit of visible) {
      const article = document.createElement('article');
      article.className = 'stockfish-commit';

      const header = document.createElement('div');
      header.className = 'stockfish-commit-header';

      const title = document.createElement('div');
      title.className = 'stockfish-title';

      const subject = document.createElement('a');
      subject.className = 'stockfish-subject';
      subject.href = commit.github_url;
      subject.target = '_blank';
      subject.rel = 'noopener noreferrer';
      subject.textContent = commit.subject || commit.short;

      const meta = document.createElement('div');
      meta.className = 'stockfish-meta';
      meta.textContent = `${formatDate(commit.date)} - ${commit.author}`;

      title.append(subject, meta);

      const elo = extractElo(commit.message);
      if (elo) {
        meta.append(document.createTextNode(' '), makeEloBadge(elo));
      }

      const short = document.createElement('a');
      short.className = 'stockfish-short';
      short.href = commit.github_url;
      short.target = '_blank';
      short.rel = 'noopener noreferrer';
      short.textContent = commit.short;

      header.append(title, short);

      const links = document.createElement('div');
      links.className = 'stockfish-links';
      links.append(makeButtonLink('Commit', commit.github_url, 'open_in_new'));
      for (const source of commit.source_code) {
        links.append(makeButtonLink(source.label, source.url, 'archive'));
      }

      article.append(header, links);

      if (commit.message.trim()) {
        const details = document.createElement('details');
        details.className = 'stockfish-message';

        const summary = document.createElement('summary');
        summary.textContent = 'Message';

        const pre = document.createElement('pre');
        pre.textContent = commit.message.trimEnd();

        details.append(summary, pre);
        article.append(details);
      }

      fragment.append(article);
    }
    listEl.append(fragment);
  }

  async function loadMonth(month: string) {
    activeMonth = month;
    monthSelectEl.disabled = true;
    searchInputEl.disabled = true;
    setStatus(`Loading ${month}...`);
    listEl.replaceChildren();

    const payload = await fetchJson<StockfishMonth>(`${DATA_ROOT}/${month}.json`);
    activeCommits = payload.commits;
    monthSelectEl.disabled = false;
    searchInputEl.disabled = false;
    renderCommits();
  }

  async function loadIndex() {
    index = await fetchJson<StockfishIndex>(`${DATA_ROOT}/index.json`);
    monthSelectEl.replaceChildren();

    for (const month of index.months) {
      const option = document.createElement('option');
      option.value = month;
      option.textContent = `${month} (${(index.month_counts[month] ?? 0).toLocaleString()})`;
      monthSelectEl.append(option);
    }

    const [firstMonth] = index.months;
    if (!firstMonth) {
      throw new Error('No Stockfish commit months were found.');
    }

    monthSelectEl.value = firstMonth;
    await loadMonth(firstMonth);
  }

  monthSelectEl.addEventListener('change', () => {
    void loadMonth(monthSelectEl.value).catch((error: unknown) => {
      setStatus(`Could not load ${monthSelectEl.value}: ${String(error)}`);
    });
  });

  searchInputEl.addEventListener('input', renderCommits);

  void loadIndex().catch((error: unknown) => {
    monthSelectEl.disabled = true;
    searchInputEl.disabled = true;
    setStatus(`Could not load Stockfish data: ${String(error)}`);
    setGenerated('');
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initStockfishCommits, { once: true });
} else {
  initStockfishCommits();
}

export {};
