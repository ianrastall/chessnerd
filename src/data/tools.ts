export type ToolCategory = 'analysis' | 'data' | 'reference';

export const toolCategories: ToolCategory[] = ['analysis', 'data', 'reference'];

export const categoryLabels: Record<ToolCategory, string> = {
  analysis: 'Analysis',
  data: 'Data',
  reference: 'Reference'
};

export const categoryDescriptions: Record<ToolCategory, string> = {
  analysis: 'Interactive chess utilities for boards, PGNs, and engine play.',
  data: 'Downloadable archives, player datasets, and public chess data browsers.',
  reference: 'Chess opening, engine, software, and development references.'
};

export function categoryHref(category: ToolCategory): string {
  return `/categories/${category}.html`;
}

export interface ToolMeta {
  id: string;
  name: string;
  href: string;
  icon: string;
  category: ToolCategory;
  description: string;
  status: 'ready' | 'queued';
  rebuildNote?: string;
  featured?: boolean;
}

export const tools: ToolMeta[] = [
  {
    id: 'board-colors',
    name: 'Board Colors',
    href: '/board-colors.html',
    icon: 'palette',
    category: 'analysis',
    description: 'Tune a dark-square RGB color and generate a complete chessboard palette with exports.',
    status: 'ready',
    featured: true
  },
  {
    id: 'ccc-archive',
    name: 'CCC Archive',
    href: '/ccc-archive.html',
    icon: 'folder_zip',
    category: 'data',
    description: 'Computer Chess Championship event PGNs with dates and direct ZIP links.',
    status: 'queued',
    rebuildNote: 'Needs the external CCC archive workflow mapped before it should be treated as rebuilt.'
  },
  {
    id: 'chesscom-api',
    name: 'Chess.com API',
    href: '/chesscom-api',
    icon: 'api',
    category: 'data',
    description: 'Formatted reference for the Chess.com published-data API documentation.',
    status: 'ready',
  },
  {
    id: 'titled-players',
    name: 'Chess.com Titled Players',
    href: '/titled-players',
    icon: 'groups',
    category: 'data',
    description: 'Browse titled Chess.com accounts — filter by title, rating, country, and status.',
    status: 'ready',
  },
  {
    id: 'eco-code',
    name: 'ECO Codes',
    href: '/eco-code.html',
    icon: 'menu_book',
    category: 'reference',
    description: 'Search Encyclopedia of Chess Openings codes and named lines, with a board diagram for every opening.',
    status: 'ready'
  },
  {
    id: 'engines',
    name: 'Engine Releases',
    href: '/engines.html',
    icon: 'new_releases',
    category: 'reference',
    description: 'A daily feed of the latest releases from open-source chess engines on GitHub, newest first.',
    status: 'ready'
  },
  {
    id: 'play-engine',
    name: 'Engine Game',
    href: '/play-engine.html',
    icon: 'smart_toy',
    category: 'analysis',
    description: 'Play a browser chess game against the bundled Lozza engine.',
    status: 'ready',
    featured: true
  },
  {
    id: 'fide-2200',
    name: 'FIDE 2200+ Players',
    href: '/fide-2200.html',
    icon: 'groups',
    category: 'data',
    description: 'Filter FIDE-rated players whose standard, rapid, or blitz rating is at least 2200.',
    status: 'queued',
    rebuildNote: 'Large generated dataset; needs an update workflow and source note before ready.'
  },
  {
    id: 'pgn-downloads',
    name: 'PGN Downloads',
    href: '/pgn-downloads.html',
    icon: 'cloud_download',
    category: 'data',
    description: 'Download master games, tournament files, and opening libraries in PGN format.',
    status: 'ready'
  },
  {
    id: 'pgn-info',
    name: 'PGN Info',
    href: '/pgn-info.html',
    icon: 'assessment',
    category: 'analysis',
    description: 'Analyze an uploaded PGN file to summarize tags, players, openings, and results.',
    status: 'ready',
    featured: true
  },
  {
    id: 'software',
    name: 'Software Catalog',
    href: '/software.html',
    icon: 'inventory_2',
    category: 'reference',
    description: 'My PGN tools, plus the essential chess databases, analysis suites, and engine tools players rely on.',
    status: 'ready'
  },
  {
    id: 'stockfish-commits',
    name: 'Stockfish Commits',
    href: '/stockfish-commits.html',
    icon: 'history',
    category: 'reference',
    description: 'Browse Stockfish commits, source snapshots, authors, dates, and messages.',
    status: 'ready'
  },
  {
    id: 'titled-tuesday-archive',
    name: 'Titled Tuesday Archive',
    href: '/titled-tuesday-archive.html',
    icon: 'event',
    category: 'data',
    description: 'Organized Chess.com Titled Tuesday event downloads.',
    status: 'queued',
    rebuildNote: 'Needs the separate archive repo workflow mapped before rebuild.'
  },
  {
    id: 'tournaments',
    name: 'Tournament Archive',
    href: '/tournaments.html',
    icon: 'emoji_events',
    category: 'data',
    description: 'Curated tournament PGNs with calculated FIDE categories.',
    status: 'queued',
    rebuildNote: 'Generated from event metadata and PGN files; needs source/update docs.'
  }
];

export const readyTools = tools.filter((tool) => tool.status === 'ready');
export const queuedTools = tools.filter((tool) => tool.status === 'queued');
