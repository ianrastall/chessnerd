import { recordArchiveSource } from './lib/archive-provenance.ts';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { parseEventBundles, parseEventsManifest } from '../src/lib/events-archive.ts';

async function writeIfChanged(destination: URL, value: unknown): Promise<boolean> {
  const content = `${JSON.stringify(value, null, 2)}\n`;
  try {
    if (await readFile(destination, 'utf8') === content) return false;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  await mkdir(new URL('.', destination), { recursive: true });
  const temporary = new URL(`${destination.href}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, content);
    await rename(temporary, destination);
  } finally {
    await rm(temporary, { force: true });
  }
  return true;
}

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

// Both inputs must validate before either local snapshot is replaced.
const bundlesSource = `https://raw.githubusercontent.com/ianrastall/cc-events-archive/${revision}/cc_events_bundles.json`;
const bundlesResponse = await fetch(bundlesSource, { signal: AbortSignal.timeout(30_000) });
if (!bundlesResponse.ok) throw new Error(`cc-events bundles request failed: HTTP ${bundlesResponse.status}`);
const bundles = parseEventBundles(await bundlesResponse.json());
const bundlesDestination = new URL('../public/data/cc-events-archive/bundles.json', import.meta.url);

const manifestChanged = await writeIfChanged(destination, entries);
const bundlesChanged = await writeIfChanged(bundlesDestination, bundles);
await recordArchiveSource('ianrastall/cc-events-archive',revision,source,'data/cc-events-archive/manifest.json',entries.length);

if (manifestChanged) {
  console.log(`Synced ${entries.length} cc-events (${entries.reduce((sum, entry) => sum + entry.games, 0).toLocaleString('en-US')} games).`);
} else {
  console.log(`cc-events archive is unchanged (${entries.length} events).`);
}
console.log(bundlesChanged ? `Synced ${bundles.length} cc-events databases.` : `cc-events databases are unchanged (${bundles.length}).`);
