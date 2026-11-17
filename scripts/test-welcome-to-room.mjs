import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const CDP_PORT = 9490;
const USER_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-flow-'));

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
  await send('DOM.enable');

  console.log('Navigating to http://localhost:3000 (normal welcome screen)...');
  await send('Page.navigate', { url: 'http://localhost:3000' });

  // Wait 4 seconds for loading to finish and ready state
  await wait(4500);

  // Check state of enter button
  const buttonInfo = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const btn = document.querySelector('[data-enter-room-button="true"]');
        return {
          exists: !!btn,
          disabled: btn ? btn.disabled : null,
          text: btn ? btn.textContent.trim() : null,
          rect: btn ? btn.getBoundingClientRect() : null
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Enter button info:', buttonInfo.result.value);

  // Poll until button is enabled (ready = true)
  for (let i = 0; i < 20; i++) {
    const isReady = await send('Runtime.evaluate', {
      expression: `(() => {
        const btn = document.querySelector('[data-enter-room-button="true"]');
        return btn && !btn.disabled;
      })()`,
      returnByValue: true
    });
    if (isReady.result.value) {
      console.log('Enter button is ready and enabled!');
      break;
    }
    await wait(500);
  }

  // Click Enter Room
  console.log('Clicking Enter Room...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const btn = document.querySelector('[data-enter-room-button="true"]');
        if (btn) btn.click();
      })()
    `
  });

  // Wait for fadeout animation (1200ms)
  await wait(1500);

  // Inspect the canvas and layout now
  const afterEnter = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const canvas = document.querySelector('canvas');
        const canvasWrapper = document.querySelector('[data-canvas-wrapper]');
        return {
          window: { width: window.innerWidth, height: window.innerHeight },
          canvas: canvas ? {
            width: canvas.width,
            height: canvas.height,
            clientWidth: canvas.clientWidth,
            clientHeight: canvas.clientHeight,
            rect: canvas.getBoundingClientRect()
          } : null,
          canvasWrapper: canvasWrapper ? {
            rect: canvasWrapper.getBoundingClientRect(),
            height: getComputedStyle(canvasWrapper).height,
            width: getComputedStyle(canvasWrapper).width,
            position: getComputedStyle(canvasWrapper).position
          } : null,
        };
      })()
    `,
    returnByValue: true
  });
  console.log('After Enter Layout:', JSON.stringify(afterEnter.result.value, null, 2));

  // Take screenshot
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const shotPath = path.resolve(
    'C:/Users/raifa/.gemini/antigravity/brain/f4af9a93-52c7-4946-ad38-d04d06b22a82/scratch/welcome-enter-test.png'
  );
  fs.writeFileSync(shotPath, Buffer.from(shot.data, 'base64'));
  console.log('Saved screenshot to:', shotPath);

  ws.close();
  chrome.kill();
}

main().catch(err => {
  console.error(err);
  try { chrome.kill(); } catch {}
});
