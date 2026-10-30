# Jupiter redesign: Chess Nerd

Implemented 21 October 2026 in `D:/jupiter/chessnerd`, retaining the original site Git history and `https://chessnerd.net` domain/Pages hosting. The source checkout at `D:/dev/proj/chessnerd/chessnerd` remains intact, including its untracked `scripts/fide_to_sqlite.py`; that unrelated file was not added to this repository. Original Jupiter planning documents are retained under `docs/`.

## Interface

The homepage is an archive discovery surface: search six published collections together, filter by collection/year, page through results and download original ZIPs directly. Initial recent downloads render as HTML without JavaScript. Search uses a separate static JSON projection and retains useful downloads when that request fails; another search retries. Filters have shareable URLs. Player lookup accepts a surname or FIDE ID and opens the existing profile workflow. PGN inspection, engine play, opening exploration and board design are direct task links.

Persistent navigation organizes the site into Games & archives, Players & ratings, Analysis & play, Engines & software, and Developer reference. Section icons and colors help distinguish the groups, and a page/tool finder filters by page or section name. All specialist pages, category pages and old standalone archive routes remain available. FIDE Player Profiles is now included in discovery metadata. Two previously extensionless catalogue links now use their existing `.html` URLs.

All pages share Jupiter warm dark/light semantic colors, system fonts, Lucide shell icons and the same Settings → Appearance controls as Text Utilities. Accent defaults to the CSS system accent where the browser exposes it, with the documented Jupiter fallback, custom choice and reset. Browser exposure may differ from the operating system setting, so the option is labelled "Use system accent color". Existing theme/accent choices migrate; reset clears the old accent key as well. Chessboard palette colors remain separate from interface colors. Material icon assets used inside retained tools and existing analytics requests remain in place.

Narrow screens collapse navigation into a disclosure. Wide tables scroll within bounded regions; engine boards and API examples fit the available column. Focus, skip navigation, reduced motion and forced colors are supported. Browser regression QA uses Chromium; no Firefox/Safari verification is claimed.

## Technology and data

Astro 7.4.2 static output, TypeScript 6.0.3, plain CSS, pinned npm dependencies/lockfile and Node 24.13.0 match the established Jupiter web baseline. Domain logic and data formats are retained. Read [the dependency and workflow map](data-dependencies.md) before changing acquisition or publication.

Checks: `npm test`, `npm run audit`, `npm run build`, `npm run test:browser`. Archive unit tests remain, with cross-collection losslessness/filter/precision checks added. Browser coverage includes every route and responsive shell plus search, downloads, URL restoration, failures/retry, no-JavaScript content, profile handoff, appearance migration/reset, PGN analysis, opening boards and archive tabs. CI repeats validation before Pages deployment.

Software catalogue, 30 October 2026: the current personal-software section lists six Jupiter chess apps, with verified public installers distinguished from pending releases. The directory now contains 39 programs and libraries in eight categories, with task search, category/platform filters and static HTML for no-JavaScript use. Earlier PGN Simple Edit/PgnTools downloads and SCID resource links remain available. See [catalogue sources and maintenance](tools/software-catalogue.md).
