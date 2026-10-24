export interface StandardRatingList {
  period: string;
  rows: number;
  databaseName: string;
  databaseBytes: number;
  databaseSha256: string;
  name: string;
  zipBytes: number;
  zipSha256: string;
  url: string;
  metadata: Record<string, string>;
}
export interface StandardRatingManifest {
  schema: number;
  ratingType: string;
  repository: string;
  release: string;
  sourceRevision: string;
  sourceInventorySha256: string;
  generated: string;
  lists: StandardRatingList[];
}
export function parseStandardRatingManifest(value: unknown): StandardRatingManifest {
  if (!value || typeof value !== 'object') throw new Error('Missing standard-rating manifest.');
  const doc = value as StandardRatingManifest;
  if (doc.schema !== 1 || doc.ratingType !== 'standard' || doc.repository !== 'ianrastall/fide-db-archive') throw new Error('Unexpected standard-rating publication.');
  if (!/^standard-sqlite-\d{4}-(0[1-9]|1[0-2])(?:-[A-Za-z0-9.-]+)?$/.test(doc.release) || !/^[a-f0-9]{40}$/.test(doc.sourceRevision) || !/^[a-f0-9]{64}$/.test(doc.sourceInventorySha256)) throw new Error('Invalid standard-rating source revision.');
  if (!Array.isArray(doc.lists) || !doc.lists.length) throw new Error('No standard-rating periods.');
  const periods = new Set<string>();
  for (const row of doc.lists) {
    if (typeof row.period !== 'string' || !/^\d{4}(-(0[1-9]|1[0-2]))?$/.test(row.period) || periods.has(row.period)) throw new Error('Invalid or duplicate standard-rating period.');
    periods.add(row.period);
    if (row.databaseName !== `fide-standard-${row.period}.sqlite` || row.name !== `${row.databaseName}.zip`) throw new Error('Unexpected standard-rating filename.');
    if (row.url !== `https://github.com/${doc.repository}/releases/download/${doc.release}/${row.name}`) throw new Error('Unexpected standard-rating download URL.');
    for (const size of [row.rows, row.databaseBytes, row.zipBytes]) if (!Number.isSafeInteger(size) || size <= 0) throw new Error('Invalid standard-rating size or count.');
    for (const hash of [row.databaseSha256, row.zipSha256]) if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error('Invalid standard-rating checksum.');
    if (!row.metadata || row.metadata.list_date !== row.period || row.metadata.rows !== String(row.rows) || !/^[a-f0-9]{64}$/.test(row.metadata.source_sha256)) throw new Error('Standard-rating provenance does not match its period.');
  }
  return { ...doc, lists: [...doc.lists].sort((a, b) => b.period.localeCompare(a.period)) };
}
export function ratingPeriodLabel(period: string): string {
  if (!period.includes('-')) return `${period} (month unknown)`;
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${period}-01T00:00:00Z`));
}
