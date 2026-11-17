import * as THREE from 'three';
import { GAMING_ROOM_CONFIG } from '@/config/themeConfig';

export interface UvRect {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

// Track active canvas textures cleanly for imperative high-score redraws without mutating React hooks
const HIGH_SCORE_CTX_MAP = new WeakMap<
  THREE.Texture,
  { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }
>();

/**
 * Computes normalized WebGL UV bounds (y=0 at bottom in Three.js UV space)
 * from top-left pixel coordinates on a canvas of size (atlasW, atlasH).
 */
export function pixelRectToUv(
  x: number,
  y: number,
  w: number,
  h: number,
  atlasW: number,
  atlasH: number
): UvRect {
  return {
    u0: x / atlasW,
    u1: (x + w) / atlasW,
    v0: 1 - (y + h) / atlasH,
    v1: 1 - y / atlasH,
  };
}

/**
 * Precomputed UV rects inside the 1024x1024 Game Shelf Atlas:
 * - Each of 16 games owns a 256x192 tile in the top 1024x768 area
 *   (left 200px cover art, right 56px vertical spine).
 * - Each of 5 retro cartridges owns a 176x128 tile at y=768.
 * - Engraved "PULL SHARK" trophy plate at bottom-right.
 */
export const GAME_SHELF_ATLAS_METRICS = {
  size: 1024,
  cols: 4,
  tileW: 256,
  tileH: 192,
  coverW: 200,
  spineXOffset: 200,
  spineW: 56,
  cartridgeW: 176,
  cartridgeH: 128,
  cartridgeY: 768,
};

export function getGameCaseFullUvRect(index: number): [number, number, number, number] {
  const i = ((index % 16) + 16) % 16;
  const col = i % 4;
  const row = Math.floor(i / 4);
  const { size, tileW, tileH } = GAME_SHELF_ATLAS_METRICS;
  const r = pixelRectToUv(col * tileW + 2, row * tileH + 2, tileW - 4, tileH - 4, size, size);
  return [r.u0, r.v0, r.u1 - r.u0, r.v1 - r.v0];
}

export function getCartridgeUvRect(index: number): [number, number, number, number] {
  const i = ((index % 5) + 5) % 5;
  const { size, cartridgeW, cartridgeH, cartridgeY } = GAME_SHELF_ATLAS_METRICS;
  const r = pixelRectToUv(i * cartridgeW + 2, cartridgeY + 2, cartridgeW - 4, cartridgeH - 4, size, size);
  return [r.u0, r.v0, r.u1 - r.u0, r.v1 - r.v0];
}

/**
 * UV rectangles in the 2048x1024 Posters Atlas for the 5 wall posters.
 */
export const POSTER_ATLAS_METRICS = {
  width: 2048,
  height: 1024,
  slots: [
    pixelRectToUv(16, 16, 650, 480, 2048, 1024), // 0: Synthwave Horizon
    pixelRectToUv(698, 16, 650, 480, 2048, 1024), // 1: Pixel City Skyline
    pixelRectToUv(1380, 16, 650, 480, 2048, 1024), // 2: INSERT COIN
    pixelRectToUv(16, 528, 650, 480, 2048, 1024), // 3: ACHIEVEMENT UNLOCKED
    pixelRectToUv(698, 528, 650, 480, 2048, 1024), // 4: KEYCAP EXPLODED
  ] as const,
};

/**
 * UV rectangles inside the 512x512 Small Props Atlas.
 */
export const SMALL_PROPS_UV = {
  canVolt: pixelRectToUv(2, 2, 82, 252, 512, 512),
  canHyper: pixelRectToUv(87, 2, 82, 252, 512, 512),
  canByte: pixelRectToUv(172, 2, 82, 252, 512, 512),
  pizzaPie: pixelRectToUv(260, 4, 248, 248, 512, 512),
  streamDeck: pixelRectToUv(4, 260, 248, 120, 512, 512),
  onAir: pixelRectToUv(260, 260, 248, 120, 512, 512),
  beanBagFabric: pixelRectToUv(4, 388, 248, 120, 512, 512),
  pizzaLid: pixelRectToUv(260, 388, 248, 120, 512, 512),
} as const;

/**
 * 1) Seamless 1024x1 rainbow gradient strip texture scrolled smoothly for perimeter RGB LEDs.
 */
export function createRgbWaveGradientTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const w = 1024;
  const h = 1;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0.0, '#ff2e63');
  grad.addColorStop(0.16, '#ff8a00');
  grad.addColorStop(0.32, '#facc15');
  grad.addColorStop(0.48, '#22c55e');
  grad.addColorStop(0.65, '#06b6d4');
  grad.addColorStop(0.82, '#6366f1');
  grad.addColorStop(0.92, '#d946ef');
  grad.addColorStop(1.0, '#ff2e63');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * 2) Single 1024x1024 Game Shelf Atlas containing 16 invented game covers+spines,
 *    5 retro cartridges, and trophy nameplate.
 */
export function createGameShelfAtlasTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#0f1219';
  ctx.fillRect(0, 0, size, size);

  const { tileW, tileH, coverW, spineW, cartridgeW, cartridgeH, cartridgeY } =
    GAME_SHELF_ATLAS_METRICS;

  // Draw 16 original game case covers + matching spines
  GAMING_ROOM_CONFIG.gameTitles.forEach((game, idx) => {
    const col = idx % 4;
    const row = Math.floor(idx / 4);
    const ox = col * tileW;
    const oy = row * tileH;

    // Cover background
    const bgGrad = ctx.createLinearGradient(ox, oy, ox + coverW, oy + tileH);
    bgGrad.addColorStop(0, game.bg);
    bgGrad.addColorStop(1, '#090b10');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(ox, oy, coverW, tileH);

    // Abstract geometric motif unique per title (zero real characters/logos)
    ctx.save();
    ctx.beginPath();
    ctx.rect(ox + 10, oy + 26, coverW - 20, tileH - 72);
    ctx.clip();
    ctx.strokeStyle = game.accent;
    ctx.fillStyle = game.accent;
    ctx.globalAlpha = 0.25;
    for (let g = 0; g < 4; g++) {
      ctx.beginPath();
      ctx.arc(
        ox + 42 + ((idx * 37 + g * 29) % 115),
        oy + 55 + ((idx * 23 + g * 31) % 75),
        14 + ((idx + g) % 3) * 10,
        0,
        Math.PI * 2
      );
      if (g % 2 === 0) ctx.fill();
      else {
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 0.85;
    // Geometric emblem center
    const cx = ox + coverW / 2;
    const cy = oy + 82;
    ctx.beginPath();
    if (idx % 4 === 0) {
      ctx.moveTo(cx, cy - 26);
      ctx.lineTo(cx + 26, cy + 20);
      ctx.lineTo(cx - 26, cy + 20);
      ctx.closePath();
    } else if (idx % 4 === 1) {
      ctx.rect(cx - 22, cy - 22, 44, 44);
    } else if (idx % 4 === 2) {
      for (let s = 0; s < 6; s++) {
        const a = (s / 6) * Math.PI * 2;
        const px = cx + Math.cos(a) * 24;
        const py = cy + Math.sin(a) * 24;
        if (s === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    } else {
      ctx.arc(cx, cy, 24, 0, Math.PI * 2);
    }
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    // Top accent strip & genre pill
    ctx.fillStyle = game.accent;
    ctx.fillRect(ox, oy, tileW, 8);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(ox + 12, oy + 14, 68, 16);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(game.tag, ox + 46, oy + 25);

    // Bold title footer on front cover
    ctx.fillStyle = 'rgba(0,0,0,0.58)';
    ctx.fillRect(ox, oy + tileH - 42, coverW, 42);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 17px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(game.title, ox + coverW / 2, oy + tileH - 16);

    // Matching vertical spine strip (right 56px of tile)
    ctx.fillStyle = game.bg;
    ctx.fillRect(ox + coverW, oy + 8, spineW, tileH - 8);
    ctx.fillStyle = game.accent;
    ctx.fillRect(ox + coverW, oy + 8, 5, tileH - 8);
    ctx.fillRect(ox + coverW + 10, oy + tileH - 22, spineW - 18, 12);

    ctx.save();
    ctx.translate(ox + coverW + spineW / 2 + 4, oy + tileH / 2 - 4);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(game.title, 0, 0);
    ctx.restore();
  });

  // Draw 5 Retro Cartridges (row y=768)
  const cartColors = ['#e11d48', '#0284c7', '#d97706', '#16a34a', '#7c3aed'];
  GAMING_ROOM_CONFIG.cartridgeTitles.forEach((title, idx) => {
    const ox = idx * cartridgeW;
    const oy = cartridgeY;
    const c = cartColors[idx % cartColors.length];

    ctx.fillStyle = '#181c26';
    ctx.fillRect(ox, oy, cartridgeW, cartridgeH);

    // Inner sticker box
    ctx.fillStyle = c;
    ctx.fillRect(ox + 10, oy + 12, cartridgeW - 20, cartridgeH - 24);
    ctx.fillStyle = 'rgba(9, 12, 20, 0.72)';
    ctx.fillRect(ox + 16, oy + 44, cartridgeW - 32, 46);

    // Retro gold stripes
    ctx.fillStyle = '#facc15';
    ctx.fillRect(ox + 16, oy + 20, cartridgeW - 32, 5);
    ctx.fillRect(ox + 16, oy + 29, (cartridgeW - 32) * 0.65, 3);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(title, ox + cartridgeW / 2, oy + 72);

    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('16-BIT CARTRIDGE', ox + cartridgeW / 2, oy + 104);
  });

  // Engraved Trophy & Retro Plaque at bottom-right
  ctx.fillStyle = '#2b2110';
  ctx.fillRect(880, 768, 144, 128);
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 3;
  ctx.strokeRect(886, 774, 132, 116);
  ctx.fillStyle = '#fde68a';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('PULL SHARK', 952, 826);
  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 11px monospace';
  ctx.fillText('ACHIEVEMENT', 952, 848);

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * 3) Single 2048x1024 Gaming Posters Atlas for 5 distinct framed wall posters.
 */
export function createGamingPostersAtlasTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const W = POSTER_ATLAS_METRICS.width;
  const H = POSTER_ATLAS_METRICS.height;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#090b12';
  ctx.fillRect(0, 0, W, H);

  // Helper to clip each 650x480 poster cell
  const drawSlot = (x: number, y: number, drawFn: (cx: number, cy: number, cw: number, ch: number) => void) => {
    const cw = 650;
    const ch = 480;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, cw, ch);
    ctx.clip();
    drawFn(x, y, cw, ch);
    ctx.restore();
  };

  // Poster 0: Synthwave Geometric Sun & Grid Horizon
  drawSlot(16, 16, (x, y, w, h) => {
    const sky = ctx.createLinearGradient(x, y, x, y + h);
    sky.addColorStop(0, '#0f0524');
    sky.addColorStop(0.54, '#581c87');
    sky.addColorStop(0.55, '#170a2e');
    sky.addColorStop(1, '#070414');
    ctx.fillStyle = sky;
    ctx.fillRect(x, y, w, h);

    // Stars
    ctx.fillStyle = '#e2e8f0';
    for (let i = 0; i < 42; i++) {
      const sx = x + ((i * 157 + 29) % w);
      const sy = y + ((i * 89 + 17) % (h * 0.45));
      ctx.fillRect(sx, sy, 2, 2);
    }

    // Striped Synth Sun
    const sunCx = x + w / 2;
    const sunCy = y + h * 0.42;
    const sunR = 115;
    const sunGrad = ctx.createLinearGradient(sunCx, sunCy - sunR, sunCx, sunCy + sunR);
    sunGrad.addColorStop(0, '#fde047');
    sunGrad.addColorStop(0.5, '#fb7185');
    sunGrad.addColorStop(1, '#db2777');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(sunCx, sunCy, sunR, 0, Math.PI * 2);
    ctx.fill();

    // Horizontal synth slice cutouts across lower half of sun
    ctx.fillStyle = '#3b0764';
    for (let s = 0; s < 5; s++) {
      const sy = sunCy + 16 + s * 19;
      ctx.fillRect(sunCx - sunR - 4, sy, sunR * 2 + 8, 5 + s * 1.4);
    }

    // Neon cyan perspective wireframe ground
    const horizY = y + h * 0.56;
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, horizY);
    ctx.lineTo(x + w, horizY);
    ctx.stroke();

    for (let i = -8; i <= 8; i++) {
      ctx.beginPath();
      ctx.moveTo(sunCx + i * 24, horizY);
      ctx.lineTo(sunCx + i * 95, y + h);
      ctx.stroke();
    }
    for (let r = 1; r <= 7; r++) {
      const t = (r / 7) * (r / 7);
      const ry = horizY + t * (h * 0.44);
      ctx.beginPath();
      ctx.moveTo(x, ry);
      ctx.lineTo(x + w, ry);
      ctx.stroke();
    }

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('NEON HORIZON', sunCx, y + h - 24);
  });

  // Poster 1: Pixel City Skyline at Night
  drawSlot(698, 16, (x, y, w, h) => {
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, '#070b1a');
    grad.addColorStop(0.7, '#162447');
    grad.addColorStop(1, '#091124');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);

    // Pixel moon
    ctx.fillStyle = '#fef3c7';
    ctx.fillRect(x + 92, y + 66, 56, 56);
    ctx.fillStyle = '#0c152e';
    ctx.fillRect(x + 114, y + 58, 44, 44);

    // Pixel stars
    ctx.fillStyle = '#bae6fd';
    for (let i = 0; i < 36; i++) {
      ctx.fillRect(x + ((i * 193 + 11) % w), y + ((i * 73 + 19) % 190), 4, 4);
    }

    // Skyline towers & lit pixel windows
    const buildings = [
      [12, 160, 74],
      [88, 220, 68],
      [162, 140, 62],
      [230, 265, 86],
      [322, 185, 72],
      [400, 240, 82],
      [488, 155, 70],
      [564, 210, 78],
    ];
    const baseLine = y + h - 76;
    for (let b = 0; b < buildings.length; b++) {
      const [bx, bh, bw] = buildings[b];
      ctx.fillStyle = b % 2 === 0 ? '#0f172a' : '#1e293b';
      ctx.fillRect(x + bx, baseLine - bh, bw, bh);
      for (let wy = baseLine - bh + 14; wy < baseLine - 16; wy += 20) {
        for (let wx = x + bx + 10; wx < x + bx + bw - 14; wx += 16) {
          if (((wx + wy + b) % 5) === 0) continue;
          ctx.fillStyle = ((wx + wy) % 3 === 0) ? '#38bdf8' : '#fbbf24';
          ctx.fillRect(wx, wy, 8, 10);
        }
      }
    }
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(x, baseLine, w, 76);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(x, baseLine, w, 3);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('MIDNIGHT DISTRICT', x + w / 2, y + h - 26);
  });

  // Poster 2: Retro INSERT COIN Neon Arcade Poster
  drawSlot(1380, 16, (x, y, w, h) => {
    ctx.fillStyle = '#090612';
    ctx.fillRect(x, y, w, h);

    // Double neon border
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 6;
    ctx.strokeRect(x + 26, y + 26, w - 52, h - 52);
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 38, y + 38, w - 76, h - 76);

    // Crisp coin slot emblem
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x + w / 2, y + 125, 36, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#facc15';
    ctx.fillRect(x + w / 2 - 4, y + 103, 8, 44);

    // Bold typography
    ctx.textAlign = 'center';
    ctx.fillStyle = '#22d3ee';
    ctx.font = 'bold 56px monospace';
    ctx.fillText('INSERT', x + w / 2, y + 245);
    ctx.fillStyle = '#f43f5e';
    ctx.font = 'bold 64px monospace';
    ctx.fillText('COIN', x + w / 2, y + 318);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('PRESS START  //  STAGE 01', x + w / 2, y + 392);
  });

  // Poster 3: ACHIEVEMENT UNLOCKED Dark Plaque
  drawSlot(16, 528, (x, y, w, h) => {
    ctx.fillStyle = '#0b101b';
    ctx.fillRect(x, y, w, h);

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 4;
    ctx.strokeRect(x + 22, y + 22, w - 44, h - 44);

    // Hexagon trophy badge
    const cx = x + w / 2;
    const cy = y + 138;
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 5;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const px = cx + Math.cos(a) * 58;
      const py = cy + Math.sin(a) * 58;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Stylized Shark Fin silhouette inside badge
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(cx - 22, cy + 20);
    ctx.quadraticCurveTo(cx - 10, cy - 26, cx + 22, cy - 28);
    ctx.quadraticCurveTo(cx + 8, cy, cx + 22, cy + 20);
    ctx.closePath();
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 26px monospace';
    ctx.fillText('ACHIEVEMENT UNLOCKED', cx, y + 252);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText('Pull Shark', cx, y + 314);
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('Pair Extraordinaire', cx, y + 354);

    // XP Bar
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(x + 95, y + 394, w - 190, 18);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(x + 95, y + 394, w - 190, 18);
  });

  // Poster 4: Minimal Mechanical Keycap Exploded Blueprint
  drawSlot(698, 528, (x, y, w, h) => {
    ctx.fillStyle = '#0d1522';
    ctx.fillRect(x, y, w, h);

    // Blueprint micro-grid
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
    ctx.lineWidth = 1;
    for (let gx = x; gx < x + w; gx += 32) {
      ctx.beginPath();
      ctx.moveTo(gx, y);
      ctx.lineTo(gx, y + h);
      ctx.stroke();
    }
    for (let gy = y; gy < y + h; gy += 32) {
      ctx.beginPath();
      ctx.moveTo(x, gy);
      ctx.lineTo(x + w, gy);
      ctx.stroke();
    }

    const cx = x + w / 2;
    // Keycap top shell
    ctx.strokeStyle = '#38bdf8';
    ctx.fillStyle = '#16253b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(cx - 72, y + 86, 144, 56, 8);
    ctx.fill();
    ctx.stroke();

    // Cross Stem
    ctx.fillStyle = '#f43f5e';
    ctx.fillRect(cx - 10, y + 168, 20, 44);
    ctx.fillRect(cx - 32, y + 182, 64, 14);

    // Coil Spring zigzag
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let s = 0; s <= 6; s++) {
      const sy = y + 230 + s * 12;
      const sx = cx + (s % 2 === 0 ? -18 : 18);
      if (s === 0) ctx.moveTo(cx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();

    // Bottom Housing
    ctx.strokeStyle = '#94a3b8';
    ctx.fillStyle = '#111827';
    ctx.fillRect(cx - 80, y + 324, 160, 52);
    ctx.strokeRect(cx - 80, y + 324, 160, 52);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 22px monospace';
    ctx.fillText('TACTILE SWITCH // EXPLODED VIEW', cx, y + 428);
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * 4) Single 1024x512 Transparent Neon Signs Atlas with baked layered glow:
 *    - Left half: "LEVEL UP" text + pixel upward chevron
 *    - Right half: Stylized Pixel Controller geometric outline
 */
export function createNeonSignsAtlasTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const W = 1024;
  const H = 512;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.clearRect(0, 0, W, H);

  // Dark subtle acrylic backing halo pill on each side (alpha-blended)
  const strokeGlowText = (
    text: string,
    tx: number,
    ty: number,
    font: string,
    glowColor: string,
    coreColor: string
  ) => {
    ctx.save();
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 28;
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = 10;
    ctx.strokeText(text, tx, ty);
    ctx.shadowBlur = 12;
    ctx.strokeStyle = coreColor;
    ctx.lineWidth = 4;
    ctx.strokeText(text, tx, ty);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, tx, ty);
    ctx.restore();
  };

  // Left half (x in 0..512): "LEVEL UP" + Magenta Double Chevron
  ctx.save();
  ctx.shadowColor = '#ec4899';
  ctx.shadowBlur = 24;
  ctx.strokeStyle = '#ec4899';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const offsetY of [0, 34]) {
    ctx.beginPath();
    ctx.moveTo(212, 126 + offsetY);
    ctx.lineTo(256, 86 + offsetY);
    ctx.lineTo(300, 126 + offsetY);
    ctx.stroke();
  }
  ctx.shadowBlur = 8;
  ctx.strokeStyle = '#fbcfe8';
  ctx.lineWidth = 4;
  for (const offsetY of [0, 34]) {
    ctx.beginPath();
    ctx.moveTo(212, 126 + offsetY);
    ctx.lineTo(256, 86 + offsetY);
    ctx.lineTo(300, 126 + offsetY);
    ctx.stroke();
  }
  ctx.restore();

  strokeGlowText('LEVEL UP', 256, 305, 'bold 92px monospace', '#22d3ee', '#e0faff');

  // Subtle cyan tube border around LEVEL UP
  ctx.save();
  ctx.shadowColor = '#22d3ee';
  ctx.shadowBlur = 22;
  ctx.strokeStyle = '#22d3ee';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.roundRect(26, 44, 460, 424, 28);
  ctx.stroke();
  ctx.shadowBlur = 6;
  ctx.strokeStyle = '#ecfeff';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();

  // Right half (x in 512..1024): Stylized Pixel Controller Neon Outline
  const drawCtrlOutline = (lw: number, stroke: string, blur: number) => {
    ctx.save();
    ctx.shadowColor = stroke;
    ctx.shadowBlur = blur;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(648, 152);
    ctx.lineTo(888, 152);
    ctx.quadraticCurveTo(954, 152, 964, 232);
    ctx.lineTo(978, 342);
    ctx.quadraticCurveTo(980, 392, 926, 394);
    ctx.quadraticCurveTo(884, 394, 862, 326);
    ctx.lineTo(674, 326);
    ctx.quadraticCurveTo(652, 394, 610, 394);
    ctx.quadraticCurveTo(556, 392, 558, 342);
    ctx.lineTo(572, 232);
    ctx.quadraticCurveTo(582, 152, 648, 152);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  };
  drawCtrlOutline(12, '#38bdf8', 28);
  drawCtrlOutline(4.5, '#f0fdff', 10);

  // Pixel D-pad (left) glowing pink
  ctx.save();
  ctx.shadowColor = '#f43f5e';
  ctx.shadowBlur = 20;
  ctx.fillStyle = '#fb7185';
  ctx.fillRect(654, 200, 22, 66);
  ctx.fillRect(632, 222, 66, 22);
  ctx.fillStyle = '#fff1f2';
  ctx.fillRect(659, 206, 12, 54);
  ctx.fillRect(638, 227, 54, 12);

  // 4 Action buttons (right) glowing lime/amber/pink/cyan
  const btns: Array<[number, number, string]> = [
    [868, 198, '#4ade80'],
    [902, 230, '#f43f5e'],
    [868, 262, '#38bdf8'],
    [834, 230, '#facc15'],
  ];
  for (const [bx, by, col] of btns) {
    ctx.shadowColor = col;
    ctx.shadowBlur = 18;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(bx, by, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(bx, by, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * 5) Single 512x512 Small Props Atlas:
 *    - 3 original energy drink labels (VOLT-X, HYPER, BYTE)
 *    - Open pizza interior pie (7 slices + 1 missing slice) & box lid
 *    - 5x3 Stream Deck icons
 *    - "ON AIR" studio box plate
 *    - Stitched bean bag fabric grain
 */
export function createSmallPropsAtlasTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#181a20';
  ctx.fillRect(0, 0, size, size);

  // A. 3 Original Energy Drink Can Labels (x = 0..255, y = 0..255)
  const drinks = [
    { x: 0, w: 85, bg: '#0c192c', accent: '#22d3ee', name: 'VOLT-X' },
    { x: 85, w: 85, bg: '#260b14', accent: '#f43f5e', name: 'HYPER' },
    { x: 170, w: 86, bg: '#081f17', accent: '#4ade80', name: 'BYTE' },
  ];
  for (const d of drinks) {
    ctx.fillStyle = d.bg;
    ctx.fillRect(d.x, 0, d.w, 256);
    ctx.fillStyle = d.accent;
    ctx.fillRect(d.x, 18, d.w, 10);
    ctx.fillRect(d.x, 228, d.w, 10);

    // Crisp angular lightning bolt
    const cx = d.x + d.w / 2;
    ctx.beginPath();
    ctx.moveTo(cx + 8, 56);
    ctx.lineTo(cx - 12, 104);
    ctx.lineTo(cx + 2, 104);
    ctx.lineTo(cx - 8, 152);
    ctx.lineTo(cx + 16, 98);
    ctx.lineTo(cx + 2, 98);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(d.name, cx, 186);
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 9px monospace';
    ctx.fillText('ZERO SUGAR', cx, 204);
  }

  // B. Open Pizza Interior (x = 256..512, y = 0..255)
  ctx.fillStyle = '#d8c3a2'; // inner cardboard floor
  ctx.fillRect(256, 0, 256, 256);
  ctx.fillStyle = '#f3ead8'; // greaseproof paper liner
  ctx.fillRect(272, 16, 224, 224);

  const px = 384;
  const py = 128;
  // Draw 7 of 8 pizza slices (leaving bottom-right wedge missing!)
  for (let s = 0; s < 8; s++) {
    if (s === 1) continue; // Missing slice spot
    const a0 = (s / 8) * Math.PI * 2 + 0.04;
    const a1 = ((s + 1) / 8) * Math.PI * 2 - 0.04;
    const midA = (a0 + a1) / 2;

    // Crust outer arc
    ctx.fillStyle = '#c88442';
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.arc(px, py, 94, a0, a1);
    ctx.closePath();
    ctx.fill();

    // Melted cheese triangle
    ctx.fillStyle = '#f6c344';
    ctx.beginPath();
    ctx.moveTo(px + Math.cos(midA) * 5, py + Math.sin(midA) * 5);
    ctx.arc(px, py, 81, a0 + 0.015, a1 - 0.015);
    ctx.closePath();
    ctx.fill();

    // Pepperoni circles
    ctx.fillStyle = '#b91c1c';
    for (const r of [42, 65]) {
      ctx.beginPath();
      ctx.arc(
        px + Math.cos(midA + (r === 42 ? 0.07 : -0.07)) * r,
        py + Math.sin(midA + (r === 42 ? 0.07 : -0.07)) * r,
        9.5,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  }

  // C. 5x3 Stream Deck Key Matrix (x = 0..256, y = 256..384)
  ctx.fillStyle = '#11131a';
  ctx.fillRect(0, 256, 256, 128);
  const deckColors = [
    '#22d3ee', '#f43f5e', '#4ade80', '#a855f7', '#fbbf24',
    '#38bdf8', '#fb7185', '#34d399', '#818cf8', '#f97316',
    '#2dd4bf', '#e879f9', '#facc15', '#60a5fa', '#ef4444',
  ];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 5; col++) {
      const kx = 14 + col * 48;
      const ky = 266 + row * 38;
      const colHex = deckColors[row * 5 + col];
      ctx.fillStyle = '#1f2433';
      ctx.beginPath();
      ctx.roundRect(kx, ky, 40, 30, 5);
      ctx.fill();
      ctx.strokeStyle = colHex;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Simple minimalist icon inside key
      ctx.fillStyle = colHex;
      const icx = kx + 20;
      const icy = ky + 15;
      if ((row + col) % 3 === 0) {
        ctx.beginPath();
        ctx.arc(icx, icy, 6, 0, Math.PI * 2);
        ctx.fill();
      } else if ((row + col) % 3 === 1) {
        ctx.fillRect(icx - 7, icy - 5, 14, 10);
      } else {
        ctx.beginPath();
        ctx.moveTo(icx - 5, icy - 6);
        ctx.lineTo(icx + 7, icy);
        ctx.lineTo(icx - 5, icy + 6);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  // D. "ON AIR" Sign Plate (x = 256..512, y = 256..384)
  ctx.fillStyle = '#14080c';
  ctx.fillRect(256, 256, 256, 128);
  ctx.strokeStyle = '#ff3b5c';
  ctx.lineWidth = 6;
  ctx.strokeRect(270, 270, 228, 100);
  ctx.fillStyle = '#ff3b5c';
  ctx.font = 'bold 54px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ON AIR', 384, 320);

  // E. Bean Bag Stitched Charcoal Fabric Texture (x = 0..256, y = 384..512)
  ctx.fillStyle = '#364054';
  ctx.fillRect(0, 384, 256, 128);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  for (let i = -128; i < 256; i += 6) {
    ctx.beginPath();
    ctx.moveTo(i, 384);
    ctx.lineTo(i + 128, 512);
    ctx.stroke();
  }
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.moveTo(0, 448);
  ctx.lineTo(256, 448);
  ctx.moveTo(128, 384);
  ctx.lineTo(128, 512);
  ctx.stroke();
  ctx.setLineDash([]);

  // F. Pizza Box Lid Label Art (x = 256..512, y = 384..512)
  ctx.fillStyle = '#c8aa80';
  ctx.fillRect(256, 384, 256, 128);
  ctx.strokeStyle = '#b91c1c';
  ctx.lineWidth = 4;
  ctx.strokeRect(272, 396, 224, 104);
  ctx.fillStyle = '#b91c1c';
  ctx.font = 'bold 28px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PIXEL PIE CO.', 384, 438);
  ctx.fillStyle = '#1f2937';
  ctx.font = 'bold 14px monospace';
  ctx.fillText('HOT & FRESH // LATENIGHT', 384, 472);

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * 6) High Score LED Matrix Board (512x192) — only redrawn when score updates!
 */
export function redrawHighScoreBoardTexture(
  tex: THREE.CanvasTexture | null,
  highScore: number,
  labelName: string = GAMING_ROOM_CONFIG.highScoreBoard.labelName
): void {
  if (!tex) return;
  const entry = HIGH_SCORE_CTX_MAP.get(tex);
  if (!entry) return;
  const { canvas, ctx } = entry;
  const W = canvas.width;
  const H = canvas.height;

  ctx.fillStyle = '#070a12';
  ctx.fillRect(0, 0, W, H);

  // Outer LED bezel hairline
  ctx.strokeStyle = '#22d3ee';
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, W - 16, H - 16);

  // Subtle LED matrix grid
  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  for (let gx = 12; gx < W - 12; gx += 8) {
    ctx.fillRect(gx, 12, 1, H - 24);
  }
  for (let gy = 12; gy < H - 12; gy += 8) {
    ctx.fillRect(12, gy, W - 24, 1);
  }

  // Amber "HIGH SCORE" title
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 34px monospace';
  ctx.fillText('HIGH SCORE', W / 2, 56);

  // Score row ("RAI ...... 00140")
  const padded = String(Math.max(0, Math.floor(highScore))).padStart(5, '0');
  ctx.fillStyle = '#4ade80';
  ctx.font = 'bold 42px monospace';
  ctx.fillText(`${labelName} ...... ${padded}`, W / 2, 122);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 16px monospace';
  ctx.fillText('ARCADE SNAKE // RECORD', W / 2, 162);

  tex.needsUpdate = true;
}

export function createHighScoreBoardTexture(
  initialHighScore: number,
  labelName: string = GAMING_ROOM_CONFIG.highScoreBoard.labelName
): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  HIGH_SCORE_CTX_MAP.set(tex, { canvas, ctx });
  redrawHighScoreBoardTexture(tex, initialHighScore, labelName);
  return tex;
}
