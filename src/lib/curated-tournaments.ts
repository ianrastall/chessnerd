import { readFile } from 'node:fs/promises';
import { parseEventsManifest } from './events-archive';
import { parseTournamentManifest } from './tournament-archive';
import { displayArchiveDate, type ArchiveSearchEntry } from './archive-search';

export const tournamentArchivePath = '/tournament-archive.html';
export const tournamentZipPath = '/downloads/tournaments.zip';

const minimumRating = 2700;
export const sourceRepos = {
  'cc-events-archive': 'https://github.com/ianrastall/cc-events-archive',
  PgnTours: 'https://github.com/ianrastall/PgnTours',
} as const;

interface CuratedTournament {
  slug: string;
  name: string;
  sourceName: string;
  place: string;
  start: string;
  end: string;
  precision: ArchiveSearchEntry['precision'];
  year: number;
  avgRating: number | null;
  category: number | null;
  players: number | null;
  games: number;
  url: string;
  sha256: string;
  source: keyof typeof sourceRepos;
  historical: boolean;
}

function majorEvent(name: string): boolean {
  const title = name.toLowerCase().replace(/['’]/g, '');
  if (/\b(?:qualifier|qualification|training|nomination|amateur|reserve)\b/.test(title)) return false;
  return /\bolympiad\b|\bworld-ch\d+\b|\bfide world cup\b|\bamerican chess congress\b/.test(title)
    || /^(?:\d{4} )*(?:fide )?(?:womens? )?candidates\b/.test(title)
    || /\b(?:fide |womens )+(?:chess )?world (?:(?:team|rapid|blitz|chess) )*championship\b/.test(title)
    || /\bworld chess championship match\b/.test(title)
    || /^(?:\d{4} )?world (?:(?:womens|teams?|rapid|blitz|chess) )+championship\b/.test(title);
}

// Confirmed parallel copies. Keep the chosen source's fields together.
const preferred = new Map(Object.entries({
  '20260822-20260827-grand-chess-tour-finals': '2026-08-22-saint-louis-gct-finals',
  '20260810-20260819-gct-sinquefield-cup': '2026-08-10-saint-louis-gct-sinquefield-cup',
  '20260525-20260605-14th-norway-chess': '2026-05-25-oslo-norway-chess-open',
  '20250526-20250606-13th-norway-chess': '2025-05-26-stavanger-13th-norway-armageddon',
  '20250403-20250420-fide-womens-world-championship-match': '2025-04-03-shanghai-chongqing-womens-world-chess-championship',
  '18940315-18940526-world-championship-lasker-steinitz': '1894-03-15-ny-philadelphia-montreal-world-ch05-lasker-steinitz-10-5-4',
  '18920101-18920228-world-championship-steinitz-chigorin': '1892-01-01-havana-world-ch04-steinitz-chigorin-10-8-5',
  '18901209-18910122-world-championship-steinitz-gunsberg': '1890-12-09-new-york-world-ch03-steinitz-gunsberg-6-4-9',
  '18890120-18890224-world-championship-steinitz-chigorin': '1889-01-20-havana-world-ch02-steinitz-chigorin-10-6-1',
  '18860111-18860329-world-championship-steinitz-zukertort': '1886-01-11-u-s-a-world-ch01-steinitz-zukertort-10-5-5',
  '2025-07-29-riyadh-esports-world-cup-finals-playoffs': '2025-07-29-riyadh-esports-world-cup-live-finals-playoffs',
  '2025-07-29-riyadh-ewc-public': '2025-07-29-riyadh-esports-world-cup-live-finals-playoffs',
  ...Object.fromEntries(['a', 'b', 'c', 'd'].map(group => [
    `2025-07-29-riyadh-esports-world-cup-finals-group-${group}`,
    `2025-07-29-riyadh-esports-world-cup-live-finals-group-${group}`,
  ])),
}));

async function readArchiveFile(path: string): Promise<unknown> {
  return JSON.parse(await readFile(`public/data/${path}.json`, 'utf8'));
}

export async function loadCuratedTournaments(): Promise<CuratedTournament[]> {
  const [eventManifest, tournamentManifest, counts] = await Promise.all([
    readArchiveFile('cc-events-archive/manifest'),
    readArchiveFile('tournament-archive/manifest'),
    readArchiveFile('tournament-archive/player-counts'),
  ]);
  if (!counts || typeof counts !== 'object' || Array.isArray(counts)
    || Object.entries(counts).some(([sha, count]) => !/^[a-f\d]{64}$/.test(sha)
      || typeof count !== 'number' || !Number.isSafeInteger(count) || count <= 0)) {
    throw new Error('Invalid PgnTours player counts.');
  }
  const playerCounts = counts as Record<string, number>;
  const events: CuratedTournament[] = parseEventsManifest(eventManifest).map(entry => ({
    ...entry,
    sourceName: entry.sourceName ?? entry.name,
    precision: entry.datePrecision ?? 'day',
    category: entry.category ?? null,
    players: entry.players ?? null,
    source: 'cc-events-archive',
    historical: entry.historical ?? false,
  }));
  const tournaments: CuratedTournament[] = parseTournamentManifest(tournamentManifest).map(entry => ({
    ...entry,
    sourceName: entry.name,
    place: entry.place || entry.site,
    precision: 'day',
    category: entry.fideCategory,
    players: playerCounts[entry.sha256.toLowerCase()] ?? null,
    source: 'PgnTours',
    historical: false,
  }));
  const selected = [...events, ...tournaments].filter(entry => entry.games > 0
    && ((entry.avgRating ?? 0) >= minimumRating || majorEvent(entry.name)));
  const slugs = new Set(selected.map(entry => entry.slug));
  const seen = new Set<string>();
  const rows = selected
    .sort((a, b) => b.start.localeCompare(a.start) || a.name.localeCompare(b.name) || a.slug.localeCompare(b.slug))
    .filter(entry => {
      const replacement = preferred.get(entry.slug);
      if ((replacement && slugs.has(replacement)) || seen.has(entry.sha256)) return false;
      seen.add(entry.sha256);
      return true;
    });

  // When a source assigns the same crosstable title to distinct stages or
  // formats, use its original broadcast titles to tell those rows apart.
  const labels = new Map<string, number>();
  const labelKey = (entry: CuratedTournament) => `${entry.start}:${entry.name.toLowerCase()}`;
  for (const entry of rows) {
    const key = labelKey(entry);
    labels.set(key, (labels.get(key) ?? 0) + 1);
  }
  return rows.map(entry => (labels.get(labelKey(entry)) ?? 0) > 1 ? { ...entry, name: entry.sourceName } : entry);
}

export function tournamentDates(entry: CuratedTournament) {
  return {
    start: displayArchiveDate({ date: entry.start, precision: entry.precision }),
    end: displayArchiveDate({ date: entry.end, precision: entry.precision }),
};
}

export function tournamentCsv(entries: CuratedTournament[]): string {
  const columns = [
    'Tournament', 'Start date', 'End date', 'Date precision', 'Place', 'Category', 'Average Elo',
    'Games', 'Players', 'Historical estimates', 'Source', 'Download URL', 'SHA-256',
  ];
  const rows = entries.map(entry => {
    const { start, end } = tournamentDates(entry);
    return [entry.name, start, end, entry.precision, entry.place, entry.category, entry.avgRating,
      entry.games, entry.players, entry.historical ? 'Yes' : '', sourceRepos[entry.source], entry.url, entry.sha256];
  });
  // Escape spreadsheet formula prefixes as well as CSV quotes and separators.
  function cell(value: string | number | null): string {
    const literal = String(value ?? '');
    const safe = typeof value === 'string' && /^(?:\s*[=+@-]|[\t\r\n])/.test(literal) ? `'${literal}` : literal;
    return `"${safe.replaceAll('"', '""')}"`;
  }
  return '\uFEFF' + [columns, ...rows].map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
}
