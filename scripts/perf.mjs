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

const PORT = Number(process.env.PERF_PORT || 3023);
const BASE_URL = process.env.PERF_URL || `http://127.0.0.1:${PORT}`;
const DRAW_BUDGET = Number(process.env.PERF_DRAW_BUDGET || 200);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function isUp(url) {
  try {
    const res = await fetch(url);
    return res.ok;
  } catch {
    return false;
  }
}

async function startServerIfNeeded() {
  if (await isUp(BASE_URL)) return { proc: null };
  const nextBin = path.resolve(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next');
  const proc = spawn(process.execPath, [nextBin, 'start', '-p', String(PORT)], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  for (let i = 0; i < 60; i++) {
    if (await isUp(BASE_URL)) return { proc };
    await wait(500);
  }
  proc.kill('SIGKILL');
  throw new Error(`Timed out starting Next.js production server at ${BASE_URL}`);
}

const HOOK_SCRIPT = `
  (() => {
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
          if (count > 3) stats.frameSceneDraws++;
          if (mode === 4) stats.frameTris += Math.floor(count / 3) * primcount;
          return origDEI.apply(this, arguments);
        };
      }
      if (proto.drawArraysInstanced) {
        const origDAI = proto.drawArraysInstanced;
        proto.drawArraysInstanced = function(mode, first, count, primcount) {
          stats.frameDraws++;
          if (count > 3) stats.frameSceneDraws++;
          if (mode === 4) stats.frameTris += Math.floor(count / 3) * primcount;
          return origDAI.apply(this, arguments);
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
      if (stats.frameDraws > 0 && dt > 0 && dt < 1000) {
        stats.frames.push({
          dt,
          draws: stats.frameDraws,
          sceneDraws: stats.frameSceneDraws,
          tris: stats.frameTris,
        });
        if (stats.frames.length > 360) stats.frames.shift();
      }
      stats.frameDraws = 0;
      stats.frameSceneDraws = 0;
      stats.frameTris = 0;
      origRAF(tick);
    }
    origRAF(tick);
  })();
`;

async function locateCamera(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return false;
    const roots = [];
    let el = canvas;
    while (el) {
      for (const k of Object.keys(el)) {
        if (k.startsWith('__reactFiber$') || k.startsWith('__reactContainer$')) roots.push(el[k]);
      }
      el = el.parentElement;
    }
    const q = [...roots];
    const seen = new Set();
    const vis = new Set();
    let cam = null;
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
    window.__PERF_CAM__ = cam;
    return Boolean(cam);
  });
}

async function setQuality(page, labelTarget) {
  for (let i = 0; i < 4; i++) {
    const cur = await page.evaluate(
      () => document.querySelector('[data-quality-toggle="true"]')?.textContent ?? ''
    );
    if (cur.includes(labelTarget)) return cur;
    await page.click('[data-quality-toggle="true"]');
    await wait(250);
  }
  return await page.evaluate(
    () => document.querySelector('[data-quality-toggle="true"]')?.textContent ?? ''
  );
}

async function runTour(page) {
  const stops = [
    { pos: [0, 1.7, 3.7], look: [0, 1.5, -2.5] },
    { pos: [1.6, 1.7, 0.2], look: [4.5, 1.4, -1.6] },
    { pos: [1.6, 1.7, -0.4], look: [-4.5, 1.5, 0.0] },
    { pos: [0.0, 1.7, 0.0], look: [0.0, 1.5, 4.9] },
  ];

  await page.evaluate(() => {
    window.__GL_STATS__.frames = [];
  });

  for (const s of stops) {
    await page.evaluate(
      ([px, py, pz], [lx, ly, lz]) => {
        const cam = window.__PERF_CAM__;
        if (!cam) return;
        cam.position.set(px, py, pz);
        cam.lookAt(lx, ly, lz);
        cam.rotation.order = 'YXZ';
        cam.updateMatrixWorld(true);
      },
      s.pos,
      s.look
    );
    await wait(1100);
  }

  return page.evaluate(() => {
    const frames = window.__GL_STATS__?.frames ?? [];
    if (frames.length === 0) {
      return { frameCount: 0, avgFps: 0, maxSceneDraws: 0, avgSceneDraws: 0, maxTotalDraws: 0, maxTris: 0 };
    }
    const avgDt = frames.reduce((a, b) => a + b.dt, 0) / frames.length;
    const avgSceneDraws = frames.reduce((a, b) => a + b.sceneDraws, 0) / frames.length;
    const maxSceneDraws = Math.max(...frames.map((f) => f.sceneDraws));
    const maxTotalDraws = Math.max(...frames.map((f) => f.draws));
    const maxTris = Math.max(...frames.map((f) => f.tris));
    return {
      frameCount: frames.length,
      avgFps: +(1000 / avgDt).toFixed(1),
      avgSceneDraws: +avgSceneDraws.toFixed(1),
      maxSceneDraws,
      maxTotalDraws,
      maxTris,
    };
  });
}

async function main() {
  const { proc } = await startServerIfNeeded();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'room-perf-'));
  let browser = null;

  try {
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
    await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
    await page.evaluateOnNewDocument(HOOK_SCRIPT);
    await page.goto(`${BASE_URL}/?skip=1`, { waitUntil: 'networkidle2' });

    await page.waitForFunction(
      () =>
        Boolean(document.querySelector('canvas')) &&
        Boolean(document.querySelector('[data-quality-toggle="true"]')) &&
        (window.__GL_STATS__?.frames?.length ?? 0) >= 4,
      { polling: 100, timeout: 25000 }
    );

    const camFound = await locateCamera(page);
    assert(camFound, 'Failed to locate Three.js camera for perf tour');

    // Full camera sweep warmup so JIT/shaders on all walls settle before timing
    for (const [px, py, pz, lx, ly, lz] of [
      [0, 1.7, 3.7, 0, 1.5, -2.5],
      [1.6, 1.7, 0.2, 4.5, 1.4, -1.6],
      [1.6, 1.7, -0.4, -4.5, 1.5, 0.0],
      [0.0, 1.7, 0.0, 0.0, 1.5, 4.9],
    ]) {
      await page.evaluate(
        (x, y, z, tx, ty, tz) => {
          const cam = window.__PERF_CAM__;
          if (!cam) return;
          cam.position.set(x, y, z);
          cam.lookAt(tx, ty, tz);
          cam.rotation.order = 'YXZ';
          cam.updateMatrixWorld(true);
        },
        px,
        py,
        pz,
        lx,
        ly,
        lz
      );
      await wait(300);
    }

    const highLabel = await setQuality(page, 'High');
    assert(highLabel.includes('High'), `Expected High quality toggle, got ${highLabel}`);
    await wait(500);
    const high = await runTour(page);
    console.log('PERF_HIGH:', JSON.stringify(high));

    const lowLabel = await setQuality(page, 'Low');
    assert(lowLabel.includes('Low'), `Expected Low quality toggle, got ${lowLabel}`);
    await wait(500);
    const low = await runTour(page);
    console.log('PERF_LOW:', JSON.stringify(low));

    assert(high.maxSceneDraws <= DRAW_BUDGET, `High scene draws (${high.maxSceneDraws}) exceeded budget ${DRAW_BUDGET}`);
    assert(low.maxSceneDraws <= DRAW_BUDGET, `Low scene draws (${low.maxSceneDraws}) exceeded budget ${DRAW_BUDGET}`);
  } finally {
    if (browser) await browser.close().catch(() => {});
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup error
    }
    if (proc) proc.kill('SIGKILL');
  }
}

main().catch((err) => {
  console.error('PERF FAILED:', err);
  process.exit(1);
});
