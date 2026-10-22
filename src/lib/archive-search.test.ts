import { describe,it,expect } from 'vitest';
import { loadArchiveIndex } from './archive-index';
import { displayArchiveDate,filterArchives } from './archive-search';
describe('cross-collection archive discovery',()=>{
  it('preserves every source entry, download URL and checksum',async()=>{
    const entries=await loadArchiveIndex();expect(entries.length).toBeGreaterThan(6000);expect(new Set(entries.map(e=>e.collection)).size).toBe(6);expect(entries.every(e=>e.url.startsWith('https://')&&/^[a-f0-9]{64}$/.test(e.sha256))).toBe(true);
    const {readFile}=await import('node:fs/promises');const {archiveCollections}=await import('./archive-index');
    for(const collection of archiveCollections){const raw=JSON.parse(await readFile(`public/data/${collection.path}/manifest.json`,'utf8'));const source=collection.parse(raw);const output=entries.filter(e=>e.collection===collection.id);expect(output).toHaveLength(source.length);expect(output.map(e=>e.url).sort()).toEqual(source.map(e=>e.url).sort());expect(output.reduce((n,e)=>n+e.games,0)).toBe(source.reduce((n,e)=>n+e.games,0));}
  });
  it('combines collection/year filters and name/place tokens',async()=>{const entries=await loadArchiveIndex();const results=filterArchives(entries,'titled OCTOBER','titled-tuesday','2026');expect(results.length).toBeGreaterThan(0);expect(results.every(e=>e.collection==='titled-tuesday'&&e.year===2026)).toBe(true);expect(filterArchives(entries,'no-such-event-xyz','','')).toEqual([]);});
  it('does not invent a day for imprecisely dated events',()=>{expect(displayArchiveDate({date:'1851-01-01',precision:'year'})).toBe('1851');expect(displayArchiveDate({date:'1851-05-01',precision:'month'})).toBe('1851-05');});
});
