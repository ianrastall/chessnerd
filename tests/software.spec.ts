import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://www.googletagmanager.com/**', route => route.abort());
  await page.goto('/software.html');
});

test('software search combines task, category and platform and can recover from no matches', async ({ page }) => {
  const visibleItems = page.locator('[data-software-item]:visible');
  const initialCount = await visibleItems.count();
  expect(initialCount).toBeGreaterThan(30);
  await page.getByLabel('Category', { exact: true }).selectOption('training');
  await page.getByLabel('Platform', { exact: true }).selectOption('Web');
  await page.getByLabel('Find software', { exact: true }).fill('spaced repetition');
  await expect(visibleItems.locator('h3')).toHaveText(['Chess Tempo', 'Listudy', 'Chessable']);
  await expect(page.locator('#software-count')).toHaveText(`3 of ${initialCount} programs and libraries`);
  await page.getByLabel('Find software', { exact: true }).fill('no-such-software');
  await expect(page.locator('#software-empty')).toBeVisible();
  await expect(visibleItems).toHaveCount(0);
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(visibleItems).toHaveCount(initialCount);
  await expect(page.locator('#software-empty')).toBeHidden();
  await page.getByLabel('Find software', { exact: true }).fill('no-such-software');
  await page.getByRole('navigation', { name: 'Software categories', exact: true }).getByRole('link', { name: 'Databases & game analysis' }).click();
  await expect(page.locator('#databases')).toBeVisible();
  await expect(page.getByLabel('Find software', { exact: true })).toHaveValue('');
  await expect(visibleItems).toHaveCount(initialCount);
});

test('Jupiter lists current apps with real installers and keeps older links separate', async ({ page }) => {
  const jupiter = page.locator('#jupiter');
  await expect(jupiter.locator('h3')).toHaveText(['Chess Engine Compiler', 'Lichess Puzzles', 'Chess.com Crawler', 'Boardroom', 'EditPGN', 'Tour Breaker']);
  await expect(jupiter.getByRole('link', { name: 'Windows installer' })).toHaveCount(2);
  for (const name of ['Boardroom', 'EditPGN', 'Tour Breaker']) {
    const item = jupiter.getByRole('article').filter({ has: page.getByRole('heading', { name, exact: true }) });
    await expect(item).toContainText('Public release pending');
    await expect(item.getByRole('link')).toHaveCount(0);
  }
  await page.locator('.earlier-software summary').click();
  await expect(page.getByRole('link', { name: 'Original download', exact: true })).toHaveAttribute('href', 'https://github.com/ianrastall/PgnTools/releases/download/2.0.0/PgnTools-2.0.0-win-x64.exe');
  await expect(page.getByRole('link', { name: 'Original installer', exact: true })).toHaveAttribute('href', 'https://github.com/ianrastall/titania-tools/releases/download/v0.1.0/PgnSimpleEdit-0.1.0-Setup.exe');
});

test('the full software catalogue and download links work without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/software.html');
  await expect(page.locator('[data-software-item]:visible')).toHaveCount(39);
  await expect(page.getByRole('link', { name: 'Windows installer' })).toHaveCount(2);
  await expect(page.locator('#software-filters')).toBeHidden();
  await page.getByRole('navigation', { name: 'Software categories', exact: true }).getByRole('link', { name: 'Developer libraries & publishing' }).click();
  await expect(page).toHaveURL(/#development$/);
  await expect(page.getByRole('heading', { name: 'python-chess', exact: true })).toBeInViewport();
  await context.close();
});
