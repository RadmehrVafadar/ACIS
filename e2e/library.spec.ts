import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

test('the default launcher opens the library and the learner can prepare a chosen Django exercise', async ({
  page,
  request,
  baseURL,
}, info) => {
  const attempts = async () => (await (await request.get('/api/catalog')).json()).attempts.length;
  const before = await attempts();
  const address = new URL(baseURL!);
  const launcher = execFileSync(process.execPath, ['bin/acis.mjs', 'mock', '--no-open'], {
    env: {
      ...process.env,
      ACIS_PORT: address.port,
      ACIS_DATA_DIR: path.resolve('.acis', 'browser-test', process.env.ACIS_E2E_RUN!),
    },
    encoding: 'utf8',
  });
  expect(launcher.trim()).toBe('ACIS is open at ' + address.origin);
  expect(await attempts()).toBe(before);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Practice library' })).toBeVisible();
  const logo = page.getByRole('button', { name: 'Practice library' }).locator('img');
  await expect
    .poll(() => logo.evaluate((img) => (img as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: /Parcel Scan Replays/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Invoice Reconciliation/ })).toBeVisible();
  await page.screenshot({ path: info.outputPath('library-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.screenshot({ path: info.outputPath('library-phone.png'), fullPage: true });
  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await page.screenshot({ path: info.outputPath('library-light.png'), fullPage: true });
  await page.getByLabel('Filter by stack').selectOption('node');
  const search = page.getByRole('searchbox');
  await search.fill('booking');
  await expect(page.getByText('No exercises match those filters.')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.getByLabel('Filter by stack').selectOption('django');
  await search.fill('booking');
  await page.getByRole('button', { name: 'Replay by seed' }).click();
  await page.getByLabel('Replay seed', { exact: true }).fill('invalid seed');
  await expect(page.getByRole('button', { name: /Room Booking Conflicts/ })).toBeDisabled();
  await page.getByLabel('Replay seed', { exact: true }).fill('42');
  await page.getByRole('button', { name: /Room Booking Conflicts/ }).click();
  await expect(page.getByRole('button', { name: 'Begin', exact: true })).toBeEnabled({
    timeout: 300000,
  });
  const id = new URL(page.url()).searchParams.get('attempt');
  const attempt = await (await request.get('/api/attempts/' + id)).json();
  expect(attempt).toMatchObject({
    problemId: 'room-booking',
    seed: '42',
    status: 'ready',
    deadline: null,
  });
  await expect(page.getByText('Coding section', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Practice library' }).click();
  await expect(
    page.getByRole('complementary').getByRole('button', { name: /Room Booking Conflicts Django/ }),
  ).toBeVisible();
});
