import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { expect, test } from '@playwright/test';
import type { BrowserContext, Page, TestInfo } from '@playwright/test';
import type { Attempt, Catalog } from '../src/model';

const origin = 'http://127.0.0.1:48171';
const pack = {
  id: 'blog-django',
  title: 'Post Creation',
  description: 'Repair the publishing workflow in an existing Django REST API.',
  runtime: 'django',
  durationMinutes: 60,
};

async function routeWorkbench(context: BrowserContext) {
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
      { port: 8080, label: 'Backend', url: origin + '/automation-api' },
      { port: 8000, label: 'Frontend', url: origin + '/automation-preview' },
    ],
    appStatus: 'stopped',
    testStatus: 'idle',
    grade: null,
    chats: [],
  };
  const catalog: Catalog = {
    problems: [pack],
    attempts: [attempt],
    providers: [
      { id: 'codex', label: 'Codex CLI', model: '', available: true },
      { id: 'openai', label: 'OpenAI', model: '', available: false },
      { id: 'gemini', label: 'Gemini', model: '', available: false },
    ],
  };
  let leaseOwner = '',
    reads = 0,
    lastChat: Record<string, unknown> = {};
  await context.route(origin + '/**', async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname;
    const reply = (data: unknown, status = 200) => route.fulfill({ status, json: data });
    if (path === '/api/catalog') return reply(catalog);
    if (path.startsWith('/api/attempts/test-attempt')) {
      const action = path.split('/')[4];
      if (!action) {
        reads++;
        return reply(attempt);
      }
      const tab = request.headers()['x-acis-tab'];
      if (!tab) return reply({ error: 'Missing tab identity' }, 403);
      if (action === 'lease') {
        if (leaseOwner && leaseOwner !== tab) return reply({ error: 'Already open' }, 409);
        leaseOwner = tab;
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
        body: '<!doctype html><html lang="en"><title>Browser test frame</title><body style="background:#191a1b;color:#bbb;font:14px system-ui"><main>Browser test frame</main></body></html>',
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
  return { attempt, reads: () => reads, lastChat: () => lastChat };
}
async function take(page: Page, info: TestInfo, name: string) {
  const path = info.outputPath(name + '.png');
  await page.screenshot({ path });
  await info.attach(name, { path, contentType: 'image/png' });
}

test('a learner can resume a running attempt above the phone catalog', async ({
  page,
  context,
}) => {
  const { attempt } = await routeWorkbench(context);
  attempt.status = 'active';
  attempt.deadline = Date.now() + 3600000;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin);
  const resume = page.getByRole('button', { name: 'Resume Post Creation' });
  await expect(resume).toBeInViewport();
  const history = page.getByRole('complementary', { name: 'Recent attempts' });
  await expect(history.getByRole('button', { name: /Post Creation Django · In progress/ })).toBeVisible();
  await resume.click();
  await expect(page.locator('iframe[title="Code editor"]')).toBeVisible();
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
  await expect(page.locator('iframe[title="Application preview"]')).toHaveAttribute(
    'src',
    origin + '/automation-api',
  );
  await page.getByRole('button', { name: 'Frontend 8000' }).click();
  await expect(page.locator('iframe[title="Application preview"]')).toHaveAttribute(
    'src',
    origin + '/automation-preview',
  );
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
