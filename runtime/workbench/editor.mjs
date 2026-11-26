import fs from 'node:fs';
import { createHash } from 'node:crypto';
import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';

const directory = '/home/coder/.local/share/code-server/User';
fs.mkdirSync(directory, { recursive: true });
fs.writeFileSync(directory + '/settings.json', JSON.stringify({
  'files.autoSave': 'afterDelay',
  'files.autoSaveDelay': 250,
  'files.readonlyInclude': Object.fromEntries(JSON.parse(process.env.ACIS_PROTECTED || '[]').map(file => [file, true])),
  'workbench.startupEditor': 'none',
  'workbench.colorTheme': 'Default Dark Modern',
  'workbench.sideBar.location': 'left',
  'workbench.activityBar.location': 'default',
  'workbench.secondarySideBar.defaultVisibility': 'hidden',
  'chat.disableAIFeatures': true,
  'window.menuBarVisibility': 'compact',
  'editor.minimap.enabled': false,
  'git.openRepositoryInParentFolders': 'never',
  'extensions.autoCheckUpdates': false,
  'extensions.autoUpdate': false,
  'telemetry.telemetryLevel': 'off'
}, null, 2));

// Publish only the capability-prefixed workbench URL. VS Code stays on container loopback.
const upstream = 9166;
const child = spawn('code-server', [
  '--bind-addr', '127.0.0.1:' + upstream, '--auth', 'none', '--disable-telemetry',
  '--disable-update-check', '--disable-workspace-trust', '--disable-getting-started-override',
  '--disable-proxy', '--extensions-dir', '/opt/acis/extensions', '--app-name', 'ACIS Workbench', '/workspace'
], { stdio: 'inherit' });
child.on('exit', code => process.exit(code ?? 0));

const connections = new Set();
const clientMarker = '/tmp/acis-editor-connected';
let clients = 0;
fs.rmSync(clientMarker, { force: true });
let verifier = '';
function reloadVerifier() {
  let next = '';
  try { next = fs.readFileSync('/run/acis-editor/credential.sha256', 'utf8').trim(); } catch { /* Deny access until mounted. */ }
  if (next === verifier) return;
  verifier = next;
  for (const disconnect of connections) disconnect();
  connections.clear();
}
setInterval(reloadVerifier, 250).unref();

function authorizedPrefix(request) {
  if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(request.headers.host || '')) return;
  const match = /^\/([0-9a-f]{48})\//.exec(request.url);
  if (!match) return;
  const digest = createHash('sha256').update(match[1]).digest('hex');
  if (digest !== verifier) reloadVerifier();
  if (digest === verifier) return '/' + match[1];
}

const proxy = http.createServer((request, response) => {
  const prefix = authorizedPrefix(request);
  if (!prefix) { response.writeHead(404); response.end(); return; }
  const target = http.request({
    host: '127.0.0.1', port: upstream, method: request.method,
    path: request.url.slice(prefix.length), headers: request.headers
  }, incoming => {
    const headers = { ...incoming.headers };
    delete headers['x-frame-options'];
    if (headers['content-security-policy']) {
      headers['content-security-policy'] = headers['content-security-policy'].replace(/frame-ancestors[^;]*/gi, "frame-ancestors 'self' http://127.0.0.1:* http://localhost:*");
    }
    if (headers.location?.startsWith('/')) headers.location = prefix + headers.location;
    response.writeHead(incoming.statusCode, headers);
    incoming.pipe(response);
  });
  const disconnect = () => { target.destroy(); response.destroy(); };
  connections.add(disconnect);
  response.once('close', () => { connections.delete(disconnect); target.destroy(); });
  target.on('error', () => { if (!response.headersSent) response.writeHead(503); response.end('Starting the workbench'); });
  request.pipe(target);
});
proxy.on('upgrade', (request, browser, head) => {
  const prefix = authorizedPrefix(request);
  if (!prefix) { browser.destroy(); return; }
  const server = net.connect(upstream, '127.0.0.1', () => {
    const lines = [request.method + ' ' + request.url.slice(prefix.length) + ' HTTP/' + request.httpVersion];
    for (let i = 0; i < request.rawHeaders.length; i += 2) lines.push(request.rawHeaders[i] + ': ' + request.rawHeaders[i + 1]);
    server.write(lines.join('\r\n') + '\r\n\r\n');
    if (head.length) server.write(head);
    server.pipe(browser).pipe(server);
  });
  server.on('error', () => browser.destroy());
  browser.on('error', () => server.destroy());
  const disconnect = () => { browser.destroy(); server.destroy(); };
  connections.add(disconnect);
  if (++clients === 1) fs.writeFileSync(clientMarker, '');
  browser.once('close', () => {
    connections.delete(disconnect);
    server.destroy();
    if (--clients === 0) fs.rmSync(clientMarker, { force: true });
  });
});
proxy.listen(9165, '0.0.0.0');
