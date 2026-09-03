import { describe, expect, it } from 'vitest';
import { parseBulletBrawlManifest, type BulletBrawlEntry } from './bullet-brawl-archive';

function entry(date: string): BulletBrawlEntry {
  const stem = `bullet-brawl-${date}`;
  return {
    date,
    year: Number(date.slice(0, 4)),
    pgn: `${stem}.pgn`,
    zip: `${stem}.zip`,
    event: 'Bullet Brawl',
    sourceEvent: 'Live Chess',
    games: 2500,
    sha256: 'a'.repeat(64),
    url: `https://github.com/ianrastall/bullet-brawl-archive/raw/main/${date.slice(0, 4)}/${stem}.zip`
  };
}

describe('Bullet Brawl manifest', () => {
  it('sorts events newest first and accepts gaps in collection coverage', () => {
    const entries = parseBulletBrawlManifest([entry('2025-08-02'), entry('2026-08-29'), entry('2025-12-27')]);
    expect(entries.map((row) => row.date)).toEqual(['2026-08-29', '2025-12-27', '2025-08-02']);
  });

  it.each([
    { date: '2026-02-30' },
    { year: 2025 },
    { event: 'Community Bullet Brawl' },
    { sourceEvent: 'Bullet Brawl' },
    { url: 'javascript:alert(1)' },
    { games: 0 },
    { games: 2.5 },
    { pgn: '../file.pgn' },
    { sha256: 'invalid' }
  ])('rejects inconsistent metadata: %j', (override) => {
    expect(() => parseBulletBrawlManifest([{ ...entry('2026-08-29'), ...override }])).toThrow();
  });

  it('rejects empty or duplicate manifests', () => {
    expect(() => parseBulletBrawlManifest([])).toThrow();
    expect(() => parseBulletBrawlManifest([entry('2026-08-29'), entry('2026-08-29')])).toThrow();
  });
});
