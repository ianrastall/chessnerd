import { describe, expect, it } from 'vitest';
import { analyzePgn } from './pgn-report';

describe('PGN report', () => {
  it('reads escaped tags, separates games without Event tags, and counts annotations', () => {
    const stats = analyzePgn(String.raw`[Event "Club \"Rapid\""]
[White "Alice"]
[Black "Bob"]
[ECO "b80"]
[Result "1-0"]

1.e4! { [Event "Fake event"] } (1.d4 $2 (1.c4?) 0-1) e5 1-0

[White "Carol"]
[Black "?"]
[ECO "C20"]

1. d4 d5 1/2-1/2`);
    expect(stats).toMatchObject({
      games: 2, whiteWins: 1, blackWins: 0, draws: 1, otherResults: 0,
      annotated: 1, withNags: 1, withComments: 1, gamesWithEco: 2, uniqueEcoCodes: 2,
      players: ['Alice', 'Bob', 'Carol'], events: ['Club "Rapid"'],
    });
  });

  it('ignores result and annotation text inside comments and counts games without tags', () => {
    const stats = analyzePgn('1. e4 { 0-1 $8 ! } e5 *\n1.d4 ; $9 ?\n d5 1-0\n1.c4');
    expect(stats).toMatchObject({
      games: 3, whiteWins: 1, inProgress: 1, otherResults: 1, withComments: 2,
      withNags: 0, annotated: 0,
    });
    expect(analyzePgn('{ [White "Alice"] e4! 1-0 }').games).toBe(0);
  });
});
