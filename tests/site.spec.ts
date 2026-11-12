import { test,expect } from '@playwright/test';
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const pages=(await readdir('src/pages')).filter(path=>path.endsWith('.astro')).map(path=>path==='index.astro' ? '/' : '/'+path.replace('.astro','.html'));
test.beforeEach(async({page})=>{await page.route('https://www.googletagmanager.com/**',r=>r.abort());await page.route('https://fonts.googleapis.com/**',r=>r.abort());});
for(const path of [...pages,'/categories/analysis.html','/categories/data.html','/categories/reference.html'])test(`route and responsive shell: ${path}`,async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const response=await page.goto(path);expect(response?.status()).toBe(200);await expect(page.locator('h1')).toBeVisible();
  await expect(page.getByRole('button',{name:'Settings',exact:true})).toBeEnabled();
  await expect(page.locator('.jupiter-sidebar')).toBeVisible();
  for(const width of [1440,1024,768,390,320]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`overflow at ${width}`).toBe(true);}
  expect(errors).toEqual([]);
});
test('archive search, filters, pagination and shareable URLs',async({page})=>{
  await page.goto('/');await expect(page.locator('#archive-count')).toContainText('matching entries');await expect(page.locator('#archive-results tr')).toHaveCount(12);
  const first=await page.locator('#archive-results tr').first().innerText();await page.locator('#archive-next').click();await expect(page.locator('#archive-page')).toContainText('Page 2');expect(await page.locator('#archive-results tr').first().innerText()).not.toBe(first);
  await page.locator('#archive-collection').selectOption('titled-tuesday');await page.locator('#archive-year').selectOption('2026');await page.locator('#archive-query').fill('October');await expect(page.locator('#archive-results')).toContainText('October');
  await expect(page.locator('#archive-results tr')).not.toHaveCount(0);await expect(page.locator('#archive-results tr').first()).toContainText('Titled Tuesday');await expect(page).toHaveURL(/collection=titled-tuesday/);await expect(page).toHaveURL(/q=October/);
  await page.reload();await expect(page.locator('#archive-query')).toHaveValue('October');await expect(page.locator('#archive-results')).toContainText('October');
  await page.locator('#archive-query').fill('no-such-tournament-xyz');await expect(page.locator('#archive-empty')).toBeVisible();
  await page.locator('#archive-clear').click();await expect(page.locator('#archive-results tr')).toHaveCount(12);
  const links=await page.locator('#archive-results .download-link').evaluateAll(els=>els.map(el=>(el as HTMLAnchorElement).href));expect(links.every(url=>/^https:\/\/(github.com|raw.githubusercontent.com)\/ianrastall\//.test(url)&&url.endsWith('.zip'))).toBe(true);
});
test('overview tabs switch panels and restore from the address',async({page})=>{
  await page.goto('/');await expect(page.locator('#games')).toBeVisible();await expect(page.locator('#tools')).toBeHidden();
  await page.getByRole('link',{name:'Use a tool',exact:true}).click();await expect(page.locator('#tools')).toBeVisible();await expect(page.locator('#games')).toBeHidden();await expect(page.getByRole('link',{name:'Use a tool',exact:true})).toHaveAttribute('aria-current','true');
  await page.goBack();await expect(page.locator('#games')).toBeVisible();
  await page.goto('/engines.html');await page.getByRole('link',{name:'Find a player',exact:true}).click();await expect(page.locator('#player-query')).toBeVisible();await expect(page.locator('#games')).toBeHidden();
});
test('homepage is useful without JavaScript',async({browser})=>{
  const context=await browser.newContext({javaScriptEnabled:false});const page=await context.newPage();await page.goto('http://127.0.0.1:4322/');await expect(page.locator('#archive-results tr')).toHaveCount(12);await expect(page.locator('#archive-results .download-link').first()).toHaveAttribute('href',/^https:/);await expect(page.getByRole('navigation',{name:'Pages and tools'})).toBeVisible();await context.close();
});
test('failed search index retains published downloads and can retry',async({page})=>{
  let fail=true;await page.route('**/data/archive-search.json',r=>fail ? r.fulfill({status:503,body:'Unavailable'}) : r.continue());await page.goto('/');await expect(page.locator('#archive-count')).toContainText('could not load');await expect(page.locator('#archive-results tr')).toHaveCount(12);fail=false;await page.locator('#archive-query').fill('Titled Tuesday');await expect(page.locator('#archive-count')).toContainText('matching entries');
});
test('navigation search and mobile disclosure reach specialist pages',async({page})=>{
  await page.goto('/');await page.locator('#navigation-search').fill('developer reference');await expect(page.locator('[data-navigation-item]:visible')).toHaveCount(1);await expect(page.locator('[data-navigation-item]:visible')).toHaveText('Chess.com API');await page.locator('#navigation-search').fill('rating history');await expect(page.locator('[data-navigation-item]:visible')).toHaveCount(1);await page.locator('[data-navigation-item]:visible').click();await expect(page).toHaveURL(/fide-player.html/);
  await page.setViewportSize({width:390,height:900});await page.reload();await expect(page.locator('.site-navigation')).not.toHaveAttribute('open','');await page.locator('.site-navigation summary').click();await expect(page.getByRole('navigation',{name:'Pages and tools'})).toBeVisible();
});
test('Overview tabs stay available on Engine Releases and link back to each task', async ({ page }) => {
  const tabs = page.getByRole('navigation', { name: 'Start a task' });
  const engineReleases = tabs.getByRole('link', { name: 'Engine releases' });
  await page.goto('/');

  for (const [label, fragment] of [['Find games', 'games'], ['Find a player', 'players'], ['Use a tool', 'tools']]) {
    await engineReleases.click();
    await expect(page).toHaveURL('/engines.html');
    await expect(tabs.getByRole('link')).toHaveCount(4);
    await expect(engineReleases).toHaveAttribute('aria-current', 'page');
    await tabs.getByRole('link', { name: label }).click();
    await expect(page).toHaveURL(`/#${fragment}`);
  }

  await page.setViewportSize({ width: 320, height: 768 });
  await engineReleases.click();
  await expect(tabs).toBeInViewport({ ratio: 1 });
});
test('engine downloads use platform and architecture filters with the daily feed shape', async ({ page }) => {
  const upstream = 'https://github.com/example/engine/releases/download/v1/';
  const assets = ['engine-windows-arm64.zip', 'engine-windows-x86-64.zip', 'engine-linux-x86_64.tar.gz',
    'engine-windows-arm64.zip.sha256', 'all-builds.zip'].map(name => ({ name, url: upstream + name, size: 1024, downloads: 0 }));
  await page.route('**/data/engines/engines.json', route => route.fulfill({ json: {
    generated: '2026-11-10T08:41:00Z', source: 'https://github.com', count: 1,
    engines: [{ name: 'Example Engine', repo: 'example/engine', latest_release: {
      tag: 'v1', url: 'https://github.com/example/engine/releases/tag/v1', published_at: '2026-11-09T00:00:00Z', assets,
    } }],
  } }));
  await page.goto('/engines.html');
  const card = page.locator('.engine-card');
  const platform = page.getByLabel('Platform', { exact: true });
  const architecture = page.getByLabel('Architecture', { exact: true });
  await card.getByText('Downloads (5)', { exact: true }).click();
  await expect(card.getByRole('list', { name: 'Windows' }).getByRole('link')).toHaveCount(2);
  await expect(card.getByRole('list', { name: 'Other downloads' }).getByRole('link')).toHaveCount(2);

  await platform.selectOption('windows');
  await architecture.selectOption('arm64');
  const links = card.locator('.engine-downloads a');
  await expect(links).toHaveCount(1);
  await expect(links).toBeVisible();
  await expect(links).toHaveAttribute('href', upstream + 'engine-windows-arm64.zip');
  await expect(card.getByText('ARM64 · 1.0 KB')).toBeVisible();
  await page.setViewportSize({ width: 320, height: 768 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);

  await platform.selectOption('linux');
  await expect(page.getByText('No releases match your search or filters.')).toBeVisible();
  await architecture.selectOption('');
  await expect(links).toHaveAttribute('href', upstream + 'engine-linux-x86_64.tar.gz');
  await platform.selectOption('other');
  await expect(links).toHaveCount(2);
  await page.getByRole('searchbox', { name: 'Search engines' }).fill('different engine');
  await expect(card).toHaveCount(0);
});
test('older engine releases have their own versions, badges and downloads', async ({ page }) => {
  const repo = 'official-stockfish/Stockfish';
  const versions = Array.from({ length: 20 }, (_, index) => {
    const number = index + 1;
    const tag = `v${number}.0.0`;
    const name = number === 1 ? 'stockfish-linux-arm64.tar.gz' : 'stockfish-windows-x86-64.zip';
    return { tag, url: `https://github.com/${repo}/releases/tag/${tag}`,
      published_at: new Date(Date.UTC(2026, 0, number)).toISOString(), prerelease: number === 1,
      assets: [{ name, url: `https://github.com/${repo}/releases/download/${tag}/${name}`, size: 1024 }] };
  });
  await page.route('**/data/engines/engines.json', route => route.fulfill({ json: {
    generated: '2026-11-12T08:41:00Z', engines: [
      { name: 'Stockfish', repo, language: 'C++', latest_release: versions.at(-1) },
      { name: 'Stockfish alias', repo: repo.toLowerCase(), latest_release: versions.at(-1) },
    ],
  } }));
  await page.route('**/data/engines/release-history.json', route => route.fulfill({ json: { releases: { [repo]: versions } } }));
  await page.route('https://raw.githubusercontent.com/**/icon_128x128.png', route => route.abort());
  await page.goto('/engines.html');
  const cards = page.locator('.engine-card');
  await expect(page.locator('#enginesStatus')).toHaveText('20 releases · Page 1 of 2');
  await expect(cards).toHaveCount(18);
  const newest = cards.first();
  await expect(newest.getByRole('link', { name: 'v20.0.0' })).toHaveAttribute('href', versions[19].url);
  await expect(newest.getByRole('link', { name: 'Release', exact: true })).toHaveCount(0);
  await expect(newest.getByText('UCI', { exact: true })).toBeVisible();
  await expect(newest.locator('.engine-tag img[src$="/windows11.svg"]')).toBeVisible();
  await expect(newest.locator('.engine-tag img[src$="/cplusplus.svg"]')).toBeVisible();
  await expect(newest.locator('.engine-logo .material-icons')).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.locator('#enginesStatus')).toHaveText('20 releases · Page 2 of 2');
  await expect(cards).toHaveCount(2);
  await page.getByLabel('Platform', { exact: true }).selectOption('linux');
  await expect(cards).toHaveCount(1);
  await expect(cards.getByRole('link', { name: 'v1.0.0' })).toHaveAttribute('href', versions[0].url);
  await expect(cards.getByText('Prerelease', { exact: true })).toBeVisible();
  await expect(cards.getByRole('link', { name: 'stockfish-linux-arm64.tar.gz' })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 768 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});
test('appearance follows family controls and resets migrated preferences',async({page})=>{
  await page.addInitScript(()=>{if(!localStorage.getItem('migration-test')){localStorage.setItem('accentColor','#663399');localStorage.setItem('theme','light');localStorage.setItem('migration-test','1');}});
  await page.goto('/');await page.getByRole('button',{name:'Settings',exact:true}).click();await expect(page.locator('#theme-choice')).toHaveValue('light');await expect(page.locator('#accent-picker')).toHaveValue('#663399');
  await page.locator('#accent-reset').click();await expect(page.locator('input[name="accent-mode"][value="system"]')).toBeChecked();await page.keyboard.press('Escape');await page.reload();await page.getByRole('button',{name:'Settings',exact:true}).click();await expect(page.locator('input[name="accent-mode"][value="system"]')).toBeChecked();
  await page.locator('input[name="accent-mode"][value="custom"]').check();await page.locator('#accent-picker').fill('#dd3300');await page.locator('#theme-choice').selectOption('dark');await page.keyboard.press('Escape');await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');expect(await page.evaluate(()=>localStorage.getItem('chessnerd-accent'))).toBe('#dd3300');
  await page.emulateMedia({forcedColors:'active'});await expect(page.locator('h1')).toBeVisible();
});
test('homepage player lookup passes surname through to the profile search',async({page})=>{
  await page.route('https://ianrastall.github.io/fide-players/names/**',r=>r.fulfill({status:404}));await page.goto('/');await expect(page.locator('#player-query')).toBeHidden();await page.getByRole('link',{name:'Find a player',exact:true}).click();await expect(page).toHaveURL(/#players$/);await expect(page.locator('#games')).toBeHidden();await page.locator('#player-query').fill('Carlsen');await page.getByRole('button',{name:'Find player',exact:true}).click();await expect(page).toHaveURL(/fide-player.html\?q=Carlsen/);await expect(page.locator('#fpSearch')).toHaveValue('Carlsen');await expect(page.locator('#fpStatus')).toContainText('No players match');
});
test('PGN Info reports results and lets readers switch views and copy them', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.setViewportSize({ width: 320, height: 768 });
  await page.goto('/pgn-info.html');
  const pgn = '[Event "Club Night"]\n[White "Alice"]\n[Black "Bob"]\n[Result "1-0"]\n\n1. e4! e5 1-0';
  await page.getByLabel('Choose a PGN file (up to 50 MB)').setInputFiles({
    name: 'game.pgn', mimeType: 'text/plain', buffer: Buffer.from(pgn),
  });
  await expect(page.getByRole('status')).toContainText('File selected');
  await expect(page.getByLabel('PGN text')).toHaveValue('');
  await page.getByRole('button', { name: 'Analyze', exact: true }).click();
  const report = page.locator('#pgnReport');
  await expect(report.getByText('Total games', { exact: true })).toBeVisible();
  await expect(report.locator('.pgn-metrics > div').filter({ hasText: 'Games with symbols' })).toContainText('1 (100.0%)');
  await page.getByRole('button', { name: 'Players', exact: true }).click();
  await expect(report.getByRole('listitem')).toHaveText(['Alice', 'Bob']);
  await page.getByRole('button', { name: 'Events', exact: true }).click();
  await expect(report.getByRole('listitem')).toHaveText(['Club Night']);
  await page.getByRole('button', { name: 'Summary', exact: true }).click();
  await page.getByRole('button', { name: 'Copy report', exact: true }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain('Total games: 1');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(page.getByLabel('PGN text')).toHaveValue('');
  await expect(report).toHaveText('Results appear here after analysis.');
  await page.getByLabel('PGN text').fill('1. d4 d5 1/2-1/2');
  await page.getByRole('button', { name: 'Analyze', exact: true }).click();
  await expect(report.locator('.pgn-metrics > div').filter({ hasText: 'Draws' })).toContainText('1 (100.0%)');
});
test('opening explorer pages through results and keeps ECO filters keyboard accessible', async ({ page }) => {
  await page.goto('/eco-code.html');
  await expect(page.getByRole('heading', { name: 'Opening Explorer', exact: true })).toBeVisible();
  const rows = page.locator('.eco-row-header');
  await expect(rows).toHaveCount(50);
  const first = await rows.first().innerText();
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.locator('#ecoStatus')).toContainText('Page 2');
  await expect(rows.first()).not.toHaveText(first, { useInnerText: true });
  await page.getByRole('button', { name: 'Previous page' }).click();
  await expect(rows.first()).toHaveText(first, { useInnerText: true });

  await page.getByText('Browse by ECO code', { exact: true }).click();
  const letter = page.getByRole('button', { name: 'B', exact: true });
  await letter.press('Enter');
  await expect(letter).toBeFocused();
  await expect(letter).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'B9', exact: true }).click();
  await page.getByRole('button', { name: 'B90', exact: true }).click();
  await expect(page.locator('.eco-badge').first()).toHaveText('B90');
  await expect(page.locator('.eco-badge').last()).toHaveText('B90');
});

test('opening explorer replays moves and copies the displayed position', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.setViewportSize({ width: 320, height: 768 });
  await page.goto('/eco-code.html');
  await page.getByRole('searchbox', { name: 'Opening name or ECO code' }).fill('Najdorf B90');
  const row = page.locator('.eco-row-header').first();
  await expect(row).toContainText('Najdorf');
  await row.press('Enter');
  await expect(row).toBeFocused();
  await expect(row).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.eco-board .square')).toHaveCount(64);
  await expect(page.locator('.eco-board')).toHaveCSS('touch-action', 'auto');
  const controls = page.getByRole('group', { name: 'Opening moves' });
  await expect(controls.getByRole('button', { name: 'Next move' })).toBeDisabled();
  await controls.getByRole('button', { name: 'Start' }).click();
  await expect(page.locator('.eco-position')).toContainText('Starting position');
  await expect(page.locator('.eco-board [data-square="e2"] [data-piece="wP"]')).toHaveCount(1);
  await controls.getByRole('button', { name: 'Next move' }).click();
  await expect(page.locator('.eco-position')).toContainText('1. e4');
  await expect(page.locator('.eco-board [data-square="e4"].highlight [data-piece="wP"]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Copy FEN' }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain('/4P3/');
  await controls.getByRole('button', { name: 'Previous move' }).click();
  await expect(page.locator('.eco-position')).toContainText('Starting position');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});
test('archive series deep links and keyboard tabs remain usable',async({page})=>{
  await page.goto('/chesscom-tournaments.html#three-zero-thursday');const tab=page.getByRole('tab',{name:'3-0 Thursday',exact:true});await expect(tab).toHaveAttribute('aria-selected','true');await expect(page.locator('#t3TableBody tr').first()).toBeVisible();await tab.focus();await page.keyboard.press('ArrowRight');await expect(page.getByRole('tab',{name:'CCC',exact:true})).toHaveAttribute('aria-selected','true');
});

test('engine board accepts a legal opening move',async({page})=>{
  await page.goto('/play-engine.html');await expect(page.locator('#chessBoard .square')).toHaveCount(64);
  await expect(page.locator('#engineStatus')).toHaveText('Lozza ready');
  await page.locator('#moveTime').fill('200');await page.locator('#moveTime').dispatchEvent('input');
  await page.locator('#chessBoard [data-coord="e2"]').click();await page.locator('#chessBoard [data-coord="e4"]').click();await expect(page.locator('#pgnText')).toHaveValue(/e4/);
  await expect(page.locator('#moveStats')).toHaveText('2 moves');
});

test('engine board fits viewport height and fullscreen preserves the game',async({page})=>{
  await page.goto('/play-engine.html');
  const board=page.locator('#chessBoard');
  for(const viewport of [{width:1440,height:900},{width:1366,height:768},{width:1024,height:768},{width:390,height:844},{width:320,height:568}]) {
    await page.setViewportSize(viewport);
    await expect.poll(async()=>{
      const rect=await board.boundingBox();
      return !!rect && Math.abs(rect.width-rect.height)<2 && rect.height<viewport.height && (viewport.width<1100 || rect.y+rect.height<=viewport.height);
    },{message:`board fits ${viewport.width}×${viewport.height}`}).toBe(true);
  }
  await page.setViewportSize({width:1366,height:768});
  await expect(page.locator('#engineStatus')).toHaveText('Lozza ready');
  await page.locator('#chessBoard [data-coord="e2"]').click();
  await page.locator('#chessBoard [data-coord="e4"]').click();
  const button=page.locator('#fullscreenBtn');
  await button.click();
  await expect(button).toHaveText('Exit fullscreen');
  await expect(button).toHaveAttribute('aria-pressed','true');
  expect(await page.evaluate(()=>document.fullscreenElement?.id)).toBe('toolView');
  await expect.poll(async()=>{const rect=await board.boundingBox();return !!rect && rect.y+rect.height<=768;}).toBe(true);
  await expect(page.locator('#pgnText')).toHaveValue(/e4/);
  await expect(page.locator('#flipBoardBtn')).toBeVisible();
  await expect(page.locator('#moveStats')).toHaveText('2 moves');
  const from=await page.locator('#chessBoard [data-coord="g1"]').boundingBox();
  const to=await page.locator('#chessBoard [data-coord="f3"]').boundingBox();
  await page.mouse.move(from!.x+from!.width/2,from!.y+from!.height/2);
  await page.mouse.down();
  await page.mouse.move(to!.x+to!.width/2,to!.y+to!.height/2,{steps:5});
  await expect(page.locator('#toolView .drag-ghost')).toBeVisible();
  await page.mouse.up();
  await expect(page.locator('#pgnText')).toHaveValue(/Nf3/);
  await button.click();
  await expect(button).toHaveText('Fullscreen');
  await expect(button).toHaveAttribute('aria-pressed','false');
  expect(await page.evaluate(()=>document.fullscreenElement)).toBeNull();
});

test('fullscreen fallback supports phone resizing and Escape',async({page})=>{
  await page.addInitScript(()=>Object.defineProperty(document,'fullscreenEnabled',{get:()=>false}));
  await page.setViewportSize({width:390,height:844});
  await page.goto('/play-engine.html');
  await page.locator('#fullscreenBtn').click();
  await expect(page.locator('#toolView')).toHaveClass(/is-fullscreen/);
  for(const viewport of [{width:390,height:844},{width:844,height:390}]) {
    await page.setViewportSize(viewport);
    await expect.poll(async()=>{const rect=await page.locator('#chessBoard').boundingBox();return !!rect && rect.y+rect.height<=viewport.height && rect.x+rect.width<=viewport.width;}).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(page.locator('#fullscreenBtn')).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('#toolView')).not.toHaveClass(/is-fullscreen/);
});
test('board palette exports remain independent of interface accent',async({page})=>{
  await page.goto('/board-colors.html');const before=await page.locator('#darkCode').innerText();await page.getByRole('button',{name:'Settings',exact:true}).click();await page.locator('input[name="accent-mode"][value="custom"]').check();await page.locator('#accent-picker').fill('#ff0000');await page.keyboard.press('Escape');await expect(page.locator('#darkCode')).toHaveText(before);
  const download=page.waitForEvent('download');await page.locator('#downloadSvgBtn').click();expect((await download).suggestedFilename()).toMatch(/\.svg$/);
});

test('phone archive rows keep downloads visible without sideways scrolling',async({page})=>{
  await page.setViewportSize({width:320,height:900});await page.goto('/');await expect(page.locator('#archive-count')).toContainText('matching entries');
  const link=page.locator('#archive-results .download-link').first();const box=await link.boundingBox();expect(box).not.toBeNull();expect(box!.x+box!.width).toBeLessThanOrEqual(320);
  await expect(page.locator('#archive-results .event-mobile-meta').first()).toBeVisible();
});
test('FIDE standard-rating periods have individual SQLite downloads on narrow screens',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/fide-archive.html');
  await expect(page.locator('.fa-table thead th')).toHaveText(['Period','Rows','Download']);
  const manifest=JSON.parse(await readFile('public/data/fide-archive/standard-lists.json','utf8'));
  await expect(page.locator('#faBody tr[data-search]')).toHaveCount(manifest.lists.length);
  await expect(page.locator('a[href*="archive.org"], a[href*="pixeldrain.com/l/"]')).toHaveCount(0);
  await page.getByText('Original files and player lists (Pixeldrain)',{exact:true}).click();
  await expect(page.locator('a[href^="https://pixeldrain.com/u/"]')).toHaveCount(8);
  await expect(page.getByRole('heading',{name:'Saved player lists',exact:true})).toHaveCount(0);
  const links=await page.locator('#faBody a').evaluateAll(els=>els.map(el=>(el as HTMLAnchorElement).href));
  expect(links.every(url=>/^https:\/\/github.com\/ianrastall\/fide-db-archive\/releases\/download\/standard-sqlite-[^/]+\/fide-standard-\d{4}(-\d{2})?\.sqlite\.zip$/.test(url))).toBe(true);
  await page.locator('#faSearch').fill('1969');
  await expect(page.locator('#faBody tr[data-search]:visible')).toHaveCount(1);
  await expect(page.locator('#faBody tr[data-search]:visible')).toContainText('month unknown');
  await page.locator('#faSearch').fill('2019-03');
  await expect(page.locator('#faBody tr[data-search]:visible')).toHaveCount(1);
  await page.locator('#faSearch').fill('not-a-period');
  await expect(page.locator('#faEmpty')).toBeVisible();
  await expect(page.locator('#faCount')).toHaveText('0 periods');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});

test('staged FIDE table changes at midnight UTC and retains data on failed refresh',async({page})=>{
  await page.clock.install({time:new Date('2099-10-31T23:59:59Z')});
  const snapshots=[];
  for(const [period,name] of [['2099-10','October, Player'],['2099-11','November, Player']]) {
    const data=JSON.stringify([{id:1,name,country:'USA',sex:'M',title:'GM',std:2600,rapid:0,blitz:0,born:1990,active:true}]);
    const meta=JSON.stringify({period,count:1,min_rating:2500});
    const entry={period,effectiveFrom:`${period}-01T00:00:00Z`,data:`/data/fide-monthly/${period}/players.json`,meta:`/data/fide-monthly/${period}/players.meta.json`,dataSha256:createHash('sha256').update(data).digest('hex'),metaSha256:createHash('sha256').update(meta).digest('hex'),receipt:`https://github.com/ianrastall/fide-db-archive/releases/download/standard-sqlite-${period}-monthly/monthly.json`};
    snapshots.push(entry);
    await page.route(`**${entry.data}`,r=>r.fulfill({contentType:'application/json',body:data}));
    await page.route(`**${entry.meta}`,r=>r.fulfill({contentType:'application/json',body:meta}));
  }
  let failed=false;
  await page.route('**/data/fide-monthly.json',r=>failed ? r.fulfill({status:503}) : r.fulfill({contentType:'application/json',body:JSON.stringify({schema:1,snapshots})}));
  await page.goto('/fide-2500.html');
  await expect(page.locator('#fpBody')).toContainText('October, Player');
  await expect(page.locator('#fpBody .td-name a').first()).toHaveAttribute('href','/fide-player.html?id=1');
  await expect(page.locator('#fpBody')).not.toContainText('November, Player');
  await page.clock.runFor(1002);
  await expect(page.locator('#fpBody')).toContainText('November, Player');
  await expect(page.locator('#fpUpdated')).toContainText('2099-11');
  failed=true;
  await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.locator('#fpBody')).toContainText('November, Player');
});

test('staged FIDE archive period becomes visible at midnight UTC',async({page})=>{
  await page.clock.install({time:new Date('2099-10-31T23:59:59Z')});
  await page.route('**/fide-archive.html',async route=>{
    const response=await route.fetch();
    const body=(await response.text()).replace(/(<tbody[^>]*id="faBody"[^>]*>)/,'$1<tr data-search="2099-11 nov 2099" data-period="2099-11" data-rows="1" data-effective="2099-11-01T00:00:00Z" hidden><th>Nov 2099</th><td>1</td><td><a href="#fixture">SQLite ZIP</a></td></tr>');
    await route.fulfill({response,body});
  });
  await page.goto('/fide-archive.html');
  const future=page.locator('#faBody tr[data-period="2099-11"]');
  await expect(future).toBeHidden();
  await page.clock.runFor(1002);
  await expect(future).toBeVisible();
  await page.locator('#faSearch').fill('2099-11');
  await expect(page.locator('#faCount')).toHaveText('1 periods');
});
