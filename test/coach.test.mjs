import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { coachInput, codexAnswer, hostedAnswer } from '../server/coach.mjs'

test('only selected candidate text and the requested test output enter the coach input', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acis-context-test-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  fs.writeFileSync(path.join(dir, 'views.py'), 'print("requested")')
  fs.writeFileSync(path.join(dir, 'other.py'), 'not-requested')
  const attempt = {
    workspace: dir,
    prompt: 'Repair the output.',
    grade: { output: 'HTTP 500' },
    review: { debrief: 'instructor-only' },
  }
  const body = { message: 'What does 500 mean?', files: ['views.py'], includeTests: true }
  const text = coachInput(attempt, body, [])
  assert.match(text, /requested/)
  assert.match(text, /HTTP 500/)
  assert.doesNotMatch(text, /not-requested|instructor-only/)
  assert.throws(() => coachInput(attempt, { ...body, files: ['../secret'] }, []), /candidate workspace/)
  assert.equal(JSON.parse(coachInput(attempt, { ...body, includeTests: false }, [])).tests, undefined)
})

test('hosted adapters use the native authenticated endpoint and return only the assistant text', async (t) => {
  const old = { OPENAI_API_KEY: process.env.OPENAI_API_KEY, GEMINI_API_KEY: process.env.GEMINI_API_KEY }
  t.after(() => {
    for (const [name, value] of Object.entries(old)) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  })
  for (const [provider, envKey] of [
    ['openai', 'OPENAI_API_KEY'],
    ['gemini', 'GEMINI_API_KEY'],
  ]) {
    delete process.env[envKey]
    await assert.rejects(hostedAnswer(provider, 'example', 'hi', undefined), new RegExp(envKey))
    process.env[envKey] = 'test-only'
    const result = await hostedAnswer(provider, 'example', 'hi', undefined, async (url, init) => {
      const req = JSON.parse(init.body)
      assert.equal(req.input, 'hi')
      assert.equal(req.store, false)
      assert.equal(req.tools, undefined)
      if (provider === 'openai') {
        assert.equal(url, 'https://api.openai.com/v1/responses')
        assert.equal(init.headers.Authorization, 'Bearer test-only')
        return Response.json({
          output: [{ type: 'message', content: [{ type: 'output_text', text: 'A hint' }] }],
        })
      }
      assert.equal(init.headers['x-goog-api-key'], 'test-only')
      assert.match(url, /googleapis\.com/)
      return Response.json({
        steps: [
          { type: 'thought', content: [{ text: 'private' }] },
          { type: 'model_output', content: [{ type: 'text', text: 'A hint' }] },
        ],
      })
    })
    assert.equal(result, 'A hint')
    await assert.rejects(
      hostedAnswer(provider, 'example', 'hi', undefined, async () => new Response('', { status: 429 })),
      /429/,
    )
  }
})

test('Codex receives stdin in a read-only context and only its assistant message is surfaced', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acis-codex-test-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const fake = path.join(dir, 'fixture.cjs')
  fs.writeFileSync(
    fake,
    `let input='';process.stdin.on('data',c=>input+=c);process.stdin.on('end',()=>{ const argv=process.argv.slice(2); if(!argv.includes('read-only')||!argv.includes('shell_tool')||!argv.includes('--ignore-user-config')||input!=='context')process.exit(3);console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'Inspect the response.'}}));})`,
  )
  assert.equal(
    await codexAnswer([process.execPath, fake], 'context', '', AbortSignal.timeout(5000)),
    'Inspect the response.',
  )
})
