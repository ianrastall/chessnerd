import { describe, expect, it } from 'vitest';
import { classifyEngineDownload } from './engine-downloads';

describe('engine download filenames', () => {
  it.each([
    ['stockfish-windows-arm64-universal.zip', 'windows', 'arm64'],
    ['stockfish-linux-x86-64-universal.tar.gz', 'linux', 'x86-64'],
    ['stockfish-macos-universal.tar.gz', 'macos', 'universal'],
    ['stockfish-android-armv7-neon.tar.gz', 'android', 'arm32'],
    ['dragontooth-0.1-azazel-FREEBSD-x64-64bit', 'freebsd', 'x86-64'],
    ['stockfish-linux-riscv64-universal.tar.gz', 'linux', 'riscv64'],
    ['daydreamer-2.0.0-pre2-i686-apple-darwin.tar.gz', 'macos', 'x86'],
    ['midnightv9-apple-silicon', 'macos', 'arm64'],
    ['Napoleon-1.8-Winx64-BMI2.zip', 'windows', 'x86-64'],
    ['engine.exe', 'windows', null],
    ['engine-linux-x86_64.tar.gz.sha256', 'other', null],
    ['engine-windows-source.zip', 'other', null],
    ['engine-win-linux.zip', 'other', null],
    ['darwinian-avx2.zip', 'other', null],
    ['engine-x86_64.zip', 'other', 'x86-64'],
  ])('classifies %s', (filename, platform, architecture) => {
    expect(classifyEngineDownload(filename)).toEqual({ platform, architecture });
  });
});
