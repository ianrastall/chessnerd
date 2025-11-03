// js/main.js

// Function to get current page slug from URL
function getCurrentPageSlug() {
    const path = window.location.pathname;
    const page = path.split("/").pop();
    if (page === 'index.html' || page === '') {
        return 'index';
    }
    return page.replace('.html', '');
}

// Function to load and render the sidebar
async function loadSidebar() {
    try {
        // UPDATE: Fetch from 'config/pages.json'
        const response = await fetch('config/pages.json');
        if (!response.ok) throw new Error('Failed to load pages.json');
        const pages = await response.json();

        // Sort pages alphabetically by name
        pages.sort((a, b) => a.name.localeCompare(b.name));

        const currentPage = getCurrentPageSlug();

        // Generate the sidebar
        const sidebarHtml = pages.map(page => {
            const isActive = page.slug === currentPage;
            const activeClass = isActive ? ' active' : '';
            const iconHtml = page.icon ?
                (page.icon.endsWith('.svg') || page.icon.endsWith('.png') ?
                    `<img src="${page.icon}" alt="" class="icon me-2" aria-hidden="true" />` :
                    `<span class="material-icons me-2" aria-hidden="true">${page.icon}</span>`) :
                `<span class="me-2" style="width: 24px;"></span>`;

            return `
                <a class="nav-link d-flex align-items-center${activeClass}" href="${page.slug}.html">
                    ${iconHtml}
                    <span>${page.name}</span>
                </a>
            `;
        }).join('');

        const sidebarElement = document.getElementById('dynamic-sidebar');
        if (sidebarElement) {
            sidebarElement.innerHTML = sidebarHtml;
        }

    } catch (error) {
        console.error('Error loading sidebar:', error);
        const sidebarElement = document.getElementById('dynamic-sidebar');
        if (sidebarElement) {
            sidebarElement.innerHTML = `<div class="alert alert-danger m-2">Failed to load sidebar.</div>`;
        }
    }
}

// (initThemeSwitcher function is identical, copy from 'js/main.js')
function initThemeSwitcher() {
    const themes = [
        'burlywood', 'cadetblue', 'cornflowerblue', 'dodgerblue', 'lightcoral', 'lightgreen', 'plum', 'thistle', 'tomato', 'violet',
        'goldenyellow', 'mutedcoral', 'softpink', 'lightcyan', 'lightgray', 'neongreen', 'brightyellow'
    ];
    const themeDropdown = document.getElementById('accentColorDropdownMenu');
    const htmlElement = document.documentElement;

    function applyTheme(theme) {
        htmlElement.className = ''; // Remove all existing classes
        htmlElement.classList.add('theme-' + theme);
        localStorage.setItem('accentTheme', theme);
    }

    if (themeDropdown) {
        themes.forEach(theme => {
            const li = document.createElement('li');
            const button = document.createElement('button');
            button.className = 'dropdown-item';
            button.type = 'button';
            button.textContent = theme;
            button.onclick = () => applyTheme(theme);
            li.appendChild(button);
            themeDropdown.appendChild(li);
        });
    }

    const savedTheme = localStorage.getItem('accentTheme') || 'burlywood';
    applyTheme(savedTheme);
}

// Main initialization function
async function initializePage() {
    await ComponentLoader.loadAll();
    initThemeSwitcher();
    loadSidebar();
    
    const yearElement = document.getElementById('current-year');
    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }
}

document.addEventListener('DOMContentLoaded', initializePage);
