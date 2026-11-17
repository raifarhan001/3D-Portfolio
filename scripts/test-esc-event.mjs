import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const CDP_PORT = 9499;
const USER_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-esc-test-'));

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    '--window-size=1280,720',
    '--disable-gpu-sandbox',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${USER_DATA}`,
    'about:blank',
  ],
  { stdio: ['ignore', 'pipe', 'pipe'] }
);

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  await wait(1500);

  const targetsRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json`);
  const targets = await targetsRes.json();
  const pageTarget = targets.find((t) => t.type === 'page') || targets[0];

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

  let idCounter = 1;
  const pending = new Map();

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
    }
  };

  await new Promise((r) => (ws.onopen = r));

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = idCounter++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });

  await send('Page.enable');
  await send('Runtime.enable');

  await send('Page.navigate', { url: 'http://localhost:3000?skip=1' });
  await wait(3000);

  // Set up listener for Escape keydown
  await send('Runtime.evaluate', {
    expression: `
      window.__escFired = false;
      window.addEventListener('keydown', (e) => {
        if (e.code === 'Escape') {
          window.__escFired = true;
        }
      }, true);
    `
  });

  // Dispatch Escape key via Input.dispatchKeyEvent
  await send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    code: 'Escape',
    key: 'Escape',
    windowsVirtualKeyCode: 27,
    nativeVirtualKeyCode: 27
  });

  await wait(200);

  const fired = await send('Runtime.evaluate', {
    expression: 'window.__escFired',
    returnByValue: true
  });

  console.log('Escape keydown fired in browser:', fired.result.value);

  ws.close();
  chrome.kill();
}

main().catch(err => {
  console.error(err);
  try { chrome.kill(); } catch {}
});
