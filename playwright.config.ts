import { defineConfig } from '@playwright/test'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

const port = Number(process.env.ACIS_E2E_PORT || 4187)
const baseURL = 'http://127.0.0.1:' + port
process.env.ACIS_E2E_RUN ||= randomUUID()
export default defineConfig({
  testDir: '.',
  testMatch: ['**/e2e/*.spec.ts', '**/web/tests/*.spec.ts'],
  globalTeardown: './e2e/teardown.mjs',
  outputDir: path.join('test-results', process.env.ACIS_E2E_RUN),
  testIgnore: ['**/node_modules/**', '**/.acis/**'],
  workers: 1,
  retries: 0,
  timeout: 420000,
  expect: { timeout: 15000 },
  reporter: 'list',
  use: {
    baseURL,
    actionTimeout: 20000,
    channel: process.platform === 'win32' ? 'msedge' : undefined,
    viewport: { width: 1440, height: 900 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node bin/acis.mjs mock --no-open',
    url: baseURL + '/api/health',
    reuseExistingServer: false,
    env: {
      ACIS_PORT: String(port),
      ACIS_DATA_DIR: path.resolve('.acis', 'browser-test', process.env.ACIS_E2E_RUN),
    },
    timeout: 120000,
  },
})
