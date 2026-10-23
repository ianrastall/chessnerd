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

The board stays square and sizes against the available column and viewport height, including wrapped controls and coordinate labels. On narrow screens, scroll past the settings to reach the board. Fullscreen keeps the settings, board, moves and status together; its button exits fullscreen. Browsers without element fullscreen support use an expanded page overlay, which also closes with Escape. Resizing and fullscreen changes preserve the game.

## Bundled engine provenance

Updated 22 October 2026 from Lozza 8 to [Lozza 11.0](https://github.com/op12no2/lozza/releases/tag/11.0), published 18 October 2026. The runtime file is the unmodified [`lozza.js` release asset](https://github.com/op12no2/lozza/releases/download/11.0/lozza.js), with embedded network weights and no additional network download. Its SHA-256 matches the upstream release asset digest:

`7e7e61326022b7944f239fd8a898cfdfbf437086846152811b40a39b4ad7236b`

The historical top-level `js/` and `legacy/` copies are not served by Astro and remain reference material.

## Automation

No cron job is needed for gameplay itself. Useful automation would be test-oriented:

- Build the site.
- Open `play-engine.html`.
- Confirm the board has 64 squares.
- Confirm at least one `.piece[data-piece]` renders.
- Confirm the status reaches `Lozza ready`.
