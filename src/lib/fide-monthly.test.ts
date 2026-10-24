import { describe, expect, it } from 'vitest';
import { currentSnapshot, parseMonthlyIndex, untilUtcMidnight } from './fide-monthly';

function snapshot(period: string) {
  return { period, effectiveFrom: `${period}-01T00:00:00Z`, data: `/data/fide-monthly/${period}/players.json`,
    meta: `/data/fide-monthly/${period}/players.meta.json`, dataSha256: 'a'.repeat(64), metaSha256: 'b'.repeat(64),
    receipt: `https://github.com/ianrastall/fide-db-archive/releases/download/standard-sqlite-${period}-monthly/monthly.json` };
}
describe('monthly FIDE activation', () => {
  it('changes both before/at midnight UTC independently of local timezone', () => {
    const entries = parseMonthlyIndex({ schema: 1, snapshots: [snapshot('2026-10'), snapshot('2026-11')] });
    expect(currentSnapshot(entries, Date.parse('2026-10-31T23:59:59.999Z'))?.period).toBe('2026-10');
    expect(currentSnapshot(entries, Date.parse('2026-11-01T00:00:00Z'))?.period).toBe('2026-11');
    expect(currentSnapshot(entries, Date.parse('2026-09-30T23:59:59Z'))).toBeUndefined();
    expect(untilUtcMidnight(Date.parse('2026-10-31T23:59:59.999Z'))).toBe(2);
  });
  it('rejects invalid periods, duplicate periods, foreign URLs and wrong effective dates', () => {
    const entry = snapshot('2026-11');
    for (const over of [{ period: '2026-13' }, { data: 'https://example.com/players.json' }, { effectiveFrom: '2026-10-31T23:00:00Z' }, { dataSha256: 'bad' }]) {
      expect(() => parseMonthlyIndex({ schema: 1, snapshots: [{ ...entry, ...over }] })).toThrow();
    }
    expect(() => parseMonthlyIndex({ schema: 1, snapshots: [entry, entry] })).toThrow();
  });
});
