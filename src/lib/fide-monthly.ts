export interface MonthlySnapshot {
  period: string;
  effectiveFrom: string;
  data: string;
  meta: string;
  dataSha256: string;
  metaSha256: string;
  receipt: string;
}

export function parseMonthlyIndex(value: unknown): MonthlySnapshot[] {
  const index = value as { schema: number; snapshots: MonthlySnapshot[] };
  if (!index || index.schema !== 1 || !Array.isArray(index.snapshots)) throw new Error('Invalid monthly snapshot index.');
  const seen = new Set<string>();
  for (const entry of index.snapshots) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(entry.period) || seen.has(entry.period) || entry.effectiveFrom !== `${entry.period}-01T00:00:00Z` ||
      entry.data !== `/data/fide-monthly/${entry.period}/players.json` || entry.meta !== `/data/fide-monthly/${entry.period}/players.meta.json` ||
      !/^[a-f0-9]{64}$/.test(entry.dataSha256) || !/^[a-f0-9]{64}$/.test(entry.metaSha256) ||
      entry.receipt !== `https://github.com/ianrastall/fide-db-archive/releases/download/standard-sqlite-${entry.period}-monthly/monthly.json`) throw new Error('Invalid monthly snapshot.');
    seen.add(entry.period);
  }
  return index.snapshots;
}

export function currentSnapshot(entries: MonthlySnapshot[], now = Date.now()): MonthlySnapshot | undefined {
  return entries.filter(e => Date.parse(e.effectiveFrom) <= now).sort((a, b) => b.period.localeCompare(a.period))[0];
}

// Daily UTC boundary timers also handle months with different numbers of days.
export function untilUtcMidnight(now = Date.now()): number {
  const date = new Date(now);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1) - now + 1;
}

export async function verifiedJson(url: string, expectedHash: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.arrayBuffer();
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)), v => v.toString(16).padStart(2, '0')).join('');
  if (hash !== expectedHash) throw new Error('Monthly data checksum mismatch.');
  return JSON.parse(new TextDecoder().decode(data));
}
