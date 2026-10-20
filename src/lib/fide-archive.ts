export interface FideArchiveFile {
  source: 'fide' | 'olimpbase';
  period: string;
  list: string;
  format: string;
  name: string;
  path: string;
  url: string;
  archiveUrl: string;
  bytes: number;
  sha256: string;
  snapshot?: boolean;
}

export interface FideArchiveManifest {
  generated: string;
  item: string;
  itemUrl: string;
  files: FideArchiveFile[];
}

export interface PeriodRow {
  period: string;
  files: FideArchiveFile[];
}

const ITEM_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{4,99}$/;

export function parseFideArchiveManifest(value: unknown): FideArchiveManifest {
  if (!value || typeof value !== 'object') throw new Error('FIDE archive manifest must be an object.');
  const doc = value as FideArchiveManifest;
  if (typeof doc.item !== 'string' || !ITEM_RE.test(doc.item)) throw new Error('Invalid Internet Archive item.');
  if (doc.itemUrl !== `https://archive.org/details/${doc.item}`) throw new Error('Unexpected Internet Archive item URL.');
  if (!Array.isArray(doc.files) || doc.files.length === 0) throw new Error('FIDE archive manifest must contain files.');
  const seen = new Set<string>();
  for (const [index, file] of doc.files.entries()) {
    const label = `FIDE archive file ${index + 1}`;
    for (const key of ['source', 'list', 'format', 'name', 'path', 'url', 'archiveUrl', 'sha256'] as const) {
      if (typeof file[key] !== 'string' || !file[key].trim()) throw new Error(`Invalid ${key} in ${label}.`);
    }
    if (file.source !== 'fide' && file.source !== 'olimpbase') throw new Error(`Unknown source in ${label}.`);
    if (typeof file.period !== 'string' || !/^(\d{4}(-\d{2})?)?$/.test(file.period)) throw new Error(`Invalid period in ${label}.`);
    if (!Number.isSafeInteger(file.bytes) || file.bytes <= 0 || !/^[a-f0-9]{64}$/.test(file.sha256)) {
      throw new Error(`Invalid size or checksum in ${label}.`);
    }
    if (!file.path.startsWith(`${file.source}/`) || !file.path.endsWith(`/${file.name}`) || file.path.includes('..')) {
      throw new Error(`Invalid path in ${label}: ${file.path}`);
    }
    if (file.archiveUrl !== `https://archive.org/download/${doc.item}/${file.path}`) {
      throw new Error(`Unexpected download URL in ${label}: ${file.archiveUrl}`);
    }
    const origin = file.source === 'fide' ? 'https://ratings.fide.com/download/' : 'https://www.olimpbase.org/Elo/';
    if (!file.url.startsWith(origin)) throw new Error(`Unexpected source URL in ${label}: ${file.url}`);
    if (seen.has(file.path)) throw new Error(`Duplicate file: ${file.path}`);
    seen.add(file.path);
  }
  return doc;
}

/** Newest period first; files inside a period ordered by list then format then name. */
export function groupByPeriod(files: FideArchiveFile[]): PeriodRow[] {
  const rows = new Map<string, FideArchiveFile[]>();
  for (const file of files) {
    const key = file.period || 'undated';
    rows.set(key, [...(rows.get(key) ?? []), file]);
  }
  return [...rows.entries()]
    .map(([period, group]) => ({
      period,
      files: group.sort((a, b) => a.list.localeCompare(b.list) || a.format.localeCompare(b.format) || a.name.localeCompare(b.name))
    }))
    .sort((a, b) => (a.period === 'undated' ? 1 : b.period === 'undated' ? -1 : b.period.localeCompare(a.period)));
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
