# Chess Nerd

Chess Nerd is a static Astro site of chess reference tools, data browsers, PGN downloads, and lightweight analysis utilities published at `https://chessnerd.net/`.

The Jupiter redesign adds a cross-collection archive search homepage, direct ZIP downloads, player lookup, and persistent task navigation. See [the interface and migration record](docs/jupiter-web.md) and [the data/workflow dependency map](docs/data-dependencies.md).

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
├── tests/                  # Playwright browser checks
├── docs/                   # Tool explainers and maintenance notes
└── legacy/                 # Old static site kept for reference
```

## Local Development

Use Node 24.13.0 (`.nvmrc`).

```powershell
npm ci
npm run dev
```

## Build

```powershell
npm run build
```

Astro uses `build.format: 'file'`, so `src/pages/titled-players.astro` builds to `dist/titled-players.html`.

## Checks

```powershell
npm test               # unit tests (Vitest)
npm run audit          # npm audit, fails on high severity
npm run build          # astro check, then build
npm run test:browser   # Playwright against the built site
```

Deployment runs all four.

## Maintenance Notes

- Merida chess pieces are in `public/img/merida` and mapped from shared CSS.
- Every data source, scheduled job and manual refresh is listed in `docs/tools/data-refresh.md`.
- GitHub Pages should use `Settings > Pages > Build and deployment > Source: GitHub Actions`.
- `docs/rebuild-roadmap.md` is the historical Astro rebuild plan; every tool in it has been rebuilt.
- Tool explainers live in `docs/tools/`.
- CCC Archive uses `npm run sync:ccc` to refresh published archive metadata; deployment runs it automatically. See `docs/tools/ccc-archive.md` for the two-repository workflow.
- Titled Tuesday Archive follows the same pattern with `npm run sync:tt`. See `docs/tools/titled-tuesday-archive.md` to add missing events later.
- Bullet Brawl Archive uses `npm run sync:bb`. See `docs/tools/bullet-brawl-archive.md` for its archive and update workflow.
- 3-0 Thursday Archive uses `npm run sync:t30`. See `docs/tools/3-0-thursday-archive.md`.
- The Events tab on Chess.com Tournaments uses `npm run sync:events` to mirror the manifest published by `ianrastall/cc-events-archive`.
- Deployment runs all five syncs (`sync:ccc`, `sync:tt`, `sync:bb`, `sync:t30`, `sync:events`) before tests and the build; the checked-in snapshots under `public/data/` only serve local and offline builds.
- Tournament Archive entries are generated one event at a time from canonical CTML with `python scripts/build_tournament_archive_zip.py D:\dev\proj\ctml\tours\<tournament>.ctml`; this writes a ZIP containing the exact CTML, a PGN compatibility export, and `README.md`, then upserts the site manifest.
