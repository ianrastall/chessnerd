export interface ArchiveSearchEntry {
  name:string; place:string; date:string; precision:'day'|'month'|'year'; year:number; games:number;
  url:string; sha256:string; collection:string; collectionLabel:string; page:string;
}
export function filterArchives(entries:ArchiveSearchEntry[],query:string,collection:string,year:string):ArchiveSearchEntry[] {
  const words=query.toLocaleLowerCase('en').trim().split(/\s+/).filter(Boolean);
  return entries.filter(entry=>(!collection || entry.collection===collection) && (!year || String(entry.year)===year) && words.every(word=>`${entry.name} ${entry.place} ${entry.date} ${entry.collectionLabel}`.toLocaleLowerCase('en').includes(word)));
}
export function displayArchiveDate(entry:Pick<ArchiveSearchEntry,'date'|'precision'>):string {
  return entry.precision==='year' ? entry.date.slice(0,4) : entry.precision==='month' ? entry.date.slice(0,7) : entry.date;
}
