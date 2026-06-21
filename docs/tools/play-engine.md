# Engine Game

The Engine Game page is now routed through `src/pages/play-engine.astro`.

## Runtime Pieces

- `public/js/chess.min.js`: chess rules/move legality library.
- `public/js/play-engine.js`: board UI, drag/drop, game state, PGN, and engine orchestration.
- `public/js/lozza.js`: bundled Lozza JavaScript engine, loaded by the worker logic in `play-engine.js`.
- `public/img/merida/*.svg`: Merida chess pieces used by the shared CSS.

## How It Works

The Astro page renders the stable DOM: board squares container, rank/file labels, controls, move list, PGN textarea, and engine log. The browser script owns the interactive state after load.

The board pieces are not image tags. The script creates elements with `data-piece` values such as `wP` or `bK`; `src/styles/global.css` maps those values to the Merida SVG assets.

## Automation

No cron job is needed for gameplay itself. Useful automation would be test-oriented:

- Build the site.
- Open `play-engine.html`.
- Confirm the board has 64 squares.
- Confirm at least one `.piece[data-piece]` renders.
- Confirm the status reaches `Lozza ready`.
