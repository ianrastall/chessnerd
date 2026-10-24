import { test,expect } from '@playwright/test';
import { readdir } from 'node:fs/promises';
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
test('homepage is useful without JavaScript',async({browser})=>{
  const context=await browser.newContext({javaScriptEnabled:false});const page=await context.newPage();await page.goto('http://127.0.0.1:4322/');await expect(page.locator('#archive-results tr')).toHaveCount(12);await expect(page.locator('#archive-results .download-link').first()).toHaveAttribute('href',/^https:/);await expect(page.getByRole('navigation',{name:'Pages and tools'})).toBeVisible();await context.close();
});
test('failed search index retains published downloads and can retry',async({page})=>{
  let fail=true;await page.route('**/data/archive-search.json',r=>fail ? r.fulfill({status:503,body:'Unavailable'}) : r.continue());await page.goto('/');await expect(page.locator('#archive-count')).toContainText('could not load');await expect(page.locator('#archive-results tr')).toHaveCount(12);fail=false;await page.locator('#archive-query').fill('Titled Tuesday');await expect(page.locator('#archive-count')).toContainText('matching entries');
});
test('navigation search and mobile disclosure reach specialist pages',async({page})=>{
  await page.goto('/');await page.locator('#navigation-search').fill('rating history');await expect(page.locator('[data-navigation-item]:visible')).toHaveCount(1);await page.locator('[data-navigation-item]:visible').click();await expect(page).toHaveURL(/fide-player.html/);
  await page.setViewportSize({width:390,height:900});await page.reload();await expect(page.locator('.site-navigation')).not.toHaveAttribute('open','');await page.locator('.site-navigation summary').click();await expect(page.getByRole('navigation',{name:'Pages and tools'})).toBeVisible();
});
test('appearance follows family controls and resets migrated preferences',async({page})=>{
  await page.addInitScript(()=>{if(!localStorage.getItem('migration-test')){localStorage.setItem('accentColor','#663399');localStorage.setItem('theme','light');localStorage.setItem('migration-test','1');}});
  await page.goto('/');await page.getByRole('button',{name:'Settings',exact:true}).click();await expect(page.locator('#theme-choice')).toHaveValue('light');await expect(page.locator('#accent-picker')).toHaveValue('#663399');
  await page.locator('#accent-reset').click();await expect(page.locator('input[name="accent-mode"][value="system"]')).toBeChecked();await page.keyboard.press('Escape');await page.reload();await page.getByRole('button',{name:'Settings',exact:true}).click();await expect(page.locator('input[name="accent-mode"][value="system"]')).toBeChecked();
  await page.locator('input[name="accent-mode"][value="custom"]').check();await page.locator('#accent-picker').fill('#dd3300');await page.locator('#theme-choice').selectOption('dark');await page.keyboard.press('Escape');await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');expect(await page.evaluate(()=>localStorage.getItem('chessnerd-accent'))).toBe('#dd3300');
  await page.emulateMedia({forcedColors:'active'});await expect(page.locator('h1')).toBeVisible();
});
test('homepage player lookup passes surname through to the profile search',async({page})=>{
  await page.route('https://ianrastall.github.io/fide-players/names/**',r=>r.fulfill({status:404}));await page.goto('/');await page.locator('#player-query').fill('Carlsen');await page.getByRole('button',{name:'Find player',exact:true}).click();await expect(page).toHaveURL(/fide-player.html\?q=Carlsen/);await expect(page.locator('#fpSearch')).toHaveValue('Carlsen');await expect(page.locator('#fpStatus')).toContainText('No players match');
});
test('PGN analysis and extraction still operate',async({page})=>{
  await page.goto('/pgn-info.html');await page.locator('#pgnText').fill('[Event "Test"]\n[White "Alice"]\n[Black "Bob"]\n[Result "1-0"]\n\n1. e4 e5 1-0');await page.locator('#analyzeBtn').click();await expect(page.locator('#statsOutput')).toHaveValue(/Total Games:\s+1/);await page.locator('#extractPlayersBtn').click();await expect(page.locator('#statsOutput')).toHaveValue(/Alice[\s\S]*Bob/);
});
test('opening explorer searches and renders a board',async({page})=>{
  await page.goto('/eco-code.html');await page.locator('#ecoSearch').fill('Najdorf');await expect(page.locator('#ecoList')).toContainText('Najdorf');await page.locator('#ecoList button').first().click();await expect(page.locator('.eco-board .square')).toHaveCount(64);
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
test('FIDE bundles and original-source links remain usable on narrow screens',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/fide-archive.html');
  await expect(page.getByRole('heading',{name:'Archive bundles',exact:true})).toBeVisible();
  const bundles=page.locator('.fa-bundles a');
  expect(await bundles.count()).toBeGreaterThan(1);
  for(const link of await bundles.all()) await expect(link).toHaveAttribute('href',/^https:\/\/pixeldrain\.com\/u\/[A-Za-z0-9]+$/);
  await expect(page.locator('a[href^="https://archive.org/"]')).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Saved player lists',exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:'Download saved player lists',exact:true})).toHaveAttribute('href',/^https:\/\/pixeldrain\.com\/u\/[A-Za-z0-9]+$/);
  await page.getByText('Show saved files',{exact:true}).click();
  await expect(page.locator('.fa-snapshots li').first()).toBeVisible();
  await expect(page.locator('#faBody .fa-dl').first()).toHaveAttribute('href',/^https:\/\/(ratings\.fide\.com|www\.olimpbase\.org)\//);
  await page.locator('#faSearch').fill('2019-03');
  await expect(page.locator('#faBody tr[data-search]:visible')).toHaveCount(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
