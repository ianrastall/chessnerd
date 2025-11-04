/**
 * js/pgn-info.js
 *
 * Client-side logic for the PGN Info tool.
 * v3: Refactored to be game-aware for more accurate stats.
 * - Adds Total Unique Players
 * - Adds "With ECO Tag" (percent of games with the header)
 * - Adds "ECO Coverage" (percent of 500 codes represented)
 */
document.addEventListener('DOMContentLoaded', () => {

    // --- Constants & DOM Elements ---
    const MAX_BYTES = 52428800; // 50 MB limit (50 * 1024 * 1024)
    const form = document.getElementById('pgnForm');
    const fileInput = document.getElementById('pgnFile');
    const textInput = document.getElementById('pgnText');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const statsOutput = document.getElementById('statsOutput');
    const errorArea = document.getElementById('errorArea');

    // --- UI Helpers ---

    const showError = (msg) => {
        errorArea.innerHTML = `<div class="alert alert-warning">${msg}</div>`;
        statsOutput.value = '';
    };

    const clearError = () => {
        errorArea.innerHTML = '';
    };

    const showResult = (text) => {
        statsOutput.value = text;
        clearError();
    };

    const setLoadingState = (loading) => {
        analyzeBtn.disabled = loading;
        analyzeBtn.innerHTML = loading ?
            `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Analyzing...` :
            `<span class="material-icons me-2" aria-hidden="true">bar_chart</span>Analyze`;
    };

    // --- Core PGN Analysis Logic (v3) ---

    /**
     * Analyzes a PGN string and returns a stats object.
     * This version splits the PGN by game for more accurate stats.
     * @param {string} pgnText - The full PGN content.
     * @returns {object} - The statistics object.
     */
    const analyzePgn = (pgnText) => {
        const stats = {
            games: 0,
            whiteWins: 0,
            blackWins: 0,
            draws: 0,
            otherResults: 0,
            inProgress: 0,
            annotated: 0,
            withNAGs: 0,
            withComments: 0,
            gamesWithECO: 0,
            totalBytes: new Blob([pgnText]).size,
        };

        const playerNames = new Set();
        const ecoCodesFound = new Set(); // For the new ECO Coverage stat
        
        // Split by [Event...], which is the standard start of a PGN game.
        const gameChunks = pgnText.split(/\[Event /i);
        
        if (gameChunks.length <= 1) {
            return stats; // No games found
        }
        
        stats.games = gameChunks.length - 1;

        // Regex flags: 'i' for case-insensitive, 'm' for multiline
        const re = {
            white: /^\[White "(.*?)"\]/im,
            black: /^\[Black "(.*?)"\]/im,
            // UPDATED: Regex to capture the 3-char ECO code (A00 - E99)
            eco:   /^\[ECO "([A-E]\d{2})"\]/im, 
            res10: /^\[Result "1-0"\]/im,
            res01: /^\[Result "0-1"\]/im,
            resDraw: /^\[Result "1\/2-1\/2"\]/im,
            resStar: /^\[Result "\*"\]/im,
            resOther: /^\[Result /im,
            nags: /\$\d+/,
            comments: /[{}]/,
            annotations: /[!?]/
        };

        for (let i = 1; i < gameChunks.length; i++) {
            const chunk = gameChunks[i]; // This is the text of a single game
            
            // --- Get Players ---
            const whiteMatch = chunk.match(re.white);
            if (whiteMatch && whiteMatch[1]) playerNames.add(whiteMatch[1]);
            
            const blackMatch = chunk.match(re.black);
            if (blackMatch && blackMatch[1]) playerNames.add(blackMatch[1]);

            // --- Get ECO ---
            const ecoMatch = chunk.match(re.eco);
            if (ecoMatch && ecoMatch[1]) {
                stats.gamesWithECO++;        // Count that this game has a tag
                ecoCodesFound.add(ecoMatch[1]); // Add the *unique* code to our set
            }

            // --- Get Results ---
            if (re.res10.test(chunk)) stats.whiteWins++;
            else if (re.res01.test(chunk)) stats.blackWins++;
            else if (re.resDraw.test(chunk)) stats.draws++;
            else if (re.resStar.test(chunk)) stats.inProgress++;
            else if (re.resOther.test(chunk)) stats.otherResults++;

            // --- Get Annotations ---
            if (re.nags.test(chunk)) stats.withNAGs++;
            if (re.comments.test(chunk)) stats.withComments++;
            if (re.annotations.test(chunk)) stats.annotated++;
        }

        stats.totalPlayers = playerNames.size;
        stats.uniqueEcoCodes = ecoCodesFound.size; // Add the new stat
        return stats;
    };

    /**
     * Formats the stats object into a human-readable string.
     * @param {object} stats - The statistics object from analyzePgn.
     * @returns {string} - The formatted text for the output.
     */
    const formatStats = (stats) => {
        if (stats.games === 0) {
            return "No PGN games found in the input.";
        }

        const totalResults = stats.whiteWins + stats.blackWins + stats.draws;
        const totalKnown = totalResults + stats.inProgress + stats.otherResults;

        const perc = (n) => {
            if (stats.games === 0) return '0.0';
            return ((n / stats.games) * 100).toFixed(1);
        };
        
        const formatBytes = (bytes) => {
            if (bytes === 0) return '0 Bytes';
            if (bytes < 1024) return `${bytes} Bytes`;
            if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
            return `${(bytes / 1048576).toFixed(1)} MB`;
        };

        // NEW: Calculate ECO Coverage %
        const ecoCompleteness = ((stats.uniqueEcoCodes / 500) * 100).toFixed(1);

        let output = "PGN STATS\n";
        output += "──────────────────\n";
        output += `Total Games:      ${stats.games}\n`;
        output += `Total Players:    ${stats.totalPlayers} (unique)\n`;
        output += `Total Size:       ${formatBytes(stats.totalBytes)}\n`;
        
        output += "\nRESULTS\n";
        output += "──────────────────\n";
        output += `White Wins:       ${stats.whiteWins} (${perc(stats.whiteWins)}%)\n`;
        output += `Black Wins:       ${stats.blackWins} (${perc(stats.blackWins)}%)\n`;
        output += `Draws:            ${stats.draws} (${perc(stats.draws)}%)\n`;
        output += `In Progress (*):  ${stats.inProgress}\n`;
        output += `Other Results:    ${stats.otherResults}\n`;

        if (stats.games !== totalKnown) {
            output += `Unparsed Results: ${stats.games - totalKnown}\n`;
        }
        
        output += "\nCOMPLETENESS\n";
        output += "──────────────────\n";
        // UPDATED: Added new line and renamed the other
        output += `ECO Coverage:     ${stats.uniqueEcoCodes} / 500 (${ecoCompleteness}%)\n`;
        output += `With ECO Tag:     ${stats.gamesWithECO} (${perc(stats.gamesWithECO)}%)\n`;
        output += `With Comments:    ${stats.withComments} (${perc(stats.withComments)}%)\n`;
        output += `With NAGs ($...): ${stats.withNAGs} (${perc(stats.withNAGs)}%)\n`;
        output += `With ! or ?:     ${stats.annotated} (${perc(stats.annotated)}%)\n`;

        return output;
    };


    // --- Form Submit Handler ---

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        setLoadingState(true);
        clearError();

        const pastedText = textInput.value;
        const file = fileInput.files[0];

        if (pastedText) {
            const byteSize = new Blob([pastedText]).size;
            if (byteSize > MAX_BYTES) {
                showError(`Error: Pasted text (${(byteSize / 1048576).toFixed(1)} MB) exceeds the ${(MAX_BYTES / 1048576).toFixed(0)} MB limit.`);
                setLoadingState(false);
                return;
            }
            
            // Use setTimeout to allow the UI to update (show "Analyzing...") before
            // the potentially long-running analysis freezes the browser.
            setTimeout(() => {
                try {
                    const stats = analyzePgn(pastedText);
                    const formatted = formatStats(stats);
                    showResult(formatted);
                } catch (err) {
                    showError(`An error occurred during analysis: ${err.message}`);
                }
                setLoadingState(false);
            }, 50); // 50ms delay

        } else if (file) {
            if (file.size > MAX_BYTES) {
                showError(`Error: File (${(file.size / 1048576).toFixed(1)} MB) exceeds the ${(MAX_BYTES / 1048576).toFixed(0)} MB limit.`);
                setLoadingState(false);
                return;
            }

            // Process uploaded file
            const reader = new FileReader();
            
            reader.onload = (e) => {
                // Use setTimeout here as well for the same reason.
                setTimeout(() => {
                    try {
                        const fileContent = e.target.result;
                        const stats = analyzePgn(fileContent);
                        const formatted = formatStats(stats);
                        showResult(formatted);
                    } catch (err) {
                        showError(`An error occurred during analysis: ${err.message}`);
                    }
                    setLoadingState(false);
                }, 50); // 50ms delay
            };
            
            reader.onerror = () => {
                showError('Error reading the uploaded file.');
                setLoadingState(false);
            };
            
            reader.readAsText(file);

        } else {
            showError('Please upload a file or paste PGN text to analyze.');
            setLoadingState(false);
        }
    });
});