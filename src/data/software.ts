export interface SoftwareLink { label: string; url: string; }
export interface Software {
  name: string;
  description: string;
  platforms: string[];
  access: string;
  availability?: string;
  links: SoftwareLink[];
}
export interface SoftwareGroup { id: string; name: string; description: string; items: Software[]; }

// Project websites and public release assets checked 16 November 2026.
// Keep descriptions about supported tasks; release availability is separate.
export const softwareGroups: SoftwareGroup[] = [
  {
    id: 'jupiter', name: 'My chess software',
    description: 'Windows chess apps and the Bear engine by Ian Rastall. Download links are shown where a public build is available.',
    items: [
      {
        name: 'Chess Engine Compiler', platforms: ['Windows'], access: 'Free / Open source',
        description: 'Build Stockfish, Lc0 and Obsidian from stable releases or selected source revisions. Configure build targets, verify engine binaries, download upstream builds and export build scripts.',
        availability: 'Windows x64 installer available.',
        links: [
          { label: 'Windows installer', url: 'https://github.com/ianrastall/chess-engine-compiler/releases/download/v1.1.0/ChessEngineCompiler-1.1.0-win-x64-setup.exe' },
          { label: 'Releases', url: 'https://github.com/ianrastall/chess-engine-compiler/releases' },
          { label: 'Source', url: 'https://github.com/ianrastall/chess-engine-compiler' }
        ]
      },
      {
        name: 'Lichess Puzzles', platforms: ['Windows'], access: 'Free / Open source',
        description: 'Solve Lichess puzzles offline. Filter by rating, theme or opening, screen for short mates or shallow engine solutions, track local ratings and attempt history, and export positions.',
        availability: 'Windows x64 installer available. Download the puzzle database separately.',
        links: [
          { label: 'Windows installer', url: 'https://github.com/ianrastall/lichess-puzzles/releases/download/3.3.0/LichessPuzzles-3.3.0-win-x64-setup.exe' },
          { label: 'Releases', url: 'https://github.com/ianrastall/lichess-puzzles/releases' },
          { label: 'Source', url: 'https://github.com/ianrastall/lichess-puzzles' }
        ]
      },
      {
        name: 'Lichess Local', platforms: ['Windows'], access: 'Free / Open source',
        description: 'Play offline against Fairy-Stockfish in all nine Lichess variants. Review and save games as PGN and track an optional local progress rating. Unofficial.',
        availability: 'Windows x64 installer available.',
        links: [
          { label: 'Windows installer', url: 'https://github.com/ianrastall/lichess-local/releases/download/v0.1.0/LichessLocal-0.1.0-Setup.exe' },
          { label: 'Releases', url: 'https://github.com/ianrastall/lichess-local/releases' },
          { label: 'Source', url: 'https://github.com/ianrastall/lichess-local' }
        ]
      },
      {
        name: 'Chess.com Crawler', platforms: ['Windows'], access: 'Free / Open source',
        description: 'Collect Chess.com games into monthly PGNs for several rating floors at once. Filter by time control and optionally match players against local FIDE standard rating lists. Runs in the notification area.',
        availability: 'The public release contains a portable build. The Jupiter installer is pending publication.',
        links: [{ label: 'Source and instructions', url: 'https://github.com/ianrastall/chesscom-crawler' }]
      },
      {
        name: 'Boardroom', platforms: ['Windows'], access: 'Public release pending',
        description: 'Play offline against Maia-2 human-style models or another person at the same computer. Choose a rating population, use premoves and takebacks, and export the game as PGN.',
        links: []
      },
      {
        name: 'Fastchess Desktop', platforms: ['Windows'], access: 'Public release pending',
        description: 'Set up, pause and resume UCI engine tournaments. Run round robins, gauntlets, Swiss events, knockouts and SPRT tests, and follow live standings and games.',
        links: []
      },
      {
        name: 'EditPGN', platforms: ['Windows'], access: 'Public release pending',
        description: 'Browse large PGN files with a background game index. Filter games by tag text, edit PGN source and game headers, and follow the current move or variation on a board.',
        links: []
      },
      {
        name: 'Tour Breaker', platforms: ['Windows'], access: 'Public release pending',
        description: 'Extract complete tournaments from PGN files using rating, variant, time-control and checkmate filters. Recover missing ratings for known classical games from a local FIDE archive and review why events were excluded.',
        links: []
      },
      {
        name: 'PGN Tools', platforms: ['Windows'], access: 'Free / Open source',
        description: 'Download games, clean and organise PGN files, enrich game tags and run engine analysis. Processes large PGN files one game at a time.',
        links: [
          { label: 'Windows download', url: 'https://github.com/ianrastall/PgnTools/releases/download/2.1.0/PgnTools-2.1.0-win-x64.exe' },
          { label: 'Releases', url: 'https://github.com/ianrastall/PgnTools/releases' },
          { label: 'Source', url: 'https://github.com/ianrastall/PgnTools' }
        ]
      },
      {
        name: 'Bear', platforms: ['Windows'], access: 'Free / Open source',
        description: 'A Rust UCI engine for standard chess and Chess960. Build it from source and load it in a compatible engine interface.',
        links: [{ label: 'Source and build instructions', url: 'https://github.com/ianrastall/bear' }]
      }
    ]
  },
  {
    id: 'databases', name: 'Databases & game analysis', description: 'Store, search, annotate and analyse game collections.',
    items: [
      { name: 'ChessBase', platforms: ['Windows'], access: 'Commercial', description: 'Manage game databases, search positions and players, prepare against opponents and analyse with engines.', links: [{ label: 'Website', url: 'https://shop.chessbase.com/en/categories/chessbase' }] },
      { name: 'SCID', platforms: ['Windows', 'macOS', 'Linux'], access: 'Free / Open source', description: 'Maintain large game databases, search positions and headers, explore opening trees and generate player reports.', links: [{ label: 'Website', url: 'https://scid.sourceforge.net/' }] },
      { name: 'Scid vs. PC', platforms: ['Windows', 'macOS', 'Linux'], access: 'Free / Open source', description: 'A separate SCID fork with database searches, opening and player reports, engine analysis, game play and engine tournaments.', links: [{ label: 'Website', url: 'https://scidvspc.sourceforge.net/' }] },
      { name: 'ChessX', platforms: ['Windows', 'macOS', 'Linux'], access: 'Free / Open source', description: 'Browse and edit PGN databases, remove duplicates, search by position or text, explore opening trees and analyse with UCI engines.', links: [{ label: 'Website', url: 'https://chessx.sourceforge.io/' }] },
      { name: 'En Croissant', platforms: ['Windows', 'macOS', 'Linux'], access: 'Free / Open source', description: 'Import games from Lichess and Chess.com, manage databases and engines, and review engine analysis reports. Browser extensions can open completed games in the desktop app.', links: [{ label: 'Website', url: 'https://encroissant.org/' }, { label: 'Downloads', url: 'https://encroissant.org/download' }] },
      { name: 'HIARCS Chess Explorer', platforms: ['Windows', 'macOS'], access: 'Commercial', description: 'Combine PGN databases, opening preparation, engine analysis and adjustable-strength computer opponents. The Pro edition also reads ChessBase databases.', links: [{ label: 'Chess Explorer', url: 'https://www.hiarcs.com/chess-explorer.html' }, { label: 'Chess Explorer Pro', url: 'https://www.hiarcs.com/chess-explorer-pro.html' }] },
      {
        name: 'Chess Coach', platforms: ['Web'], access: 'Free plan + optional paid plan',
        description: 'Review public, finished Chess.com and Lichess games with Stockfish in Claude or ChatGPT. Explore key positions on an interactive board, ask follow-up questions and practise mistakes from your own games.',
        availability: 'By Chals AI. Seven-day trial without a card.',
        links: [
          { label: 'Website', url: 'https://thechesscoach.netlify.app/' },
          { label: 'Knight fork game review', url: 'https://thechesscoach.netlify.app/journey/week-2026-w13/' }
        ]
      }
    ]
  },
  {
    id: 'interfaces', name: 'Engine interfaces & testing', description: 'Run engines for analysis, game play, matches and automated tournaments.',
    items: [
      { name: 'Cute Chess', platforms: ['Windows', 'macOS', 'Linux'], access: 'Free / Open source', description: 'Run engine matches and tournaments through a graphical interface or automate testing with cutechess-cli.', links: [{ label: 'Website', url: 'https://cutechess.com/' }, { label: 'Source and releases', url: 'https://github.com/cutechess/cutechess' }] },
      { name: 'Arena', platforms: ['Windows', 'Linux'], access: 'Freeware', description: 'Load UCI and WinBoard engines for analysis, computer opponents and engine tournaments.', links: [{ label: 'Website (HTTP)', url: 'http://www.playwitharena.de/' }] },
      { name: 'BanksiaGUI', platforms: ['Windows', 'macOS', 'Linux'], access: 'Freeware', description: 'Manage engines, games, opening books and databases; run tournaments and analyse positions or games.', links: [{ label: 'Website', url: 'https://banksiagui.com/' }] },
      { name: 'Nibbler', platforms: ['Windows', 'macOS', 'Linux'], access: 'Free / Open source', description: 'Analyse positions interactively with Lc0 or other UCI engines, including directing the engine to investigate particular moves.', links: [{ label: 'Source and releases', url: 'https://github.com/rooklift/nibbler' }] },
      { name: 'XBoard / WinBoard', platforms: ['Windows', 'Linux'], access: 'Free / Open source', description: 'Use a graphical board with chess engines, saved PGNs and chess servers. Supports many chess variants; WinBoard is the Windows port.', links: [{ label: 'Website', url: 'https://www.gnu.org/software/xboard/' }] },
      { name: 'Shredder', platforms: ['Windows', 'macOS', 'Linux'], access: 'Commercial', description: 'Play against an adjustable-strength engine, analyse games and practise positions. Desktop editions are separate from its browser and mobile tools.', links: [{ label: 'Website', url: 'https://www.shredderchess.com/' }] }
    ]
  },
  {
    id: 'training', name: 'Training & opening preparation', description: 'Practise tactics and endgames, build repertoires and study annotated games.',
    items: [
      { name: 'Lucas Chess', platforms: ['Windows', 'Linux'], access: 'Free / Open source', description: 'Play engines at different levels and practise tactics, calculation, openings and endgames. Includes PGN and database tools.', links: [{ label: 'Website', url: 'https://lucaschess.pythonanywhere.com/' }] },
      { name: 'Chess Forge', platforms: ['Windows'], access: 'Free / Open source', description: 'Create PGN study workbooks with opening repertoires, annotated games and exercises, then train against the material.', links: [{ label: 'Website', url: 'https://chessforge.sourceforge.io/' }] },
      { name: 'Lichess studies', platforms: ['Web'], access: 'Free / Open source', description: 'Create and share annotated, multi-chapter studies with variations, engine analysis and interactive lessons. An account is needed to create studies.', links: [{ label: 'Open studies', url: 'https://lichess.org/study' }] },
      { name: 'Chess Tempo', platforms: ['Web', 'iOS', 'Android'], access: 'Free + paid features', description: 'Train tactics and endgames, maintain an opening repertoire with spaced repetition and search a game database. Training features and limits depend on membership.', links: [{ label: 'Website', url: 'https://chesstempo.com/' }, { label: 'Mobile apps', url: 'https://mobileapp.chesstempo.com/mobile/' }] },
      { name: 'Listudy', platforms: ['Web'], access: 'Free / Open source', description: 'Practise opening repertoires with spaced repetition, solve tactics and train endgames against Stockfish.', links: [{ label: 'Website', url: 'https://listudy.org/' }] },
      { name: 'Chessable', platforms: ['Web', 'iOS', 'Android'], access: 'Free + paid courses', description: 'Study chess courses and review their variations with the MoveTrainer spaced-repetition system. An account is required.', links: [{ label: 'Website', url: 'https://www.chessable.com/' }, { label: 'iOS app', url: 'https://apps.apple.com/us/app/chessable-study-chess-smarter/id1523279049' }, { label: 'Android app', url: 'https://play.google.com/store/apps/details?id=com.chessable.chessable' }, { label: 'MoveTrainer documentation', url: 'https://support.chess.com/en/articles/10319322-how-does-the-spaced-repetition-scheduling-work' }] }
    ]
  },
  {
    id: 'pgn', name: 'PGN utilities & image recognition', description: 'Filter game files and convert diagrams or scoresheets into usable chess data.',
    items: [
      { name: 'pgn-extract', platforms: ['Windows', 'macOS', 'Linux'], access: 'Free / Open source', description: 'Search, filter, deduplicate and reformat PGN files from the command line. Selection criteria include headers, move sequences, positions and material.', links: [{ label: 'Website and downloads', url: 'https://www.cs.kent.ac.uk/people/staff/djb/pgn-extract/' }] },
      { name: 'ScanChess', platforms: ['Web'], access: 'Free tools + paid scanning', description: 'Convert board images to FEN and handwritten scoresheets to PGN, with review before export. Scan a full round of scoresheets or use the browser extension to capture diagrams.', links: [{ label: 'Website', url: 'https://scanchess.com/' }] },
      { name: 'Chessvision.ai', platforms: ['Web', 'iOS', 'Android'], access: 'Free + paid products', description: 'Scan chess diagrams with a browser extension or mobile app. Save positions to the Library or use the separate eBook Reader to analyse diagrams in chess PDFs.', links: [{ label: 'Website', url: 'https://chessvision.ai/' }, { label: 'Mobile apps', url: 'https://chessvision.ai/mobile/' }] }
    ]
  },
  {
    id: 'engines', name: 'Chess engines & human-style models', description: 'Analysis engines and models to use with a compatible interface. See Engine releases for a larger engine list.',
    items: [
      { name: 'Stockfish', platforms: ['Windows', 'macOS', 'Linux', 'Android'], access: 'Free / Open source', description: 'A UCI chess engine for CPU-based analysis and game play. Choose a build compatible with your processor and load it in an engine interface.', links: [{ label: 'Website', url: 'https://stockfishchess.org/' }, { label: 'Engine downloads', url: 'https://stockfishchess.org/download/' }] },
      { name: 'Leela Chess Zero (Lc0)', platforms: ['Windows', 'macOS', 'Linux'], access: 'Free / Open source', description: 'A neural-network chess engine with several hardware backends. Use a compatible network and engine interface, and choose a backend for your CPU or GPU.', links: [{ label: 'Website', url: 'https://lczero.org/' }, { label: 'Engine downloads', url: 'https://lczero.org/play/download/' }] },
      { name: 'Maia', platforms: ['Web'], access: 'Free online play', description: 'Human-style chess models trained to predict moves by players at different rating levels. The project offers browser play, analysis and training tools.', links: [{ label: 'Website', url: 'https://www.maiachess.com/' }] },
      { name: 'Fairy-Stockfish', platforms: ['Windows', 'macOS', 'Linux'], access: 'Free / Open source', description: 'A Stockfish-derived engine for chess variants, including user-defined rules through configuration files. Requires a compatible variant interface.', links: [{ label: 'Website', url: 'https://fairy-stockfish.github.io/' }] }
    ]
  },
  {
    id: 'tournaments', name: 'Tournament administration', description: 'Register players, make pairings and publish standings.',
    items: [
      { name: 'Swiss-Manager', platforms: ['Windows'], access: 'Commercial', description: 'Administer individual and team tournaments using Swiss or round-robin pairings, with results and standings publication.', links: [{ label: 'Website', url: 'https://swiss-manager.at/' }] },
      { name: 'Vega', platforms: ['Windows', 'macOS', 'Linux'], access: 'Free + licensed editions', description: 'Manage tournament entries, pairings, results and crosstables. The Linux edition is free. Free Windows and macOS editions have event-size limits.', links: [{ label: 'Website', url: 'https://www.vegachess.com/' }, { label: 'Downloads and requirements', url: 'https://vegachess.com/v/download/index.html' }] }
    ]
  },
  {
    id: 'development', name: 'Developer libraries & publishing', description: 'Components for writing chess software or displaying games on a website.',
    items: [
      { name: 'python-chess', platforms: ['Library'], access: 'Free / Open source · GPL', description: 'Python move generation and validation, PGN parsing and writing, engine communication, opening-book reading and endgame tablebase probing.', links: [{ label: 'Documentation', url: 'https://python-chess.readthedocs.io/en/latest/' }] },
      { name: 'chess.js', platforms: ['Library'], access: 'Free / Open source · BSD', description: 'TypeScript chess rules, move validation, PGN handling and game-end detection for browsers and Node.js. Does not provide an AI opponent.', links: [{ label: 'Source and documentation', url: 'https://github.com/jhlywa/chess.js' }] },
      { name: 'shakmaty', platforms: ['Library'], access: 'Free / Open source · GPL', description: 'Rust chess and variant rules, legal move generation, notation and position handling, with related PGN and Syzygy crates.', links: [{ label: 'Source and documentation', url: 'https://github.com/niklasf/shakmaty' }] },
      { name: 'Chessground', platforms: ['Library'], access: 'Free / Open source · GPL', description: 'An interactive chessboard component for browser applications, with drag-and-drop, premoves and annotations. Supply a separate rules library.', links: [{ label: 'Source and documentation', url: 'https://github.com/lichess-org/chessground' }] },
      { name: 'Lichess PGN Viewer', platforms: ['Library'], access: 'Free / Open source · GPL', description: 'Embed a navigable PGN game viewer in a content page. Designed for displaying games rather than replacing a full analysis workspace.', links: [{ label: 'Source and documentation', url: 'https://github.com/lichess-org/pgn-viewer' }] },
      { name: 'pgn4web', platforms: ['Library'], access: 'Free / Open source', description: 'Publish replayable PGN games on web pages using a JavaScript board and game-viewing tools.', links: [{ label: 'Project and downloads', url: 'https://sourceforge.net/projects/pgn4web/' }] }
    ]
  }
];
