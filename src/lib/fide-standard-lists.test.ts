import { describe, expect, it } from 'vitest';
import { parseStandardRatingManifest, ratingPeriodLabel } from './fide-standard-lists';

function fixture() {
  const period = '2026-10';
  const name = `fide-standard-${period}.sqlite.zip`;
  return { schema: 1, ratingType: 'standard', repository: 'ianrastall/fide-db-archive',
    release: 'standard-sqlite-2026-10', sourceRevision: 'a'.repeat(40), sourceInventorySha256: 'b'.repeat(64), generated: '2026-10-24',
    lists: [{ period, name, databaseName: `fide-standard-${period}.sqlite`, rows: 2, databaseBytes: 4096, databaseSha256: 'c'.repeat(64), zipBytes: 1000, zipSha256: 'd'.repeat(64),
      url: `https://github.com/ianrastall/fide-db-archive/releases/download/standard-sqlite-2026-10/${name}`,
      metadata: { list_date: period, rows: '2', source_sha256: 'e'.repeat(64) } }] };
}
describe('standard-rating publications', () => {
  it('accepts individual standard SQLite downloads with source metadata', () => {
    expect(parseStandardRatingManifest(fixture()).lists[0].period).toBe('2026-10');
  });
  it('preserves year-only dates without inventing a month', () => {
    expect(ratingPeriodLabel('1969')).toBe('1969 (month unknown)');
    expect(ratingPeriodLabel('2019-03')).toBe('Mar 2019');
  });
  it.each([
    { url: 'https://example.com/download.zip' },
    { period: '2026-13' },
    { rows: 0 },
    { rows: 3 },
    { databaseName: 'fide-rapid-2026-10.sqlite' },
    { zipSha256: 'bad' },
    { metadata: { list_date: '2026-09', rows: '2', source_sha256: 'e'.repeat(64) } }
  ])('rejects invalid downloads or mismatched provenance: %o', over => {
    const doc = fixture();
    Object.assign(doc.lists[0], over);
    expect(() => parseStandardRatingManifest(doc)).toThrow();
  });
  it('rejects mixed ratings, duplicate periods and empty publications', () => {
    const doc = fixture();
    expect(() => parseStandardRatingManifest({ ...doc, ratingType: 'rapid' })).toThrow();
    expect(() => parseStandardRatingManifest({ ...doc, lists: [...doc.lists, ...doc.lists] })).toThrow();
    expect(() => parseStandardRatingManifest({ ...doc, lists: [] })).toThrow();
  });
});
