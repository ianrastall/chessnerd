import { archivePage } from '../lib/ccc-archive';

const search = document.querySelector<HTMLInputElement>('#taSearch')!;
const pageSize = document.querySelector<HTMLSelectElement>('#taPageSize')!;
const previous = document.querySelector<HTMLButtonElement>('#taPrevPage')!;
const next = document.querySelector<HTMLButtonElement>('#taNextPage')!;
const status = document.querySelector<HTMLElement>('#taStatus')!;
const pageInfo = document.querySelector<HTMLElement>('#taPageInfo')!;
const empty = document.querySelector<HTMLTableRowElement>('#taEmpty')!;
const rows = Array.from(document.querySelectorAll<HTMLTableRowElement>('[data-ta-entry]'));
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
    ? `Showing ${result.start + 1}–${result.start + result.entries.length} of ${matches.length.toLocaleString('en-US')} tournaments${terms.length ? ` (${rows.length.toLocaleString('en-US')} total)` : ''}, newest first`
    : `No matching tournaments (${rows.length.toLocaleString('en-US')} total)`;
}

search.addEventListener('input', () => {
  currentPage = 1;
  render();
});
pageSize.addEventListener('change', () => {
  currentPage = 1;
  render();
});
previous.addEventListener('click', () => {
  currentPage -= 1;
  render();
});
next.addEventListener('click', () => {
  currentPage += 1;
  render();
});
render();
document.querySelector<HTMLElement>('#taControls')!.hidden = false;
document.querySelector<HTMLElement>('#taPagination')!.hidden = false;
