import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import express from 'express'
import { Attempts } from './attempts.mjs'
import { catalog } from './packs.mjs'
import { providers } from './coach.mjs'
import { root, data, fault } from './files.mjs'
import * as runtime from './runtime.mjs'

export const instance = createHash('sha256')
  .update(root + '\0' + data)
  .digest('hex')
  .slice(0, 24)

export function application(attempts) {
  const app = express()
  app.disable('x-powered-by')
  app.use((req, res, next) => {
    const host = req.get('host') || ''
    if (!/^(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/i.test(host))
      return res.status(403).json({ error: 'Local connections only.' })
    if (req.path.startsWith('/api/')) {
      res.set('Cache-Control', 'no-store')
      if (req.get('origin') && req.get('origin') !== 'http://' + host)
        return res.status(403).json({ error: 'Open ACIS in its own browser tab.' })
      if (req.method !== 'GET' && req.get('sec-fetch-site') === 'cross-site')
        return res.status(403).json({ error: 'Cross-site request refused.' })
      if (req.method === 'POST' && !req.is('application/json') && !req.get('X-ACIS-Tab'))
        return res.status(415).json({ error: 'Send JSON.' })
    }
    next()
  })
  app.use(express.json({ limit: '100kb' }))
  app.get('/api/health', (_req, res) => res.json({ app: 'acis', instance }))
  app.get('/api/catalog', (_req, res) =>
    res.json({ problems: catalog(), attempts: attempts.list(), providers: providers() }),
  )
  app.post('/api/attempts', (req, res) => res.status(201).json({ id: attempts.create(req.body || {}).id }))
  app.param('id', (req, _res, next, id) => {
    try {
      req.attempt = attempts.get(id)
      next()
    } catch (err) {
      next(err)
    }
  })
  app.get('/api/attempts/:id', (req, res) => {
    attempts.tick()
    res.json(attempts.view(req.attempt, req.get('X-ACIS-Tab')))
  })
  app.get('/api/attempts/:id/files', async (req, res) => {
    await attempts.lease(req.attempt, req.get('X-ACIS-Tab'))
    res.json({ files: attempts.files(req.attempt) })
  })
  app.post('/api/attempts/:id/:action', async (req, res) => {
    const a = req.attempt,
      action = req.params.action
    attempts.tick()
    await attempts.lease(a, req.get('X-ACIS-Tab'))
    switch (action) {
      case 'lease':
        break
      case 'begin':
        attempts.begin(a)
        break
      case 'run':
        attempts.run(a)
        break
      case 'test':
        attempts.test(a)
        break
      case 'stop-tests':
        await attempts.stopTests(a)
        break
      case 'save':
        await attempts.save(a)
        break
      case 'reset-data':
        attempts.resetData(a)
        break
      case 'reset':
        attempts.reset(a)
        break
      case 'submit':
        attempts.finish(a, 'submitted')
        break
      case 'retry':
        attempts.retry(a)
        break
      case 'chat':
        return res.json(await attempts.chat(a, req.body || {}))
      default:
        throw fault('Unknown interview action.', 404)
    }
    res.json({ ok: true })
  })
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Unknown API route.' }))
  app.use(express.static(path.join(root, 'dist')))
  app.use((err, _req, res, _next) => {
    const status = err.status || 500
    if (status >= 500) console.error(err.message)
    res.status(status).json({ error: err.message || 'The request failed.' })
  })
  return app
}

export async function listen(port) {
  if (!fs.existsSync(path.join(root, 'dist', 'index.html')))
    throw new Error('Build the assessment UI with npm run build.')
  const attempts = new Attempts(runtime)
  const app = application(attempts)
  const server = await new Promise((resolve, reject) => {
    const server = app.listen(port, '127.0.0.1', () => resolve(server))
    server.on('error', reject)
  })
  attempts.tick()
  for (const a of attempts.items.values()) {
    if ((a.status === 'ready' || a.status === 'active') && !attempts.finalizers.has(a.id))
      attempts.prepare(a)
  }
  const timer = setInterval(() => attempts.tick(), 500)
  timer.unref()
  const close = async () => {
    clearInterval(timer)
    for (const c of attempts.requests.values()) c.abort()
    await Promise.allSettled([...attempts.items.values()].map((a) => attempts.stopTests(a)))
    await Promise.allSettled([...attempts.tasks.values(), ...attempts.finalizers.values()])
    await Promise.allSettled(
      Array.from(attempts.items.values())
        .filter((a) => ['active', 'ready'].includes(a.status))
        .map(async (a) => {
          await runtime.pauseEditor(a)
          a.appStatus = 'stopped'
          attempts.persist(a)
        }),
    )
    await new Promise((resolve) => server.close(resolve))
  }
  return { server, attempts, close }
}
