// Theme and accent color management
(function() {
    'use strict';

    const ACCENT_PALETTE = [
        { value: '#0d9488', label: 'Teal' },
        { value: '#5f9ea0', label: 'Cadet Blue' },
        { value: '#6495ed', label: 'Cornflower' },
        { value: '#8b5cf6', label: 'Purple' },
        { value: '#ee82ee', label: 'Violet' },
        { value: '#9b4d96', label: 'Plum' },
        { value: '#f9a8d4', label: 'Soft Pink' },
        { value: '#deb887', label: 'Burlywood' },
        { value: '#ef4444', label: 'Red' }
    ];
    const DEFAULT_ACCENT = '#0d9488';

    // DOM Elements
    const themeToggle = document.getElementById('themeToggle');
    const accentColor = document.getElementById('accentColor');

    function adjustColor(color, amount) {
        const raw = color.startsWith('#') ? color.slice(1) : color;
        if (raw.length !== 6) return color;

        const num = parseInt(raw, 16);
        if (Number.isNaN(num)) return color;

        let r = (num >> 16) + amount;
        let g = ((num >> 8) & 0x00FF) + amount;
        let b = (num & 0x0000FF) + amount;

        r = Math.min(Math.max(0, r), 255);
        g = Math.min(Math.max(0, g), 255);
        b = Math.min(Math.max(0, b), 255);

        const adjusted = (r << 16) | (g << 8) | b;
        return `#${adjusted.toString(16).padStart(6, '0')}`;
    }

    function applyAccent(color) {
        document.documentElement.style.setProperty('--accent', color);
        document.documentElement.style.setProperty('--accent-light', adjustColor(color, 20));
    }

    function populateAccentDropdown(selectedColor) {
        if (!accentColor) return;

        accentColor.innerHTML = '';

        ACCENT_PALETTE.forEach(({ value, label }) => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            accentColor.appendChild(option);
        });

        const hasSavedColor = ACCENT_PALETTE.some(
            ({ value }) => value.toLowerCase() === selectedColor.toLowerCase()
        );

        if (!hasSavedColor) {
            const customOption = document.createElement('option');
            customOption.value = selectedColor;
            customOption.textContent = 'Custom';
            accentColor.appendChild(customOption);
        }

        accentColor.value = selectedColor;
    }

    function updateThemeToggleIcon(theme) {
        if (!themeToggle) return;
        themeToggle.innerHTML = theme === 'dark'
            ? '<span class="material-icons">dark_mode</span>'
            : '<span class="material-icons">light_mode</span>';
    }

    // Initialize theme and colors on load
    function loadPreferences() {
        // Theme
        const savedTheme = localStorage.getItem('theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
        updateThemeToggleIcon(savedTheme);

        // Accent color
        const savedColor = localStorage.getItem('accentColor') || DEFAULT_ACCENT;
        applyAccent(savedColor);
        populateAccentDropdown(savedColor);
    }

    // Toggle theme
    function toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeToggleIcon(newTheme);
    }

    // Change accent color
    function changeAccentColor(color) {
        applyAccent(color);
        localStorage.setItem('accentColor', color);
        if (accentColor && accentColor.value !== color) {
            accentColor.value = color;
        }
    }

    // Setup event listeners
    function setupEventListeners() {
        if (themeToggle) {
            themeToggle.addEventListener('click', toggleTheme);
        }

        if (accentColor) {
            accentColor.addEventListener('change', (e) => {
                changeAccentColor(e.target.value);
            });
        }
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            loadPreferences();
            setupEventListeners();
        });
    } else {
        loadPreferences();
        setupEventListeners();
    }

    // Export functions for use in other scripts
    window.themeUtils = {
        adjustColor,
        loadPreferences,
        toggleTheme,
        changeAccentColor
    };
})();
(function() {
    // --- Configuration ---
    const STORAGE_KEY = 'holiday_snow_enabled';
    const BTN_CLASS = 'btn btn-secondary';
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
            // Calculate days to first Thursday (4 is Thursday)
            let daysToFirstThurs = (4 - dayOfWeek + 7) % 7;
            const thanksgivingDate = 1 + daysToFirstThurs + 21; // 1st Thurs + 3 weeks
            
            return date >= thanksgivingDate;
        }
        
        return false;
    }

    if (!isHolidaySeason()) return;

    // --- Snow Logic ---
    let canvas, ctx, w, h, particles = [], animationId;
    
    function resize() {
        w = canvas.width = window.innerWidth;
        h = canvas.height = window.innerHeight;
    }

    function createSnow() {
        // Create canvas if it doesn't exist
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;';
            document.body.appendChild(canvas);
            ctx = canvas.getContext('2d');
            window.addEventListener('resize', resize);
            resize();
        }
        canvas.style.display = 'block';
        
        // Initialize particles
        particles = [];
        const particleCount = Math.min(window.innerWidth / 4, 150); // Limit count for performance
        for (let i = 0; i < particleCount; i++) {
            particles.push({
                x: Math.random() * w,
                y: Math.random() * h,
                r: Math.random() * 3 + 1, // radius
                d: Math.random() * particleCount, // density
                s: Math.random() * 1 + 0.5 // speed
            });
        }
        draw();
    }

    function draw() {
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
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
            p.x += Math.sin(p.d) * 0.5; // Slight sway
            p.d += 0.01;

            if (p.y > h) {
                particles[i] = { x: Math.random() * w, y: -10, r: p.r, d: p.d, s: p.s };
            }
        }
    }

    function stopSnow() {
        if (canvas) canvas.style.display = 'none';
        cancelAnimationFrame(animationId);
    }

    // --- UI Integration ---
    function init() {
        const controls = document.querySelector('.controls');
        if (!controls) return;

        const btn = document.createElement('button');
        btn.className = BTN_CLASS;
        btn.id = 'snowToggle';
        btn.innerHTML = BTN_TEXT_OFF;
        btn.style.marginLeft = '0.5rem'; // Small gap
        
        // State management
        let isSnowing = false;

        btn.addEventListener('click', () => {
            isSnowing = !isSnowing;
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