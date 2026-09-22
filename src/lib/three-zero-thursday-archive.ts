export interface ThreeZeroThursdayEntry {
  pgn: string;
  zip: string;
  year: number;
  date: string;
  session: 'First' | 'Second' | 'Third';
  event: string;
  sourceEvent: string;
  games: number;
  url: string;
  sha256: string;
}

const SESSION_SUFFIX: Record<string, string> = { First: 'a', Second: 'b', Third: 'c' };

export function parseThreeZeroThursdayManifest(value: unknown): ThreeZeroThursdayEntry[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error('3-0 Thursday manifest must contain events.');
  const seen = new Set<string>();
  const entries = value.map((item: unknown, index) => {
    if (!item || typeof item !== 'object') throw new Error(`Invalid 3-0 Thursday entry ${index + 1}.`);
    const entry = item as ThreeZeroThursdayEntry;
    for (const key of ['pgn', 'zip', 'date', 'session', 'event', 'sourceEvent', 'url', 'sha256'] as const) {
      if (typeof entry[key] !== 'string' || !entry[key].trim()) throw new Error(`Invalid ${key} in 3-0 Thursday entry ${index + 1}.`);
    }
    if (!/^20\d{2}-\d{2}-\d{2}$/.test(entry.date)) throw new Error(`Invalid event date: ${entry.date}`);
    const date = new Date(`${entry.date}T00:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== entry.date || entry.year !== Number(entry.date.slice(0, 4))) {
      throw new Error(`Inconsistent date or year for ${entry.zip}.`);
    }
    const suffix = SESSION_SUFFIX[entry.session];
    if (!suffix) throw new Error(`Invalid session for ${entry.zip}.`);
    const stem = `3-0-thursday_${entry.date}${suffix}`;
    if (entry.zip !== `${stem}.zip` || entry.pgn !== `${stem}.pgn`) throw new Error(`Invalid archive filename: ${entry.zip}`);
    if (entry.event !== '3-0 Thursday' || !entry.sourceEvent.trim()) throw new Error(`Unexpected event metadata for ${entry.zip}.`);
    if (!Number.isSafeInteger(entry.games) || entry.games <= 0 || !/^[a-f0-9]{64}$/i.test(entry.sha256)) {
      throw new Error(`Invalid count or checksum for ${entry.zip}.`);
    }
    const expected = `https://github.com/ianrastall/3-0-thursday-archive/raw/main/${entry.year}/${entry.zip}`;
    if (entry.url !== expected) throw new Error(`Unexpected 3-0 Thursday download URL: ${entry.url}`);
    if (seen.has(entry.zip)) throw new Error(`Duplicate 3-0 Thursday archive: ${entry.zip}`);
    seen.add(entry.zip);
    return entry;
  });
  // Newest first; within a day, First → Second → Third.
  return entries.sort((a, b) => b.date.localeCompare(a.date) || a.zip.localeCompare(b.zip));
}
