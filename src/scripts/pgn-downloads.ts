function initPgnDownloads() {
  const search = document.getElementById('fileSearch') as HTMLInputElement | null;
  const rows = Array.from(document.querySelectorAll<HTMLTableRowElement>('.fileList tr'));
  const sections = Array.from(document.querySelectorAll<HTMLElement>('.dl-section'));

  search?.addEventListener('input', () => {
    const filter = search.value.trim().toLowerCase();

    for (const row of rows) {
      const content = `${row.dataset.file ?? ''} ${row.textContent ?? ''}`.toLowerCase();
      row.hidden = filter.length > 0 && !content.includes(filter);
    }

    // Hide entire section if all its rows are hidden
    for (const section of sections) {
      const sectionRows = Array.from(section.querySelectorAll<HTMLTableRowElement>('.fileList tr'));
      const allHidden = sectionRows.length > 0 && sectionRows.every(r => r.hidden);
      section.hidden = allHidden;
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPgnDownloads, { once: true });
} else {
  initPgnDownloads();
}
