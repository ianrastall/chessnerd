/**
 * js/chesscom-downloader.js
 *
 * Client-side logic for the Chess.com Downloader tool.
 * This script replicates the entire logic of the original PHP worker
 * (chesscom-downloader-worker.php) in the user's browser.
 *
 * Flow:
 * 1. Listen for form submission.
 * 2. Fetch the list of monthly archives from the Chess.com API.
 * 3. Filter this list by the selected date range.
 * 4. Loop through each valid archive URL and fetch its games.
 * 5. Apply user's filters (wins, mate, bullet) to each game.
 * 6. Collate all matching PGNs into a single string.
 * 7. Create a Blob (in-memory file) and generate a download link.
 */
document.addEventListener('DOMContentLoaded', () => {

    // --- DOM Elements ---
    const form = document.getElementById('dlForm');
    const downloadBtn = document.getElementById('downloadBtn');
    const logBox = document.getElementById('logBox');
    const resultArea = document.getElementById('resultArea');
    const winsCB = document.getElementById('wins_only');
    const mateCB = document.getElementById('mated_only');
    const endDateInput = document.getElementById('end_date');

    // --- Helper Functions ---

    /**
     * Appends a message to the log text area.
     * @param {string} msg The message to log.
     */
    const log = (msg) => {
        logBox.value += msg + '\n';
        logBox.scrollTop = logBox.scrollHeight;
    };

    /**
     * Shows a Bootstrap error alert in the result area.
     * @param {string} errorMsg The error message to display.
     */
    const showError = (errorMsg) => {
        resultArea.innerHTML = `<div class="alert alert-danger">${errorMsg}</div>`;
    };

    /**
     * Generates a dynamic download link for the generated PGN content.
     * @param {number} gamesCount The number of games included.
     * @param {string} pgnContent The full PGN string.
     * @param {string} username The username, for the filename.
     * @param {string} startDateStr The start date (YYYY-MM-DD).
     * @param {string} endDateStr The end date (YYYY-MM-DD).
     */
    const showSuccess = (gamesCount, pgnContent, username, startDateStr, endDateStr) => {
        const blob = new Blob([pgnContent], { type: 'application/x-chess-pgn' });
        const url = URL.createObjectURL(blob);
        
        const start = startDateStr.replace(/-/g, '');
        const end = endDateStr.replace(/-/g, '');
        const fileName = `${username}_${start}_${end}.pgn`;

        resultArea.innerHTML = `
            <div class="alert alert-success">
                <strong>Done!</strong> Found ${gamesCount} matching game(s).
                <a href="${url}" download="${fileName}" class="btn btn-sm btn-task ms-2">
                    <span class="material-icons me-1" style="font-size: 1rem; vertical-align: text-bottom;">save_alt</span>
                    Download PGN
                </a>
            </div>`;
    };

    /**
     * A simple promise-based delay.
     * @param {number} ms Milliseconds to wait.
     */
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    /**
     * Checks if a game is 'bullet' (less than 3 minutes).
     * Ported from the PHP 'is_bullet' function.
     * @param {object} game The Chess.com game object.
     * @returns {boolean}
     */
    const isBullet = (game) => {
        const rules = game.rules ?? '';
        const timeClass = game.time_class ?? '';
        if (timeClass === 'bullet') return true;
        if (rules === 'chess') {
            const tc = game.time_control ?? '60'; // Default to 60s
            const parts = tc.split('+');
            const base = parseInt(parts[0], 10) || 0;
            if (base < 180) return true; // Less than 3 minutes
        }
        return false;
    };

    /**
     * Toggles the UI state to prevent duplicate submissions.
     * @param {boolean} loading Whether to enter the loading state.
     */
    const setLoadingState = (loading) => {
        downloadBtn.disabled = loading;
        downloadBtn.innerHTML = loading ?
            `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Working...` :
            `<span class="material-icons me-1" aria-hidden="true">download</span>Start Download`;
    };

    // --- Main Logic Handler ---

    /**
     * Handles the form submission event.
     * @param {Event} e The submit event.
     */
    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setLoadingState(true);

        // Clear previous results
        logBox.value = '';
        resultArea.innerHTML = '';

        // Get form data
        const formData = new FormData(form);
        const username = formData.get('username').toLowerCase().trim();
        const startDateStr = formData.get('start_date');
        const endDateStr = formData.get('end_date');
        const skipBullet = formData.has('skip_bullet');
        const winsOnly = formData.has('wins_only');
        const matedOnly = winsOnly && formData.has('mated_only');

        // Simple validation
        if (!username) {
            showError('Please enter a username.');
            setLoadingState(false);
            return;
        }

        try {
            // 1. Get the list of monthly archives
            log(`Fetching archive list for '${username}'...`);
            // Using a free, public proxy to bypass
			const archiveListUrl = `https://corsproxy.io/?${encodeURIComponent(`https://api.chess.com/pub/player/${username}/games/archives`)}`;
            let archiveResponse;
            try {
                archiveResponse = await fetch(archiveListUrl);
            } catch (netError) {
                console.error('Network Error:', netError);
                throw new Error('Network error. Check your connection or ad-blocker. See console for details.');
            }

            if (!archiveResponse.ok) {
                throw new Error(`Failed to fetch archives. Status: ${archiveResponse.status} (User not found?)`);
            }

            const { archives } = await archiveResponse.json();
            if (!archives || archives.length === 0) {
                throw new Error('No archives found for this user.');
            }
            log(`Found ${archives.length} total monthly archives.`);

            // 2. Filter archives by date
            const start = new Date(startDateStr + 'T00:00:00Z');
            const end = new Date(endDateStr + 'T23:59:59Z');
            
            const filteredArchives = archives.filter(url => {
                const match = url.match(/\/(\d{4})\/(\d{2})$/);
                if (!match) return false;
                const year = parseInt(match[1], 10);
                const month = parseInt(match[2], 10) - 1; // JS months are 0-indexed
                const archiveDate = new Date(Date.UTC(year, month, 15)); // Use mid-month to be safe
                return archiveDate >= start && archiveDate <= end;
            });

            if (filteredArchives.length === 0) {
                log('No archives match the selected date range.');
                showError('No games found for this user in the selected date range.');
                setLoadingState(false);
                return;
            }

            log(`Date filter applied. Processing ${filteredArchives.length} archive(s)...`);

            // 3. Loop through, fetch, and filter games
            let allPgnGames = [];
            for (const archiveUrl of filteredArchives) {
                log(`Fetching ${archiveUrl}...`);
                try {
                    // Respect rate limits
                    await delay(300);
                    
                    const gamesResponse = await fetch(archiveUrl);
                    if (!gamesResponse.ok) {
                        log(`  -> WARNING: Failed to fetch ${archiveUrl}. Skipping.`);
                        continue;
                    }

                    const { games } = await gamesResponse.json();
                    if (!games || games.length === 0) {
                        log(`  -> No games in this month. Skipping.`);
                        continue;
                    }
                    
                    log(`  -> Found ${games.length} games. Applying filters...`);
                    
                    let gamesKeptThisMonth = 0;
                    for (const game of games) {
                        if (!game.pgn) continue;
                        if (skipBullet && isBullet(game)) continue;
                        
                        const isWhite = (game.white.username?.toLowerCase() === username);
                        const player = isWhite ? game.white : game.black;
                        const opponent = isWhite ? game.black : game.white;

                        if (winsOnly && player.result !== 'win') continue;
                        if (matedOnly && opponent.result !== 'checkmated') continue;

                        // Date check (port from PHP logic)
                        if (game.end_time) {
                            const gameEndDate = new Date(game.end_time * 1000);
                            if (gameEndDate < start || gameEndDate > end) continue;
                        }

                        allPgnGames.push(game.pgn);
                        gamesKeptThisMonth++;
                    }
                    log(`  -> Kept ${gamesKeptThisMonth} game(s) from this month.`);

                } catch (fetchError) {
                    log(`  -> ERROR fetching ${archiveUrl}: ${fetchError.message}. Skipping.`);
                }
            }

            // 4. Collate and provide download
            log('All archives processed.');
            if (allPgnGames.length === 0) {
                showError('No games matched your filter criteria.');
                setLoadingState(false);
                return;
            }

            const finalPgn = allPgnGames.join('\n\n') + '\n';
            showSuccess(allPgnGames.length, finalPgn, username, startDateStr, endDateStr);
            setLoadingState(false);

        } catch (error) {
            console.error('Download process failed:', error);
            showError(error.message);
            setLoadingState(false);
        }
    };

    // --- Event Listeners ---

    // Set end date to today by default
    if (!endDateInput.value) {
        endDateInput.value = new Date().toISOString().split('T')[0];
    }

    // Enable/disable 'mated_only' checkbox
    winsCB.addEventListener('change', () => {
        mateCB.disabled = !winsCB.checked;
        if (!winsCB.checked) {
            mateCB.checked = false;
        }
    });

    // Start the process on form submit
    form.addEventListener('submit', handleFormSubmit);

});