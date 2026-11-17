import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const CDP_PORT = 9488;
const USER_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-inspect-'));

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

  console.log('Navigating to http://localhost:3000?skip=1...');
  await send('Page.navigate', { url: 'http://localhost:3000?skip=1' });

  // wait 5 seconds for scene to load
  await wait(5000);

  const evalResult = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const results = [];
        const canvas = document.querySelector('canvas');
        const canvasWrapper = document.querySelector('[data-canvas-wrapper]');
        const body = document.body;
        const html = document.documentElement;
        const divs = Array.from(document.querySelectorAll('div')).map(d => ({
          tag: d.tagName,
          id: d.id,
          className: d.className,
          rect: d.getBoundingClientRect(),
          style: {
            position: getComputedStyle(d).position,
            height: getComputedStyle(d).height,
            width: getComputedStyle(d).width,
            overflow: getComputedStyle(d).overflow,
            display: getComputedStyle(d).display
          }
        }));

        return {
          window: { width: window.innerWidth, height: window.innerHeight },
          body: { width: body.clientWidth, height: body.clientHeight, scrollHeight: body.scrollHeight },
          html: { width: html.clientWidth, height: html.clientHeight, scrollHeight: html.scrollHeight },
          canvas: canvas ? {
            width: canvas.width,
            height: canvas.height,
            clientWidth: canvas.clientWidth,
            clientHeight: canvas.clientHeight,
            rect: canvas.getBoundingClientRect()
          } : null,
          canvasWrapper: canvasWrapper ? {
            rect: canvasWrapper.getBoundingClientRect(),
            style: {
              height: getComputedStyle(canvasWrapper).height,
              width: getComputedStyle(canvasWrapper).width,
            }
          } : null,
          allDivs: divs.filter(d => d.rect.height > 0)
        };
      })()
    `,
    returnByValue: true,
  });

  console.log('DOM Layout Info:');
  console.log(JSON.stringify(evalResult.result.value, null, 2));

  // Take screenshot
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const shotPath = path.resolve(
    'C:/Users/raifa/.gemini/antigravity/brain/f4af9a93-52c7-4946-ad38-d04d06b22a82/scratch/inspect.png'
  );
  fs.mkdirSync(path.dirname(shotPath), { recursive: true });
  fs.writeFileSync(shotPath, Buffer.from(shot.data, 'base64'));
  console.log('Saved screenshot to:', shotPath);

  ws.close();
  chrome.kill();
}

main().catch((err) => {
  console.error(err);
  try {
    chrome.kill();
  } catch {}
});
