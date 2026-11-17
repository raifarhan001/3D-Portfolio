import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const CDP_PORT = 9498;
const USER_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-key-test-'));

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    '--window-size=1920,1080',
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

  console.log('Navigating to http://localhost:3000?skip=1...');
  await send('Page.navigate', { url: 'http://localhost:3000?skip=1' });
  await wait(3500);

  // 1. Test KeyR
  console.log('Dispatching KeyR...');
  const keyRResult = await send('Runtime.evaluate', {
    expression: `
      (() => {
        let elsaCalled = false;
        // Monkey-patch comeToPlayer or check robot mode/waypoints
        const store = window.__useRobotStore ? window.__useRobotStore.getState() : null;
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR', key: 'r', bubbles: true }));
        const modal = document.querySelector('[role="dialog"]');
        return {
          recruiterModalOpened: !!modal,
        };
      })()
    `,
    returnByValue: true
  });
  console.log('KeyR test result:', keyRResult.result.value);

  // 2. Test KeyB
  console.log('Dispatching KeyB...');
  await send('Runtime.evaluate', {
    expression: `window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyB', key: 'b', bubbles: true }))`
  });
  await wait(300);

  const keyBResult = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const modal = document.querySelector('[role="dialog"]');
        return {
          recruiterModalOpenedWithKeyB: !!modal,
          title: modal ? modal.querySelector('h1')?.textContent : null
        };
      })()
    `,
    returnByValue: true
  });
  console.log('KeyB test result:', keyBResult.result.value);

  // Close with Escape
  await send('Runtime.evaluate', {
    expression: `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`
  });
  await wait(300);

  // 3. Test HUD button text
  const hudBtn = await send('Runtime.evaluate', {
    expression: `document.querySelector('[data-recruiter-toggle="true"]')?.textContent.trim()`,
    returnByValue: true
  });
  console.log('HUD Recruiter Button text:', hudBtn.result.value);

  ws.close();
  chrome.kill();
  console.log('TEST COMPLETED SUCCESSFULLY!');
}

main().catch(err => {
  console.error(err);
  try { chrome.kill(); } catch {}
});
