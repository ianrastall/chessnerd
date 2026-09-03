import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { parseBulletBrawlManifest } from '../src/lib/bullet-brawl-archive.ts';

// Resolve main first: raw.githubusercontent.com can cache the previous branch
// contents for several minutes after an archive push. Commit URLs are immutable.
const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
const refResponse = await fetch('https://api.github.com/repos/ianrastall/bullet-brawl-archive/git/ref/heads/main', {
  headers,
  cache: 'no-store',
  signal: AbortSignal.timeout(30_000)
});
if (!refResponse.ok) throw new Error(`Bullet Brawl revision request failed: HTTP ${refResponse.status}`);
const ref = await refResponse.json();
const revision = ref.object?.sha;
if (ref.object?.type !== 'commit' || typeof revision !== 'string' || !/^[a-f0-9]{40}$/.test(revision)) {
  throw new Error('GitHub did not return a valid Bullet Brawl archive revision.');
}
const source = `https://raw.githubusercontent.com/ianrastall/bullet-brawl-archive/${revision}/bb_manifest.json`;
const destination = new URL('../public/data/bullet-brawl-archive/manifest.json', import.meta.url);
const response = await fetch(source, { signal: AbortSignal.timeout(30_000) });
if (!response.ok) throw new Error(`Bullet Brawl manifest request failed: HTTP ${response.status}`);
const entries = parseBulletBrawlManifest(await response.json());
const content = `${JSON.stringify(entries, null, 2)}\n`;
let previous = '';
try {
  previous = await readFile(destination, 'utf8');
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}
if (previous === content) {
  console.log(`Bullet Brawl archive is unchanged (${entries.length} events).`);
} else {
  await mkdir(new URL('.', destination), { recursive: true });
  const temporary = new URL('manifest.json.tmp', destination);
  await writeFile(temporary, content);
  await rename(temporary, destination);
  console.log(`Synced ${entries.length} Bullet Brawl events (${entries.reduce((sum, entry) => sum + entry.games, 0).toLocaleString('en-US')} games).`);
}
