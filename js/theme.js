// Theme and accent color management
(function() {
    'use strict';

    const ACCENT_PALETTE = [
        { value: '#0d9488', label: 'Teal' },
        { value: '#5f9ea0', label: 'Cadet Blue' },
        { value: '#6495ed', label: 'Cornflower' },
        { value: '#8b5cf6', label: 'Purple' },
        { value: '#7c3aed', label: 'Violet' },
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
