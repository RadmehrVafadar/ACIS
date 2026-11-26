import fs from 'node:fs'
import path from 'node:path'
import { dispose } from '../server/runtime.mjs'

export default async function teardown() {
  const run = process.env.ACIS_E2E_RUN
  if (!run || !/^[0-9a-f-]{36}$/.test(run)) return
  const dir = path.resolve('.acis', 'browser-test', run, 'attempts')
  if (!fs.existsSync(dir)) return
  for (const id of fs.readdirSync(dir)) {
    const file = path.join(dir, id, 'state.json')
    if (fs.existsSync(file)) {
      const attempt = JSON.parse(fs.readFileSync(file, 'utf8'))
      if (attempt.status !== 'review') await dispose(attempt)
    }
  }
}
