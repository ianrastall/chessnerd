# PGN Downloads

Page: `/pgn-downloads.html`. Regional databases use the existing `arg-base.zip`, `brit-base.zip`, `rus-base.zip` naming convention. CAN-Base therefore uses `can-base.zip`, containing `can-base.pgn`, with the publication date stored separately.

## CAN-Base — 21 October 2026

User-supplied source: `canada_20261001(1).pgn`. The PGN bytes are unchanged; only the filename changes. The ZIP contains one file. Packaging checks verify the ZIP CRC and compare the decompressed PGN's SHA-256 with the original.

`public/data/pgn-downloads/can-base.json` records the display entry, sizes, game-header count and source/archive checksums. The page imports that entry directly. The ZIP is a GitHub release asset under `pgn-downloads-2026-10-21`, rather than a large binary in site Git history. Existing external download links and archive pipelines are unchanged.

## Chess.com FIDE 2400+ (2024–2025) — 8 November 2026

Source collections crawled via `chesscom-crawler` (`D:/pgn/cc/crawl-261022/yearly-2024-2025/`), matching rated standard Chess.com blitz, rapid, and daily games to FIDE rating lists where both players are rated 2400+ FIDE standard, with normalized FIDE names, titles, FIDE IDs, and standard ratings:

- `chesscom-fide-2400-2024.zip` (`87,760,369` bytes, SHA-256 `6d081c123bd1630406156282bbd0242c348e1d91d9d40d090488e1b581797e84`), containing `chesscom-fide-2400-2024.pgn` (`421,276,329` bytes, `138,002` games, SHA-256 `bd4efb9233b7bef6bdd32f98b9caa6b5bf23143f3d298719516dbc9062e883cd`).
- `chesscom-fide-2400-2025.zip` (`75,698,152` bytes, SHA-256 `61f43d94fae399cca2e88e079c2b7a3980a568643dc110cbfb0fa269a9cac0aa`), containing `chesscom-fide-2400-2025.pgn` (`361,402,361` bytes, `117,652` games, SHA-256 `527c34db5dbb5f5c8310ae1b05f9902856786e020002b46c29d85f4a43b9baf0`).

`public/data/pgn-downloads/chesscom-fide-2400-2024.json` and `public/data/pgn-downloads/chesscom-fide-2400-2025.json` record the display entries, sizes, game counts, and SHA-256 checksums. Both ZIPs are published as GitHub release assets under `pgn-downloads-2026-11-08`.
