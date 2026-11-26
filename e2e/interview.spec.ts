import { test, expect, type Page } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

async function renderedReadme(page: Page) {
  await expect.poll(async () => {
    const visible = await Promise.all(page.frames().map(frame =>
      frame.getByRole('heading', { name: /Blog Platform .*Post Creation/i }).first().isVisible().catch(() => false),
    ))
    return visible.some(Boolean)
  }, { timeout: 45000, message: 'Candidate README text should be visible inside the editor preview' }).toBe(true)
}

async function repairInEditor(page: Page, relative: string) {
  const name = path.basename(relative)
  const ide = page.frameLocator('iframe[title="Code editor"]')
  const file = readFileSync(path.resolve('problems/blog-django/workspace', relative), 'utf8').replaceAll(
    '\r\n',
    '\n',
  )
  await ide.getByRole('tab', { selected:true }).first().click()
  await page.keyboard.press('Control+p')
  await ide.locator('.quick-input-widget input').fill(relative)
  await ide.locator('.quick-input-list .monaco-list-row').filter({ hasText: name }).first().click()
  const editor = ide.locator('.monaco-editor[data-uri$="/' + name + '"]')
  await editor.locator('.view-line').first().click()
  await page.keyboard.press('Control+a')
  // Paste is a single editor operation. Typing multiline Python enables Monaco's newline auto-indent.
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await editor.evaluate(async (_element, text) => navigator.clipboard.writeText(text), file)
  await page.keyboard.press('Control+v')
  await page.keyboard.press('Control+s')
}

test('a Django learner reproduces the failure, repairs actual files in the IDE, and submits a persistent post', async ({
  page,
  request,
}, info) => {
  const created = await request.post('/api/attempts', { data: { problemId: 'blog-django', seed: 0 } })
  expect(created.ok()).toBeTruthy()
  const { id } = await created.json()
  await page.goto('/?attempt=' + id)
  const begin = page.getByRole('button', { name: 'Begin', exact: true })
  await expect(begin).toBeEnabled({ timeout: 300000 })
  await page.screenshot({ path: info.outputPath('ready.png') })
  await begin.click()
  const ide = page.frameLocator('iframe[title="Code editor"]')
  await expect(ide.getByRole('tab', { name: /preview.*readme|readme.*preview/i }).first()).toBeVisible({
    timeout: 90000,
  })
  await renderedReadme(page)
  await expect(ide.getByText('Build with agent mode', { exact: true })).toBeHidden()
  await page.screenshot({ path: info.outputPath('workbench.png') })
  await page.setViewportSize({ width: 824, height: 873 })
  await renderedReadme(page)
  await page.screenshot({ path: info.outputPath('workbench-narrow.png') })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.getByRole('button', { name: 'Run Tests', exact: true }).click()
  await expect
    .poll(
      async () =>
        (await (await request.get('/api/attempts/' + id)).json()).grade?.cases.filter(
          (c: { passed: boolean }) => !c.passed,
        ).length,
      { timeout: 90000 },
    )
    .toBe(2)
  await expect(page.locator('details.test-case.failed')).toHaveCount(2)
  await expect(page.getByRole('button', { name: 'Run Tests', exact: true })).toBeEnabled()
  await page.screenshot({ path: info.outputPath('failures.png') })
  await page.getByRole('button', { name: 'Run', exact: true }).click()
  await page.getByRole('button', { name: /Blog 8000/ }).click({ timeout: 120000 })
  const blog = page.frameLocator('iframe[title="Application preview"]')
  await blog.getByLabel('Email Address').fill('john@example.com')
  await blog.getByLabel('Password').fill('password123')
  await blog.getByRole('button', { name: 'Sign In' }).click()
  await expect(blog.getByRole('heading', { name: 'Discover Stories' })).toBeVisible()
  await page.screenshot({ path: info.outputPath('feed.png') })
  const myPosts = blog.getByRole('navigation', { name: 'Blog navigation' }).getByText('My Posts', { exact: true })
  await expect(myPosts).toBeVisible()
  await myPosts.click()
  await expect(blog.getByRole('heading', { name: 'My Posts', exact: true })).toBeVisible()
  await expect(blog.getByRole('heading', { name: 'Getting Started with React Hooks', exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath('preview-navigation-embedded.png') })
  const device = page.getByLabel('Preview device')
  await device.selectOption('Custom')
  await page.getByLabel('Preview width').fill('740')
  await expect(myPosts).toBeVisible()
  await device.selectOption('Mobile')
  await expect(myPosts).toBeVisible()
  await expect.poll(() => blog.locator('html').evaluate(html => [window.innerWidth, html.scrollWidth <= html.clientWidth])).toEqual([375, true])
  await page.screenshot({ path: info.outputPath('preview-navigation-mobile.png') })
  await device.selectOption('Fit')
  await blog.getByRole('link', { name: 'Write', exact: true }).click()
  const title = 'Notes from a Django interview'
  await blog.getByLabel(/^Title/).fill(title)
  await blog.getByLabel(/^Content/).fill('A post that must be present after a fresh database read.')
  await blog.getByRole('button', { name: 'Publish Post' }).click()
  await expect(blog.getByText('Failed to create post', { exact: true })).toBeVisible()
  await expect(blog.locator('input[name=title]')).toHaveValue(title)
  await page.screenshot({ path: info.outputPath('publish-failure.png') })
  // Learners can add exploratory tests without changing the protected two-case grade.
  const learnerWorkspace = path.resolve('.acis', 'browser-test', process.env.ACIS_E2E_RUN!, 'attempts', id, 'workspace')
  writeFileSync(path.join(learnerWorkspace, 'backend/blog/tests/test_learner_notes.py'),
    'def test_my_unfinished_idea():\n    assert False\n')
  await page.getByRole('button', { name: 'Editor', exact: true }).click()
  await repairInEditor(page, 'backend/blog/views.py')
  await repairInEditor(page, 'backend/blog/serializers.py')
  await page.getByRole('button', { name: 'Run Tests', exact: true }).click()
  await expect
    .poll(
      async () =>
        (await (await request.get('/api/attempts/' + id)).json()).grade?.cases.filter(
          (c: { passed: boolean }) => c.passed,
        ).length,
      { timeout: 90000 },
    )
    .toBe(2)
  await expect(page.locator('details.test-case.failed')).toHaveCount(0)
  expect((await (await request.get('/api/attempts/' + id)).json()).grade.cases).toHaveLength(2)
  await page.getByRole('button', { name: 'Preview', exact: true }).click()
  await blog.getByRole('button', { name: 'Publish Post' }).click()
  await expect(blog.getByRole('heading', { name: title })).toBeVisible()
  await page.getByRole('button', { name: 'Reload preview' }).click()
  await expect(blog.getByRole('heading', { name: title })).toBeVisible()
  await page.screenshot({ path: info.outputPath('my-posts.png') })
  await page.getByRole('button', { name: 'Save & Proceed' }).click()
  await expect(page.getByRole('button', { name: 'Submit Test', exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath('active-dashboard.png') })
  await page.getByRole('button', { name: 'Submit Test', exact: true }).click()
  await page.getByRole('button', { name: 'Confirm submission' }).click()
  await expect(page.getByRole('heading', { name: 'Interview complete' })).toBeVisible({ timeout: 120000 })
  await page.getByRole('button', { name: 'Code changes' }).click()
  await expect(page.locator('pre.diff')).toContainText('backend/blog/views.py')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Interview complete' })).toBeVisible()
})
