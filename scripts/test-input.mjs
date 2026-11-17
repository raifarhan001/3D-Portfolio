import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';

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
  throw new Error('Could not find Chrome/Chromium binary.');
}

const PORT = Number(process.env.TEST_PORT || 3015);
const BASE_URL = process.env.BASE_URL || `http://127.0.0.1:${PORT}`;
const SCREENSHOT_DIR = process.env.TEST_SCREENSHOT_DIR || '';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function dist3(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

async function isServerUp(url) {
  try {
    const res = await fetch(url);
    return res.ok;
  } catch {
    return false;
  }
}

async function startServerIfNeeded() {
  if (await isServerUp(BASE_URL)) {
    return { proc: null };
  }
  const nextBin = path.resolve(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next');
  const proc = spawn(process.execPath, [nextBin, 'start', '-p', String(PORT)], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  for (let i = 0; i < 60; i++) {
    if (await isServerUp(BASE_URL)) {
      return { proc };
    }
    await wait(500);
  }
  proc.kill('SIGKILL');
  throw new Error(`Timed out waiting for Next.js production server at ${BASE_URL}`);
}

async function getState(page) {
  return page.evaluate(() => {
    const debugFn = window.__getInputDebugState;
    const dbg = typeof debugFn === 'function' ? debugFn() : null;
    return {
      dbg,
      rootMode: document.querySelector('[data-input-mode]')?.getAttribute('data-input-mode') ?? null,
      hasClickToEnter: Boolean(document.querySelector('[data-welcome-screen="true"]')),
      hasWelcomeReady:
        document.querySelector('[data-welcome-screen="true"]')?.getAttribute('data-welcome-ready') === 'true',
      hasResumePill: Boolean(document.querySelector('[data-resume-pill="true"]')),
      hasFocusHint: document.querySelector('[data-focus-hint="true"]')?.textContent?.trim() ?? null,
    };
  });
}

async function waitForPredicate(page, label, fn, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const val = await fn();
    if (val) return val;
    await wait(60);
  }
  const st = await getState(page);
  throw new Error(`Timed out waiting for "${label}". Last state: ${JSON.stringify(st)}`);
}

async function aimCamera(page, pos, lookAt) {
  await page.evaluate(
    ([px, py, pz], [tx, ty, tz]) => {
      let cam = window.__TEST_CAM__;
      if (!cam) {
        const canvas = document.querySelector('canvas');
        const roots = [];
        let el = canvas;
        while (el) {
          for (const k of Object.keys(el)) {
            if (k.startsWith('__reactFiber$') || k.startsWith('__reactContainer$')) {
              roots.push(el[k]);
            }
          }
          el = el.parentElement;
        }
        const q = [...roots];
        const seen = new Set();
        const vis = new Set();
        const scan = (o, d = 0) => {
          if (!o || typeof o !== 'object' || d > 5 || vis.has(o)) return;
          vis.add(o);
          if (o.isPerspectiveCamera) {
            cam = o;
            return;
          }
          if (o.getState) {
            try {
              const s = o.getState();
              if (s?.camera?.isPerspectiveCamera) {
                cam = s.camera;
                return;
              }
            } catch {
              // ignore
            }
          }
          if (o instanceof HTMLElement || ArrayBuffer.isView(o)) return;
          for (const k of Object.keys(o).slice(0, 60)) {
            if (!k.startsWith('__') && d < 5) scan(o[k], d + 1);
            if (cam) return;
          }
        };
        while (q.length && !cam) {
          const f = q.shift();
          if (!f || seen.has(f)) continue;
          seen.add(f);
          scan(f.stateNode);
          if (!cam) scan(f.memoizedState);
          if (!cam) scan(f.memoizedProps);
          if (f.child) q.push(f.child);
          if (f.sibling) q.push(f.sibling);
          if (f.return && !seen.has(f.return)) q.push(f.return);
        }
        window.__TEST_CAM__ = cam;
      }
      if (!cam) throw new Error('Three.js camera not found');
      cam.position.set(px, py, pz);
      cam.lookAt(tx, ty, tz);
      cam.rotation.order = 'YXZ';
      cam.updateMatrixWorld(true);
    },
    pos,
    lookAt
  );
  await wait(160);
  // Re-apply lookAt after any damped velocity settles so small targets stay dead-center
  await page.evaluate(
    ([px, py, pz], [tx, ty, tz]) => {
      const cam = window.__TEST_CAM__;
      if (cam) {
        cam.position.set(px, py, pz);
        cam.lookAt(tx, ty, tz);
        cam.rotation.order = 'YXZ';
        cam.updateMatrixWorld(true);
      }
    },
    pos,
    lookAt
  );
  await wait(100);
}

async function clickCenter(page, selector) {
  const pt = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, selector);
  assert(pt, `Expected element to click: ${selector}`);
  await page.mouse.click(pt.x, pt.y);
}

async function assertWasdMoves(page, label) {
  const before = (await getState(page)).dbg.cameraPos;
  await page.keyboard.down('KeyW');
  await wait(300);
  await page.keyboard.up('KeyW');
  await wait(300);
  const after = (await getState(page)).dbg;
  const moved = dist3(before, after.cameraPos);
  assert(
    moved > 0.2,
    `${label}: expected WASD movement > 0.2m, got ${moved.toFixed(3)}m (mode=${after.mode}, locked=${after.pointerLocked}, isLockedProp=${after.isLockedProp})`
  );
}

async function resumeFromPausedByClick(page, expectedPos = null) {
  const stBefore = await getState(page);
  assert.equal(stBefore.rootMode, 'paused');
  assert.equal(stBefore.hasClickToEnter, false, 'Click to enter must stay hidden in paused state');
  assert.equal(stBefore.hasResumePill, true, 'Click to resume pill must be visible in paused state');

  await clickCenter(page, '[data-canvas-wrapper="true"]');
  await waitForPredicate(page, 'walking after canvas click', async () => {
    const st = await getState(page);
    return st.rootMode === 'walking' && st.dbg?.pointerLocked && !st.hasResumePill;
  });

  if (expectedPos) {
    const stAfter = await getState(page);
    const d = dist3(stAfter.dbg.cameraPos, expectedPos);
    assert(d < 0.05, `Camera position jumped on resume (${d.toFixed(3)}m)`);
  }
}

async function run() {
  const { proc } = await startServerIfNeeded();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'room-test-input-'));
  let browser = null;
  let passed = false;

  try {
    const encodePublic = (p) =>
      '/' + p.split('/').filter(Boolean).map(encodeURIComponent).join('/');
    // 1. Verify CV & certificate assets respond HTTP 200
    for (const assetPath of [
      'Rai_Farhan_CV.pdf',
      'anthropic ai fluency framework & foundations Certificate.png',
      'AWS Gen AI.pdf',
      'AWS Training Certificate.pdf',
      'certificates/thumbs/aws-gen-ai.webp',
      'certificates/thumbs/aws-training-certificate.webp',
    ]) {
      const encoded = encodePublic(assetPath);
      const res = await fetch(`${BASE_URL}${encoded}`);
      assert.equal(res.status, 200, `Expected 200 for ${encoded}, got ${res.status}`);
    }
    console.log('✓ Public CV & certificate assets return 200 OK');

    browser = await puppeteer.launch({
      executablePath: CHROME,
      headless: 'new',
      userDataDir,
      args: [
        '--window-size=1280,720',
        '--disable-gpu-sandbox',
        '--enable-webgl',
        '--ignore-gpu-blocklist',
        '--no-first-run',
        '--no-default-browser-check',
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    const pageErrors = [];
    page.on('pageerror', (err) => {
      console.error('PAGEERROR:', err.message);
      pageErrors.push(err.message);
    });

    // Emulate browser pointer-lock security + browser Esc consumption deterministically:
    // - requestPointerLock rejects without a real user click gesture (Esc / Q cannot lock!)
    // - browser Esc while pointer locked exits pointer lock and suppresses page Escape keydown
    await page.evaluateOnNewDocument(() => {
      let lockedEl = null;
      let userGesture = false;
      const grantBriefGesture = () => {
        userGesture = true;
        setTimeout(() => {
          userGesture = false;
        }, 60);
      };
      window.addEventListener('pointerdown', grantBriefGesture, true);
      window.addEventListener('mousedown', grantBriefGesture, true);
      window.addEventListener('click', grantBriefGesture, true);

      Object.defineProperty(document, 'pointerLockElement', {
        configurable: true,
        get: () => lockedEl,
      });

      const setLockedElement = (el) => {
        lockedEl = el;
      };

      document.exitPointerLock = function exitPointerLock() {
        if (lockedEl) {
          lockedEl = null;
          document.dispatchEvent(new Event('pointerlockchange'));
        }
      };

      Element.prototype.requestPointerLock = function requestPointerLock() {
        if (!userGesture) {
          document.dispatchEvent(new Event('pointerlockerror'));
          return Promise.reject(new DOMException('User gesture required for pointer lock', 'SecurityError'));
        }
        setLockedElement(this);
        setTimeout(() => {
          document.dispatchEvent(new Event('pointerlockchange'));
        }, 12);
        return Promise.resolve();
      };

      window.addEventListener(
        'keydown',
        (e) => {
          if (e.code === 'Escape' && lockedEl) {
            lockedEl = null;
            e.preventDefault();
            e.stopImmediatePropagation();
            document.dispatchEvent(new Event('pointerlockchange'));
          }
        },
        true
      );
    });

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await waitForPredicate(
      page,
      'initial welcome screen ready',
      async () => {
        const st = await getState(page);
        return st.hasClickToEnter && st.hasWelcomeReady && st.rootMode === 'menu' && st.dbg !== null;
      },
      25000
    );
    console.log('✓ Initial state is "menu" with Welcome screen loaded & ready');

    // Click Enter the room -> fade out -> walking
    await clickCenter(page, '[data-enter-room-button="true"]');
    await waitForPredicate(page, 'walking after Enter button click', async () => {
      const st = await getState(page);
      return st.rootMode === 'walking' && st.dbg.pointerLocked && !st.hasClickToEnter && !st.hasResumePill;
    });
    console.log('✓ Enter button locks pointer, fades welcome out, and enters "walking"');

    // Esc while walking -> paused (not menu), click canvas -> walking + WASD moves
    await page.keyboard.press('Escape');
    await waitForPredicate(page, 'paused after Esc in walking', async () => {
      const st = await getState(page);
      return st.rootMode === 'paused' && !st.dbg.pointerLocked;
    });
    let st = await getState(page);
    assert.equal(st.hasClickToEnter, false, 'Esc while walking must NOT show full Click to enter overlay');
    assert.equal(st.hasResumePill, true, 'Esc while walking must show Click to resume pill');
    const walkingSaved = st.dbg.cameraPos;
    await resumeFromPausedByClick(page, walkingSaved);
    await assertWasdMoves(page, 'after paused -> resume click');
    console.log('✓ Esc while walking -> "paused" ("Click to resume" pill, no menu overlay) -> click -> "walking" + WASD moves');

    // ---------- TV MODE: Esc, Q, Exit button, plus iframe focus helpers ----------
    const enterTvAndVerify = async (tag) => {
      await aimCamera(page, [-3.2, 1.7, 0], [-4.865, 1.72, 0]);
      await waitForPredicate(page, `hover tv (${tag})`, async () => {
        return (await getState(page)).dbg.hoverTarget === 'tv';
      });
      const storedPos = (await getState(page)).dbg.cameraPos;
      await page.keyboard.press('KeyE');
      await waitForPredicate(page, `tv focus arrived (${tag})`, async () => {
        const s = await getState(page);
        return s.rootMode === 'focus' && s.dbg.focusKind === 'tv' && !s.dbg.animating && !s.dbg.pointerLocked;
      });
      const inFocus = await getState(page);
      assert.equal(inFocus.hasFocusHint, 'Q or Esc to exit');
      assert(dist3(storedPos, inFocus.dbg.cameraPos) > 0.2, `TV camera should move on focus (${tag})`);

      // Power TV on if currently off so the iframe/screen wrapper mounts
      const hasStripInitially = await page.evaluate(() => Boolean(document.querySelector('[data-tv-focus-strip="true"]')));
      if (!hasStripInitially) {
        await clickCenter(page, '[title="Power On / Off"]');
        await waitForPredicate(
          page,
          `TV powered on wrapper (${tag})`,
          async () => page.evaluate(() => Boolean(document.querySelector('[data-tv-focus-strip="true"]')))
        );
      }

      const tvStripBox = await page.evaluate(() => {
        const strip = document.querySelector('[data-tv-focus-strip="true"]');
        const exitBtn = document.querySelector('[data-exit-focus-button="true"]');
        return {
          hasStrip: Boolean(strip),
          stripHeightCss: strip ? strip.style.height : null,
          hasExitBtn: Boolean(exitBtn),
        };
      });
      assert.equal(tvStripBox.hasStrip, true);
      assert.equal(tvStripBox.stripHeightCss, '24px');
      assert.equal(tvStripBox.hasExitBtn, true);

      // Click 24px top strip & remote panel to confirm both reclaim window focus
      await page.evaluate(() => {
        const origFocus = window.focus.bind(window);
        window.__FOCUS_CALLS__ = 0;
        window.focus = () => {
          window.__FOCUS_CALLS__ += 1;
          origFocus();
        };
      });
      await clickCenter(page, '[data-tv-focus-strip="true"]');
      await clickCenter(page, '[data-tv-remote-panel="true"]');
      const focusCalls = await page.evaluate(() => window.__FOCUS_CALLS__);
      assert(focusCalls >= 2, `Expected window.focus() calls from strip + remote panel, got ${focusCalls}`);

      return storedPos;
    };

    // TV + Esc
    let storedTvPos = await enterTvAndVerify('Esc');
    await page.keyboard.press('Escape');
    await waitForPredicate(page, 'tv Esc -> paused', async () => {
      const s = await getState(page);
      return s.rootMode === 'paused' && !s.dbg.animating && !s.dbg.tvMode;
    });
    st = await getState(page);
    assert.equal(st.hasClickToEnter, false);
    assert.equal(st.hasResumePill, true);
    assert(dist3(st.dbg.cameraPos, storedTvPos) < 0.02, 'TV Esc must restore stored camera position');
    await resumeFromPausedByClick(page, storedTvPos);
    await assertWasdMoves(page, 'after TV Esc resume');

    // TV + Q
    storedTvPos = await enterTvAndVerify('Q');
    await page.keyboard.press('KeyQ');
    await waitForPredicate(page, 'tv Q -> paused', async () => {
      const s = await getState(page);
      return s.rootMode === 'paused' && !s.dbg.animating && !s.dbg.tvMode;
    });
    st = await getState(page);
    assert.equal(st.hasClickToEnter, false);
    assert.equal(st.hasResumePill, true);
    assert(dist3(st.dbg.cameraPos, storedTvPos) < 0.02, 'TV Q must restore stored camera position');
    await resumeFromPausedByClick(page, storedTvPos);

    // TV + Exit button (user gesture -> walking directly)
    storedTvPos = await enterTvAndVerify('Exit button');
    await clickCenter(page, '[data-exit-focus-button="true"]');
    await waitForPredicate(page, 'tv Exit -> walking', async () => {
      const s = await getState(page);
      return s.rootMode === 'walking' && !s.dbg.animating && !s.dbg.tvMode && s.dbg.pointerLocked;
    });
    st = await getState(page);
    assert.equal(st.hasClickToEnter, false);
    assert.equal(st.hasResumePill, false);
    assert(dist3(st.dbg.cameraPos, storedTvPos) < 0.02, 'TV Exit must restore stored camera position');
    await assertWasdMoves(page, 'after TV Exit button');
    console.log('✓ TV mode passed Esc, Q, Exit button, 24px focus strip, and WASD restoration');

    // ---------- PC OVERLAY (Rai XP): Esc (incl. menu modal priority), Q, Exit button ----------
    const enterPcAndVerify = async (tag) => {
      await aimCamera(page, [2.75, 1.7, -4.55], [4.72, 1.06, -3.85]);
      await waitForPredicate(page, `hover pc (${tag})`, async () => {
        return (await getState(page)).dbg.hoverTarget === 'pc';
      });
      const storedPos = (await getState(page)).dbg.cameraPos;
      await page.keyboard.press('KeyE');
      await wait(200);
      // First E powers on PC if it was off; press E again to enter focus
      if ((await getState(page)).rootMode === 'walking') {
        await page.keyboard.press('KeyE');
      }
      await waitForPredicate(
        page,
        `pc desktop arrived (${tag})`,
        async () => {
          const s = await getState(page);
          return s.rootMode === 'focus' && s.dbg.focusKind === 'pc' && s.dbg.pcArrived && !s.dbg.animating;
        },
        12000
      );
      await waitForPredicate(
        page,
        `RaiXP overlay mounted (${tag})`,
        async () => page.evaluate(() => Boolean(document.querySelector('[data-raixp-overlay="true"]'))),
        8000
      );
      const inFocus = await getState(page);
      assert.equal(inFocus.hasFocusHint, 'Q or Esc to exit');
      return storedPos;
    };

    // PC: Start menu modal priority -> first Esc closes Start menu, second Esc exits PC -> paused
    let storedPcPos = await enterPcAndVerify('Esc');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('[data-raixp-overlay="true"] button'));
      const startBtn = btns.find((b) => b.textContent?.toLowerCase().includes('start'));
      if (startBtn) startBtn.click();
    });
    await waitForPredicate(page, 'XP Start menu open', async () => (await getState(page)).dbg.osStartMenu);
    await page.keyboard.press('Escape');
    await waitForPredicate(page, 'XP Start menu closed on first Esc', async () => {
      const s = await getState(page);
      return !s.dbg.osStartMenu && s.rootMode === 'focus';
    });
    await page.keyboard.press('Escape');
    await waitForPredicate(page, 'PC Esc -> paused', async () => {
      const s = await getState(page);
      return s.rootMode === 'paused' && !s.dbg.animating && !s.dbg.pcMode;
    });
    st = await getState(page);
    assert.equal(st.hasClickToEnter, false);
    assert.equal(st.hasResumePill, true);
    assert(dist3(st.dbg.cameraPos, storedPcPos) < 0.02, 'PC Esc must restore stored camera position');
    await resumeFromPausedByClick(page, storedPcPos);
    await assertWasdMoves(page, 'after PC Esc resume');

    // PC + Q
    storedPcPos = await enterPcAndVerify('Q');
    await page.keyboard.press('KeyQ');
    await waitForPredicate(page, 'PC Q -> paused', async () => {
      const s = await getState(page);
      return s.rootMode === 'paused' && !s.dbg.animating && !s.dbg.pcMode;
    });
    st = await getState(page);
    assert.equal(st.hasClickToEnter, false);
    assert.equal(st.hasResumePill, true);
    assert(dist3(st.dbg.cameraPos, storedPcPos) < 0.02, 'PC Q must restore stored camera position');
    await resumeFromPausedByClick(page, storedPcPos);

    // PC + Exit button
    storedPcPos = await enterPcAndVerify('Exit button');
    await clickCenter(page, '[data-exit-focus-button="true"]');
    await waitForPredicate(page, 'PC Exit -> walking', async () => {
      const s = await getState(page);
      return s.rootMode === 'walking' && !s.dbg.animating && !s.dbg.pcMode && s.dbg.pointerLocked;
    });
    st = await getState(page);
    assert.equal(st.hasClickToEnter, false);
    assert.equal(st.hasResumePill, false);
    assert(dist3(st.dbg.cameraPos, storedPcPos) < 0.02, 'PC Exit must restore stored camera position');
    await assertWasdMoves(page, 'after PC Exit button');
    console.log('✓ PC (Rai XP) passed Start-menu Esc hierarchy, Esc, Q, Exit button, and WASD restoration');

    // ---------- PHONE MODE: compose Q-typing safety, compose Esc hierarchy, Esc, Q, Exit button ----------
    const enterPhoneAndVerify = async (tag) => {
      await aimCamera(page, [3.5, 1.7, -4.55], [4.46, 0.8325, -4.66]);
      await waitForPredicate(page, `hover phone (${tag})`, async () => {
        return (await getState(page)).dbg.hoverTarget === 'phone';
      });
      const storedPos = (await getState(page)).dbg.cameraPos;
      await page.keyboard.press('KeyE');
      await waitForPredicate(page, `phone focus arrived (${tag})`, async () => {
        const s = await getState(page);
        return s.rootMode === 'focus' && s.dbg.focusKind === 'phone' && !s.dbg.animating;
      });
      const inFocus = await getState(page);
      assert.equal(inFocus.hasFocusHint, 'Q or Esc to exit');
      return storedPos;
    };

    // Phone compose: Q must type 'q' inside input, Esc must close compose -> home, second Esc -> paused
    let storedPhonePos = await enterPhoneAndVerify('Esc + compose Q check');
    await clickCenter(page, '[data-phone-unlock="true"]');
    await waitForPredicate(page, 'phone home screen', async () => (await getState(page)).dbg.phoneScreen === 'home');
    await clickCenter(page, '[data-phone-compose-btn="true"]');
    await waitForPredicate(page, 'phone compose screen', async () => (await getState(page)).dbg.phoneScreen === 'compose');
    await page.focus('#phone-subject');
    await page.keyboard.type('question');
    const typedSubject = await page.$eval('#phone-subject', (el) => el.value);
    assert.equal(typedSubject, 'question', 'Typing Q inside input must not exit focus');
    assert.equal((await getState(page)).rootMode, 'focus');

    await page.keyboard.press('Escape');
    await waitForPredicate(page, 'phone compose closed by Esc -> home', async () => {
      const s = await getState(page);
      return s.dbg.phoneScreen === 'home' && s.rootMode === 'focus';
    });
    await page.keyboard.press('Escape');
    await waitForPredicate(page, 'phone Esc -> paused', async () => {
      const s = await getState(page);
      return s.rootMode === 'paused' && !s.dbg.animating && s.dbg.portfolioKind === null;
    });
    st = await getState(page);
    assert.equal(st.hasClickToEnter, false);
    assert.equal(st.hasResumePill, true);
    assert(dist3(st.dbg.cameraPos, storedPhonePos) < 0.02, 'Phone Esc must restore stored camera position');
    await resumeFromPausedByClick(page, storedPhonePos);
    await assertWasdMoves(page, 'after Phone Esc resume');

    // Phone + Q (not typing in input)
    storedPhonePos = await enterPhoneAndVerify('Q');
    await page.keyboard.press('KeyQ');
    await waitForPredicate(page, 'phone Q -> paused', async () => {
      const s = await getState(page);
      return s.rootMode === 'paused' && !s.dbg.animating && s.dbg.portfolioKind === null;
    });
    st = await getState(page);
    assert.equal(st.hasClickToEnter, false);
    assert.equal(st.hasResumePill, true);
    assert(dist3(st.dbg.cameraPos, storedPhonePos) < 0.02, 'Phone Q must restore stored camera position');
    await resumeFromPausedByClick(page, storedPhonePos);

    // Phone + Exit button
    storedPhonePos = await enterPhoneAndVerify('Exit button');
    await clickCenter(page, '[data-exit-focus-button="true"]');
    await waitForPredicate(page, 'phone Exit -> walking', async () => {
      const s = await getState(page);
      return s.rootMode === 'walking' && !s.dbg.animating && s.dbg.portfolioKind === null && s.dbg.pointerLocked;
    });
    st = await getState(page);
    assert.equal(st.hasClickToEnter, false);
    assert.equal(st.hasResumePill, false);
    assert(dist3(st.dbg.cameraPos, storedPhonePos) < 0.02, 'Phone Exit must restore stored camera position');
    await assertWasdMoves(page, 'after Phone Exit button');
    console.log('✓ Phone passed Q-typing protection, compose Esc hierarchy, Esc, Q, Exit button, and WASD restoration');

    // ---------- CERTIFICATES SHELF & VIEWER VERIFICATION ----------
    if (SCREENSHOT_DIR) {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
      await aimCamera(page, [1.75, 1.68, -2.9], [1.75, 1.62, -4.9]);
      await wait(250);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'verify-cert-shelf.png') });
    }
    await aimCamera(page, [1.09, 1.7, -3.25], [1.09, 1.92, -4.89]);
    await waitForPredicate(page, 'hover certificate', async () => {
      return (await getState(page)).dbg.hoverTarget === 'certificate';
    });
    await page.keyboard.press('KeyE');
    await waitForPredicate(page, 'certificate focus', async () => {
      const s = await getState(page);
      return s.rootMode === 'focus' && s.dbg.focusKind === 'certificate' && !s.dbg.animating;
    });
    const certCheck = await page.evaluate(() => {
      const card = document.querySelector('[data-portfolio-focus-ui="certificate"]');
      const img = document.querySelector('[data-cert-image-viewer="true"]');
      return {
        hasImageViewer: Boolean(img),
        imgSrc: img?.getAttribute('src') ?? null,
        titleText: card?.querySelector('h2')?.textContent ?? null,
        fullText: card?.textContent ?? '',
      };
    });
    assert.equal(certCheck.hasImageViewer, true, 'Anthropic cert must render <img> viewer');
    assert(certCheck.fullText.includes('Certificate 1 / 3'), 'Must display Certificate 1 / 3');
    assert(!/coming soon|certificate slot/i.test(certCheck.fullText), 'No placeholder text allowed in cert viewer');

    // Step to certificate 2 (AWS Gen AI PDF)
    await page.keyboard.press('ArrowRight');
    await wait(250);
    const pdfCertCheck2 = await page.evaluate(() => {
      const card = document.querySelector('[data-portfolio-focus-ui="certificate"]');
      return {
        hasPdfViewer: Boolean(document.querySelector('[data-cert-pdf-viewer="true"]')),
        hasDownload: Boolean(document.querySelector('[data-cert-download="true"]')),
        titleText: card?.querySelector('h2')?.textContent ?? null,
        fullText: card?.textContent ?? '',
      };
    });
    assert.equal(pdfCertCheck2.hasPdfViewer, true, 'AWS Gen AI PDF cert must render PDF viewer');
    assert.equal(pdfCertCheck2.hasDownload, true, 'AWS Gen AI PDF cert must show Download button');
    assert(pdfCertCheck2.fullText.includes('Certificate 2 / 3'), 'Must display Certificate 2 / 3');

    // Step to certificate 3 (AWS Foundations of Prompt Engineering PDF)
    await page.keyboard.press('ArrowRight');
    await wait(250);
    const pdfCertCheck3 = await page.evaluate(() => {
      const card = document.querySelector('[data-portfolio-focus-ui="certificate"]');
      return {
        hasPdfViewer: Boolean(document.querySelector('[data-cert-pdf-viewer="true"]')),
        hasDownload: Boolean(document.querySelector('[data-cert-download="true"]')),
        titleText: card?.querySelector('h2')?.textContent ?? null,
        fullText: card?.textContent ?? '',
      };
    });
    assert.equal(pdfCertCheck3.hasPdfViewer, true, 'AWS Prompt Eng PDF cert must render PDF viewer');
    assert.equal(pdfCertCheck3.hasDownload, true, 'AWS Prompt Eng PDF cert must show Download button');
    assert(pdfCertCheck3.fullText.includes('Certificate 3 / 3'), 'Must display Certificate 3 / 3');

    // Cycling past 3 wraps cleanly back to Certificate 1 / 3 (no placeholder slot 4!)
    await page.keyboard.press('ArrowRight');
    await wait(250);
    const wrapCertText = await page.evaluate(
      () => document.querySelector('[data-portfolio-focus-ui="certificate"]')?.textContent ?? ''
    );
    assert(wrapCertText.includes('Certificate 1 / 3'), 'Cycling past 3/3 must wrap back to 1/3');

    await page.keyboard.press('KeyQ');
    await waitForPredicate(page, 'cert Q -> paused', async () => (await getState(page)).rootMode === 'paused');
    await resumeFromPausedByClick(page);
    console.log('✓ Certificates viewer verified (3/3 real certs cycle & wrap, image + PDF viewers, zero placeholders, Q -> paused)');

    // ---------- CONTROLLER / RESUME VERIFICATION ----------
    await aimCamera(page, [3.2, 1.7, -2.85], [4.28, 0.8, -3.24]);
    await waitForPredicate(page, 'hover resume controller', async () => {
      return (await getState(page)).dbg.hoverTarget === 'resume';
    });
    await page.keyboard.press('KeyE');
    await waitForPredicate(page, 'resume focus', async () => {
      const s = await getState(page);
      return s.rootMode === 'focus' && s.dbg.focusKind === 'resume' && !s.dbg.animating;
    });
    const resumeModalText = await page.evaluate(
      () => document.querySelector('[data-portfolio-focus-ui="resume"]')?.textContent ?? ''
    );
    assert(resumeModalText.includes('Rai_Farhan_CV.pdf'), 'Resume modal must reference Rai_Farhan_CV.pdf');
    await page.keyboard.press('Escape');
    await waitForPredicate(page, 'resume Esc -> paused', async () => (await getState(page)).rootMode === 'paused');
    await resumeFromPausedByClick(page);
    console.log('✓ Controller Resume viewer verified (Rai_Farhan_CV.pdf + Esc -> paused)');

    // ---------- SOFA SITTING VERIFICATION (Esc, Q, F) ----------
    const sitOnSofa = async (tag) => {
      await aimCamera(page, [-2.55, 1.7, 0], [-0.35, 0.55, 0]);
      await waitForPredicate(page, `hover sofa (${tag})`, async () => (await getState(page)).dbg.hoverTarget === 'sofa');
      const storedPos = (await getState(page)).dbg.cameraPos;
      await page.keyboard.press('KeyE');
      await waitForPredicate(page, `sofa seated (${tag})`, async () => {
        const s = await getState(page);
        return s.rootMode === 'focus' && s.dbg.focusKind === 'sofa' && !s.dbg.animating;
      });
      assert.equal((await getState(page)).hasFocusHint, 'Q or Esc to exit');
      return storedPos;
    };

    let storedSofaPos = await sitOnSofa('Esc');
    await page.keyboard.press('Escape');
    await waitForPredicate(page, 'sofa Esc -> paused', async () => {
      const s = await getState(page);
      return s.rootMode === 'paused' && !s.dbg.animating && !s.dbg.isSeated;
    });
    assert(dist3((await getState(page)).dbg.cameraPos, storedSofaPos) < 0.02, 'Sofa Esc must restore standing position');
    await resumeFromPausedByClick(page, storedSofaPos);

    storedSofaPos = await sitOnSofa('Q');
    await page.keyboard.press('KeyQ');
    await waitForPredicate(page, 'sofa Q -> paused', async () => {
      const s = await getState(page);
      return s.rootMode === 'paused' && !s.dbg.animating && !s.dbg.isSeated;
    });
    assert(dist3((await getState(page)).dbg.cameraPos, storedSofaPos) < 0.02, 'Sofa Q must restore standing position');
    await resumeFromPausedByClick(page, storedSofaPos);

    storedSofaPos = await sitOnSofa('F');
    // KeyF attempts re-lock when possible and falls back safely to paused if browser rejects lock
    await page.keyboard.press('KeyF');
    await waitForPredicate(page, 'sofa F stand up', async () => {
      const s = await getState(page);
      return (s.rootMode === 'paused' || s.rootMode === 'walking') && !s.dbg.animating && !s.dbg.isSeated;
    });
    assert(dist3((await getState(page)).dbg.cameraPos, storedSofaPos) < 0.02, 'Sofa F must restore standing position');
    console.log('✓ Sofa sitting verified (Esc -> paused, Q -> paused, F stands up safely at standing position)');

    // ---------- STEP 5: LIGHT SWITCH, THEME & ARCADE CABINET FOCUS VERIFICATION ----------
    // Stand from F -> re-lock into walking if paused
    if ((await getState(page)).rootMode === 'paused') {
      await resumeFromPausedByClick(page, storedSofaPos);
    }

    // Light switch prompt within 2m -> instant toggle on E + T hotkey (default theme is Night)
    await aimCamera(page, [0.0, 1.7, 3.85], [0.0, 1.25, 4.985]);
    await waitForPredicate(page, 'hover light switch', async () => (await getState(page)).dbg.hoverTarget === 'switch');
    assert.equal(
      await page.evaluate(() => window.__getThemeDebugState?.().theme),
      'night',
      'Default initial theme must be night'
    );
    await page.keyboard.press('KeyE');
    await wait(150);
    assert.equal(
      await page.evaluate(() => window.__getThemeDebugState?.().theme),
      'day',
      'Pressing E on switch from default night must toggle theme to day'
    );
    await page.keyboard.press('KeyT');
    await wait(150);
    assert.equal(
      await page.evaluate(() => window.__getThemeDebugState?.().theme),
      'night',
      'Pressing T must toggle theme back to night'
    );
    await page.keyboard.press('KeyM');
    await wait(100);
    assert.equal(
      await page.evaluate(() => window.__getThemeDebugState?.().sfxMuted),
      true,
      'Key M must toggle sfx mute'
    );
    await page.keyboard.press('KeyM');
    await wait(100);

    // Arcade cabinet focus: E -> focus, WASD doesn't move player, Q/Esc -> paused, Exit -> walking
    const enterArcade = async (tag) => {
      await aimCamera(page, [3.15, 1.7, -1.95], [4.55, 1.255, -1.95]);
      await waitForPredicate(page, `hover arcade (${tag})`, async () => (await getState(page)).dbg.hoverTarget === 'arcade');
      const storedPos = (await getState(page)).dbg.cameraPos;
      await page.keyboard.press('KeyE');
      await waitForPredicate(page, `arcade focus (${tag})`, async () => {
        const s = await getState(page);
        return s.rootMode === 'focus' && s.dbg.focusKind === 'arcade' && !s.dbg.animating;
      });
      assert(
        await page.evaluate(() => Boolean(document.querySelector('[data-arcade-hint="true"]'))),
        'Arcade DOM hint must be visible during focus'
      );
      return storedPos;
    };

    let storedArcadePos = await enterArcade('Esc');
    const arcCamStart = (await getState(page)).dbg.cameraPos;
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('KeyD');
    await wait(120);
    assert.deepEqual(
      (await getState(page)).dbg.cameraPos,
      arcCamStart,
      'WASD/Arrows in Arcade focus must never move player camera'
    );
    await page.keyboard.press('Escape');
    await waitForPredicate(page, 'arcade Esc -> paused', async () => {
      const s = await getState(page);
      return s.rootMode === 'paused' && !s.dbg.animating;
    });
    assert(dist3((await getState(page)).dbg.cameraPos, storedArcadePos) < 0.02, 'Arcade Esc must restore stored position');
    await resumeFromPausedByClick(page, storedArcadePos);

    storedArcadePos = await enterArcade('Q');
    await page.keyboard.press('KeyQ');
    await waitForPredicate(page, 'arcade Q -> paused', async () => {
      const s = await getState(page);
      return s.rootMode === 'paused' && !s.dbg.animating;
    });
    await resumeFromPausedByClick(page, storedArcadePos);

    storedArcadePos = await enterArcade('Exit');
    await page.click('[data-arcade-exit="true"]');
    await waitForPredicate(page, 'arcade Exit -> walking', async () => {
      const s = await getState(page);
      return s.rootMode === 'walking' && !s.dbg.animating;
    });
    assert(dist3((await getState(page)).dbg.cameraPos, storedArcadePos) < 0.02, 'Arcade Exit must restore stored position');
    await assertWasdMoves(page, 'after Arcade Exit button');
    console.log('✓ Step 5 Light Switch, Theme (E/T), SFX Mute (M), and Arcade Snake (Esc/Q/Exit) verified');

    // Step 6 Bean Bag sit interaction -> Esc -> paused, Stand Up button -> walking
    await aimCamera(page, [2.85, 1.7, 0.55], [4.25, 0.25, 0.55]);
    await waitForPredicate(page, 'hover beanbag', async () => (await getState(page)).dbg.hoverTarget === 'beanbag');
    const storedBeanPos = (await getState(page)).dbg.cameraPos;
    await page.keyboard.press('KeyE');
    await waitForPredicate(page, 'beanbag focus', async () => {
      const s = await getState(page);
      return s.rootMode === 'focus' && s.dbg.focusKind === 'beanbag' && !s.dbg.animating;
    });
    await page.click('[data-beanbag-exit="true"]');
    await waitForPredicate(page, 'beanbag Stand Up -> walking', async () => {
      const s = await getState(page);
      return s.rootMode === 'walking' && !s.dbg.animating;
    });
    assert(dist3((await getState(page)).dbg.cameraPos, storedBeanPos) < 0.02, 'Bean Bag Stand Up must restore stored position');
    console.log('✓ Step 6 Bean Bag sitting (E -> Stand Up -> walking) verified');

    // Step 7 Mona AI Companion: raycast, E focus, typing isolation (Q/W/T/M), bilingual + grounded API, Esc & Exit
    const probeOffsets = [
      [0, 1.85],
      [1.85, 0],
      [-1.85, 0],
      [0, -1.85],
    ];
    let monaHoverOk = false;
    for (const [ox, oz] of probeOffsets) {
      const mNow = (await getState(page)).dbg.monaPos;
      const cx = Math.max(-4.35, Math.min(4.35, mNow[0] + ox));
      const cz = Math.max(-4.35, Math.min(4.35, mNow[1] + oz));
      if (Math.hypot(cx - mNow[0], cz - mNow[1]) < 1.1) continue;
      await aimCamera(page, [cx, 1.65, cz], [mNow[0], 1.15, mNow[1]]);
      await wait(220);
      // Re-aim at settled monaPos since she stops to face player within 2.6m
      const mSettled = (await getState(page)).dbg.monaPos;
      await aimCamera(page, [cx, 1.65, cz], [mSettled[0], 1.15, mSettled[1]]);
      const h = (await getState(page)).dbg.hoverTarget;
      if (h === 'robot') {
        monaHoverOk = true;
        break;
      }
    }
    assert(monaHoverOk, 'Raycast hoverTarget should hit "robot" when looking at Mona');

    if (SCREENSHOT_DIR) {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'verify-mona-walking.png') });
    }

    const storedMonaPos = (await getState(page)).dbg.cameraPos;
    await page.keyboard.press('KeyE');
    await waitForPredicate(page, 'mona focus', async () => {
      const s = await getState(page);
      return s.rootMode === 'focus' && s.dbg.focusKind === 'robot' && !s.dbg.animating;
    });
    assert(
      await page.evaluate(() => Boolean(document.querySelector('[data-mona-chat-ui="true"]'))),
      'Mona chat overlay must be visible in robot focus mode'
    );

    // Typing isolation check: Q, W, T, M inside chat input must NOT exit focus, move camera, toggle theme, or mute sfx
    const camInMonaChat = (await getState(page)).dbg.cameraPos;
    const themeBeforeType = await page.evaluate(() => window.__getThemeDebugState?.().theme);
    const muteBeforeType = await page.evaluate(() => window.__getThemeDebugState?.().sfxMuted);
    await page.focus('[data-mona-input="true"]');
    await page.keyboard.type('qwtm ', { delay: 10 });
    await wait(120);
    const afterTypeState = await getState(page);
    assert.equal(afterTypeState.rootMode, 'focus', 'Typing Q inside Mona input must NOT exit focus');
    assert.equal(afterTypeState.dbg.focusKind, 'robot', 'FocusKind must remain robot while typing');
    assert.deepEqual(afterTypeState.dbg.cameraPos, camInMonaChat, 'Typing W inside Mona input must NOT move camera');
    assert.equal(
      await page.evaluate(() => window.__getThemeDebugState?.().theme),
      themeBeforeType,
      'Typing T inside Mona input must NOT toggle theme'
    );
    assert.equal(
      await page.evaluate(() => window.__getThemeDebugState?.().sfxMuted),
      muteBeforeType,
      'Typing M inside Mona input must NOT mute SFX'
    );

    // Clear typed test chars using standard OS selection + Backspace so React updates cleanly
    await page.keyboard.down('ControlLeft');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('ControlLeft');
    await page.keyboard.press('Backspace');
    await page.keyboard.type('Day mode on karo aur Rai kaun hai?', { delay: 10 });
    const msgCountBefore = await page.evaluate(
      () => document.querySelectorAll('[data-mona-messages="true"] > div').length
    );
    await page.click('[data-mona-send="true"]');
    await waitForPredicate(
      page,
      'Mona Gemini reply rendered',
      async () => {
        const count = await page.evaluate(
          () => document.querySelectorAll('[data-mona-messages="true"] > div').length
        );
        const sending = await page.evaluate(() =>
          document.querySelector('[data-mona-messages="true"]')?.textContent?.includes('is thinking')
        );
        return count >= msgCountBefore + 2 && !sending;
      },
      20000
    );
    assert.equal(
      await page.evaluate(() => window.__getThemeDebugState?.().theme),
      'day',
      'Mona must switch room lighting to day mode when asked in Roman Urdu'
    );

    if (SCREENSHOT_DIR) {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'verify-mona-chat.png') });
    }

    // Esc from Mona focus -> paused (restores stored camera position), Exit -> walking
    await page.keyboard.press('Escape');
    await waitForPredicate(page, 'mona Esc -> paused', async () => {
      const s = await getState(page);
      return s.rootMode === 'paused' && !s.dbg.animating;
    });
    assert(dist3((await getState(page)).dbg.cameraPos, storedMonaPos) < 0.05, 'Mona Esc must restore stored position');
    await resumeFromPausedByClick(page, storedMonaPos);

    // Re-enter via paused "Ask Mona" button & exit via Exit button -> walking
    await page.keyboard.press('Escape');
    await waitForPredicate(page, 'pause before Ask Mona btn', async () => (await getState(page)).rootMode === 'paused');
    await page.click('[data-talk-mona-btn="true"]');
    await waitForPredicate(page, 'Ask Mona btn -> robot focus', async () => {
      const s = await getState(page);
      return s.rootMode === 'focus' && s.dbg.focusKind === 'robot' && !s.dbg.animating;
    });
    await page.click('[data-mona-exit="true"]');
    await waitForPredicate(page, 'Mona Exit -> walking', async () => {
      const s = await getState(page);
      return s.rootMode === 'walking' && !s.dbg.animating;
    });
    console.log('✓ Step 7 Mona AI Companion (hover, E focus, Q/W/T/M isolation, live Roman Urdu API + action, Esc/Exit) verified');

    assert.equal(pageErrors.length, 0, `Uncaught page errors: ${pageErrors.join(' | ')}`);
    passed = true;
    console.log('ALL INPUT STATE MACHINE, POINTER LOCK, TV/PC/PHONE, AND CERTIFICATE/CV CHECKS PASSED!');
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {
      // ignore temp cleanup failure on Windows
    }
    if (proc) {
      proc.kill('SIGKILL');
    }
  }

  if (!passed) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
