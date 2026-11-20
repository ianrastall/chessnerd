import { describe, expect, it } from 'vitest';
import bundles from '../../public/data/cc-events-archive/bundles.json';
import { parseEventBundles, parseEventsManifest, formatBytes, type EventArchiveEntry } from './events-archive';

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

  it('keeps the tournament details of a reprocessed event', () => {
    const [row] = parseEventsManifest([
      {
        ...entry('corus-2010-a', '2010-01-16', '2010-01-31'),
        ctml: 'corus-2010-a.ctml',
        sourceName: 'Corus 2010 A',
        country: 'NED',
        players: 14,
        ratedPlayers: 14,
        rounds: null,
        format: 'round-robin',
        category: 19,
        avgStated: true
      }
    ]);
    expect(row.category).toBe(19);
    expect(row.country).toBe('NED');
    expect(row.rounds).toBeUndefined();
  });

  it('accepts an entry from the earlier collection, and a year-only date', () => {
    const rows = parseEventsManifest([
      { ...entry('old-open', '2025-03-01'), legacy: true },
      { ...entry('1993-kassho', '1993-01-01', '1993-12-31'), datePrecision: 'year' }
    ]);
    expect(rows.map((row) => row.slug)).toEqual(['old-open', '1993-kassho']);
  });

  it.each([
    { category: -1 },
    { players: 1.5 },
    { players: 10, ratedPlayers: 11 },
    { ctml: 'mismatch.ctml' },
    { country: 'Netherlands' },
    { datePrecision: 'decade' },
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

describe('cc-events bundles', () => {
  const [bundle] = bundles;

  it('accepts the published bundles and a bundle split across providers', () => {
    expect(parseEventBundles(bundles)).toEqual(bundles);
    const [file] = bundle.files;
    const second = {
      ...file, file: 'part-2.zip', from: '2027', to: '2027',
      url: 'https://github.com/ianrastall/cc-events-archive/raw/main/bundles/part-2.zip'
    };
    const split = {
      ...bundle, events: file.events * 2, games: file.games * 2, bytes: file.bytes * 2,
      newest: '2027-01-01', updated: '2027-01-01', files: [file, second]
    };
    expect(parseEventBundles([split])).toEqual([split]);
  });

  it.each([
    { updated: '2026-02-30' },
    { newest: '' },
    { bytes: bundle.bytes + 1 },
    { events: bundle.events - 1 },
    { files: [{ ...bundle.files[0], games: -1 }] },
    { files: [{ ...bundle.files[0], from: '2030' }] }
  ])('rejects inconsistent bundle metadata: %j', override => {
    expect(() => parseEventBundles([{ ...bundle, ...override }])).toThrow();
  });
});
