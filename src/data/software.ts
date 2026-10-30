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

// Project websites and published Jupiter assets checked 30 October 2026.
// Keep descriptions about supported tasks; release availability is separate.
export const softwareGroups: SoftwareGroup[] = [
  {
    id: 'jupiter', name: 'My software · Jupiter',
    description: 'My current chess programs for Windows 11, including published installers and apps awaiting a public release.',
    items: [
      {
        name: 'Chess Engine Compiler', platforms: ['Windows'], access: 'Free / Open source',
        description: 'Compile Stockfish, Lc0 and other supported engines from selected source versions. Configure CPU targets, follow build logs, download upstream binaries and export build scripts.',
        availability: 'Windows x64 installer available.',
        links: [
          { label: 'Windows installer', url: 'https://github.com/ianrastall/chess-engine-compiler/releases/download/v0.6.0/ChessEngineCompiler-0.6.0-win-x64-setup.exe' },
          { label: 'Releases', url: 'https://github.com/ianrastall/chess-engine-compiler/releases' },
          { label: 'Source', url: 'https://github.com/ianrastall/chess-engine-compiler' }
        ]
      },
      {
        name: 'Lichess Puzzles', platforms: ['Windows'], access: 'Free / Open source',
        description: 'Import the Lichess puzzle database and solve puzzles offline. Filter by rating, theme or opening; keep player ratings and attempt history; export selected positions.',
        availability: 'Windows x64 installer available. Download the puzzle database separately.',
        links: [
          { label: 'Windows installer', url: 'https://github.com/ianrastall/lichess-puzzles/releases/download/3.1.0/LichessPuzzles-3.1.0-win-x64-setup.exe' },
          { label: 'Releases', url: 'https://github.com/ianrastall/lichess-puzzles/releases' },
          { label: 'Source', url: 'https://github.com/ianrastall/lichess-puzzles' }
        ]
      },
      {
        name: 'Chess.com Crawler', platforms: ['Windows'], access: 'Free / Open source',
        description: 'Collect Chess.com games into monthly PGN files by rating floor and time control. Optional local FIDE matching supplies real names and standard ratings. Runs in the notification area.',
        availability: 'Source available. The Jupiter installer has not been published; the existing public release contains a portable build.',
        links: [{ label: 'Source and instructions', url: 'https://github.com/ianrastall/chesscom-crawler' }]
      },
      {
        name: 'Boardroom', platforms: ['Windows'], access: 'Public release pending',
        description: 'Play offline against Maia-2 human-style models or another person at the same computer. Choose a rating population, use premoves and takebacks, and export the game as PGN.',
        availability: 'The Jupiter version is not yet published.', links: []
      },
      {
        name: 'EditPGN', platforms: ['Windows'], access: 'Public release pending',
        description: 'Browse large PGN files with a background game index. Filter games by tag text, edit source and game headers, and follow the current move or variation on a board.',
        availability: 'An early Jupiter editor; no public download yet.', links: []
      },
      {
        name: 'Tour Breaker', platforms: ['Windows'], access: 'Public release pending',
        description: 'Extract complete tournaments from PGN files using rating, variant, time-control and checkmate conditions. Can recover missing classical ratings from a local FIDE archive and writes an exclusion report.',
        availability: 'No public download yet.', links: []
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
      { name: 'En Croissant', platforms: ['Windows', 'macOS', 'Linux'], access: 'Free / Open source', description: 'Import personal games from Lichess and Chess.com, manage databases and engines, and review engine analysis reports.', links: [{ label: 'Website', url: 'https://encroissant.org/' }] },
      { name: 'HIARCS Chess Explorer', platforms: ['Windows', 'macOS'], access: 'Commercial', description: 'Combine PGN databases, opening preparation, engine analysis and adjustable-strength computer opponents. Features depend on edition.', links: [{ label: 'Website', url: 'https://www.hiarcs.com/chess-explorer.html' }] }
    ]
  },
  {
    id: 'interfaces', name: 'Engine interfaces & testing', description: 'Run engines for analysis, game play, matches and automated tournaments.',
    items: [
      { name: 'Cute Chess', platforms: ['Windows', 'macOS', 'Linux'], access: 'Free / Open source', description: 'Run engine matches and tournaments through a graphical interface or automate testing with cutechess-cli.', links: [{ label: 'Website', url: 'https://cutechess.com/' }, { label: 'Source and releases', url: 'https://github.com/cutechess/cutechess' }] },
      { name: 'Arena', platforms: ['Windows', 'Linux'], access: 'Freeware', description: 'Load UCI and WinBoard engines for analysis, computer opponents and engine tournaments.', links: [{ label: 'Website', url: 'https://www.playwitharena.de/' }] },
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
      { name: 'Chess Tempo', platforms: ['Web'], access: 'Free + paid features', description: 'Train tactics and endgames, maintain an opening repertoire with spaced repetition and search a game database. Training features and limits depend on membership.', links: [{ label: 'Website', url: 'https://chesstempo.com/' }] },
      { name: 'Listudy', platforms: ['Web'], access: 'Free / Open source', description: 'Practise opening repertoires with spaced repetition, solve tactics and train endgames against Stockfish.', links: [{ label: 'Website', url: 'https://listudy.org/' }] },
      { name: 'Chessable', platforms: ['Web'], access: 'Free + paid courses', description: 'Study chess courses and review their variations with the MoveTrainer spaced-repetition system. An account is required.', links: [{ label: 'Website', url: 'https://www.chessable.com/' }, { label: 'MoveTrainer documentation', url: 'https://support.chess.com/en/articles/10319322-how-does-the-spaced-repetition-scheduling-work' }] }
    ]
  },
  {
    id: 'pgn', name: 'PGN utilities & image recognition', description: 'Filter game files and convert diagrams or scoresheets into usable chess data.',
    items: [
      { name: 'pgn-extract', platforms: ['Windows', 'macOS', 'Linux'], access: 'Free / Open source', description: 'Search, filter, deduplicate and reformat PGN files from the command line. Selection criteria include headers, move sequences, positions and material.', links: [{ label: 'Website and downloads', url: 'https://www.cs.kent.ac.uk/people/staff/djb/pgn-extract/' }] },
      { name: 'ScanChess', platforms: ['Web'], access: 'Free tools + paid scanning', description: 'Convert board images to FEN and handwritten scoresheets to PGN, with review before export. Scanning uses account credits; browser PGN and FEN utilities are also available.', links: [{ label: 'Website', url: 'https://scanchess.com/' }] },
      { name: 'Chessvision.ai', platforms: ['Web'], access: 'Free + paid products', description: 'Recognise chess diagrams using a browser extension, and analyse positions from images, electronic books and videos. Availability and charges vary by product.', links: [{ label: 'Website', url: 'https://chessvision.ai/' }] }
    ]
  },
  {
    id: 'engines', name: 'Chess engines & human-style models', description: 'Analysis engines and models to use with a compatible interface. See Engine releases for a larger engine list.',
    items: [
      { name: 'Stockfish', platforms: ['Windows', 'macOS', 'Linux'], access: 'Free / Open source', description: 'A UCI chess engine for CPU-based analysis and game play. Choose a build compatible with your processor and load it in an engine interface.', links: [{ label: 'Website', url: 'https://stockfishchess.org/' }] },
      { name: 'Leela Chess Zero (Lc0)', platforms: ['Windows', 'macOS', 'Linux'], access: 'Free / Open source', description: 'A neural-network chess engine with several hardware backends. Requires a compatible network and an interface; backend choice depends on your CPU or GPU.', links: [{ label: 'Website', url: 'https://lczero.org/' }] },
      { name: 'Maia', platforms: ['Web'], access: 'Free online play', description: 'Human-style chess models trained to predict moves by players at different rating levels. The project offers browser play, analysis and training tools.', links: [{ label: 'Website', url: 'https://www.maiachess.com/' }] },
      { name: 'Fairy-Stockfish', platforms: ['Windows', 'macOS', 'Linux'], access: 'Free / Open source', description: 'A Stockfish-derived engine for chess variants, including user-defined rules through configuration files. Requires a compatible variant interface.', links: [{ label: 'Website', url: 'https://fairy-stockfish.github.io/' }] }
    ]
  },
  {
    id: 'tournaments', name: 'Tournament administration', description: 'Register players, make pairings and publish standings.',
    items: [
      { name: 'Swiss-Manager', platforms: ['Windows'], access: 'Commercial', description: 'Administer individual and team tournaments using Swiss or round-robin pairings, with results and standings publication.', links: [{ label: 'Website', url: 'https://swiss-manager.at/' }] },
      { name: 'Vega', platforms: ['Windows', 'macOS', 'Linux'], access: 'Free + licensed editions', description: 'Manage tournament entries, pairings, results and cross tables. Platform, event-size and licensing limits differ between editions.', links: [{ label: 'Website', url: 'https://www.vegachess.com/' }] }
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
