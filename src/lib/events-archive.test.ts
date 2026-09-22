import { describe, expect, it } from 'vitest';
import { parseEventsManifest, formatBytes, type EventArchiveEntry } from './events-archive';

function entry(slug: string, start: string, end = start): EventArchiveEntry {
  return {
    slug,
    zip: `${slug}.zip`,
    pgn: `${slug}.pgn`,
    year: Number(start.slice(0, 4)),
    start,
    end,
    name: 'Some Strong Open',
    place: 'Reykjavik, IS',
    games: 400,
    bytes: 12345,
    sha256: 'a'.repeat(64),
    avgRating: 2450,
    url: `https://github.com/ianrastall/cc-events-archive/raw/main/${start.slice(0, 4)}/${slug}.zip`
  };
}

describe('cc-events manifest', () => {
  it('sorts newest first, breaking ties by slug', () => {
    const entries = parseEventsManifest([
      entry('b-open', '2025-06-01'),
      entry('z-open', '2026-03-10'),
      entry('a-open', '2026-03-10')
    ]);
    expect(entries.map((row) => row.slug)).toEqual(['a-open', 'z-open', 'b-open']);
  });

  it('accepts a null average rating', () => {
    const [row] = parseEventsManifest([{ ...entry('no-ratings', '2026-01-01'), avgRating: null }]);
    expect(row.avgRating).toBeNull();
  });

  it('defaults a missing place to an empty string', () => {
    const clone: Record<string, unknown> = { ...entry('no-place', '2026-01-01') };
    delete clone.place;
    expect(parseEventsManifest([clone])[0].place).toBe('');
  });

  it.each([
    { start: '2026-02-30' },
    { end: '2026-01-01', start: '2026-06-01' }, // start after end
    { year: 2025 },
    { zip: 'mismatch.zip' },
    { pgn: 'mismatch.pgn' },
    { url: 'https://github.com/ianrastall/other-repo/raw/main/2026/a-open.zip' },
    { url: 'javascript:alert(1)' },
    { games: -1 },
    { bytes: 0 },
    { avgRating: -5 },
    { sha256: 'invalid' }
  ])('rejects inconsistent metadata: %j', (override) => {
    expect(() => parseEventsManifest([{ ...entry('a-open', '2026-01-01'), ...override }])).toThrow();
  });

  it('rejects empty or duplicate manifests', () => {
    expect(() => parseEventsManifest([])).toThrow();
    expect(() => parseEventsManifest([entry('a-open', '2026-01-01'), entry('a-open', '2026-01-01')])).toThrow();
  });

  it('formats byte sizes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});
