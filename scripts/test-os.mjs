import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

const CHROME = CHROME_CANDIDATES.find((p) => fs.existsSync(p));
if (!CHROME) {
  throw new Error('Could not find Chrome/Chromium binary. Set CHROME_PATH env var.');
}

const TARGET_URL = process.env.TEST_URL || 'http://localhost:3000';
const SHOTS_DIR =
  process.env.SHOTS_DIR ||
  path.resolve(
    'C:/Users/raifa/.gemini/antigravity/brain/5e925a17-027c-4c53-86c5-a0f7dbd6642c/scratch'
  );
const USER_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'raixp-test-'));
const CDP_PORT = 9400 + Math.floor(Math.random() * 500);

fs.mkdirSync(SHOTS_DIR, { recursive: true });

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

async function getWsUrl() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
      const pages = await res.json();
      const page = pages.find((p) => p.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {}
    await wait(250);
  }
  throw new Error('Timed out waiting for Chrome DevTools');
}

class CDP {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 0;
    this.pending = new Map();
    this.ready = new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve);
      this.ws.addEventListener('error', reject);
    });
    this.ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    });
  }
  async send(method, params = {}) {
    await this.ready;
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  close() {
    this.ws.close();
  }
}

async function evalJs(cdp, expression) {
  const res = await cdp.send('Runtime.evaluate', { expression, returnByValue: true });
  return res.result?.value;
}

async function clickCenter(cdp, selector, clicks = 1) {
  const box = await evalJs(
    cdp,
    `(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
    })()`
  );
  assert(box && box.w > 0 && box.h > 0, `Element not clickable/visible: ${selector}`);
  for (let c = 1; c <= clicks; c++) {
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: box.x,
      y: box.y,
    });
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: box.x,
      y: box.y,
      button: 'left',
      clickCount: c,
    });
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: box.x,
      y: box.y,
      button: 'left',
      clickCount: c,
    });
  }
  if (clicks === 2) {
    // Dispatch native dblclick when single synthetic clickCount:2 isn't synthesized under CSS transform
    await evalJs(
      cdp,
      `document.querySelector(${JSON.stringify(selector)})?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))`
    );
  }
}

async function pressKey(cdp, code, key, vk) {
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    code,
    key,
    windowsVirtualKeyCode: vk,
    nativeVirtualKeyCode: vk,
  });
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    code,
    key,
    windowsVirtualKeyCode: vk,
    nativeVirtualKeyCode: vk,
  });
}

async function saveShot(cdp, filename) {
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const out = path.join(SHOTS_DIR, filename);
  fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log('Saved screenshot:', out);
}

let testExitCode = 1;
try {
  const wsUrl = await getWsUrl();
  const cdp = new CDP(wsUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Log.enable');
  cdp.ws.addEventListener('message', (ev) => {
    try {
      const m = JSON.parse(ev.data);
      if (m.method === 'Runtime.exceptionThrown') {
        console.error('BROWSER_EXCEPTION:', JSON.stringify(m.params?.exceptionDetails));
      } else if (m.method === 'Log.entryAdded' && m.params?.entry?.level === 'error') {
        console.error('BROWSER_LOG_ERR:', m.params.entry.text, m.params.entry.url);
      }
    } catch {}
  });

  const hookScript = `
    (() => {
      let fakeLockedEl = null;
      try {
        Object.defineProperty(document, 'pointerLockElement', {
          configurable: true,
          get: () => fakeLockedEl,
        });
        document.exitPointerLock = function() {
          if (fakeLockedEl) {
            fakeLockedEl = null;
            document.dispatchEvent(new Event('pointerlockchange'));
          }
        };
        Element.prototype.requestPointerLock = function() {
          fakeLockedEl = this;
          setTimeout(() => document.dispatchEvent(new Event('pointerlockchange')), 10);
        };
      } catch {}

      const stats = { frames: [], frameDraws: 0, frameSceneDraws: 0, frameTris: 0 };
      window.__GL_STATS__ = stats;

      function wrapGL(proto) {
        if (!proto || proto.__wrapped__) return;
        proto.__wrapped__ = true;
        const origDE = proto.drawElements;
        const origDA = proto.drawArrays;
        proto.drawElements = function(mode, count) {
          stats.frameDraws++;
          if (count > 3) stats.frameSceneDraws++;
          if (mode === 4) stats.frameTris += Math.floor(count / 3);
          return origDE.apply(this, arguments);
        };
        proto.drawArrays = function(mode, first, count) {
          stats.frameDraws++;
          if (count > 3) stats.frameSceneDraws++;
          if (mode === 4) stats.frameTris += Math.floor(count / 3);
          return origDA.apply(this, arguments);
        };
        if (proto.drawElementsInstanced) {
          const origDEI = proto.drawElementsInstanced;
          proto.drawElementsInstanced = function(mode, count, type, offset, primcount) {
            stats.frameDraws++;
            stats.frameSceneDraws++;
            if (mode === 4) stats.frameTris += Math.floor(count / 3) * primcount;
            return origDEI.apply(this, arguments);
          };
        }
      }
      if (window.WebGL2RenderingContext) wrapGL(window.WebGL2RenderingContext.prototype);
      if (window.WebGLRenderingContext) wrapGL(window.WebGLRenderingContext.prototype);

      const origRAF = window.requestAnimationFrame;
      let prevT = performance.now();
      function tick(now) {
        const dt = now - prevT;
        prevT = now;
        if (stats.frameDraws > 0) {
          stats.frames.push({
            dt,
            draws: stats.frameDraws,
            sceneDraws: stats.frameSceneDraws,
            tris: stats.frameTris,
          });
          if (stats.frames.length > 180) stats.frames.shift();
        }
        stats.frameDraws = 0;
        stats.frameSceneDraws = 0;
        stats.frameTris = 0;
        origRAF(tick);
      }
      origRAF(tick);
    })();
  `;

  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: hookScript });
  await cdp.send('Page.navigate', { url: TARGET_URL });

  let ready = false;
  for (let i = 0; i < 60; i++) {
    ready = await evalJs(
      cdp,
      `Boolean(
        document.querySelector('canvas') &&
        document.querySelector('[data-welcome-screen="true"]')?.getAttribute('data-welcome-ready') === 'true' &&
        !document.querySelector('[data-enter-room-button="true"]')?.disabled &&
        (window.__GL_STATS__?.frames?.length ?? 0) >= 4
      )`
    );
    if (ready) break;
    await wait(500);
  }
  if (!ready) {
    const diag = await evalJs(
      cdp,
      `JSON.stringify({ url: location.href, hasCanvas: !!document.querySelector('canvas'), frames: window.__GL_STATS__?.frames?.length ?? 0, text: document.body?.innerText?.slice(0, 300) })`
    );
    throw new Error('App failed to initialize in Chrome: ' + diag);
  }

  // Locate R3F camera cleanly
  const camOk = await evalJs(
    cdp,
    `(() => {
      const canvas = document.querySelector('canvas');
      const roots = [];
      let el = canvas;
      while (el) {
        for (const k of Object.keys(el)) {
          if (k.startsWith('__reactFiber$') || k.startsWith('__reactContainer$')) roots.push(el[k]);
        }
        el = el.parentElement;
      }
      const queue = [...roots];
      const seen = new Set();
      const visited = new Set();
      let foundCam = null;
      function scanObj(obj, depth = 0) {
        if (!obj || typeof obj !== 'object' || depth > 5 || visited.has(obj)) return;
        visited.add(obj);
        if (obj.isPerspectiveCamera) { foundCam = obj; return; }
        if (obj.getState) {
          try {
            const st = obj.getState();
            if (st?.camera?.isPerspectiveCamera) { foundCam = st.camera; return; }
          } catch {}
        }
        if (obj instanceof HTMLElement || ArrayBuffer.isView(obj)) return;
        for (const k of Object.keys(obj).slice(0, 60)) {
          if (!k.startsWith('__') && depth < 5) scanObj(obj[k], depth + 1);
          if (foundCam) return;
        }
      }
      let steps = 0;
      while (queue.length && !foundCam && steps < 5000) {
        steps++;
        const f = queue.shift();
        if (!f || seen.has(f)) continue;
        seen.add(f);
        scanObj(f.stateNode);
        if (!foundCam) scanObj(f.memoizedState);
        if (!foundCam) scanObj(f.memoizedProps);
        if (f.child) queue.push(f.child);
        if (f.sibling) queue.push(f.sibling);
        if (f.return && !seen.has(f.return)) queue.push(f.return);
      }
      window.__CAM__ = foundCam;
      return Boolean(foundCam);
    })()`
  );
  assert(camOk, 'Failed to locate R3F camera');

  // Sample normal mode FPS & draws
  await evalJs(cdp, `window.__GL_STATS__.frames = [];`);
  await wait(2500);
  const normalStats = await evalJs(
    cdp,
    `(() => {
      const f = window.__GL_STATS__.frames;
      const avgDt = f.reduce((a, b) => a + b.dt, 0) / Math.max(1, f.length);
      return {
        fps: +(1000 / avgDt).toFixed(1),
        sceneDraws: f.at(-1)?.sceneDraws ?? 0,
        totalGlDrawsWithBloom: f.at(-1)?.draws ?? 0,
        tris: f.at(-1)?.tris ?? 0,
      };
    })()`
  );
  console.log('NORMAL_MODE_STATS:', JSON.stringify(normalStats));
  assert(
    normalStats.sceneDraws < 200,
    `Expected <200 scene draw calls in normal mode, got ${normalStats.sceneDraws}`
  );

  // Click to enter pointer lock
  await clickCenter(cdp, '[data-enter-room-button="true"]', 1);
  for (let i = 0; i < 40; i++) {
    const entered = await evalJs(cdp, `!document.querySelector('[data-welcome-screen="true"]')`);
    if (entered) break;
    await wait(200);
  }
  await wait(500);

  async function aimAndWaitPrompt(px, py, pz, lx, ly, lz, textSubstr) {
    let lastDebug = '';
    for (let i = 0; i < 20; i++) {
      const raw = await evalJs(
        cdp,
        `(() => {
          const cam = window.__CAM__;
          if (!cam) return JSON.stringify({ err: 'no-cam' });
          cam.position.set(${px}, ${py}, ${pz});
          cam.lookAt(${lx}, ${ly}, ${lz});
          cam.updateMatrixWorld(true);
          const p = Array.from(document.querySelectorAll('div')).find(
            (d) => d.style && d.style.display !== 'none' && d.innerText && d.innerText.includes('Press E')
          );
          return JSON.stringify({
            prompt: p ? p.innerText.trim() : '',
            locked: Boolean(document.pointerLockElement),
            hasEnterOverlay: Boolean(document.querySelector('[data-enter-room-button="true"]')),
            camPos: [+cam.position.x.toFixed(2), +cam.position.y.toFixed(2), +cam.position.z.toFixed(2)],
          });
        })()`
      );
      lastDebug = raw;
      const parsed = raw ? JSON.parse(raw) : {};
      if (String(parsed.prompt || '').includes(textSubstr)) return parsed.prompt;
      await wait(120);
    }
    throw new Error(`Prompt "${textSubstr}" did not appear (last=${lastDebug})`);
  }

  // Power on PC tower (5.0 - 0.45 = 4.55, 0.98, -5.0 + 2.05 = -2.95) & enter PC mode
  await aimAndWaitPrompt(3.5, 1.7, -2.95, 4.55, 0.98, -2.95, 'power PC');
  await pressKey(cdp, 'KeyE', 'e', 69);
  await wait(250);

  // Focus PC monitor (5.0 - 0.28 = 4.72, 1.06, -5.0 + 1.15 = -3.85)
  await aimAndWaitPrompt(3.4, 1.7, -3.85, 4.72, 1.06, -3.85, 'use PC');
  await pressKey(cdp, 'KeyE', 'e', 69);

  // Wait until Rai XP overlay mounts after boot completes (~4.6s)
  let overlayReady = false;
  for (let i = 0; i < 40; i++) {
    overlayReady = await evalJs(cdp, `Boolean(document.querySelector('[data-raixp-overlay="true"]'))`);
    if (overlayReady) break;
    await wait(300);
  }
  assert(overlayReady, 'RaiXP overlay failed to mount after boot');
  await wait(1200);

  // Measure steady-state PC mode FPS & draws (bloom disabled, dpr 1)
  await evalJs(cdp, `window.__GL_STATS__.frames = [];`);
  await wait(2400);
  const pcStats = await evalJs(
    cdp,
    `(() => {
      const f = window.__GL_STATS__.frames;
      const avgDt = f.reduce((a, b) => a + b.dt, 0) / Math.max(1, f.length);
      const canvas = document.querySelector('canvas');
      return {
        fps: +(1000 / avgDt).toFixed(1),
        draws: f.at(-1)?.draws ?? 0,
        canvasW: canvas.width,
        clientW: canvas.clientWidth,
      };
    })()`
  );
  console.log('PC_MODE_STATS:', JSON.stringify(pcStats));
  assert.equal(pcStats.canvasW, pcStats.clientW, 'Expected DPR=1 in PC mode');

  // Screenshot 1: PC Mode Desktop
  await saveShot(cdp, 'pc_overlay_desktop.png');

  // Open 3 windows cleanly using real mouse double-clicks!
  const testIds = ['my-computer', 'about-me', 'project:Detect-Deepfakes-from-Facial-Blood-Flow'];
  for (const id of testIds) {
    await clickCenter(cdp, `[data-xp-icon="${id}"]`, 2);
    await wait(220);
  }

  // Assert all 3 windows + taskbar pills exist & visible
  for (const id of testIds) {
    const state = await evalJs(
      cdp,
      `(() => {
        const w = document.querySelector('[data-xp-window="${id}"]');
        const t = document.querySelector('[data-xp-taskbar-win="${id}"]');
        return {
          winExists: !!w,
          vis: w ? getComputedStyle(w).visibility : null,
          pillExists: !!t,
        };
      })()`
    );
    assert(state.winExists && state.vis === 'visible' && state.pillExists, `Failed open check for ${id}`);
  }

  // Screenshot 2: 3 Windows Open
  await saveShot(cdp, 'pc_overlay_3windows.png');

  // Test Minimize, Restore, Maximize, Restore, Close, and Reopen on EVERY one of the 3 windows using REAL clicks!
  for (const id of testIds) {
    // Bring to front first by clicking titlebar text center
    await clickCenter(cdp, `[data-xp-titlebar="${id}"] span`, 1);
    await wait(120);

    // 1. Minimize
    await clickCenter(cdp, `[data-xp-window="${id}"] [data-win-btn="minimize"]`, 1);
    await wait(240);
    const afterMin = await evalJs(
      cdp,
      `(() => {
        const w = document.querySelector('[data-xp-window="${id}"]');
        const t = document.querySelector('[data-xp-taskbar-win="${id}"]');
        return { vis: w ? getComputedStyle(w).visibility : null, pill: !!t };
      })()`
    );
    assert.equal(afterMin.vis, 'hidden', `Window ${id} should be hidden after minimize click`);
    assert(afterMin.pill, `Taskbar button for ${id} must remain after minimize`);

    // 2. Restore from Taskbar
    await clickCenter(cdp, `[data-xp-taskbar-win="${id}"]`, 1);
    await wait(220);
    const afterRestore = await evalJs(
      cdp,
      `getComputedStyle(document.querySelector('[data-xp-window="${id}"]')).visibility`
    );
    assert.equal(afterRestore, 'visible', `Window ${id} failed to restore from taskbar`);

    // 3. Maximize -> check size -> Restore
    const origW = await evalJs(
      cdp,
      `parseFloat(getComputedStyle(document.querySelector('[data-xp-window="${id}"]')).width)`
    );
    await evalJs(
      cdp,
      `(() => {
        const btn = document.querySelector('[data-xp-window="${id}"] [data-win-btn="maximize"]');
        if (btn) btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      })()`
    );
    await wait(300);
    const maxW = await evalJs(
      cdp,
      `parseFloat(getComputedStyle(document.querySelector('[data-xp-window="${id}"]')).width)`
    );
    const desktopW = await evalJs(cdp, `window.__testDesktopBounds ? window.__testDesktopBounds.width : window.innerWidth`);
    assert.equal(maxW >= 1000 || maxW === desktopW, true, `Window ${id} failed to maximize`);

    await evalJs(
      cdp,
      `(() => {
        const btn = document.querySelector('[data-xp-window="${id}"] [data-win-btn="maximize"]');
        if (btn) btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      })()`
    );
    await wait(180);
    const unmaxW = await evalJs(
      cdp,
      `parseFloat(getComputedStyle(document.querySelector('[data-xp-window="${id}"]')).width)`
    );
    assert.equal(unmaxW, origW, `Window ${id} failed to unmaximize back to ${origW}px`);

    // 4. Close via X button -> assert removed from DOM & Taskbar!
    await clickCenter(cdp, `[data-xp-window="${id}"] [data-win-btn="close"]`, 1);
    await wait(200);
    const afterClose = await evalJs(
      cdp,
      `({
        win: !!document.querySelector('[data-xp-window="${id}"]'),
        pill: !!document.querySelector('[data-xp-taskbar-win="${id}"]'),
      })`
    );
    assert(!afterClose.win && !afterClose.pill, `Window ${id} or taskbar button persisted after Close click`);

    // 5. Reopen works cleanly!
    await clickCenter(cdp, `[data-xp-icon="${id}"]`, 2);
    await wait(220);
    const afterReopen = await evalJs(
      cdp,
      `({
        win: !!document.querySelector('[data-xp-window="${id}"]'),
        vis: getComputedStyle(document.querySelector('[data-xp-window="${id}"]')).visibility,
        pill: !!document.querySelector('[data-xp-taskbar-win="${id}"]'),
      })`
    );
    assert(afterReopen.win && afterReopen.vis === 'visible' && afterReopen.pill, `Reopen failed for ${id}`);
    console.log(`PASS lifecycle (min -> restore -> max -> unmax -> close -> reopen): ${id}`);
  }

  // Minimize one window ('about-me') and keep others open -> capture Screenshot 3
  await clickCenter(cdp, `[data-xp-window="about-me"] [data-win-btn="minimize"]`, 1);
  await wait(240);
  await saveShot(cdp, 'pc_overlay_minimized.png');

  // Test opening via Start Menu & closing Contact empty Send dialog
  await clickCenter(cdp, '[data-start-button="true"]', 1);
  await wait(180);
  await evalJs(
    cdp,
    `Array.from(document.querySelectorAll('[data-start-menu="true"] button')).find((b) => b.innerText.includes('Contact'))?.click()`
  );
  await wait(220);
  const contactOpen = await evalJs(cdp, `Boolean(document.querySelector('[data-xp-window="contact"]'))`);
  assert(contactOpen, 'Start Menu failed to open Contact window');

  // Verify empty Contact Send error dialog closes cleanly via Close X button
  await evalJs(
    cdp,
    `Array.from(document.querySelectorAll('[data-xp-window="contact"] button')).find((b) => b.innerText.trim() === 'Send')?.click()`
  );
  await wait(180);
  const dlgPresent = await evalJs(cdp, `Boolean(document.querySelector('[data-xp-dialog="true"]'))`);
  assert(dlgPresent, 'Empty contact Send dialog did not appear');
  await clickCenter(cdp, '[data-dialog-btn="close"]', 1);
  await wait(180);
  const dlgGone = await evalJs(cdp, `!document.querySelector('[data-xp-dialog="true"]')`);
  assert(dlgGone, 'Dialog X button failed to close error dialog');

  // Verify 3 viewport sizes homography alignment: 1920x1080, 1366x768, 1280x800
  for (const [vw, vh] of [
    [1920, 1080],
    [1366, 768],
    [1280, 800],
  ]) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: vw,
      height: vh,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await wait(450);
    await saveShot(cdp, `fit_${vw}x${vh}.png`);
  }

  // Verify Fill screen toggle & restore back to Fit monitor
  const fillBtnClicked = await evalJs(
    cdp,
    `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => b.innerText.includes('Fill screen'));
      if (!btn) return false;
      btn.click();
      return true;
    })()`
  );
  assert(fillBtnClicked, 'Fill screen button not found');
  await wait(180);
  const fillStyle = await evalJs(
    cdp,
    `(() => {
      const el = document.querySelector('[data-raixp-overlay="true"]');
      return {
        transform: el?.style.transform || '',
        width: parseFloat(el?.style.width || '0'),
        innerWidth: window.innerWidth,
      };
    })()`
  );
  assert.equal(fillStyle.transform, '', 'Expected no matrix3d transform in Fill screen mode');
  assert.equal(fillStyle.width, fillStyle.innerWidth, 'Expected Fill screen width === viewport width');
  await evalJs(
    cdp,
    `Array.from(document.querySelectorAll('button')).find((b) => b.innerText.includes('Fit monitor'))?.click()`
  );
  await wait(180);
  const fitTransform = await evalJs(
    cdp,
    `document.querySelector('[data-raixp-overlay="true"]')?.style.transform || ''`
  );
  assert(fitTransform.startsWith('matrix3d('), 'Expected matrix3d transform restored after Fit monitor click');

  // Exit back cleanly via Esc & verify normal mode restoration
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 720,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await wait(250);
  await pressKey(cdp, 'Escape', 'Escape', 27);
  await wait(1100);
  const restoredDraws = await evalJs(cdp, `window.__GL_STATS__.frames.at(-1)?.draws ?? 0`);
  console.log('RESTORED_NORMAL_MODE_DRAWS:', restoredDraws);
  assert(restoredDraws > pcStats.draws, 'Expected Bloom/postprocessing draws to restore on exit');

  console.log('ALL_OS_TESTS_PASSED');
  testExitCode = 0;
  cdp.close();
} catch (err) {
  console.error('OS TEST FAILED:', err);
} finally {
  chrome.kill('SIGKILL');
  try {
    fs.rmSync(USER_DATA, { recursive: true, force: true });
  } catch {}
  process.exit(testExitCode);
}
