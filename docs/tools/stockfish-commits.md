# Stockfish Commits

The Stockfish Commits page is routed through:

```text
src/pages/stockfish-commits.astro
src/scripts/stockfish-commits.ts
```

The page loads the generated index, lets the user select a month, and fetches only that month's commit shard. It shows commit subjects, authors, dates, GitHub commit links, source archive links, and expandable commit messages.

## Data Pipeline

The updater lives at:

```text
scripts/stockfish_commits/update_stockfish_commits.py
```

It reads and writes:

```text
data/stockfish-commits/commits.json
public/data/stockfish-commits/index.json
public/data/stockfish-commits/YYYY-MM.json
```

On first run, it seeds `commits.json` from the legacy snapshot in `legacy/static-site/tools/stockfish_commits_full.json`.

On later runs, it:

1. Fetches new commits from `official-stockfish/Stockfish`.
2. Normalizes the commit author, date, message, GitHub URL, and source archive links.
3. Rewrites the canonical file and month JSON only when generated data actually changes.

The three old one-off scripts you pasted map to those sources:

- GitHub commit collector: replaced by GitHub REST commit pagination.
- GitHub pre-release scraper: intentionally retired for this page.
- ABROK binary scraper: intentionally retired for this page.

The page no longer tries to publish GitHub Actions artifacts, ABROK binaries, or release assets. The useful, durable promise is the commit timeline plus source snapshots for each commit.

## Schedule

The GitHub Action is:

```text
.github/workflows/update-stockfish-commits.yml
```

It runs daily at `08:23 UTC` and can also be run manually from GitHub Actions. It validates with `npm run build`, then commits only changed files under:

```text
data/stockfish-commits
public/data/stockfish-commits
```

## Local Run

```powershell
python scripts\stockfish_commits\update_stockfish_commits.py
npm run build
```

The script uses `GITHUB_TOKEN` or `GH_TOKEN` if present, but can read public GitHub data without one for ordinary local runs.

For a no-network rewrite from the checked-in canonical data:

```powershell
python scripts\stockfish_commits\update_stockfish_commits.py --max-pages 0
```
