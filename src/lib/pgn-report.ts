export interface PgnAnalysis {
  games: number;
  whiteWins: number;
  blackWins: number;
  draws: number;
  otherResults: number;
  inProgress: number;
  annotated: number;
  withNags: number;
  withComments: number;
  gamesWithEco: number;
  totalBytes: number;
  players: string[];
  events: string[];
  uniqueEcoCodes: number;
}

const resultMarker = /^(?:1-0|0-1|1\/2-1\/2|\*)$/;
const move = /^(?:[KQRBN]?[a-h1-8]{0,2}x?[a-h][1-8](?:=?[QRBN])?|[O0]-[O0](?:-[O0])?|--)[+#]?[!?]{0,2}$/;

export function analyzePgn(text: string): PgnAnalysis {
  const stats: PgnAnalysis = {
    games: 0, whiteWins: 0, blackWins: 0, draws: 0, otherResults: 0, inProgress: 0,
    annotated: 0, withNags: 0, withComments: 0, gamesWithEco: 0,
    totalBytes: new Blob([text]).size, players: [], events: [], uniqueEcoCodes: 0,
  };
  const players = new Set<string>();
  const events = new Set<string>();
  const ecoCodes = new Set<string>();
  const tags = new Map<string, string>();
  let hasMoves = false;
  let result = '';
  let hasComment = false;
  let hasNag = false;
  let hasSymbol = false;
  let variationDepth = 0;

  function finishGame() {
    if (tags.size === 0 && !hasMoves) return;
    stats.games += 1;
    for (const name of ['white', 'black']) {
      const player = tags.get(name);
      if (player && player !== '?') players.add(player);
    }
    const event = tags.get('event');
    if (event && event !== '?') events.add(event);
    const eco = tags.get('eco')?.toUpperCase();
    if (eco && /^[A-E]\d{2}$/.test(eco)) {
      stats.gamesWithEco += 1;
      ecoCodes.add(eco);
    }
    switch (tags.get('result') || result) {
      case '1-0': stats.whiteWins += 1; break;
      case '0-1': stats.blackWins += 1; break;
      case '1/2-1/2': stats.draws += 1; break;
      case '*': stats.inProgress += 1; break;
      default: stats.otherResults += 1;
    }
    if (hasComment) stats.withComments += 1;
    if (hasNag) stats.withNags += 1;
    if (hasSymbol) stats.annotated += 1;
    tags.clear();
    hasMoves = hasComment = hasNag = hasSymbol = false;
    result = '';
  }

  // Consume comments and quoted tag values as whole tokens before looking for moves or results.
  const tokens = /^%[^\r\n]*|\[\s*([A-Za-z0-9_]+)\s+"((?:\\.|[^"\\\r\n])*)"\s*\]|\{[^}]*\}|;[^\r\n]*|[()]|\$\d+|[^\s\[\](){};$]+/gm;
  for (const [token, tag, value] of text.matchAll(tokens)) {
    if (token.startsWith('%')) continue;
    if (token.startsWith('{') || token.startsWith(';')) {
      hasComment = true;
    } else if (token === '(') {
      variationDepth += 1;
    } else if (token === ')') {
      variationDepth = Math.max(0, variationDepth - 1);
    } else if (tag && variationDepth === 0) {
      const key = tag.toLowerCase();
      if (hasMoves || result || (key === 'event' && tags.has(key))) finishGame();
      tags.set(key, value.replace(/\\(["\\])/g, '$1').trim());
    } else if (token.startsWith('$')) {
      hasNag = true;
    } else {
      const san = token.replace(/^\d+\.+/, '');
      if (variationDepth === 0 && resultMarker.test(san)) {
        result = san;
      } else if (move.test(san)) {
        if (variationDepth === 0) {
          if (result) finishGame();
          hasMoves = true;
        }
        if (/[!?]$/.test(san)) hasSymbol = true;
      } else if (/^[!?]{1,2}$/.test(san)) {
        hasSymbol = true;
      }
    }
  }
  finishGame();

  stats.players = [...players].sort((a, b) => a.localeCompare(b));
  stats.events = [...events].sort((a, b) => a.localeCompare(b));
  stats.uniqueEcoCodes = ecoCodes.size;
  return stats;
}
