interface ReleaseAsset {
  name: string | null;
  url: string | null;
  size: number | null;
  downloads: number | null;
}

interface EngineRelease {
  tag: string | null;
  name: string | null;
  published_at: string | null;
  url: string | null;
  prerelease: boolean;
  assets: ReleaseAsset[];
}

interface Engine {
  name: string;
  repo: string;
  author: string | null;
  url: string | null;
  homepage: string | null;
  description: string | null;
  language: string | null;
  license: string | null;
  stars: number | null;
  pushed_at: string | null;
  created_at: string | null;
  archived: boolean;
  latest_release: EngineRelease | null;
}

interface EnginesPayload {
  generated: string;
  source: string;
  count: number;
  engines: Engine[];
}

type SortMode = 'released' | 'name' | 'stars';

const DATA_URL = '/data/engines/engines.json';

function byId<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

function formatDate(value: string | null): string {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: '2-digit' }).format(date);
}

function formatSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
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

function makeTag(text: string): HTMLSpanElement {
  const tag = document.createElement('span');
  tag.className = 'engine-tag';
  tag.textContent = text;
  return tag;
}

function releaseTime(engine: Engine): number {
  const value = engine.latest_release?.published_at;
  const time = value ? new Date(value).getTime() : NaN;
  return Number.isNaN(time) ? -Infinity : time;
}

function sortEngines(engines: Engine[], mode: SortMode): Engine[] {
  const sorted = [...engines];
  switch (mode) {
    case 'name':
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'stars':
      sorted.sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0));
      break;
    case 'released':
    default:
      sorted.sort((a, b) => releaseTime(b) - releaseTime(a));
      break;
  }
  return sorted;
}

function engineMatches(engine: Engine, filter: string): boolean {
  if (!filter) return true;
  const haystack = [
    engine.name,
    engine.author,
    engine.repo,
    engine.language,
    engine.license,
    engine.description,
    engine.latest_release?.tag
  ]
    .filter(Boolean)
    .join('\n')
    .toLowerCase();
  return haystack.includes(filter);
}

function renderRelease(engine: Engine): HTMLElement {
  const release = engine.latest_release;
  const wrap = document.createElement('div');
  wrap.className = 'engine-release';

  if (!release) {
    wrap.classList.add('is-empty');
    wrap.append(makeIcon('history'), document.createTextNode('No tagged releases'));
    return wrap;
  }

  const version = document.createElement('span');
  version.className = 'engine-version';
  version.textContent = release.tag || release.name || 'Release';

  const date = document.createElement('span');
  date.className = 'engine-release-date';
  date.textContent = formatDate(release.published_at);

  wrap.append(makeIcon('new_releases'), version, date);
  return wrap;
}

function renderDownloads(engine: Engine): HTMLDetailsElement | null {
  const assets = engine.latest_release?.assets ?? [];
  if (assets.length === 0) return null;

  const details = document.createElement('details');
  details.className = 'engine-downloads';
  const summary = document.createElement('summary');
  summary.textContent = `Downloads (${assets.length})`;
  details.append(summary);

  const list = document.createElement('ul');
  for (const asset of assets) {
    if (!asset.url || !asset.name) continue;
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = asset.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = asset.name;
    const size = document.createElement('span');
    size.className = 'asset-size';
    size.textContent = formatSize(asset.size);
    item.append(link, size);
    list.append(item);
  }
  details.append(list);
  return details;
}

function renderEngine(engine: Engine): HTMLElement {
  const card = document.createElement('article');
  card.className = 'engine-card';

  const head = document.createElement('div');
  head.className = 'engine-head';

  const name = document.createElement('a');
  name.className = 'engine-name';
  name.href = engine.homepage || engine.url || '#';
  name.target = '_blank';
  name.rel = 'noopener noreferrer';
  name.textContent = engine.name;
  head.append(name);

  if (typeof engine.stars === 'number') {
    const stars = document.createElement('span');
    stars.className = 'engine-stars';
    stars.append(makeIcon('star'), document.createTextNode(engine.stars.toLocaleString()));
    head.append(stars);
  }
  card.append(head);

  if (engine.author) {
    const author = document.createElement('div');
    author.className = 'engine-author';
    author.textContent = `by ${engine.author}`;
    card.append(author);
  }

  if (engine.description) {
    const desc = document.createElement('p');
    desc.className = 'engine-desc';
    desc.textContent = engine.description;
    card.append(desc);
  }

  const tags = document.createElement('div');
  tags.className = 'engine-tags';
  if (engine.language) tags.append(makeTag(engine.language));
  if (engine.license) tags.append(makeTag(engine.license));
  if (engine.archived) tags.append(makeTag('Archived'));
  if (tags.childElementCount > 0) card.append(tags);

  card.append(renderRelease(engine));

  const links = document.createElement('div');
  links.className = 'engine-links';
  if (engine.url) links.append(makeButtonLink('Repo', engine.url, 'open_in_new'));
  if (engine.latest_release?.url) {
    links.append(makeButtonLink('Release', engine.latest_release.url, 'new_releases'));
  }
  if (engine.homepage) links.append(makeButtonLink('Website', engine.homepage, 'language'));
  if (links.childElementCount > 0) card.append(links);

  const downloads = renderDownloads(engine);
  if (downloads) card.append(downloads);

  return card;
}

function initEngines() {
  const sortSelect = byId<HTMLSelectElement>('enginesSort');
  const searchInput = byId<HTMLInputElement>('enginesSearch');
  const status = byId<HTMLDivElement>('enginesStatus');
  const generated = byId<HTMLDivElement>('enginesGenerated');
  const list = byId<HTMLElement>('enginesList');

  if (!sortSelect || !searchInput || !status || !generated || !list) return;

  let engines: Engine[] = [];

  function render() {
    const filter = searchInput!.value.trim().toLowerCase();
    const mode = sortSelect!.value as SortMode;
    const visible = sortEngines(engines.filter((engine) => engineMatches(engine, filter)), mode);

    status!.textContent = filter
      ? `${visible.length.toLocaleString()} of ${engines.length.toLocaleString()} releases`
      : `${engines.length.toLocaleString()} engine releases`;

    list!.replaceChildren();
    if (visible.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'engines-empty';
      empty.textContent = 'No releases match your search.';
      list!.append(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const engine of visible) fragment.append(renderEngine(engine));
    list!.append(fragment);
  }

  sortSelect.addEventListener('change', render);
  searchInput.addEventListener('input', render);

  void fetchJson<EnginesPayload>(DATA_URL)
    .then((payload) => {
      // The feed only shows engines that have an actual GitHub release.
      engines = (payload.engines ?? []).filter((engine) => engine.latest_release);
      generated.textContent = `refreshed ${formatDate(payload.generated)}`;
      render();
    })
    .catch((error: unknown) => {
      status.textContent = `Could not load engine data: ${String(error)}`;
    });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initEngines, { once: true });
} else {
  initEngines();
}

export {};
