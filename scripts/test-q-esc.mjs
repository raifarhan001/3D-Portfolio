import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const CDP_PORT = 9400 + Math.floor(Math.random() * 500);
const USER_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-q-esc-'));

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

async function getWsUrl() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json`);
      const pages = await res.json();
      const page = pages.find((p) => p.type === 'page') || pages[0];
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {}
    await wait(250);
  }
  throw new Error('CDP target not available');
}

async function main() {
  const wsUrl = await getWsUrl();
  const ws = new WebSocket(wsUrl);

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

  // 1. Enter an interaction (e.g. Gramophone focus)
  console.log('Triggering gramophone focus interaction...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        window.__enterFocusMode?.('gramophone');
      })()
    `
  });
  await wait(500);

  const focusState1 = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const inputStore = window.__useInputStore?.getState?.();
        return {
          mode: inputStore ? inputStore.mode : null,
          focusKind: inputStore ? inputStore.focusKind : null,
          overlayVisible: !!document.querySelector('[data-gramophone-ui]')
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Interaction state before Q:', focusState1.result.value);

  // 2. Press 'Q' to return to room
  console.log('Pressing Q to return to room...');
  await send('Runtime.evaluate', {
    expression: `window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ', key: 'q', bubbles: true }))`
  });
  await wait(500);

  const focusStateAfterQ = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const inputStore = window.__useInputStore?.getState?.();
        return {
          mode: inputStore ? inputStore.mode : null,
          focusKind: inputStore ? inputStore.focusKind : null,
          overlayVisible: !!document.querySelector('[data-gramophone-ui]')
        };
      })()
    `,
    returnByValue: true
  });
  console.log('State after pressing Q (returned to room):', focusStateAfterQ.result.value);

  // 3. Now in room, press 'Escape' to exit room to Welcome Screen
  console.log('Pressing Escape to exit room...');
  await send('Runtime.evaluate', {
    expression: `window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true }))`
  });
  await wait(500);

  const stateAfterEsc = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const inputStore = window.__useInputStore?.getState?.();
        const welcomeScreen = document.querySelector('[data-enter-room-button]');
        return {
          mode: inputStore ? inputStore.mode : null,
          welcomeScreenVisible: !!welcomeScreen
        };
      })()
    `,
    returnByValue: true
  });
  console.log('State after pressing Escape (exited to Welcome):', stateAfterEsc.result.value);

  ws.close();
  chrome.kill();
  console.log('ALL Q & ESC TESTS COMPLETED!');
}

main().catch(err => {
  console.error(err);
  try { chrome.kill(); } catch {}
});
