import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { parseEventBundles, parseEventsManifest } from '../src/lib/events-archive.ts';

// Resolve main first: raw.githubusercontent.com can cache the previous branch
// contents for several minutes after an archive push. Commit URLs are immutable.
const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
const refResponse = await fetch('https://api.github.com/repos/ianrastall/cc-events-archive/git/ref/heads/main', {
  headers,
  cache: 'no-store',
  signal: AbortSignal.timeout(30_000)
});
if (!refResponse.ok) throw new Error(`cc-events revision request failed: HTTP ${refResponse.status}`);
const ref = await refResponse.json();
const revision = ref.object?.sha;
if (ref.object?.type !== 'commit' || typeof revision !== 'string' || !/^[a-f0-9]{40}$/.test(revision)) {
  throw new Error('GitHub did not return a valid cc-events archive revision.');
}
const source = `https://raw.githubusercontent.com/ianrastall/cc-events-archive/${revision}/cc_events_manifest.json`;
const destination = new URL('../public/data/cc-events-archive/manifest.json', import.meta.url);
const response = await fetch(source, { signal: AbortSignal.timeout(30_000) });
if (!response.ok) throw new Error(`cc-events manifest request failed: HTTP ${response.status}`);
const entries = parseEventsManifest(await response.json());
const content = `${JSON.stringify(entries, null, 2)}\n`;
let previous = '';
try {
  previous = await readFile(destination, 'utf8');
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}
if (previous === content) {
  console.log(`cc-events archive is unchanged (${entries.length} events).`);
} else {
  await mkdir(new URL('.', destination), { recursive: true });
  const temporary = new URL('manifest.json.tmp', destination);
  await writeFile(temporary, content);
  await rename(temporary, destination);
  console.log(`Synced ${entries.length} cc-events (${entries.reduce((sum, entry) => sum + entry.games, 0).toLocaleString('en-US')} games).`);
}

// The prepared databases (all events, 2600+, 2700+), rebuilt by the archive on every publish.
const bundlesSource = `https://raw.githubusercontent.com/ianrastall/cc-events-archive/${revision}/cc_events_bundles.json`;
const bundlesResponse = await fetch(bundlesSource, { signal: AbortSignal.timeout(30_000) });
if (!bundlesResponse.ok) throw new Error(`cc-events bundles request failed: HTTP ${bundlesResponse.status}`);
const bundles = parseEventBundles(await bundlesResponse.json());
const bundlesDestination = new URL('../public/data/cc-events-archive/bundles.json', import.meta.url);
await writeFile(bundlesDestination, `${JSON.stringify(bundles, null, 2)}\n`);
console.log(`Synced ${bundles.length} cc-events databases.`);
