export interface TournamentEntry {
  slug: string;
  zip: string;
  decade: string;
  year: number;
  start: string;
  end: string;
  name: string;
  site: string;
  eco: string;
  games: number;
  bytes: number;
  sha256: string;
  url: string;
  ctml: string;
  cadence: string;
  eventType: string;
  federation: string;
  place: string;
}

const REQUIRED_STRINGS = [
  'slug',
  'zip',
  'decade',
  'start',
  'end',
  'name',
  'sha256',
  'url'
] as const;

const OPTIONAL_STRINGS = [
  'site',
  'eco',
  'ctml',
  'cadence',
  'eventType',
  'federation',
  'place'
] as const;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const ALLOWED_HOSTS = new Set([
  'github.com/ianrastall/PgnTours',
  'raw.githubusercontent.com/ianrastall/PgnTours'
]);

function assertIsoDate(field: string, value: string): void {
  if (!ISO_DATE.test(value)) throw new Error(`Invalid ${field}: ${value}`);
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid ${field}: ${value}`);
  }
}

function assertUrl(value: string, zip: string): void {
  if (!/^https:\/\/(github\.com|raw\.githubusercontent\.com)\/ianrastall\/PgnTours\//.test(value)) {
    throw new Error(`Unexpected tournament download URL: ${value}`);
  }
  if (!value.endsWith(`/${zip}`)) {
    throw new Error(`Download URL does not match ZIP filename: ${value}`);
  }
  // Belt-and-braces host check — reject any redirect-style URL.
  const stripped = value.replace(/^https:\/\//, '');
  const host = stripped.split('/').slice(0, 3).join('/');
  if (!ALLOWED_HOSTS.has(host)) throw new Error(`Unexpected tournament host: ${host}`);
}

export function parseTournamentManifest(value: unknown): TournamentEntry[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('Tournament manifest must contain events.');
  }
  const seen = new Set<string>();
  const entries = value.map((item: unknown, index) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`Invalid tournament entry ${index + 1}.`);
    }
    const entry = item as TournamentEntry;

    for (const key of REQUIRED_STRINGS) {
      if (typeof entry[key] !== 'string' || !entry[key].trim()) {
        throw new Error(`Tournament entry ${index + 1} has an invalid ${key}.`);
      }
    }
    for (const key of OPTIONAL_STRINGS) {
      const current = entry[key];
      if (current === undefined || current === null) {
        (entry as unknown as Record<string, string>)[key] = '';
      } else if (typeof current !== 'string') {
        throw new Error(`Tournament entry ${index + 1} has a non-string ${key}.`);
      }
    }

    assertIsoDate('start', entry.start);
    assertIsoDate('end', entry.end);
    if (entry.start > entry.end) throw new Error(`Inconsistent dates for ${entry.zip}.`);

    if (!/^\d{4}s$/.test(entry.decade)) throw new Error(`Invalid decade: ${entry.decade}`);
    const decadeYear = Number(entry.decade.slice(0, 4));
    if (!Number.isInteger(entry.year) || entry.year < decadeYear || entry.year >= decadeYear + 10) {
      throw new Error(`Year ${entry.year} does not belong to decade ${entry.decade}.`);
    }
    if (Number(entry.start.slice(0, 4)) !== entry.year) {
      throw new Error(`Start year ${entry.start} does not match year ${entry.year}.`);
    }

    if (!/^\d{8}-\d{8}-[a-z0-9-]+\.zip$/.test(entry.zip)) {
      throw new Error(`Invalid archive filename: ${entry.zip}`);
    }
    if (entry.slug !== entry.zip.replace(/\.zip$/, '')) {
      throw new Error(`Slug ${entry.slug} does not match zip ${entry.zip}.`);
    }

    if (!Number.isSafeInteger(entry.games) || entry.games < 0) {
      throw new Error(`Invalid game count for ${entry.zip}: ${entry.games}`);
    }
    if (!Number.isSafeInteger(entry.bytes) || entry.bytes <= 0) {
      throw new Error(`Invalid byte size for ${entry.zip}: ${entry.bytes}`);
    }
    if (!/^[a-f0-9]{64}$/i.test(entry.sha256)) {
      throw new Error(`Invalid checksum for ${entry.zip}.`);
    }

    assertUrl(entry.url, entry.zip);

    if (seen.has(entry.zip)) throw new Error(`Duplicate tournament archive: ${entry.zip}`);
    seen.add(entry.zip);

    return entry;
  });

  return entries.sort(
    (a, b) => b.start.localeCompare(a.start) || b.end.localeCompare(a.end) || a.slug.localeCompare(b.slug)
  );
}

export function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(value < 10 * 1024 ? 1 : 0)} KB`;
  return `${(value / (1024 * 1024)).toFixed(value < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}
