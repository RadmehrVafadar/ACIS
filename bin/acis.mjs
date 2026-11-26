#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { spawn } from 'node:child_process'

const root = fileURLToPath(new URL('../', import.meta.url))
if (fs.existsSync(path.join(root, '.env.local'))) process.loadEnvFile(path.join(root, '.env.local'))

async function buildIfNeeded() {
  const { sourceFiles } = await import('../server/files.mjs')
  const index = path.join(root, 'dist/index.html'),
    web = path.join(root, 'web')
  const time = fs.existsSync(index) ? fs.statSync(index).mtimeMs : 0
  const inputs = [
    ...sourceFiles(web).map((f) => path.join(web, f)),
    ...['package-lock.json', 'vite.config.ts'].map((f) => path.join(root, f)),
  ]
  if (inputs.every((file) => fs.statSync(file).mtimeMs <= time)) return
  const { build } = await import('vite')
  await build({ configFile: path.join(root, 'vite.config.ts') })
}

function openBrowser(url) {
  const launch =
    process.platform === 'win32'
      ? ['rundll32.exe', ['url.dll,FileProtocolHandler', url]]
      : process.platform === 'darwin'
        ? ['open', [url]]
        : ['xdg-open', [url]]
  const child = spawn(launch[0], launch[1], { detached: true, stdio: 'ignore', windowsHide: true })
  child.on('error', () => console.log('Open the local URL above to start.'))
  child.unref()
}

async function main() {
  const {
    positionals: [command, id],
    values,
  } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: {
      problem: { type: 'string' },
      seed: { type: 'string' },
      template: { type: 'string' },
      'no-open': { type: 'boolean' },
      library: { type: 'boolean' },
    },
  })
  if (command === 'new') {
    const { scaffold } = await import('../server/packs.mjs')
    console.log(
      'Created',
      scaffold(id, values.template),
      '\nEdit the prompt, project, tests, and variant. Then run npm run problem:validate -- ' + id,
    )
    return
  }
  if (command === 'validate') {
    const { validate } = await import('../server/validate.mjs')
    return validate(id)
  }
  if (command === 'doctor') {
    const { doctor } = await import('../server/runtime.mjs')
    console.log(await doctor())
    return
  }
  if (command !== 'mock') throw new Error('Use mock, new <id>, validate <id>, or doctor.')
  process.chdir(root)
  const port = Number(process.env.ACIS_PORT || 4177)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid ACIS_PORT.')
  const base = 'http://127.0.0.1:' + port
  const { listen, instance } = await import('../server/http.mjs')
  const existing = await fetch(base + '/api/health', { signal: AbortSignal.timeout(1200) })
    .then((r) => r.json())
    .catch(() => null)
  let host
  if (existing?.instance !== instance) {
    await buildIfNeeded()
    host = await listen(port)
    const close = () => {
      host.close().then(
        () => process.exit(0),
        () => process.exit(1),
      )
    }
    process.once('SIGINT', close)
    process.once('SIGTERM', close)
  }
  let url = base
  if (!values.library && (values.problem !== undefined || values.seed !== undefined)) {
    try {
      const response = await fetch(base + '/api/attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problemId: values.problem, seed: values.seed }),
      })
      const info = await response.json()
      if (!response.ok) throw new Error(info.error)
      url += '/?attempt=' + encodeURIComponent(info.id)
    } catch (error) {
      await host?.close()
      throw error
    }
  }
  console.log('ACIS is open at ' + url)
  if (!values['no-open']) openBrowser(url)
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
