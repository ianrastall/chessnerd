function initPgnDownloads() {
  const search = document.getElementById('fileSearch') as HTMLInputElement | null;
  const rows = Array.from(document.querySelectorAll<HTMLTableRowElement>('#fileList tr:not(.section-header)'));
  const sectionHeaders = Array.from(document.querySelectorAll<HTMLTableRowElement>('#fileList tr.section-header'));

  search?.addEventListener('input', () => {
    const filter = search.value.trim().toLowerCase();

    for (const row of rows) {
      const content = row.textContent?.toLowerCase() ?? '';
      row.hidden = filter.length > 0 && !content.includes(filter);
    }

    // Hide section headers if all their following rows are hidden
    for (const header of sectionHeaders) {
      let sibling = header.nextElementSibling as HTMLTableRowElement | null;
      let allHidden = true;
      while (sibling && !sibling.classList.contains('section-header')) {
        if (!sibling.hidden) {
          allHidden = false;
          break;
        }
        sibling = sibling.nextElementSibling as HTMLTableRowElement | null;
      }
      header.hidden = allHidden;
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPgnDownloads, { once: true });
} else {
  initPgnDownloads();
}
