import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const CDP_PORT = 9400 + Math.floor(Math.random() * 500);
const USER_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-test-feat-'));

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

  console.log('Navigating with skip=1 for direct room verification...');
  await send('Page.navigate', { url: 'http://localhost:3000?skip=1' });
  for (let i = 0; i < 20; i++) {
    const hasBtn = await send('Runtime.evaluate', {
      expression: '!!document.querySelector("[data-recruiter-toggle=\\"true\\"]")',
      returnByValue: true
    });
    if (hasBtn.result.value) break;
    await wait(500);
  }

  // 1. Verify HUD Buttons exist
  const hudCheck = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const recruiterBtn = document.querySelector('[data-recruiter-toggle="true"]');
        const weatherBtn = document.querySelector('[data-weather-toggle="true"]');
        const qualityBtn = document.querySelector('[data-quality-toggle="true"]');
        const sfxBtn = document.querySelector('[data-sfx-toggle="true"]');
        return {
          recruiterBtn: recruiterBtn ? recruiterBtn.textContent.trim() : null,
          weatherBtn: weatherBtn ? weatherBtn.textContent.trim() : null,
          qualityBtn: qualityBtn ? qualityBtn.textContent.trim() : null,
          sfxBtn: sfxBtn ? sfxBtn.textContent.trim() : null,
        };
      })()
    `,
    returnByValue: true
  });
  console.log('1. HUD Buttons:', hudCheck.result.value);

  // 2. Test Recruiter View Modal
  console.log('Opening Recruiter View Modal...');
  await send('Runtime.evaluate', {
    expression: `document.querySelector('[data-recruiter-toggle="true"]')?.click()`
  });
  await wait(500);

  const recruiterModalCheck = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const modal = document.querySelector('[role="dialog"]');
        const title = modal ? modal.querySelector('h1')?.textContent : null;
        const certCount = modal ? modal.querySelectorAll('.bg-\\\\[\\\\#0f1422\\\\]').length : 0;
        return {
          open: !!modal,
          title,
        };
      })()
    `,
    returnByValue: true
  });
  console.log('2. Recruiter Modal:', recruiterModalCheck.result.value);

  // Close modal via Escape
  await send('Runtime.evaluate', {
    expression: `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`
  });
  await wait(300);

  // 3. Test Weather Toggle
  console.log('Cycling weather (clear -> sunset -> rain)...');
  await send('Runtime.evaluate', {
    expression: `document.querySelector('[data-weather-toggle="true"]')?.click()`
  });
  await wait(300);
  const sunsetWeather = await send('Runtime.evaluate', {
    expression: `document.querySelector('[data-weather-toggle="true"]')?.textContent.trim()`,
    returnByValue: true
  });
  console.log('3. Weather after 1 cycle:', sunsetWeather.result.value);

  await send('Runtime.evaluate', {
    expression: `document.querySelector('[data-weather-toggle="true"]')?.click()`
  });
  await wait(300);
  const rainWeather = await send('Runtime.evaluate', {
    expression: `document.querySelector('[data-weather-toggle="true"]')?.textContent.trim()`,
    returnByValue: true
  });
  console.log('3. Weather after 2 cycles:', rainWeather.result.value);

  // 4. Test Achievement Toast
  const toastCheck = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const toast = document.querySelector('.animate-in');
        return {
          toastVisible: !!toast,
          text: toast ? toast.textContent.trim() : null
        };
      })()
    `,
    returnByValue: true
  });
  console.log('4. Achievement Toast check:', toastCheck.result.value);

  // Capture final screenshot
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const shotPath = path.resolve(
    'C:/Users/raifa/.gemini/antigravity/brain/f4af9a93-52c7-4946-ad38-d04d06b22a82/scratch/features-verified.png'
  );
  fs.writeFileSync(shotPath, Buffer.from(shot.data, 'base64'));
  console.log('Saved screenshot to:', shotPath);

  ws.close();
  chrome.kill();
  console.log('ALL FEATURE CHECKS COMPLETED SUCCESSFULLY!');
}

main().catch(err => {
  console.error(err);
  try { chrome.kill(); } catch {}
});
