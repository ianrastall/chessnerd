# Chess Nerd

Chess Nerd is a static website of chess reference tools, data browsers, download pages, and lightweight analysis utilities published at `https://chessnerd.net/`.

## Current Site

The home page currently links to these public tools:

- **CCC Archive**: Computer Chess Championship event PGNs with direct ZIP downloads.
- **Chess.com API**: A formatted reference for the Chess.com published-data API.
- **Chess.com Titled Players**: Browse titled Chess.com accounts with live profile details.
- **ECO Codes**: Hierarchical browser for the Encyclopedia of Chess Openings.
- **Engine Database**: Searchable engine catalog with language and release data.
- **Engine Game**: Play against the Lozza engine in the browser.
- **Board Colors**: Interactive board-palette designer with SVG/PNG export.
- **FIDE 2200+ Players**: Browser for FIDE-rated players meeting the 2200 threshold.
- **PGN Downloads**: Curated downloadable PGN collections.
- **PGN Info**: Client-side PGN statistics and metadata extraction.
- **Software Catalog**: Table of chess software projects with download and repository links.
- **Stockfish Commits**: Browse historical Stockfish commits and related artifacts.
- **Titled Tuesday Archive**: Organized Titled Tuesday download archive.
- **Tournament Archive**: Curated tournament PGNs with calculated FIDE categories.

There is also a standalone public page:

- **Engine List**: Alternate searchable engine listing page.

## Stack

- **Frontend**: HTML, CSS, and vanilla JavaScript.
- **Data**: Static JSON, text manifests, CSV/TSV, and PGN files.
- **Maintenance scripts**: Python and PowerShell utilities for scraping, reshaping, and regenerating site data.

## Repo Layout

```text
chessnerd/
├── css/                    # Shared styles
├── data/                   # Static datasets used by the tools
├── docs/                   # Reference notes and build context files
├── img/                    # Icons and site images
├── js/                     # Shared and tool-specific scripts
├── tools/                  # Data generation helpers
├── tours/                  # Archive/supporting assets
├── index.html              # Home page
├── *.html                  # Individual site tools/pages
├── *.py                    # Maintenance scripts
└── sitemap.xml             # Sitemap for the published site
```

## Local Use

No build step is required.

1. Clone the repository:

```bash
git clone https://github.com/ianrastall/chessnerd.git
cd chessnerd
```

2. Open `index.html` directly, or run a local static server:

```bash
python -m http.server 8000
```

3. Visit `http://localhost:8000/`.

## Notes

- The site is intentionally static and deploys cleanly to GitHub Pages.
- Some pages rely on local JSON assets or third-party public APIs, so running through a local server is safer than opening files directly.
- `tool-template.html` is a development scaffold and is not part of the public site.
