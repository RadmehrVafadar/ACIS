import { spawn } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { writeJson } from './files.mjs';

const runtimeDir = fileURLToPath(new URL('../runtime/', import.meta.url));
const composeFile = path.join(runtimeDir, 'compose.yaml');
const maxLogSize = 512 * 1024;
const builds = new Map();
const saves = new Map();

function dockerBinary() {
  const candidates = (process.env.PATH || '').split(path.delimiter).map(base =>
    path.join(base, process.platform === 'win32' ? 'docker.exe' : 'docker'));
  if (process.platform === 'win32') {
    candidates.push(path.join(process.env.LOCALAPPDATA || '', 'Programs', 'DockerDesktop', 'resources', 'bin', 'docker.exe'));
    candidates.push(path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Docker', 'Docker', 'resources', 'bin', 'docker.exe'));
  }
  const binary = candidates.find(existsSync);
  if (!binary) throw new Error('Docker CLI is missing. Install Docker Desktop with the WSL2 Linux engine.');
  return binary;
}

function docker(args, { env = {}, onLog, allowFailure = false, signal } = {}) {
  const binary = dockerBinary();
  const childEnv = { ...process.env, ...env };
  // Windows environment keys are case-insensitive, but Node chooses the first sorted spelling.
  const pathKey = Object.keys(childEnv).find(key => key.toLowerCase() === 'path') || 'PATH';
  childEnv[pathKey] = path.dirname(binary) + path.delimiter + (childEnv[pathKey] || '');
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { cwd: runtimeDir, env: childEnv, windowsHide: true, signal,
      stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', output = '';
    const append = (stream, chunk) => {
      const value = chunk.toString();
      output = (output + value).slice(-maxLogSize);
      if (stream === 'stdout') stdout = (stdout + value).slice(-maxLogSize);
      else stderr = (stderr + value).slice(-maxLogSize);
      onLog?.(value);
    };
    child.stdout.on('data', chunk => append('stdout', chunk));
    child.stderr.on('data', chunk => append('stderr', chunk));
    child.once('error', reject);
    child.once('close', code => {
      if (code !== 0 && !allowFailure) reject(new Error((stderr || output).trim() || 'Docker command exited with status ' + code));
      else resolve({ code, stdout, stderr, output });
    });
  });
}

export async function doctor() {
  const engine = await docker(['info', '--format', '{{.OSType}} {{.ServerVersion}}']);
  if (!engine.stdout.startsWith('linux ')) throw new Error('Switch Docker Desktop to Linux containers.');
  const compose = await docker(['compose', 'version', '--short']);
  return { ok: true, docker: engine.stdout.trim(), compose: compose.stdout.trim() };
}

function imageName() {
  const digest = createHash('sha256');
  function visit(dir) {
    for (const item of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(dir, item.name);
      if (item.isDirectory()) visit(file);
      else { digest.update(path.relative(runtimeDir, file).split(path.sep).join('/')); digest.update(readFileSync(file)); }
    }
  }
  digest.update(readFileSync(path.join(runtimeDir, 'Dockerfile')));
  visit(path.join(runtimeDir, 'extension'));
  visit(path.join(runtimeDir, 'workbench'));
  return 'acis-workbench:' + digest.digest('hex').slice(0, 16);
}

async function ensureImage(image, onLog) {
  if (builds.has(image)) return builds.get(image);
  const promise = (async () => {
    const found = await docker(['image', 'inspect', '--format', '{{.Id}}', image], { allowFailure: true });
    if (found.code !== 0) {
      onLog('Building the local interview workbench image.\n');
      await docker(['build', '--tag', image, '--file', path.join(runtimeDir, 'Dockerfile'), runtimeDir], { onLog });
    }
  })();
  builds.set(image, promise);
  try { await promise; } finally { builds.delete(image); }
}

async function nodeDirectories(root, rel = '') {
  const entries = await readdir(path.join(root, rel), { withFileTypes: true });
  const found = entries.some(e => e.isFile() && e.name === 'package.json') ? [rel] : [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.') || ['node_modules', '__pycache__', 'dist', 'build'].includes(entry.name)) continue;
    found.push(...await nodeDirectories(root, path.posix.join(rel, entry.name)));
  }
  return found;
}

function compose(attempt, args, options = {}) {
  const rt = attempt.runtime;
  const env = {
    ACIS_WORKSPACE: path.resolve(attempt.workspace), ACIS_IMAGE: rt.image,
    ACIS_PROTECTED: JSON.stringify(rt.protected)
  };
  const prefix = ['compose', '--project-name', rt.project, '--project-directory', runtimeDir,
    '--file', composeFile, '--file', rt.configPath];
  if (rt.database !== 'none') prefix.push('--profile', rt.database);
  return docker([...prefix, ...args], { ...options, env });
}

async function portUrl(attempt, containerPort) {
  const result = await compose(attempt, ['port', 'workbench', String(containerPort)]);
  const matched = result.stdout.trim().match(/^127\.0\.0\.1:(\d+)$/);
  if (!matched) throw new Error('Missing loopback binding for workspace port ' + containerPort + ': ' + result.stdout);
  return 'http://127.0.0.1:' + matched[1];
}

async function waitHttp(urls, timeout, check, signal) {
  const limit = Date.now() + timeout;
  let lastStatus = '';
  while (Date.now() < limit) {
    signal?.throwIfAborted();
    const statuses = await Promise.all(urls.map(async url => {
      try {
        const timeout = AbortSignal.timeout(2000);
        const res = await fetch(url, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout, redirect: 'manual' });
        await res.body?.cancel();
        lastStatus = new URL(url).origin + ' returned HTTP ' + res.status;
        return res.status < 400;
      } catch (err) { lastStatus = new URL(url).origin + ': ' + err.message; return false; }
    }));
    if (statuses.every(Boolean)) return;
    if (check) await check();
    await delay(350, undefined, { signal });
  }
  throw new Error('Application readiness timed out. ' + lastStatus);
}

function serviceExec(attempt, argv, onLog, signal) {
  if (!argv?.length) return Promise.resolve();
  return compose(attempt, ['exec', '-T', 'workbench', ...argv], { onLog, signal });
}

async function hasVolumes(rt, names, signal) {
  const result = await docker(['volume', 'inspect', '--format', '{{.Name}}',
    ...names.map(name => rt.project + '_' + name)], { allowFailure: true, signal });
  return result.code === 0;
}

const pendingInstall = rt => path.join(path.dirname(rt.configPath), 'installing');
const accessDirectory = rt => path.join(path.dirname(rt.configPath), 'editor-access');

async function publishEditorVerifier(rt, key) {
  const dir = accessDirectory(rt);
  await mkdir(dir, { recursive: true });
  const temp = path.join(dir, randomUUID());
  await writeFile(temp, createHash('sha256').update(key).digest('hex'));
  await rename(temp, path.join(dir, 'credential.sha256'));
}

async function setupVolumes(rt, signal) {
  const mounts = rt.nodeVolumes.flatMap((name, i) => ['--mount', 'type=volume,src=' + rt.project + '_' + name + ',dst=/deps' + i]);
  if (!mounts.length) return;
  await docker(['run', '--rm', '--network', 'none', '--user', '0', '--cap-drop', 'ALL', '--cap-add', 'CHOWN',
    ...mounts, '--entrypoint', 'chown', rt.image, '1000:1000', ...rt.nodeVolumes.map((_, i) => '/deps' + i)], { signal });
}

export async function prepare(attempt, pack, { editor = true, onLog = () => {}, signal } = {}) {
  if (!attempt.id || !path.isAbsolute(attempt.workspace)) throw new Error('A workspace and attempt ID are required.');
  const project = 'acis' + createHash('sha256').update(runtimeDir + '\n' + attempt.id).digest('hex').slice(0, 20);
  const configDir = path.join(path.dirname(attempt.workspace), '.runtime-' + project);
  await mkdir(configDir, { recursive: true });
  const stateFile = path.join(configDir, 'state.json');
  const configPath = path.join(configDir, 'compose.json');
  const prior = existsSync(stateFile) ? JSON.parse(await readFile(stateFile, 'utf8')) : null;
  const image = imageName();
  const packages = await nodeDirectories(attempt.workspace);
  const nodeVolumes = packages.map(folder => 'deps' + createHash('sha256').update(folder).digest('hex').slice(0, 12));
  const rt = { project, image, configPath, database: pack.database, protected: pack.protected || [],
    key: prior?.key || randomBytes(24).toString('hex'), editorEnabled: editor, nodeVolumes, editorUrl: '', previews: [] };
  attempt.runtime = rt;
  const deps = packages.map((folder, i) => nodeVolumes[i] + ':' + path.posix.join('/workspace', folder, 'node_modules'));
  const editorMounts = [...deps];
  if (editor) {
    await publishEditorVerifier(rt, rt.key);
    editorMounts.push({ type: 'bind', source: accessDirectory(rt), target: '/run/acis-editor', read_only: true });
  }
  const ports = [...pack.ports.map(p => p.port), ...(editor ? [9165] : [])];
  const overlay = { services: {
    workbench: { ports: ports.map(port => ({ target: port, host_ip: '127.0.0.1' })), volumes: editorMounts,
      ...(editor ? {} : { command: ['sleep', 'infinity'] }) },
    app: { volumes: deps, command: pack.run }
  }, volumes: Object.fromEntries(nodeVolumes.map(name => [name, {}])) };
  await writeFile(configPath, JSON.stringify(overlay));
  writeJson(stateFile, rt);
  await ensureImage(image, onLog);
  const readyPath = path.join(configDir, 'ready');
  const wasPrepared = existsSync(readyPath);
  const hasDeps = wasPrepared && !existsSync(pendingInstall(rt)) && await hasVolumes(rt, ['venv', ...nodeVolumes], signal);
  const hasData = wasPrepared && (pack.database === 'none' || await hasVolumes(rt, [pack.database + '-data'], signal));
  const services = [...(pack.database === 'none' ? [] : [pack.database]), 'workbench'];
  if (!hasDeps) await writeFile(pendingInstall(rt), '');
  await compose(attempt, ['up', '-d', '--wait', '--wait-timeout', '120', ...services], { onLog, signal });
  if (!hasDeps) {
    await setupVolumes(rt, signal);
    onLog('Installing project dependencies.\n');
    await serviceExec(attempt, pack.install, onLog, signal);
    await rm(pendingInstall(rt), { force: true });
  }
  if (!hasData) {
    onLog('Preparing initial data.\n');
    await serviceExec(attempt, pack.seed, onLog, signal);
  }
  await serviceExec(attempt, ['sh', '/opt/acis/workbench/initialize-git.sh'], onLog, signal);
  if (editor) {
    const origin = await portUrl(attempt, 9165);
    rt.editorUrl = origin + '/' + rt.key + '/?folder=/workspace';
    await waitHttp([origin + '/' + rt.key + '/healthz'], 60000, undefined, signal);
  }
  rt.previews = await Promise.all(pack.ports.map(async p => ({
    port: p.port, label: p.label, url: await portUrl(attempt, p.port) + (p.path || '/')
  })));
  await writeFile(readyPath, image);
  writeJson(stateFile, rt);
  return rt;
}

export async function rotateEditor(attempt) {
  const rt = attempt.runtime;
  await saveEditors(attempt);
  const key = randomBytes(24).toString('hex');
  const base = new URL(rt.editorUrl).origin + '/' + key;
  await publishEditorVerifier(rt, key);
  // The gateway closes prior sockets before acknowledging the new verifier.
  await waitHttp([base + '/healthz'], 10000);
  const editorUrl = base + '/?folder=/workspace';
  writeJson(path.join(path.dirname(rt.configPath), 'state.json'), { ...rt, key, editorUrl });
  Object.assign(rt, { key, editorUrl });
}

export function saveEditors(attempt) {
  if (!attempt.runtime?.editorEnabled || attempt.runtime.frozen) return Promise.resolve();
  let saving = saves.get(attempt.id);
  if (!saving) {
    saving = serviceExec(attempt, ['node', '/opt/acis/workbench/save.mjs'])
      .finally(() => saves.delete(attempt.id));
    saves.set(attempt.id, saving);
  }
  return saving;
}

export async function startApp(attempt, pack, onLog = () => {}, signal) {
  await saveEditors(attempt);
  await compose(attempt, ['up', '-d', '--force-recreate', '--no-deps', 'app'], { onLog, signal });
  const stream = new AbortController();
  const logger = compose(attempt, ['logs', '--no-color', '--no-log-prefix', '--follow', 'app'],
    { onLog, signal: stream.signal }).catch(() => {});
  let nextCheck = 0;
  try {
    const app = (await compose(attempt, ['ps', '--all', '-q', 'app'], { signal })).stdout.trim();
    await waitHttp(attempt.runtime.previews.map(p => p.url), 90000, async () => {
      if (Date.now() < nextCheck) return;
      nextCheck = Date.now() + 2000;
      const check = await docker(['inspect', '--format', '{{.State.Status}}', app], { signal });
      if (check.stdout.trim() !== 'running') {
        const log = await docker(['logs', '--tail', '25', app]);
        throw new Error('The application exited during startup.\n' + log.output);
      }
    }, signal);
    onLog('Application ready.\n');
    return attempt.runtime.previews;
  } finally {
    stream.abort();
    await logger;
  }
}

export async function stopApp(attempt) {
  await compose(attempt, ['stop', '--timeout', '2', 'app']);
}

export async function resetData(attempt, pack, onLog = () => {}, signal) {
  await serviceExec(attempt, pack.seed, onLog, signal);
}

export async function pauseEditor(attempt, { save = true } = {}) {
  if (!attempt.runtime || attempt.runtime.frozen) return;
  if (save) await saveEditors(attempt);
  await compose(attempt, ['stop', '--timeout', '3', 'app', 'workbench']);
  attempt.runtime.frozen = true;
}

export async function dispose(attempt) {
  if (!attempt.runtime || !existsSync(attempt.runtime.configPath)) return;
  await compose(attempt, ['down', '--volumes', '--remove-orphans', '--timeout', '2']);
}

const list = value => value == null ? [] : Array.isArray(value) ? value : [value];
export function parseJUnit(xml) {
  if (!xml?.trim() || XMLValidator.validate(xml) !== true || /<!DOCTYPE/i.test(xml)) {
    throw new Error('The test command did not produce a valid JUnit report.');
  }
  const parsed = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@', processEntities: true, htmlEntities: {},
    parseTagValue: false, trimValues: false }).parse(xml);
  const cases = [];
  function collect(suite) {
    for (const item of list(suite.testcase)) {
      const issue = item.failure ?? item.error ?? item.skipped;
      const detail = typeof issue === 'string' ? issue : [issue?.['@message'], issue?.['#text']].filter(Boolean).join('\n');
      cases.push({ name: String(item['@name'] || 'Unnamed test'), passed: issue === undefined,
        detail: detail || (item.skipped !== undefined ? 'Skipped' : '') });
    }
    for (const nested of list(suite.testsuite)) collect(nested);
  }
  if (parsed.testsuites) collect(parsed.testsuites);
  for (const suite of list(parsed.testsuite)) collect(suite);
  if (!cases.length) throw new Error('The test report contains no test cases.');
  return cases;
}

async function prepareGradingRuntime(attempt, pack, onLog, signal) {
  const rt = attempt.runtime;
  // Inspect volumes before Compose creates any missing ones while bringing up the database.
  const needsInstall = existsSync(pendingInstall(rt)) || !await hasVolumes(rt, ['venv', ...rt.nodeVolumes], signal);
  if (needsInstall) {
    await writeFile(pendingInstall(rt), '');
    await ensureImage(rt.image, onLog);
  }
  if (pack.database !== 'none') {
    const id = (await compose(attempt, ['ps', '--all', '--quiet', pack.database], { signal })).stdout.trim();
    const health = id && (await docker(['inspect', '--format', '{{.State.Status}} {{.State.Health.Status}}', id], { signal })).stdout.trim();
    if (health !== 'running healthy') {
      await compose(attempt, ['up', '-d', '--no-deps', '--no-recreate', '--wait', '--wait-timeout', '120', pack.database], { onLog, signal });
    }
  }
  if (needsInstall) {
    // Compose creates and labels the dependency volumes without starting an editor or preview.
    await compose(attempt, ['create', '--no-recreate', 'workbench'], { onLog, signal });
    await setupVolumes(rt, signal);
    await compose(attempt, ['run', '--rm', '-T', '--no-deps', 'workbench', ...pack.install], { onLog, signal });
    await rm(pendingInstall(rt), { force: true });
  }
}

export async function grade(attempt, pack, onLog = () => {}, signal) {
  signal?.throwIfAborted();
  const timeout = AbortSignal.timeout(240000);
  const cancellation = signal ? AbortSignal.any([timeout, signal]) : timeout;
  await prepareGradingRuntime(attempt, pack, onLog, cancellation);
  const name = attempt.runtime.project + '-grade-' + randomUUID().slice(0, 8);
  const temp = await mkdtemp(path.join(tmpdir(), 'acis-report-'));
  let created = false;
  try {
    // A fresh container gives the grader its own report path and process lifetime.
    // Only the dependency volumes and test database are shared with this attempt.
    await compose(attempt, ['run', '--detach', '-T', '--no-deps', '--name', name, 'workbench',
      'timeout', '--kill-after=3s', '235s', ...pack.test]);
    created = true;
    cancellation.throwIfAborted();
    const log = await docker(['logs', '--follow', name], { onLog, signal: cancellation });
    const status = Number((await docker(['wait', name], { signal: cancellation })).stdout.trim());
    const file = path.join(temp, 'report.xml');
    const copy = await docker(['cp', name + ':/tmp/acis-tests.xml', file], { allowFailure: true });
    if (copy.code !== 0) throw new Error('The test runner stopped before writing its report.\n' + log.output.slice(-4000));
    const cases = parseJUnit(await readFile(file, 'utf8'));
    const failed = cases.filter(item => !item.passed).length;
    // Mocha exits with its failed assertion count. Pytest reserves codes above 1 for runner errors.
    if (status > 1 && !(pack.runtime === 'node' && status === Math.min(255, failed))) {
      throw new Error('The test runner could not collect or finish its tests (exit ' + status + ').\n' + log.output.slice(-4000));
    }
    if (status !== 0 && !failed) throw new Error('The runner exited unsuccessfully despite its passing report.\n' + log.output.slice(-4000));
    return { cases, output: log.output };
  } finally {
    if (created) await docker(['rm', '--force', name], { allowFailure: true });
    await rm(temp, { recursive: true, force: true });
  }
}
