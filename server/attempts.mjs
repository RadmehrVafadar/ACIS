import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { stripVTControlCharacters } from 'node:util'
import {
  data,
  mkdir,
  writeJson,
  copySource,
  fault,
  changes,
  protectedChanges,
  fingerprint,
  sourceFiles,
} from './files.mjs'
import { loadPack, published, materializeGold, patchVariant, variantFor } from './packs.mjs'
import { answer } from './coach.mjs'

const elapsed = (a, now) => a.deadline && a.deadline <= now
const titleLog = (text) =>
  stripVTControlCharacters(String(text))
    .split(/\r?\n/)
    .filter(Boolean)
    .map((x) => x.slice(0, 3000))

function previewTabs(attempt) {
  const previews = attempt.runtime?.previews || []
  // Saved publishing attempts retain the old API-first port list in their contract.
  if (
    (attempt.problemId === 'blog-django' || attempt.problemId === 'blog-node') &&
    previews.length === 2 && previews[0].port === 8080 && previews[1].port === 8000
  ) {
    return [previews[1], previews[0]]
  }
  return previews
}

export class Attempts {
  constructor(runtime, options = {}) {
    this.runtime = runtime
    this.dir = options.dir || path.join(data, 'attempts')
    this.now = options.now || Date.now
    this.answer = options.answer || answer
    this.items = new Map()
    this.leases = new Map()
    this.tasks = new Map()
    this.taskControllers = new Map()
    this.graders = new Map()
    this.finalizers = new Map()
    this.requests = new Map()
    mkdir(this.dir)
    for (const entry of fs.readdirSync(this.dir, { withFileTypes: true })) {
      const file = path.join(this.dir, entry.name, 'state.json')
      if (!entry.isDirectory() || !fs.existsSync(file)) continue
      const a = JSON.parse(fs.readFileSync(file, 'utf8'))
      this.items.set(a.id, a)
      if (a.testStatus === 'running') a.testStatus = 'idle'
      if (a.appStatus === 'starting') a.appStatus = 'stopped'
      if (a.status === 'preparing') {
        a.status = 'error'
        a.error = 'Setup was interrupted. Retry to reconnect this attempt.'
      }
    }
  }

  get(id) {
    const a = this.items.get(id)
    if (!a) throw fault('Attempt not found.', 404)
    return a
  }
  folder(a) {
    return path.join(this.dir, a.id)
  }
  contract(a) {
    const file = path.join(this.folder(a), 'contract.json')
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'))
    const pack = loadPack(a.problemId)
    return {
      ...pack,
      debrief: fs
        .readFileSync(path.join(pack.dir, 'instructor', 'variants', a.variant + '.md'), 'utf8')
        .trim(),
    }
  }
  persist(a) {
    writeJson(path.join(this.folder(a), 'state.json'), a)
  }
  log(a, line) {
    a.logs = [...a.logs, ...titleLog(line)].slice(-140)
  }
  list() {
    return Array.from(this.items.values())
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(({ id, problemId, title, status, seed, deadline, createdAt }) => ({
        id,
        problemId,
        title,
        status,
        seed,
        deadline,
        createdAt,
      }))
  }
  lease(a, tab) {
    if (typeof tab !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(tab))
      throw fault('Open this session in the practice browser.', 400)
    const previous = this.leases.get(a.id)
    if (previous && previous.tab !== tab && (previous.pending || previous.expires > this.now()))
      throw fault('This interview is open in another tab. Close it to continue here.', 409)
    if (previous?.pending) return previous.pending
    const lease = { tab, expires: this.now() + 15000 }
    this.leases.set(a.id, lease)
    if (!a.runtime?.editorUrl || !['ready', 'active'].includes(a.status) || a.editorTab === tab) return
    if (!a.editorTab && !a.deadline) {
      a.editorTab = tab
      this.persist(a)
      return
    }
    a.editorTab = null
    this.persist(a)
    lease.pending = (async () => {
      try {
        await this.runtime.rotateEditor(a)
        a.editorTab = tab
        lease.expires = this.now() + 15000
        this.persist(a)
      } catch (error) {
        this.leases.delete(a.id)
        throw error
      } finally {
        delete lease.pending
      }
    })()
    return lease.pending
  }
  active(a) {
    if (a.status !== 'active' || elapsed(a, this.now()))
      throw fault('This action needs an active interview.', 409)
  }
  idle(a) {
    if (this.tasks.has(a.id)) throw fault('Wait for the current workspace operation to finish.', 409)
  }
  background(a, fn) {
    const controller = new AbortController()
    const job = Promise.resolve()
      .then(() => {
        controller.signal.throwIfAborted()
        return fn(controller.signal)
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        a.error = error.message
        this.log(a, error.message)
        if (a.status === 'preparing') a.status = 'error'
        else if (a.appStatus === 'starting') a.appStatus = 'error'
      })
      .finally(() => {
        this.taskControllers.delete(a.id)
        this.tasks.delete(a.id)
        this.persist(a)
      })
    this.taskControllers.set(a.id, controller)
    this.tasks.set(a.id, job)
    this.persist(a)
    return job
  }

  create({ problemId = 'blog-django', seed } = {}) {
    const pack = loadPack(problemId)
    if (!published(pack)) throw fault('Validate this problem before launching it.', 409)
    seed = String(seed ?? this.list().filter((a) => a.problemId === pack.id).length)
    if (!/^[a-zA-Z0-9._-]{1,64}$/.test(seed))
      throw fault('Use a seed of 1 to 64 letters, digits, dots, underscores, or hyphens.')
    const id = randomUUID(),
      folder = path.join(this.dir, id)
    const starter = path.join(folder, 'starter'),
      workspace = path.join(folder, 'workspace')
    const variant = variantFor(pack, seed)
    materializeGold(pack, starter)
    patchVariant(pack, variant, starter)
    copySource(starter, workspace)
    // An author can edit or remove the problem pack while an interview is running.
    const debrief = fs
      .readFileSync(path.join(pack.dir, 'instructor', 'variants', variant.id + '.md'), 'utf8')
      .trim()
    writeJson(path.join(folder, 'contract.json'), { ...pack, dir: undefined, project: undefined, debrief })
    const a = {
      id,
      problemId: pack.id,
      title: pack.title,
      description: pack.description,
      runtimeType: pack.runtime,
      seed,
      variant: variant.id,
      prompt: pack.prompt,
      images: pack.sharedBlog
        ? ['feed', 'create-form', 'expected-success'].map((x) => '/task-images/task-' + x + '.png')
        : [],
      durationMinutes: pack.durationMinutes,
      createdAt: this.now(),
      deadline: null,
      status: 'preparing',
      starter,
      workspace,
      runtime: null,
      appStatus: 'stopped',
      testStatus: 'idle',
      grade: null,
      chats: [],
      logs: [],
    }
    this.items.set(id, a)
    this.prepare(a, pack)
    return a
  }

  prepare(a, pack = this.contract(a)) {
    this.idle(a)
    a.status = 'preparing'
    a.error = null
    return this.background(a, async (signal) => {
      a.runtime = await this.runtime.prepare(a, pack, { onLog: (line) => this.log(a, line), signal })
      if (a.status === 'preparing') a.status = a.deadline ? 'active' : 'ready'
    })
  }

  begin(a) {
    if (a.status === 'active') return
    if (a.status !== 'ready') throw fault('The workspace must be ready before starting.', 409)
    a.deadline = this.now() + a.durationMinutes * 60000
    a.status = 'active'
    this.persist(a)
  }

  view(a, tab) {
    const lease = this.leases.get(a.id)
    const own = lease && !lease.pending && lease.expires > this.now() && lease.tab === tab && a.editorTab === tab
    let grade = a.grade
    if (grade && a.status === 'active' && !grade.stale && grade.revision && fs.existsSync(a.workspace)) {
      if (fingerprint(a.workspace) !== grade.revision) {
        grade.stale = true
        this.persist(a)
      }
    }
    if (grade)
      grade = { cases: grade.cases, output: grade.output, integrity: grade.integrity, stale: grade.stale }
    const {
      id,
      problemId,
      title,
      description,
      seed,
      status,
      error,
      deadline,
      durationMinutes,
      createdAt,
      prompt,
      images,
      logs,
      appStatus,
      testStatus,
      chats,
      completionReason,
    } = a
    return {
      id,
      problemId,
      title,
      description,
      runtime: a.runtimeType,
      seed,
      status,
      error,
      deadline,
      durationMinutes,
      createdAt,
      prompt,
      images,
      logs,
      editorUrl: own && status === 'active' ? a.runtime?.editorUrl : null,
      previews: own && status === 'active' && appStatus === 'running' ? previewTabs(a) : [],
      appStatus,
      testStatus,
      grade,
      chats,
      completionReason,
      elapsedSeconds: a.elapsedSeconds,
      review: status === 'review' ? a.review : undefined,
    }
  }

  async save(a) {
    this.active(a)
    await this.runtime.saveEditors(a)
    this.persist(a)
  }

  run(a) {
    this.active(a)
    this.idle(a)
    a.appStatus = 'starting'
    a.error = null
    this.background(a, async (signal) => {
      await this.runtime.startApp(a, this.contract(a), (line) => this.log(a, line), signal)
      signal.throwIfAborted()
      a.appStatus = 'running'
    })
  }

  async evaluate(a, pack, snapshot, signal) {
    const revision = fingerprint(snapshot)
    const integrity = protectedChanges(a.starter, snapshot, pack.protected)
    if (integrity.length)
      return {
        cases: [],
        output: 'Zero credit. Protected files changed: ' + integrity.join(', '),
        integrity,
        revision,
        stale: false,
      }
    const result = await this.runtime.grade(
      { ...a, workspace: snapshot },
      pack,
      (line) => this.log(a, line),
      signal,
    )
    return { ...result, revision, integrity, stale: false }
  }

  test(a) {
    this.active(a)
    this.idle(a)
    if (this.graders.has(a.id)) throw fault('A test run is already in progress.', 409)
    const controller = new AbortController(),
      pack = this.contract(a)
    a.testStatus = 'running'
    a.error = null
    const snapshot = path.join(this.folder(a), 'runs', randomUUID())
    const job = (async () => {
      await this.runtime.saveEditors(a)
      controller.signal.throwIfAborted()
      copySource(a.workspace, snapshot)
      const grade = await this.evaluate(a, pack, snapshot, controller.signal)
      controller.signal.throwIfAborted()
      a.grade = grade
      a.testStatus = 'done'
    })()
      .catch((error) => {
        if (controller.signal.aborted) {
          a.testStatus = 'idle'
          this.log(a, 'Tests stopped.')
        } else {
          a.testStatus = 'error'
          a.error = error.message
          this.log(a, error.message)
        }
      })
      .finally(() => {
        this.graders.delete(a.id)
        this.persist(a)
      })
    this.graders.set(a.id, { controller, job })
    this.persist(a)
  }

  async stopTests(a) {
    const running = this.graders.get(a.id)
    if (running) {
      running.controller.abort()
      await running.job
    }
  }

  resetData(a) {
    this.active(a)
    this.idle(a)
    return this.background(a, (signal) =>
      this.runtime.resetData(a, this.contract(a), (line) => this.log(a, line), signal),
    )
  }
  reset(a) {
    this.active(a)
    this.idle(a)
    a.status = 'preparing'
    this.background(a, async (signal) => {
      await this.stopTests(a)
      signal.throwIfAborted()
      await this.runtime.pauseEditor(a)
      signal.throwIfAborted()
      await this.runtime.dispose(a)
      signal.throwIfAborted()
      const archive = path.join(this.folder(a), 'archives', randomUUID())
      mkdir(path.dirname(archive))
      fs.renameSync(a.workspace, archive)
      copySource(a.starter, a.workspace)
      a.grade = null
      a.testStatus = 'idle'
      a.appStatus = 'stopped'
      a.error = null
      a.runtime = await this.runtime.prepare(a, this.contract(a), { onLog: (line) => this.log(a, line), signal })
      if (a.status === 'preparing') a.status = 'active'
    })
  }

  finish(a, reason) {
    if (this.finalizers.has(a.id)) return this.finalizers.get(a.id)
    if (a.status === 'review') return Promise.resolve()
    if (!a.deadline) throw fault('Begin the interview before submitting.', 409)
    a.elapsedSeconds ??= Math.max(
      0,
      a.durationMinutes * 60 - Math.floor(Math.max(0, a.deadline - this.now()) / 1000),
    )
    a.status = 'finalizing'
    a.completionReason ||= reason
    a.error = null
    this.persist(a)
    const job = (async () => {
      this.requests.get(a.id)?.abort()
      this.taskControllers.get(a.id)?.abort()
      // Capture saved files at submission, before Docker or an in-flight workspace task can delay it.
      if (!a.finalSnapshot) {
        const snapshot = path.join(this.folder(a), 'final-' + randomUUID())
        copySource(a.workspace, snapshot)
        a.finalSnapshot = snapshot
        this.persist(a)
      }
      await Promise.all([this.stopTests(a), this.tasks.get(a.id)])
      if (!a.review) {
        await this.runtime.pauseEditor(a, { save: false })
        const pack = this.contract(a)
        // Test commands may write files. Keep the submitted source intact for review and retries.
        const gradingCopy = path.join(this.folder(a), 'runs', randomUUID())
        copySource(a.finalSnapshot, gradingCopy)
        try {
          a.grade = await this.evaluate(a, pack, gradingCopy, AbortSignal.timeout(600000))
        } finally {
          fs.rmSync(gradingCopy, { recursive: true, force: true })
        }
        a.review = { diff: changes(a.starter, a.finalSnapshot), debrief: pack.debrief }
        a.testStatus = 'done'
        a.appStatus = 'stopped'
        a.finishedAt = this.now()
        this.persist(a)
      }
      await this.runtime.dispose(a)
      a.status = 'review'
    })()
      .catch((error) => {
        a.error = error.message
        a.status = 'error'
        this.log(a, error.message)
      })
      .finally(() => {
        this.finalizers.delete(a.id)
        this.persist(a)
      })
    this.finalizers.set(a.id, job)
    return job
  }

  tick() {
    for (const a of this.items.values()) {
      if (
        a.status === 'finalizing' ||
        (['active', 'preparing', 'error'].includes(a.status) &&
          !a.completionReason &&
          elapsed(a, this.now()))
      )
        this.finish(a, 'expired')
    }
  }
  retry(a) {
    if (a.status !== 'error') throw fault('There is no failed setup or final grade to retry.', 409)
    if (a.completionReason) this.finish(a, a.completionReason)
    else this.prepare(a)
  }
  files(a) {
    this.active(a)
    return sourceFiles(a.workspace)
  }

  async chat(a, body) {
    this.active(a)
    if (this.requests.has(a.id)) throw fault('Wait for the current reply.', 409)
    const existing = body.chatId && a.chats.find((c) => c.id === body.chatId)
    if (body.chatId && !existing) throw fault('Chat not found.', 404)
    const chat = existing || { id: randomUUID(), messages: [] }
    const controller = new AbortController()
    this.requests.set(a.id, controller)
    try {
      const content = await this.answer(a, body, chat.messages, controller.signal)
      this.active(a)
      chat.messages.push({ role: 'user', content: body.message.trim() }, { role: 'assistant', content })
      if (!existing) a.chats.push(chat)
      this.persist(a)
      return { chatId: chat.id, content }
    } finally {
      this.requests.delete(a.id)
    }
  }
}
