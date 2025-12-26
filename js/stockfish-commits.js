/* Stockfish Commits page
   Expects:
   - data/stockfish-commits/index.json
   - data/stockfish-commits/YYYY-MM.json (or /YYYY/MM.json if you adapt monthUrl())
*/

(() => {
  'use strict';

  const INDEX_URL = 'data/stockfish-commits/index.json';
  const monthUrl = (yyyyMm) => `data/stockfish-commits/${yyyyMm}.json`;

  // --- DOM ---
  const yearSelect = document.getElementById('yearSelect');
  const monthSelect = document.getElementById('monthSelect');
  const searchBox = document.getElementById('searchBox');
  const showAbrok = document.getElementById('showAbrok');
  const showArtifacts = document.getElementById('showArtifacts');
  const pageSizeSel = document.getElementById('pageSize');

  const mainStats = document.getElementById('mainStats');
  const datasetMeta = document.getElementById('datasetMeta');

  const calendarHost = document.getElementById('calendar');
  const clearDayFilterBtn = document.getElementById('clearDayFilter');

  const commitList = document.getElementById('commitList');

  const firstPageBtn = document.getElementById('firstPage');
  const prevPageBtn = document.getElementById('prevPage');
  const nextPageBtn = document.getElementById('nextPage');
  const lastPageBtn = document.getElementById('lastPage');
  const pageInfo = document.getElementById('pageInfo');

  const copyPageLinksBtn = document.getElementById('copyPageLinks');

  // tool-template behavior (same as your template) — keeps navigation consistent
  document.getElementById('backButton').addEventListener('click', () => {
    window.location.href = 'index.html';
  });

  const statusMessage = document.getElementById('statusMessage');
  function setStatus(msg, type = 'success') {
    statusMessage.textContent = msg;
    statusMessage.className = type;
  }

  // --- State ---
  let indexData = null;
  let currentMonth = null;

  let monthCommits = [];       // full month
  let filteredCommits = [];    // after search + toggles + day filter

  let selectedDay = null;      // 'YYYY-MM-DD'
  let page = 1;

  function setMainStats(text) {
    mainStats.textContent = text;
  }

  function toLocalDateTime(iso) {
    // Keep it simple, readable, stable.
    // If you prefer exact UTC, swap to iso directly.
    try {
      const d = new Date(iso);
      return d.toISOString().replace('T', ' ').replace('Z', 'Z');
    } catch {
      return iso;
    }
  }

  function safeText(v) {
    return (v ?? '').toString();
  }

  function normalizeMonthPayload(payload) {
    // Accept either:
    //  - { month: 'YYYY-MM', commits: [...] }
    //  - [ ... ]
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.commits)) return payload.commits;
    return [];
  }

  function commitHasAbrok(c) {
    return !!(c?.downloads?.abrok_eu?.length);
  }

  function commitHasArtifacts(c) {
    return !!(c?.downloads?.github_actions_artifacts?.length);
  }

  function uniq(arr) {
    return Array.from(new Set(arr.filter(Boolean)));
  }

  function extractPullNumber(message) {
    // Typical line: "closes https://github.com/official-stockfish/Stockfish/pull/6488"
    const m = (message || '').match(/\/pull\/(\d+)\b/);
    return m ? m[1] : '';
  }

  function extractBench(message) {
    // "Bench: 2325401" or "bench 2717363"
    const m = (message || '').match(/^\s*Bench:\s*(\d+)\s*$/im) || (message || '').match(/^\s*bench\s+(\d+)\s*$/im);
    return m ? m[1] : '';
  }

  function extractTestLinks(message) {
    // Pull all tests.stockfishchess.org URLs and attempt a label from their line context.
    const lines = (message || '').split('\n');
    const out = [];

    for (const line of lines) {
      const urls = line.match(/https:\/\/tests\.stockfishchess\.org\/\S+/g) || [];
      for (const url of urls) {
        let label = 'Test';
        if (/STC/i.test(line)) label = 'STC';
        else if (/LTC/i.test(line)) label = 'LTC';
        else if (/Non-Regression/i.test(line)) label = 'Non-regression';
        else if (/live_elo/i.test(url)) label = 'Live ELO';
        else if (/tests\/view/i.test(url)) label = 'Test view';

        out.push({ label, url });
      }
    }

    // De-dup by URL
    const seen = new Set();
    return out.filter(x => {
      if (seen.has(x.url)) return false;
      seen.add(x.url);
      return true;
    });
  }

  function linkRow(label, url, onCopy) {
    const row = document.createElement('div');
    row.className = 'sf-linkrow';

    const head = document.createElement('div');
    head.className = 'sf-linkrow-head';

    const lab = document.createElement('div');
    lab.className = 'sf-linkrow-label';
    lab.textContent = label;

    const actions = document.createElement('div');
    actions.className = 'sf-linkrow-actions';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn btn-secondary';
    copyBtn.type = 'button';
    copyBtn.innerHTML = '<span class="material-icons">content_copy</span>';
    copyBtn.title = 'Copy URL';
    copyBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      onCopy(url);
    });

    actions.appendChild(copyBtn);

    head.appendChild(lab);
    head.appendChild(actions);

    const a = document.createElement('a');
    a.className = 'sf-url';
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = url;

    row.appendChild(head);
    row.appendChild(a);
    return row;
  }

  function applyFilters() {
    const q = searchBox.value.trim().toLowerCase();
    const wantAbrok = showAbrok.checked;
    const wantArtifacts = showArtifacts.checked;

    filteredCommits = monthCommits.filter(c => {
      // Link-set filters (if a commit has only artifacts and artifacts are off, hide it; etc.)
      const hasA = commitHasAbrok(c);
      const hasG = commitHasArtifacts(c);

      if (!wantAbrok && hasA && !hasG) return false;
      if (!wantArtifacts && hasG && !hasA) return false;
      if (!wantAbrok && !wantArtifacts && (hasA || hasG)) return false; // user disabled both

      if (selectedDay) {
        const d = safeText(c.date).slice(0, 10);
        if (d !== selectedDay) return false;
      }

      if (!q) return true;

      const hay = [
        safeText(c.hash),
        safeText(c.short),
        safeText(c.author),
        safeText(c.subject),
        safeText(c.message),
        safeText(c.github_url)
      ].join('\n').toLowerCase();

      return hay.includes(q);
    });

    page = 1;
    renderAll();
  }

  function getPageSize() {
    const n = parseInt(pageSizeSel.value, 10);
    return Number.isFinite(n) && n > 0 ? n : 20;
  }

  function getPagedCommits() {
    const size = getPageSize();
    const total = filteredCommits.length;
    const totalPages = Math.max(1, Math.ceil(total / size));
    page = Math.min(Math.max(1, page), totalPages);

    const start = (page - 1) * size;
    const end = start + size;

    return { items: filteredCommits.slice(start, end), total, totalPages, start, end: Math.min(end, total) };
  }

  function clearNode(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function el(tag, attrs = {}, children = []) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
    for (const c of children) n.appendChild(c);
    return n;
  }

  function anchorForCommit(c) {
    const short = safeText(c.short) || safeText(c.hash).slice(0, 8);
    return short || 'commit';
  }

  function collectUrlsFromCommit(c) {
    const urls = [];

    if (c.github_url) urls.push(c.github_url);

    for (const sc of (c.source_code || [])) {
      if (sc?.url) urls.push(sc.url);
    }

    if (showAbrok.checked) {
      for (const d of (c?.downloads?.abrok_eu || [])) {
        if (d?.url) urls.push(d.url);
      }
    }

    if (showArtifacts.checked) {
      for (const d of (c?.downloads?.github_actions_artifacts || [])) {
        if (d?.url) urls.push(d.url);
      }
    }

    return urls;
  }

  async function copyTextToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Copied to clipboard.', 'success');
    } catch (e) {
      console.error(e);
      setStatus('Clipboard copy failed (browser permissions?).', 'error');
    }
  }

  function renderCalendar() {
    clearNode(calendarHost);

    if (!monthCommits.length || !currentMonth) return;

    const [yy, mm] = currentMonth.split('-').map(x => parseInt(x, 10));
    if (!yy || !mm) return;

    // Count commits per day
    const counts = new Map();
    for (const c of monthCommits) {
      const day = safeText(c.date).slice(0, 10);
      if (day.startsWith(currentMonth)) {
        counts.set(day, (counts.get(day) || 0) + 1);
      }
    }

    const first = new Date(Date.UTC(yy, mm - 1, 1));
    const last = new Date(Date.UTC(yy, mm, 0));
    const daysInMonth = last.getUTCDate();

    const dowNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const header = el('div', { class: 'sf-calendar-header' }, [
      el('div', { text: `${currentMonth} (click a day to filter)` }),
      el('div', { class: 'sf-muted', text: selectedDay ? `Day filter: ${selectedDay}` : 'No day filter' })
    ]);

    const grid = el('div', { class: 'sf-calendar-grid' });

    // DOW row
    for (const n of dowNames) grid.appendChild(el('div', { class: 'sf-cal-dow', text: n }));

    // Leading blanks
    const startDow = first.getUTCDay(); // 0..6
    for (let i = 0; i < startDow; i++) {
      grid.appendChild(el('div', { class: 'sf-cal-cell is-empty', text: '' }));
    }

    // Days
    for (let d = 1; d <= daysInMonth; d++) {
      const dayStr = `${currentMonth}-${String(d).padStart(2, '0')}`;
      const cnt = counts.get(dayStr) || 0;

      const cell = el('div', { class: `sf-cal-cell ${selectedDay === dayStr ? 'is-selected' : ''}` });
      const btn = el('button', {}, [
        el('div', { text: String(d) }),
        el('div', { class: 'sf-cal-count', text: cnt ? `${cnt} commits` : '' })
      ]);

      if (cnt) {
        btn.addEventListener('click', () => {
          selectedDay = (selectedDay === dayStr) ? null : dayStr;
          clearDayFilterBtn.style.display = selectedDay ? '' : 'none';
          applyFilters();
        });
      } else {
        cell.classList.add('is-empty');
      }

      cell.appendChild(btn);
      grid.appendChild(cell);
    }

    const wrap = el('div', { class: 'sf-calendar' }, [header, grid]);
    calendarHost.appendChild(wrap);
  }

  function renderCommit(c) {
    const short = safeText(c.short) || safeText(c.hash).slice(0, 8);
    const dateStr = toLocalDateTime(c.date);
    const pr = extractPullNumber(c.message);
    const bench = extractBench(c.message);
    const tests = extractTestLinks(c.message);

    const hasAbrok = commitHasAbrok(c);
    const hasArtifacts = commitHasArtifacts(c);
    const srcCount = (c.source_code || []).length;
    const abrokCount = (c?.downloads?.abrok_eu || []).length;
    const artCount = (c?.downloads?.github_actions_artifacts || []).length;

    const details = el('details', { class: 'sf-commit', id: anchorForCommit(c) });

    // ----- SUMMARY (clickable) -----
    const summary = document.createElement('summary');

    const top = document.createElement('div');
    top.className = 'sf-summary-top';

    const title = document.createElement('div');
    title.className = 'sf-summary-title';
    title.textContent = safeText(c.subject || '(no subject)');

    const pills = document.createElement('div');
    pills.className = 'sf-pills';

    // Useful counts visible in the clickable area
    if (srcCount) pills.appendChild(el('span', { class: 'sf-pill', text: `Source: ${srcCount}` }));
    if (hasAbrok) pills.appendChild(el('span', { class: 'sf-pill', text: `ABROK: ${abrokCount}` }));
    if (hasArtifacts) pills.appendChild(el('span', { class: 'sf-pill warn', text: `Artifacts: ${artCount}` }));
    if (pr) pills.appendChild(el('span', { class: 'sf-pill', text: `PR: #${pr}` }));
    if (bench) pills.appendChild(el('span', { class: 'sf-pill', text: `Bench: ${bench}` }));

    top.appendChild(title);
    top.appendChild(pills);

    const meta = document.createElement('div');
    meta.className = 'sf-summary-meta';
    meta.appendChild(el('span', { class: 'sf-date', text: dateStr }));
    meta.appendChild(el('span', { class: 'sf-hash', text: short }));
    if (c.author) meta.appendChild(el('span', { class: 'sf-author', text: safeText(c.author) }));

    const keyLinks = document.createElement('div');
    keyLinks.className = 'sf-summary-links';

    // Key links in the clickable header (so you do not have to expand everything)
    if (c.github_url) {
      const a = document.createElement('a');
      a.className = 'sf-linkchip';
      a.href = c.github_url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.innerHTML = '<span class="material-icons">open_in_new</span>GitHub';
      keyLinks.appendChild(a);
    }

    // Show ZIP/TAR (if present) as chips in summary
    const srcZip = (c.source_code || []).find(x => (x.label || '').toUpperCase() === 'ZIP');
    const srcTar = (c.source_code || []).find(x => (x.label || '').toUpperCase().includes('TAR'));

    if (srcZip?.url) {
      const a = document.createElement('a');
      a.className = 'sf-linkchip';
      a.href = srcZip.url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.innerHTML = '<span class="material-icons">folder_zip</span>ZIP';
      keyLinks.appendChild(a);
    }
    if (srcTar?.url) {
      const a = document.createElement('a');
      a.className = 'sf-linkchip';
      a.href = srcTar.url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.innerHTML = '<span class="material-icons">folder_zip</span>TAR.GZ';
      keyLinks.appendChild(a);
    }

    // Show up to 2 test links in summary (STC/LTC most useful)
    const stc = tests.find(t => t.label === 'STC');
    const ltc = tests.find(t => t.label === 'LTC');
    const extraTests = tests.filter(t => t !== stc && t !== ltc);

    for (const t of [stc, ltc].filter(Boolean)) {
      const a = document.createElement('a');
      a.className = 'sf-linkchip';
      a.href = t.url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.innerHTML = `<span class="material-icons">science</span>${t.label}`;
      keyLinks.appendChild(a);
    }
    if (!stc && extraTests[0]) {
      const a = document.createElement('a');
      a.className = 'sf-linkchip';
      a.href = extraTests[0].url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.innerHTML = '<span class="material-icons">science</span>Test';
      keyLinks.appendChild(a);
    }

    summary.appendChild(top);
    summary.appendChild(meta);
    summary.appendChild(keyLinks);

    // ----- BODY (expanded) -----
    const body = el('div', { class: 'sf-body' });

    // Explicit link lists
    const linkList = document.createElement('div');
    linkList.className = 'sf-linklist';

    const copyUrl = async (url) => {
      await copyTextToClipboard(url);
    };

    // Section: Commit + Source
    body.appendChild(el('div', { class: 'sf-section-title', text: 'Primary links' }));
    linkList.appendChild(linkRow('GitHub commit', c.github_url, copyUrl));

    for (const sc of (c.source_code || [])) {
      if (!sc?.url) continue;
      linkList.appendChild(linkRow(`Source code: ${sc.label || sc.type || 'archive'}`, sc.url, copyUrl));
    }
    body.appendChild(linkList);

    // Section: ABROK
    if (showAbrok.checked && hasAbrok) {
      body.appendChild(el('div', { class: 'sf-section-title', text: `ABROK builds (${abrokCount})` }));
      const note = el('div', { class: 'sf-section-note', text: 'Direct binaries hosted externally; URLs shown explicitly.' });
      body.appendChild(note);

      const abrokList = document.createElement('div');
      abrokList.className = 'sf-linklist';
      for (const d of (c.downloads.abrok_eu || [])) {
        if (!d?.url) continue;
        abrokList.appendChild(linkRow(d.label || 'ABROK build', d.url, copyUrl));
      }
      body.appendChild(abrokList);
    }

    // Section: Artifacts
    if (showArtifacts.checked && hasArtifacts) {
      body.appendChild(el('div', { class: 'sf-section-title', text: `GitHub Actions artifacts (${artCount})` }));
      const note = el('div', {
        class: 'sf-section-note',
        text: 'These often expire due to retention policies and may require GitHub authentication.'
      });
      body.appendChild(note);

      const artList = document.createElement('div');
      artList.className = 'sf-linklist';
      for (const d of (c.downloads.github_actions_artifacts || [])) {
        if (!d?.url) continue;
        const label = d.bytes ? `${d.label} (${d.bytes} bytes)` : (d.label || 'Artifact');
        artList.appendChild(linkRow(label, d.url, copyUrl));
      }
      body.appendChild(artList);
    }

    // Message last (still useful for context)
    if (c.message) {
      body.appendChild(el('div', { class: 'sf-section-title', text: 'Commit message' }));
      body.appendChild(el('div', { class: 'sf-message', text: safeText(c.message || '') }));
    }

    details.appendChild(summary);
    details.appendChild(body);

    return details;
  }

  function renderCommitList() {
    clearNode(commitList);

    const { items, total, totalPages, start, end } = getPagedCommits();

    setMainStats(`${total} matches`);
    pageInfo.textContent = `Page ${page} / ${totalPages} — showing ${start + 1}-${end} of ${total}`;

    for (const c of items) commitList.appendChild(renderCommit(c));

    // Buttons
    firstPageBtn.disabled = (page <= 1);
    prevPageBtn.disabled = (page <= 1);
    nextPageBtn.disabled = (page >= totalPages);
    lastPageBtn.disabled = (page >= totalPages);

    // Hash deep-link support (#c475024b)
    const hash = window.location.hash?.replace('#', '');
    if (hash) {
      const target = document.getElementById(hash);
      if (target) {
        target.open = true;
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  function renderAll() {
    renderCalendar();
    renderCommitList();

    const total = filteredCommits.length;
    const monthTotal = monthCommits.length;
    const dayLabel = selectedDay ? ` | day=${selectedDay}` : '';
    document.getElementById('toolStats').textContent = `Month: ${monthTotal} commits | Filtered: ${total}${dayLabel}`;
  }

  function populateYearMonth(index) {
    // index.months = ['2025-12','2025-11', ...]
    const months = Array.isArray(index.months) ? index.months : [];
    const years = Array.from(new Set(months.map(m => m.slice(0, 4)))).sort((a, b) => b.localeCompare(a));

    clearNode(yearSelect);
    for (const y of years) yearSelect.appendChild(el('option', { value: y, text: y }));

    function refreshMonths() {
      const y = yearSelect.value;
      const ms = months.filter(m => m.startsWith(y + '-'));

      clearNode(monthSelect);
      for (const m of ms) {
        const cnt = index.month_counts && index.month_counts[m] ? ` (${index.month_counts[m]})` : '';
        monthSelect.appendChild(el('option', { value: m, text: m + cnt }));
      }
    }

    yearSelect.addEventListener('change', async () => {
      refreshMonths();
      await loadMonth(monthSelect.value);
    });

    refreshMonths();
  }

  async function loadIndex() {
    setStatus('Loading index…', 'success');
    setMainStats('Loading…');

    const res = await fetch(INDEX_URL, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Index fetch failed: ${res.status}`);
    const data = await res.json();

    indexData = data;

    populateYearMonth(data);

    datasetMeta.textContent = data.generated
      ? `Generated: ${safeText(data.generated)} | Commits: ${safeText(data.total_commits ?? '')} | Binaries: ${safeText(data.total_binaries ?? '')} | Artifacts: ${safeText(data.total_artifacts ?? '')}`
      : 'Dataset loaded.';

    // Auto-load newest month
    const months = Array.isArray(data.months) ? data.months : [];
    const newest = months[0] || monthSelect.value;
    if (newest) {
      // Set year/month selects to newest
      yearSelect.value = newest.slice(0, 4);
      yearSelect.dispatchEvent(new Event('change'));
      monthSelect.value = newest;
      await loadMonth(newest);
    } else {
      setStatus('Index loaded, but no months found.', 'error');
      setMainStats('No data');
    }
  }

  async function loadMonth(yyyyMm) {
    if (!yyyyMm) return;

    currentMonth = yyyyMm;
    selectedDay = null;
    clearDayFilterBtn.style.display = 'none';

    setStatus(`Loading ${yyyyMm}…`, 'success');
    setMainStats('Loading…');

    const url = monthUrl(yyyyMm);
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Month fetch failed (${yyyyMm}): ${res.status}`);

    const payload = await res.json();
    monthCommits = normalizeMonthPayload(payload);

    // Ensure newest-first (your sample is newest-first already)
    monthCommits.sort((a, b) => safeText(b.date).localeCompare(safeText(a.date)));

    applyFilters();
    setStatus(`Loaded ${yyyyMm}.`, 'success');
  }

  // --- Events ---
  monthSelect.addEventListener('change', async () => {
    try {
      await loadMonth(monthSelect.value);
    } catch (e) {
      console.error(e);
      setStatus(safeText(e.message), 'error');
    }
  });

  searchBox.addEventListener('input', () => applyFilters());
  showAbrok.addEventListener('change', () => applyFilters());
  showArtifacts.addEventListener('change', () => applyFilters());
  pageSizeSel.addEventListener('change', () => applyFilters());

  clearDayFilterBtn.addEventListener('click', () => {
    selectedDay = null;
    clearDayFilterBtn.style.display = 'none';
    applyFilters();
  });

  firstPageBtn.addEventListener('click', () => { page = 1; renderAll(); });
  prevPageBtn.addEventListener('click', () => { page -= 1; renderAll(); });
  nextPageBtn.addEventListener('click', () => { page += 1; renderAll(); });
  lastPageBtn.addEventListener('click', () => {
    const size = getPageSize();
    const totalPages = Math.max(1, Math.ceil(filteredCommits.length / size));
    page = totalPages;
    renderAll();
  });

  copyPageLinksBtn.addEventListener('click', async () => {
    const { items } = getPagedCommits();
    const urls = [];
    for (const c of items) urls.push(...collectUrlsFromCommit(c));
    await copyTextToClipboard(Array.from(new Set(urls)).join('\n'));
  });

  // --- Init ---
  (async () => {
    try {
      await loadIndex();
    } catch (e) {
      console.error(e);
      setStatus(`Failed to load: ${safeText(e.message)}`, 'error');
      setMainStats('Error');
    }
  })();

})();
