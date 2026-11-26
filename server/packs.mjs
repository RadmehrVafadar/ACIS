import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { root, copySource, fingerprint, fault, git, sourceFiles, writeJson } from './files.mjs'

const allowedRuntimes = new Set(['django', 'python', 'node'])
const slugPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/
export const packRoot = path.join(root, 'problems')

export function slug(value) {
  if (typeof value !== 'string' || value.length > 64 || !slugPattern.test(value))
    throw fault('Use a lowercase problem ID with letters, digits, and hyphens.')
  return value
}

export function loadPack(id) {
  const dir = path.join(packRoot, slug(id))
  if (!fs.existsSync(path.join(dir, 'problem.json'))) throw fault('Unknown problem: ' + id, 404)
  const config = JSON.parse(fs.readFileSync(path.join(dir, 'problem.json'), 'utf8').replace(/^\uFEFF/, ''))
  if (
    config.id !== id ||
    !config.title ||
    !config.description ||
    !allowedRuntimes.has(config.runtime) ||
    !['postgres', 'mongo', 'none'].includes(config.database) ||
    !Number.isInteger(config.durationMinutes) ||
    config.durationMinutes < 1
  )
    throw fault('Invalid metadata for ' + id)
  for (const command of ['install', 'seed', 'run', 'test']) {
    if (
      !Array.isArray(config[command]) ||
      !config[command].length ||
      config[command].some((word) => typeof word !== 'string' || !word)
    )
      throw fault('Expected an argv array for ' + command)
  }
  if (
    !Array.isArray(config.ports) ||
    !config.ports.length ||
    config.ports.some(
      (p) =>
        !Number.isInteger(p.port) || p.port < 1 || p.port > 65535 || !p.label || !p.path?.startsWith('/'),
    ) ||
    new Set(config.ports.map((p) => p.port)).size !== config.ports.length
  )
    throw fault('Define unique preview ports and health paths.')
  const variants = config.variants
  if (
    !Array.isArray(variants) ||
    !variants.length ||
    new Set(variants.map((v) => v.id)).size !== variants.length
  )
    throw fault('Define at least one distinct variant.')
  for (const v of variants) {
    if (typeof v.id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(v.id))
      throw fault('Invalid variant ID.')
    if (!Number.isInteger(v.failures) || v.failures < 1)
      throw fault('Declare the intended failing test count.')
    for (const ext of ['patch', 'md'])
      fs.accessSync(path.join(dir, 'instructor', 'variants', v.id + '.' + ext))
  }
  const project = path.join(dir, 'workspace')
  const publicFiles = new Set(sourceFiles(project))
  if (config.sharedBlog)
    for (const f of sourceFiles(path.join(root, 'shared/blog'))) publicFiles.add('frontend/' + f)
  if (
    !Array.isArray(config.protected) ||
    !config.protected.length ||
    config.protected.some((f) => !publicFiles.has(f))
  )
    throw fault('Every protected path must identify a candidate file.')
  return { ...config, dir, project, prompt: fs.readFileSync(path.join(dir, 'prompt.md'), 'utf8').trim() }
}

export function packDigest(pack) {
  const inputs = sourceFiles(pack.dir).filter(
    (file) => file !== 'validation.json' && !file.startsWith('validation.json.'),
  )
  const hash = createHash('sha256').update(fingerprint(pack.dir, inputs))
  if (pack.sharedBlog) hash.update(fingerprint(path.join(root, 'shared/blog')))
  return hash.digest('hex')
}

export function markValidated(pack, expectedDigest = packDigest(pack)) {
  if (packDigest(pack) !== expectedDigest)
    throw fault('The pack changed during validation. Run validation again.')
  writeJson(path.join(pack.dir, 'validation.json'), { version: 1, digest: expectedDigest })
}

export function published(pack) {
  try {
    const record = JSON.parse(fs.readFileSync(path.join(pack.dir, 'validation.json'), 'utf8'))
    return record.version === 1 && record.digest === packDigest(pack)
  } catch {
    return false
  }
}

export function catalog() {
  if (!fs.existsSync(packRoot)) return []
  return fs
    .readdirSync(packRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) => {
      try {
        const pack = loadPack(d.name)
        if (published(pack))
          return [
            {
              id: pack.id,
              title: pack.title,
              description: pack.description,
              runtime: pack.runtime,
              durationMinutes: pack.durationMinutes,
            },
          ]
      } catch {
        // A pack being authored may be incomplete. Its validator reports the exact problem.
      }
      return []
    })
    .sort(
      (a, b) =>
        Number(b.id === 'blog-django') - Number(a.id === 'blog-django') || a.title.localeCompare(b.title),
    )
}

export function variantFor(pack, seed) {
  // The first consecutive seeds cycle every variant; callers can also supply a memorable string.
  const number = /^\d{1,12}$/.test(seed)
    ? Number(seed)
    : createHash('sha256').update(String(seed)).digest().readUInt32BE(0)
  return pack.variants[number % pack.variants.length]
}

export function materializeGold(pack, dest) {
  copySource(pack.project, dest)
  if (pack.sharedBlog) copySource(path.join(root, 'shared/blog'), path.join(dest, 'frontend'))
}

export function patchVariant(pack, variant, dest, reverse = false) {
  const patch = path.join(pack.dir, 'instructor', 'variants', variant.id + '.patch')
  git(
    ['-c', 'core.autocrlf=false', 'apply', '--whitespace=nowarn', ...(reverse ? ['--reverse'] : []), patch],
    dest,
  )
}

export function scaffold(id, template = 'django') {
  slug(id)
  if (!allowedRuntimes.has(template)) throw fault('Templates are django, python, and node.')
  const dest = path.join(packRoot, id)
  const from =
    template === 'django'
      ? path.join(packRoot, 'ticket-pagination')
      : path.join(root, 'templates', template)
  const config = JSON.parse(fs.readFileSync(path.join(from, 'problem.json'), 'utf8'))
  try {
    fs.mkdirSync(dest)
  } catch (error) {
    if (error.code === 'EEXIST') throw fault('A problem with this ID already exists.')
    throw error
  }
  try {
    copySource(from, dest)
    fs.rmSync(path.join(dest, 'validation.json'), { force: true })
    config.id = id
    config.title = id
      .split('-')
      .map((s) => s[0].toUpperCase() + s.slice(1))
      .join(' ')
    fs.writeFileSync(path.join(dest, 'problem.json'), JSON.stringify(config, null, 2) + '\n')
    loadPack(id)
  } catch (err) {
    // Only the newly-created pack is rolled back.
    fs.rmSync(dest, { recursive: true, force: true })
    throw err
  }
  return dest
}
