import * as THREE from 'three';
import {
  ARCADE_CONFIG,
  CENTER_RUG_CONFIG,
  SNAKE_CONFIG,
} from '@/config/themeConfig';
import type { SnakeState } from '@/games/snake';

function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Generates a bright, sunny daytime sky + sunlit city skyline matching the night city layout (1024 x 680).
 */
export function createDaySkyWindowTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const w = 1024;
  const h = 680;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Airy daytime gradient sky
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#4f8ee8');
  sky.addColorStop(0.55, '#8bc3f9');
  sky.addColorStop(1, '#d7ecfc');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Soft warm sunlit corner glow
  const sunGlow = ctx.createRadialGradient(w * 0.22, h * 0.2, 16, w * 0.22, h * 0.2, 230);
  sunGlow.addColorStop(0, 'rgba(255, 252, 232, 0.92)');
  sunGlow.addColorStop(0.35, 'rgba(255, 244, 204, 0.35)');
  sunGlow.addColorStop(1, 'rgba(255, 244, 204, 0)');
  ctx.fillStyle = sunGlow;
  ctx.fillRect(0, 0, w, h);

  // Layered fluffy daytime clouds
  const clouds = [
    { cx: 180, cy: 135, s: 1.0 },
    { cx: 480, cy: 105, s: 0.85 },
    { cx: 760, cy: 155, s: 1.15 },
    { cx: 615, cy: 230, s: 0.72 },
    { cx: 315, cy: 215, s: 0.78 },
  ];
  for (const c of clouds) {
    ctx.save();
    ctx.translate(c.cx, c.cy);
    ctx.scale(c.s, c.s);
    const puffs = [
      [0, 0, 44],
      [-42, 12, 34],
      [44, 14, 36],
      [-74, 22, 24],
      [76, 22, 25],
    ];
    ctx.fillStyle = 'rgba(220, 235, 250, 0.65)';
    for (const [px, py, pr] of puffs) {
      ctx.beginPath();
      ctx.arc(px, py + 7, pr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    for (const [px, py, pr] of puffs) {
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Distant atmospheric skyline silhouette matching night window proportions
  const farBuildings = [
    [0, 110, 220],
    [100, 95, 265],
    [188, 120, 200],
    [300, 90, 295],
    [382, 130, 235],
    [504, 105, 280],
    [600, 115, 210],
    [708, 95, 285],
    [794, 125, 225],
    [910, 114, 250],
  ];
  ctx.fillStyle = '#9dbbd9';
  for (const [bx, bw, bh] of farBuildings) {
    ctx.fillRect(bx, h - bh, bw, bh);
  }

  // Foreground sunlit city skyline
  const nearBuildings = [
    { x: 16, w: 120, h: 255 },
    { x: 146, w: 96, h: 315 },
    { x: 254, w: 138, h: 235 },
    { x: 404, w: 112, h: 345 },
    { x: 528, w: 142, h: 270 },
    { x: 682, w: 108, h: 305 },
    { x: 804, w: 128, h: 240 },
    { x: 940, w: 84, h: 280 },
  ];
  nearBuildings.forEach((b, bi) => {
    const by = h - b.h;
    ctx.fillStyle = bi % 2 === 0 ? '#6e8ba8' : '#7b99b5';
    ctx.fillRect(b.x, by, b.w, b.h);
    // Sunlit edge
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fillRect(b.x, by, 8, b.h);

    const cols = Math.floor((b.w - 20) / 16);
    const rows = Math.floor((b.h - 30) / 20);
    ctx.fillStyle = 'rgba(224, 242, 254, 0.42)';
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillRect(b.x + 12 + c * 16, by + 16 + r * 20, 6, 9);
      }
    }
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates an original 1024 x 704 geometric center rug texture:
 * navy base (#1c2340), warm sand border (#c9a574), muted red & sand central diamond medallion,
 * repeating field motifs, fabric weave grain, and textured fringes on the two short ends.
 */
export function createCenterRugTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const w = CENTER_RUG_CONFIG.textureWidth; // 1024 (maps along long Z 3.4m axis)
  const h = CENTER_RUG_CONFIG.textureHeight; // 704 (maps along short X 2.3m axis)
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const { baseNavy, sand, sandLight, mutedRed, fringe } = CENTER_RUG_CONFIG.colors;
  const fringeStrip = 34;

  // Transparent/oak-blended fringe base strips on left & right short ends (X=0..34, X=w-34..w)
  ctx.fillStyle = '#5c4632';
  ctx.fillRect(0, 0, w, h);

  // Rug main body inside fringe strips
  const bodyX = fringeStrip;
  const bodyW = w - fringeStrip * 2;
  ctx.fillStyle = baseNavy;
  ctx.fillRect(bodyX, 0, bodyW, h);

  // Subtle repeating diamond & dot field motif
  ctx.strokeStyle = 'rgba(201, 165, 116, 0.14)';
  ctx.lineWidth = 2;
  const stepX = 56;
  const stepY = 56;
  for (let y = 52; y < h - 40; y += stepY) {
    for (let x = bodyX + 54; x < bodyX + bodyW - 40; x += stepX) {
      ctx.beginPath();
      ctx.moveTo(x, y - 10);
      ctx.lineTo(x + 10, y);
      ctx.lineTo(x, y + 10);
      ctx.lineTo(x - 10, y);
      ctx.closePath();
      ctx.stroke();

      ctx.fillStyle = 'rgba(155, 61, 61, 0.25)';
      ctx.fillRect(x - 2, y - 2, 4, 4);
    }
  }

  // Outer warm sand border + thin inner framing line
  ctx.strokeStyle = sand;
  ctx.lineWidth = 26;
  ctx.strokeRect(bodyX + 26, 26, bodyW - 52, h - 52);

  ctx.strokeStyle = mutedRed;
  ctx.lineWidth = 6;
  ctx.strokeRect(bodyX + 52, 52, bodyW - 104, h - 104);

  ctx.strokeStyle = sandLight;
  ctx.lineWidth = 2;
  ctx.strokeRect(bodyX + 68, 68, bodyW - 136, h - 136);

  // Corner geometric key accents
  const corners = [
    [bodyX + 86, 86],
    [bodyX + bodyW - 86, 86],
    [bodyX + 86, h - 86],
    [bodyX + bodyW - 86, h - 86],
  ];
  for (const [cx, cy] of corners) {
    ctx.fillStyle = sand;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 16);
    ctx.lineTo(cx + 16, cy);
    ctx.lineTo(cx, cy + 16);
    ctx.lineTo(cx - 16, cy);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = mutedRed;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 8);
    ctx.lineTo(cx + 8, cy);
    ctx.lineTo(cx, cy + 8);
    ctx.lineTo(cx - 8, cy);
    ctx.closePath();
    ctx.fill();
  }

  // Central nested diamond medallion in muted red (#9b3d3d) and sand (#c9a574)
  const midX = w / 2;
  const midY = h / 2;
  const drawDiamond = (rx: number, ry: number, fill: string, stroke?: string, lw = 3) => {
    ctx.beginPath();
    ctx.moveTo(midX, midY - ry);
    ctx.lineTo(midX + rx, midY);
    ctx.lineTo(midX, midY + ry);
    ctx.lineTo(midX - rx, midY);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw;
      ctx.stroke();
    }
  };

  drawDiamond(210, 148, baseNavy, sand, 8);
  drawDiamond(182, 128, mutedRed, sandLight, 3);
  drawDiamond(126, 88, sand, baseNavy, 4);
  drawDiamond(74, 52, baseNavy, sand, 3);
  drawDiamond(34, 24, mutedRed);

  // Fringe tassels on the two short ends
  for (let y = 6; y < h - 6; y += 10) {
    const jitter = (hash(y * 1.7) - 0.5) * 4;
    ctx.fillStyle = fringe;
    ctx.fillRect(4 + jitter, y, fringeStrip - 5, 5);
    ctx.fillRect(w - fringeStrip + 1, y, fringeStrip - 5 + jitter, 5);

    ctx.fillStyle = 'rgba(28, 35, 64, 0.35)';
    ctx.fillRect(bodyX - 4, y + 1, 4, 4);
    ctx.fillRect(bodyX + bodyW, y + 1, 4, 4);
  }

  // Subtle fabric weave noise across entire rug body
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const idx = (py * w + px) * 4;
      const weave = ((px + py) % 3 === 0 ? 5 : -4) + (hash(px * 0.13 + py * 0.91) * 14 - 7);
      d[idx] = Math.max(0, Math.min(255, d[idx] + weave));
      d[idx + 1] = Math.max(0, Math.min(255, d[idx + 1] + weave));
      d[idx + 2] = Math.max(0, Math.min(255, d[idx + 2] + weave));
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates crisp lit retro pixel-style "ARCADE" marquee banner (512 x 128).
 */
export function createArcadeMarqueeTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const w = 512;
  const h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const { marqueeBg, marqueeAccent, marqueeHot } = ARCADE_CONFIG.arcadeColors;

  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#090c1a');
  bg.addColorStop(0.5, marqueeBg);
  bg.addColorStop(1, '#180c24');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Subtle horizontal CRT scanlines
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  for (let y = 0; y < h; y += 4) {
    ctx.fillRect(0, y, w, 1);
  }

  // Pixel border
  ctx.strokeStyle = marqueeAccent;
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, w - 20, h - 20);
  ctx.strokeStyle = marqueeHot;
  ctx.lineWidth = 2;
  ctx.strokeRect(18, 18, w - 36, h - 36);

  // Bold pixel-block letters "ARCADE"
  const glyphs: Record<string, string[]> = {
    A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
    R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
    C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
    D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
    E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  };
  const word = 'ARCADE';
  const pxSize = 8;
  const charW = 5 * pxSize;
  const gap = 14;
  const totalW = word.length * charW + (word.length - 1) * gap;
  const startX = Math.round((w - totalW) / 2);
  const startY = Math.round((h - 7 * pxSize) / 2);

  for (let ci = 0; ci < word.length; ci++) {
    const ch = word[ci];
    const rows = glyphs[ch];
    if (!rows) continue;
    const gx = startX + ci * (charW + gap);
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < rows[r].length; c++) {
        if (rows[r][c] === '1') {
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(gx + c * pxSize + 3, startY + r * pxSize + 3, pxSize, pxSize);
          ctx.fillStyle = r < 2 ? '#ffffff' : r < 5 ? marqueeAccent : marqueeHot;
          ctx.fillRect(gx + c * pxSize, startY + r * pxSize, pxSize - 1, pxSize - 1);
        }
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates soft circular puff alpha texture for the rising coffee steam quads (64 x 64).
 */
export function createSteamTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const grad = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size * 0.46);
  grad.addColorStop(0, 'rgba(245, 245, 245, 0.95)');
  grad.addColorStop(0.45, 'rgba(235, 240, 248, 0.45)');
  grad.addColorStop(1, 'rgba(235, 240, 248, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Renders the Snake attract (idle) frame into the 256 x 224 arcade canvas.
 */
export function drawSnakeAttractScreen(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  blinkOn: boolean,
  highScore: number
): void {
  const { bg, gridLine, titleNeon, accentCyan, text, muted, snakeBody, snakeHead, food } =
    SNAKE_CONFIG.colors;

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Subtle background pixel grid
  ctx.strokeStyle = gridLine;
  ctx.lineWidth = 1;
  for (let x = 8; x < w; x += 12) {
    ctx.beginPath();
    ctx.moveTo(x, 8);
    ctx.lineTo(x, h - 8);
    ctx.stroke();
  }
  for (let y = 8; y < h; y += 12) {
    ctx.beginPath();
    ctx.moveTo(8, y);
    ctx.lineTo(w - 8, y);
    ctx.stroke();
  }

  // Outer pixel cabinet bezel line
  ctx.strokeStyle = accentCyan;
  ctx.lineWidth = 2;
  ctx.strokeRect(7, 7, w - 14, h - 14);

  // Decorative mini pixel snake + food emblem
  const segs = [
    [68, 128],
    [80, 128],
    [92, 128],
    [104, 128],
    [116, 128],
    [128, 128],
    [140, 128],
    [140, 116],
    [152, 116],
  ];
  segs.forEach(([sx, sy], i) => {
    ctx.fillStyle = i === segs.length - 1 ? snakeHead : snakeBody;
    ctx.fillRect(sx, sy, 10, 10);
  });
  ctx.fillStyle = food;
  ctx.fillRect(178, 116, 10, 10);

  // Retro title "SNAKE"
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#052e16';
  ctx.font = 'bold 34px monospace';
  ctx.fillText('SNAKE', w / 2 + 2, 64 + 2);
  ctx.fillStyle = titleNeon;
  ctx.fillText('SNAKE', w / 2, 64);

  ctx.fillStyle = muted;
  ctx.font = 'bold 11px monospace';
  ctx.fillText(`HI-SCORE  ${String(highScore).padStart(4, '0')}`, w / 2, 162);

  if (blinkOn) {
    ctx.fillStyle = text;
    ctx.font = 'bold 13px monospace';
    ctx.fillText('PRESS E TO PLAY', w / 2, 192);
  }
}

/**
 * Renders the active 20 x 18 Snake grid + top score HUD + Game Over overlay onto 256 x 224.
 */
export function drawSnakeGameScreen(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  state: SnakeState,
  foodBlinkOn: boolean
): void {
  const { bg, gridLine, topBarBg, snakeHead, snakeBody, food, foodAlt, text, accentCyan, gameOver } =
    SNAKE_CONFIG.colors;

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const hudH = 26;
  ctx.fillStyle = topBarBg;
  ctx.fillRect(0, 0, w, hudH);
  ctx.fillStyle = accentCyan;
  ctx.fillRect(0, hudH - 2, w, 2);

  ctx.font = 'bold 12px monospace';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = text;
  ctx.fillText(`SCORE ${String(state.score).padStart(4, '0')}`, 10, 13);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(`HI ${String(state.highScore).padStart(4, '0')}`, w - 10, 13);

  // Playfield fits cleanly beneath HUD: 20 cols x 18 rows -> 10px x 10px cells (200x180) centered
  const cell = 10;
  const boardW = state.cols * cell;
  const boardH = state.rows * cell;
  const offX = Math.floor((w - boardW) / 2);
  const offY = hudH + Math.floor((h - hudH - boardH) / 2);

  // Playfield border & faint grid lines
  ctx.strokeStyle = gridLine;
  ctx.lineWidth = 1;
  for (let c = 0; c <= state.cols; c++) {
    const gx = offX + c * cell + 0.5;
    ctx.beginPath();
    ctx.moveTo(gx, offY);
    ctx.lineTo(gx, offY + boardH);
    ctx.stroke();
  }
  for (let r = 0; r <= state.rows; r++) {
    const gy = offY + r * cell + 0.5;
    ctx.beginPath();
    ctx.moveTo(offX, gy);
    ctx.lineTo(offX + boardW, gy);
    ctx.stroke();
  }
  ctx.strokeStyle = '#24344d';
  ctx.lineWidth = 2;
  ctx.strokeRect(offX - 1, offY - 1, boardW + 2, boardH + 2);

  // Red blinking food
  if (state.food.x >= 0 && state.food.y >= 0) {
    ctx.fillStyle = foodBlinkOn ? food : foodAlt;
    ctx.fillRect(offX + state.food.x * cell + 1, offY + state.food.y * cell + 1, cell - 2, cell - 2);
  }

  // Snake segments (head lighter neon green)
  for (let i = state.snake.length - 1; i >= 0; i--) {
    const seg = state.snake[i];
    ctx.fillStyle = i === 0 ? snakeHead : snakeBody;
    ctx.fillRect(offX + seg.x * cell + 1, offY + seg.y * cell + 1, cell - 2, cell - 2);
  }

  // Idle inside play focus prompt or Game Over overlay
  if (state.status === 'idle') {
    ctx.fillStyle = 'rgba(6, 9, 15, 0.78)';
    ctx.fillRect(offX + 12, offY + 56, boardW - 24, 68);
    ctx.strokeStyle = accentCyan;
    ctx.strokeRect(offX + 12, offY + 56, boardW - 24, 68);
    ctx.textAlign = 'center';
    ctx.fillStyle = text;
    ctx.font = 'bold 13px monospace';
    ctx.fillText('PRESS SPACE TO START', w / 2, offY + 90);
  } else if (state.status === 'gameover') {
    ctx.fillStyle = 'rgba(6, 9, 15, 0.86)';
    ctx.fillRect(offX + 10, offY + 42, boardW - 20, 96);
    ctx.strokeStyle = gameOver;
    ctx.lineWidth = 2;
    ctx.strokeRect(offX + 10, offY + 42, boardW - 20, 96);

    ctx.textAlign = 'center';
    ctx.fillStyle = gameOver;
    ctx.font = 'bold 18px monospace';
    ctx.fillText('GAME OVER', w / 2, offY + 68);

    ctx.fillStyle = text;
    ctx.font = 'bold 12px monospace';
    ctx.fillText(`SCORE: ${state.score}`, w / 2, offY + 94);

    ctx.fillStyle = accentCyan;
    ctx.font = 'bold 11px monospace';
    ctx.fillText('SPACE TO RETRY', w / 2, offY + 118);
  }
}
