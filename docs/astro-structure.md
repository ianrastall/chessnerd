# Astro Structure

Chess Nerd now follows the same broad source layout as `text-utils`.

```text
src/
  components/       Reusable Astro components
  data/             Typed site/tool metadata
  layouts/          Shared page shell
  lib/              Data parsers and helpers, with their unit tests
  pages/            Astro routes that build to .html files
  scripts/          Browser TypeScript bundled into pages
  styles/           Shared CSS source
data/               Canonical generated data not served directly
public/             Static assets copied as-is to the built site
scripts/            Data refresh and sync scripts
tests/              Playwright browser checks (`npm run test:browser`)
```

The public site is generated with:

```powershell
npm run build
```

Astro is configured with `build.format: 'file'`, so routes such as `src/pages/titled-players.astro` build to `titled-players.html`. That preserves the existing GitHub Pages URL shape.

## Migration Pattern

- New public routes should be authored under `src/pages`.
- Shared page chrome belongs in `src/layouts/BaseLayout.astro`.
- Site navigation belongs in `src/data/navigation.ts`; category pages read `src/data/tools.ts`.
- Reusable page bits belong in `src/components`.
- Static data and assets that must be fetched by browser JavaScript belong in `public`.

Some older tools still use browser scripts copied into `public/js`. Those are intentionally referenced with `is:inline` script tags so Astro emits normal browser script tags rather than trying to bundle legacy globals.

`sitemap.xml` is generated at build time by `src/pages/sitemap.xml.ts` from the files in `src/pages`, so new routes are listed automatically.

## Merida Pieces

Chessboard piece rendering uses the Merida SVGs in `public/img/merida`. The source CSS maps piece data attributes to those files:

```css
.piece[data-piece="wP"] { background-image: url('/img/merida/wP.svg'); }
```

Keep new board UIs on the same piece set unless a tool has a specific reason to render pieces another way.
