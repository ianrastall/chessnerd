function initPgnDownloads() {
  const search = document.getElementById('fileSearch') as HTMLInputElement | null;
  const rows = Array.from(document.querySelectorAll<HTMLTableRowElement>('#fileList tr'));

  search?.addEventListener('input', () => {
    const filter = search.value.trim().toLowerCase();

    for (const row of rows) {
      const content = row.textContent?.toLowerCase() ?? '';
      row.hidden = filter.length > 0 && !content.includes(filter);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPgnDownloads, { once: true });
} else {
  initPgnDownloads();
}
