# Software catalogue

Updated 16 November 2026. The public route is `/software.html`.

`src/data/software.ts` contains 44 entries in eight categories, including ten programs by Ian Rastall and 34 third-party programs, services and libraries. Descriptions, platforms and access models come from the linked project websites, official app listings and repository documentation. Third-party entries link to current download pages where available. Arena's project page responded over HTTP during the review. Chessable's homepage rejected automated requests, and its publisher's store listings and MoveTrainer documentation confirmed the listing details.

Jupiter descriptions were checked against the current sibling repositories' readmes. Public source and assets were checked on GitHub.

- Chess Engine Compiler v1.1.0 publishes `ChessEngineCompiler-1.1.0-win-x64-setup.exe`.
- Lichess Puzzles 3.3.0 publishes `LichessPuzzles-3.3.0-win-x64-setup.exe`.
- Lichess Local v0.1.0 publishes `LichessLocal-0.1.0-Setup.exe`.
- Chess.com Crawler v0.1.0 publishes a portable zip. The entry links to its public source and instructions.
- The public Fastchess Desktop repository describes the earlier fastchess frontend. The current sibling checkout uses the fastchess-gui runner and has no public Jupiter release.
- Boardroom, EditPGN and Tour Breaker are pending public release. The `titania-tools` release asset is PGN Simple Edit.
- PGN Tools 2.1.0 publishes `PgnTools-2.1.0-win-x64.exe`. The 2.0.0 download is retained below the catalogue.
- Bear has public MIT-licensed Rust source and build instructions.

Verify public availability against the owning repository's release assets. Update these records and the page's checked date when refreshing the catalogue.

Chess Coach was submitted by its developer. Its [product site](https://thechesscoach.netlify.app/) documents the finished-game restriction, supported services and access terms. The [knight fork example](https://thechesscoach.netlify.app/journey/week-2026-w13/) shows a review of a finished Chess.com game.

The older PGN Simple Edit and PgnTools URLs are preserved under a separate disclosure for existing users. SCID resources remain linked as reference material, outside the program count.

Each category has a tinted background and a matching left accent line, using the shared theme colors. The site navigation groups use the same treatment. In forced-colors mode the line uses the system highlight color.

All entries and links render as static HTML. JavaScript adds a word-based task/name search, category/platform filters, result counts and an empty state. Category jump links clear filters before navigating so their destination stays visible. Without JavaScript, the filter form stays hidden and the full directory remains usable. The existing route/responsive tests plus `tests/software.spec.ts` cover narrow layouts, combined filters, reset/navigation, publication boundaries, preserved downloads and no-JavaScript use.
