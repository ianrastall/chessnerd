const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>('.cct-tab'));
const panels = new Map(
  Array.from(document.querySelectorAll<HTMLElement>('.cct-panel')).map((panel) => [panel.dataset.panel!, panel])
);
const keys = tabs.map((tab) => tab.dataset.tab!);

function activate(key: string, focus = false) {
  if (!panels.has(key)) key = keys[0];
  for (const tab of tabs) {
    const selected = tab.dataset.tab === key;
    tab.setAttribute('aria-selected', selected ? 'true' : 'false');
    tab.tabIndex = selected ? 0 : -1;
    if (selected && focus) tab.focus();
  }
  for (const [panelKey, panel] of panels) panel.hidden = panelKey !== key;
  if (history.replaceState) history.replaceState(null, '', `#${key}`);
  else location.hash = key;
}

for (const tab of tabs) {
  tab.addEventListener('click', () => activate(tab.dataset.tab!));
  tab.addEventListener('keydown', (event) => {
    const index = keys.indexOf(tab.dataset.tab!);
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const delta = event.key === 'ArrowRight' ? 1 : -1;
      activate(keys[(index + delta + keys.length) % keys.length], true);
    } else if (event.key === 'Home') {
      event.preventDefault();
      activate(keys[0], true);
    } else if (event.key === 'End') {
      event.preventDefault();
      activate(keys[keys.length - 1], true);
    }
  });
}

const initial = location.hash.replace(/^#/, '');
activate(keys.includes(initial) ? initial : keys[0]);
