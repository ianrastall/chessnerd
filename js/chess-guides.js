// Chess Guides loader and renderer
(function() {
    'use strict';

    const guideSelect = document.getElementById('guideSelect');
    const chapterSelect = document.getElementById('chapterSelect');
    const guideContent = document.getElementById('guideContent');
    const statusMessage = document.getElementById('statusMessage');
    const toolStats = document.getElementById('toolStats');
    const guideTitle = document.getElementById('guideTitle');
    const guideTagline = document.getElementById('guideTagline');
    const chapterCount = document.getElementById('chapterCount');
    const openRawBtn = document.getElementById('openRaw');
    const copyLinkBtn = document.getElementById('copyLink');

    const guideMetaBox = document.getElementById('guideMeta');

    let guides = [];
    let activeGuide = null;
    let activeChapterId = null;
    let currentFilePath = '';

    document.getElementById('backButton')?.addEventListener('click', () => {
        window.location.href = 'index.html';
    });

    function setStatus(message, type = 'success') {
        if (!statusMessage) return;
        statusMessage.textContent = message;
        statusMessage.className = type;
    }

    function slugify(text) {
        return text
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');
    }

    function updateUrl() {
        if (!activeGuide || !activeChapterId) return;
        const params = new URLSearchParams(window.location.search);
        params.set('guide', activeGuide.id);
        params.set('chapter', activeChapterId);
        const newUrl = `${window.location.pathname}?${params.toString()}`;
        window.history.replaceState({}, '', newUrl);
    }

    function updateActions(filePath) {
        const hasGuide = Boolean(activeGuide);
        openRawBtn.disabled = !hasGuide;
        copyLinkBtn.disabled = !hasGuide;
        currentFilePath = filePath;

        if (!hasGuide) {
            openRawBtn.onclick = null;
            copyLinkBtn.onclick = null;
            return;
        }

        openRawBtn.onclick = () => window.open(filePath, '_blank', 'noopener');
        copyLinkBtn.onclick = async () => {
            try {
                await navigator.clipboard.writeText(window.location.href);
                setStatus('Link copied to clipboard', 'success');
            } catch (err) {
                setStatus('Clipboard not available', 'warning');
            }
        };
    }

    function decorateHeadings() {
        if (!guideContent) return;
        const headings = guideContent.querySelectorAll('h1, h2, h3');
        headings.forEach((h) => {
            if (!h.id) {
                h.id = slugify(h.textContent || '');
            }
            if (h.querySelector('.heading-anchor')) return;
            const anchor = document.createElement('a');
            anchor.href = `#${h.id}`;
            anchor.className = 'heading-anchor';
            anchor.innerHTML = '<span class="material-icons">link</span>';
            h.appendChild(anchor);
        });
    }

    function buildChapterDropdown() {
        const headings = Array.from(guideContent.querySelectorAll('h1'));
        chapterSelect.innerHTML = '';

        if (!headings.length) {
            chapterSelect.disabled = true;
            return;
        }

        const getHeadingText = (heading) => {
            const clone = heading.cloneNode(true);
            const anchor = clone.querySelector('.heading-anchor');
            if (anchor) anchor.remove();
            return (clone.textContent || '').trim();
        };

        headings.forEach((h, idx) => {
            const label = getHeadingText(h) || `Chapter ${idx + 1}`;
            if (!h.id) h.id = slugify(label || `chapter-${idx + 1}`);
            const opt = document.createElement('option');
            opt.value = h.id;
            opt.textContent = label;
            chapterSelect.appendChild(opt);
        });

        chapterSelect.disabled = false;
    }

    function scrollToChapter(chapterId, smooth = true) {
        if (!chapterId) return;
        const target = guideContent.querySelector(`#${CSS.escape(chapterId)}`);
        if (!target) return;
        activeChapterId = chapterId;
        chapterSelect.value = chapterId;
        const behavior = smooth ? 'smooth' : 'auto';
        target.scrollIntoView({ behavior, block: 'start' });
        updateUrl();
    }

    async function loadChapter(chapter) {
        if (!chapter || !chapter.file) return;
        setStatus('Loading chapter...', 'warning');
        guideContent.innerHTML = '<p class="placeholder">Loading...</p>';

        try {
            const response = await fetch(chapter.file);
            if (!response.ok) {
                throw new Error(`Unable to load chapter file (${chapter.file})`);
            }
            const markdown = await response.text();
            if (!window.marked) throw new Error('Markdown renderer failed to load.');
            const html = window.marked.parse(markdown, { mangle: false, headerIds: true });
            guideContent.innerHTML = html;
            decorateHeadings();
            buildChapterDropdown();

            const params = new URLSearchParams(window.location.search);
            const initialChapterId = params.get('chapter') || chapterSelect.options[0]?.value;
            if (initialChapterId) {
                scrollToChapter(initialChapterId, false);
            }

            updateActions(chapter.file);
            setStatus('Loaded', 'success');
        } catch (error) {
            guideContent.innerHTML = `<p class="error-text">${error.message}</p>`;
            setStatus(error.message, 'error');
            updateActions('');
        }
    }

    function renderMeta() {
        if (!activeGuide) return;
        guideTitle.textContent = activeGuide.title;
        guideTagline.textContent = activeGuide.tagline || 'Guide description';
        chapterCount.textContent = `${activeGuide.chapters?.length || 0} available`;

        if (toolStats) {
            const totalChapters = guides.reduce((acc, g) => acc + (g.chapters?.length || 0), 0);
            toolStats.textContent = `${guides.length} guide${guides.length === 1 ? '' : 's'}, ${totalChapters} chapter${totalChapters === 1 ? '' : 's'}`;
        }

        guideMetaBox?.classList.remove('hidden');
    }

    function populateChapterSelect(guide) {
        chapterSelect.innerHTML = '';
        if (!guide || !guide.chapters || guide.chapters.length === 0) {
            chapterSelect.disabled = true;
            return;
        }

        // For single-file guides, the dropdown is rebuilt from headings after load.
        guide.chapters.forEach((chapter) => {
            const option = document.createElement('option');
            option.value = chapter.id;
            option.textContent = chapter.title;
            chapterSelect.appendChild(option);
        });
    }

    function selectGuide(guideId) {
        const fallback = guides[0];
        const guide = guides.find((g) => g.id === guideId) || fallback;
        if (!guide) return;

        activeGuide = guide;
        guideSelect.value = guide.id;
        populateChapterSelect(guide);
        const params = new URLSearchParams(window.location.search);
        const initialChapter = params.get('chapter') || guide.chapters?.[0]?.id;
        const fallbackChapter = guide.chapters?.[0];
        renderMeta();
        updateUrl();
        loadChapter(
            guide.chapters.find((c) => c.id === initialChapter) || fallbackChapter
        );
    }

    function populateGuideSelect() {
        guideSelect.innerHTML = '';
        guides.forEach((guide) => {
            const option = document.createElement('option');
            option.value = guide.id;
            option.textContent = guide.title;
            guideSelect.appendChild(option);
        });
        guideSelect.disabled = guides.length === 0;
    }

    async function loadGuideIndex() {
        setStatus('Loading guide index...', 'warning');
        try {
            const response = await fetch('data/chess-guides.json');
            if (!response.ok) throw new Error('Guide index not found (data/chess-guides.json)');
            const data = await response.json();
            guides = data.guides || [];
            if (guides.length === 0) throw new Error('No guides are listed yet.');
            populateGuideSelect();

            const params = new URLSearchParams(window.location.search);
            selectGuide(params.get('guide') || guides[0].id);
            setStatus('Ready', 'success');
        } catch (error) {
            setStatus(error.message, 'error');
            guideContent.innerHTML = `<p class="error-text">${error.message}</p>`;
            openRawBtn.disabled = true;
            copyLinkBtn.disabled = true;
        }
    }

    function setupEvents() {
        guideSelect.addEventListener('change', (e) => {
            selectGuide(e.target.value);
        });

        chapterSelect.addEventListener('change', (e) => {
            scrollToChapter(e.target.value);
        });
    }

    function init() {
        if (!guideSelect || !chapterSelect || !guideContent) return;
        setupEvents();
        loadGuideIndex();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
