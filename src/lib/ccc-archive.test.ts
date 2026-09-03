import { describe, expect, it } from 'vitest';
import manifest from '../../public/data/ccc-archive/manifest.json';
import { archiveDate, archivePage, parseArchiveManifest } from './ccc-archive';

describe('CCC archive contract', () => {
  it('accepts the published manifest and sorts newest first without losing events', () => {
    const entries = parseArchiveManifest(manifest);
    expect(entries).toHaveLength(manifest.length);
    expect(entries[0].start).toBe(manifest.map((entry) => entry.start).sort().at(-1));
    expect(entries.reduce((sum, entry) => sum + entry.games, 0)).toBe(manifest.reduce((sum, entry) => sum + entry.games, 0));
  });

  it('rejects impossible calendar dates instead of silently rolling into the next month', () => {
    expect(archiveDate('240229')).toBe('2024-02-29');
    expect(() => archiveDate('250229')).toThrow();
    expect(() => archiveDate('260431')).toThrow();
  });

  it.each([
    { url: 'javascript:alert(1)' },
    { url: 'https://example.com/archive.zip' },
    { games: -1 },
    { games: 1.5 },
    { year: 1999 },
    { end: '180101' },
    { pgn: '../file.pgn' },
    { sha256: 'invalid' }
  ])('rejects inconsistent metadata: %j', (override) => {
    expect(() => parseArchiveManifest([{ ...manifest[0], ...override }])).toThrow();
  });

  it('rejects an empty manifest or duplicate archives', () => {
    expect(() => parseArchiveManifest([])).toThrow();
    expect(() => parseArchiveManifest([manifest[0], manifest[0]])).toThrow();
  });
});

describe('CCC pagination', () => {
  const rows = Array.from({ length: 447 }, (_, index) => index);
  it('keeps all events reachable, including the partial final page', () => {
    const first = archivePage(rows, 1, 100);
    const last = archivePage(rows, 9, 100);
    expect(first.entries).toHaveLength(100);
    expect(last).toMatchObject({ page: 5, pages: 5, start: 400 });
    expect(last.entries).toHaveLength(47);
    expect(last.entries.at(-1)).toBe(446);
  });
  it('clamps the current page when search reduces the results', () => {
    expect(archivePage([1, 2], 5, 25)).toMatchObject({ page: 1, pages: 1, start: 0, entries: [1, 2] });
    expect(archivePage([], 5, 100)).toMatchObject({ page: 1, pages: 1, start: 0, entries: [] });
  });
});
