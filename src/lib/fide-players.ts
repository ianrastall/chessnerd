// Reader for the FIDE player shards built by fide-players/build_players.py.
// The format is described in that project's FORMAT.md; this file is a TypeScript
// port of its decode.mjs.

export type RatingType = 'standard' | 'rapid' | 'blitz';

export interface ListInfo {
  date: string;
  type: RatingType;
}

export interface ShardDirectory {
  version: number;
  generated: string;
  players: number;
  lists: ListInfo[];
  /** [first FIDE id, players, bytes] for each shard file, in order. */
  shards: [number, number, number][];
}

export interface RatingSeries {
  /** Index into ShardDirectory.lists for each entry. */
  list: number[];
  date: string[];
  rating: (number | null)[];
  games: (number | null)[];
  k: (number | null)[];
  flag: (string | null)[];
  section: (string | null)[];
}

export interface Player {
  id: number;
  sex: '' | 'M' | 'F';
  birthYear: number | null;
  names: { from: number; name: string }[];
  feds: { from: number; fed: string }[];
  titles: { from: number; title: string; wTitle: string; oTitle: string; foaTitle: string }[];
  series: Partial<Record<RatingType, RatingSeries>>;
}

export interface NameEntry {
  id: number;
  name: string;
  fed: string;
  title: string;
  peak: number;
  last: string;
  birth: number;
}

const SEP = '\x1f';
const TYPES: RatingType[] = ['standard', 'rapid', 'blitz'];
const utf8 = new TextDecoder('utf-8');

/** Position in directory.shards of the shard that would hold `id`, or -1 if below the first. */
export function shardIndexFor(directory: Pick<ShardDirectory, 'shards'>, id: number): number {
  const shards = directory.shards;
  let lo = 0;
  let hi = shards.length - 1;
  let hit = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (shards[mid][0] <= id) {
      hit = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return hit;
}

export function shardFileName(index: number): string {
  return `shard-${String(index).padStart(4, '0')}.bin.gz`;
}

export function nameFileName(key: string): string {
  return `${key}.json.gz`;
}

/**
 * Gunzip a downloaded file. Shards and name files are stored gzipped; a server that already
 * decoded them (Content-Encoding) hands back plain bytes, which are returned unchanged.
 */
export async function gunzipIfNeeded(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  const head = new Uint8Array(buffer, 0, Math.min(2, buffer.byteLength));
  if (head[0] !== 0x1f || head[1] !== 0x8b) return buffer;
  if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot unpack the player files (DecompressionStream is missing).');
  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).arrayBuffer();
}

/** Key of the name-index file for a surname: first two Latin letters, accents removed. */
export function nameKey(name: string): string {
  const surname = name.split(',')[0];
  const letters = surname
    .normalize('NFD')
    .split('')
    .filter((c) => /[A-Za-z]/.test(c))
    .join('')
    .toLowerCase();
  return `${letters}__`.slice(0, 2);
}

class Reader {
  constructor(
    private readonly bytes: Uint8Array,
    public pos: number
  ) {}

  byte(): number {
    return this.bytes[this.pos++];
  }

  varint(): number {
    let result = 0;
    let multiplier = 1;
    let b: number;
    do {
      b = this.bytes[this.pos++];
      result += (b & 0x7f) * multiplier;
      multiplier *= 128;
    } while (b & 0x80);
    return result;
  }

  zigzag(): number {
    const n = this.varint();
    return n % 2 === 0 ? n / 2 : -(n + 1) / 2;
  }

  string(): string {
    const length = this.varint();
    const text = utf8.decode(this.bytes.subarray(this.pos, this.pos + length));
    this.pos += length;
    return text;
  }
}

function readEvents(reader: Reader): { from: number; value: string }[] {
  const count = reader.varint();
  const events = [];
  for (let i = 0; i < count; i++) events.push({ from: reader.varint(), value: reader.string() });
  return events;
}

function decodeRecord(bytes: Uint8Array, start: number, id: number, lists: ListInfo[]): Player {
  const reader = new Reader(bytes, start);
  const sex = (['', 'M', 'F'] as const)[reader.byte()] ?? '';
  const birthYear = reader.varint() || null;
  const names = readEvents(reader).map((e) => ({ from: e.from, name: e.value }));
  const feds = readEvents(reader).map((e) => ({ from: e.from, fed: e.value }));
  const titles = readEvents(reader).map((e) => {
    const [title = '', wTitle = '', oTitle = '', foaTitle = ''] = e.value.split(SEP);
    return { from: e.from, title, wTitle, oTitle, foaTitle };
  });
  const series: Player['series'] = {};
  for (let typeCount = reader.varint(); typeCount > 0; typeCount--) {
    const type = TYPES[reader.byte()];
    const count = reader.varint();
    const list: number[] = new Array(count);
    const rating: (number | null)[] = new Array(count);
    const games: (number | null)[] = new Array(count);
    const k: (number | null)[] = new Array(count);
    const flag: (string | null)[] = new Array(count);
    const section: (string | null)[] = new Array(count);
    let running = 0;
    for (let i = 0; i < count; i++) {
      running += reader.varint();
      list[i] = running;
    }
    running = 0;
    for (let i = 0; i < count; i++) {
      running += reader.zigzag();
      rating[i] = running === 0 ? null : running - 1;
    }
    for (let i = 0; i < count; i++) {
      const g = reader.varint();
      games[i] = g === 0 ? null : g - 1;
    }
    let at = 0;
    for (let runs = reader.varint(); runs > 0; runs--) {
      const value = reader.varint();
      const length = reader.varint();
      for (let j = 0; j < length; j++) k[at++] = value === 0 ? null : value - 1;
    }
    at = 0;
    for (let runs = reader.varint(); runs > 0; runs--) {
      const [f = '', sec = ''] = reader.string().split(SEP);
      const length = reader.varint();
      for (let j = 0; j < length; j++, at++) {
        flag[at] = f || null;
        section[at] = sec || null;
      }
    }
    series[type] = { list, date: list.map((i) => lists[i]?.date ?? ''), rating, games, k, flag, section };
  }
  return { id, sex, birthYear, names, feds, titles, series };
}

export interface Shard {
  ids: number[];
  find(id: number): Player | null;
}

export function decodeShard(buffer: ArrayBuffer, lists: ListInfo[]): Shard {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  if (String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) !== 'FPL1') throw new Error('Not a player shard.');
  const count = view.getUint32(4, true);
  const dataStart = 8 + count * 8;
  const ids: number[] = new Array(count);
  const offsets: number[] = new Array(count);
  for (let i = 0; i < count; i++) {
    ids[i] = view.getUint32(8 + i * 8, true);
    offsets[i] = view.getUint32(12 + i * 8, true);
  }
  return {
    ids,
    find(id: number): Player | null {
      let lo = 0;
      let hi = count - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (ids[mid] === id) return decodeRecord(bytes, dataStart + offsets[mid], id, lists);
        if (ids[mid] < id) lo = mid + 1;
        else hi = mid - 1;
      }
      return null;
    }
  };
}

/** Name-index rows are [id, name, fed, title, peak, last, birth]. */
export function parseNameEntries(value: unknown): NameEntry[] {
  if (!Array.isArray(value)) throw new Error('Name index must be an array.');
  return value.map((row, index) => {
    if (!Array.isArray(row) || row.length !== 7 || typeof row[0] !== 'number' || typeof row[1] !== 'string') {
      throw new Error(`Invalid name index entry ${index + 1}.`);
    }
    return { id: row[0], name: row[1], fed: String(row[2]), title: String(row[3]), peak: Number(row[4]), last: String(row[5]), birth: Number(row[6]) };
  });
}

/** "2024-07" -> 2024.5 (mid-point of the month); a year-only date -> year + 0.5. */
export function dateToYear(date: string): number {
  const m = /^(\d{4})(?:-(\d{2}))?$/.exec(date);
  if (!m) return NaN;
  return Number(m[1]) + (m[2] ? (Number(m[2]) - 0.5) / 12 : 0.5);
}

/** Filter a name-index file by what the user typed: every word must appear in the name. */
export function matchNames(entries: NameEntry[], query: string, limit = 50): { rows: NameEntry[]; total: number } {
  const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const words = fold(query).split(/[\s,]+/).filter(Boolean);
  if (!words.length) return { rows: [], total: 0 };
  const hits = entries.filter((e) => {
    const name = fold(e.name);
    return words.every((w) => name.includes(w));
  });
  const first = words[0];
  hits.sort((a, b) => {
    const as = fold(a.name).startsWith(first) ? 0 : 1;
    const bs = fold(b.name).startsWith(first) ? 0 : 1;
    return as - bs || b.peak - a.peak;
  });
  return { rows: hits.slice(0, limit), total: hits.length };
}
