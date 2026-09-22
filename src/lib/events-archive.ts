export interface EventArchiveEntry {
  slug: string;
  zip: string;
  pgn: string;
  year: number;
  start: string;
  end: string;
  name: string;
  place: string;
  games: number;
  bytes: number;
  sha256: string;
  url: string;
  /** Field average rating (mean of rated entries), or null when the event has
   * no rated games. Reported for display only; it is not the cull criterion. */
  avgRating: number | null;
}

const REQUIRED_STRINGS = ['slug', 'zip', 'pgn', 'start', 'end', 'name', 'sha256', 'url'] as const;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function assertIsoDate(field: string, value: string): void {
  if (!ISO_DATE.test(value)) throw new Error(`Invalid ${field}: ${value}`);
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid ${field}: ${value}`);
  }
}

export function parseEventsManifest(value: unknown): EventArchiveEntry[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('Events manifest must contain events.');
  }
  const seen = new Set<string>();
  const entries = value.map((item: unknown, index) => {
    if (!item || typeof item !== 'object') throw new Error(`Invalid event entry ${index + 1}.`);
    const entry = item as EventArchiveEntry;

    for (const key of REQUIRED_STRINGS) {
      if (typeof entry[key] !== 'string' || !entry[key].trim()) {
        throw new Error(`Event entry ${index + 1} has an invalid ${key}.`);
      }
    }
    if (entry.place === undefined || entry.place === null) entry.place = '';
    else if (typeof entry.place !== 'string') throw new Error(`Event entry ${index + 1} has a non-string place.`);

    assertIsoDate('start', entry.start);
    assertIsoDate('end', entry.end);
    if (entry.start > entry.end) throw new Error(`Inconsistent dates for ${entry.zip}.`);
    if (!Number.isInteger(entry.year) || entry.year !== Number(entry.start.slice(0, 4))) {
      throw new Error(`Year ${entry.year} does not match start ${entry.start}.`);
    }

    if (entry.zip !== `${entry.slug}.zip`) throw new Error(`Slug ${entry.slug} does not match zip ${entry.zip}.`);
    if (entry.pgn !== `${entry.slug}.pgn`) throw new Error(`Slug ${entry.slug} does not match pgn ${entry.pgn}.`);

    if (!Number.isSafeInteger(entry.games) || entry.games < 0) {
      throw new Error(`Invalid game count for ${entry.zip}: ${entry.games}`);
    }
    if (!Number.isSafeInteger(entry.bytes) || entry.bytes <= 0) {
      throw new Error(`Invalid byte size for ${entry.zip}: ${entry.bytes}`);
    }
    if (!/^[a-f0-9]{64}$/i.test(entry.sha256)) throw new Error(`Invalid checksum for ${entry.zip}.`);

    const raw = (entry as unknown as Record<string, unknown>).avgRating;
    if (raw === undefined || raw === null) {
      entry.avgRating = null;
    } else if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) {
      throw new Error(`Invalid avgRating for ${entry.zip}: ${raw}`);
    }

    const expected = `https://github.com/ianrastall/cc-events-archive/raw/main/${entry.year}/${entry.zip}`;
    if (entry.url !== expected) throw new Error(`Unexpected events download URL: ${entry.url}`);

    if (seen.has(entry.zip)) throw new Error(`Duplicate event archive: ${entry.zip}`);
    seen.add(entry.zip);
    return entry;
  });

  // Newest first; ties broken by slug for a stable order.
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
