import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { expect, test } from '@playwright/test';
import type { BrowserContext, Locator, Page, TestInfo } from '@playwright/test';
import type { Attempt, Catalog } from '../src/model';

const origin = 'http://127.0.0.1:48171';
const pack = {
  id: 'blog-django',
  title: 'Post Creation',
  description: 'Repair the publishing workflow in an existing Django REST API.',
  runtime: 'django',
  durationMinutes: 60,
};
const nodePack = { ...pack, id: 'blog-node', title: 'Express publishing', runtime: 'node' };

async function routeWorkbench(context: BrowserContext, problems: Catalog['problems'] = [pack]) {
  const attempt: Attempt = {
    id: 'test-attempt',
    problemId: pack.id,
    title: pack.title,
    description: pack.description,
    runtime: 'django',
    status: 'ready',
    seed: 42,
    deadline: null,
    durationMinutes: 60,
    createdAt: Date.now(),
    prompt:
      '# Post Creation\n\nAuthors can read the blog but cannot publish a new post.\n\n## Steps to reproduce\n\n1. Sign in to the blog.\n2. Publish a valid post.\n3. Inspect the response.',
    images: [],
    logs: [],
    editorUrl: origin + '/automation-editor',
    previews: [
      { port: 8000, label: 'Frontend', url: origin + '/automation-preview' },
      { port: 8080, label: 'Backend', url: origin + '/automation-api' },
    ],
    appStatus: 'stopped',
    testStatus: 'idle',
    grade: null,
    chats: [],
  };
  const catalog: Catalog = {
    problems,
    attempts: [attempt],
    providers: [
      { id: 'codex', label: 'Codex CLI', model: '', available: true },
      { id: 'openai', label: 'OpenAI', model: '', available: false },
      { id: 'gemini', label: 'Gemini', model: '', available: false },
    ],
  };
  const leaseOwners = new Map<string, string>();
  let reads = 0,
    lastChat: Record<string, unknown> = {};
  await context.route(origin + '/**', async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname;
    const reply = (data: unknown, status = 200) => route.fulfill({ status, json: data });
    if (path === '/api/catalog') return reply(catalog);
    if (path.startsWith('/api/attempts/' + attempt.id)) {
      const action = path.split('/')[4];
      if (!action) {
        reads++;
        return reply(attempt);
      }
      const tab = request.headers()['x-acis-tab'];
      const leaseOwner = leaseOwners.get(attempt.id);
      if (!tab) return reply({ error: 'Missing tab identity' }, 403);
      if (action === 'lease') {
        if (leaseOwner && leaseOwner !== tab) return reply({ error: 'Already open' }, 409);
        leaseOwners.set(attempt.id, tab);
        return reply({ ok: true });
      }
      if (leaseOwner !== tab) return reply({ error: 'Other tab holds lease' }, 409);
      switch (action) {
        case 'begin':
          attempt.status = 'active';
          attempt.deadline = Date.now() + 3600000;
          break;
        case 'files':
          return reply({ files: ['README.md', 'blog/views.py'] });
        case 'chat': {
          lastChat = request.postDataJSON();
          const content = 'Check the HTTP status and compare the saved object with the response.';
          attempt.chats = [
            {
              id: 'chat1',
              messages: [
                { role: 'user', content: String(lastChat.message) },
                { role: 'assistant', content },
              ],
            },
          ];
          return reply({ chatId: 'chat1', content });
        }
        case 'test':
          attempt.testStatus = 'done';
          attempt.grade = {
            cases: [
              {
                name: 'Creates a post with its author',
                passed: false,
                detail: 'Expected 201, got 500',
              },
            ],
            output: '1 failed',
            stale: false,
          };
          break;
        case 'run':
          attempt.appStatus = 'running';
          break;
        case 'submit':
          attempt.status = 'review';
          attempt.completionReason = 'submitted';
          attempt.review = {
            diff: '',
            debrief: 'Inspect how the publishing view persists a post.',
          };
          break;
      }
      return reply({ ok: true });
    }
    if (path.startsWith('/automation-'))
      return route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><html lang="en"><title>Browser test frame</title><main><label>Working draft <input></label></main></html>',
      });
    const name = path.startsWith('/assets/')
      ? join('assets', basename(path))
      : path === '/'
        ? 'index.html'
        : basename(path);
    const extension = name.split('.').at(-1);
    const types: Record<string, string> = {
      html: 'text/html',
      js: 'text/javascript',
      css: 'text/css',
      png: 'image/png',
    };
    return route.fulfill({
      body: await readFile(join(process.cwd(), 'dist', name)),
      contentType: types[extension || ''],
    });
  });
  return { attempt, catalog, reads: () => reads, lastChat: () => lastChat };
}
async function take(page: Page, info: TestInfo, name: string) {
  const path = info.outputPath(name + '.png');
  await page.screenshot({ path });
  await info.attach(name, { path, contentType: 'image/png' });
}

async function dragBy(page: Page, handle: Locator, distance: number) {
  const box = (await handle.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + distance, y, { steps: 12 });
  await page.mouse.up();
}

test('dock Preview beside AI Assistant and resize both panes without losing live work', async ({
  page,
  context,
}) => {
  const fixture = await routeWorkbench(context);
  fixture.attempt.status = 'active';
  fixture.attempt.appStatus = 'running';
  await page.goto(origin + '/?attempt=test-attempt');
  const editor = page.frameLocator('iframe[title="Code editor"]').getByLabel('Working draft');
  const preview = page
    .frameLocator('iframe[title="Application preview"]')
    .getByLabel('Working draft');
  const chat = page.getByLabel('Message the AI assistant');
  await editor.fill('unsaved code');
  await chat.fill('unsent question');
  const center = page.getByRole('tablist', { name: 'Center pane' });
  const right = page.getByRole('tablist', { name: 'Right pane' });
  await center.getByRole('tab', { name: 'Preview' }).click({ timeout: 3000 });
  await preview.fill('unsaved form');
  await center
    .getByRole('tab', { name: 'Preview' })
    .dragTo(right.getByRole('tab', { name: 'AI Assistant' }));
  await expect(right.getByRole('tab', { name: 'Preview', selected: true })).toBeVisible();
  await expect(editor).toHaveValue('unsaved code');
  await expect(preview).toHaveValue('unsaved form');

  const questionPanel = page.getByRole('tabpanel', { name: 'Question' });
  const previewPanel = page.getByRole('tabpanel', { name: 'Preview' });
  const width = async (panel: Locator) => (await panel.boundingBox())!.width;
  const questionWidth = await width(questionPanel);
  const previewWidth = await width(previewPanel);
  const splitters = page.getByRole('separator', { name: /Resize/ });
  await dragBy(page, splitters.nth(0), 80);
  expect(await width(questionPanel)).toBeCloseTo(questionWidth + 80, 0);
  expect(await width(previewPanel)).toBeCloseTo(previewWidth, 0);
  await dragBy(page, splitters.nth(1), -100);
  expect(await width(previewPanel)).toBeCloseTo(previewWidth + 100, 0);
  expect(await width(questionPanel)).toBeCloseTo(questionWidth + 80, 0);
  await splitters.nth(1).press('ArrowLeft');
  expect(await width(previewPanel)).toBeGreaterThan(previewWidth + 100);
  await right.getByRole('tab', { name: 'AI Assistant' }).click();
  await expect(chat).toHaveValue('unsent question');
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(right.getByRole('tab', { name: 'Preview', selected: true })).toBeVisible();
  await expect(preview).toHaveValue('unsaved form');
  await expect(editor).toHaveValue('unsaved code');
});

test('pane menus reorder, restore empty panes, and remember layout across interviews', async ({
  page,
  context,
}) => {
  const fixture = await routeWorkbench(context);
  fixture.attempt.status = 'active';
  await page.goto(origin + '/?attempt=test-attempt');
  const center = page.getByRole('tablist', { name: 'Center pane' });
  const left = page.getByRole('tablist', { name: 'Left pane' });
  const right = page.getByRole('tablist', { name: 'Right pane' });
  const menu = (pane: string) =>
    page.getByRole('button', { name: 'Move tab in ' + pane + ' pane' });
  const item = (name: string) => page.getByRole('menuitem', { name, exact: true });
  await menu('left').press('Enter');
  await item('Move to right pane').press('Enter');
  await expect(left).toBeHidden();
  await expect(right.getByRole('tab', { name: 'Question' })).toBeFocused();
  await menu('right').click();
  await item('Move earlier').click();
  await expect(right.getByRole('tab').first()).toHaveText('Question');
  await menu('right').click();
  await item('Maximize pane').click();
  await expect(center).toBeHidden();
  await menu('right').click();
  await item('Restore panes').click();
  await expect(center).toBeVisible();
  await menu('center').click();
  await item('Move to left pane').click();
  await expect(left.getByRole('tab', { name: 'Editor' })).toBeFocused();
  const separator = page.getByRole('separator', { name: /Resize/ }).first();
  await separator.press('ArrowRight');
  const savedWidth = (await left.boundingBox())!.width;
  await page.reload();
  await expect(left.getByRole('tab', { name: 'Editor', selected: true })).toBeVisible();
  expect((await left.boundingBox())!.width).toBeCloseTo(savedWidth, 0);
  fixture.attempt.id = 'second-attempt';
  await page.goto(origin + '/?attempt=second-attempt');
  await expect(left.getByRole('tab', { name: 'Editor', selected: true })).toBeVisible();
  await expect(right.getByRole('tab').first()).toHaveText('Question');
  await page.setViewportSize({ width: 390, height: 844 });
  const switcher = page.getByRole('combobox', { name: 'Workspace view' });
  await expect(switcher.getByRole('option')).toHaveCount(6);
  await switcher.selectOption('assistant');
  await expect(page.getByLabel('Message the AI assistant')).toBeVisible();
  await expect(page.getByRole('tabpanel')).toHaveCount(1);
  const desktopUnderlines = page.evaluate(
    () =>
      new Promise<number[]>((resolve) => {
        const grid = document.querySelector('.panes')!;
        const observer = new MutationObserver(() => {
          const selected = grid.querySelectorAll('[role=tab][aria-selected=true]');
          if (selected.length !== 3) return;
          observer.disconnect();
          const offsets = [0, 0, 0];
          let frames = 0;
          function sample() {
            selected.forEach((tab, index) => {
              const indicator = tab.querySelector('.workspace-tab-indicator')!;
              const offset = Math.abs(
                indicator.getBoundingClientRect().left - tab.getBoundingClientRect().left,
              );
              offsets[index] = Math.max(offsets[index], Math.round(offset));
            });
            if (++frames < 8) requestAnimationFrame(sample);
            else resolve(offsets);
          }
          requestAnimationFrame(sample);
        });
        observer.observe(grid, { subtree: true, childList: true });
      }),
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  expect(await desktopUnderlines).toEqual([0, 0, 0]);
  await expect(left.getByRole('tab', { name: 'Editor' })).toBeVisible();
  expect((await left.boundingBox())!.width).toBeCloseTo(savedWidth, 0);
  await menu('left').click();
  await item('Reset layout').click();
  await expect(left.getByRole('tab', { name: 'Question' })).toBeVisible();
  await expect(center.getByRole('tab', { name: 'Editor', selected: true })).toBeVisible();
  await expect(right.getByRole('tab')).toHaveCount(1);
});

test('empty panes accept drops and toolbar commands reveal relocated views', async ({
  page,
  context,
}) => {
  const fixture = await routeWorkbench(context);
  fixture.attempt.status = 'active';
  await page.goto(origin + '/?attempt=test-attempt');
  const right = page.getByRole('tablist', { name: 'Right pane' });
  const left = page.getByRole('tablist', { name: 'Left pane' });
  const center = page.getByRole('tablist', { name: 'Center pane' });
  await left
    .getByRole('tab', { name: 'Question' })
    .dragTo(right.getByRole('tab', { name: 'AI Assistant' }));
  await expect(left).toBeHidden();

  const source = (await center.getByRole('tab', { name: 'Output' }).boundingBox())!;
  await page.mouse.move(source.x + 12, source.y + 12);
  await page.mouse.down();
  await page.mouse.move(source.x + 40, source.y + 12, { steps: 4 });
  const empty = page.getByText('Left pane', { exact: true });
  await expect(empty).toBeVisible();
  await empty.hover();
  await page.mouse.up();
  await expect(left.getByRole('tab', { name: 'Output', selected: true })).toBeVisible();

  await center
    .getByRole('tab', { name: 'Tests' })
    .dragTo(right.getByRole('tab', { name: 'AI Assistant' }));
  await page.getByRole('button', { name: 'Toggle assistant' }).click();
  await expect(page.getByLabel('Message the AI assistant')).toBeVisible();
  await page.getByRole('button', { name: 'Move tab in right pane' }).click();
  await page.getByRole('menuitem', { name: 'Maximize pane' }).click();
  await page.getByRole('button', { name: 'Run options' }).click();
  await page.getByRole('button', { name: 'Startup output' }).click();
  await expect(left.getByRole('tab', { name: 'Output', selected: true })).toBeVisible();
  await page.getByRole('button', { name: 'Run Tests', exact: true }).click();
  await expect(right.getByRole('tab', { name: /Tests/, selected: true })).toBeVisible();
  await expect(page.getByText('Expected 201, got 500')).toBeVisible();
  await page.getByRole('button', { name: 'Toggle question' }).click();
  await expect(right.getByRole('tab', { name: 'Question', selected: true })).toBeVisible();
});

test('a damaged layout falls back to usable panes at the desktop breakpoint', async ({
  page,
  context,
}) => {
  const fixture = await routeWorkbench(context);
  fixture.attempt.status = 'active';
  await page.addInitScript(() =>
    localStorage.setItem(
      'acis-workbench-layout-v1',
      JSON.stringify({
        groups: {
          left: ['editor'],
          center: ['editor', 'preview', 'tests', 'output'],
          right: ['assistant'],
        },
        widths: { left: 0.2, center: 0.55, right: 0.25 },
      }),
    ),
  );
  await page.setViewportSize({ width: 720, height: 800 });
  await page.goto(origin + '/?attempt=test-attempt');
  const editor = page.getByRole('tab', { name: 'Editor' });
  await expect(editor).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tablist')).toHaveCount(3);
  await editor.press('End');
  await expect(page.getByRole('tab', { name: 'Output' })).toBeFocused();
  const splitter = page.getByRole('separator', { name: 'Resize left and center panes' });
  await splitter.press('End');
  expect((await page.getByRole('tabpanel', { name: 'Output' }).boundingBox())!.width).toBeCloseTo(
    200,
    0,
  );
  await page.setViewportSize({ width: 719, height: 800 });
  await expect(page.getByRole('tabpanel')).toHaveCount(1);
  await expect(page.getByLabel('Workspace view')).toHaveValue('output');
});

test('the catalog animates a filter change that keeps the same featured exercise', async ({
  page,
  context,
}) => {
  await routeWorkbench(context, [pack, nodePack]);
  const stack = page.getByRole('combobox', { name: 'Filter by stack' });
  const list = page.locator('.catalog-list');

  for (const reducedMotion of ['no-preference', 'reduce'] as const) {
    await page.emulateMedia({ reducedMotion });
    await page.goto(origin);
    await expect(list.getByRole('button')).toHaveCount(2);
    await list.evaluate(async (element) => {
      await Promise.all(element.getAnimations().map((animation) => animation.finished));
      const observer = new MutationObserver(() => {
        observer.disconnect();
        element.setAttribute('data-filter-motion', String(element.getAnimations().length > 0));
      });
      observer.observe(element, { childList: true });
    });
    await stack.selectOption('django');
    await expect(list.getByRole('button', { name: /Post Creation/ })).toBeVisible();
    await expect(list.getByRole('button')).toHaveCount(1);
    await expect(list).toHaveAttribute('data-filter-motion', String(reducedMotion === 'no-preference'), {
      timeout: 1500,
    });
  }
});

test('a newly featured exercise switches colors immediately and dims when selected', async ({
  page,
  context,
}) => {
  await routeWorkbench(context, [pack, nodePack]);
  let finishCreate = () => {};
  const creating = new Promise<void>((resolve) => {
    finishCreate = resolve;
  });
  await page.route('**/api/attempts', async (route) => {
    await creating;
    await route.abort();
  });

  try {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto(origin);
    const tile = page.getByRole('button', { name: /Express publishing/ });
    await tile.evaluate((button) => {
      const observer = new MutationObserver(() => {
        if (!button.matches(':first-child')) return;
        observer.disconnect();
        button.setAttribute('data-promoted-background', getComputedStyle(button).backgroundColor);
      });
      observer.observe(button.parentElement!, { childList: true });
    });
    await page.getByRole('searchbox').fill('Express');
    const settledBackground = await tile.evaluate(async (button) => {
      await Promise.all(button.getAnimations().map((animation) => animation.finished));
      return getComputedStyle(button).backgroundColor;
    });
    expect(await tile.getAttribute('data-promoted-background')).toBe(settledBackground);

    await tile.click();
    await expect(tile).toBeDisabled();
    await expect(tile).toHaveCSS('opacity', '0.45', { timeout: 2000 });
  } finally {
    finishCreate();
  }
});

test('menus and dialogs follow the system motion preference', async ({ page, context }) => {
  await routeWorkbench(context);
  await page.goto(origin);
  const help = page.getByRole('button', { name: 'Help and settings' });
  const dialog = page.getByRole('dialog', { name: 'Test instructions' });

  for (const reducedMotion of ['no-preference', 'reduce'] as const) {
    await page.emulateMedia({ reducedMotion });
    if (reducedMotion === 'reduce') {
      await expect(page.locator('.exercise-copy > span')).toHaveCSS('transition-duration', '0s');
    }
    const animation = reducedMotion === 'reduce' ? 'none' : 'surface-enter';
    await help.press('Enter');
    await expect(page.locator('.help-menu')).toHaveCSS('animation-name', animation);
    await page.getByRole('button', { name: 'Test instructions' }).press('Enter');
    await expect(dialog).toHaveCSS('animation-name', animation);
    await expect(dialog.getByRole('button', { name: 'Close dialog' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  }
});

test.describe('recent attempt actions', () => {
  test.use({ hasTouch: true });

  test('Stop fits beside the title and all history badges share a right edge', async ({ page, context }, info) => {
    const { attempt, catalog } = await routeWorkbench(context);
    attempt.status = 'active';
    catalog.attempts.push(
      { ...attempt, id: 'completed', status: 'review' },
      { ...attempt, id: 'ready', title: 'Room Booking Conflicts Across Calendars', status: 'ready' },
    );
    await page.goto(origin);
    const history = page.getByRole('complementary', { name: 'Recent attempts' });
    const entry = history.getByRole('button', { name: 'Post Creation Django In progress' });
    const stop = history.getByRole('button', { name: 'Stop attempt for Post Creation' });
    const stopAction = page.getByRole('button', { name: /^Stop attempt for / });
    const stoppableRows = history.locator('.attempt-row').filter({ has: stopAction });
    await expect(stoppableRows).toHaveCount(2);
    for (const width of [966, 320]) {
      await page.setViewportSize({ width, height: 799 });
      await history.scrollIntoViewIfNeeded();
      const completed = (await history.getByText('Completed', { exact: true }).boundingBox())!;
      for (const row of await stoppableRows.all()) {
        const title = (await row.locator('strong').boundingBox())!;
        const badge = (await row.locator('.history-status').boundingBox())!;
        const action = (await row.locator(stopAction).boundingBox())!;
        expect(badge.x + badge.width).toBeCloseTo(completed.x + completed.width, 0);
        expect(action.x).toBeGreaterThanOrEqual(title.x + title.width);
        expect(action.y).toBeLessThan(title.y + title.height);
        expect(action.y + action.height).toBeLessThanOrEqual(badge.y);
        expect(action.height).toBeGreaterThanOrEqual(24);
      }
      await history.screenshot({ path: info.outputPath('recent-attempts-' + width + '.png') });
    }
    await entry.focus();
    await page.keyboard.press('Tab');
    await expect(stop).toBeFocused();
    await stop.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Stop this attempt?' });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(stop).toBeFocused();
    await stop.tap();
    await expect(dialog).toBeVisible();
  });
});

test('a learner can resume a running attempt above the phone catalog', async ({
  page,
  context,
}) => {
  const { attempt } = await routeWorkbench(context);
  attempt.status = 'active';
  attempt.deadline = Date.now() + 3600000;
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto(origin);
  const resume = page.getByRole('button', { name: 'Resume', exact: true });
  await expect(resume).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Stop attempt', exact: true })).toBeInViewport();
  const history = page.getByRole('complementary', { name: 'Recent attempts' });
  const entry = history.getByRole('button', { name: 'Post Creation Django In progress', exact: true });
  await expect(entry).toBeVisible();
  const stack = await entry.getByText('Django', { exact: true }).boundingBox();
  const status = await entry.getByText('In progress', { exact: true }).boundingBox();
  expect(stack!.x + stack!.width).toBeLessThan(status!.x);
  expect(Math.abs(stack!.y + stack!.height / 2 - status!.y - status!.height / 2)).toBeLessThan(2);
  await resume.click();
  await expect(page.locator('iframe[title="Code editor"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save & Proceed' })).toBeInViewport({ ratio: 1 });
});

test('the interview editor uses the full height and omits the header indicators on desktop and phone', async ({
  page,
  context,
}) => {
  await routeWorkbench(context);
  await page.goto(origin + '/?attempt=test-attempt');
  await page.getByRole('button', { name: 'Begin', exact: true }).click();
  const editor = page.getByTitle('Code editor', { exact: true });
  await expect(editor).toBeVisible();

  for (const viewport of [{ width: 1045, height: 799 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await expect(page.getByTitle('Remaining interview time')).toHaveCount(0);
    await expect(page.getByRole('img', { name: 'Connected', exact: true })).toHaveCount(0);
    const bottom = await editor.evaluate((frame) => frame.getBoundingClientRect().bottom);
    expect(bottom).toBe(viewport.height);
  }
  await expect(page.getByText(/^(Workspace|Autosave|AI-assisted interview)$/)).toHaveCount(0);
});

test('polling preserves editor and chat focus; grading, contextual coaching and submission use the active tab', async ({
  page,
  context,
}, info) => {
  const fixture = await routeWorkbench(context);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(origin + '/?attempt=test-attempt');
  await expect(page.getByRole('button', { name: 'Begin' })).toBeEnabled();
  await expect(page.getByRole('heading', { name: 'Before you begin' })).toBeVisible();
  await take(page, info, 'ready-desktop');
  await page.getByRole('button', { name: 'Begin' }).click();
  const editor = page.locator('iframe[title="Code editor"]');
  await expect(editor).toBeVisible();
  await expect(page.getByText(/^S[12]$/)).toHaveCount(0);
  await editor.evaluate((element) => element.setAttribute('data-test-identity', 'preserve'));
  const draft = page.getByRole('textbox', { name: 'Message the AI assistant' });
  await draft.fill('Why does the request fail?');
  const reads = fixture.reads();
  await expect.poll(fixture.reads).toBeGreaterThan(reads);
  await expect(draft).toBeFocused();
  await expect(editor).toHaveAttribute('data-test-identity', 'preserve');
  await page.getByRole('button', { name: 'Hide assistant' }).click();
  await page.getByRole('button', { name: 'Toggle assistant' }).click();
  await expect(draft).toHaveValue('Why does the request fail?');
  await page.getByRole('button', { name: 'Add Context' }).click();
  await page.getByLabel('blog/views.py').check();
  await page.getByLabel('Include the latest test output').check();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(
    page.getByText('Check the HTTP status and compare the saved object with the response.'),
  ).toBeVisible();
  expect(fixture.lastChat()).toMatchObject({
    files: ['blog/views.py'],
    includeTests: true,
    provider: 'codex',
  });
  await page.getByRole('button', { name: 'Run Tests', exact: true }).click();
  await expect(page.getByText('Expected 201, got 500')).toBeVisible();
  fixture.attempt.grade!.stale = true;
  await expect(page.getByText('Source changed')).toBeVisible();
  await take(page, info, 'results-desktop');
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  const preview = page.locator('iframe[title="Application preview"]');
  await expect(preview).toHaveAttribute('src', origin + '/automation-preview');
  const ports = page.getByRole('group', { name: 'Preview ports' });
  await expect(ports.getByRole('button')).toHaveText([
    'Frontend 8000',
    'Backend 8080',
  ]);
  await expect(ports.getByRole('button', { pressed: true })).toHaveText('Frontend 8000');
  await page.getByRole('button', { name: 'Backend 8080' }).click();
  await expect(preview).toHaveAttribute('src', origin + '/automation-api');
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(preview).toHaveAttribute('src', origin + '/automation-preview');
  await page.getByLabel('Preview device').selectOption('Mobile');
  await expect(page.getByLabel('Preview width')).toHaveValue('375');
  await expect(page.getByLabel('Preview height')).toHaveValue('812');
  await page.getByRole('button', { name: 'Save & Proceed' }).click();
  await expect(page.getByRole('heading', { name: 'Interview in progress' })).toBeVisible();
  await expect(page.getByText('Coding section', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Before you begin' })).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Resume interview', exact: true, disabled: false })
    .click();
  await expect(editor).toBeVisible();
  await page.getByRole('button', { name: 'Save & Proceed' }).click();
  await expect(page.getByRole('button', { name: 'Submit Test' })).toBeVisible();
  await page.getByRole('button', { name: 'Submit Test' }).click();
  await page.getByRole('button', { name: 'Confirm submission' }).click();
  await expect(page.getByRole('heading', { name: 'Instructor debrief' })).toBeVisible();
});

test('the expired review centers the shield in its tile', async ({ page, context }, info) => {
  const { attempt } = await routeWorkbench(context);
  attempt.status = 'review';
  attempt.completionReason = 'expired';
  attempt.elapsedSeconds = 3600;
  await page.goto(origin + '/?attempt=test-attempt');
  const tile = page.locator('.review-summary .row-icon');
  for (const width of [624, 320, 1440]) {
    await page.setViewportSize({ width, height: 706 });
    const box = (await tile.boundingBox())!;
    const icon = (await tile.locator('svg').boundingBox())!;
    expect(icon.x + icon.width / 2).toBeCloseTo(box.x + box.width / 2, 1);
    expect(icon.y + icon.height / 2).toBeCloseTo(box.y + box.height / 2, 1);
    if (width === 624) await tile.locator('..').screenshot({ path: info.outputPath('review-banner.png') });
  }
});

test('the dashboard groups the seed with the stack and duration and offers compact assistant settings', async ({ page, context }) => {
  const { attempt } = await routeWorkbench(context);
  attempt.status = 'active';
  await page.goto(origin + '/?attempt=test-attempt#dashboard');
  const metadata = page.locator('.attempt-intro .metadata > span');
  for (const width of [966, 320]) {
    await page.setViewportSize({ width, height: 799 });
    await expect(metadata).toHaveText(['Django', '60 min', 'Seed 42']);
    const duration = (await metadata.nth(1).boundingBox())!;
    const seed = (await metadata.nth(2).boundingBox())!;
    expect(seed.x).toBeGreaterThan(duration.x + duration.width);
    expect(seed.y).toBeCloseTo(duration.y, 0);
  }
  const panel = page.locator('.launch-panel');
  await expect(panel.getByText(/configured|Replay seed|AI coach/)).toHaveCount(0);
  await panel.getByRole('button', { name: 'Assistant settings' }).click();
  await expect(page.getByRole('dialog', { name: 'Assistant settings' })).toBeVisible();
});

test('a new chat invites a question without suggesting prompts', async ({ page, context }) => {
  const { attempt } = await routeWorkbench(context);
  attempt.status = 'active';
  await page.goto(origin + '/?attempt=test-attempt');
  const intro = page.locator('.coach-intro');
  await expect(intro).toBeVisible();
  expect(await intro.getByRole('heading').innerText()).toBe('ChatBot');
  await expect(intro.getByText('Ask AI about this problem.')).toBeVisible();
  await expect(intro.getByRole('button')).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Message the AI assistant' })).toBeEditable();
});

test('protected-file grading reports zero credit in the submitted review', async ({
  page,
  context,
}) => {
  const fixture = await routeWorkbench(context);
  fixture.attempt.status = 'review';
  fixture.attempt.elapsedSeconds = 125;
  fixture.attempt.grade = {
    cases: [],
    output: 'Zero credit. Protected files changed: README.md',
    stale: false,
    integrity: ['README.md'],
  };
  fixture.attempt.review = { diff: '', debrief: 'Restore files marked read-only.' };
  await page.goto(origin + '/?attempt=test-attempt');
  await expect(page.locator('.review-score')).toHaveText('Zero credit');
  await expect(page.getByText('Elapsed time 2 min 5 sec.')).toBeVisible();
  await expect(page.getByText('README.md', { exact: true })).toBeVisible();
  await expect(page.locator('.test-results .count')).toHaveText('Zero credit');
});

test('refresh retains the editing lease, a second tab is blocked, and the narrow editor remains usable', async ({
  page,
  context,
}, info) => {
  await routeWorkbench(context);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + '/?attempt=test-attempt');
  await page.getByRole('button', { name: 'Begin' }).click();
  await expect(page.locator('iframe[title="Code editor"]')).toBeVisible();
  await page.reload();
  await expect(page.locator('iframe[title="Code editor"]')).toBeVisible();
  const duplicate = await context.newPage();
  await duplicate.goto(origin + '/?attempt=test-attempt');
  await expect(
    duplicate.getByRole('heading', { name: 'This interview is open in another tab' }),
  ).toBeVisible();
  await duplicate.close();
  await page.getByRole('button', { name: 'Toggle question' }).click();
  await expect(page.getByRole('heading', { name: 'Post Creation' })).toBeVisible();
  await take(page, info, 'question-narrow');
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  await page.getByRole('button', { name: 'Hide question' }).click();
  await page.getByRole('button', { name: 'Toggle assistant' }).click();
  await expect(page.getByLabel('Message the AI assistant')).toBeVisible();
  await page.getByRole('button', { name: 'Help and settings' }).click();
  await page.getByRole('button', { name: 'Assistant settings' }).click();
  await page.getByRole('combobox', { name: 'Provider', exact: true }).selectOption('gemini');
  await expect(page.getByText(/Connection unavailable/)).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('button', { name: 'Set up an assistant connection' })).toBeVisible();
});
