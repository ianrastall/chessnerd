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
  /** Tournament average: the mean of the participants' FIDE standard ratings at
   * the time of the event, or the figure the event's own crosstable states.
   * Null only on entries from the earlier collection with no rated games. */
  avgRating: number | null;

  // Everything below is absent on entries from the earlier collection
  // (`legacy`), which carry only the fields above.
  /** CTML tournament record inside the ZIP, beside the PGN. */
  ctml?: string;
  /** Chess.com's own name for the event, when `name` comes from a crosstable. */
  sourceName?: string;
  /** FIDE code of the host country. */
  country?: string;
  players?: number;
  ratedPlayers?: number;
  /** Scheduled rounds where the event's crosstable states them, otherwise the rounds played in the file. */
  rounds?: number;
  /** round-robin, match or team, where the pairings establish it. */
  format?: string;
  /** FIDE category of `avgRating` (category 1 starts at 2251). */
  category?: number;
  /** True when the crosstable itself states the average and category. */
  avgStated?: boolean;
  /** A historical tournament (1834-1989), not a Chess.com event: its ratings
   * are Edo or Chessmetrics, and its file holds only the games between
   * players rated 2400 or more. */
  historical?: boolean;
  /** Chess.com's id for the event, or the historical source file's name. */
  sourceSlug?: string;
  /** Set when only the year or month of the event is known. */
  datePrecision?: 'year' | 'month';
  legacy?: boolean;
}

const REQUIRED_STRINGS = ['slug', 'zip', 'pgn', 'start', 'end', 'name', 'sha256', 'url'] as const;
const OPTIONAL_COUNTS = ['players', 'ratedPlayers', 'rounds', 'category'] as const;
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

    const loose = entry as unknown as Record<string, unknown>;
    for (const key of OPTIONAL_COUNTS) {
      const value = loose[key];
      if (value === undefined || value === null) delete loose[key];
      else if (!Number.isSafeInteger(value) || (value as number) < 0) {
        throw new Error(`Invalid ${key} for ${entry.zip}: ${value}`);
      }
    }
    if (entry.ratedPlayers !== undefined && entry.players !== undefined && entry.ratedPlayers > entry.players) {
      throw new Error(`More rated players than players for ${entry.zip}.`);
    }
    if (entry.ctml !== undefined && entry.ctml !== `${entry.slug}.ctml`) {
      throw new Error(`Slug ${entry.slug} does not match ctml ${entry.ctml}.`);
    }
    if (entry.country !== undefined && !/^[A-Z]{3}$/.test(entry.country)) {
      throw new Error(`Invalid country for ${entry.zip}: ${entry.country}`);
    }
    for (const key of ['sourceName', 'format'] as const) {
      if (entry[key] !== undefined && typeof entry[key] !== 'string') {
        throw new Error(`Invalid ${key} for ${entry.zip}.`);
      }
    }
    if (entry.datePrecision !== undefined && entry.datePrecision !== 'year' && entry.datePrecision !== 'month') {
      throw new Error(`Invalid datePrecision for ${entry.zip}: ${entry.datePrecision}`);
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

export interface EventBundleFile {
  file: string;
  bytes: number;
  sha256: string;
  events: number;
  games: number;
  /** First and last start year of the events in this file. */
  from: string;
  to: string;
  url: string;
}

/** One prepared database: every event at or above `minAverage`, as one PGN
 * (or, where GitHub's file limit requires it, a few consecutive ones). */
export interface EventBundle {
  id: string;
  title: string;
  minAverage: number;
  events: number;
  games: number;
  bytes: number;
  /** Start date of the newest event included. */
  newest: string;
  /** The day the database last changed. */
  updated: string;
  files: EventBundleFile[];
}

export function parseEventBundles(value: unknown): EventBundle[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error('Event bundles list must not be empty.');
  return value.map((item: unknown) => {
    const bundle = item as EventBundle;
    if (!bundle || typeof bundle.id !== 'string' || typeof bundle.title !== 'string') throw new Error('Invalid event bundle.');
    for (const key of ['minAverage', 'events', 'games', 'bytes'] as const) {
      if (!Number.isSafeInteger(bundle[key]) || bundle[key] < 0) throw new Error(`Invalid ${key} for bundle ${bundle.id}.`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(bundle.updated)) throw new Error(`Invalid updated date for bundle ${bundle.id}.`);
    if (!Array.isArray(bundle.files) || bundle.files.length === 0) throw new Error(`Bundle ${bundle.id} has no files.`);
    for (const file of bundle.files) {
      const onGitHub = file.url === `https://github.com/ianrastall/cc-events-archive/raw/main/bundles/${file.file}`;
      if (!onGitHub && !/^https:\/\/pixeldrain\.com\/u\/[A-Za-z0-9_-]{6,16}$/.test(file.url)) {
        throw new Error(`Unexpected bundle download URL: ${file.url}`);
      }
      if (!Number.isSafeInteger(file.bytes) || file.bytes <= 0) throw new Error(`Invalid size for ${file.file}.`);
      if (!/^[a-f0-9]{64}$/i.test(file.sha256)) throw new Error(`Invalid checksum for ${file.file}.`);
    }
    return bundle;
  });
}

export function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(value < 10 * 1024 ? 1 : 0)} KB`;
  return `${(value / (1024 * 1024)).toFixed(value < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}
