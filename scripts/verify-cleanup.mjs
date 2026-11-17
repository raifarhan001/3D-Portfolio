import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const CDP_PORT = 9400 + Math.floor(Math.random() * 500);
const USER_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-clean-test-'));

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

  // Check 1: Welcome page Quick View link
  console.log('Navigating to http://localhost:3000 (welcome page)...');
  await send('Page.navigate', { url: 'http://localhost:3000' });
  await wait(2500);

  const welcomeQuick = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const link = document.querySelector('[data-quick-view-link]');
        return {
          exists: !!link,
          href: link ? link.getAttribute('href') : null,
          text: link ? link.textContent.trim() : null
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Welcome Page Quick View Link:', welcomeQuick.result.value);
  assert.equal(welcomeQuick.result.value.exists, true);
  assert.equal(welcomeQuick.result.value.href, '/quick');

  // Check 2: Room HUD buttons
  console.log('Navigating to http://localhost:3000?skip=1...');
  await send('Page.navigate', { url: 'http://localhost:3000?skip=1' });

  for (let i = 0; i < 20; i++) {
    const hasHud = await send('Runtime.evaluate', {
      expression: '!!document.querySelector("[data-weather-toggle=\\"true\\"]")',
      returnByValue: true
    });
    if (hasHud.result.value) break;
    await wait(500);
  }

  const hudElements = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const recruiterBtn = document.querySelector('[data-recruiter-toggle]');
        const weatherBtn = document.querySelector('[data-weather-toggle="true"]');
        const qualityBtn = document.querySelector('[data-quality-toggle="true"]');
        const sfxBtn = document.querySelector('[data-sfx-toggle="true"]');
        const exitBtn = document.querySelector('[data-exit-room="true"]');
        return {
          recruiterBtnExists: !!recruiterBtn,
          weatherBtn: weatherBtn ? weatherBtn.textContent.trim() : null,
          qualityBtn: qualityBtn ? qualityBtn.textContent.trim() : null,
          sfxBtn: sfxBtn ? sfxBtn.textContent.trim() : null,
          exitBtn: exitBtn ? exitBtn.textContent.trim() : null,
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Room HUD Elements:', hudElements.result.value);
  assert.equal(hudElements.result.value.recruiterBtnExists, false, 'Recruiter button should be completely removed');
  assert.equal(hudElements.result.value.weatherBtn, '☀️ Clear');
  assert.equal(hudElements.result.value.exitBtn, 'Esc Exit Room');

  ws.close();
  chrome.kill();
  console.log('CLEANUP AND QUICK VIEW VERIFICATION PASSED!');
}

main().catch(err => {
  console.error(err);
  try { chrome.kill(); } catch {}
});
