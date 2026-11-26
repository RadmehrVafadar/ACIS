import fs from 'node:fs'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export const root = fileURLToPath(new URL('../', import.meta.url))
export const data = path.resolve(process.env.ACIS_DATA_DIR || path.join(root, '.acis'))
const ignored = new Set([
  '.git',
  'node_modules',
  '__pycache__',
  '.pytest_cache',
  '.ruff_cache',
  '.venv',
  'venv',
  '.mypy_cache',
  'dist',
  'output',
  '.coverage',
  '.vite',
])
export const mkdir = (dir) => fs.mkdirSync(dir, { recursive: true })

export function sourceFiles(dir, prefix = '') {
  const files = []
  for (const entry of fs.readdirSync(path.join(dir, prefix), { withFileTypes: true })) {
    if (ignored.has(entry.name) || entry.name.endsWith('.pyc') || entry.isSymbolicLink()) continue
    const relative = prefix ? prefix + '/' + entry.name : entry.name
    if (entry.isDirectory()) files.push(...sourceFiles(dir, relative))
    else if (entry.isFile()) files.push(relative)
  }
  return files.sort()
}

export function copySource(from, to) {
  mkdir(to)
  for (const relative of sourceFiles(from)) {
    const dest = path.join(to, relative)
    mkdir(path.dirname(dest))
    fs.copyFileSync(path.join(from, relative), dest)
  }
}

export function fingerprint(dir, files = sourceFiles(dir)) {
  const hash = createHash('sha256')
  for (const name of files) {
    hash.update(name + '\0')
    hash.update(
      createHash('sha256')
        .update(fs.readFileSync(path.join(dir, name)))
        .digest(),
    )
  }
  return hash.digest('hex')
}

export function writeJson(file, value) {
  mkdir(path.dirname(file))
  const temp = file + '.' + randomUUID() + '.tmp'
  fs.writeFileSync(temp, JSON.stringify(value), { mode: 0o600 })
  fs.renameSync(temp, file)
}

export function fault(message, status = 400) {
  return Object.assign(new Error(message), { status })
}

export function git(args, cwd, allowed = [0]) {
  const result = spawnSync('git', args, {
    cwd,
    windowsHide: true,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    env: {
      ...process.env,
      GIT_CEILING_DIRECTORIES: path.dirname(path.resolve(cwd)),
      GIT_TERMINAL_PROMPT: '0',
      GIT_CONFIG_NOSYSTEM: '1',
    },
  })
  if (result.error || !allowed.includes(result.status))
    throw result.error || new Error(result.stderr.trim() || 'Git operation failed')
  return result.stdout
}

export function changes(before, after) {
  const diff = git(
    ['-c', 'core.autocrlf=false', 'diff', '--no-index', '--no-ext-diff', '--no-color', '--', before, after],
    path.dirname(before),
    [0, 1],
  )
  return [before, after].reduce(
    (text, dir) => text.replaceAll(dir.replaceAll('\\', '/') + '/', '').replaceAll(dir + '/', ''),
    diff,
  )
}

export function checkedFile(dir, relative) {
  if (typeof relative !== 'string' || !sourceFiles(dir).includes(relative))
    throw fault('Choose a file from the candidate workspace.')
  const resolved = fs.realpathSync(path.join(dir, relative))
  const check = path.relative(fs.realpathSync(dir), resolved)
  if (check.startsWith('..' + path.sep) || path.isAbsolute(check))
    throw fault('The selected file is outside this workspace.')
  return resolved
}

export function protectedChanges(starter, workspace, names) {
  const available = new Set(sourceFiles(workspace))
  return names.filter(
    (name) => !available.has(name) || fingerprint(starter, [name]) !== fingerprint(workspace, [name]),
  )
}
