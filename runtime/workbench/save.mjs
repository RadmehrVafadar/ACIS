import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

(async () => {
  // code-server retains the extension host after the browser disconnects.
  if (!fs.existsSync('/tmp/acis-editor-connected')) return;
  try {
    process.kill(Number(fs.readFileSync('/tmp/acis-editor-live', 'utf8')), 0);
  } catch { return; }
  const request = randomUUID();
  fs.writeFileSync('/tmp/acis-save-request', request);
  for (let i = 0; i < 50; i++) {
    await delay(100);
    if (!fs.existsSync('/tmp/acis-save-ack')) continue;
    let ack;
    try { ack = JSON.parse(fs.readFileSync('/tmp/acis-save-ack', 'utf8')); } catch { continue; }
    if (ack.request !== request) continue;
    if (!ack.saved) throw Error('The IDE could not save all open files.');
    return;
  }
  throw Error('The IDE did not acknowledge Save All. Reconnect the editor and retry.');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
