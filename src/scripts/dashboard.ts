export {};

// Forward shared URLs from the original overview search.
const params = new URLSearchParams(location.search);
if ((!location.hash || location.hash === '#games')
  && ['q', 'collection', 'year', 'page'].some(key => params.has(key))) {
  const collection = params.get('collection') ?? '';
  const series = ['titled-tuesday', 'bullet-brawl', 'three-zero-thursday', 'ccc'];
  const fragment = series.includes(collection) ? '#' + collection : '';
  params.delete('collection');
  const target = new URL(document.querySelector<HTMLFormElement>('#tournament-search')!.action);
  target.search = params.toString();
  target.hash = fragment;
  location.replace(target);
}

// Without JavaScript, the panels remain visible as in-page destinations.
const dashboard = document.querySelector<HTMLElement>('.dashboard');
const tabs = [...document.querySelectorAll<HTMLAnchorElement>('.dashboard-tabs a[data-tab]')];
const tabNames = new Set(tabs.map(tab => tab.dataset.tab));

function showTab(name:string){
  if(!dashboard||!tabNames.has(name)) name='games';
  if(dashboard) dashboard.dataset.tab=name;
  for(const tab of tabs){const active=tab.dataset.tab===name;tab.classList.toggle('active',active);if(active)tab.setAttribute('aria-current','true');else tab.removeAttribute('aria-current');}
}
const tabFromHash=()=>location.hash.slice(1);
for(const tab of tabs)tab.addEventListener('click',event=>{
  event.preventDefault();const name=tab.dataset.tab || 'games';
  if(tabFromHash()!==name) history.pushState(history.state,'',`${location.pathname}${location.search}#${name}`);
  showTab(name);
});
window.addEventListener('popstate',()=>showTab(tabFromHash()));
showTab(tabFromHash());
if(tabNames.has(tabFromHash())) requestAnimationFrame(()=>window.scrollTo(0,0));
