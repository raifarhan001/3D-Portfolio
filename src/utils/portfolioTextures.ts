import * as THREE from 'three';
import {
  getCertificateByIndex,
  type AchievementEntry,
  type CertificateEntry,
  type ShelfBookConfig,
  type StackedBookConfig,
} from '@/config/roomContent';
import { IDENTITY_CONFIG } from '@/config/identityConfig';

export interface AtlasUVRect {
  u0: number;
  u1: number;
  v0: number;
  v1: number;
}

export function getAtlasCellUVs(
  index: number,
  cols: number,
  rows: number,
  texWidth: number,
  texHeight: number,
  insetPx = 4
): AtlasUVRect {
  const col = index % cols;
  const row = Math.floor(index / cols);
  const padU = insetPx / texWidth;
  const padV = insetPx / texHeight;
  const u0 = col / cols + padU;
  const u1 = (col + 1) / cols - padU;
  // Canvas y=0 is top -> Three.js v=1 is top (flipY=true)
  const v1 = 1 - row / rows - padV;
  const v0 = 1 - (row + 1) / rows + padV;
  return { u0, u1, v0, v1 };
}

export function applyAtlasUVsToPlane(
  geometry: THREE.BufferGeometry,
  uv: AtlasUVRect
): THREE.BufferGeometry {
  const uvAttr = geometry.getAttribute('uv');
  if (!uvAttr) return geometry;
  for (let i = 0; i < uvAttr.count; i++) {
    const u = uvAttr.getX(i);
    const v = uvAttr.getY(i);
    uvAttr.setXY(i, uv.u0 + u * (uv.u1 - uv.u0), uv.v0 + v * (uv.v1 - uv.v0));
  }
  uvAttr.needsUpdate = true;
  return geometry;
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = 3
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = w;
      if (lines.length >= maxLines) break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines;
}

function drawFallbackCertificateCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  cert: CertificateEntry
): void {
  ctx.save();
  ctx.translate(x, y);

  ctx.fillStyle = '#faf7ef';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = Math.max(2, w * 0.01);
  ctx.strokeRect(w * 0.04, h * 0.05, w * 0.92, h * 0.9);

  ctx.fillStyle = '#475569';
  ctx.font = `700 ${Math.round(h * 0.045)}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(cert.issuer.toUpperCase(), w * 0.5, h * 0.24);

  ctx.fillStyle = '#0f172a';
  ctx.font = `700 ${Math.round(h * 0.072)}px Georgia, serif`;
  const lines = wrapLines(ctx, cert.title, w * 0.78, 3);
  const startY = h * 0.5 - ((lines.length - 1) * h * 0.095) / 2;
  lines.forEach((ln, idx) => {
    ctx.fillText(ln, w * 0.5, startY + idx * h * 0.1);
  });

  if (cert.date) {
    ctx.fillStyle = '#64748b';
    ctx.font = `600 ${Math.round(h * 0.04)}px system-ui, -apple-system, sans-serif`;
    ctx.fillText(cert.date, w * 0.5, h * 0.78);
  }

  ctx.restore();
}

export function drawAchievementHex(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  ach: AchievementEntry
): void {
  ctx.save();
  ctx.translate(x, y);

  ctx.fillStyle = '#0d1117';
  ctx.fillRect(0, 0, w, h);

  const cx = w * 0.5;
  const cy = h * 0.44;
  const r = Math.min(w, h) * 0.36;

  // Hex outer glow & fill
  const drawHex = (rad: number) => {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      const hx = cx + Math.cos(a) * rad;
      const hy = cy + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(hx, hy);
      else ctx.lineTo(hx, hy);
    }
    ctx.closePath();
  };

  const grad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  grad.addColorStop(0, ach.accentColor);
  grad.addColorStop(1, ach.secondaryColor);

  drawHex(r);
  ctx.fillStyle = '#161b22';
  ctx.fill();
  ctx.lineWidth = Math.max(4, w * 0.022);
  ctx.strokeStyle = grad;
  ctx.stroke();

  drawHex(r * 0.82);
  ctx.lineWidth = Math.max(1.5, w * 0.006);
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.stroke();

  // Original icon inside hex
  ctx.strokeStyle = ach.secondaryColor;
  ctx.fillStyle = ach.accentColor;
  ctx.lineWidth = Math.max(3, w * 0.015);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (ach.iconKind === 'shark') {
    // Stylized fin + PR merge branch
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.34, cy + r * 0.24);
    ctx.quadraticCurveTo(cx - r * 0.05, cy - r * 0.42, cx + r * 0.16, cy - r * 0.34);
    ctx.quadraticCurveTo(cx + r * 0.06, cy - r * 0.02, cx + r * 0.36, cy + r * 0.24);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    // Pair Extraordinaire: two overlapping glowing nodes + spark
    ctx.beginPath();
    ctx.arc(cx - r * 0.18, cy, r * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + r * 0.18, cy, r * 0.18, 0, Math.PI * 2);
    ctx.strokeStyle = ach.secondaryColor;
    ctx.stroke();
  }

  ctx.fillStyle = '#f8fafc';
  ctx.font = `700 ${Math.round(w * 0.068)}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ach.title, w * 0.5, h * 0.83);

  ctx.fillStyle = '#94a3b8';
  ctx.font = `600 ${Math.round(w * 0.036)}px system-ui, -apple-system, sans-serif`;
  ctx.fillText('GITHUB ACHIEVEMENT', w * 0.5, h * 0.92);

  ctx.restore();
}

export interface CertAtlasSlotSpec {
  x: number;
  y: number;
  w: number;
  h: number;
}

const CERT_ATLAS_WIDTH = 2048;
const CERT_ATLAS_HEIGHT = 1024;

// Zero unused placeholder cells: 3 landscape certs on top row (682x512 each) +
// 2 square GitHub achievement badges on bottom row (512x512 each).
const CERT_ATLAS_SLOTS: ReadonlyArray<CertAtlasSlotSpec> = [
  { x: 0, y: 0, w: 682, h: 512 },
  { x: 682, y: 0, w: 682, h: 512 },
  { x: 1364, y: 0, w: 684, h: 512 },
];

const ACHIEVEMENT_ATLAS_SLOTS: ReadonlyArray<CertAtlasSlotSpec> = [
  { x: 0, y: 512, w: 512, h: 512 },
  { x: 512, y: 512, w: 512, h: 512 },
];

function slotToUVRect(slot: CertAtlasSlotSpec, insetPx = 4): AtlasUVRect {
  const u0 = (slot.x + insetPx) / CERT_ATLAS_WIDTH;
  const u1 = (slot.x + slot.w - insetPx) / CERT_ATLAS_WIDTH;
  // Canvas y=0 is top -> Three.js v=1 is top (flipY=true)
  const v1 = 1 - (slot.y + insetPx) / CERT_ATLAS_HEIGHT;
  const v0 = 1 - (slot.y + slot.h - insetPx) / CERT_ATLAS_HEIGHT;
  return { u0, u1, v0, v1 };
}

export function getCertificateAtlasUVs(certIndex: number): AtlasUVRect {
  const slot = CERT_ATLAS_SLOTS[certIndex] ?? CERT_ATLAS_SLOTS[0];
  return slotToUVRect(slot, 4);
}

export function getAchievementAtlasUVs(achIndex: number): AtlasUVRect {
  const slot = ACHIEVEMENT_ATLAS_SLOTS[achIndex] ?? ACHIEVEMENT_ATLAS_SLOTS[0];
  return slotToUVRect(slot, 4);
}

export function createCertificatesAtlas(
  totalCerts: number,
  achievements: ReadonlyArray<AchievementEntry>,
  cardWidth = 0.214,
  cardHeight = 0.158
): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = CERT_ATLAS_WIDTH;
  canvas.height = CERT_ATLAS_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#0d1117';
  ctx.fillRect(0, 0, CERT_ATLAS_WIDTH, CERT_ATLAS_HEIGHT);

  const count = Math.min(totalCerts, CERT_ATLAS_SLOTS.length);
  for (let i = 0; i < count; i++) {
    const slot = CERT_ATLAS_SLOTS[i];
    const cert = getCertificateByIndex(i);
    drawFallbackCertificateCell(ctx, slot.x, slot.y, slot.w, slot.h, cert);
  }

  achievements.slice(0, ACHIEVEMENT_ATLAS_SLOTS.length).forEach((ach, idx) => {
    const slot = ACHIEVEMENT_ATLAS_SLOTS[idx];
    drawAchievementHex(ctx, slot.x, slot.y, slot.w, slot.h, ach);
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;

  const cardAspect = cardWidth / Math.max(0.001, cardHeight);

  // Asynchronously paint crisp cropped high-res certificate thumbnails into their atlas cells
  for (let i = 0; i < count; i++) {
    const cert = getCertificateByIndex(i);
    const slot = CERT_ATLAS_SLOTS[i];
    if (!cert.imageUrl || !slot) continue;
    const img = new Image();
    img.onload = () => {
      if (tex.userData.__disposed) return;
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.fillStyle = '#faf8f3';
      ctx.fillRect(slot.x, slot.y, slot.w, slot.h);

      const inset = 4;
      const uvW = slot.w - inset * 2;
      const uvH = slot.h - inset * 2;
      const cellPixelAspect = uvW / Math.max(1, uvH);
      const pad = 12;
      const availW = uvW - pad * 2;
      const availH = uvH - pad * 2;

      const imgAspect = img.naturalWidth / Math.max(1, img.naturalHeight);
      // Match canvas draw ratio to physical card aspect so landscape certs remain undistorted
      const drawRatio = imgAspect * (cellPixelAspect / cardAspect);
      let dw = availW;
      let dh = dw / drawRatio;
      if (dh > availH) {
        dh = availH;
        dw = dh * drawRatio;
      }
      const dx = slot.x + inset + (uvW - dw) / 2;
      const dy = slot.y + inset + (uvH - dh) / 2;
      ctx.drawImage(img, dx, dy, dw, dh);
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.16)';
      ctx.lineWidth = 2;
      ctx.strokeRect(dx, dy, dw, dh);
      ctx.restore();
      tex.needsUpdate = true;
    };
    img.src = encodeURI(cert.imageUrl);
  }

  return tex;
}

export function createPhoneLockScreenTextures(): {
  mapTex: THREE.CanvasTexture | null;
  emissiveMapTex: THREE.CanvasTexture | null;
} {
  if (typeof document === 'undefined') return { mapTex: null, emissiveMapTex: null };
  const w = 512;
  const h = 1024;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = w;
  glowCanvas.height = h;
  const gctx = glowCanvas.getContext('2d');

  if (!ctx || !gctx) return { mapTex: null, emissiveMapTex: null };

  // Rich original mesh-gradient dark wallpaper
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#091124');
  bg.addColorStop(0.45, '#112248');
  bg.addColorStop(0.8, '#0b1834');
  bg.addColorStop(1, '#060a14');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const orb1 = ctx.createRadialGradient(w * 0.25, h * 0.28, 20, w * 0.25, h * 0.28, 280);
  orb1.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
  orb1.addColorStop(1, 'rgba(56, 189, 248, 0)');
  ctx.fillStyle = orb1;
  ctx.fillRect(0, 0, w, h);

  const orb2 = ctx.createRadialGradient(w * 0.78, h * 0.65, 20, w * 0.78, h * 0.65, 320);
  orb2.addColorStop(0, 'rgba(99, 102, 241, 0.35)');
  orb2.addColorStop(1, 'rgba(99, 102, 241, 0)');
  ctx.fillStyle = orb2;
  ctx.fillRect(0, 0, w, h);

  // Top lock icon
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(w / 2, 118, 13, Math.PI, 0);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.roundRect(w / 2 - 17, 118, 34, 26, 6);
  ctx.fill();

  // Time & Date
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(226, 232, 240, 0.88)';
  ctx.font = '500 28px system-ui, -apple-system, sans-serif';
  ctx.fillText('Wednesday, Nov 11', w / 2, 198);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 120px system-ui, -apple-system, sans-serif';
  ctx.fillText('11:18', w / 2, 316);

  // Notification Card
  const cardX = 34;
  const cardY = 448;
  const cardW = w - 68;
  const cardH = 152;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 28);
  ctx.fill();
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Avatar badge
  ctx.fillStyle = '#0ea5e9';
  ctx.beginPath();
  ctx.arc(cardX + 46, cardY + 52, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 22px system-ui, -apple-system, sans-serif';
  ctx.fillText(IDENTITY_CONFIG.displayName.charAt(0).toUpperCase(), cardX + 46, cardY + 60);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 20px system-ui, -apple-system, sans-serif';
  ctx.fillText(`${IDENTITY_CONFIG.displayName.toUpperCase()}  •  now`, cardX + 86, cardY + 50);

  ctx.fillStyle = '#f8fafc';
  ctx.font = '600 24px system-ui, -apple-system, sans-serif';
  ctx.fillText(`${IDENTITY_CONFIG.firstName}: Let's build something`, cardX + 86, cardY + 94);
  ctx.fillText('together.', cardX + 86, cardY + 124);

  // Bottom bar hint
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(226, 232, 240, 0.6)';
  ctx.font = '500 20px system-ui, -apple-system, sans-serif';
  ctx.fillText('Press E to use phone', w / 2, h - 78);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
  ctx.beginPath();
  ctx.roundRect(w / 2 - 80, h - 38, 160, 8, 4);
  ctx.fill();

  // Emissive map: black everywhere except notification card area for pulse animation
  gctx.fillStyle = '#000000';
  gctx.fillRect(0, 0, w, h);
  const cardGlow = gctx.createRadialGradient(
    w / 2,
    cardY + cardH / 2,
    40,
    w / 2,
    cardY + cardH / 2,
    240
  );
  cardGlow.addColorStop(0, 'rgba(120, 210, 255, 0.95)');
  cardGlow.addColorStop(0.65, 'rgba(56, 189, 248, 0.45)');
  cardGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  gctx.fillStyle = cardGlow;
  gctx.beginPath();
  gctx.roundRect(cardX - 10, cardY - 10, cardW + 20, cardH + 20, 34);
  gctx.fill();

  const mapTex = new THREE.CanvasTexture(canvas);
  mapTex.colorSpace = THREE.SRGBColorSpace;
  mapTex.anisotropy = 4;

  const emissiveMapTex = new THREE.CanvasTexture(glowCanvas);
  emissiveMapTex.colorSpace = THREE.SRGBColorSpace;
  emissiveMapTex.anisotropy = 4;

  return { mapTex, emissiveMapTex };
}

export function createGalleryAtlas(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const w = 2048;
  const h = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const cellW = w / 3;
  const cellH = h / 2;

  const drawMattedCell = (
    idx: number,
    drawInner: (ix: number, iy: number, iw: number, ih: number) => void
  ) => {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const cx = col * cellW;
    const cy = row * cellH;
    // Crisp white mat
    ctx.fillStyle = '#f4f3ef';
    ctx.fillRect(cx, cy, cellW, cellH);

    const padX = cellW * 0.1;
    const padY = cellH * 0.1;
    const ix = cx + padX;
    const iy = cy + padY;
    const iw = cellW - padX * 2;
    const ih = cellH - padY * 2;

    ctx.save();
    ctx.beginPath();
    ctx.rect(ix, iy, iw, ih);
    ctx.clip();
    drawInner(ix, iy, iw, ih);
    ctx.restore();

    ctx.strokeStyle = 'rgba(15, 23, 42, 0.15)';
    ctx.lineWidth = 3;
    ctx.strokeRect(ix, iy, iw, ih);
  };

  // 0: Neural network node graph
  drawMattedCell(0, (ix, iy, iw, ih) => {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(ix, iy, iw, ih);
    const layers = [
      [0.24, 0.45, 0.66, 0.82],
      [0.18, 0.38, 0.58, 0.78],
      [0.28, 0.5, 0.72],
      [0.38, 0.62],
    ];
    const xs = [0.16, 0.4, 0.64, 0.84];
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.38)';
    ctx.lineWidth = 2.5;
    for (let l = 0; l < layers.length - 1; l++) {
      for (const y1 of layers[l]) {
        for (const y2 of layers[l + 1]) {
          ctx.beginPath();
          ctx.moveTo(ix + iw * xs[l], iy + ih * y1);
          ctx.lineTo(ix + iw * xs[l + 1], iy + ih * y2);
          ctx.stroke();
        }
      }
    }
    layers.forEach((ys, l) => {
      ys.forEach((yf, j) => {
        ctx.fillStyle = (l + j) % 2 === 0 ? '#38bdf8' : '#a78bfa';
        ctx.beginPath();
        ctx.arc(ix + iw * xs[l], iy + ih * yf, 12, 0, Math.PI * 2);
        ctx.fill();
      });
    });
  });

  // 1: Minimal mountain line art
  drawMattedCell(1, (ix, iy, iw, ih) => {
    ctx.fillStyle = '#f7f2e9';
    ctx.fillRect(ix, iy, iw, ih);
    ctx.fillStyle = '#e07a5f';
    ctx.beginPath();
    ctx.arc(ix + iw * 0.68, iy + ih * 0.34, ih * 0.14, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(ix + iw * 0.08, iy + ih * 0.76);
    ctx.lineTo(ix + iw * 0.34, iy + ih * 0.34);
    ctx.lineTo(ix + iw * 0.52, iy + ih * 0.58);
    ctx.lineTo(ix + iw * 0.7, iy + ih * 0.4);
    ctx.lineTo(ix + iw * 0.92, iy + ih * 0.76);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(30,41,59,0.35)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(ix + iw * 0.12, iy + ih * 0.84);
    ctx.lineTo(ix + iw * 0.88, iy + ih * 0.84);
    ctx.stroke();
  });

  // 2: "BUILD. ITERATE." poster
  drawMattedCell(2, (ix, iy, iw, ih) => {
    ctx.fillStyle = '#13151b';
    ctx.fillRect(ix, iy, iw, ih);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f8fafc';
    ctx.font = '800 76px system-ui, -apple-system, sans-serif';
    ctx.fillText('BUILD.', ix + iw * 0.12, iy + ih * 0.38);
    ctx.fillStyle = '#38bdf8';
    ctx.font = '800 66px system-ui, -apple-system, sans-serif';
    ctx.fillText('ITERATE.', ix + iw * 0.12, iy + ih * 0.56);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(ix + iw * 0.12, iy + ih * 0.68, iw * 0.28, 5);
    ctx.font = '600 20px monospace';
    ctx.fillText('SHIP // LEARN // REPEAT', ix + iw * 0.12, iy + ih * 0.77);
  });

  // 3: Pixel art controller
  drawMattedCell(3, (ix, iy, iw, ih) => {
    ctx.fillStyle = '#141926';
    ctx.fillRect(ix, iy, iw, ih);
    const px = Math.min(iw, ih) / 18;
    const ox = ix + (iw - px * 14) / 2;
    const oy = iy + (ih - px * 10) / 2;
    const grid = [
      '....XXXXXX....',
      '..XXXXXXXXXX..',
      '.XXXXXXXXXXXX.',
      '.XX.XXXXXX..X.',
      '.X...XXXX.X.X.',
      '.XX.XXXXXX..X.',
      '.XXXXXXXXXXXX.',
      '.XXXX....XXXX.',
      '.XXX......XXX.',
      '..X........X..',
    ];
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        if (grid[r][c] === 'X') {
          ctx.fillStyle = '#e2e8f0';
          ctx.fillRect(ox + c * px, oy + r * px, px - 2, px - 2);
        }
      }
    }
    // Colored buttons & dpad accent
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(ox + 3 * px, oy + 4 * px, px - 2, px - 2);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(ox + 11 * px, oy + 4 * px, px - 2, px - 2);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(ox + 10 * px, oy + 5 * px, px - 2, px - 2);
    ctx.fillStyle = '#eab308';
    ctx.fillRect(ox + 10 * px, oy + 3 * px, px - 2, px - 2);
  });

  // 4: Sunrise gradient
  drawMattedCell(4, (ix, iy, iw, ih) => {
    const sky = ctx.createLinearGradient(ix, iy, ix, iy + ih);
    sky.addColorStop(0, '#1e293b');
    sky.addColorStop(0.45, '#be4b60');
    sky.addColorStop(0.72, '#f59e0b');
    sky.addColorStop(1, '#fde68a');
    ctx.fillStyle = sky;
    ctx.fillRect(ix, iy, iw, ih);

    ctx.fillStyle = '#fef3c7';
    ctx.beginPath();
    ctx.arc(ix + iw * 0.5, iy + ih * 0.62, ih * 0.18, Math.PI, 0);
    ctx.fill();

    ctx.fillStyle = '#1e1b2e';
    ctx.fillRect(ix, iy + ih * 0.62, iw, ih * 0.38);
    ctx.fillStyle = 'rgba(253, 224, 71, 0.45)';
    for (let k = 0; k < 5; k++) {
      const rw = iw * (0.34 - k * 0.055);
      ctx.fillRect(ix + (iw - rw) / 2, iy + ih * (0.67 + k * 0.055), rw, 6);
    }
  });

  // 5: Geometric orbit
  drawMattedCell(5, (ix, iy, iw, ih) => {
    ctx.fillStyle = '#0f2027';
    ctx.fillRect(ix, iy, iw, ih);
    const cx = ix + iw * 0.5;
    const cy = iy + ih * 0.5;
    [0.14, 0.25, 0.36].forEach((r, idx) => {
      ctx.strokeStyle = idx === 1 ? '#f59e0b' : 'rgba(226, 232, 240, 0.45)';
      ctx.lineWidth = idx === 1 ? 4 : 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, ih * r, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(cx + ih * 0.25, cy - ih * 0.02, 11, 0, Math.PI * 2);
    ctx.fill();
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}


export function createNeonSignTexture(text: string, colorHex: string): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const w = 1024;
  const h = 320;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.clearRect(0, 0, w, h);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '800 156px system-ui, -apple-system, sans-serif';

  // Rich outer neon halo
  ctx.shadowColor = colorHex;
  ctx.shadowBlur = 32;
  ctx.strokeStyle = colorHex;
  ctx.lineWidth = 22;
  ctx.lineJoin = 'round';
  ctx.strokeText(text, w / 2, h / 2);

  // Mid neon tube stroke
  ctx.shadowBlur = 14;
  ctx.strokeStyle = colorHex;
  ctx.lineWidth = 10;
  ctx.strokeText(text, w / 2, h / 2);

  // Crisp bright core
  ctx.shadowBlur = 6;
  ctx.fillStyle = '#f8fafc';
  ctx.fillText(text, w / 2, h / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}


export function createNightCityWindowTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const w = 1024;
  const h = 680;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Deep night sky
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#040814');
  sky.addColorStop(0.55, '#0b1936');
  sky.addColorStop(1, '#162b54');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Deterministic stars drawn once
  const hash = (n: number) => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  for (let i = 0; i < 85; i++) {
    const sx = hash(i * 3.1) * w;
    const sy = hash(i * 7.7) * (h * 0.55);
    const sr = 0.8 + hash(i * 11.3) * 1.8;
    const alpha = 0.35 + hash(i * 17.9) * 0.65;
    ctx.fillStyle = `rgba(226, 232, 240, ${alpha.toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
  }

  // Crescent moon
  ctx.fillStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.arc(w * 0.8, h * 0.2, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#071128';
  ctx.beginPath();
  ctx.arc(w * 0.8 + 10, h * 0.2 - 6, 24, 0, Math.PI * 2);
  ctx.fill();

  // Distant skyline layer
  const farBuildings = [
    [0, 110, 260],
    [100, 95, 310],
    [188, 120, 240],
    [300, 90, 350],
    [382, 130, 280],
    [504, 105, 330],
    [600, 115, 250],
    [708, 95, 340],
    [794, 125, 270],
    [910, 114, 300],
  ];
  ctx.fillStyle = '#091326';
  for (const [bx, bw, bh] of farBuildings) {
    ctx.fillRect(bx, h - bh, bw, bh);
  }

  // Foreground dark skyline + lit window dots
  const nearBuildings = [
    { x: 16, w: 120, h: 320 },
    { x: 146, w: 96, h: 390 },
    { x: 254, w: 138, h: 290 },
    { x: 404, w: 112, h: 430 },
    { x: 528, w: 142, h: 340 },
    { x: 682, w: 108, h: 380 },
    { x: 804, w: 128, h: 295 },
    { x: 940, w: 84, h: 350 },
  ];
  nearBuildings.forEach((b, bi) => {
    const by = h - b.h;
    ctx.fillStyle = '#040812';
    ctx.fillRect(b.x, by, b.w, b.h);

    // Subtle tower spire on taller buildings
    if (b.h > 370) {
      ctx.fillRect(b.x + b.w / 2 - 2, by - 36, 4, 36);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(b.x + b.w / 2 - 2, by - 40, 4, 4);
    }

    // Lit window dots
    const cols = Math.floor((b.w - 20) / 16);
    const rows = Math.floor((b.h - 30) / 20);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const rnd = hash(bi * 1000 + r * 37 + c * 13);
        if (rnd > 0.56) {
          ctx.fillStyle = rnd > 0.88 ? '#7dd3fc' : rnd > 0.72 ? '#fde68a' : '#fbbf24';
          ctx.fillRect(b.x + 12 + c * 16, by + 16 + r * 20, 6, 9);
        }
      }
    }
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}


export function createCoolGlowStripTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const w = 256;
  const h = 64;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const vGrad = ctx.createLinearGradient(0, 0, 0, h);
  vGrad.addColorStop(0, 'rgba(147, 197, 253, 0.55)');
  vGrad.addColorStop(0.5, 'rgba(147, 197, 253, 0.2)');
  vGrad.addColorStop(1, 'rgba(147, 197, 253, 0)');
  ctx.fillStyle = vGrad;
  ctx.fillRect(0, 0, w, h);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createClockFaceTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.46;

  ctx.fillStyle = '#f8f7f3';
  ctx.fillRect(0, 0, size, size);

  // Subtle dial circle
  ctx.strokeStyle = '#d4d4d8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  // 60 minute ticks, 12 bold hour ticks
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
    const isHour = i % 5 === 0;
    const rOut = r * 0.94;
    const rIn = isHour ? r * 0.8 : r * 0.88;
    ctx.strokeStyle = isHour ? '#111827' : '#6b7280';
    ctx.lineWidth = isHour ? 6 : 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * rIn, cy + Math.sin(a) * rIn);
    ctx.lineTo(cx + Math.cos(a) * rOut, cy + Math.sin(a) * rOut);
    ctx.stroke();
  }

  ctx.fillStyle = '#4b5563';
  ctx.font = '700 22px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('RAI', cx, cy - r * 0.42);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}


export function createWalnutSlatsTexture(repeatX = 2.4): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const slatW = 58;
  const gapW = 6;
  const period = slatW + gapW;
  const numSlats = canvas.width / period;

  ctx.fillStyle = '#241913';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < numSlats; i++) {
    const x = i * period;
    const grad = ctx.createLinearGradient(x, 0, x + slatW, 0);
    grad.addColorStop(0.0, '#624735');
    grad.addColorStop(0.35, '#7a5942');
    grad.addColorStop(0.75, '#8a664c');
    grad.addColorStop(1.0, '#543c2c');

    ctx.fillStyle = grad;
    ctx.fillRect(x, 0, slatW, canvas.height);

    ctx.fillStyle = 'rgba(30, 18, 12, 0.14)';
    for (let gx = x + 4; gx < x + slatW - 4; gx += 7) {
      ctx.fillRect(gx, 0, 1.5, canvas.height);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function createWorldMapTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const w = 1024;
  const h = 640;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // White mat outer + deep slate poster interior
  ctx.fillStyle = '#f4f3ef';
  ctx.fillRect(0, 0, w, h);

  const px = 42;
  const py = 40;
  const mw = w - px * 2;
  const mh = h - py * 2;

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(px, py, mw, mh);

  // Subtle lat/lon grid
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
  ctx.lineWidth = 1.5;
  for (let gx = 1; gx < 12; gx++) {
    const x = px + (mw * gx) / 12;
    ctx.beginPath();
    ctx.moveTo(x, py);
    ctx.lineTo(x, py + mh);
    ctx.stroke();
  }
  for (let gy = 1; gy < 6; gy++) {
    const y = py + (mh * gy) / 6;
    ctx.beginPath();
    ctx.moveTo(px, y);
    ctx.lineTo(px + mw, y);
    ctx.stroke();
  }

  // Equirectangular projection helper: lon [-180..180], lat [-60..80]
  const proj = (lon: number, lat: number): [number, number] => [
    px + ((lon + 180) / 360) * mw,
    py + ((82 - lat) / 142) * mh,
  ];

  const drawPoly = (pts: ReadonlyArray<readonly [number, number]>) => {
    ctx.beginPath();
    pts.forEach(([lon, lat], i) => {
      const [x, y] = proj(lon, lat);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
  };

  ctx.fillStyle = '#334155';
  // North America
  drawPoly([
    [-168, 66], [-140, 70], [-95, 72], [-75, 62], [-56, 52], [-75, 36],
    [-82, 25], [-98, 22], [-96, 15], [-84, 9], [-105, 19], [-118, 32],
    [-126, 48], [-152, 60],
  ]);
  // Greenland
  drawPoly([
    [-55, 76], [-22, 78], [-20, 68], [-44, 60], [-56, 67],
  ]);
  // South America
  drawPoly([
    [-80, 10], [-62, 10], [-36, -6], [-40, -22], [-58, -38], [-68, -54],
    [-75, -45], [-72, -18], [-81, -4],
  ]);
  // Europe
  drawPoly([
    [-10, 36], [-9, 44], [2, 51], [10, 56], [24, 68], [44, 67],
    [52, 54], [38, 45], [24, 38], [12, 40], [2, 42],
  ]);
  // Africa
  drawPoly([
    [-17, 15], [-6, 35], [12, 36], [33, 31], [43, 12], [51, 11],
    [40, -10], [34, -26], [20, -35], [14, -22], [9, 4], [-8, 5],
  ]);
  // Asia
  drawPoly([
    [35, 38], [52, 54], [70, 70], [115, 73], [168, 66], [142, 52],
    [130, 36], [120, 24], [108, 12], [98, 16], [88, 22], [78, 8],
    [68, 24], [56, 26], [42, 16], [35, 28],
  ]);
  // Australia
  drawPoly([
    [114, -22], [132, -12], [148, -18], [153, -28], [146, -38], [130, -33], [115, -34],
  ]);

  // Highlighted pin on Pakistan (~69.3E, 30.4N)
  const [pkX, pkY] = proj(69.3, 30.4);
  const pulse = ctx.createRadialGradient(pkX, pkY, 2, pkX, pkY, 34);
  pulse.addColorStop(0, 'rgba(56, 189, 248, 0.75)');
  pulse.addColorStop(1, 'rgba(56, 189, 248, 0)');
  ctx.fillStyle = pulse;
  ctx.beginPath();
  ctx.arc(pkX, pkY, 34, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(pkX, pkY, 13, 0, Math.PI * 2);
  ctx.stroke();

  // Pin head
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(pkX, pkY - 12, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(pkX - 6, pkY - 9);
  ctx.lineTo(pkX + 6, pkY - 9);
  ctx.lineTo(pkX, pkY);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(pkX, pkY - 12, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '700 18px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('PAKISTAN', pkX + 18, pkY - 4);

  ctx.fillStyle = '#64748b';
  ctx.font = '600 16px monospace';
  ctx.fillText('30.3753° N, 69.3451° E', px + 24, py + mh - 24);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

export const BOOKS_ATLAS_WIDTH = 1024;
export const BOOKS_ATLAS_HEIGHT = 512;
const BOOK_SPINE_SLOT_W = 64;
const BOOK_SPINE_MAX_SLOTS = 15; // 15 * 64 = 960px; [960..1024) is pure white patch for vertex colors

export const BOOKS_ATLAS_WHITE_UV = {
  u: 992 / BOOKS_ATLAS_WIDTH,
  v: 0.5,
} as const;

export function getBookSpineAtlasUVs(slotIndex: number): AtlasUVRect {
  const safe = Math.max(0, Math.min(BOOK_SPINE_MAX_SLOTS - 1, slotIndex));
  const x0 = safe * BOOK_SPINE_SLOT_W;
  const x1 = x0 + BOOK_SPINE_SLOT_W;
  const insetU = 3 / BOOKS_ATLAS_WIDTH;
  const insetV = 4 / BOOKS_ATLAS_HEIGHT;
  return {
    u0: x0 / BOOKS_ATLAS_WIDTH + insetU,
    u1: x1 / BOOKS_ATLAS_WIDTH - insetU,
    v0: insetV,
    v1: 1 - insetV,
  };
}

function getContrastingSpinePalette(hexColor: string): {
  accentColor: string;
  textColor: string;
} {
  const c = new THREE.Color(hexColor);
  const luminance = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  if (luminance > 0.45) {
    return { accentColor: '#243040', textColor: '#181c24' };
  }
  if (luminance > 0.22) {
    return { accentColor: '#f3d89b', textColor: '#faf6ed' };
  }
  return { accentColor: '#e2b667', textColor: '#f8fafc' };
}

function drawBookSpineSlot(
  ctx: CanvasRenderingContext2D,
  slotIndex: number,
  book: ShelfBookConfig | StackedBookConfig
): void {
  const x = slotIndex * BOOK_SPINE_SLOT_W;
  const w = BOOK_SPINE_SLOT_W;
  const h = BOOKS_ATLAS_HEIGHT;
  const palette = getContrastingSpinePalette(book.color);
  const showLabel = 'showSpineLabel' in book ? book.showSpineLabel : book.title.length > 0;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, 0, w, h);
  ctx.clip();

  // Base cloth/leather spine fill
  ctx.fillStyle = book.color;
  ctx.fillRect(x, 0, w, h);

  // Subtle curved spine lighting + hinge creases
  const curveGrad = ctx.createLinearGradient(x, 0, x + w, 0);
  curveGrad.addColorStop(0, 'rgba(0, 0, 0, 0.28)');
  curveGrad.addColorStop(0.16, 'rgba(255, 255, 255, 0.08)');
  curveGrad.addColorStop(0.45, 'rgba(255, 255, 255, 0.14)');
  curveGrad.addColorStop(0.84, 'rgba(0, 0, 0, 0.06)');
  curveGrad.addColorStop(1, 'rgba(0, 0, 0, 0.30)');
  ctx.fillStyle = curveGrad;
  ctx.fillRect(x, 0, w, h);

  // Deterministic cloth grain (no flicker, zero Math.random)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.045)';
  for (let i = 0; i < 110; i++) {
    const hVal = ((slotIndex + 1) * 73856093) ^ (i * 19349663);
    const gx = x + 6 + (Math.abs(hVal) % (w - 12));
    const gy = 8 + (Math.abs(hVal >> 6) % (h - 16));
    ctx.fillRect(gx, gy, 2, 2);
  }
  ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
  for (let i = 0; i < 90; i++) {
    const hVal = ((slotIndex + 7) * 83492791) ^ (i * 29712150);
    const gx = x + 6 + (Math.abs(hVal) % (w - 12));
    const gy = 8 + (Math.abs(hVal >> 5) % (h - 16));
    ctx.fillRect(gx, gy, 2, 2);
  }

  // Head/tail horizontal accent bands
  ctx.fillStyle = palette.accentColor;
  ctx.fillRect(x + 4, 24, w - 8, 16);
  ctx.fillRect(x + 4, 46, w - 8, 4);
  ctx.fillRect(x + 4, h - 42, w - 8, 16);
  ctx.fillRect(x + 4, h - 52, w - 8, 4);

  if (showLabel && book.title.trim().length > 0) {
    // Small spine imprint mark near lower tail band
    ctx.fillStyle = palette.textColor;
    ctx.globalAlpha = 0.65;
    ctx.fillRect(x + w * 0.36, h - 78, w * 0.28, 7);
    ctx.globalAlpha = 1;

    // Spine title rotated +90deg: top-to-bottom on standing books, left-to-right on Z-rotated stacked books
    ctx.translate(x + w * 0.5, h * 0.49);
    ctx.rotate(Math.PI / 2);

    let fontSize = 28;
    const maxTextSpan = 352;
    ctx.font = `800 ${fontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    let textW = ctx.measureText(book.title).width;
    while (textW > maxTextSpan && fontSize > 16) {
      fontSize -= 1;
      ctx.font = `800 ${fontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`;
      textW = ctx.measureText(book.title).width;
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillText(book.title, 1.5, 1.5);
    ctx.fillStyle = palette.textColor;
    ctx.fillText(book.title, 0, 0);
  } else {
    // Decorative center medallion line for unlabelled cloth volumes
    ctx.fillStyle = palette.accentColor;
    ctx.fillRect(x + 12, h * 0.49 - 3, w - 24, 6);
  }

  ctx.restore();
}

export function createBooksSpineAtlasTexture(
  standingBooks: ReadonlyArray<ShelfBookConfig>,
  stackedBooks: ReadonlyArray<StackedBookConfig>
): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = BOOKS_ATLAS_WIDTH;
  canvas.height = BOOKS_ATLAS_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, BOOKS_ATLAS_WIDTH, BOOKS_ATLAS_HEIGHT);

  const allBooks: Array<ShelfBookConfig | StackedBookConfig> = [
    ...standingBooks,
    ...stackedBooks,
  ].slice(0, BOOK_SPINE_MAX_SLOTS);

  allBooks.forEach((book, idx) => {
    drawBookSpineSlot(ctx, idx, book);
  });

  // Explicit pure white corner strip [960..1024) so vertex-colored faces multiply by 1.0 cleanly
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(
    BOOK_SPINE_MAX_SLOTS * BOOK_SPINE_SLOT_W,
    0,
    BOOKS_ATLAS_WIDTH - BOOK_SPINE_MAX_SLOTS * BOOK_SPINE_SLOT_W,
    BOOKS_ATLAS_HEIGHT
  );

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

