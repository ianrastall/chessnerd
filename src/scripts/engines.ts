import { classifyEngineDownload, engineArchitectures, enginePlatforms } from '../lib/engine-downloads';
import cardMetadata from '../data/engine-cards.json';

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

interface ReleaseHistory {
  generated: string;
  releases: Record<string, EngineRelease[]>;
}

type SortMode = 'released' | 'oldest' | 'name' | 'stars';
type Download = ReleaseAsset & { name: string; url: string } & ReturnType<typeof classifyEngineDownload>;
type ListedRelease = { engine: Engine; release: EngineRelease; downloads: Download[] };

const DATA_URL = '/data/engines/engines.json';
const HISTORY_URL = '/data/engines/release-history.json';
const PAGE_SIZE = 18;
const metadata: Record<string, { protocols?: string[]; logo?: string }> = cardMetadata;
const platformIcons: Record<string, string> = {
  windows: 'windows11', macos: 'apple', linux: 'linux', android: 'android',
};
const languageIcons: Record<string, string> = {
  C: 'c', 'C++': 'cplusplus', 'C#': 'csharp', Rust: 'rust', Java: 'java', Go: 'go',
  Zig: 'zig', Python: 'python', JavaScript: 'javascript', TypeScript: 'typescript', Kotlin: 'kotlin',
};

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

function makeImage(url: string): HTMLImageElement {
  const image = document.createElement('img');
  image.src = url;
  image.alt = '';
  image.loading = 'lazy';
  image.decoding = 'async';
  image.referrerPolicy = 'no-referrer';
  return image;
}

function makeBrandIcon(name: string): HTMLImageElement {
  const image = makeImage(`/img/engine-icons/${name}.svg`);
  if (name === 'apple' || name === 'linux' || name === 'rust') image.classList.add('engine-icon-mono');
  return image;
}

function makePlatformIcon(platform: string): HTMLElement | undefined {
  const name = platformIcons[platform];
  return name ? makeBrandIcon(name) : platform === 'freebsd' ? makeIcon('terminal') : undefined;
}

function makeTag(text: string, icon?: HTMLElement): HTMLSpanElement {
  const tag = document.createElement('span');
  tag.className = 'engine-tag';
  if (icon) {
    const label = document.createElement('span');
    label.textContent = text;
    tag.append(icon, label);
  } else {
    tag.textContent = text;
  }
  return tag;
}

function releaseTime(release: EngineRelease): number {
  return Date.parse(release.published_at ?? '') || 0;
}

function sortReleases(releases: ListedRelease[], mode: SortMode): ListedRelease[] {
  return releases.toSorted((a, b) => {
    const byDate = releaseTime(b.release) - releaseTime(a.release);
    if (mode === 'name') return a.engine.name.localeCompare(b.engine.name) || byDate;
    if (mode === 'stars') return (b.engine.stars ?? 0) - (a.engine.stars ?? 0) || byDate;
    if (mode === 'oldest') return -byDate || a.engine.name.localeCompare(b.engine.name);
    return byDate || a.engine.name.localeCompare(b.engine.name);
  });
}

function releaseMatches({ engine, release }: ListedRelease, filter: string): boolean {
  if (!filter) return true;
  const haystack = [
    engine.name,
    engine.author,
    engine.repo,
    engine.language,
    engine.license,
    engine.description,
    release.tag,
    release.name,
    ...(metadata[engine.repo.toLowerCase()]?.protocols ?? []),
  ]
    .filter(Boolean)
    .join('\n')
    .toLowerCase();
  return haystack.includes(filter);
}

function renderVersion(release: EngineRelease): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'engine-version-row';
  const version = release.url ? document.createElement('a') : document.createElement('span');
  if (version instanceof HTMLAnchorElement && release.url) {
    version.href = release.url;
    version.target = '_blank';
    version.rel = 'noopener noreferrer';
  }
  version.className = 'engine-version';
  version.textContent = release.tag || release.name || 'Version details';

  const date = document.createElement('time');
  date.className = 'engine-release-date';
  if (release.published_at) date.dateTime = release.published_at;
  date.textContent = formatDate(release.published_at);

  wrap.append(version);
  if (release.prerelease) wrap.append(makeTag('Prerelease'));
  wrap.append(date);
  return wrap;
}

function renderDownloads(assets: Download[], open: boolean): HTMLDetailsElement | null {
  if (assets.length === 0) return null;

  const details = document.createElement('details');
  details.className = 'engine-downloads';
  details.open = open;
  const summary = document.createElement('summary');
  summary.textContent = `Downloads (${assets.length})`;
  details.append(summary);

  const groups = document.createElement('div');
  groups.className = 'engine-download-groups';
  for (const { value, label } of enginePlatforms) {
    const downloads = assets.filter((asset) => asset.platform === value);
    if (downloads.length === 0) continue;

    const title = document.createElement('div');
    title.className = 'engine-download-title';
    const icon = makePlatformIcon(value);
    if (icon) title.append(icon);
    title.append(document.createTextNode(label));
    const list = document.createElement('ul');
    list.setAttribute('aria-label', label);
    for (const asset of downloads) {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = asset.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = asset.name;
      item.append(link);

      const architecture = engineArchitectures.find(({ value }) => value === asset.architecture)?.label;
      const metadata = [architecture, formatSize(asset.size)].filter(Boolean).join(' · ');
      if (metadata) {
        const meta = document.createElement('span');
        meta.className = 'asset-meta';
        meta.textContent = metadata;
        item.append(meta);
      }
      list.append(item);
    }
    groups.append(title, list);
  }
  details.append(groups);
  return details;
}

function renderEngine({ engine, release, downloads }: ListedRelease, assets: Download[], showDownloads: boolean): HTMLElement {
  const card = document.createElement('article');
  card.className = 'engine-card';

  const head = document.createElement('div');
  head.className = 'engine-head';
  const details = metadata[engine.repo.toLowerCase()];
  const identity = document.createElement('div');
  identity.className = 'engine-identity';
  const logo = document.createElement('span');
  logo.className = 'engine-logo';
  if (details?.logo) {
    const image = makeImage(details.logo);
    image.addEventListener('error', () => logo.replaceChildren(makeIcon('extension')), { once: true });
    logo.append(image);
  } else {
    logo.append(makeIcon('extension'));
  }

  const name = document.createElement('a');
  name.className = 'engine-name';
  name.href = engine.homepage || engine.url || '#';
  name.target = '_blank';
  name.rel = 'noopener noreferrer';
  name.textContent = engine.name;
  identity.append(logo, name);
  head.append(identity);

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
  for (const protocol of details?.protocols ?? []) tags.append(makeTag(protocol, makeIcon('settings_ethernet')));
  for (const { value, label } of enginePlatforms) {
    if (value !== 'other' && downloads.some((asset) => asset.platform === value)) {
      tags.append(makeTag(label, makePlatformIcon(value)));
    }
  }
  if (engine.language) {
    const icon = languageIcons[engine.language];
    tags.append(makeTag(engine.language, icon ? makeBrandIcon(icon) : makeIcon('code')));
  }
  if (engine.license) tags.append(makeTag(engine.license));
  if (engine.archived) tags.append(makeTag('Archived'));
  if (tags.childElementCount > 0) card.append(tags);

  card.append(renderVersion(release));

  const links = document.createElement('div');
  links.className = 'engine-links';
  if (engine.url) links.append(makeButtonLink('Repo', engine.url, 'open_in_new'));
  if (engine.homepage) links.append(makeButtonLink('Website', engine.homepage, 'language'));
  if (links.childElementCount > 0) card.append(links);

  const downloadList = renderDownloads(assets, showDownloads);
  if (downloadList) card.append(downloadList);

  return card;
}

function initEngines() {
  const sortSelect = byId<HTMLSelectElement>('enginesSort');
  const searchInput = byId<HTMLInputElement>('enginesSearch');
  const platformSelect = byId<HTMLSelectElement>('enginesPlatform');
  const architectureSelect = byId<HTMLSelectElement>('enginesArchitecture');
  const status = byId<HTMLDivElement>('enginesStatus');
  const generated = byId<HTMLTimeElement>('enginesGenerated');
  const list = byId<HTMLElement>('enginesList');
  const pagination = byId<HTMLElement>('enginesPages');
  const previous = byId<HTMLButtonElement>('enginesPrevious');
  const next = byId<HTMLButtonElement>('enginesNext');

  if (!sortSelect || !searchInput || !platformSelect || !architectureSelect || !status || !generated || !list || !pagination || !previous || !next) return;

  let releases: ListedRelease[] = [];
  let page = 0;
  let historyAvailable = false;

  function render() {
    const filter = searchInput!.value.trim().toLowerCase();
    const mode = sortSelect!.value as SortMode;
    const platform = platformSelect!.value;
    const architecture = architectureSelect!.value;
    const hasDownloadFilter = Boolean(platform || architecture);
    const matching = sortReleases(releases.filter((entry) => releaseMatches(entry, filter)), mode)
      .map((entry) => ({
        entry,
        downloads: entry.downloads.filter((asset) =>
          (!platform || asset.platform === platform) && (!architecture || asset.architecture === architecture)),
      }))
      .filter(({ downloads }) => !hasDownloadFilter || downloads.length > 0);

    const pageCount = Math.ceil(matching.length / PAGE_SIZE);
    page = Math.min(page, Math.max(0, pageCount - 1));
    const count = matching.length.toLocaleString();
    const scope = historyAvailable ? '' : ' · Latest releases only';
    status!.textContent = pageCount > 1
      ? `${count} releases · Page ${page + 1} of ${pageCount}${scope}`
      : `${count} releases${scope}`;
    pagination!.hidden = pageCount <= 1;
    previous!.disabled = page === 0;
    next!.disabled = page + 1 >= pageCount;

    list!.replaceChildren();
    if (matching.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'engines-empty';
      empty.textContent = 'No releases match your search or filters.';
      list!.append(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const { entry, downloads } of matching.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)) {
      fragment.append(renderEngine(entry, downloads, hasDownloadFilter));
    }
    list!.append(fragment);
  }

  function resetPage() {
    page = 0;
    render();
  }

  sortSelect.addEventListener('change', resetPage);
  searchInput.addEventListener('input', resetPage);
  platformSelect.addEventListener('change', resetPage);
  architectureSelect.addEventListener('change', resetPage);
  previous.addEventListener('click', () => { page -= 1; render(); });
  next.addEventListener('click', () => { page += 1; render(); });

  void Promise.all([
    fetchJson<EnginesPayload>(DATA_URL),
    fetchJson<ReleaseHistory>(HISTORY_URL).catch(() => null),
  ])
    .then(([payload, history]) => {
      historyAvailable = Boolean(history?.releases);
      const refreshed = history?.generated ?? payload.generated;
      generated.dateTime = refreshed;
      generated.textContent = `Refreshed ${formatDate(refreshed)}`;
      const versionsByRepo = new Map(Object.entries(history?.releases ?? {})
        .map(([repo, versions]) => [repo.toLowerCase(), versions] as const));
      const seenRepos = new Set<string>();
      releases = (payload.engines ?? []).flatMap((engine) => {
        const repo = engine.repo.toLowerCase();
        if (seenRepos.has(repo)) return [];
        seenRepos.add(repo);
        const versions = [...(versionsByRepo.get(repo) ?? [])];
        const latest = engine.latest_release;
        if (latest && !versions.some((release) => release.tag === latest.tag)) versions.push(latest);
        return versions.map((release) => ({
          engine,
          release,
          downloads: (release.assets ?? []).flatMap((asset) =>
            asset.name && asset.url ? [{ ...asset, name: asset.name, url: asset.url, ...classifyEngineDownload(asset.name) }] : []),
        }));
      });
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
