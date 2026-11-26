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
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await expect(page).toHaveTitle('AI Coding Interview Studio');
  await expect(page.getByRole('banner')).toHaveCount(0);
  const controls = page.getByRole('group', { name: 'Studio controls' });
  await controls.getByRole('button', { name: 'Help and settings' }).click();
  await expect(controls.getByRole('button', { name: 'Test instructions' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('searchbox')).toHaveAttribute('data-slot', 'input');
  await expect(page.getByLabel('Filter by stack')).toHaveAttribute('data-slot', 'native-select');
  await expect(page.getByRole('heading', { name: 'Practice library' })).toBeVisible();
  const exercises = page.getByRole('region', { name: 'Exercises', exact: true });
  const daily = page.getByRole('region', { name: 'The Daily', exact: true });
  await expect(daily.getByText('Daily practice is coming soon.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Replay by seed' })).toHaveCount(0);
  const logo = page.getByRole('img', { name: 'AI Coding Interview Studio' });
  const logoBox = await logo.boundingBox();
  const headingBox = await exercises.getByRole('heading').boundingBox();
  const dailyBox = await daily.boundingBox();
  expect(logoBox!.y + logoBox!.height).toBeLessThanOrEqual(dailyBox!.y);
  expect(dailyBox!.y + dailyBox!.height).toBeLessThanOrEqual(headingBox!.y);
  const firstFrame = await logo.textContent();
  await expect.poll(() => logo.textContent()).not.toBe(firstFrame);
  const pause = page.getByRole('button', { name: 'Pause logo rotation' });
  await pause.click();
  await expect(pause).toHaveAttribute('aria-pressed', 'true');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(pause).toBeHidden();
  await expect(logo).toBeVisible();
  await expect(page.getByRole('button', { name: /Parcel Scan Replays/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Invoice Reconciliation/ })).toBeVisible();
  const tiles = page.locator('.exercise-tile');
  const lead = await tiles.first().boundingBox();
  const second = await tiles.nth(1).boundingBox();
  const third = await tiles.nth(2).boundingBox();
  expect(logoBox!.width * 2).toBeCloseTo(lead!.width, 0);
  expect(logoBox!.x + logoBox!.width / 2).toBeCloseTo(lead!.x + lead!.width / 2, 0);
  expect(logoBox!.width / logoBox!.height).toBeCloseTo(4 / 3);
  expect(lead!.width).toBeGreaterThan(1.8 * second!.width);
  expect(Math.abs(second!.y - third!.y)).toBeLessThan(2);
  await page.screenshot({ path: info.outputPath('library-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  const phoneMark = await logo.boundingBox();
  const phoneLead = await tiles.first().boundingBox();
  expect(phoneMark!.width * 2).toBeCloseTo(phoneLead!.width, 0);
  expect(phoneMark!.x + phoneMark!.width / 2).toBeCloseTo(phoneLead!.x + phoneLead!.width / 2, 0);
  expect(phoneMark!.width / phoneMark!.height).toBeCloseTo(4 / 3);
  expect((await tiles.nth(2).boundingBox())!.y).toBeGreaterThan(
    (await tiles.nth(1).boundingBox())!.y,
  );
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
  await page.getByRole('button', { name: /Room Booking Conflicts/ }).click();
  await expect(page.getByRole('button', { name: 'Begin', exact: true })).toBeEnabled({
    timeout: 300000,
  });
  const id = new URL(page.url()).searchParams.get('attempt');
  const attempt = await (await request.get('/api/attempts/' + id)).json();
  expect(attempt).toMatchObject({
    problemId: 'room-booking',
    status: 'ready',
    deadline: null,
  });
  await expect(page.getByText('Coding section', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Practice library' }).click();
  await expect(
    page.getByRole('complementary').getByRole('button', { name: /Room Booking Conflicts Django/ }),
  ).toBeVisible();
});
