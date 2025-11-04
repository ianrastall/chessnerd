/**
 * js/titled-players.js
 *
 * Client-side logic for the Titled Players tool.
 * Replicates the PHP curl logic in the browser using fetch.
 *
 * - Uses CORS proxy for API calls.
 * - Fetches all selected titles in parallel.
 * - Uses a Set to automatically de-duplicate usernames.
 * - Adds Select All / Select None buttons.
 */
document.addEventListener('DOMContentLoaded', () => {

    // --- Constants & DOM Elements ---
    const ALLOWED_TITLES = ['GM', 'WGM', 'IM', 'WIM', 'FM', 'WFM', 'NM', 'WNM', 'CM', 'WCM'];
    const API_BASE = 'https://api.chess.com/pub/titled/';
    // CRITICAL: We must use a CORS proxy to call the API from the browser
    const PROXY_URL = 'https://corsproxy.io/?';

    const form = document.getElementById('titleForm');
    const formCheckboxes = form.querySelector('.row');
    const fetchBtn = document.getElementById('fetchBtn');
    const errorArea = document.getElementById('errorArea');
    
    // UPDATED: New buttons
    const selectAllBtn = document.getElementById('selectAllBtn');
    const selectNoneBtn = document.getElementById('selectNoneBtn');
    
    const resultsContainer = document.getElementById('resultsContainer');
    const resultCount = document.getElementById('resultCount');
    const playersList = document.getElementById('playersList');
    const copyBtn = document.getElementById('copyBtn');
    
    // Toast setup
    const toastEl = document.getElementById('copyToast');
    const toast = new bootstrap.Toast(toastEl);

    // --- UI Helpers ---

    const showError = (msg) => {
        errorArea.innerHTML = `<div class="alert alert-warning">${msg}</div>`;
    };

    const clearError = () => {
        errorArea.innerHTML = '';
    };

    const setLoadingState = (loading) => {
        fetchBtn.disabled = loading;
        fetchBtn.innerHTML = loading ?
            `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Fetching...` :
            `<span class="material-icons me-2" aria-hidden="true">group</span>Fetch Players`;
    };

    // --- Core Functions ---

    /**
     * Populates the form with checkboxes for each title.
     */
    const populateTitles = () => {
        let html = '';
        ALLOWED_TITLES.forEach(title => {
            html += `
                <div class="col">
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" name="titles[]" value="${title}" id="check_${title}">
                        <label class="form-check-label" for="check_${title}">${title}</label>
                    </div>
                </div>`;
        });
        formCheckboxes.innerHTML = html;
    };
    
    /**
     * NEW: Sets the checked state of all title checkboxes
     * @param {boolean} checked - True to check all, false to uncheck all
     */
    const setAllCheckboxes = (checked) => {
        form.querySelectorAll('input[name="titles[]"]').forEach(cb => {
            cb.checked = checked;
        });
    };

    /**
     * Handles the form submission.
     */
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoadingState(true);
        clearError();
        resultsContainer.classList.add('d-none'); // Hide old results

        const selectedTitles = Array.from(form.querySelectorAll('input[name="titles[]"]:checked'))
            .map(cb => cb.value);

        if (selectedTitles.length === 0) {
            showError('Please select at least one title.');
            setLoadingState(false);
            return;
        }

        // Create an array of fetch promises
        const fetchPromises = selectedTitles.map(title => {
            const url = `${PROXY_URL}${encodeURIComponent(API_BASE + title)}`;
            return fetch(url)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Failed to fetch ${title}. Status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => data.players || []) // Ensure we return an array
                .catch(err => {
                    console.error(err);
                    showError(`Failed to fetch data for ${title}. API may be down.`);
                    return []; // Return empty array on failure
                });
        });

        try {
            // Run all fetches in parallel and wait for them all to complete
            const results = await Promise.all(fetchPromises);
            
            // Use a Set to automatically handle de-duplication
            const playerSet = new Set();
            results.forEach(playerArray => {
                playerArray.forEach(player => playerSet.add(player));
            });

            // Convert set to array, sort case-insensitively, and display
            const sortedPlayers = Array.from(playerSet).sort((a, b) => 
                a.localeCompare(b, undefined, { sensitivity: 'base' })
            );

            playersList.value = sortedPlayers.join('\n');
            resultCount.textContent = `${sortedPlayers.length} Unique Players Found`;
            resultsContainer.classList.remove('d-none'); // Show results

        } catch (error) {
            console.error('An unexpected error occurred:', error);
            showError('An unexpected error occurred during fetching.');
        } finally {
            setLoadingState(false);
        }
    };

    /**
     * Copies the player list to the clipboard.
     */
    const copyList = () => {
        if (!playersList.value) return;
        
        navigator.clipboard.writeText(playersList.value).then(() => {
            // Show success toast
            toast.show();
        }).catch(err => {
            // Fallback for older browsers (less reliable)
            try {
                playersList.select();
                document.execCommand('copy');
                toast.show();
            } catch (e) {
                console.error('Failed to copy list:', err);
                showError('Failed to copy to clipboard.');
            }
        });
    };

    // --- Initialization ---
    populateTitles();
    form.addEventListener('submit', handleSubmit);
    copyBtn.addEventListener('click', copyList);
    
    // UPDATED: Add listeners for new buttons
    selectAllBtn.addEventListener('click', () => setAllCheckboxes(true));
    selectNoneBtn.addEventListener('click', () => setAllCheckboxes(false));

});