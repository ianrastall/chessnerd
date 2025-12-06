// Theme and accent color management
(function() {
    'use strict';

    // DOM Elements
    const themeToggle = document.getElementById('themeToggle');
    const accentColor = document.getElementById('accentColor');

    // Initialize theme and colors on load
    function loadPreferences() {
        // Theme
        const savedTheme = localStorage.getItem('theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
        if (themeToggle) {
            themeToggle.innerHTML = savedTheme === 'dark' ? 
                '<span class="material-icons">dark_mode</span>' :
                '<span class="material-icons">light_mode</span>';
        }
        
        // Accent color
        const savedColor = localStorage.getItem('accentColor') || '#0d9488';
        if (accentColor) {
            accentColor.value = savedColor;
        }
        document.documentElement.style.setProperty('--accent', savedColor);
        document.documentElement.style.setProperty('--accent-light', adjustColor(savedColor, 20));
    }

    // Toggle theme
    function toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        if (themeToggle) {
            themeToggle.innerHTML = newTheme === 'dark' ? 
                '<span class="material-icons">dark_mode</span>' :
                '<span class="material-icons">light_mode</span>';
        }
    }

    // Change accent color
    function changeAccentColor(color) {
        document.documentElement.style.setProperty('--accent', color);
        const lighter = adjustColor(color, 20);
        document.documentElement.style.setProperty('--accent-light', lighter);
        localStorage.setItem('accentColor', color);
    }

    // Adjust color brightness
    function adjustColor(color, amount) {
        let usePound = false;
        if (color[0] === "#") {
            color = color.slice(1);
            usePound = true;
        }
        const num = parseInt(color, 16);
        let r = (num >> 16) + amount;
        let b = ((num >> 8) & 0x00FF) + amount;
        let g = (num & 0x0000FF) + amount;
        
        r = Math.min(Math.max(0, r), 255);
        g = Math.min(Math.max(0, g), 255);
        b = Math.min(Math.max(0, b), 255);
        
        return (usePound ? "#" : "") + (g | (b << 8) | (r << 16)).toString(16).padStart(6, '0');
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
