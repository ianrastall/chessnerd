const form = document.querySelector<HTMLFormElement>('#tournament-controls')!;
const query = document.querySelector<HTMLInputElement>('#tournament-query')!;
const year = document.querySelector<HTMLSelectElement>('#tournament-year')!;
const sort = document.querySelector<HTMLSelectElement>('#tournament-sort')!;
const body = document.querySelector<HTMLTableSectionElement>('#tournament-results')!;
const rows = [...body.rows];
const count = document.querySelector<HTMLElement>('#tournament-count')!;
const clear = document.querySelector<HTMLButtonElement>('#tournament-clear')!;
const previous = document.querySelector<HTMLButtonElement>('#tournament-previous')!;
const next = document.querySelector<HTMLButtonElement>('#tournament-next')!;
const pagination = document.querySelector<HTMLElement>('#tournament-pagination')!;
const pageLabel = document.querySelector<HTMLElement>('#tournament-page')!;
const empty = document.querySelector<HTMLElement>('#tournament-empty')!;
const pageSize = 30;
let currentPage = 1;
let currentSort = '';

function render() {
  const words = query.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const matching = new Set(rows.filter(row => (!year.value || row.dataset.year === year.value)
    && words.every(word => row.dataset.search!.includes(word))));
  const ordered = sort.value
    ? [...rows].sort((a, b) => Number(b.dataset[sort.value]) - Number(a.dataset[sort.value]))
    : rows;
  if (sort.value !== currentSort) {
    body.append(...ordered);
    currentSort = sort.value;
  }

  const total = matching.size;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  currentPage = Math.min(currentPage, pages);
  const start = (currentPage - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  let index = 0;
  for (const row of ordered) {
    row.hidden = !matching.has(row) || index < start || index >= end;
    if (matching.has(row)) index += 1;
  }
  count.textContent = total ? `${total.toLocaleString('en-US')} tournaments · Showing ${start + 1}–${end}` : '0 tournaments';
  pageLabel.textContent = `Page ${currentPage} of ${pages}`;
  pagination.hidden = pages <= 1;
  previous.disabled = currentPage === 1;
  next.disabled = currentPage === pages;
  empty.hidden = total > 0;
  clear.hidden = !query.value && !year.value && !sort.value;

  const url = new URL(location.href);
  for (const [key, value] of [['q', query.value.trim()], ['year', year.value], ['sort', sort.value], ['page', currentPage > 1 ? String(currentPage) : '']]) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  if (url.href !== location.href) history.replaceState(history.state, '', url);
}

function restore() {
  const params = new URLSearchParams(location.search);
  query.value = params.get('q') ?? '';
  year.value = params.get('year') ?? '';
  sort.value = params.get('sort') ?? '';
  currentPage = Math.max(1, Number.parseInt(params.get('page') ?? '', 10) || 1);
  render();
}

function resetPage() {
  currentPage = 1;
  render();
}

form.addEventListener('submit', event => event.preventDefault());
query.addEventListener('input', resetPage);
year.addEventListener('change', resetPage);
sort.addEventListener('change', resetPage);
previous.addEventListener('click', () => { currentPage -= 1; render(); });
next.addEventListener('click', () => { currentPage += 1; render(); });
clear.addEventListener('click', () => { form.reset(); resetPage(); query.focus(); });
window.addEventListener('popstate', restore);
restore();
form.hidden = false;
