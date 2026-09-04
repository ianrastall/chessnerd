import { describe, expect, it } from 'vitest';
import { parseTournamentManifest, formatBytes, type TournamentEntry } from './tournament-archive';

function entry(overrides: Partial<TournamentEntry> = {}): TournamentEntry {
  const base: TournamentEntry = {
    slug: '20260525-20260605-14th-norway-chess',
    zip: '20260525-20260605-14th-norway-chess.zip',
    decade: '2020s',
    year: 2026,
    start: '2026-05-25',
    end: '2026-06-05',
    name: '14th Norway Chess 2026',
    site: 'Oslo NOR',
    eco: '',
    games: 45,
    bytes: 40960,
    sha256: 'a'.repeat(64),
    url: 'https://github.com/ianrastall/PgnTours/raw/main/2020s/20260525-20260605-14th-norway-chess.zip',
    ctml: '20260525-20260605_14th-norway-chess.ctml',
    cadence: 'mixed',
    eventType: 'round-robin',
    federation: 'NOR',
    place: 'Oslo'
  };
  return { ...base, ...overrides };
}

describe('Tournament manifest', () => {
  it('sorts events newest first', () => {
    const entries = parseTournamentManifest([
      entry({
        slug: '20200101-20200110-a',
        zip: '20200101-20200110-a.zip',
        start: '2020-01-01',
        end: '2020-01-10',
        year: 2020,
        decade: '2020s',
        url: 'https://github.com/ianrastall/PgnTours/raw/main/2020s/20200101-20200110-a.zip'
      }),
      entry(),
      entry({
        slug: '20250526-20250606-13th-norway-chess',
        zip: '20250526-20250606-13th-norway-chess.zip',
        start: '2025-05-26',
        end: '2025-06-06',
        year: 2025,
        url: 'https://github.com/ianrastall/PgnTours/raw/main/2020s/20250526-20250606-13th-norway-chess.zip'
      })
    ]);
    expect(entries.map((row) => row.start)).toEqual(['2026-05-25', '2025-05-26', '2020-01-01']);
  });

  it.each([
    { start: '2026-13-01' },
    { end: '2026-05-24' }, // end before start
    { year: 2025 }, // year doesn't match start
    { decade: '2010s' }, // year not in decade
    { zip: '../evil.zip' },
    { slug: 'mismatched-slug' },
    { games: -1 },
    { games: 2.5 },
    { bytes: 0 },
    { sha256: 'nope' },
    { url: 'https://example.com/download.zip' },
    { url: 'https://github.com/ianrastall/PgnTours/raw/main/2020s/other-file.zip' }
  ])('rejects inconsistent metadata: %j', (override) => {
    expect(() => parseTournamentManifest([entry(override as Partial<TournamentEntry>)])).toThrow();
  });

  it('accepts raw.githubusercontent.com hosts', () => {
    const entries = parseTournamentManifest([
      entry({
        url: 'https://raw.githubusercontent.com/ianrastall/PgnTours/main/2020s/20260525-20260605-14th-norway-chess.zip'
      })
    ]);
    expect(entries).toHaveLength(1);
  });

  it('rejects empty or duplicate manifests', () => {
    expect(() => parseTournamentManifest([])).toThrow();
    expect(() => parseTournamentManifest([entry(), entry()])).toThrow();
  });

  it('normalises missing optional fields to empty strings', () => {
    const raw = { ...entry() } as Record<string, unknown>;
    delete raw.cadence;
    delete raw.eventType;
    delete raw.federation;
    delete raw.place;
    delete raw.site;
    delete raw.eco;
    delete raw.ctml;
    const result = parseTournamentManifest([raw]);
    expect(result[0].cadence).toBe('');
    expect(result[0].eventType).toBe('');
    expect(result[0].federation).toBe('');
    expect(result[0].place).toBe('');
    expect(result[0].site).toBe('');
    expect(result[0].eco).toBe('');
    expect(result[0].ctml).toBe('');
  });
});

describe('formatBytes', () => {
  it('renders sizes with one decimal below 10 units and no decimals above', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(40960)).toBe('40 KB');
    expect(formatBytes(1024 * 1024 * 3)).toBe('3.0 MB');
    expect(formatBytes(1024 * 1024 * 40)).toBe('40 MB');
  });

  it('returns empty for non-positive or non-finite input', () => {
    expect(formatBytes(0)).toBe('');
    expect(formatBytes(-1)).toBe('');
    expect(formatBytes(Number.NaN)).toBe('');
  });
});
