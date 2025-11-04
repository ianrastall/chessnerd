/**
 * js/eco-code.js
 *
 * Client-side logic for the ECO Code Browser.
 * This script fetches a pre-compiled JSON file (config/eco-code.json)
 * and uses it to populate a 3-level dependent dropdown browser.
 */
document.addEventListener('DOMContentLoaded', () => {

    // --- Global data store ---
    let ecoData = {};

    // --- DOM Elements ---
    const first = document.getElementById('eco1');
    const second = document.getElementById('eco2');
    const third = document.getElementById('eco3');
    const content = document.getElementById('ecoContent');

    /**
     * Populates a <select> dropdown with options.
     * @param {HTMLSelectElement} select - The dropdown element.
     * @param {string[]} codes - An array of codes (e.g., "A", "A00-A09", "A01").
     */
    function populate(select, codes) {
        select.innerHTML = '<option value="">- Select -</option>';
        if (!ecoData) return;

        codes.forEach(code => {
            const name = ecoData[code]?.name || code;
            select.add(new Option(`${code}: ${name}`, code));
        });
    }

    /**
     * Renders the HTML content for a selected ECO code.
     * @param {string} code - The code to render (e.g., "A01").
     */
    function render(code) {
        if (!code || !ecoData[code]) {
            content.innerHTML = '';
            return;
        }

        let html = ecoData[code].content.replace(/\n/g, '<br>');

        if (ecoData[code].openings && ecoData[code].openings.length > 0) {
            html += '<div class="mt-4 pt-3 border-top border-secondary">' +
                    '<h5 class="text-white mb-3">Named Openings:</h5>';
            ecoData[code].openings.forEach(op => {
                html += '<div class="mb-3 text-white">' + op.replace(/\n/g, '<br>') + '</div>';
            });
            html += '</div>';
        }
        content.innerHTML = html;
    }

    // --- Event Listeners ---
    
    first.addEventListener('change', () => {
        const c = first.value;
        second.disabled = third.disabled = true;
        populate(second, []);
        populate(third,  []);
        render(c);

        if (c && ecoData[c] && ecoData[c].children.length) {
            populate(second, ecoData[c].children);
            second.disabled = false;
        }
    });

    second.addEventListener('change', () => {
        const c = second.value;
        third.disabled = true;
        populate(third, []);
        render(c);

        if (c && ecoData[c] && ecoData[c].children.length) {
            populate(third, ecoData[c].children);
            third.disabled = false;
        }
    });

    third.addEventListener('change', () => {
        const c = third.value;
        render(c);
    });

    /**
     * Attempts to load the ECO dataset from several fallback locations.
     * This helps when the JSON is served from different directories in dev vs. production.
     * @returns {Promise<Object>} Resolved ECO dataset.
     */
    async function loadEcoData() {
        const paths = [
            'config/eco-code.json',
            'js/eco-code.json',
            'eco-code.json'
        ];

        for (const path of paths) {
            try {
                const response = await fetch(path);
                if (!response.ok) {
                    console.warn(`ECO data request failed for ${path}: ${response.status}`);
                    continue;
                }
                return await response.json();
            } catch (error) {
                console.warn(`ECO data fetch threw for ${path}:`, error);
            }
        }

        throw new Error('Failed to locate eco-code.json');
    }

    /**
     * Main initialization function.
     * Fetches the data and kicks off the app.
     */
    async function init() {
        try {
            ecoData = await loadEcoData();
            
            // Once data is loaded, populate the first dropdown
            populate(first, ['A', 'B', 'C', 'D', 'E']);
            content.innerHTML = '<p class="text-white-50">Please select a volume to begin.</p>';

        } catch (error) {
            console.error('Error initializing ECO browser:', error);
            content.innerHTML = `<div class="alert alert-danger">Error: Could not load ECO data.</div>`;
        }
    }

    // Start the application
    init();
});
