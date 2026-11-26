import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { dispose, grade, parseJUnit, pauseEditor, prepare, rotateEditor, saveEditors, startApp } from '../server/runtime.mjs';

async function editInBrowser(url, attempt) {
  const { chromium } = await import('@playwright/test');
  const shell = createServer((_req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end('<iframe title="IDE" style="width:100vw;height:100vh;border:0" src="' + url + '"></iframe>');
  });
  await new Promise(resolve => shell.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch(process.platform === 'win32' ? { channel: 'msedge' } : {});
  try {
    const page = await browser.newPage({ viewport: { width: 430, height: 860 } });
    const editorSockets = new Set();
    page.on('websocket', socket => {
      if (!new URL(socket.url()).pathname.startsWith(new URL(url).pathname)) return;
      editorSockets.add(socket);
      socket.once('close', () => editorSockets.delete(socket));
    });
    const previewErrors = [];
    page.on('console', entry => { if (entry.type() === 'error') previewErrors.push(entry.text()); });
    page.on('requestfailed', request => previewErrors.push(request.failure()?.errorText + ' ' + new URL(request.url()).pathname));
    page.on('response', response => { if (response.status() >= 400) previewErrors.push(response.status() + ' ' + new URL(response.url()).pathname); });
    await page.goto('http://127.0.0.1:' + shell.address().port);
    const frame = page.frameLocator('iframe[title=IDE]');
    await frame.locator('.monaco-workbench').waitFor({ timeout: 60000 });
    await frame.getByRole('tab', { name: /preview.*readme|readme.*preview/i }).first().waitFor({ timeout: 40000 });
    let rendered = false;
    for (let n = 0; n < 35 && !rendered; n++) {
      const visible = await Promise.all(page.frames().map(nested => nested.getByRole('heading', {name:'Runtime exercise', exact:true}).isVisible().catch(() => false)));
      rendered = visible.some(Boolean);
      if (!rendered) await delay(300);
    }
    const chatOpen = await frame.getByText('Build with agent mode', {exact:true}).isVisible();
    assert.deepEqual({rendered, chatOpen}, {rendered:true, chatOpen:false}, 'README and chat layout. ' + previewErrors.join(' | '));
    const editorArea = await frame.locator('.part.editor').boundingBox();
    assert.ok(editorArea && editorArea.width > 325, 'The README should have room to read at narrow widths.');
    await frame.getByRole('tab', {name:/preview.*readme|readme.*preview/i}).click();
    await page.keyboard.press('Control+Shift+e');
    await frame.locator('.part.sidebar').getByText('answer.txt', {exact:true}).waitFor();
    await page.keyboard.press('Control+b');
    await frame.locator('.part.sidebar').waitFor({ state: 'hidden' });
    await frame.getByRole('tab', {name:/preview.*readme|readme.*preview/i}).press('Control+p');
    await frame.locator('.quick-input-widget input').fill('answer.txt');
    await frame.locator('.quick-input-list .monaco-list-row').filter({ hasText: 'answer.txt' }).first().click();
    const answerEditor = frame.locator('.monaco-editor[data-uri$="/answer.txt"]');
    await answerEditor.locator('.view-line').filter({ hasText: 'broken' }).first().click();
    await page.keyboard.press('Control+a');
    await page.keyboard.insertText('browser-edited');
    await answerEditor.locator('.view-line').filter({ hasText: 'browser-edited' }).first().waitFor();
    await Promise.all(Array.from({length: 6}, () => saveEditors(attempt)));
    assert.equal(await readFile(path.join(attempt.workspace, 'answer.txt'), 'utf8'), 'browser-edited');
    await page.keyboard.press('F5');
    let debugResult = '';
    for (let i = 0; i < 35 && !debugResult; i++) {
      await delay(300);
      try { debugResult = await readFile(path.join(attempt.workspace, 'debug-result.txt'), 'utf8'); } catch { /* Debugger still starting. */ }
    }
    assert.equal(debugResult, 'Python debugger ran');
    assert.ok(editorSockets.size, 'the active workbench has an editor connection');
    const closed = Array.from(editorSockets, socket => socket.waitForEvent('close', { timeout: 15000 }));
    await Promise.all([...closed, rotateEditor(attempt)]);
  } finally {
    await browser.close();
    await new Promise(resolve => shell.close(resolve));
  }
}

test('JUnit preserves real results and expanded assertions from nested suites', () => {
  const cases = parseJUnit('<testsuites><testsuite><testsuite><testcase name="works" /><testcase name="fails"><failure message="Expected 201">received 500</failure></testcase><testcase name="skip"><skipped/></testcase></testsuite></testsuite></testsuites>');
  assert.deepEqual(cases, [
    {name:'works', passed:true, detail:''},
    {name:'fails', passed:false, detail:'Expected 201\nreceived 500'},
    {name:'skip', passed:false, detail:'Skipped'}
  ]);
  assert.throws(() => parseJUnit('<invalid>'), /valid JUnit/);
  assert.throws(() => parseJUnit('<testsuite/>'), /no test cases/);
});

test('pytest numeric XML entities render as the original assertion and line breaks', () => {
  const xml = '<testsuite><testcase name="creation"><failure message="assert 500 == 201&#10;HTTP status">line&#xA;two &amp; three</failure></testcase></testsuite>';
  assert.equal(parseJUnit(xml)[0].detail, 'assert 500 == 201\nHTTP status\nline\ntwo & three');
});

test('Docker binds a real project, serves the IDE, cancels grading, and evaluates a frozen snapshot', {
  skip: process.env.ACIS_DOCKER_TESTS !== '1', timeout: 240000
}, async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'acis-runtime-test-'));
  const workspace = path.join(dir, 'workspace');
  await mkdir(workspace);
  const attempt = {id: randomUUID(), workspace};
  const pack = {runtime:'node', database:'none', protected:['README.md'], ports:[{port:8000,label:'App',path:'/'}],
    install: ['sh','-c','node --version && python --version && echo dependency > node_modules/test-marker'],
    seed: ['sh','-c','echo seeded > seed.txt'],
    run: ['node','app.cjs'], test:['node','check.cjs']};
  const files = {
    'README.md':'# Runtime exercise\n', 'package.json':'{"private":true}\n', 'answer.txt':'broken',
    'app.cjs':`
      const fs = require('node:fs');
      require('node:http').createServer((_, res) => {
        res.end(fs.readFileSync('answer.txt'));
      }).listen(8000, '0.0.0.0');
    `,
    'check.cjs':`
      const fs = require('node:fs');
      if (!fs.existsSync('node_modules/test-marker')) throw Error('dependency missing');
      const good = fs.readFileSync('answer.txt', 'utf8') === 'fixed';
      setTimeout(() => {
        const assertion = good ? '' : '<failure>wrong answer</failure>';
        const cases = ['answer', 'query'].map(name =>
          '<testcase name="' + name + '">' + assertion + '</testcase>').join('');
        fs.writeFileSync(process.env.ACIS_REPORT, '<testsuite>' + cases + '</testsuite>');
        process.exitCode = good ? 0 : 2;
      }, fs.existsSync('slow') ? 20000 : 5);
    `,
    'debug_target.py': "from pathlib import Path\nPath('debug-result.txt').write_text('Python debugger ran')\n"
  };
  await mkdir(path.join(workspace, '.vscode'));
  await writeFile(path.join(workspace, '.vscode', 'launch.json'), JSON.stringify({version:'0.2.0',
    configurations:[{name:'Debug exercise', type:'debugpy', request:'launch', program:'${workspaceFolder}/debug_target.py'}]}));
  await Promise.all(Object.entries(files).map(([file, data]) => writeFile(path.join(workspace, file), data)));
  try {
    const rt = await prepare(attempt, pack);
    await writeFile(path.join(workspace, 'seed.txt'), 'existing session data');
    await prepare(attempt, pack);
    assert.equal(await readFile(path.join(workspace, 'seed.txt'), 'utf8'), 'existing session data');
    const editor = await fetch(rt.editorUrl);
    assert.equal(editor.status, 200);
    assert.match(await editor.text(), /workbench|VS Code|code-server/i);
    assert.equal((await fetch(new URL('/invalid', rt.editorUrl))).status, 404);
    if (process.env.ACIS_BROWSER_TESTS === '1') {
      await editInBrowser(rt.editorUrl, attempt);
      await writeFile(path.join(workspace, 'answer.txt'), 'broken');
    }
    await startApp(attempt, pack);
    assert.equal(await (await fetch(rt.previews[0].url)).text(), 'broken');
    const previousEditor = attempt.runtime.editorUrl;
    await rotateEditor(attempt);
    assert.notEqual(attempt.runtime.editorUrl, previousEditor);
    assert.equal((await fetch(previousEditor)).status, 404);
    assert.equal((await fetch(attempt.runtime.editorUrl)).status, 200);
    assert.equal(await (await fetch(rt.previews[0].url)).text(), 'broken');
    assert.equal(await readFile(path.join(workspace, 'seed.txt'), 'utf8'), 'existing session data');
    assert.deepEqual((await grade(attempt, pack)).cases.map(item => item.passed), [false, false]);
    await writeFile(path.join(workspace, 'slow'), 'yes');
    const cancel = new AbortController();
    const grading = grade(attempt, pack, () => {}, cancel.signal);
    await delay(1000);
    cancel.abort();
    await assert.rejects(grading, {name:'AbortError'});
    await rm(path.join(workspace, 'slow'));
    await writeFile(path.join(workspace, 'answer.txt'), 'fixed');
    await pauseEditor(attempt);
    const snapshot = path.join(dir, 'snapshot');
    await mkdir(snapshot);
    for (const file of Object.keys(files)) await writeFile(path.join(snapshot,file), await readFile(path.join(workspace,file)));
    assert.equal((await grade({...attempt, workspace:snapshot}, pack)).cases[0].passed, true);
  } finally {
    if (attempt.runtime) await dispose(attempt);
    await rm(dir,{recursive:true,force:true});
  }
});
