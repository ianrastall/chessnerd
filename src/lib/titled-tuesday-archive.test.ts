import { describe, expect, it } from 'vitest';
import { parseTitledTuesdayManifest, type TitledTuesdayEntry } from './titled-tuesday-archive';

function entry(date: string, session: '' | 'early' | 'late' = ''): TitledTuesdayEntry {
  const yymmdd = date.slice(2, 4) + date.slice(5, 7) + date.slice(8, 10);
  const stem = `cc_titled-tuesday_${yymmdd}${session === 'early' ? 'a' : session === 'late' ? 'b' : ''}`;
  return { date, session, year: Number(date.slice(0, 4)), pgn: `${stem}.pgn`, zip: `${stem}.zip`,
    event: 'Titled Tuesday', games: 1200, sha256: 'a'.repeat(64),
    url: `https://github.com/ianrastall/titled-tuesday-archive/raw/main/${date.slice(0, 4)}/${stem}.zip` };
}

describe('Titled Tuesday manifest', () => {
  it('sorts dates newest first while keeping early and late sessions distinct', () => {
    const entries = parseTitledTuesdayManifest([entry('2024-01-02', 'late'), entry('2026-08-25'), entry('2024-01-02', 'early')]);
    expect(entries.map((row) => [row.date, row.session])).toEqual([
      ['2026-08-25', ''], ['2024-01-02', 'early'], ['2024-01-02', 'late']
    ]);
  });
  it('accepts gaps in collection coverage', () => {
    expect(parseTitledTuesdayManifest([entry('2026-07-07'), entry('2026-08-04')])).toHaveLength(2);
  });
  it.each([
    { date: '2026-02-30' }, { session: 'early' }, { year: 2025 },
    { url: 'javascript:alert(1)' }, { url: 'https://example.com/archive.zip' },
    { games: -1 }, { games: 2.5 }, { pgn: '../file.pgn' }, { sha256: 'invalid' }
  ])('rejects inconsistent metadata: %j', (override) => {
    expect(() => parseTitledTuesdayManifest([{ ...entry('2026-08-25'), ...override }])).toThrow();
  });
  it('rejects legacy Windows-style URLs', () => {
    const row = entry('2026-08-25');
    row.url = row.url.replace('/2026/', '/2026\\');
    expect(() => parseTitledTuesdayManifest([row])).toThrow();
  });
  it('rejects empty or duplicate manifests', () => {
    expect(() => parseTitledTuesdayManifest([])).toThrow();
    expect(() => parseTitledTuesdayManifest([entry('2026-08-25'), entry('2026-08-25')])).toThrow();
  });
});
