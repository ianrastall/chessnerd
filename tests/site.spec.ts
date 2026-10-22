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
  await page.locator('#chessBoard [data-coord="e2"]').click();await page.locator('#chessBoard [data-coord="e4"]').click();await expect(page.locator('#pgnText')).toHaveValue(/e4/);
});
test('board palette exports remain independent of interface accent',async({page})=>{
  await page.goto('/board-colors.html');const before=await page.locator('#darkCode').innerText();await page.getByRole('button',{name:'Settings',exact:true}).click();await page.locator('input[name="accent-mode"][value="custom"]').check();await page.locator('#accent-picker').fill('#ff0000');await page.keyboard.press('Escape');await expect(page.locator('#darkCode')).toHaveText(before);
  const download=page.waitForEvent('download');await page.locator('#downloadSvgBtn').click();expect((await download).suggestedFilename()).toMatch(/\.svg$/);
});
