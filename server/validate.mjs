import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { data, mkdir, protectedChanges } from './files.mjs'
import { loadPack, markValidated, materializeGold, packDigest, patchVariant } from './packs.mjs'
import * as docker from './runtime.mjs'

async function healthyBlog(runtime, attempt, pack, log) {
  await runtime.startApp(attempt, pack, log)
  if (!pack.sharedBlog) return
  const backend = attempt.runtime.previews.find((p) => p.port === 8080).url
  const get = async (route, options) => {
    const response = await fetch(new URL(route, backend), {
      ...options,
      signal: AbortSignal.timeout(12000),
    })
    if (!response.ok) throw new Error(route + ' returned HTTP ' + response.status)
    return response.json()
  }
  const { user } = await get('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'john@example.com', password: 'password123' }),
  })
  const [feed, mine] = await Promise.all([
    get('/api/posts'),
    get('/api/posts/my-posts', { headers: { 'x-user-id': user._id } }),
  ])
  if (feed.posts.length !== 10 || mine.posts.length !== 3)
    throw new Error('Seeded login/feed/My Posts failed the reference smoke test.')
}

export async function validate(id, { runtime = docker, log = console.log } = {}) {
  const pack = loadPack(id)
  const digest = packDigest(pack)
  const folder = path.join(data, 'validation', randomUUID()),
    workspace = path.join(folder, 'workspace')
  const clean = path.join(folder, 'correct')
  mkdir(folder)
  materializeGold(pack, workspace)
  materializeGold(pack, clean)
  const attempt = { id: 'check-' + randomUUID(), workspace }
  async function grade(label, expected = 0) {
    const result = await runtime.grade(attempt, pack, log, AbortSignal.timeout(600000))
    const failures = result.cases.filter((c) => !c.passed).length
    if (!result.cases.length || failures !== expected)
      throw new Error(
        label +
          ' expected ' +
          expected +
          ' failing assertions, received ' +
          failures +
          '.\n' +
          result.output,
      )
    log(label + ': ' + (result.cases.length - failures) + '/' + result.cases.length + ' passed')
    return result.cases
      .map((c) => c.name)
      .sort()
      .join('\n')
  }
  try {
    attempt.runtime = await runtime.prepare(attempt, pack, { editor: false, onLog: log })
    const tests = await grade('Correct implementation')
    for (const variant of pack.variants) {
      patchVariant(pack, variant, workspace)
      if (protectedChanges(clean, workspace, pack.protected).length)
        throw new Error('Variant modified a protected file.')
      const actual = await grade('Faulty starter ' + variant.id, variant.failures)
      if (actual !== tests) throw new Error('Variant changed the visible test cases.')
      await healthyBlog(runtime, attempt, pack, log)
      await runtime.stopApp(attempt)
      patchVariant(pack, variant, workspace, true)
      await grade('Repaired starter ' + variant.id)
    }
    markValidated(pack, digest)
    log('Validated ' + pack.id + '. The problem is available in the library.')
  } finally {
    await runtime.dispose(attempt)
    fs.rmSync(folder, { recursive: true, force: true })
  }
}
