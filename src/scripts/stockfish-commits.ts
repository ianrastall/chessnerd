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
