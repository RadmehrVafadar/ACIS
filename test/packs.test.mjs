import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { fingerprint, root, sourceFiles } from '../server/files.mjs'
import {
  catalog, loadPack, markValidated, materializeGold, packRoot, patchVariant, published, scaffold, slug, variantFor,
} from '../server/packs.mjs'

test('bundled graders select protected test files so learner-written tests do not change the score', () => {
  const cases = [
    ['blog-django', 'backend/blog/tests/test_posts.py'],
    ['ticket-pagination', 'backend/tickets/tests/test_pagination.py'],
    ['room-booking', 'backend/reservations/tests/test_bookings.py'],
    ['delivery-retries', 'backend/tracking/tests/test_scans.py'],
    ['invoice-totals', 'backend/billing/tests/test_statements.py'],
    ['blog-node', 'backend/test/app.spec.js'],
  ]
  for (const [id, expected] of cases) {
    const pack = loadPack(id)
    assert.ok(pack.protected.includes(expected), id)
    const script = fs.readFileSync(path.join(pack.project, pack.test.at(-1)), 'utf8')
    const isNode = pack.runtime === 'node'
    if (isNode) assert.match(script, /exec npm --prefix backend test\s*$/)
    const command = isNode
      ? JSON.parse(fs.readFileSync(path.join(pack.project, 'backend/package.json'), 'utf8')).scripts.test
      : script.trim().split(/\r?\n/).at(-1)
    const selectors = command.split(/\s+/).filter(arg => /(?:^|\/)tests?(?:\/|$)/.test(arg))
    const paths = selectors.map(arg => (isNode ? 'backend/' : '') + arg.split('::')[0])
    assert.deepEqual([...new Set(paths)], [expected], id + ' must grade only its protected file')
  }
})

test('edited bundled packs must pass validation again before practice', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acis-validation-test-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const pack = { id: 'blog-django', dir, sharedBlog: false }
  fs.writeFileSync(path.join(dir, 'prompt.md'), 'First prompt')
  assert.equal(published(pack), false)
  markValidated(pack)
  assert.equal(published(pack), true)
  fs.writeFileSync(path.join(dir, 'prompt.md'), 'Changed question')
  assert.equal(published(pack), false)
})

test('every shipped seed changes candidate files and reverses exactly, without carrying instructor files', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acis-pack-test-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const available = new Set(catalog().map((pack) => pack.id))
  for (const id of ['blog-django', 'blog-node', 'ticket-pagination', 'room-booking', 'delivery-retries', 'invoice-totals']) {
    assert.ok(available.has(id), 'Bundled pack must be validated and available: ' + id)
    const pack = loadPack(id),
      dest = path.join(dir, pack.id)
    materializeGold(pack, dest)
    const gold = fingerprint(dest)
    const selected = new Set()
    for (let i = 0; i < pack.variants.length; i++) {
      const v = variantFor(pack, String(i))
      selected.add(v.id)
      patchVariant(pack, v, dest)
      assert.notEqual(fingerprint(dest), gold)
      assert.ok(!sourceFiles(dest).some((f) => f.includes('instructor') || f.endsWith('.patch')))
      patchVariant(pack, v, dest, true)
      assert.equal(fingerprint(dest), gold)
    }
    assert.equal(selected.size, pack.variants.length)
  }
  assert.throws(() => slug('../private'))
})

test('plain Python and Node authoring examples include reversible, executable source patches', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acis-template-test-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  for (const name of ['python', 'node']) {
    const packDir = path.join(root, 'templates', name),
      dest = path.join(dir, name)
    const pack = {
      ...JSON.parse(fs.readFileSync(path.join(packDir, 'problem.json'))),
      dir: packDir,
      project: path.join(packDir, 'workspace'),
    }
    materializeGold(pack, dest)
    const clean = fingerprint(dest)
    patchVariant(pack, pack.variants[0], dest)
    assert.notEqual(fingerprint(dest), clean)
    patchVariant(pack, pack.variants[0], dest, true)
    assert.equal(fingerprint(dest), clean)
  }
})

test('a concurrent scaffold preserves the pack created by the other author', (t) => {
  const id = 'scaffold-race-' + randomUUID()
  const dest = path.join(packRoot, id)
  const sentinel = path.join(dest, 'author.txt')
  const createDirectory = fs.mkdirSync.bind(fs)
  let claimed = false
  t.after(() => fs.rmSync(dest, { recursive: true, force: true }))
  t.mock.method(fs, 'mkdirSync', (dir, options) => {
    if (dir === dest && !claimed) {
      claimed = true
      createDirectory(dest)
      fs.writeFileSync(sentinel, 'other author')
    }
    return createDirectory(dir, options)
  })
  assert.throws(() => scaffold(id, 'python'), /already exists/)
  assert.deepEqual(fs.readdirSync(dest), ['author.txt'])
  assert.equal(fs.readFileSync(sentinel, 'utf8'), 'other author')
})
