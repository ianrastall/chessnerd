/**
 * js/pgn-info.js
 * Logic for the PGN Info tool.
 * Parses PGN data (from file or text) and generates statistics,
 * or extracts lists of players/events.
 */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const pgnFile = document.getElementById('pgnFile');
    const pgnText = document.getElementById('pgnText');
    const statsOutput = document.getElementById('statsOutput');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const clearBtn = document.getElementById('clearBtn');
    const statusMessage = document.getElementById('statusMessage');
    const inputStats = document.getElementById('inputStats');
    const backButton = document.getElementById('backButton');
    
    // NEW Elements
    const extractPlayersBtn = document.getElementById('extractPlayersBtn');
    const extractEventsBtn = document.getElementById('extractEventsBtn');
    const copyBtn = document.getElementById('copyBtn');

    const MAX_BYTES = 52428800; // 50 MB

    // --- Core Analysis Logic ---

    const analyzePgn = (text) => {
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
            totalBytes: new Blob([text]).size,
            totalPlayers: 0,
            uniqueEcoCodes: 0
        };

        // Split by standard PGN Event tag
        // Note: This simple split works for most standard PGNs but isn't a full parser.
        const gameChunks = text.split(/\[Event /i);
        
        // If split didn't find multiple events, it might be a single game without an Event tag 
        // or just one game. We treat chunk 0 as "preamble" usually, but if length is 1, check content.
        if (gameChunks.length <= 1 && text.trim().length > 0) {
            // Treat the whole text as one game if it looks like PGN
            gameChunks.push(text);
        }

        const playerNames = new Set();
        const ecoCodesFound = new Set();

        const re = {
            white: /^\[White "(.*?)"\]/im,
            black: /^\[Black "(.*?)"\]/im,
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

        // Skip index 0 if it is empty/preamble before first [Event
        let startIndex = (gameChunks[0].trim() === "") ? 1 : 0;
        
        // If we split by [Event, the 'Event' keyword is consumed.
        // We only count chunks that look like games.
        let validGames = 0;

        for (let i = startIndex; i < gameChunks.length; i++) {
            const chunk = gameChunks[i];
            if (!chunk.trim()) continue;

            validGames++;

            // Players
            const whiteMatch = chunk.match(re.white);
            if (whiteMatch && whiteMatch[1]) playerNames.add(whiteMatch[1]);
            
            const blackMatch = chunk.match(re.black);
            if (blackMatch && blackMatch[1]) playerNames.add(blackMatch[1]);

            // ECO
            const ecoMatch = chunk.match(re.eco);
            if (ecoMatch && ecoMatch[1]) {
                stats.gamesWithECO++;
                ecoCodesFound.add(ecoMatch[1]);
            }

            // Results
            if (re.res10.test(chunk)) stats.whiteWins++;
            else if (re.res01.test(chunk)) stats.blackWins++;
            else if (re.resDraw.test(chunk)) stats.draws++;
            else if (re.resStar.test(chunk)) stats.inProgress++;
            else if (re.resOther.test(chunk)) stats.otherResults++;

            // Annotations
            if (re.nags.test(chunk)) stats.withNAGs++;
            if (re.comments.test(chunk)) stats.withComments++;
            if (re.annotations.test(chunk)) stats.annotated++;
        }

        stats.games = validGames;
        stats.totalPlayers = playerNames.size;
        stats.uniqueEcoCodes = ecoCodesFound.size;

        return stats;
    };

    const formatStats = (stats) => {
        if (stats.games === 0) return "No games found.";

        const perc = (n) => ((n / stats.games) * 100).toFixed(1);
        
        const formatBytes = (bytes) => {
            if (bytes === 0) return '0 B';
            if (bytes < 1024) return `${bytes} B`;
            if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
            return `${(bytes / 1048576).toFixed(1)} MB`;
        };

        const ecoCompleteness = ((stats.uniqueEcoCodes / 500) * 100).toFixed(1);

        let out = "PGN STATISTICS REPORT\n";
        out += "=====================\n\n";
        out += `Total Games:      ${stats.games}\n`;
        out += `Total Players:    ${stats.totalPlayers} (Unique)\n`;
        out += `File Size:        ${formatBytes(stats.totalBytes)}\n`;
        
        out += "\nRESULTS SUMMARY\n";
        out += "---------------\n";
        out += `White Wins:       ${stats.whiteWins}`.padEnd(20) + `(${perc(stats.whiteWins)}%)\n`;
        out += `Black Wins:       ${stats.blackWins}`.padEnd(20) + `(${perc(stats.blackWins)}%)\n`;
        out += `Draws:            ${stats.draws}`.padEnd(20) + `(${perc(stats.draws)}%)\n`;
        out += `Unfinished (*):   ${stats.inProgress}\n`;
        
        out += "\nCONTENT DETAILS\n";
        out += "---------------\n";
        out += `ECO Coverage:     ${stats.uniqueEcoCodes}/500`.padEnd(20) + `(${ecoCompleteness}%)\n`;
        out += `Has ECO Tag:      ${stats.gamesWithECO}`.padEnd(20) + `(${perc(stats.gamesWithECO)}%)\n`;
        out += `Has Comments:     ${stats.withComments}`.padEnd(20) + `(${perc(stats.withComments)}%)\n`;
        out += `Has NAGs ($):     ${stats.withNAGs}`.padEnd(20) + `(${perc(stats.withNAGs)}%)\n`;
        out += `Has Symbols (!?): ${stats.annotated}`.padEnd(20) + `(${perc(stats.annotated)}%)\n`;

        return out;
    };

    // --- NEW: Extraction Helper ---
    const extractList = (text, type) => {
        const items = new Set();
        let regex;

        if (type === 'players') {
            // Matches [White "Name"] OR [Black "Name"]
            regex = /\[(White|Black)\s+"(.*?)"\]/g;
        } else {
            // Matches [Event "Name"]
            regex = /\[Event\s+"(.*?)"\]/g;
        }

        let match;
        // Use regex.exec loop to find all occurrences globally
        while ((match = regex.exec(text)) !== null) {
            // match[2] is the name for players, match[1] for events
            const val = (type === 'players') ? match[2] : match[1];
            if (val && val !== '?' && val.trim() !== '') {
                items.add(val.trim());
            }
        }

        const sorted = Array.from(items).sort();
        return `EXTRACTED ${type.toUpperCase()} (${sorted.length})\n` +
               `==========================\n` +
               sorted.join('\n');
    };

    // --- Event Handlers ---

    // 1. Update char count for text input
    pgnText.addEventListener('input', () => {
        const len = pgnText.value.length;
        inputStats.textContent = `${len} chars`;
        if (len > 0) statusMessage.textContent = "Content modified (Click Analyze to update)";
    });

    // 2. File Upload Handler
    pgnFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > MAX_BYTES) {
            alert(`File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Limit is 50 MB.`);
            pgnFile.value = '';
            return;
        }

        statusMessage.textContent = "Reading file...";
        const reader = new FileReader();
        
        reader.onload = (e) => {
            pgnText.value = e.target.result;
            inputStats.textContent = `${pgnText.value.length} chars`;
            statusMessage.textContent = "File loaded. Click Analyze.";
        };
        
        reader.onerror = () => {
            statusMessage.textContent = "Error reading file";
            statusMessage.className = "error";
        };
        
        reader.readAsText(file);
    });

    // 3. Analyze Button
    analyzeBtn.addEventListener('click', () => {
        const text = pgnText.value;
        if (!text.trim()) {
            statusMessage.textContent = "Please enter text or upload a file";
            statusMessage.className = "warning";
            return;
        }

        statusMessage.textContent = "Analyzing...";
        
        // Use timeout to allow UI to update before heavy processing
        setTimeout(() => {
            try {
                const startTime = performance.now();
                const stats = analyzePgn(text);
                const report = formatStats(stats);
                const endTime = performance.now();
                
                statsOutput.value = report;
                statusMessage.textContent = `Analysis complete (${(endTime - startTime).toFixed(0)}ms)`;
                statusMessage.className = "success";
            } catch (err) {
                console.error(err);
                statusMessage.textContent = "Error parsing PGN";
                statusMessage.className = "error";
            }
        }, 10);
    });

    // 4. Extract Players Button (NEW)
    extractPlayersBtn.addEventListener('click', () => {
        const text = pgnText.value;
        if (!text.trim()) {
            statusMessage.textContent = "No PGN text to extract from.";
            return;
        }
        statusMessage.textContent = "Extracting players...";
        setTimeout(() => {
            const list = extractList(text, 'players');
            statsOutput.value = list;
            statusMessage.textContent = "Player list extracted.";
            statusMessage.className = "success";
        }, 10);
    });

    // 5. Extract Events Button (NEW)
    extractEventsBtn.addEventListener('click', () => {
        const text = pgnText.value;
        if (!text.trim()) {
            statusMessage.textContent = "No PGN text to extract from.";
            return;
        }
        statusMessage.textContent = "Extracting events...";
        setTimeout(() => {
            const list = extractList(text, 'events');
            statsOutput.value = list;
            statusMessage.textContent = "Event list extracted.";
            statusMessage.className = "success";
        }, 10);
    });

    // 6. Copy Output Button (NEW)
    copyBtn.addEventListener('click', () => {
        if (!statsOutput.value) return;
        
        statsOutput.select();
        statsOutput.setSelectionRange(0, 99999); // Mobile compatibility

        navigator.clipboard.writeText(statsOutput.value).then(() => {
            const originalText = statusMessage.textContent;
            statusMessage.textContent = "Output copied to clipboard!";
            setTimeout(() => {
                statusMessage.textContent = originalText;
            }, 2000);
        }).catch(err => {
            statusMessage.textContent = "Failed to copy";
            console.error('Copy failed', err);
        });
    });

    // 7. Clear Button
    clearBtn.addEventListener('click', () => {
        pgnText.value = '';
        statsOutput.value = '';
        pgnFile.value = '';
        inputStats.textContent = '0 chars';
        statusMessage.textContent = 'Cleared';
        statusMessage.className = '';
        setTimeout(() => { statusMessage.textContent = 'Ready'; }, 2000);
    });

    // 8. Back Button
    if (backButton) {
        backButton.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }
});