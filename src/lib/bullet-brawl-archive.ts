export interface BulletBrawlEntry {
  pgn: string;
  zip: string;
  year: number;
  date: string;
  event: string;
  sourceEvent: string;
  games: number;
  url: string;
  sha256: string;
}

export function parseBulletBrawlManifest(value: unknown): BulletBrawlEntry[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error('Bullet Brawl manifest must contain events.');
  const seen = new Set<string>();
  const entries = value.map((item: unknown, index) => {
    if (!item || typeof item !== 'object') throw new Error(`Invalid Bullet Brawl entry ${index + 1}.`);
    const entry = item as BulletBrawlEntry;
    for (const key of ['pgn', 'zip', 'date', 'event', 'sourceEvent', 'url', 'sha256'] as const) {
      if (typeof entry[key] !== 'string' || !entry[key].trim()) throw new Error(`Invalid ${key} in Bullet Brawl entry ${index + 1}.`);
    }
    if (!/^20\d{2}-\d{2}-\d{2}$/.test(entry.date)) throw new Error(`Invalid event date: ${entry.date}`);
    const date = new Date(`${entry.date}T00:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== entry.date || entry.year !== Number(entry.date.slice(0, 4))) {
      throw new Error(`Inconsistent date or year for ${entry.zip}.`);
    }
    const stem = `bullet-brawl-${entry.date}`;
    if (entry.zip !== `${stem}.zip` || entry.pgn !== `${stem}.pgn`) throw new Error(`Invalid archive filename: ${entry.zip}`);
    if (entry.event !== 'Bullet Brawl' || entry.sourceEvent !== 'Live Chess') throw new Error(`Unexpected event metadata for ${entry.zip}.`);
    if (!Number.isSafeInteger(entry.games) || entry.games <= 0 || !/^[a-f0-9]{64}$/i.test(entry.sha256)) {
      throw new Error(`Invalid count or checksum for ${entry.zip}.`);
    }
    const expected = `https://github.com/ianrastall/bullet-brawl-archive/raw/main/${entry.year}/${entry.zip}`;
    if (entry.url !== expected) throw new Error(`Unexpected Bullet Brawl download URL: ${entry.url}`);
    if (seen.has(entry.zip)) throw new Error(`Duplicate Bullet Brawl archive: ${entry.zip}`);
    seen.add(entry.zip);
    return entry;
  });
  return entries.sort((a, b) => b.date.localeCompare(a.date));
}
