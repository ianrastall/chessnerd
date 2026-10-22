import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { archiveDate,parseArchiveManifest } from './ccc-archive';
import { parseTitledTuesdayManifest } from './titled-tuesday-archive';
import { parseBulletBrawlManifest } from './bullet-brawl-archive';
import { parseThreeZeroThursdayManifest } from './three-zero-thursday-archive';
import { parseEventsManifest } from './events-archive';
import { parseTournamentManifest } from './tournament-archive';
import type { ArchiveSearchEntry } from './archive-search';
export const archiveCollections = [
  {id:'titled-tuesday',label:'Titled Tuesday',path:'titled-tuesday-archive',page:'/chesscom-tournaments.html#titled-tuesday',parse:parseTitledTuesdayManifest},
  {id:'bullet-brawl',label:'Bullet Brawl',path:'bullet-brawl-archive',page:'/chesscom-tournaments.html#bullet-brawl',parse:parseBulletBrawlManifest},
  {id:'three-zero-thursday',label:'3-0 Thursday',path:'3-0-thursday-archive',page:'/chesscom-tournaments.html#three-zero-thursday',parse:parseThreeZeroThursdayManifest},
  {id:'ccc',label:'Computer Chess Championship',path:'ccc-archive',page:'/chesscom-tournaments.html#ccc',parse:parseArchiveManifest},
  {id:'events',label:'Selected events',path:'cc-events-archive',page:'/chesscom-tournaments.html#events',parse:parseEventsManifest},
  {id:'tournaments',label:'Tournament archive',path:'tournament-archive',page:'/tournament-archive.html',parse:parseTournamentManifest}
];
// Validate the same manifests used by specialist pages. Build failure preserves the
// previous deployment; this projection never substitutes an empty collection.
export async function loadArchiveIndex():Promise<ArchiveSearchEntry[]> {
  const groups=await Promise.all(archiveCollections.map(async collection=>{
    const data=JSON.parse(await readFile(resolve('public','data',collection.path,'manifest.json'),'utf8'));
    return collection.parse(data).map(entry=>{
      const raw=entry as unknown as Record<string,unknown>;
      const start=String(raw.date || raw.start);
      const date=/^\d{6}$/.test(start) ? archiveDate(start) : start;
      const name=String(raw.name || raw.event) + (raw.session ? ` · ${raw.session}` : '');
      return {name,place:String(raw.place || raw.site || ''),date,precision:(raw.datePrecision || 'day') as ArchiveSearchEntry['precision'],year:entry.year,games:entry.games,url:entry.url,sha256:entry.sha256,collection:collection.id,collectionLabel:collection.label,page:collection.page};
    });
  }));
  return groups.flat().sort((a,b)=>b.date.localeCompare(a.date)||a.collection.localeCompare(b.collection)||a.name.localeCompare(b.name));
}
