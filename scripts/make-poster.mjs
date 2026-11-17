import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';

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
  throw new Error('Could not find Chrome/Chromium binary for poster capture.');
}

const PORT = Number(process.env.POSTER_PORT || 3021);
const BASE_URL = process.env.POSTER_URL || `http://127.0.0.1:${PORT}`;
const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const WELCOME_DIR = path.join(PUBLIC_DIR, 'welcome');
const OG_OUT = path.join(PUBLIC_DIR, 'welcome-og.jpg');
const GRAIN_OUT = path.join(PUBLIC_DIR, 'welcome-grain.png');
const PLACEHOLDERS_OUT = path.resolve(process.cwd(), 'src', 'config', 'welcomePlaceholders.ts');

const FOV = 62;
const SCENE_SHOTS = [
  {
    id: 'scene-1',
    file: 'scene-1.webp',
    // Entrance low angle looking across foreground sofa silhouette toward RGB backlit media wall
    pos: [2.25, 1.2, 2.95],
    lookAt: [-3.15, 1.32, -0.25],
  },
  {
    id: 'scene-2',
    file: 'scene-2.webp',
    // Gaming corner shifted cleanly left of arcade so RAI FARHAN neon, hexagons & Rai XP monitor frame without clipping arcade edge
    pos: [2.75, 1.2, -1.55],
    lookAt: [3.35, 1.45, -4.45],
  },
  {
    id: 'scene-3',
    file: 'scene-3.webp',
    // East arcade & shelf neon composition kept cleanly right of the hero typography
    pos: [1.35, 1.2, 0.65],
    lookAt: [3.95, 1.44, -2.85],
  },
];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clampByte = (v) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));
const smoothstep = (e0, e1, x) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

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

/**
 * Applies cinema film color grading cleanly without softening detail:
 * subtle black crush, cool teal in shadows, and warm amber/gold in highlights,
 * plus baked left-side text scrim + radial vignette for >= 4.5:1 foreground contrast.
 */
async function gradeAndBakeStill(pngBuffer, width = 1920, height = 1080) {
  const { data, info } = await sharp(pngBuffer)
    .resize(width, height, { fit: 'cover' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = Buffer.from(data);
  for (let i = 0; i < pixels.length; i += 4) {
    let r = pixels[i];
    let g = pixels[i + 1];
    let b = pixels[i + 2];

    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

    // Slight black crush only in deepest shadows, generous midtone clarity so room form shines
    const toe = lum < 0.09 ? (0.09 - lum) * 26 : 0;
    const lift = smoothstep(0.06, 0.75, lum);
    const gain = 1.08 + lift * 0.22;
    r = (r - toe) * gain;
    g = (g - toe) * gain;
    b = (b - toe) * gain;

    // Teal in shadows & warm amber/gold in highlights
    const shadowW = Math.pow(1 - smoothstep(0.05, 0.55, lum), 1.35);
    const highW = Math.pow(smoothstep(0.40, 0.92, lum), 1.2);

    r += -6 * shadowW + 16 * highW;
    g += 9 * shadowW + 7 * highW;
    b += 11 * shadowW - 10 * highW;

    pixels[i] = clampByte(r);
    pixels[i + 1] = clampByte(g);
    pixels[i + 2] = clampByte(b);
  }

  // Bake left-side text legibility scrim + bottom edge darken + subtle radial cinema vignette
  const scrimSvg = Buffer.from(
    `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="leftScrim" x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stop-color="#07080B" stop-opacity="0.86"/>
          <stop offset="25%" stop-color="#07080B" stop-opacity="0.62"/>
          <stop offset="44%" stop-color="#07080B" stop-opacity="0.24"/>
          <stop offset="62%" stop-color="#07080B" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="bottomScrim" x1="50%" y1="100%" x2="50%" y2="55%">
          <stop offset="0%" stop-color="#07080B" stop-opacity="0.64"/>
          <stop offset="40%" stop-color="#07080B" stop-opacity="0.18"/>
          <stop offset="100%" stop-color="#07080B" stop-opacity="0"/>
        </linearGradient>
        <radialGradient id="vignette" cx="62%" cy="46%" r="72%">
          <stop offset="52%" stop-color="#07080B" stop-opacity="0"/>
          <stop offset="86%" stop-color="#07080B" stop-opacity="0.26"/>
          <stop offset="100%" stop-color="#07080B" stop-opacity="0.56"/>
        </radialGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#leftScrim)"/>
      <rect width="${width}" height="${height}" fill="url(#bottomScrim)"/>
      <rect width="${width}" height="${height}" fill="url(#vignette)"/>
    </svg>`
  );

  return sharp(pixels, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .composite([{ input: scrimSvg, blend: 'over' }])
    .png()
    .toBuffer();
}

/**
 * Generates sharp WebP staying strictly under budget (default 220 KB), starting at targetQuality (72).
 */
async function encodeBoundedWebp(gradedPng, outPath, targetQuality = 72, maxBytes = 220 * 1024) {
  let quality = targetQuality;
  for (let attempt = 0; attempt < 4; attempt++) {
    const buf = await sharp(gradedPng).webp({ quality, effort: 5 }).toBuffer();
    if (buf.length <= maxBytes || attempt === 3) {
      fs.writeFileSync(outPath, buf);
      return buf.length;
    }
    quality = Math.max(54, quality - 6);
  }
  return fs.statSync(outPath).size;
}

async function createOgOverlayPng(page) {
  // Use Chromium 2D canvas with loaded page fonts (Instrument Serif / Georgia serif fallback) for razor-sharp OG typography
  const dataUrl = await page.evaluate(async () => {
    try {
      await document.fonts.ready;
    } catch {
      // ignore
    }
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 630;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    const serifFamily = '"Instrument Serif", Georgia, "Times New Roman", serif';
    const monoFamily = '"JetBrains Mono", ui-monospace, monospace';

    ctx.fillStyle = '#F2EDE4';
    ctx.shadowColor = 'rgba(7, 8, 11, 0.55)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 3;

    ctx.font = `400 112px ${serifFamily}`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('Rai', 74, 412);

    ctx.font = `italic 400 112px ${serifFamily}`;
    ctx.fillText('Farhan', 74, 508);

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#FFB36B';
    ctx.fillRect(76, 534, 60, 2);

    ctx.fillStyle = '#CFC8BB';
    ctx.font = `400 16px ${monoFamily}`;
    ctx.fillText('INTERACTIVE 3D PORTFOLIO', 76, 574);

    return canvas.toDataURL('image/png');
  });

  if (!dataUrl.startsWith('data:image/png;base64,')) return null;
  return Buffer.from(dataUrl.slice('data:image/png;base64,'.length), 'base64');
}

async function main() {
  fs.mkdirSync(WELCOME_DIR, { recursive: true });
  const { proc } = await startServerIfNeeded();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'room-poster-'));
  let browser = null;

  try {
    browser = await puppeteer.launch({
      executablePath: CHROME,
      headless: 'new',
      userDataDir,
      args: [
        '--window-size=1920,1080',
        '--disable-gpu-sandbox',
        '--enable-webgl',
        '--ignore-gpu-blocklist',
        '--no-first-run',
        '--no-default-browser-check',
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
    await page.evaluateOnNewDocument(() => {
      let lockedEl = null;
      Object.defineProperty(document, 'pointerLockElement', {
        configurable: true,
        get: () => lockedEl,
      });
      document.exitPointerLock = () => {
        if (lockedEl) {
          lockedEl = null;
          document.dispatchEvent(new Event('pointerlockchange'));
        }
      };
      Element.prototype.requestPointerLock = function () {
        lockedEl = this;
        setTimeout(() => document.dispatchEvent(new Event('pointerlockchange')), 10);
        return Promise.resolve();
      };
    });
    await page.goto(`${BASE_URL}/?skip=1`, { waitUntil: 'domcontentloaded' });

    await page.waitForSelector('canvas', { timeout: 30000 });
    await wait(2200);

    // Ensure Night theme with RGB glow is active
    const initialTheme = await page.evaluate(() => window.__getThemeDebugState?.()?.theme);
    if (initialTheme !== 'night') {
      await page.keyboard.press('KeyT');
      await wait(950);
    }

    // Force High graphics quality
    const qualityBtnText = await page.evaluate(
      () => document.querySelector('[data-quality-toggle="true"]')?.textContent ?? ''
    );
    if (!qualityBtnText.includes('High')) {
      for (let i = 0; i < 3; i++) {
        const cur = await page.evaluate(
          () => document.querySelector('[data-quality-toggle="true"]')?.textContent ?? ''
        );
        if (cur.includes('High')) break;
        await page.click('[data-quality-toggle="true"]');
        await wait(200);
      }
    }

    // Wake the PC ultrawide desktop display so monitor glow shines in the Gaming Corner shot
    await page.click('canvas');
    await wait(250);
    await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
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
        if (o.isPerspectiveCamera) { cam = o; return; }
        if (o.getState) {
          try {
            const s = o.getState();
            if (s?.camera?.isPerspectiveCamera) { cam = s.camera; return; }
          } catch {}
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
      if (cam) {
        window.__POSTER_CAM__ = cam;
        cam.position.set(2.75, 1.7, -4.55);
        cam.lookAt(4.72, 1.06, -3.85);
        cam.rotation.order = 'YXZ';
        cam.updateMatrixWorld(true);
      }
    });
    await wait(200);
    await page.keyboard.press('KeyE');
    await wait(2900);
    await page.keyboard.press('KeyQ');
    await wait(400);

    // Hide all HUD widgets and Three.js Stats panel for clean architectural photography
    await page.evaluate(() => {
      const style = document.createElement('style');
      style.textContent =
        '[data-resume-pill],[data-quality-toggle],[data-focus-hint],[data-hud-overlay]{display:none!important;}';
      document.head.appendChild(style);
      const hideSel = [
        '[data-resume-pill="true"]',
        '[data-quality-toggle="true"]',
        '[data-focus-hint="true"]',
      ];
      for (const sel of hideSel) {
        const el = document.querySelector(sel);
        if (el instanceof HTMLElement) el.style.display = 'none';
      }
      for (const div of Array.from(document.querySelectorAll('body div'))) {
        if (div instanceof HTMLElement && div.style.position === 'fixed' && div.querySelector('canvas')) {
          div.style.display = 'none';
        }
      }
    });

    const placeholders = {};
    let gradedScene1Png = null;

    for (const shot of SCENE_SHOTS) {
      await page.evaluate(
        (pos, lookAt, fov) => {
          let cam = window.__POSTER_CAM__;
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
            window.__POSTER_CAM__ = cam;
          }
          if (!cam) throw new Error('Three.js camera not found during poster capture');
          cam.fov = fov;
          cam.updateProjectionMatrix();
          cam.position.set(pos[0], pos[1], pos[2]);
          cam.lookAt(lookAt[0], lookAt[1], lookAt[2]);
          cam.rotation.order = 'YXZ';
          cam.updateMatrixWorld(true);
        },
        shot.pos,
        shot.lookAt,
        FOV
      );

      await wait(1100);
      const rawPng = await page.screenshot({ type: 'png' });
      const gradedPng = await gradeAndBakeStill(rawPng, 1920, 1080);
      if (shot.id === 'scene-1') {
        gradedScene1Png = gradedPng;
      }

      const outPath = path.join(WELCOME_DIR, shot.file);
      const bytes = await encodeBoundedWebp(gradedPng, outPath, 72, 220 * 1024);
      assert(bytes <= 220 * 1024, `${shot.file} exceeded 220KB budget: ${bytes} bytes`);

      const tinyBuf = await sharp(gradedPng)
        .resize(24, 14, { fit: 'cover' })
        .blur(1.8)
        .webp({ quality: 55 })
        .toBuffer();
      placeholders[shot.id] = `data:image/webp;base64,${tinyBuf.toString('base64')}`;

      console.log(`Generated welcome/${shot.file} (${(bytes / 1024).toFixed(1)} KB, placeholder ${tinyBuf.length}B)`);
    }

    // Write inline base64 placeholder module
    const placeholderSource = `// Auto-generated by scripts/make-poster.mjs (24px blurred WebP placeholders for zero-flash FCP)\nexport const WELCOME_SCENE_PLACEHOLDERS: Record<string, string> = ${JSON.stringify(
      placeholders,
      null,
      2
    )};\n`;
    fs.writeFileSync(PLACEHOLDERS_OUT, placeholderSource);

    // Generate sharp 1200x630 Open Graph share image from scene-1 with bottom-left serif name composite
    assert(gradedScene1Png, 'scene-1 PNG required for OG output');
    const ogTextPng = await createOgOverlayPng(page);
    const ogPipe = sharp(gradedScene1Png).resize(1200, 630, { fit: 'cover', position: 'center' });
    if (ogTextPng) {
      ogPipe.composite([{ input: ogTextPng, blend: 'over' }]);
    }
    await ogPipe.jpeg({ quality: 88, mozjpeg: true }).toFile(OG_OUT);

    // Subtle 96x96 monochrome film grain tile PNG
    const grainSize = 96;
    const grainBuf = Buffer.alloc(grainSize * grainSize);
    let seed = 0x9e3779b9;
    for (let i = 0; i < grainBuf.length; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      grainBuf[i] = (seed >>> 24) & 0xff;
    }
    await sharp(grainBuf, {
      raw: { width: grainSize, height: grainSize, channels: 1 },
    })
      .png({ compressionLevel: 9 })
      .toFile(GRAIN_OUT);

    const ogStats = fs.statSync(OG_OUT);
    console.log(`Generated welcome-og.jpg (${(ogStats.size / 1024).toFixed(1)} KB) and welcomePlaceholders.ts`);
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
  console.error('Poster generation failed:', err);
  process.exit(1);
});
