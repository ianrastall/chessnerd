# Stockfish Commits

The Stockfish Commits page is routed through `src/pages/stockfish-commits.astro`.

## How It Works

The page reads:

```text
public/data/stockfish-commits/index.json
public/data/stockfish-commits/YYYY-MM.json
```

The index provides available months and counts. Month files contain commit records. The browser script filters, paginates, extracts links, and renders expandable commit details.

## Automation

This is one of the strongest cron candidates.

Suggested GitHub Action:

1. Run `tools/build_stockfish_commits_json.py`.
2. Update `data/stockfish-commits/index.json` and the latest month file.
3. Run `npm run build`.
4. Commit only changed generated JSON.

A daily schedule is reasonable because Stockfish is active and the generated month files are already partitioned.
