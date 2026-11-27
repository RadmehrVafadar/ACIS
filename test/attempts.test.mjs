import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Attempts } from '../server/attempts.mjs'
import { fingerprint } from '../server/files.mjs'
import * as docker from '../server/runtime.mjs'

async function fixture(t, overrides = {}, problemId = 'blog-django') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acis-attempt-test-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const runtime = {
    prepare: async (a) => (a.runtime = { editorUrl: 'http://127.0.0.1:5100/', previews: [] }),
    saveEditors: async () => {},
    rotateEditor: async () => {},
    pauseEditor: async () => {},
    dispose: async () => {},
    grade: async () => ({
      cases: [{ name: 'response', passed: false, detail: 'HTTP 500' }],
      output: 'HTTP 500',
    }),
    ...overrides,
  }
  let clock = Date.now()
  const options = { dir, now: () => clock, answer: async () => 'Which HTTP response does the test expect?' }
  const store = new Attempts(runtime, options),
    a = store.create({ problemId, seed: '0' })
  await store.tasks.get(a.id)
  return {
    store,
    a,
    dir,
    runtime,
    options,
    advance: (ms) => {
      clock += ms
    },
  }
}

test('preparation is untimed; a single tab can start, reload, and hand off the editing lease', async (t) => {
  const { store, a, advance, runtime, options } = await fixture(t)
  assert.equal(a.status, 'ready')
  assert.equal(a.deadline, null)
  store.lease(a, 'first-tab')
  store.begin(a)
  const deadline = a.deadline
  store.begin(a)
  assert.equal(a.deadline, deadline)
  assert.throws(() => store.lease(a, 'second-tab'), /another tab/)
  assert.equal(store.view(a, 'second-tab').editorUrl, null)
  assert.match(store.view(a, 'first-tab').editorUrl, /127\.0\.0\.1/)
  advance(16000)
  store.lease(a, 'second-tab')
  const restored = new Attempts(runtime, options).get(a.id)
  assert.equal(restored.deadline, deadline)
  assert.equal(restored.status, 'active')
})

test('reopening a saved API-first blog attempt presents the frontend first', async (t) => {
  const { store, a, runtime, options } = await fixture(t)
  const api = { port: 8080, label: 'API', url: 'http://127.0.0.1:5101/' }
  const blog = { port: 8000, label: 'Blog', url: 'http://127.0.0.1:5102/' }
  await store.lease(a, 'first-tab')
  store.begin(a)
  a.appStatus = 'running'
  a.runtime.previews = [api, blog]
  store.persist(a)

  const restored = new Attempts(runtime, options)
  const attempt = restored.get(a.id)
  await restored.lease(attempt, 'first-tab')
  assert.deepEqual(restored.view(attempt, 'first-tab').previews, [blog, api])
})

test('editor lease takeover revokes its predecessor before returning the new credential', async (t) => {
  const allowRotation = Promise.withResolvers()
  let rotations = 0
  const { store, a, advance, runtime, options } = await fixture(t, {
    rotateEditor: async (attempt) => {
      rotations++
      await allowRotation.promise
      attempt.runtime.editorUrl = 'http://127.0.0.1:5100/new-credential/'
    },
  })
  await store.lease(a, 'first-tab')
  store.begin(a)
  const originalUrl = store.view(a, 'first-tab').editorUrl
  assert.ok(originalUrl)
  const restored = new Attempts(runtime, options)
  assert.equal(restored.view(restored.get(a.id), undefined).editorUrl, null)
  await store.lease(a, 'first-tab')
  assert.equal(rotations, 0)
  advance(15001)
  const takeover = store.lease(a, 'second-tab')
  const duplicate = store.lease(a, 'second-tab')
  await new Promise((resolve) => setImmediate(resolve))
  try {
    assert.equal(rotations, 1)
    assert.equal(store.view(a, 'first-tab').editorUrl, null)
    assert.equal(store.view(a, 'second-tab').editorUrl, null)
    await assert.rejects(async () => store.lease(a, 'third-tab'), /another tab/)
  } finally {
    allowRotation.resolve()
    await Promise.all([takeover, duplicate])
  }
  assert.notEqual(store.view(a, 'second-tab').editorUrl, originalUrl)
  assert.equal(store.view(a, 'second-tab').editorUrl, a.runtime.editorUrl)
  const reloaded = new Attempts(runtime, options)
  await reloaded.lease(reloaded.get(a.id), 'second-tab')
  assert.equal(rotations, 1)
})

test('protected file grading, stale results, archived reset and a clean seed replay', async (t) => {
  const { store, a } = await fixture(t)
  store.begin(a)
  fs.appendFileSync(path.join(a.workspace, 'README.md'), '\nedit via terminal')
  store.test(a)
  await store.graders.get(a.id).job
  assert.deepEqual(a.grade.integrity, ['README.md'])
  fs.appendFileSync(path.join(a.workspace, 'backend/blog/views.py'), '\n# my investigation\n')
  assert.equal(store.view(a, 'first-tab').grade.stale, true)
  const deadline = a.deadline
  store.reset(a)
  await store.tasks.get(a.id)
  const archives = path.join(store.folder(a), 'archives')
  assert.equal(fs.readdirSync(archives).length, 1)
  assert.equal(a.deadline, deadline)
  assert.equal(a.status, 'active')
  assert.equal(fingerprint(a.workspace), fingerprint(a.starter))
  const same = store.create({ seed: '0' })
  await store.tasks.get(same.id)
  const other = store.create({ seed: '1' })
  await store.tasks.get(other.id)
  assert.notEqual(a.workspace, same.workspace)
  assert.equal(fingerprint(same.starter), fingerprint(a.starter))
  assert.notEqual(fingerprint(other.starter), fingerprint(a.starter))
})

test('stop aborts a grade; deadline freezes once and persists the final diff and chat', async (t) => {
  let grades = 0
  const { store, a, advance, runtime, options } = await fixture(t, {
    grade: async (candidate, _pack, _log, signal) => {
      grades++
      if (grades === 1)
        await new Promise((_, reject) =>
          signal.addEventListener('abort', () => reject(signal.reason), { once: true }),
        )
      assert.notEqual(candidate.workspace, a.workspace)
      return { cases: [{ name: 'one', passed: true, detail: '' }], output: '1 passed' }
    },
  })
  store.begin(a)
  store.test(a)
  await new Promise((resolve) => setImmediate(resolve))
  await store.stopTests(a)
  assert.equal(a.testStatus, 'idle')
  assert.equal(a.grade, null)
  await store.chat(a, { provider: 'codex', message: 'What does the failure mean?' })
  assert.equal(store.view(a, 'a').review, undefined)
  fs.appendFileSync(path.join(a.workspace, 'backend/blog/views.py'), '\n# learner change\n')
  advance(3600001)
  store.tick()
  store.tick()
  await store.finalizers.get(a.id)
  assert.equal(a.status, 'review')
  assert.equal(a.completionReason, 'expired')
  assert.equal(grades, 2)
  assert.match(a.review.diff, /learner change/)
  assert.ok(a.review.debrief.length)
  assert.equal(new Attempts(runtime, options).get(a.id).chats[0].messages.length, 2)
  assert.throws(() => store.test(a), /active interview/)
})

test('submission keeps a frozen snapshot across an interrupted grading attempt', async (t) => {
  let fails = true
  const { store, a } = await fixture(t, {
    grade: async () => {
      if (fails) throw new Error('Database unavailable')
      return { cases: [{ name: 'a', passed: true }], output: 'ok' }
    },
  })
  store.begin(a)
  await store.finish(a, 'submitted')
  assert.equal(a.status, 'error')
  assert.match(a.error, /Database/)
  const frozen = a.finalSnapshot
  fails = false
  store.retry(a)
  await store.finalizers.get(a.id)
  assert.equal(a.status, 'review')
  assert.equal(a.finalSnapshot, frozen)
})

test('deadline captures saved source while Run is still starting', async (t) => {
  const started = Promise.withResolvers()
  const finishRun = Promise.withResolvers()
  const name = 'investigation.txt'
  let graded
  let startupSignal
  const { store, a, advance } = await fixture(t, {
    startApp: async (attempt, _pack, _log, signal) => {
      startupSignal = signal
      started.resolve()
      await finishRun.promise
      fs.writeFileSync(path.join(attempt.workspace, name), 'written after expiry')
    },
    grade: async (attempt) => {
      graded = fs.readFileSync(path.join(attempt.workspace, name), 'utf8')
      fs.writeFileSync(path.join(attempt.workspace, 'grader-output.txt'), 'runtime output')
      return { cases: [{ name: 'response', passed: true }], output: 'ok' }
    },
  })
  store.begin(a)
  fs.writeFileSync(path.join(a.workspace, name), 'saved before expiry')
  store.run(a)
  await started.promise
  advance(a.durationMinutes * 60000)
  store.tick()
  const finalizing = store.finalizers.get(a.id)
  finishRun.resolve()
  await finalizing
  assert.equal(a.status, 'review', a.error)
  assert.equal(startupSignal.aborted, true)
  assert.equal(graded, 'saved before expiry')
  assert.match(a.review.diff, /saved before expiry/)
  assert.doesNotMatch(a.review.diff, /written after expiry|grader-output/)
  assert.equal(fs.existsSync(path.join(a.finalSnapshot, 'grader-output.txt')), false)
})

test('an expired restart freezes the disk submission while Docker is offline and retries without an editor', async (t) => {
  let online = false
  const { store, a, advance, runtime, options } = await fixture(t, {
    pauseEditor: async (_attempt, { save = true } = {}) => {
      if (!online) throw new Error('Docker is offline')
      if (save) throw new Error('The editor was stopped when Docker restarted')
    },
  })
  store.begin(a)
  fs.writeFileSync(path.join(a.workspace, 'notes.txt'), 'original submission')
  advance(a.durationMinutes * 60000)
  const restored = new Attempts(runtime, options)
  const saved = restored.get(a.id)
  restored.tick()
  await restored.finalizers.get(saved.id)
  assert.equal(saved.status, 'error')
  assert.match(saved.error, /offline/)
  assert.ok(saved.finalSnapshot, 'capture the saved source even when Docker is offline')
  assert.equal(new Attempts(runtime, options).get(saved.id).finalSnapshot, saved.finalSnapshot)
  fs.writeFileSync(path.join(saved.workspace, 'notes.txt'), 'edit after shutdown')
  online = true
  restored.retry(saved)
  await restored.finalizers.get(saved.id)
  assert.equal(saved.status, 'review', saved.error)
  assert.match(saved.review.diff, /original submission/)
  assert.doesNotMatch(saved.review.diff, /edit after shutdown/)
})

test('a cleanup failure can be retried after restart without grading the submission twice', async (t) => {
  let grades = 0
  let cleanups = 0
  const { store, a, runtime, options } = await fixture(t, {
    grade: async () => {
      grades++
      return { cases: [{ name: 'response', passed: true }], output: 'ok' }
    },
    dispose: async () => {
      if (++cleanups === 1) throw new Error('Docker stopped during cleanup')
    },
  })
  store.begin(a)
  await store.finish(a, 'submitted')
  assert.equal(a.status, 'error')
  const restored = new Attempts(runtime, options)
  const saved = restored.get(a.id)
  restored.retry(saved)
  await restored.finalizers.get(saved.id)
  assert.equal(saved.status, 'review', saved.error)
  assert.equal(grades, 1)
  assert.equal(cleanups, 2)
})

test('Docker grades an expired Django attempt after its containers and volumes are gone', {
  skip: process.env.ACIS_DOCKER_TESTS !== '1', timeout: 240000,
}, async (t) => {
  const { store, a, advance, runtime, options } = await fixture(t, docker, 'ticket-pagination')
  try {
    assert.equal(a.status, 'ready', a.error)
    store.begin(a)
    fs.writeFileSync(path.join(a.workspace, 'notes.txt'), 'submitted investigation')
    await docker.dispose(a)
    advance(a.durationMinutes * 60000)
    const restored = new Attempts(runtime, options)
    const saved = restored.get(a.id)
    restored.tick()
    await restored.finalizers.get(saved.id)
    assert.equal(saved.status, 'review', saved.error)
    assert.deepEqual(saved.grade.cases.map((c) => c.passed), [false, false])
    assert.match(saved.review.diff, /submitted investigation/)
    assert.doesNotMatch(saved.review.diff, /\.pytest_cache/)
  } finally {
    await docker.dispose(a)
  }
})
