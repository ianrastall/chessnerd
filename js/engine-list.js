/**
 * engine-list.js
 * Refactored for RWBC Engine List
 * Features: Infinite Scroll, Debounced Search, Multi-link Modals
 */

// --- State Management ---
let allEngines = [];       // Complete database
let currentList = [];      // Currently filtered list
let displayedCount = 0;    // Number of items currently in the DOM
const BATCH_SIZE = 50;     // How many items to render at once
let searchTimeout = null;  // For debouncing

// --- DOM Elements ---
const grid = document.getElementById('engine-grid');
const searchInput = document.getElementById('engine-search');
const countLabel = document.getElementById('result-count');
const modal = document.getElementById('modal');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // Note: Ensure engines.json is in the same directory or adjust path
    fetch('engines.json')
        .then(response => response.json())
        .then(data => {
            allEngines = data;
            // Initial sort (optional, but good for consistency)
            // allEngines.sort((a, b) => a.name.localeCompare(b.name));
            
            currentList = allEngines;
            renderReset(); // Initial Render
        })
        .catch(err => {
            console.error("Error loading engines:", err);
            grid.innerHTML = `<div style="color:red; text-align:center;">Error loading database. Please try again later.</div>`;
        });
});

// --- Infinite Scroll Listener ---
window.addEventListener('scroll', () => {
    // Check if we are near the bottom of the page
    if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) {
        renderBatch();
    }
});

// --- Search Logic (Debounced) ---
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        
        // Clear existing timer
        clearTimeout(searchTimeout);

        // Set new timer (300ms delay)
        searchTimeout = setTimeout(() => {
            performSearch(term);
        }, 300);
    });
}

function performSearch(term) {
    if (!term) {
        currentList = allEngines;
    } else {
        currentList = allEngines.filter(eng => {
            // Safe access to properties
            const n = eng.name ? eng.name.toLowerCase() : '';
            const l = eng.lang ? eng.lang.toLowerCase() : '';
            const p = eng.protocol ? eng.protocol.toLowerCase() : '';
            const a = eng.author ? eng.author.toLowerCase() : ''; // If you add author later

            return n.includes(term) || l.includes(term) || p.includes(term) || a.includes(term);
        });
    }
    renderReset();
}

// --- Rendering System ---

// 1. Reset the grid and start fresh (used on load and after search)
function renderReset() {
    grid.innerHTML = '';
    displayedCount = 0;
    
    // Update Count UI
    if (countLabel) {
        countLabel.textContent = `Found ${currentList.length} engines`;
    }

    if (currentList.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:2rem; color:#888;">No engines found.</div>`;
        return;
    }

    renderBatch(); // Load the first batch
}

// 2. Append the next batch of items
function renderBatch() {
    // If we've already shown everything, stop.
    if (displayedCount >= currentList.length) return;

    const nextBatch = currentList.slice(displayedCount, displayedCount + BATCH_SIZE);
    const fragment = document.createDocumentFragment(); // Performance: Build off-DOM

    nextBatch.forEach(eng => {
        const card = createEngineCard(eng);
        fragment.appendChild(card);
    });

    grid.appendChild(fragment);
    displayedCount += nextBatch.length;
}

// 3. Create HTML for a single engine card
function createEngineCard(eng) {
    const card = document.createElement('div');
    card.className = 'engine-card';
    
    // Rating display logic
    let ratingDisplay = `<span class="no-rating">UR</span>`;
    if (eng.rating) {
        ratingDisplay = `<span class="rating-badge">${eng.rating}</span>`;
    }

    card.innerHTML = `
        <div class="card-header">
            <h3>${eng.name || 'Unknown'}</h3>
            ${ratingDisplay}
        </div>
        <div class="card-meta">
            <span>${eng.protocol || '-'}</span>
            <span>${eng.lang || '-'}</span>
        </div>
        <div class="card-dates">
            <small>First: ${eng.d_first || '?'}</small>
            <small>Last: ${eng.d_last || '?'}</small>
        </div>
    `;

    // Add click event for modal
    card.addEventListener('click', () => openModal(eng));
    
    return card;
}

// --- Modal Logic ---
function openModal(eng) {
    if (!modal) return;

    // Populate Text Fields
    setText('m-name', eng.name);
    
    // We don't have author in the current JSON generation script yet, 
    // but if you add it, use eng.author. For now, we hide or show generic.
    const authorText = eng.author ? `by ${eng.author}` : ''; 
    setText('m-author', authorText);

    // Populate Details Table
    const detailsContainer = document.getElementById('m-details');
    if (detailsContainer) {
        detailsContainer.innerHTML = `
            ${detailRow('Version', eng.ver)}
            ${detailRow('Protocol', eng.protocol)}
            ${detailRow('Language', eng.lang)}
            ${detailRow('First Release', eng.d_first)}
            ${detailRow('Last Update', eng.d_last)}
            ${detailRow('Rating', eng.rating)}
        `;
    }

    // --- Dynamic Link Buttons ---
    const linkContainer = document.getElementById('m-link-container');
    if (linkContainer) {
        linkContainer.innerHTML = ''; // Clear old buttons
        
        // Handle new array-based links
        if (eng.links && Array.isArray(eng.links) && eng.links.length > 0) {
            eng.links.forEach((url, index) => {
                const btn = document.createElement('a');
                btn.href = url;
                btn.target = "_blank";
                btn.className = "download-btn"; // Ensure this class exists in your CSS
                
                // Smart Labelling
                let label = "Download";
                const lowerUrl = url.toLowerCase();
                
                if (eng.links.length > 1) {
                    if (lowerUrl.includes('archive.org')) label = "Wayback Machine";
                    else if (lowerUrl.includes('drive.google')) label = "Google Drive";
                    else if (lowerUrl.includes('github')) label = "GitHub";
                    else if (lowerUrl.includes('gitlab')) label = "GitLab";
                    else if (lowerUrl.includes('sourceforge')) label = "SourceForge";
                    else label = `Mirror ${index + 1}`;
                } else {
                    // Single link specific labels
                    if (lowerUrl.includes('archive.org')) label = "Wayback Machine";
                }

                btn.textContent = label;
                
                // Styling adjustment for multiple buttons
                btn.style.marginRight = "10px";
                btn.style.marginBottom = "8px";
                btn.style.display = "inline-block";
                
                linkContainer.appendChild(btn);
            });
            linkContainer.style.display = 'block';
        } else {
            // No links found
            linkContainer.style.display = 'none';
        }
    }

    modal.style.display = 'flex';
}

function closeModal() {
    if (modal) modal.style.display = 'none';
}

// --- Helper Functions ---

// Safely set text content
function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text || '';
}

// Generate HTML for a detail row
function detailRow(label, value) {
    if (!value || value === 'null' || value === '-') return '';
    return `
        <div class="detail-row">
            <span class="detail-label">${label}</span>
            <span class="detail-val">${value}</span>
        </div>
    `;
}

// Close modal when clicking outside
window.onclick = function(event) {
    if (event.target == modal) {
        closeModal();
    }
};

// Make closeModal global so the HTML 'X' button can find it
window.closeModal = closeModal;