# Chess Nerd Astro Rebuild Roadmap

This repo now treats the old static site as reference material in `legacy/static-site`.
Active work belongs in `src`, with passive deploy assets in `public`.
Generated Astro drafts from the first migration are kept in `legacy/astro-drafts`.

## Ready first

These tools are low-workflow and are suitable for the first Astro release pass:

- `software`: static catalog of pinned software download links.
- `pgn-downloads`: static table plus a local TypeScript filter.
- `pgn-info`: local PGN text/file analysis, now owned by `src/scripts/pgn-info.ts`.
- `board-colors`: self-contained board palette generator.
- `play-engine`: self-contained browser game using bundled `chess.min.js` and Lozza.

Only these tools are linked as ready from the home page. Queued tool URLs render a clean
placeholder route until each tool is rebuilt.

## Good next candidates

These are not scary, but they need their data moved into better `src` ownership before being called rebuilt:

- `eco-code`: static opening JSON plus client-side search.
- `engines`: static engine JSON plus client-side search.
- `chesscom-api`: reference page that should be rewritten as real Astro content.

## Workflow-heavy rebuilds

These should wait until their source/update process is documented and automated:

- `ccc-archive`: depends on archive link/event/count files from a separate workflow.
- `titled-tuesday-archive`: similar archive workflow with separate input files.
- `engine-list`: RWBC Google Sheet copy transformed by Python.
- `stockfish-commits`: generated from a Stockfish commit collection process.
- `tournaments`: generated event metadata plus PGN archive files.
- `fide-2200`: large player dataset; needs source/update notes.
- `titled-players`: live Chess.com API behavior and caching choices need design.

## Automation notes

Likely scheduled jobs:

- Refresh archive metadata and counts for CCC and Titled Tuesday.
- Rebuild engine-list data from the RWBC sheet export.
- Rebuild Stockfish commit month indexes.
- Refresh FIDE and Chess.com datasets with source timestamps.

Each job should write a timestamped data artifact, commit only deterministic output, and update the relevant tool explainer.
