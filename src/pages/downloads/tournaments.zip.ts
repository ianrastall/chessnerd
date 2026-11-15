import type { APIRoute } from 'astro';
import { strToU8, zipSync } from 'fflate';
import { loadCuratedTournaments, tournamentCsv } from '../../lib/curated-tournaments';

export const GET: APIRoute = async () => {
  const csv = tournamentCsv(await loadCuratedTournaments());
  const zip = zipSync({ 'tournaments.csv': strToU8(csv) }, { mtime: new Date(2000, 0, 1) });
  return new Response(zip, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="tournaments.zip"',
    },
  });
};
