// Theme and accent color management
(function() {
    'use strict';

    const ACCENT_PALETTE = [
        { value: '#0d9488', label: 'Teal' },
        { value: '#3b82f6', label: 'Blue' },
        { value: '#8b5cf6', label: 'Purple' },
        { value: '#10b981', label: 'Emerald' },
        { value: '#f59e0b', label: 'Amber' },
        { value: '#ef4444', label: 'Red' },
        { value: '#ec4899', label: 'Soft Pink' },
        { value: '#fb7185', label: 'Coral' },
        { value: '#5f9ea0', label: 'Cadet Blue' },
        { value: '#6495ed', label: 'Cornflower' },
        { value: '#deb887', label: 'Burlywood' },
        { value: '#60a5fa', label: 'Cornflower Blue' },
        { value: '#7c3aed', label: 'Violet' }
    ];
    const DEFAULT_ACCENT = '#0d9488';

    const themeToggle = document.getElementById('themeToggle');
    const accentColor = document.getElementById('accentColor');

    function normalizeHexColor(color) {
        if (typeof color !== 'string') {
            return DEFAULT_ACCENT;
        }

        const candidate = color.trim();
        if (/^#[0-9a-fA-F]{6}$/.test(candidate)) {
            return candidate.toLowerCase();
        }

        return DEFAULT_ACCENT;
    }

    function adjustColor(color, amount) {
        const normalized = normalizeHexColor(color).slice(1);
        const parsed = parseInt(normalized, 16);

        if (Number.isNaN(parsed)) {
            return color;
        }

        let red = ((parsed >> 16) & 0xFF) + amount;
        let green = ((parsed >> 8) & 0xFF) + amount;
        let blue = (parsed & 0xFF) + amount;

        red = Math.min(Math.max(0, red), 255);
        green = Math.min(Math.max(0, green), 255);
        blue = Math.min(Math.max(0, blue), 255);

        return `#${((red << 16) | (green << 8) | blue).toString(16).padStart(6, '0')}`;
    }

    function applyAccent(color) {
        const normalized = normalizeHexColor(color);
        document.documentElement.style.setProperty('--accent', normalized);
        document.documentElement.style.setProperty('--accent-light', adjustColor(normalized, 20));
        return normalized;
    }

    function populateAccentDropdown(selectedColor) {
        if (!accentColor) {
            return;
        }

        accentColor.innerHTML = '';

        ACCENT_PALETTE.forEach(({ value, label }) => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            accentColor.appendChild(option);
        });

        const normalizedSelected = normalizeHexColor(selectedColor);
        const hasSavedColor = ACCENT_PALETTE.some(
            ({ value }) => value.toLowerCase() === normalizedSelected
        );

        if (!hasSavedColor) {
            const customOption = document.createElement('option');
            customOption.value = normalizedSelected;
            customOption.textContent = 'Custom';
            accentColor.appendChild(customOption);
        }

        accentColor.value = normalizedSelected;
    }

    function updateThemeToggleIcon(theme) {
        if (!themeToggle) {
            return;
        }

        themeToggle.innerHTML = theme === 'dark'
            ? '<span class="material-icons">dark_mode</span>'
            : '<span class="material-icons">light_mode</span>';
    }

    function loadPreferences() {
        const storedTheme = localStorage.getItem('theme');
        const savedTheme = storedTheme === 'light' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
        updateThemeToggleIcon(savedTheme);

        const storedColor = localStorage.getItem('accentColor');
        const savedColor = normalizeHexColor(storedColor || DEFAULT_ACCENT);
        const appliedColor = applyAccent(savedColor);
        populateAccentDropdown(appliedColor);
    }

    function toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeToggleIcon(newTheme);
    }

    function changeAccentColor(color) {
        const normalized = applyAccent(color);
        localStorage.setItem('accentColor', normalized);
        if (accentColor && accentColor.value !== normalized) {
            accentColor.value = normalized;
        }
    }

    function setupEventListeners() {
        if (themeToggle) {
            themeToggle.addEventListener('click', toggleTheme);
        }

        if (accentColor) {
            accentColor.addEventListener('change', (event) => {
                changeAccentColor(event.target.value);
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            loadPreferences();
            setupEventListeners();
        });
    } else {
        loadPreferences();
        setupEventListeners();
    }

    window.themeUtils = {
        adjustColor,
        loadPreferences,
        toggleTheme,
        changeAccentColor,
        normalizeHexColor
    };
})();

(function() {
    // --- Configuration ---
    const STORAGE_KEY = 'holiday_snow_enabled';
    const BTN_CLASS = 'btn btn-secondary';
    const BTN_ID = 'snowToggle';
    // Using innerHTML for the icons. You can adjust the text here.
    const BTN_TEXT_ON = '<span class="material-icons">ac_unit</span> Disable Snow';
    const BTN_TEXT_OFF = '<span class="material-icons">ac_unit</span> Enable Snow';

    // --- Date Logic (Thanksgiving to Jan 1st) ---
    function isHolidaySeason() {
        const now = new Date();
        const month = now.getMonth(); // 0-11
        const date = now.getDate();

        // January 1st
        if (month === 0 && date === 1) return true;

        // December (All month)
        if (month === 11) return true;

        // November (Post-Thanksgiving)
        if (month === 10) {
            // Find Thanksgiving (4th Thursday)
            const firstOfNov = new Date(now.getFullYear(), 10, 1);
            const dayOfWeek = firstOfNov.getDay(); // 0 (Sun) to 6 (Sat)
            let daysToFirstThurs = (4 - dayOfWeek + 7) % 7;
            const thanksgivingDate = 1 + daysToFirstThurs + 21;

            return date >= thanksgivingDate;
        }
        return false;
    }

    // Stop execution if not holiday season
    if (!isHolidaySeason()) {
        // cleanup storage if date passed so it doesn't auto-start next year unexpectedly
        localStorage.removeItem(STORAGE_KEY);
        return;
    }

    // --- Snow Logic ---
    let canvas, ctx, w, h, particles = [], animationId;

    function resize() {
        w = canvas.width = window.innerWidth;
        h = canvas.height = window.innerHeight;
    }

    function createSnow() {
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;';
            document.body.appendChild(canvas);
            ctx = canvas.getContext('2d');
            window.addEventListener('resize', resize);
            resize();
        }
        canvas.style.display = 'block';

        // Initialize particles - "Light Snowfall" settings
        particles = [];
        // Much lower density: Max 50 flakes, or fewer on mobile
        const particleCount = Math.min(window.innerWidth / 10, 50);

        for (let i = 0; i < particleCount; i++) {
            particles.push({
                x: Math.random() * w,
                y: Math.random() * h,
                r: Math.random() * 2 + 1, // Size: 1px to 3px
                d: Math.random() * particleCount, // density factor
                s: Math.random() * 0.5 + 0.2 // Speed: 0.2 to 0.7 (Very slow/gentle)
            });
        }

        if (!animationId) draw();
    }

    function draw() {
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'; // Slightly more transparent
        ctx.beginPath();
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            ctx.moveTo(p.x, p.y);
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2, true);
        }
        ctx.fill();
        update();
        animationId = requestAnimationFrame(draw);
    }

    function update() {
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            p.y += p.s;
            p.x += Math.sin(p.d) * 0.5; // Gentle sway
            p.d += 0.01;

            if (p.y > h) {
                // Reset to top when it hits bottom
                particles[i] = { x: Math.random() * w, y: -10, r: p.r, d: p.d, s: p.s };
            }
        }
    }

    function stopSnow() {
        if (canvas) canvas.style.display = 'none';
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
    }

    // --- UI Integration ---
    function init() {
        const controls = document.querySelector('.controls');
        if (!controls) return;

        // Check if button already exists (prevents duplicate if script runs twice)
        if (document.getElementById(BTN_ID)) return;

        const btn = document.createElement('button');
        btn.className = BTN_CLASS;
        btn.id = BTN_ID;
        btn.style.marginLeft = '0.5rem';

        // check persistence
        let isSnowing = localStorage.getItem(STORAGE_KEY) === 'true';

        // Set initial state
        if (isSnowing) {
            btn.innerHTML = BTN_TEXT_ON;
            createSnow();
        } else {
            btn.innerHTML = BTN_TEXT_OFF;
        }

        btn.addEventListener('click', () => {
            isSnowing = !isSnowing;
            // Save state to localStorage
            localStorage.setItem(STORAGE_KEY, isSnowing);

            if (isSnowing) {
                btn.innerHTML = BTN_TEXT_ON;
                createSnow();
            } else {
                btn.innerHTML = BTN_TEXT_OFF;
                stopSnow();
            }
        });

        // Add button to header
        controls.appendChild(btn);
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
