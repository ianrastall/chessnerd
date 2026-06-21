# Chess Nerd

Chess Nerd is a static Astro site of chess reference tools, data browsers, PGN downloads, and lightweight analysis utilities published at `https://chessnerd.net/`.

## Stack

- Astro for static `.html` output
- TypeScript for site metadata and build-time checks
- Vanilla browser JavaScript for tool runtimes
- Static JSON, text manifests, CSV/TSV, and PGN files for data
- GitHub Actions for build and GitHub Pages deploy

## Repo Layout

```text
chessnerd/
├── src/                    # Astro source
│   ├── components/          # Reusable UI components
│   ├── data/                # Tool metadata
│   ├── layouts/             # Shared page shell
│   ├── pages/               # Public routes, built as .html files
│   ├── scripts/             # Bundled TypeScript for rebuilt tools
│   └── styles/              # Shared CSS source
├── data/                   # Canonical generated data not served directly
├── public/                 # Static assets copied to dist
├── scripts/                # Maintenance and data-refresh scripts
├── docs/                   # Tool explainers and maintenance notes
└── legacy/                 # Old static site kept for reference during rebuild
```

## Local Development

```powershell
npm install
npm run dev
```

## Build

```powershell
npm run build
```

Astro uses `build.format: 'file'`, so `src/pages/titled-players.astro` builds to `dist/titled-players.html`.

## Maintenance Notes

- Merida chess pieces are in `public/img/merida` and mapped from shared CSS.
- Data refresh and cron candidates are tracked in `docs/tools/data-refresh.md`.
- Stockfish commit data is refreshed by `.github/workflows/update-stockfish-commits.yml`.
- The first-pass rebuild order is tracked in `docs/rebuild-roadmap.md`.
- Tool explainers live in `docs/tools/`.
