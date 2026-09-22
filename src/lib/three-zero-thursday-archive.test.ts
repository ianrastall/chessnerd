import { describe, expect, it } from 'vitest';
import { parseThreeZeroThursdayManifest, type ThreeZeroThursdayEntry } from './three-zero-thursday-archive';

function entry(date: string, session: 'First' | 'Second' | 'Third' = 'First'): ThreeZeroThursdayEntry {
  const suffix = session === 'First' ? 'a' : session === 'Second' ? 'b' : 'c';
  const stem = `3-0-thursday_${date}${suffix}`;
  return {
    date,
    session,
    year: Number(date.slice(0, 4)),
    pgn: `${stem}.pgn`,
    zip: `${stem}.zip`,
    event: '3-0 Thursday',
    sourceEvent: '2026 3 0 Thursday January 01 First',
    games: 800,
    sha256: 'a'.repeat(64),
    url: `https://github.com/ianrastall/3-0-thursday-archive/raw/main/${date.slice(0, 4)}/${stem}.zip`
  };
}

describe('3-0 Thursday manifest', () => {
  it('sorts newest first and keeps the three daily sessions in order', () => {
    const entries = parseThreeZeroThursdayManifest([
      entry('2026-01-01', 'Third'),
      entry('2025-11-13', 'First'),
      entry('2026-01-01', 'First')
    ]);
    expect(entries.map((row) => [row.date, row.session])).toEqual([
      ['2026-01-01', 'First'],
      ['2026-01-01', 'Third'],
      ['2025-11-13', 'First']
    ]);
  });

  it.each([
    { date: '2026-02-30' },
    { year: 2025 },
    { session: 'Fourth' },
    { event: 'Bullet Brawl' },
    { sourceEvent: '' },
    { url: 'javascript:alert(1)' },
    { games: 0 },
    { games: 2.5 },
    { pgn: '../file.pgn' },
    { sha256: 'invalid' }
  ])('rejects inconsistent metadata: %j', (override) => {
    expect(() => parseThreeZeroThursdayManifest([{ ...entry('2026-01-01'), ...override }])).toThrow();
  });

  it('rejects empty or duplicate manifests', () => {
    expect(() => parseThreeZeroThursdayManifest([])).toThrow();
    expect(() => parseThreeZeroThursdayManifest([entry('2026-01-01'), entry('2026-01-01')])).toThrow();
  });
});
