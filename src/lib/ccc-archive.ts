export interface ArchiveEntry {
  pgn: string;
  zip: string;
  year: number;
  start: string;
  end: string;
  event: string;
  games: number;
  url: string;
  sha256: string;
}

export function archiveDate(value: string): string {
  if (!/^\d{6}$/.test(value)) throw new Error(`Invalid archive date: ${value}`);
  const iso = `20${value.slice(0, 2)}-${value.slice(2, 4)}-${value.slice(4, 6)}`;
  const date = new Date(`${iso}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== iso) {
    throw new Error(`Invalid archive date: ${value}`);
  }
  return iso;
}

/** Validate the cross-repository contract before publishing any download links. */
export function parseArchiveManifest(value: unknown): ArchiveEntry[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('CCC manifest must contain at least one event.');
  }
  const seen = new Set<string>();
  const entries = value.map((item: unknown, index) => {
    if (!item || typeof item !== 'object') throw new Error(`Invalid CCC entry ${index + 1}.`);
    const entry = item as ArchiveEntry;
    for (const key of ['pgn', 'zip', 'start', 'end', 'event', 'url', 'sha256'] as const) {
      if (typeof entry[key] !== 'string' || !entry[key].trim()) {
        throw new Error(`CCC entry ${index + 1} has an invalid ${key}.`);
      }
    }
    const start = archiveDate(entry.start);
    const end = archiveDate(entry.end);
    if (start > end || entry.year !== Number(start.slice(0, 4))) {
      throw new Error(`Inconsistent dates for ${entry.zip}.`);
    }
    const prefix = `${entry.start}-${entry.end}-`;
    if (!entry.zip.startsWith(prefix) || !/^\d{6}-\d{6}-[a-z0-9-]+\.zip$/.test(entry.zip)
      || entry.pgn !== entry.zip.replace(/\.zip$/, '.pgn')) {
      throw new Error(`Invalid archive filename: ${entry.zip}`);
    }
    if (!Number.isSafeInteger(entry.games) || entry.games < 0 || !/^[a-f0-9]{64}$/i.test(entry.sha256)) {
      throw new Error(`Invalid count or checksum for ${entry.zip}.`);
    }
    const expectedUrl = `https://github.com/ianrastall/ccc-archive/raw/main/${entry.year}/${entry.zip}`;
    const rawUrl = `https://raw.githubusercontent.com/ianrastall/ccc-archive/main/${entry.year}/${entry.zip}`;
    if (entry.url !== expectedUrl && entry.url !== rawUrl) {
      throw new Error(`Unexpected download URL for ${entry.zip}.`);
    }
    if (seen.has(entry.zip)) throw new Error(`Duplicate CCC archive: ${entry.zip}`);
    seen.add(entry.zip);
    return entry;
  });
  return entries.sort((a, b) => b.start.localeCompare(a.start) || b.end.localeCompare(a.end) || a.zip.localeCompare(b.zip));
}

export function archivePage<T>(entries: T[], requestedPage: number, pageSize: number) {
  const pages = Math.max(1, Math.ceil(entries.length / pageSize));
  const page = Math.max(1, Math.min(requestedPage, pages));
  const start = (page - 1) * pageSize;
  return { page, pages, start, entries: entries.slice(start, start + pageSize) };
}
