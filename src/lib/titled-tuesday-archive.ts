export interface TitledTuesdayEntry {
  pgn: string;
  zip: string;
  year: number;
  date: string;
  session: '' | 'early' | 'late';
  event: string;
  games: number;
  url: string;
  sha256: string;
}

export function parseTitledTuesdayManifest(value: unknown): TitledTuesdayEntry[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error('Titled Tuesday manifest must contain events.');
  const seen = new Set<string>();
  const entries = value.map((item: unknown, index) => {
    if (!item || typeof item !== 'object') throw new Error(`Invalid Titled Tuesday entry ${index + 1}.`);
    const entry = item as TitledTuesdayEntry;
    for (const key of ['pgn', 'zip', 'date', 'event', 'url', 'sha256'] as const) {
      if (typeof entry[key] !== 'string' || !entry[key].trim()) throw new Error(`Invalid ${key} in Titled Tuesday entry ${index + 1}.`);
    }
    if (!/^20\d{2}-\d{2}-\d{2}$/.test(entry.date)) throw new Error(`Invalid event date: ${entry.date}`);
    const date = new Date(`${entry.date}T00:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== entry.date || entry.year !== Number(entry.date.slice(0, 4))) {
      throw new Error(`Inconsistent date or year for ${entry.zip}.`);
    }
    if (!['', 'early', 'late'].includes(entry.session)) throw new Error(`Invalid session for ${entry.zip}.`);
    const suffix = entry.session === 'early' ? 'a' : entry.session === 'late' ? 'b' : '';
    const stem = `titled-tuesday-${entry.date}${suffix}`;
    if (entry.zip !== `${stem}.zip` || entry.pgn !== `${stem}.pgn`) throw new Error(`Invalid archive filename: ${entry.zip}`);
    if (!Number.isSafeInteger(entry.games) || entry.games <= 0 || !/^[a-f0-9]{64}$/i.test(entry.sha256)) {
      throw new Error(`Invalid count or checksum for ${entry.zip}.`);
    }
    const expected = `https://github.com/ianrastall/titled-tuesday-archive/raw/main/${entry.year}/${entry.zip}`;
    if (entry.url !== expected) throw new Error(`Unexpected Titled Tuesday download URL: ${entry.url}`);
    if (seen.has(entry.zip)) throw new Error(`Duplicate Titled Tuesday archive: ${entry.zip}`);
    seen.add(entry.zip);
    return entry;
  });
  return entries.sort((a, b) => b.date.localeCompare(a.date) || a.zip.localeCompare(b.zip));
}
