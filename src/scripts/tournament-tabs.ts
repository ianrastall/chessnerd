export {};

const navigation = document.querySelector<HTMLElement>('.tournament-tabs')!;
const archive = navigation.closest<HTMLElement>('.tournament-archive')!;
const tabs = [...navigation.querySelectorAll<HTMLAnchorElement>('a')];
const panels = tabs.map(tab => document.getElementById(tab.hash.slice(1))!);

function showTab() {
  const active = tabs.find(tab => tab.hash === location.hash) ?? tabs[0];
  tabs.forEach((tab, index) => {
    const selected = tab === active;
    tab.setAttribute('aria-selected', String(selected));
    tab.classList.toggle('active', selected);
    tab.tabIndex = selected ? 0 : -1;
    panels[index].hidden = !selected;
  });
}

function selectTab(tab: HTMLAnchorElement) {
  if (tab.hash !== location.hash) {
    const url = new URL(location.href);
    url.hash = tab.hash;
    history.pushState(history.state, '', url);
  }
  showTab();
}

navigation.setAttribute('role', 'tablist');
tabs.forEach((tab, index) => {
  const panel = panels[index];
  tab.setAttribute('role', 'tab');
  tab.setAttribute('aria-controls', panel.id);
  panel.setAttribute('role', 'tabpanel');
  tab.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    selectTab(tab);
  });
  tab.addEventListener('keydown', event => {
    const last = tabs.length - 1;
    let target: number;
    switch (event.key) {
      case 'ArrowLeft': target = index === 0 ? last : index - 1; break;
      case 'ArrowRight': target = index === last ? 0 : index + 1; break;
      case 'Home': target = 0; break;
      case 'End': target = last; break;
      case ' ': target = index; break;
      default: return;
    }
    event.preventDefault();
    selectTab(tabs[target]);
    tabs[target].focus();
  });
});

window.addEventListener('hashchange', showTab);
window.addEventListener('popstate', showTab);
showTab();
archive.dataset.tabsReady = '';
