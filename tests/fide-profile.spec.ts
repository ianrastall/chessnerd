import { test, expect } from '@playwright/test';

// Minimal FPL1 fixture, encoded from fide-players/FORMAT.md. Lists include a
// year-only date, a missing month, a null rating and an explicit zero games.
const dates = ['1969', '2024-01', '2024-03', ...Array.from({ length: 12 }, (_, i) => `2025-${String(i + 1).padStart(2, '0')}`)];
const lists = dates.map(date => ({ date, type: 'standard' }));
const bytes: number[] = [];
const v = (n: number) => { while (n > 127) { bytes.push((n & 127) | 128); n >>>= 7; } bytes.push(n); };
const str = (s: string) => { const b = Buffer.from(s); v(b.length); bytes.push(...b); };
bytes.push(1); v(1990); // sex, birth year
v(1); v(0); str('Test, Player'); // name events
v(1); v(0); str('NOR'); // federation events
v(1); v(0); str('GM\x1f\x1f\x1f'); // title events
v(1); bytes.push(0); v(dates.length); // standard series
dates.forEach((_, i) => v(i === 0 ? 0 : 1));
let previous = 0;
dates.forEach((_, i) => { const encoded = i === 1 ? 0 : 2501 + i; const delta = encoded - previous; v(delta >= 0 ? delta * 2 : -delta * 2 - 1); previous = encoded; });
dates.forEach(() => v(1)); // zero games, distinct from unknown
v(1); v(11); v(dates.length); // K=10 run
v(1); str('i\x1fInactive'); v(dates.length);
const header = Buffer.alloc(16); header.write('FPL1'); header.writeUInt32LE(1, 4); header.writeUInt32LE(1503014, 8); header.writeUInt32LE(0, 12);
const shard = Buffer.concat([header, Buffer.from(bytes)]);

test.beforeEach(async ({ page }) => {
  await page.route('https://www.googletagmanager.com/**', r => r.abort());
  await page.route('**/players/shards.json', r => r.fulfill({ json: { version: 1, lists, shards: [[1503014, 1, shard.length]] } }));
  await page.route('**/players/shard-0000.bin.gz', r => r.fulfill({ body: shard, contentType: 'application/octet-stream' }));
});

const binding = (value: string) => ({ value });
const biography = { results: { bindings: [{ item: binding('http://www.wikidata.org/entity/Q106807'), born: binding('1990-11-30T00:00:00Z'), bornPrecision: binding('11'), placeLabel: binding('Tønsberg'), description: binding('Norwegian chess player'), image: binding('http://commons.wikimedia.org/wiki/Special:FilePath/Test.jpg'), article: binding('https://en.wikipedia.org/wiki/Magnus_Carlsen') }] } };

test('date lookup, compact history, complete CSV and attributed biography', async ({ page }) => {
  await page.route('https://query.wikidata.org/**', r => r.fulfill({ json: biography }));
  await page.route('https://commons.wikimedia.org/w/api.php?**', r => r.fulfill({ json: { query: { pages: { '1': { imageinfo: [{ thumburl: 'https://thumb.wikimedia.org/test.jpg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:Test.jpg', extmetadata: { Artist: { value: '<a href="https://example.com">Test photographer</a>' }, LicenseShortName: { value: 'CC BY-SA 4.0' }, LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/4.0/' } } }] } } } } }));
  await page.route('https://thumb.wikimedia.org/test.jpg', r => r.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="200"/>' }));
  await page.goto('/fide-player.html?id=1503014');
  await expect(page.getByRole('heading', { name: 'Test, Player' })).toBeVisible();
  await expect(page.getByLabel('Biography')).toContainText('Born: 1990-11-30');
  await expect(page.locator('figcaption')).toContainText('Test photographer');
  await expect(page.getByRole('link', { name: 'CC BY-SA 4.0' })).toHaveAttribute('href', 'https://creativecommons.org/licenses/by-sa/4.0/');
  await expect(page.locator('.fp-history table')).not.toBeVisible();
  await page.getByLabel('Year', { exact: true }).selectOption('2024');
  await expect(page.locator('#fpPeriod option')).toHaveText(['2024-03', '2024-01']);
  await page.getByLabel('Archived list', { exact: true }).selectOption('2024-01');
  await expect(page.locator('.fp-rating-result')).toContainText('No rating recorded · Games: 0');
  await page.getByLabel('Year', { exact: true }).selectOption('1969');
  await expect(page.locator('#fpPeriod option')).toHaveText(['1969 (month unknown)']);
  await page.getByText('Detailed rating history (15 lists)', { exact: true }).click();
  await expect(page.locator('.fp-history tbody tr')).toHaveCount(12);
  await page.getByRole('button', { name: 'Show all 15 lists' }).click();
  await expect(page.locator('.fp-history tbody tr')).toHaveCount(15);
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download CSV' }).click();
  const download = await downloadEvent;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = []; for await (const chunk of stream!) chunks.push(chunk);
  const csv = Buffer.concat(chunks).toString();
  expect(csv.trim().split('\n')).toHaveLength(16);
  expect(csv).toContain('1969,standard,2500,0,10,i,Inactive');
  expect(csv).toContain('2024-01,standard,,0,10,i,Inactive');
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
});

test('biography failure leaves ratings usable and can be retried', async ({ page }) => {
  let failed = true;
  await page.route('https://query.wikidata.org/**', r => failed ? r.fulfill({ status: 503 }) : r.fulfill({ json: { results: { bindings: [] } } }));
  await page.goto('/fide-player.html?id=1503014');
  await expect(page.getByRole('button', { name: 'Retry biography' })).toBeVisible();
  await expect(page.locator('.fp-rating-result')).toContainText('Standard: 2514');
  failed = false;
  await page.getByRole('button', { name: 'Retry biography' }).click();
  await expect(page.getByLabel('Biography')).toContainText('No additional biography found');
});

