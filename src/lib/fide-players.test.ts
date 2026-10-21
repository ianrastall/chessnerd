import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import {
  dateToYear,
  decodeShard,
  matchNames,
  nameKey,
  parseNameEntries,
  shardFileName,
  shardIndexFor,
  type ListInfo,
  type ShardDirectory
} from './fide-players';

// A small encoder that follows FORMAT.md, so the decoder is tested against the spec
// rather than only against files the same author wrote.
function varint(out: number[], n: number) {
  while (n > 0x7f) {
    out.push((n % 128) | 0x80);
    n = Math.floor(n / 128);
  }
  out.push(n);
}
const zigzag = (n: number) => (n >= 0 ? n * 2 : -n * 2 - 1);
function str(out: number[], s: string) {
  const bytes = Array.from(new TextEncoder().encode(s));
  varint(out, bytes.length);
  out.push(...bytes);
}

const lists: ListInfo[] = [
  { date: '2000-10', type: 'standard' },
  { date: '2001-01', type: 'standard' },
  { date: '2001-04', type: 'standard' },
  { date: '2001-07', type: 'standard' }
];

function record(): number[] {
  const out: number[] = [];
  out.push(2); // F
  varint(out, 1990);
  varint(out, 2); // names
  varint(out, 0); str(out, 'Müller, Anna');
  varint(out, 2); str(out, 'Schmidt, Anna');
  varint(out, 1);
  varint(out, 0); str(out, 'GER');
  varint(out, 2); // titles
  varint(out, 1); str(out, '\x1fWFM\x1f\x1f');
  varint(out, 3); str(out, 'FM\x1fWFM\x1f\x1f');
  varint(out, 1); // one rating type
  out.push(0);
  varint(out, 3); // three lists: 0, 2, 3
  for (const gap of [0, 2, 1]) varint(out, gap);
  let prev = 0;
  for (const rating of [2100, null, 2150]) {
    const v = rating === null ? 0 : rating + 1;
    varint(out, zigzag(v - prev));
    prev = v;
  }
  for (const games of [9, 0, null]) varint(out, games === null ? 0 : games + 1);
  varint(out, 2); // K runs
  varint(out, 11); varint(out, 2);
  varint(out, 21); varint(out, 1);
  varint(out, 2); // flag runs
  str(out, '\x1f'); varint(out, 2);
  str(out, 'wi\x1fInactive players'); varint(out, 1);
  return out;
}

function shard(entries: { id: number; bytes: number[] }[]): ArrayBuffer {
  const head: number[] = [0x46, 0x50, 0x4c, 0x31];
  const u32 = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];
  head.push(...u32(entries.length));
  let offset = 0;
  for (const e of entries) {
    head.push(...u32(e.id), ...u32(offset));
    offset += e.bytes.length;
  }
  const all = [...head, ...entries.flatMap((e) => e.bytes)];
  return new Uint8Array(all).buffer;
}

describe('decodeShard', () => {
  const buffer = shard([
    { id: 100, bytes: [0, 0, 0, 0, 0, 0] },
    { id: 4200, bytes: record() },
    { id: 9000000, bytes: [1, 0, 0, 0, 0, 0] }
  ]);
  const found = decodeShard(buffer, lists).find(4200);

  it('reads the profile fields', () => {
    expect(found).not.toBeNull();
    expect(found!.sex).toBe('F');
    expect(found!.birthYear).toBe(1990);
    expect(found!.names).toEqual([{ from: 0, name: 'Müller, Anna' }, { from: 2, name: 'Schmidt, Anna' }]);
    expect(found!.feds).toEqual([{ from: 0, fed: 'GER' }]);
    expect(found!.titles[1]).toEqual({ from: 3, title: 'FM', wTitle: 'WFM', oTitle: '', foaTitle: '' });
  });

  it('reads a rating series with blanks, runs and flags', () => {
    const s = found!.series.standard!;
    expect(s.date).toEqual(['2000-10', '2001-04', '2001-07']);
    expect(s.rating).toEqual([2100, null, 2150]);
    expect(s.games).toEqual([9, 0, null]);
    expect(s.k).toEqual([10, 10, 20]);
    expect(s.flag).toEqual([null, null, 'wi']);
    expect(s.section).toEqual([null, null, 'Inactive players']);
  });

  it('returns null for an absent id and rejects other files', () => {
    expect(decodeShard(buffer, lists).find(5)).toBeNull();
    expect(() => decodeShard(new Uint8Array([1, 2, 3, 4, 0, 0, 0, 0]).buffer, lists)).toThrow();
  });
});

describe('directory helpers', () => {
  const dir = { shards: [[1, 1000, 1], [20000, 1000, 1], [900000, 5, 1]] } as ShardDirectory;
  it('finds the shard whose range holds an id', () => {
    expect(shardIndexFor(dir, 0)).toBe(-1);
    expect(shardIndexFor(dir, 1)).toBe(0);
    expect(shardIndexFor(dir, 19999)).toBe(0);
    expect(shardIndexFor(dir, 20000)).toBe(1);
    expect(shardIndexFor(dir, 5_000_000)).toBe(2);
    expect(shardFileName(7)).toBe('shard-0007.bin');
  });

  it('keys names like the builder', () => {
    expect(nameKey('Carlsen, Magnus')).toBe('ca');
    expect(nameKey('Đurić, Marko')).toBe('ur');
    expect(nameKey("O'Brien, Pat")).toBe('ob');
    expect(nameKey('李, 明')).toBe('__');
  });

  it('turns list dates into years', () => {
    expect(dateToYear('2024-07')).toBeCloseTo(2024.5417, 3);
    expect(dateToYear('1969')).toBe(1969.5);
    expect(Number.isNaN(dateToYear('x'))).toBe(true);
  });
});

describe('name search', () => {
  const entries = parseNameEntries([
    [1503014, 'Carlsen, Magnus', 'NOR', 'GM', 2882, '2026-10', 1990],
    [2, 'Carlsen, Ole', 'DEN', '', 1800, '2010-01', 1960],
    [3, 'Magnusson, Carl', 'SWE', 'IM', 2400, '2020-01', 1980]
  ]);
  it('requires every word and puts prefix matches first', () => {
    expect(matchNames(entries, 'carlsen magn').rows.map((r) => r.id)).toEqual([1503014]);
    expect(matchNames(entries, 'carl').rows.map((r) => r.id)).toEqual([1503014, 2, 3]);
    expect(matchNames(entries, '   ').total).toBe(0);
  });
  it('rejects malformed index rows', () => {
    expect(() => parseNameEntries([[1, 'x']])).toThrow();
  });
});

// Runs against the real build when it is on this machine; skipped elsewhere.
const real = 'D:/dev/proj/fide-players/players';
describe.skipIf(!existsSync(`${real}/shards.json`))('real shards', () => {
  it('decodes Magnus Carlsen', () => {
    const dir = JSON.parse(readFileSync(`${real}/shards.json`, 'utf8')) as ShardDirectory;
    const i = shardIndexFor(dir, 1503014);
    const file = readFileSync(`${real}/${shardFileName(i)}`);
    const player = decodeShard(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer, dir.lists).find(1503014);
    expect(player?.names.at(-1)?.name).toBe('Carlsen, Magnus');
    expect(player?.feds.at(-1)?.fed).toBe('NOR');
    expect(Math.max(...(player?.series.standard?.rating ?? []).map((r) => r ?? 0))).toBe(2882);
  });
});
