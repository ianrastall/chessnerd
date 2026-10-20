import { describe, expect, it } from 'vitest';
import { formatBytes, groupByPeriod, parseFideArchiveManifest, type FideArchiveFile } from './fide-archive';

const item = 'fide-rating-lists-archive';

function file(over: Partial<FideArchiveFile> = {}): FideArchiveFile {
  const name = over.name ?? 'standard_sep26frl.zip';
  const source = over.source ?? 'fide';
  const path = over.path ?? `${source}/2026-09/${name}`;
  return {
    source,
    period: '2026-09',
    list: 'standard',
    format: 'txt',
    name,
    path,
    url: source === 'fide' ? `https://ratings.fide.com/download/${name}` : `https://www.olimpbase.org/Elo/data/${name}`,
    archiveUrl: `https://archive.org/download/${item}/${path}`,
    bytes: 13_286_216,
    sha256: 'a'.repeat(64),
    ...over
  };
}

const doc = (files: FideArchiveFile[]) => ({ generated: '2026-10-20T00:00:00Z', item, itemUrl: `https://archive.org/details/${item}`, files });

describe('FIDE archive manifest', () => {
  it('accepts a valid manifest', () => {
    expect(parseFideArchiveManifest(doc([file()])).files).toHaveLength(1);
  });

  it.each([
    { sha256: 'xyz' },
    { bytes: 0 },
    { source: 'other' as 'fide' },
    { period: '26-09' },
    { path: 'fide/2026-09/../x.zip', name: 'x.zip' },
    { url: 'https://example.com/standard_sep26frl.zip' },
    { archiveUrl: 'https://example.com/standard_sep26frl.zip' }
  ])('rejects %o', (over) => {
    expect(() => parseFideArchiveManifest(doc([file(over)]))).toThrow();
  });

  it('rejects duplicates and an empty list', () => {
    expect(() => parseFideArchiveManifest(doc([file(), file()]))).toThrow(/Duplicate/);
    expect(() => parseFideArchiveManifest(doc([]))).toThrow();
  });
});

describe('groupByPeriod', () => {
  it('puts newest first and undated last, grouping variants', () => {
    const rows = groupByPeriod([
      file({ period: '2026-08', name: 'standard_aug26frl.zip', path: 'fide/2026-08/standard_aug26frl.zip' }),
      file({ source: 'olimpbase', period: '', name: 'misc.txt', path: 'olimpbase/data/misc.txt' }),
      file(),
      file({ format: 'xml', name: 'standard_sep26frl_xml.zip', path: 'fide/2026-09/standard_sep26frl_xml.zip' })
    ]);
    expect(rows.map((r) => r.period)).toEqual(['2026-09', '2026-08', 'undated']);
    expect(rows[0].files.map((f) => f.format)).toEqual(['txt', 'xml']);
  });
});

describe('formatBytes', () => {
  it('scales units', () => {
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(13_286_216)).toBe('12.7 MB');
    expect(formatBytes(1_178_000_000)).toBe('1.10 GB');
  });
});
