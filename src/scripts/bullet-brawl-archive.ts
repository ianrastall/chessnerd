import { archivePage } from '../lib/ccc-archive';

const search = document.querySelector<HTMLInputElement>('#bbSearch')!;
const pageSize = document.querySelector<HTMLSelectElement>('#bbPageSize')!;
const previous = document.querySelector<HTMLButtonElement>('#bbPrevPage')!;
const next = document.querySelector<HTMLButtonElement>('#bbNextPage')!;
const status = document.querySelector<HTMLElement>('#bbStatus')!;
const pageInfo = document.querySelector<HTMLElement>('#bbPageInfo')!;
const empty = document.querySelector<HTMLTableRowElement>('#bbEmpty')!;
const rows = Array.from(document.querySelectorAll<HTMLTableRowElement>('[data-bb-entry]'));
let currentPage = 1;

function render() {
  const terms = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = rows.filter((row) => terms.every((term) => row.dataset.search!.includes(term)));
  const result = archivePage(matches, currentPage, Number(pageSize.value));
  currentPage = result.page;
  const visible = new Set(result.entries);
  for (const row of rows) row.hidden = !visible.has(row);
  empty.hidden = matches.length > 0;
  previous.disabled = currentPage === 1;
  next.disabled = currentPage === result.pages;
  pageInfo.textContent = `Page ${currentPage} of ${result.pages}`;
  status.textContent = matches.length
    ? `Showing ${result.start + 1}–${result.start + result.entries.length} of ${matches.length.toLocaleString('en-US')} events${terms.length ? ` (${rows.length.toLocaleString('en-US')} total)` : ''}, newest first`
    : `No matching events (${rows.length.toLocaleString('en-US')} total)`;
}

search.addEventListener('input', () => { currentPage = 1; render(); });
pageSize.addEventListener('change', () => { currentPage = 1; render(); });
previous.addEventListener('click', () => { currentPage -= 1; render(); });
next.addEventListener('click', () => { currentPage += 1; render(); });
render();
document.querySelector<HTMLElement>('#bbControls')!.hidden = false;
document.querySelector<HTMLElement>('#bbPagination')!.hidden = false;
