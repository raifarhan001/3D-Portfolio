import * as THREE from 'three';

function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

/**
 * Helper to draw evenly letter-spaced uppercase text centered around (cx, cy).
 */
function measureTrackedWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  trackingPx: number
): number {
  if (!text.length) return 0;
  let total = 0;
  for (let i = 0; i < text.length; i++) {
    total += ctx.measureText(text[i]).width;
    if (i < text.length - 1) total += trackingPx;
  }
  return total;
}

function drawTrackedChars(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  trackingPx: number,
  mode: 'stroke' | 'fill'
): void {
  const totalW = measureTrackedWidth(ctx, text, trackingPx);
  let cursorX = cx - totalW / 2;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (mode === 'stroke') {
      ctx.strokeText(ch, cursorX, cy);
    } else {
      ctx.fillText(ch, cursorX, cy);
    }
    cursorX += ctx.measureText(ch).width + trackingPx;
  }
}

/**
 * 1) Hero Neon Name Sign CanvasTexture (2048x512, transparent, mipmaps on, anisotropy 4).
 * Crisp rounded geometric glass-tube outline strokes with baked outer glow & warm-white core.
 */
export function createHeroNameNeonTexture(
  rawName: string,
  neonColor: string,
  coreColor: string
): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const W = 2048;
  const H = 512;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.clearRect(0, 0, W, H);
  const label = rawName.trim().toUpperCase();

  let fontPx = 228;
  let tracking = 24;
  ctx.font = `700 ${fontPx}px "Space Grotesk", "Arial Rounded MT Bold", "Segoe UI", system-ui, sans-serif`;
  while (fontPx > 96 && measureTrackedWidth(ctx, label, tracking) > W - 260) {
    fontPx -= 10;
    tracking = Math.max(10, Math.round(fontPx * 0.1));
    ctx.font = `700 ${fontPx}px "Space Grotesk", "Arial Rounded MT Bold", "Segoe UI", system-ui, sans-serif`;
  }

  const cx = W / 2;
  const cy = H / 2 + 4;

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Pass 1: Wide soft baked neon outer bloom
  ctx.shadowColor = neonColor;
  ctx.shadowBlur = 46;
  ctx.strokeStyle = neonColor;
  ctx.lineWidth = 22;
  ctx.globalAlpha = 0.72;
  drawTrackedChars(ctx, label, cx, cy, tracking, 'stroke');

  // Pass 2: Focused glass tube body stroke
  ctx.globalAlpha = 0.96;
  ctx.shadowBlur = 18;
  ctx.strokeStyle = neonColor;
  ctx.lineWidth = 12;
  drawTrackedChars(ctx, label, cx, cy, tracking, 'stroke');

  // Pass 3: Subtle translucent interior tube fill so letters read effortlessly at long distance
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = neonColor;
  drawTrackedChars(ctx, label, cx, cy, tracking, 'fill');

  // Pass 4: Crisp inner warm-white plasma core line
  ctx.globalAlpha = 1.0;
  ctx.shadowColor = coreColor;
  ctx.shadowBlur = 7;
  ctx.strokeStyle = coreColor;
  ctx.lineWidth = 4.4;
  drawTrackedChars(ctx, label, cx, cy, tracking, 'stroke');

  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * 2) Dual-zone Desk Nameplate Texture (1024x256):
 *    - Top half (v in [0.375..1.0]): Brushed brass face plate (#b9975b) with bold name,
 *      small-caps tracked role, and accent underline.
 *    - Bottom band (v in [0..0.375]): Brushed dark gunmetal (#2a2d36) for wedge prism body.
 */
export function createDeskNameplateTexture(
  displayName: string,
  displayRole: string,
  accentColor: string
): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const W = 1024;
  const H = 256;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const brassSplitY = 164;

  // Top Brass Face Plate (#b9975b)
  const brassGrad = ctx.createLinearGradient(0, 0, W, brassSplitY);
  brassGrad.addColorStop(0.0, '#c7a467');
  brassGrad.addColorStop(0.35, '#b9975b');
  brassGrad.addColorStop(0.7, '#d1b074');
  brassGrad.addColorStop(1.0, '#a88449');
  ctx.fillStyle = brassGrad;
  ctx.fillRect(0, 0, W, brassSplitY);

  // Subtle horizontal brushed brass micro-lines
  ctx.fillStyle = 'rgba(255, 245, 220, 0.08)';
  for (let y = 4; y < brassSplitY; y += 5) {
    ctx.fillRect(0, y, W, 1);
  }

  // Thin engraved perimeter inset border
  ctx.strokeStyle = 'rgba(30, 24, 16, 0.45)';
  ctx.lineWidth = 5;
  ctx.strokeRect(14, 12, W - 28, brassSplitY - 24);

  // Line 1: Bold displayName
  const nameUpper = displayName.trim().toUpperCase();
  ctx.fillStyle = '#181a20';
  ctx.font = '800 54px "Space Grotesk", "Segoe UI", system-ui, sans-serif';
  drawTrackedChars(ctx, nameUpper, W / 2, 58, 7, 'fill');

  // Accent #6C8CFF horizontal underline bar
  ctx.fillStyle = accentColor;
  ctx.fillRect(W / 2 - 235, 95, 470, 5);

  // Line 2: Small caps / wide letter-spaced role
  const roleUpper = displayRole.trim().toUpperCase();
  ctx.fillStyle = '#242018';
  ctx.font = '700 28px "Space Mono", "Segoe UI", system-ui, sans-serif';
  drawTrackedChars(ctx, roleUpper, W / 2, 126, 9, 'fill');

  // Bottom Brushed Dark Metal (#2a2d36) for prism stand
  ctx.fillStyle = '#2a2d36';
  ctx.fillRect(0, brassSplitY, W, H - brassSplitY);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  for (let y = brassSplitY + 4; y < H; y += 4) {
    ctx.fillRect(0, y, W, 1);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 2;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * 3) Chair Headrest Embroidery Decal Texture (512x128, transparent, non-emissive):
 *    Warm white (#f1e9dc) bold letters with stitched thread ribs & slight weave grain.
 */
export function createChairEmbroideryTexture(text: string): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const W = 512;
  const H = 128;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.clearRect(0, 0, W, H);
  const label = text.trim().toUpperCase();

  ctx.font = '800 84px "Space Grotesk", "Segoe UI", system-ui, sans-serif';

  // Soft thread shadow edge under stitch
  ctx.save();
  ctx.fillStyle = 'rgba(18, 16, 14, 0.42)';
  drawTrackedChars(ctx, label, W / 2 + 2, H / 2 + 3, 18, 'fill');

  // Main warm white embroidery thread
  ctx.fillStyle = '#f1e9dc';
  drawTrackedChars(ctx, label, W / 2, H / 2, 18, 'fill');

  // Clip diagonal stitch rib texture strictly onto rendered glyphs
  ctx.globalCompositeOperation = 'source-atop';
  ctx.strokeStyle = 'rgba(98, 86, 72, 0.34)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = -H; x < W + H; x += 5) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x + H * 0.45, H);
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 252, 246, 0.25)';
  for (let i = 0; i < 450; i++) {
    ctx.fillRect(hash(i * 3) * W, hash(i * 7 + 1) * H, 1.5, 1.5);
  }
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 1;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * 4) Entrance Coir Doormat Texture (1024x614, coir base #2b2623, woven border & stencil text).
 */
export function createDoormatTexture(
  welcomeText: string,
  displayName: string
): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const W = 1024;
  const H = 614;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#2b2623';
  ctx.fillRect(0, 0, W, H);

  // Batched coir bristle strokes (fast 3-pass batching avoids 11k synchronous Canvas2D stroke() calls)
  const fiberShades = ['#3a332e', '#211d1a', '#433a33'];
  ctx.lineWidth = 1.4;
  for (let pass = 0; pass < 3; pass++) {
    ctx.strokeStyle = fiberShades[pass];
    ctx.beginPath();
    for (let i = pass; i < 4800; i += 3) {
      const fx = hash(i * 1.13) * W;
      const fy = hash(i * 2.71) * H;
      const ang = hash(i * 4.37) * Math.PI;
      const len = 3 + hash(i * 5.91) * 5;
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + Math.cos(ang) * len, fy + Math.sin(ang) * len);
    }
    ctx.stroke();
  }

  // Light inset woven border
  ctx.strokeStyle = '#9b8b7a';
  ctx.lineWidth = 12;
  ctx.strokeRect(42, 38, W - 84, H - 76);

  ctx.strokeStyle = '#5c5045';
  ctx.lineWidth = 4;
  ctx.strokeRect(64, 60, W - 128, H - 120);

  // Welcome heading + Display Name underneath
  ctx.fillStyle = '#ebe2d3';
  ctx.font = '800 108px "Space Grotesk", "Segoe UI", system-ui, sans-serif';
  drawTrackedChars(ctx, welcomeText.trim().toUpperCase(), W / 2, H * 0.41, 18, 'fill');

  // Accent woven separator rule
  ctx.fillStyle = '#6C8CFF';
  ctx.globalAlpha = 0.72;
  ctx.fillRect(W / 2 - 140, H * 0.56, 280, 5);
  ctx.globalAlpha = 1.0;

  ctx.fillStyle = '#d8cbb8';
  ctx.font = '700 56px "Space Mono", "Segoe UI", system-ui, sans-serif';
  drawTrackedChars(ctx, displayName.trim().toUpperCase(), W / 2, H * 0.69, 10, 'fill');

  // Subtle top bristle specks over paint so typography blends naturally into coir weave
  ctx.fillStyle = 'rgba(43, 38, 35, 0.36)';
  for (let i = 0; i < 1200; i++) {
    ctx.fillRect(hash(i * 9.1 + 500) * W, hash(i * 11.7 + 900) * H, 2, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 1;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
