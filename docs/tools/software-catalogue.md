# Software catalogue

Updated 30 October 2026. The public route remains `/software.html`.

`src/data/software.ts` contains 39 current entries in eight functional categories: six Jupiter chess apps and 33 third-party programs, services and developer libraries. Descriptions, supported platforms and access models come from the official project websites or documentation linked with each entry. No prices or third-party release versions are pinned. Website availability can differ from project maintenance status; this directory does not claim every program is actively maintained.

The Jupiter descriptions were checked against the current sibling repositories' readmes: `chess-engine-compiler`, `lichess-puzzles`, `chesscom-crawler`, `boardroom`, `edit` (EditPGN) and `tour-breaker`. Published GitHub assets were checked separately:

- Chess Engine Compiler v0.6.0 publishes `ChessEngineCompiler-0.6.0-win-x64-setup.exe`.
- Lichess Puzzles 3.1.0 publishes `LichessPuzzles-3.1.0-win-x64-setup.exe`.
- Chess.com Crawler v0.1.0 currently publishes only a portable zip. Link to source; do not label it an installer or present portable delivery as the standard Jupiter distribution.
- Boardroom's Jupiter migration is local; the retained `titania-tools` public release is PGN Simple Edit, not the current Boardroom installer.
- EditPGN and Tour Breaker have no public remote/release in their current local repositories. List their function and pending publication without inventing public repositories or download URLs.

Do not infer public availability from a local `dist` installer. Update these records and the page's checked date when publishing new versions. Release publication for sibling apps is outside this website edit.

The older PGN Simple Edit and PgnTools URLs are preserved under a separate disclosure for existing users. SCID resources remain linked as reference material, outside the program count.

Each category has a tinted background and a matching left accent line, using the shared theme colors. The site navigation groups use the same treatment. In forced-colors mode the line uses the system highlight color.

All entries and links render as static HTML. JavaScript adds a word-based task/name search, category/platform filters, result counts and an empty state. Category jump links clear filters before navigating so their destination stays visible. Without JavaScript, the filter form stays hidden and the full directory remains usable. The existing route/responsive tests plus `tests/software.spec.ts` cover narrow layouts, combined filters, reset/navigation, publication boundaries, preserved downloads and no-JavaScript use.
