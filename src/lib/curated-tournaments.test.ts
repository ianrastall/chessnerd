import { expect, it } from 'vitest';
import { unzipSync } from 'fflate';
import { loadCuratedTournaments, tournamentCsv, tournamentDates } from './curated-tournaments';
import { GET } from '../pages/downloads/tournaments.zip';

it('curates the display from rated tournaments and documented major events', async () => {
  const entries = await loadCuratedTournaments();
  expect(entries.length).toBeGreaterThan(600);
  expect(entries.length).toBeLessThan(1000);
  expect(entries.every(entry => entry.games > 0 && (entry.players ?? 0) > 0)).toBe(true);
  expect(new Set(entries.map(entry => entry.sha256)).size).toBe(entries.length);
  expect(entries.some(entry => /olympiad/i.test(entry.name) && (entry.avgRating ?? 0) < 2700)).toBe(true);
  expect(entries.some(entry => /olympiad (?:training|qualifier)/i.test(entry.name))).toBe(false);
  expect(entries.filter(entry => entry.year === 2026 && /sinquefield/i.test(entry.name))).toHaveLength(1);
  const partial = entries.find(entry => entry.precision === 'year')!;
  expect(tournamentDates(partial).start).toBe(String(partial.year));
});

it('packs the same rows and download provenance into the CSV ZIP', async () => {
  const response = await (GET as () => Promise<Response>)();
  const archive = unzipSync(new Uint8Array(await response.arrayBuffer()));
  expect(Object.keys(archive)).toEqual(['tournaments.csv']);
  const entries = await loadCuratedTournaments();
  const csv = new TextDecoder('utf-8', { ignoreBOM: true }).decode(archive['tournaments.csv']);
  expect(csv).toBe(tournamentCsv(entries));
  expect(csv.split('\r\n')[0]).toContain('"Category","Average Elo","Games","Players"');
  expect(csv).toContain(`"${entries[0].url}","${entries[0].sha256}"`);
});
