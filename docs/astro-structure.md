# Astro Structure

Chess Nerd now follows the same broad source layout as `text-utils`.

```text
src/
  components/       Reusable Astro components
  data/             Typed site/tool metadata
  layouts/          Shared page shell
  pages/            Astro routes that build to .html files
  styles/           Shared CSS source
public/             Static assets copied as-is to the built site
legacy/             Old static site kept as reference, not active routes
```

The public site is generated with:

```powershell
npm run build
```

Astro is configured with `build.format: 'file'`, so routes such as `src/pages/titled-players.astro` build to `titled-players.html`. That preserves the existing GitHub Pages URL shape.

## Migration Pattern

- New public routes should be authored under `src/pages`.
- Shared page chrome belongs in `src/layouts/BaseLayout.astro`.
- Homepage cards belong in `src/data/tools.ts`.
- Reusable page bits belong in `src/components`.
- Static data and assets that must be fetched by browser JavaScript belong in `public`.

Some older tools still use browser scripts copied into `public/js`. Those are intentionally referenced with `is:inline` script tags so Astro emits normal browser script tags rather than trying to bundle legacy globals.

The root-level static site files have been moved into `legacy/static-site`. New work should not add new public routes there. Treat it as source material while rebuilding the tool properly in Astro.

## Merida Pieces

Chessboard piece rendering uses the Merida SVGs in `public/img/merida`. The source CSS maps piece data attributes to those files:

```css
.piece[data-piece="wP"] { background-image: url('/img/merida/wP.svg'); }
```

Keep new board UIs on the same piece set unless a tool has a specific reason to render pieces another way.
