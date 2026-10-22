import { filterArchives,displayArchiveDate,type ArchiveSearchEntry } from '../lib/archive-search';
const get=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const query=get<HTMLInputElement>('archive-query'),collection=get<HTMLSelectElement>('archive-collection'),year=get<HTMLSelectElement>('archive-year');
const results=get<HTMLTableSectionElement>('archive-results'),count=get('archive-count');
const previous=get<HTMLButtonElement>('archive-previous'),next=get<HTMLButtonElement>('archive-next');
let page=1,generation=0,index:Promise<ArchiveSearchEntry[]>|null=null;
const size=12;
function load(){
  if(!index) index=fetch('/data/archive-search.json').then(async response=>{
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    const entries=await response.json();if(!Array.isArray(entries)) throw new Error('Invalid index');return entries as ArchiveSearchEntry[];
  }).catch(error=>{index=null;throw error;});
  return index;
}
function restore(){
  const params=new URLSearchParams(location.search);query.value=params.get('q') || '';
  collection.value=params.get('collection') || '';year.value=params.get('year') || '';
  page=Math.max(1,Number.parseInt(params.get('page') || '1',10)||1);
}
function remember(){
  const url=new URL(location.href);
  for(const [key,value] of [['q',query.value.trim()],['collection',collection.value],['year',year.value],['page',page>1 ? String(page) : '']]){
    if(value) url.searchParams.set(key,value);else url.searchParams.delete(key);
  }
  history.replaceState(null,'',url);
}
function node<K extends keyof HTMLElementTagNameMap>(tag:K,text?:string,className?:string){const el=document.createElement(tag);if(text)el.textContent=text;if(className)el.className=className;return el;}
function row(entry:ArchiveSearchEntry){
  const tr=node('tr'),name=node('td'),a=node('a',entry.name,'event-name');a.href=entry.page;
  name.append(a,node('span',entry.collectionLabel+(entry.place ? ` · ${entry.place}` : ''),'event-source'),node('span',`${displayArchiveDate(entry)} · ${entry.games.toLocaleString('en-US')} games`,'event-mobile-meta'));
  const date=node('td'),time=node('time',displayArchiveDate(entry));time.dateTime=displayArchiveDate(entry);date.append(time);
  const games=node('td',entry.games.toLocaleString('en-US'),'game-count');
  const download=node('td'),link=node('a','↓ ZIP','download-link');link.href=entry.url;link.title=`SHA-256: ${entry.sha256}`;link.setAttribute('aria-label',`Download ${entry.name} ZIP`);download.append(link);
  tr.append(name,date,games,download);return tr;
}
async function render(reset=false){
  const ticket=++generation;if(reset)page=1;
  try {
    const entries=await load();if(ticket!==generation)return;
    const filtered=filterArchives(entries,query.value,collection.value,year.value);
    const totalPages=Math.max(1,Math.ceil(filtered.length/size));page=Math.min(page,totalPages);
    const start=(page-1)*size,end=Math.min(start+size,filtered.length);
    results.replaceChildren(...filtered.slice(start,end).map(row));
    count.textContent=filtered.length ? `${filtered.length.toLocaleString('en-US')} matching entries · showing ${start+1}–${end}` : '0 matching entries';
    get('archive-empty').hidden=!!filtered.length;get('archive-pagination').hidden=filtered.length<=size;
    get('archive-page').textContent=`Page ${page} of ${totalPages.toLocaleString('en-US')}`;
    previous.disabled=page<=1;next.disabled=page>=totalPages;
    get('archive-clear').hidden=!query.value&&!collection.value&&!year.value;
    remember();
  } catch {if(ticket===generation)count.textContent='Search could not load. Recent downloads are still available. Change a filter to retry.';}
}
restore();query.disabled=collection.disabled=year.disabled=false;
let timer:ReturnType<typeof setTimeout>;
query.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>void render(true),180);});
for(const control of [collection,year])control.addEventListener('change',()=>void render(true));
previous.addEventListener('click',()=>{page--;void render();});next.addEventListener('click',()=>{page++;void render();});
get('archive-clear').addEventListener('click',()=>{query.value=collection.value=year.value='';void render(true);query.focus();});
window.addEventListener('popstate',()=>{restore();void render();});
void render();
