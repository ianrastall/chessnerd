import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { parseArchiveManifest } from '../src/lib/ccc-archive.ts';

const source = 'https://raw.githubusercontent.com/ianrastall/ccc-archive/main/ccc_manifest.json';
const destination = new URL('../public/data/ccc-archive/manifest.json', import.meta.url);
const response = await fetch(source, { signal: AbortSignal.timeout(30_000) });
if (!response.ok) throw new Error(`CCC manifest request failed: HTTP ${response.status}`);
const entries = parseArchiveManifest(await response.json());
const content = `${JSON.stringify(entries, null, 2)}\n`;
let previous = '';
try {
  previous = await readFile(destination, 'utf8');
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}
if (previous === content) {
  console.log(`CCC archive is unchanged (${entries.length} events).`);
} else {
  await mkdir(new URL('.', destination), { recursive: true });
  const temporary = new URL('manifest.json.tmp', destination);
  await writeFile(temporary, content);
  await rename(temporary, destination);
  console.log(`Synced ${entries.length} CCC events (${entries.reduce((sum, entry) => sum + entry.games, 0).toLocaleString('en-US')} games).`);
}
