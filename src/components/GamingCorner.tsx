'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { buildMergedColoredGeometry, buildMergedGeometry, freezeStaticMatrices, type GeometryPart } from '@/utils/mergeHelpers';
import { GAMING_CORNER_CONFIG, ROOM_CONFIG, gamingCornerLocalToWorld } from '@/config/roomConfig';
import { ROOM_CONTENT_CONFIG } from '@/config/roomContent';
import { IDENTITY_CONFIG } from '@/config/identityConfig';
import { THEMES_CONFIG } from '@/config/themeConfig';
import {
  createChairEmbroideryTexture,
  createDeskNameplateTexture,
} from '@/utils/identityTextures';
import { OS_CONFIG } from '@/config/osConfig';
import { getOSProjects } from '@/utils/githubProjects';
import { usePcStore } from '@/stores/pcStore';
import { useThemeStore } from '@/stores/themeStore';
import { useInputStore } from '@/stores/inputStore';
import { usePortfolioStore } from '@/stores/portfolioStore';
import { getThemedDeskRgbBrightness, getThemedHexBrightness } from '@/utils/themeRegistry';
import PCScreen from '@/components/PCScreen';
import StreamingSetup from '@/components/StreamingSetup';

const _rgbColor = new THREE.Color(1, 0, 0);
const _hexColor = new THREE.Color();
const _tempObj = new THREE.Object3D();

const SCREEN_CTX_MAP = new WeakMap<
  THREE.Texture,
  { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }
>();

// Unused legacy constant removed for Step 4B Rai XP desktop

// Asymmetric 28-hexagon interlocking honeycomb cluster above gaming desk on East accent wall
const HEX_AXIAL_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [-2, 3],
  [0, 3],
  [1, 3],
  [3, 3],
  [-3, 2],
  [-2, 2],
  [0, 2],
  [1, 2],
  [2, 2],
  [3, 2],
  [4, 2],
  [-4, 1],
  [-3, 1],
  [-1, 1],
  [0, 1],
  [1, 1],
  [2, 1],
  [3, 1],
  [4, 1],
  [-5, 0],
  [-4, 0],
  [-3, 0],
  [-1, 0],
  [0, 0],
  [2, 0],
  [-4, -1],
  [-3, -1],
  [-2, -1],
];

/**
 * Helper to transform an array of GeometryParts by a common pivot position & Euler rotation.
 */
function transformParts(
  parts: GeometryPart[],
  origin: [number, number, number],
  rot: [number, number, number] = [0, 0, 0]
): GeometryPart[] {
  const mParent = new THREE.Matrix4().compose(
    new THREE.Vector3(...origin),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2], 'XYZ')),
    new THREE.Vector3(1, 1, 1)
  );
  const mChild = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const euler = new THREE.Euler(0, 0, 0, 'XYZ');

  return parts.map((part) => {
    const p = part.position ?? [0, 0, 0];
    const r = part.rotation ?? [0, 0, 0];
    const s = part.scale ?? [1, 1, 1];
    mChild.compose(
      new THREE.Vector3(p[0], p[1], p[2]),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(r[0], r[1], r[2], 'XYZ')),
      new THREE.Vector3(s[0], s[1], s[2])
    );
    mChild.premultiply(mParent);
    mChild.decompose(pos, quat, scale);
    euler.setFromQuaternion(quat, 'XYZ');
    return {
      geometry: part.geometry,
      position: [pos.x, pos.y, pos.z],
      rotation: [euler.x, euler.y, euler.z],
      scale: [scale.x, scale.y, scale.z],
    };
  });
}

// Flat 38" 21:9 monitor replaces curved geometry for exact homography overlay fit

function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

function drawFourSquareEmblem(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  tileSize: number,
  gap: number
): void {
  const colors = [
    { dx: -1, dy: -1, c1: '#f05228', c2: '#b8250a', tilt: -0.06 },
    { dx: 1, dy: -1, c1: '#70c430', c2: '#3f8a12', tilt: 0.05 },
    { dx: -1, dy: 1, c1: '#2a94f4', c2: '#1356b8', tilt: 0.05 },
    { dx: 1, dy: 1, c1: '#f7bc14', c2: '#cf8200', tilt: -0.06 },
  ];

  ctx.save();
  ctx.translate(cx, cy);
  ctx.transform(1, 0, -0.14, 1, 0, 0);

  for (const sq of colors) {
    const x = sq.dx > 0 ? gap * 0.5 : -tileSize - gap * 0.5;
    const y = (sq.dy > 0 ? gap * 0.5 : -tileSize - gap * 0.5) + (sq.dx < 0 ? -3 : 3);
    ctx.save();
    ctx.rotate(sq.tilt);
    const grad = ctx.createLinearGradient(x, y, x + tileSize, y + tileSize);
    grad.addColorStop(0, sq.c1);
    grad.addColorStop(1, sq.c2);
    ctx.fillStyle = grad;
    fillRoundRect(ctx, x, y, tileSize, tileSize, Math.max(3, tileSize * 0.14));
    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
    fillRoundRect(ctx, x + 2, y + 2, tileSize * 0.65, tileSize * 0.24, Math.max(2, tileSize * 0.08));
    ctx.restore();
  }
  ctx.restore();
}

function drawBootScreen(ctx: CanvasRenderingContext2D, width: number, height: number, elapsed: number): void {
  const { blackLead, logoBar, welcome } = OS_CONFIG.bootDuration;

  if (elapsed < blackLead) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
    return;
  }

  const logoEnd = blackLead + logoBar;
  if (elapsed < logoEnd) {
    const stageTime = elapsed - blackLead;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    const glow = ctx.createRadialGradient(width / 2, height * 0.43, 30, width / 2, height * 0.43, 520);
    glow.addColorStop(0, 'rgba(30, 88, 210, 0.16)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    drawFourSquareEmblem(ctx, width / 2, height * 0.34, 46, 8);

    ctx.textBaseline = 'middle';
    ctx.font = 'italic 700 96px "Trebuchet MS", Tahoma, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Rai', width / 2 + 16, height * 0.48);

    ctx.font = 'italic 700 66px "Trebuchet MS", Tahoma, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f26b1d';
    ctx.fillText('XP', width / 2 + 26, height * 0.465);

    ctx.font = '500 22px Tahoma, Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#9ca3af';
    ctx.fillText('Workstation Edition', width / 2, height * 0.56);

    // Classic blue progress bar with 3 moving blocks
    const barW = 360;
    const barH = 26;
    const barX = (width - barW) / 2;
    const barY = height * 0.65;

    ctx.fillStyle = '#090d16';
    fillRoundRect(ctx, barX, barY, barW, barH, 6);
    ctx.strokeStyle = '#738294';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 6);
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(barX + 4, barY + 4, barW - 8, barH - 8, 3);
    ctx.clip();

    const blockW = 24;
    const blockGap = 6;
    const groupW = blockW * 3 + blockGap * 2;
    const travel = barW + groupW + 24;
    const offset = ((stageTime * 210) % travel) - groupW - 12;

    for (let i = 0; i < 3; i++) {
      const bx = barX + offset + i * (blockW + blockGap);
      const bGrad = ctx.createLinearGradient(bx, barY + 4, bx, barY + barH - 4);
      bGrad.addColorStop(0, '#96c6ff');
      bGrad.addColorStop(0.45, '#3b7df3');
      bGrad.addColorStop(1, '#1d4fc2');
      ctx.fillStyle = bGrad;
      fillRoundRect(ctx, bx, barY + 5, blockW, barH - 10, 3);
    }
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#64748b';
    ctx.font = '400 18px Tahoma, Verdana, sans-serif';
    ctx.fillText('Copyright (c) Rai Farhan  |  github.com/RaiFarhan0', width / 2, height - 48);
    return;
  }

  // Stage 3: Welcome screen (1.2s)
  const welcomeFrac = Math.min(1, Math.max(0, (elapsed - logoEnd) / welcome));
  const topBandH = Math.round(height * 0.115);
  const botBandH = Math.round(height * 0.13);

  const midBg = ctx.createLinearGradient(0, topBandH, 0, height - botBandH);
  midBg.addColorStop(0, '#4f82e6');
  midBg.addColorStop(0.5, '#5a8dee');
  midBg.addColorStop(1, '#3b6cd4');
  ctx.fillStyle = midBg;
  ctx.fillRect(0, 0, width, height);

  const radial = ctx.createRadialGradient(width * 0.42, height * 0.42, 40, width * 0.42, height * 0.42, 620);
  radial.addColorStop(0, 'rgba(173, 212, 255, 0.45)');
  radial.addColorStop(1, 'rgba(59, 108, 212, 0)');
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, width, height);

  // Top & bottom deep blue Luna bands
  ctx.fillStyle = '#08328e';
  ctx.fillRect(0, 0, width, topBandH);
  ctx.fillRect(0, height - botBandH, width, botBandH);

  const lineGrad = ctx.createLinearGradient(0, 0, width, 0);
  lineGrad.addColorStop(0, 'rgba(255,255,255,0)');
  lineGrad.addColorStop(0.35, 'rgba(255,255,255,0.65)');
  lineGrad.addColorStop(0.75, 'rgba(249,153,74,0.85)');
  lineGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = lineGrad;
  ctx.fillRect(0, topBandH, width, 3);
  ctx.fillRect(0, height - botBandH - 3, width, 3);

  ctx.save();
  ctx.globalAlpha = 0.3 + 0.7 * Math.min(1, welcomeFrac * 3);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'italic 700 108px "Trebuchet MS", Tahoma, sans-serif';
  const greetingText = `Welcome ${IDENTITY_CONFIG.firstName}`;
  ctx.fillStyle = 'rgba(0, 24, 92, 0.45)';
  ctx.fillText(greetingText, width / 2 + 4, height * 0.5 + 4);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(greetingText, width / 2, height * 0.5);
  ctx.restore();
}

function createStaticDesktopTexture(width: number, height: number): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const barH = 54;
  const bodyH = height - barH;

  // 1. Sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, bodyH * 0.78);
  sky.addColorStop(0, '#1f64d0');
  sky.addColorStop(0.55, '#5b9ef5');
  sky.addColorStop(1, '#a9d5fc');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, bodyH);

  // 2. Soft clouds
  const clouds = [
    { x: width * 0.22, y: bodyH * 0.22, rx: 190, ry: 46, a: 0.48 },
    { x: width * 0.34, y: bodyH * 0.19, rx: 140, ry: 40, a: 0.42 },
    { x: width * 0.68, y: bodyH * 0.16, rx: 220, ry: 52, a: 0.46 },
    { x: width * 0.81, y: bodyH * 0.24, rx: 160, ry: 38, a: 0.38 },
    { x: width * 0.5, y: bodyH * 0.34, rx: 250, ry: 44, a: 0.28 },
  ];
  for (const c of clouds) {
    const cg = ctx.createRadialGradient(c.x, c.y, 10, c.x, c.y, c.rx);
    cg.addColorStop(0, `rgba(255, 255, 255, ${c.a})`);
    cg.addColorStop(0.65, `rgba(255, 255, 255, ${c.a * 0.45})`);
    cg.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, c.rx, c.ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 3. Back rolling green hill (Bezier curve)
  const backHill = ctx.createLinearGradient(0, bodyH * 0.44, 0, bodyH);
  backHill.addColorStop(0, '#59aa2f');
  backHill.addColorStop(1, '#2b6f17');
  ctx.fillStyle = backHill;
  ctx.beginPath();
  ctx.moveTo(0, bodyH * 0.62);
  ctx.bezierCurveTo(width * 0.28, bodyH * 0.43, width * 0.55, bodyH * 0.46, width, bodyH * 0.58);
  ctx.lineTo(width, bodyH);
  ctx.lineTo(0, bodyH);
  ctx.closePath();
  ctx.fill();

  // 4. Foreground rolling green hill (Bezier curve)
  const frontHill = ctx.createLinearGradient(0, bodyH * 0.48, 0, bodyH);
  frontHill.addColorStop(0, '#80d137');
  frontHill.addColorStop(0.45, '#59ae23');
  frontHill.addColorStop(1, '#2c7a16');
  ctx.fillStyle = frontHill;
  ctx.beginPath();
  ctx.moveTo(0, bodyH * 0.68);
  ctx.bezierCurveTo(width * 0.22, bodyH * 0.54, width * 0.42, bodyH * 0.72, width * 0.68, bodyH * 0.52);
  ctx.bezierCurveTo(width * 0.84, bodyH * 0.41, width * 0.93, bodyH * 0.47, width, bodyH * 0.55);
  ctx.lineTo(width, bodyH);
  ctx.lineTo(0, bodyH);
  ctx.closePath();
  ctx.fill();

  // 5. Desktop icons in left columns
  const projects = getOSProjects();
  const baseIcons = [
    { label: 'My Computer', kind: 'pc' },
    { label: 'Recycle Bin', kind: 'bin' },
    { label: 'About Me', kind: 'note' },
    { label: 'Contact', kind: 'mail' },
    { label: 'My Resume', kind: 'doc' },
    ...projects.slice(0, 8).map((p) => ({ label: p.name, kind: 'folder' })),
  ];

  const colW = 128;
  const cellH = 112;
  const maxRows = 6;
  baseIcons.forEach((item, idx) => {
    const col = Math.floor(idx / maxRows);
    const row = idx % maxRows;
    const cx = 66 + col * colW;
    const cy = 54 + row * cellH;

    ctx.save();
    ctx.translate(cx - 24, cy - 24);
    if (item.kind === 'folder') {
      ctx.fillStyle = '#e7a72c';
      fillRoundRect(ctx, 2, 10, 44, 32, 4);
      ctx.fillStyle = '#ffd563';
      fillRoundRect(ctx, 2, 6, 18, 8, 3);
      ctx.fillStyle = '#ffe285';
      fillRoundRect(ctx, 4, 15, 40, 24, 3);
    } else if (item.kind === 'pc') {
      ctx.fillStyle = '#cbd5e1';
      fillRoundRect(ctx, 6, 4, 36, 26, 4);
      ctx.fillStyle = '#1e64d8';
      fillRoundRect(ctx, 10, 8, 28, 18, 2);
      ctx.fillStyle = '#94a3b8';
      fillRoundRect(ctx, 16, 32, 16, 4, 2);
      fillRoundRect(ctx, 10, 37, 28, 5, 2);
    } else if (item.kind === 'bin') {
      ctx.fillStyle = '#94a3b8';
      fillRoundRect(ctx, 11, 10, 26, 32, 4);
      ctx.fillStyle = '#e2e8f0';
      fillRoundRect(ctx, 9, 7, 30, 5, 2);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(16, 16, 4, 20);
      ctx.fillRect(22, 16, 4, 20);
      ctx.fillRect(28, 16, 4, 20);
    } else if (item.kind === 'mail') {
      ctx.fillStyle = '#ffffff';
      fillRoundRect(ctx, 5, 11, 38, 26, 3);
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(6, 12);
      ctx.lineTo(24, 26);
      ctx.lineTo(42, 12);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#ffffff';
      fillRoundRect(ctx, 10, 5, 28, 38, 3);
      ctx.fillStyle = item.kind === 'doc' ? '#dc2626' : '#2563eb';
      ctx.fillRect(10, 5, 28, 8);
      ctx.fillStyle = '#64748b';
      ctx.fillRect(15, 18, 18, 3);
      ctx.fillRect(15, 24, 18, 3);
      ctx.fillRect(15, 30, 12, 3);
    }
    ctx.restore();

    const labelText = item.label.length > 15 ? `${item.label.slice(0, 14)}...` : item.label;
    ctx.font = '600 18px Tahoma, Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.82)';
    ctx.fillText(labelText, cx + 1.5, cy + 31.5);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(labelText, cx, cy + 30);
  });

  // 6. Blue Luna Taskbar at bottom
  const barY = height - barH;
  const tbGrad = ctx.createLinearGradient(0, barY, 0, height);
  tbGrad.addColorStop(0, OS_CONFIG.colors.taskbarEnd);
  tbGrad.addColorStop(0.25, OS_CONFIG.colors.taskbarStart);
  tbGrad.addColorStop(1, '#1941a5');
  ctx.fillStyle = tbGrad;
  ctx.fillRect(0, barY, width, barH);

  ctx.fillStyle = OS_CONFIG.colors.taskbarTopEdge;
  ctx.fillRect(0, barY, width, 3);

  const startW = 166;
  const sbGrad = ctx.createLinearGradient(0, barY, 0, height);
  sbGrad.addColorStop(0, '#54b74d');
  sbGrad.addColorStop(0.5, OS_CONFIG.colors.startBtnStart);
  sbGrad.addColorStop(1, OS_CONFIG.colors.startBtnEnd);
  ctx.fillStyle = sbGrad;
  ctx.beginPath();
  ctx.moveTo(0, barY);
  ctx.lineTo(startW - 18, barY);
  ctx.quadraticCurveTo(startW + 8, barY + barH / 2, startW - 18, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fill();

  drawFourSquareEmblem(ctx, 28, barY + barH / 2, 10, 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.font = 'italic 700 28px "Trebuchet MS", Tahoma, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('start', 52, barY + barH / 2 + 2);
  ctx.fillStyle = '#ffffff';
  ctx.fillText('start', 50, barY + barH / 2);

  const trayW = 196;
  const trayGrad = ctx.createLinearGradient(width - trayW, barY, width - trayW, height);
  trayGrad.addColorStop(0, '#1290e8');
  trayGrad.addColorStop(1, '#0c68b8');
  ctx.fillStyle = trayGrad;
  ctx.fillRect(width - trayW, barY + 3, trayW, barH - 3);
  ctx.fillStyle = '#0a4f94';
  ctx.fillRect(width - trayW, barY + 3, 2, barH - 3);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff';
  ctx.font = '500 22px Tahoma, Verdana, sans-serif';
  ctx.fillText('10:42 PM', width - 22, barY + barH / 2 + 1);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function createBootTexture(width: number, height: number): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  drawBootScreen(ctx, width, height, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  SCREEN_CTX_MAP.set(texture, { canvas, ctx });
  return texture;
}

function redrawBootTexture(tex: THREE.CanvasTexture | null, elapsed: number): boolean {
  if (!tex) return false;
  const meta = SCREEN_CTX_MAP.get(tex);
  if (!meta) return false;
  drawBootScreen(meta.ctx, meta.canvas.width, meta.canvas.height, elapsed);
  tex.needsUpdate = true;
  return true;
}

/**
 * Generates subtle dark walnut horizontal wood grain CanvasTexture once.
 * Kept high-luminance so material color (#4a3426) tints it cleanly without crushing shadows.
 */
function createWalnutWoodTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const w = 512;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#ede6df';
  ctx.fillRect(0, 0, w, h);

  const hash = (n: number) => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };

  for (let i = 0; i < 64; i++) {
    const y = hash(i * 11.3) * h;
    const thickness = 1 + hash(i * 23.7) * 3.5;
    const alpha = 0.06 + hash(i * 37.1) * 0.1;
    ctx.fillStyle = `rgba(38, 22, 12, ${alpha.toFixed(3)})`;
    ctx.fillRect(0, y, w, thickness);
  }

  // Soft longitudinal cathedral grain streaks
  for (let i = 0; i < 18; i++) {
    const y = hash(i * 41.9) * h;
    ctx.strokeStyle = 'rgba(255, 245, 232, 0.14)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(w * 0.33, y + (hash(i + 2) - 0.5) * 14, w * 0.66, y + (hash(i + 5) - 0.5) * 14, w, y);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Generates perforated dot-mesh grille CanvasTexture once for the PC top panel.
 */
function createTopMeshTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const w = 256;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#cfd1d8';
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = '#24262e';
  const step = 12;
  for (let y = 8; y < h - 4; y += step) {
    const offset = ((y / step) % 2) * (step * 0.5);
    for (let x = 8 + offset; x < w - 6; x += step) {
      ctx.beginPath();
      ctx.arc(x, y, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Generates keyboard keycap grid CanvasTexture once (rows of rounded key recesses).
 */
function createKeyboardTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const w = 512;
  const h = 192;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#111318';
  ctx.fillRect(0, 0, w, h);

  const rows = 5;
  const cols = 15;
  const padX = 16;
  const padY = 16;
  const gap = 5;
  const cellW = (w - padX * 2 - gap * (cols - 1)) / cols;
  const cellH = (h - padY * 2 - gap * (rows - 1)) / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (r === 4 && c >= 4 && c <= 9) {
        if (c > 4) continue;
        const sw = cellW * 6 + gap * 5;
        ctx.fillStyle = '#1d212b';
        fillRoundRect(ctx, padX + c * (cellW + gap), padY + r * (cellH + gap), sw, cellH, 4);
        continue;
      }
      const x = padX + c * (cellW + gap);
      const y = padY + r * (cellH + gap);
      ctx.fillStyle = r === 0 && c === 0 ? '#c1121f' : '#20242e';
      fillRoundRect(ctx, x, y, cellW, cellH, 4);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Generates portrait minimalist moon art CanvasTexture (512x720) with crisp white mat border,
 * dark navy circle, and thin warm-white crescent arc line once.
 */
function createPosterTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const w = 512;
  const h = 720;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Crisp white mat border around inner art print
  ctx.fillStyle = '#f5f4f0';
  ctx.fillRect(0, 0, w, h);

  const matPadX = 64;
  const matPadY = 74;
  const artW = w - matPadX * 2;
  const artH = h - matPadY * 2;

  ctx.fillStyle = '#ebe8e1';
  ctx.fillRect(matPadX, matPadY, artW, artH);

  ctx.strokeStyle = 'rgba(30, 32, 38, 0.14)';
  ctx.lineWidth = 2;
  ctx.strokeRect(matPadX, matPadY, artW, artH);

  // Dark navy circle centered cleanly inside the inner print
  const cx = w / 2;
  const cy = h / 2 - 8;
  const r = 118;

  ctx.fillStyle = '#0f1c3f';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Thin warm-white crescent arc line across upper-right quadrant (minimalist moon)
  ctx.strokeStyle = '#faf3e0';
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx + 12, cy - 10, r * 0.72, -Math.PI * 0.52, Math.PI * 0.16);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function getControllerWorldPose(): {
  target: THREE.Vector3;
  cameraPos: THREE.Vector3;
} {
  const cfg = ROOM_CONTENT_CONFIG.controllerResume;
  const worldPos = gamingCornerLocalToWorld(
    cfg.localPosition[0],
    cfg.localPosition[1] + 0.025,
    cfg.localPosition[2]
  );
  const target = new THREE.Vector3(...worldPos);
  // Look from slightly in front (+lz local) and above (+y) the desk front edge
  const camWorld = gamingCornerLocalToWorld(
    cfg.localPosition[0],
    cfg.localPosition[1] + 0.36,
    cfg.localPosition[2] + 0.38
  );
  return { target, cameraPos: new THREE.Vector3(...camWorld) };
}

/**
 * Builds a single slanted triangular prism Desk Nameplate (0.24 x 0.05 x 0.07)
 * mapping the front angled face onto the brass zone and side/back/bottom onto brushed dark metal.
 */
function createDeskNameplateGeometry(): THREE.BufferGeometry {
  const hw = 0.12;
  const h = 0.05;
  const zFront = 0.035;
  const zBack = -0.035;
  const zCrest = -0.015;

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];

  const pushTri = (
    p0: [number, number, number],
    p1: [number, number, number],
    p2: [number, number, number],
    uv0: [number, number],
    uv1: [number, number],
    uv2: [number, number]
  ) => {
    const a = new THREE.Vector3(...p0);
    const b = new THREE.Vector3(...p1);
    const c = new THREE.Vector3(...p2);
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
    positions.push(...p0, ...p1, ...p2);
    normals.push(n.x, n.y, n.z, n.x, n.y, n.z, n.x, n.y, n.z);
    uvs.push(...uv0, ...uv1, ...uv2);
  };

  // Slanted Front Face (brass nameplate facing +Z and upward)
  pushTri([-hw, 0, zFront], [hw, 0, zFront], [hw, h, zCrest], [0.0, 0.365], [1.0, 0.365], [1.0, 1.0]);
  pushTri([-hw, 0, zFront], [hw, h, zCrest], [-hw, h, zCrest], [0.0, 0.365], [1.0, 1.0], [0.0, 1.0]);

  // Metal prism sides, back & bottom
  const mUv0: [number, number] = [0.1, 0.1];
  const mUv1: [number, number] = [0.9, 0.1];
  const mUv2: [number, number] = [0.9, 0.3];
  const mUv3: [number, number] = [0.1, 0.3];

  // Back slope
  pushTri([hw, 0, zBack], [-hw, 0, zBack], [-hw, h, zCrest], mUv0, mUv1, mUv2);
  pushTri([hw, 0, zBack], [-hw, h, zCrest], [hw, h, zCrest], mUv0, mUv2, mUv3);
  // Bottom
  pushTri([-hw, 0, zBack], [hw, 0, zBack], [hw, 0, zFront], mUv0, mUv1, mUv2);
  pushTri([-hw, 0, zBack], [hw, 0, zFront], [-hw, 0, zFront], mUv0, mUv2, mUv3);
  // Left cap
  pushTri([-hw, 0, zBack], [-hw, 0, zFront], [-hw, h, zCrest], mUv0, mUv1, mUv2);
  // Right cap
  pushTri([hw, 0, zFront], [hw, 0, zBack], [hw, h, zCrest], mUv0, mUv1, mUv2);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  return geo;
}

/**
 * GamingCorner — Redesigned Straight Walnut Desk, Dual Identical 27" Monitors on Arm,
 * White Panoramic Mid-Tower PC, Sculpted Racing Gaming Chair & Existing Wall Decor.
 */
export default function GamingCorner() {
  const { width, depth } = ROOM_CONFIG;
  const {
    gamingCorner,
    rotationY,
    deskHeight,
    deskThickness,
    chairPosition,
    mainMonitorPos,
    monitorTiltX,
    screenArcWidth,
    screenHeight,
    rgbMode,
    rgbSpeed,
    rgbStaticColor,
    pointLightLocalPos,
    pointLightIntensity,
    pointLightDistance,
    pointLightDecay,
    hexCount,
  } = GAMING_CORNER_CONFIG;

  const poweredPC = usePcStore((s) => s.poweredPC);
  const bootState = usePcStore((s) => s.bootState);
  const bootNonce = usePcStore((s) => s.bootNonce);
  const isLowQuality = usePortfolioStore((s) => s.graphicsQuality === 'low');

  const rootRef = useRef<THREE.Group>(null);
  const hexMeshRef = useRef<THREE.InstancedMesh>(null);
  const hexRimRef = useRef<THREE.InstancedMesh>(null);
  const keysMeshRef = useRef<THREE.InstancedMesh>(null);
  const starArmsMeshRef = useRef<THREE.InstancedMesh>(null);
  const castersMeshRef = useRef<THREE.InstancedMesh>(null);
  const pointLightRef = useRef<THREE.PointLight>(null);
  const rgbMeshRef = useRef<THREE.Mesh>(null);
  const fanRefs = useRef<(THREE.Mesh | null)[]>([]);

  const bootElapsedRef = useRef(0);
  const rgbTimerRef = useRef(0.1);
  const hexTimerRef = useRef(0.1);

  const staticDesktopTexture = useMemo(
    () =>
      createStaticDesktopTexture(
        OS_CONFIG.monitorCanvasSize.width,
        OS_CONFIG.monitorCanvasSize.height
      ),
    []
  );
  const bootTexture = useMemo(
    () => createBootTexture(OS_CONFIG.monitorCanvasSize.width, OS_CONFIG.monitorCanvasSize.height),
    []
  );
  const walnutTex = useMemo(() => createWalnutWoodTexture(), []);
  const topMeshTex = useMemo(() => createTopMeshTexture(), []);
  const keyboardTex = useMemo(() => createKeyboardTexture(), []);
  const posterTex = useMemo(() => createPosterTexture(), []);
  const nameplateTex = useMemo(
    () =>
      createDeskNameplateTexture(
        IDENTITY_CONFIG.displayName,
        IDENTITY_CONFIG.displayRole,
        IDENTITY_CONFIG.nameNeonColor
      ),
    []
  );
  const embroideryTex = useMemo(
    () => createChairEmbroideryTexture(IDENTITY_CONFIG.embroideryText),
    []
  );

  useEffect(() => {
    if (bootState === 'booting') {
      bootElapsedRef.current = 0;
      redrawBootTexture(bootTexture, 0);
    }
  }, [bootState, bootNonce, bootTexture]);

  const merged = useMemo(() => {
    const deskTopY = deskHeight; // 0.75
    const topCenterY = deskTopY - deskThickness / 2; // 0.7325
    const underDeskY = deskTopY - deskThickness; // 0.715

    // 1. Dark walnut desk top (2.2 x 0.035 x 0.8, x: 0.05..2.25, z: 0.03..0.83)
    const walnutDeskGeo = buildMergedGeometry([
      {
        geometry: new RoundedBoxGeometry(2.2, deskThickness, 0.8, 3, 0.01),
        position: [1.15, topCenterY, 0.43],
      },
    ]);

    // 2. Matte black (#111114): steel leg loop frames, modesty panel, dual 27" monitor frames & arm, peripherals
    const matteBlackParts: GeometryPart[] = [];

    // Left & right steel box-loop desk legs (posts 0.05 x 0.715 x 0.05, floor bar 0.05 x 0.04 x 0.7, top bar)
    for (const lx of [0.12, 2.18]) {
      matteBlackParts.push(
        { geometry: new THREE.BoxGeometry(0.05, 0.715, 0.05), position: [lx, 0.3575, 0.105] },
        { geometry: new THREE.BoxGeometry(0.05, 0.715, 0.05), position: [lx, 0.3575, 0.755] },
        { geometry: new THREE.BoxGeometry(0.05, 0.04, 0.7), position: [lx, 0.03, 0.43] },
        { geometry: new THREE.BoxGeometry(0.05, 0.035, 0.7), position: [lx, underDeskY - 0.0175, 0.43] }
      );
    }

    // Back cable / modesty panel: 2.0 x 0.28 x 0.02 hanging y=0.72..0.44, 0.06 in from wall
    matteBlackParts.push({
      geometry: new THREE.BoxGeometry(2.0, 0.28, 0.02),
      position: [1.15, 0.58, 0.06],
    });

    const halfW = screenArcWidth / 2;
    const halfH = screenHeight / 2;
    const bezelRim = 0.008;
    const outerW = screenArcWidth + bezelRim * 2;

    // Flat 38" 21:9 monitor matte black backing slab, 8mm perimeter bezel rim, back bulge, and central desk stand
    matteBlackParts.push(
      ...transformParts(
        [
          {
            geometry: new THREE.BoxGeometry(outerW, screenHeight + bezelRim * 2, 0.016),
            position: [0, 0, -0.008],
          },
          {
            geometry: new THREE.BoxGeometry(outerW, bezelRim, 0.012),
            position: [0, halfH + bezelRim / 2, -0.003],
          },
          {
            geometry: new THREE.BoxGeometry(outerW, bezelRim, 0.012),
            position: [0, -(halfH + bezelRim / 2), -0.003],
          },
          {
            geometry: new THREE.BoxGeometry(bezelRim, screenHeight, 0.012),
            position: [-(halfW + bezelRim / 2), 0, -0.003],
          },
          {
            geometry: new THREE.BoxGeometry(bezelRim, screenHeight, 0.012),
            position: [halfW + bezelRim / 2, 0, -0.003],
          },
          {
            geometry: new RoundedBoxGeometry(0.4, 0.18, 0.05, 3, 0.012),
            position: [0, 0, -0.036],
          },
        ],
        mainMonitorPos,
        [monitorTiltX, 0, 0]
      ),
      // Central stand wide flat base (0.38 x 0.01 x 0.22), neck & hinge (no dual arm, no clamp)
      {
        geometry: new RoundedBoxGeometry(0.38, 0.01, 0.22, 2, 0.004),
        position: [1.15, deskTopY + 0.005, 0.22],
      },
      {
        geometry: new RoundedBoxGeometry(0.068, 0.29, 0.042, 2, 0.008),
        position: [1.15, deskTopY + 0.15, 0.175],
        rotation: [0.1, 0, 0],
      },
      {
        geometry: new THREE.CylinderGeometry(0.024, 0.024, 0.08, 16),
        position: [1.15, mainMonitorPos[1] - 0.01, mainMonitorPos[2] - 0.065],
        rotation: [0, 0, Math.PI / 2],
      }
    );

    // Desk Peripherals + Wall B Floating Shelf & Collectible 1 (removed dark Wall B poster)
    matteBlackParts.push(
      // Keyboard frame at x=1.15, z=0.58
      { geometry: new RoundedBoxGeometry(0.42, 0.014, 0.14, 2, 0.004), position: [1.15, deskTopY + 0.011, 0.58] },
      // Mouse body beside keyboard at x=1.48, z=0.58
      { geometry: new RoundedBoxGeometry(0.06, 0.028, 0.1, 2, 0.012), position: [1.48, deskTopY + 0.018, 0.58] },
      // Headset stand moved to x=0.45, z=0.25
      { geometry: new THREE.CylinderGeometry(0.052, 0.055, 0.01, 20), position: [0.45, deskTopY + 0.005, 0.25] },
      { geometry: new THREE.CylinderGeometry(0.009, 0.009, 0.24, 12), position: [0.45, deskTopY + 0.125, 0.25] },
      { geometry: new THREE.BoxGeometry(0.026, 0.012, 0.045), position: [0.45, deskTopY + 0.245, 0.25] },
      // Wall B Floating Shelf + Collectible 1 (kept intact)
      { geometry: new THREE.BoxGeometry(0.2, 0.03, 0.9), position: [0.12, 1.38, 1.25] },
      { geometry: new THREE.BoxGeometry(0.06, 0.09, 0.06), position: [0.12, 1.44, 0.96] },
      { geometry: new THREE.BoxGeometry(0.046, 0.046, 0.046), position: [0.12, 1.508, 0.96] }
    );

    // Wall A Portrait White-Oak Frame (0.45 x 0.62, flush to Wall A at same y=1.88 height beside hexagon cluster)
    const posterW = 0.45;
    const posterH = 0.62;
    const frameRim = 0.02;
    const posterCx = 0.38;
    const posterCy = 1.88;
    const posterCz = 0.013;
    const whiteOakFrameGeo = buildMergedGeometry([
      { geometry: new THREE.BoxGeometry(posterW, frameRim, 0.022), position: [posterCx, posterCy + (posterH - frameRim) / 2, posterCz] },
      { geometry: new THREE.BoxGeometry(posterW, frameRim, 0.022), position: [posterCx, posterCy - (posterH - frameRim) / 2, posterCz] },
      { geometry: new THREE.BoxGeometry(frameRim, posterH - frameRim * 2, 0.022), position: [posterCx - (posterW - frameRim) / 2, posterCy, posterCz] },
      { geometry: new THREE.BoxGeometry(frameRim, posterH - frameRim * 2, 0.022), position: [posterCx + (posterW - frameRim) / 2, posterCy, posterCz] },
    ]);

    // 3. White mid-tower PC Case (#e6e6ea): 0.21 (x) x 0.46 (y) x 0.45 (z) at x=2.05, z=0.45
    // All static white parts merged into ONE white mesh; panoramic glass on +z and -x reveals interior
    const pcX = 2.05;
    const pcZ = 0.45;
    const matteWhiteParts: GeometryPart[] = [
      // White bottom floor chassis & 4 molded feet
      { geometry: new RoundedBoxGeometry(0.21, 0.024, 0.45, 2, 0.006), position: [pcX, deskTopY + 0.022, pcZ] },
      { geometry: new THREE.BoxGeometry(0.032, 0.01, 0.042), position: [pcX - 0.075, deskTopY + 0.005, pcZ - 0.18] },
      { geometry: new THREE.BoxGeometry(0.032, 0.01, 0.042), position: [pcX + 0.075, deskTopY + 0.005, pcZ - 0.18] },
      { geometry: new THREE.BoxGeometry(0.032, 0.01, 0.042), position: [pcX - 0.075, deskTopY + 0.005, pcZ + 0.18] },
      { geometry: new THREE.BoxGeometry(0.032, 0.01, 0.042), position: [pcX + 0.075, deskTopY + 0.005, pcZ + 0.18] },
      // White sleek PSU shroud inside lower chamber
      { geometry: new RoundedBoxGeometry(0.175, 0.088, 0.31, 2, 0.006), position: [pcX + 0.006, deskTopY + 0.074, pcZ - 0.055] },
      // Solid white back (-z) panel & solid white right (+x) panel
      { geometry: new RoundedBoxGeometry(0.21, 0.445, 0.022, 2, 0.007), position: [pcX, deskTopY + 0.237, pcZ - 0.214] },
      { geometry: new RoundedBoxGeometry(0.022, 0.445, 0.45, 2, 0.007), position: [pcX + 0.094, deskTopY + 0.237, pcZ] },
      // Top white perimeter roof frame leaving center opening for dot-mesh grille CanvasTexture
      { geometry: new RoundedBoxGeometry(0.032, 0.02, 0.45, 2, 0.006), position: [pcX - 0.089, deskTopY + 0.45, pcZ] },
      { geometry: new RoundedBoxGeometry(0.032, 0.02, 0.45, 2, 0.006), position: [pcX + 0.089, deskTopY + 0.45, pcZ] },
      { geometry: new RoundedBoxGeometry(0.21, 0.02, 0.065), position: [pcX, deskTopY + 0.45, pcZ - 0.192] },
      { geometry: new RoundedBoxGeometry(0.21, 0.02, 0.085), position: [pcX, deskTopY + 0.45, pcZ + 0.182] },
      // Front-right & back-left clean white structural pillars
      { geometry: new RoundedBoxGeometry(0.024, 0.435, 0.024), position: [pcX + 0.093, deskTopY + 0.237, pcZ + 0.213] },
      { geometry: new THREE.BoxGeometry(0.012, 0.425, 0.012), position: [pcX - 0.098, deskTopY + 0.237, pcZ + 0.218] },
      // Small white power button bezel on top front edge
      { geometry: new THREE.CylinderGeometry(0.014, 0.014, 0.005, 16), position: [pcX - 0.05, deskTopY + 0.461, pcZ + 0.19] },
      // Sleek minimal logo bar strip on monitor bottom bezel
      ...transformParts(
        [{ geometry: new THREE.BoxGeometry(0.065, 0.004, 0.003), position: [0, -0.204, 0.0038] }],
        mainMonitorPos,
        [monitorTiltX, 0, 0]
      ),
    ];

    // 4. Dark tempered glass panels merged into ONE glass mesh (visible on +z front AND -x user side)
    const pcGlassGeo = buildMergedGeometry([
      { geometry: new THREE.PlaneGeometry(0.185, 0.42), position: [pcX, deskTopY + 0.237, pcZ + 0.223] },
      {
        geometry: new THREE.PlaneGeometry(0.42, 0.42),
        position: [pcX - 0.103, deskTopY + 0.237, pcZ],
        rotation: [0, -Math.PI / 2, 0],
      },
    ]);

    // 5. Dark metallic internals & chair chassis metal
    const darkMetalParts: GeometryPart[] = [
      // Dark motherboard plane inside PC on +x tray + dark glass perimeter bezel gasket
      { geometry: new THREE.BoxGeometry(0.012, 0.31, 0.26), position: [pcX + 0.076, deskTopY + 0.265, pcZ - 0.03] },
      { geometry: new THREE.BoxGeometry(0.148, 0.008, 0.324), position: [pcX, deskTopY + 0.454, pcZ - 0.015] },
      // Graphics card body: 0.30 (z) x 0.05 (y) x 0.12 (x) horizontally mounted below CPU
      { geometry: new RoundedBoxGeometry(0.115, 0.048, 0.3, 2, 0.005), position: [pcX + 0.012, deskTopY + 0.205, pcZ - 0.02] },
      // CPU cooler block + center hub
      { geometry: new RoundedBoxGeometry(0.048, 0.09, 0.09, 2, 0.008), position: [pcX + 0.045, deskTopY + 0.325, pcZ - 0.045] },
      {
        geometry: new THREE.CylinderGeometry(0.012, 0.012, 0.014, 14),
        position: [pcX + 0.019, deskTopY + 0.325, pcZ - 0.045],
        rotation: [0, 0, Math.PI / 2],
      },
      // Open-frame vertical intake mounting rails + 3 dark circular fan shroud frames & motor hubs (keeps GPU/CPU visible inside)
      { geometry: new THREE.BoxGeometry(0.012, 0.39, 0.012), position: [pcX - 0.064, deskTopY + 0.26, pcZ + 0.165] },
      { geometry: new THREE.BoxGeometry(0.012, 0.39, 0.012), position: [pcX + 0.064, deskTopY + 0.26, pcZ + 0.165] },
      ...[0.38, 0.26, 0.14].map((fy) => ({
        geometry: new THREE.CylinderGeometry(0.054, 0.054, 0.02, 22, 1, true),
        position: [pcX, deskTopY + fy, pcZ + 0.165] as [number, number, number],
        rotation: [Math.PI / 2, 0, 0] as [number, number, number],
      })),
      ...[0.38, 0.26, 0.14].map((fy) => ({
        geometry: new THREE.CylinderGeometry(0.015, 0.015, 0.016, 14),
        position: [pcX, deskTopY + fy, pcZ + 0.168] as [number, number, number],
        rotation: [Math.PI / 2, 0, 0] as [number, number, number],
      })),
      // 2 GPU fan motor hubs under GPU
      { geometry: new THREE.CylinderGeometry(0.012, 0.012, 0.012, 12), position: [pcX + 0.012, deskTopY + 0.178, pcZ - 0.075] },
      { geometry: new THREE.CylinderGeometry(0.012, 0.012, 0.012, 12), position: [pcX + 0.012, deskTopY + 0.178, pcZ + 0.035] },
      // Chair mechanical under-seat hub & neatly tucked spine recline bracket (no protruding bottom block)
      { geometry: new THREE.BoxGeometry(0.18, 0.045, 0.18), position: [chairPosition[0], 0.41, chairPosition[2]] },
      { geometry: new THREE.BoxGeometry(0.065, 0.032, 0.2), position: [chairPosition[0], 0.418, chairPosition[2] + 0.12] },
      {
        geometry: new THREE.BoxGeometry(0.06, 0.11, 0.032),
        position: [chairPosition[0], 0.47, chairPosition[2] + 0.218],
        rotation: [0.12, 0, 0],
      },
      // Chair armrest lower cross bracket & vertical 4D posts (0.04 x 0.20)
      { geometry: new THREE.BoxGeometry(0.57, 0.025, 0.045), position: [chairPosition[0], 0.43, chairPosition[2] - 0.02] },
      { geometry: new THREE.BoxGeometry(0.04, 0.22, 0.045), position: [chairPosition[0] - 0.28, 0.56, chairPosition[2] - 0.02] },
      { geometry: new THREE.BoxGeometry(0.04, 0.22, 0.045), position: [chairPosition[0] + 0.28, 0.56, chairPosition[2] - 0.02] },
      // Gas lift cylinder (radius 0.025, height 0.30) + cover cylinder (radius 0.045) + 5-star central hub
      { geometry: new THREE.CylinderGeometry(0.025, 0.025, 0.3, 14), position: [chairPosition[0], 0.25, chairPosition[2]] },
      { geometry: new THREE.CylinderGeometry(0.045, 0.048, 0.16, 16), position: [chairPosition[0], 0.17, chairPosition[2]] },
      { geometry: new THREE.CylinderGeometry(0.056, 0.062, 0.05, 16), position: [chairPosition[0], 0.095, chairPosition[2]] },
    ];

    // 6. Sculpted Racing Chair Black Parts (#141418) + Chair Red Parts (#c1121f)
    const cx = chairPosition[0];
    const cz = chairPosition[2];
    const chairBlackParts: GeometryPart[] = [
      // Seat pan RoundedBox 0.50 x 0.09 x 0.50 at seat height y=0.47, radius 0.03
      { geometry: new RoundedBoxGeometry(0.5, 0.09, 0.5, 3, 0.03), position: [cx, 0.47, cz] },
      // Raised thigh side bolsters (0.07 wide x 0.06 tall) along left & right edges
      {
        geometry: new RoundedBoxGeometry(0.07, 0.06, 0.47, 2, 0.022),
        position: [cx - 0.215, 0.51, cz],
        rotation: [0, 0, -0.15],
      },
      {
        geometry: new RoundedBoxGeometry(0.07, 0.06, 0.47, 2, 0.022),
        position: [cx + 0.215, 0.51, cz],
        rotation: [0, 0, 0.15],
      },
      // 4D Armrest pads (0.08 x 0.035 x 0.27 at y=0.70)
      { geometry: new RoundedBoxGeometry(0.08, 0.035, 0.27, 2, 0.012), position: [cx - 0.28, 0.695, cz - 0.02] },
      { geometry: new RoundedBoxGeometry(0.08, 0.035, 0.27, 2, 0.012), position: [cx + 0.28, 0.695, cz - 0.02] },
    ];

    // Backrest reclined backward (+0.12 rad around X so top leans away toward +Z)
    const backrestOrigin: [number, number, number] = [cx, 0.49, cz + 0.22];
    const backrestRot: [number, number, number] = [0.12, 0, 0];

    chairBlackParts.push(
      ...transformParts(
        [
          // Continuous racing bucket backrest: lower 0.46 x 0.40 x 0.09 blending seamlessly into upper 0.48 x 0.50 x 0.09 + tapered crown
          { geometry: new RoundedBoxGeometry(0.46, 0.42, 0.09, 3, 0.03), position: [0, 0.21, 0] },
          { geometry: new RoundedBoxGeometry(0.47, 0.48, 0.09, 3, 0.032), position: [0, 0.57, 0] },
          { geometry: new RoundedBoxGeometry(0.34, 0.14, 0.088, 3, 0.036), position: [0, 0.79, 0] },
          // Sculpted rear racing spine shell (eliminates flat-plank rear silhouette) + shoulder belt bezels
          { geometry: new RoundedBoxGeometry(0.28, 0.72, 0.034, 3, 0.016), position: [0, 0.45, 0.036] },
          { geometry: new RoundedBoxGeometry(0.075, 0.055, 0.098, 2, 0.014), position: [-0.095, 0.65, 0] },
          { geometry: new RoundedBoxGeometry(0.075, 0.055, 0.098, 2, 0.014), position: [0.095, 0.65, 0] },
          // Lower waist side bolsters
          {
            geometry: new RoundedBoxGeometry(0.075, 0.36, 0.1, 2, 0.024),
            position: [-0.21, 0.2, -0.038],
            rotation: [0, 0.24, 0],
          },
          {
            geometry: new RoundedBoxGeometry(0.075, 0.36, 0.1, 2, 0.024),
            position: [0.21, 0.2, -0.038],
            rotation: [0, -0.24, 0],
          },
          // Upper shoulder side wings curved forward 0.05
          {
            geometry: new RoundedBoxGeometry(0.085, 0.44, 0.11, 2, 0.025),
            position: [-0.22, 0.56, -0.045],
            rotation: [0, 0.28, 0],
          },
          {
            geometry: new RoundedBoxGeometry(0.085, 0.44, 0.11, 2, 0.025),
            position: [0.22, 0.56, -0.045],
            rotation: [0, -0.28, 0],
          },
          // Lumbar pillow body (red-black: 0.26 x 0.12 x 0.07)
          { geometry: new RoundedBoxGeometry(0.26, 0.12, 0.07, 3, 0.026), position: [0, 0.14, -0.068] },
          // Headrest retention strap around upper back
          { geometry: new THREE.BoxGeometry(0.31, 0.026, 0.104), position: [0, 0.74, -0.005] },
        ],
        backrestOrigin,
        backrestRot
      )
    );

    const chairRedParts: GeometryPart[] = [
      // Seat red center insert (0.22 wide)
      { geometry: new RoundedBoxGeometry(0.22, 0.028, 0.46, 2, 0.012), position: [cx, 0.506, cz] },
      ...transformParts(
        [
          // Backrest red center racing stripe & subtle rear racing spine stripe
          { geometry: new RoundedBoxGeometry(0.14, 0.78, 0.024, 2, 0.008), position: [0, 0.44, -0.04] },
          { geometry: new RoundedBoxGeometry(0.048, 0.62, 0.014, 2, 0.005), position: [0, 0.45, 0.05] },
          // Red piping lines along shoulder wings & waist bolsters
          {
            geometry: new RoundedBoxGeometry(0.016, 0.4, 0.022),
            position: [-0.188, 0.56, -0.075],
            rotation: [0, 0.28, 0],
          },
          {
            geometry: new RoundedBoxGeometry(0.016, 0.4, 0.022),
            position: [0.188, 0.56, -0.075],
            rotation: [0, -0.28, 0],
          },
          {
            geometry: new RoundedBoxGeometry(0.016, 0.3, 0.022),
            position: [-0.18, 0.2, -0.068],
            rotation: [0, 0.24, 0],
          },
          {
            geometry: new RoundedBoxGeometry(0.016, 0.3, 0.022),
            position: [0.18, 0.2, -0.068],
            rotation: [0, -0.24, 0],
          },
          // Red Headrest pillow 0.30 x 0.13 x 0.09 at top
          { geometry: new RoundedBoxGeometry(0.3, 0.13, 0.09, 3, 0.036), position: [0, 0.74, -0.068] },
          // Red center accent on lumbar pillow
          { geometry: new RoundedBoxGeometry(0.14, 0.072, 0.074, 2, 0.016), position: [0, 0.14, -0.07] },
        ],
        backrestOrigin,
        backrestRot
      ),
    ];

    // 7. Dark Rubber & Props: Desk feet, Mousepad (0.9x0.35), Headset pads, Controller at (1.9, 0.735), 2 GPU Curved Cables
    const gpuCable1 = new THREE.CatmullRomCurve3([
      new THREE.Vector3(pcX + 0.01, deskTopY + 0.115, pcZ - 0.02),
      new THREE.Vector3(pcX - 0.045, deskTopY + 0.145, pcZ + 0.02),
      new THREE.Vector3(pcX - 0.038, deskTopY + 0.185, pcZ + 0.01),
      new THREE.Vector3(pcX + 0.005, deskTopY + 0.205, pcZ + 0.0),
    ]);
    const gpuCable2 = new THREE.CatmullRomCurve3([
      new THREE.Vector3(pcX + 0.01, deskTopY + 0.115, pcZ + 0.01),
      new THREE.Vector3(pcX - 0.042, deskTopY + 0.148, pcZ + 0.05),
      new THREE.Vector3(pcX - 0.035, deskTopY + 0.188, pcZ + 0.04),
      new THREE.Vector3(pcX + 0.005, deskTopY + 0.205, pcZ + 0.03),
    ]);

    const darkPropsParts: GeometryPart[] = [
      // Small rubber desk feet under floor bars (4 corners)
      { geometry: new THREE.CylinderGeometry(0.03, 0.032, 0.01, 14), position: [0.12, 0.005, 0.12] },
      { geometry: new THREE.CylinderGeometry(0.03, 0.032, 0.01, 14), position: [0.12, 0.005, 0.74] },
      { geometry: new THREE.CylinderGeometry(0.03, 0.032, 0.01, 14), position: [2.18, 0.005, 0.12] },
      { geometry: new THREE.CylinderGeometry(0.03, 0.032, 0.01, 14), position: [2.18, 0.005, 0.74] },
      // Large mousepad 0.90 x 0.35 centered x=1.15, z=0.58
      { geometry: new THREE.BoxGeometry(0.9, 0.004, 0.35), position: [1.15, deskTopY + 0.002, 0.58] },
      // Headset on stand moved to x=0.45, z=0.25
      { geometry: new THREE.TorusGeometry(0.068, 0.011, 10, 22, Math.PI), position: [0.45, deskTopY + 0.18, 0.25] },
      {
        geometry: new THREE.CylinderGeometry(0.036, 0.036, 0.026, 16),
        position: [0.382, deskTopY + 0.175, 0.25],
        rotation: [0, 0, Math.PI / 2],
      },
      {
        geometry: new THREE.CylinderGeometry(0.036, 0.036, 0.026, 16),
        position: [0.518, deskTopY + 0.175, 0.25],
        rotation: [0, 0, Math.PI / 2],
      },
      // 2 Curved GPU PSU power cables inside PC case
      { geometry: new THREE.TubeGeometry(gpuCable1, 14, 0.0055, 8, false) },
      { geometry: new THREE.TubeGeometry(gpuCable2, 14, 0.0055, 8, false) },
    ];

    // 8. Collectible figures on Wall B shelf (kept intact) + headset trim
    const accentDecorParts: GeometryPart[] = [
      { geometry: new THREE.CylinderGeometry(0.035, 0.04, 0.022, 14), position: [0.12, 1.406, 1.25] },
      { geometry: new THREE.OctahedronGeometry(0.042, 0), position: [0.12, 1.47, 1.25] },
      { geometry: new THREE.CylinderGeometry(0.032, 0.036, 0.05, 14), position: [0.12, 1.42, 1.54] },
      { geometry: new THREE.SphereGeometry(0.032, 14, 12), position: [0.12, 1.475, 1.54] },
      {
        geometry: new THREE.CylinderGeometry(0.038, 0.038, 0.005, 16),
        position: [0.368, deskTopY + 0.175, 0.25],
        rotation: [0, 0, Math.PI / 2],
      },
      {
        geometry: new THREE.CylinderGeometry(0.038, 0.038, 0.005, 16),
        position: [0.532, deskTopY + 0.175, 0.25],
        rotation: [0, 0, Math.PI / 2],
      },
    ];

    // Interactive Game Controller (Resume) — merged vertex-colored geometry scaled 1.4x on desk front edge
    const controllerGeo = buildMergedColoredGeometry([
      { geometry: new RoundedBoxGeometry(0.14, 0.024, 0.08, 2, 0.01), position: [0, 0.012, 0], color: '#171920' },
      {
        geometry: new RoundedBoxGeometry(0.038, 0.022, 0.072, 2, 0.01),
        position: [-0.055, 0.011, 0.032],
        rotation: [0, 0.28, 0],
        color: '#171920',
      },
      {
        geometry: new RoundedBoxGeometry(0.038, 0.022, 0.072, 2, 0.01),
        position: [0.055, 0.011, 0.032],
        rotation: [0, -0.28, 0],
        color: '#171920',
      },
      { geometry: new THREE.CylinderGeometry(0.01, 0.01, 0.008, 12), position: [-0.025, 0.026, -0.008], color: '#272a35' },
      { geometry: new THREE.CylinderGeometry(0.01, 0.01, 0.008, 12), position: [0.025, 0.026, 0.01], color: '#272a35' },
      { geometry: new THREE.CylinderGeometry(0.009, 0.009, 0.004, 12), position: [-0.025, 0.031, -0.008], color: '#c084fc' },
      { geometry: new THREE.CylinderGeometry(0.009, 0.009, 0.004, 12), position: [0.025, 0.031, 0.01], color: '#c084fc' },
      // D-pad + Home button + ABXY accents
      { geometry: new THREE.CylinderGeometry(0.01, 0.01, 0.004, 8), position: [-0.026, 0.025, 0.014], color: '#334155' },
      { geometry: new THREE.CylinderGeometry(0.0055, 0.0055, 0.004, 12), position: [0, 0.025, -0.016], color: '#38bdf8' },
      { geometry: new THREE.SphereGeometry(0.004, 8, 8), position: [0.035, 0.025, -0.012], color: '#3b82f6' },
      { geometry: new THREE.SphereGeometry(0.004, 8, 8), position: [0.042, 0.025, -0.005], color: '#ef4444' },
      { geometry: new THREE.SphereGeometry(0.004, 8, 8), position: [0.035, 0.025, 0.002], color: '#22c55e' },
      { geometry: new THREE.SphereGeometry(0.004, 8, 8), position: [0.028, 0.025, -0.005], color: '#eab308' },
    ]);

    // 9. Static RGB Emissive Strips (under-desk front LED, mousepad perimeter, keyboard backlight, mouse dot, PC front & GPU edge strips)
    const rgbStripParts: GeometryPart[] = [
      // Under-desk front LED strip
      { geometry: new THREE.BoxGeometry(2.14, 0.01, 0.014), position: [1.15, underDeskY - 0.006, 0.816] },
      // Mousepad 0.90 x 0.35 perimeter RGB strip at [1.15, 0.752, 0.58]
      { geometry: new THREE.BoxGeometry(0.906, 0.004, 0.004), position: [1.15, deskTopY + 0.002, 0.756] },
      { geometry: new THREE.BoxGeometry(0.906, 0.004, 0.004), position: [1.15, deskTopY + 0.002, 0.404] },
      { geometry: new THREE.BoxGeometry(0.004, 0.004, 0.354), position: [0.699, deskTopY + 0.002, 0.58] },
      { geometry: new THREE.BoxGeometry(0.004, 0.004, 0.354), position: [1.601, deskTopY + 0.002, 0.58] },
      // Keyboard RGB backlight layer
      { geometry: new THREE.BoxGeometry(0.402, 0.003, 0.122), position: [1.15, deskTopY + 0.0185, 0.58] },
      // Mouse RGB dot
      { geometry: new THREE.BoxGeometry(0.012, 0.003, 0.014), position: [1.48, deskTopY + 0.032, 0.595] },
      // PC case front intake accent strip & GPU side edge RGB strip
      { geometry: new THREE.BoxGeometry(0.008, 0.42, 0.008), position: [pcX + 0.095, deskTopY + 0.237, pcZ + 0.226] },
      { geometry: new THREE.BoxGeometry(0.005, 0.01, 0.27), position: [pcX - 0.047, deskTopY + 0.205, pcZ - 0.02] },
    ];

    // 10. Instanced Chair Templates (5-star arm + wheel/fork caster) & Spinning PC RGB Fan Templates
    const starArmGeo = new RoundedBoxGeometry(0.04, 0.03, 0.34, 2, 0.008);
    const casterGeo = buildMergedGeometry([
      { geometry: new THREE.SphereGeometry(0.03, 14, 10), position: [0, 0.03, 0] },
      { geometry: new THREE.BoxGeometry(0.026, 0.05, 0.032), position: [0, 0.056, 0] },
    ]);

    const frontFanGeo = buildMergedGeometry([
      { geometry: new THREE.RingGeometry(0.034, 0.05, 22) },
      { geometry: new THREE.PlaneGeometry(0.068, 0.007) },
      { geometry: new THREE.PlaneGeometry(0.007, 0.068) },
    ]);
    const gpuFanGeo = buildMergedGeometry([
      { geometry: new THREE.RingGeometry(0.026, 0.04, 20) },
      { geometry: new THREE.PlaneGeometry(0.054, 0.006) },
      { geometry: new THREE.PlaneGeometry(0.006, 0.054) },
    ]);
    const cpuFanGeo = buildMergedGeometry([
      { geometry: new THREE.RingGeometry(0.024, 0.038, 20) },
      { geometry: new THREE.PlaneGeometry(0.05, 0.006) },
      { geometry: new THREE.PlaneGeometry(0.006, 0.05) },
    ]);

    const nameplateGeo = createDeskNameplateGeometry();

    return {
      walnutDeskGeo,
      whiteOakFrameGeo,
      matteBlackGeo: buildMergedGeometry(matteBlackParts),
      matteWhiteGeo: buildMergedGeometry(matteWhiteParts),
      pcGlassGeo,
      darkMetalGeo: buildMergedGeometry(darkMetalParts),
      chairBlackGeo: buildMergedGeometry(chairBlackParts),
      chairRedGeo: buildMergedGeometry(chairRedParts),
      darkPropsGeo: buildMergedGeometry(darkPropsParts),
      accentDecorGeo: buildMergedGeometry(accentDecorParts),
      controllerGeo,
      rgbStripsGeo: buildMergedGeometry(rgbStripParts),
      starArmGeo,
      casterGeo,
      frontFanGeo,
      gpuFanGeo,
      cpuFanGeo,
      nameplateGeo,
    };
  }, [deskHeight, deskThickness, chairPosition, mainMonitorPos, monitorTiltX, screenArcWidth, screenHeight]);

  const materials = useMemo(() => {
    return {
      walnutDesk: new THREE.MeshStandardMaterial({
        color: '#4a3426',
        map: walnutTex,
        roughness: 0.7,
        metalness: 0.04,
      }),
      whiteOakFrame: new THREE.MeshStandardMaterial({
        color: '#c9a574',
        roughness: 0.72,
        metalness: 0.04,
      }),
      matteBlack: new THREE.MeshStandardMaterial({
        color: '#111114',
        roughness: 0.55,
        metalness: 0.25,
      }),
      matteWhite: new THREE.MeshStandardMaterial({
        color: '#e6e6ea',
        roughness: 0.42,
        metalness: 0.08,
      }),
      pcGlass: new THREE.MeshStandardMaterial({
        color: '#0e1420',
        transparent: true,
        opacity: 0.22,
        roughness: 0.05,
        metalness: 0.45,
        side: THREE.DoubleSide,
      }),
      pcTopMesh: new THREE.MeshStandardMaterial({
        map: topMeshTex,
        roughness: 0.65,
        metalness: 0.18,
      }),
      darkMetal: new THREE.MeshStandardMaterial({
        color: '#252730',
        roughness: 0.38,
        metalness: 0.78,
      }),
      chairBlack: new THREE.MeshStandardMaterial({
        color: '#141418',
        roughness: 0.74,
        metalness: 0.06,
      }),
      chairRed: new THREE.MeshStandardMaterial({
        color: '#c1121f',
        roughness: 0.5,
        metalness: 0.1,
      }),
      darkProps: new THREE.MeshStandardMaterial({
        color: '#14151a',
        roughness: 0.78,
        metalness: 0.08,
      }),
      accentDecor: new THREE.MeshStandardMaterial({
        color: '#c084fc',
        roughness: 0.35,
        metalness: 0.65,
      }),
      controllerMat: new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.45,
        metalness: 0.2,
      }),
      keyboardGrid: new THREE.MeshStandardMaterial({
        color: '#ffffff',
        map: keyboardTex,
        roughness: 0.65,
        metalness: 0.12,
      }),
      keycap: new THREE.MeshStandardMaterial({
        color: '#1f232d',
        roughness: 0.55,
        metalness: 0.15,
      }),
      caster: new THREE.MeshStandardMaterial({
        color: '#18191e',
        roughness: 0.6,
        metalness: 0.4,
      }),
      hexPanel: new THREE.MeshBasicMaterial({
        color: '#ffffff',
        toneMapped: false,
      }),
      hexRim: new THREE.MeshStandardMaterial({
        color: '#1f2430',
        roughness: 0.45,
        metalness: 0.4,
      }),
      posterFace: new THREE.MeshStandardMaterial({
        map: posterTex,
        roughness: 0.45,
        metalness: 0.05,
      }),
      nameplateMat: new THREE.MeshStandardMaterial({
        map: nameplateTex ?? undefined,
        roughness: 0.36,
        metalness: 0.45,
      }),
      embroideryMat: new THREE.MeshStandardMaterial({
        map: embroideryTex ?? undefined,
        transparent: true,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
        depthWrite: false,
        roughness: 0.88,
        metalness: 0.02,
      }),
      powerDotOn: new THREE.MeshBasicMaterial({ color: '#38bdf8', toneMapped: false }),
      powerDotOff: new THREE.MeshBasicMaterial({ color: '#7f1d1d', toneMapped: false }),
      rgbEmissive: new THREE.MeshBasicMaterial({ color: '#ff0000', toneMapped: false }),
    };
  }, [walnutTex, topMeshTex, keyboardTex, posterTex, nameplateTex, embroideryTex]);

  useLayoutEffect(() => {
    // 1. 28 Hexagon Nanoleaf panels + dark bezels on Wall A above desk (clear of Portrait & High Score Board)
    if (hexMeshRef.current && hexRimRef.current) {
      const hexR = 0.08;
      const dx = Math.sqrt(3) * hexR + 0.011;
      const dy = 1.5 * hexR + 0.011;
      const clusterCx = 1.58;
      const clusterCy = 1.98;
      const initialBright = getThemedHexBrightness();

      for (let i = 0; i < hexCount; i++) {
        const [col, row] = HEX_AXIAL_OFFSETS[i % HEX_AXIAL_OFFSETS.length];
        const px = clusterCx + col * dx + ((Math.abs(row) & 1) === 1 ? dx * 0.5 : 0);
        const py = clusterCy + row * dy;

        _tempObj.position.set(px, py, 0.012);
        _tempObj.rotation.set(Math.PI / 2, 0, 0);
        _tempObj.scale.set(1, 1, 1);
        _tempObj.updateMatrix();
        hexRimRef.current.setMatrixAt(i, _tempObj.matrix);

        _tempObj.position.set(px, py, 0.021);
        _tempObj.updateMatrix();
        hexMeshRef.current.setMatrixAt(i, _tempObj.matrix);

        _hexColor.setHSL((i * 0.045) % 1, 0.88, 0.54).multiplyScalar(initialBright);
        hexMeshRef.current.setColorAt(i, _hexColor);
      }
      hexRimRef.current.instanceMatrix.needsUpdate = true;
      hexRimRef.current.computeBoundingSphere();
      hexMeshRef.current.instanceMatrix.needsUpdate = true;
      hexMeshRef.current.computeBoundingSphere();
      if (hexMeshRef.current.instanceColor) hexMeshRef.current.instanceColor.needsUpdate = true;
    }

    // 2. 64 Keyboard 3D Keycaps InstancedMesh centered at [1.15, deskHeight+0.021, 0.58]
    if (keysMeshRef.current) {
      const rows = 4;
      const cols = 16;
      const startX = 1.15 - 0.186;
      const startZ = 0.58 - 0.042;
      let idx = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          _tempObj.position.set(startX + c * 0.0245, deskHeight + 0.021, startZ + r * 0.028);
          _tempObj.rotation.set(0, 0, 0);
          _tempObj.scale.set(1, 1, 1);
          _tempObj.updateMatrix();
          keysMeshRef.current.setMatrixAt(idx++, _tempObj.matrix);
        }
      }
      keysMeshRef.current.instanceMatrix.needsUpdate = true;
    }

    // 3. Chair 5-star base arms & 5 casters InstancedMeshes around chairPosition
    if (starArmsMeshRef.current) {
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2;
        _tempObj.position.set(
          chairPosition[0] + Math.sin(ang) * 0.16,
          0.088,
          chairPosition[2] + Math.cos(ang) * 0.16
        );
        _tempObj.rotation.set(0, ang, 0);
        _tempObj.scale.set(1, 1, 1);
        _tempObj.updateMatrix();
        starArmsMeshRef.current.setMatrixAt(i, _tempObj.matrix);
      }
      starArmsMeshRef.current.instanceMatrix.needsUpdate = true;
    }

    if (castersMeshRef.current) {
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2;
        _tempObj.position.set(
          chairPosition[0] + Math.sin(ang) * 0.305,
          0,
          chairPosition[2] + Math.cos(ang) * 0.305
        );
        _tempObj.rotation.set(0, ang, 0);
        _tempObj.scale.set(1, 1, 1);
        _tempObj.updateMatrix();
        castersMeshRef.current.setMatrixAt(i, _tempObj.matrix);
      }
      castersMeshRef.current.instanceMatrix.needsUpdate = true;
    }

    freezeStaticMatrices(rootRef.current);
  }, [chairPosition, deskHeight, hexCount, isLowQuality]);

  useEffect(() => {
    return () => {
      merged.walnutDeskGeo.dispose();
      merged.whiteOakFrameGeo.dispose();
      merged.matteBlackGeo.dispose();
      merged.matteWhiteGeo.dispose();
      merged.pcGlassGeo.dispose();
      merged.darkMetalGeo.dispose();
      merged.chairBlackGeo.dispose();
      merged.chairRedGeo.dispose();
      merged.darkPropsGeo.dispose();
      merged.accentDecorGeo.dispose();
      merged.controllerGeo.dispose();
      merged.rgbStripsGeo.dispose();
      merged.starArmGeo.dispose();
      merged.casterGeo.dispose();
      merged.frontFanGeo.dispose();
      merged.gpuFanGeo.dispose();
      merged.cpuFanGeo.dispose();
      merged.nameplateGeo.dispose();
      Object.values(materials).forEach((m) => m.dispose());
      staticDesktopTexture?.dispose();
      bootTexture?.dispose();
      walnutTex?.dispose();
      topMeshTex?.dispose();
      keyboardTex?.dispose();
      posterTex?.dispose();
      nameplateTex?.dispose();
      embroideryTex?.dispose();
    };
  }, [
    merged,
    materials,
    staticDesktopTexture,
    bootTexture,
    walnutTex,
    topMeshTex,
    keyboardTex,
    posterTex,
    nameplateTex,
    embroideryTex,
  ]);

  // Existing single useFrame RGB controller, hex update, fan spin, and boot animation
  // Throttled / paused while PC mode overlay is open for higher DOM/compositor FPS
  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    const pcState = usePcStore.getState();
    const isPcOverlayOpen =
      pcState.pcMode &&
      pcState.pcArrived &&
      !pcState.pcExiting &&
      pcState.poweredPC &&
      pcState.bootState === 'desktop';

    const time = state.clock.elapsedTime;
    const baseHue = (time * rgbSpeed) % 1;
    const rgbMat = rgbMeshRef.current?.material as THREE.MeshBasicMaterial | undefined;

    const deskMode = THEMES_CONFIG[useThemeStore.getState().theme].deskRgbMode || rgbMode;
    const deskBright = getThemedDeskRgbBrightness();
    const hexBright = getThemedHexBrightness();

    rgbTimerRef.current += dt;
    if (!isPcOverlayOpen || rgbTimerRef.current >= 0.1) {
      rgbTimerRef.current = 0;
      if (deskMode === 'off') {
        if (rgbMat) rgbMat.color.set('#000000');
        if (pointLightRef.current) pointLightRef.current.intensity = 0;
      } else {
        if (deskMode === 'rainbow') {
          _rgbColor.setHSL(baseHue, 0.9, 0.52);
        } else {
          _rgbColor.set(rgbStaticColor);
        }
        if (rgbMat) rgbMat.color.copy(_rgbColor).multiplyScalar(deskBright);
        if (pointLightRef.current) {
          pointLightRef.current.color.copy(_rgbColor);
          pointLightRef.current.intensity = pointLightIntensity * deskBright;
        }
      }
    }

    if (!isPcOverlayOpen) {
      const fanSpeed = pcState.poweredPC ? 2.8 : 0.45;
      for (let i = 0; i < 6; i++) {
        const fan = fanRefs.current[i];
        if (fan) fan.rotation.z -= dt * fanSpeed;
      }
    }

    const isPaused = useInputStore.getState().mode === 'paused';
    const isLowQuality = usePortfolioStore.getState().graphicsQuality === 'low';

    hexTimerRef.current += dt;
    const hexInterval = 0.25; // 4Hz smooth flowing gradient across all 28 hexagons
    if (!isPaused && !isLowQuality && hexTimerRef.current >= hexInterval && hexMeshRef.current) {
      hexTimerRef.current = 0;
      for (let i = 0; i < hexCount; i++) {
        if (deskMode === 'off') {
          _hexColor.set('#14161c');
        } else if (deskMode === 'static') {
          _hexColor.set(rgbStaticColor).multiplyScalar(hexBright);
        } else {
          _hexColor.setHSL((baseHue + i * 0.038) % 1, 0.88, 0.54).multiplyScalar(hexBright);
        }
        hexMeshRef.current.setColorAt(i, _hexColor);
      }
      if (hexMeshRef.current.instanceColor) {
        hexMeshRef.current.instanceColor.needsUpdate = true;
      }
    }

    if (pcState.poweredPC && pcState.bootState === 'booting') {
      bootElapsedRef.current += dt;
      if (redrawBootTexture(bootTexture, bootElapsedRef.current) && bootElapsedRef.current >= OS_CONFIG.bootDuration.total) {
        pcState.setBootState('desktop');
      }
    }
  });

  const pcX = 2.05;
  const pcZ = 0.45;

  return (
    <group
      ref={rootRef}
      name="gaming-corner"
      position={[gamingCorner.sx * (width / 2), 0, gamingCorner.sz * (depth / 2)]}
      rotation={[0, rotationY, 0]}
    >
      {/* 1. Walnut Desk, Matte Black Frame / Curved Bezel / Stand, White PC Case & Wall-Oak Frame */}
      <mesh geometry={merged.walnutDeskGeo} material={materials.walnutDesk} />
      <mesh geometry={merged.whiteOakFrameGeo} material={materials.whiteOakFrame} />
      <mesh geometry={merged.matteBlackGeo} material={materials.matteBlack} />
      <mesh
        geometry={merged.matteWhiteGeo}
        material={materials.matteWhite}
        userData={{ interactive: 'pc-tower' }}
      />
      <mesh geometry={merged.darkMetalGeo} material={materials.darkMetal} />
      <mesh geometry={merged.darkPropsGeo} material={materials.darkProps} />
      <mesh geometry={merged.accentDecorGeo} material={materials.accentDecor} />
      {ROOM_CONTENT_CONFIG.wallItemsEnabled.controllerResume && (
        <mesh
          position={ROOM_CONTENT_CONFIG.controllerResume.localPosition}
          rotation={[0, ROOM_CONTENT_CONFIG.controllerResume.localRotationY, 0]}
          scale={ROOM_CONTENT_CONFIG.controllerResume.scale}
          geometry={merged.controllerGeo}
          material={materials.controllerMat}
          userData={{ interactive: 'resume' }}
        />
      )}
      <mesh ref={rgbMeshRef} geometry={merged.rgbStripsGeo} material={materials.rgbEmissive} />

      {/* 2. Single 38" 21:9 Flat Ultrawide Monitor Screen */}
      <PCScreen
        width={screenArcWidth}
        height={screenHeight}
        position={[mainMonitorPos[0], mainMonitorPos[1], mainMonitorPos[2] + 0.002]}
        rotation={[monitorTiltX, 0, 0]}
        powered={poweredPC}
        texture={bootState === 'desktop' ? staticDesktopTexture : bootTexture}
        interactiveId="pc"
      />

      {/* 3. White Mid-Tower PC Details: Tempered Glass, Top Dot-Mesh Grille, 6 Spinning RGB Fans & Power Dot */}
      <mesh
        position={[pcX, deskHeight + 0.4605, pcZ - 0.015]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={materials.pcTopMesh}
      >
        <planeGeometry args={[0.145, 0.32]} />
      </mesh>
      <mesh
        position={[pcX - 0.05, deskHeight + 0.464, pcZ + 0.19]}
        material={poweredPC ? materials.powerDotOn : materials.powerDotOff}
        userData={{ interactive: 'pc-tower' }}
      >
        <cylinderGeometry args={[0.007, 0.007, 0.003, 14]} />
      </mesh>
      {/* 3 Front Intake RGB Fan Rings (seated inside dark shroud frames at z = pcZ + 0.17) */}
      {[deskHeight + 0.38, deskHeight + 0.26, deskHeight + 0.14].map((fy, i) => (
        <mesh
          key={`front-${i}`}
          ref={(el) => {
            fanRefs.current[i] = el;
          }}
          position={[pcX, fy, pcZ + 0.172]}
          geometry={merged.frontFanGeo}
          material={materials.rgbEmissive}
          userData={{ dynamicTransform: true }}
        />
      ))}
      {/* 2 Graphics Card RGB Fan Rings */}
      {[pcZ - 0.075, pcZ + 0.035].map((fz, i) => (
        <mesh
          key={`gpu-${i}`}
          ref={(el) => {
            fanRefs.current[3 + i] = el;
          }}
          position={[pcX + 0.012, deskHeight + 0.178, fz]}
          rotation={[Math.PI / 2, 0, 0]}
          geometry={merged.gpuFanGeo}
          material={materials.rgbEmissive}
          userData={{ dynamicTransform: true }}
        />
      ))}
      {/* 1 CPU Cooler RGB Fan Ring */}
      <mesh
        ref={(el) => {
          fanRefs.current[5] = el;
        }}
        position={[pcX + 0.019, deskHeight + 0.325, pcZ - 0.045]}
        rotation={[0, -Math.PI / 2, 0]}
        geometry={merged.cpuFanGeo}
        material={materials.rgbEmissive}
        userData={{ dynamicTransform: true }}
      />
      {/* Dark Transparent Tempered Glass */}
      <mesh
        geometry={merged.pcGlassGeo}
        material={materials.pcGlass}
        userData={{ interactive: 'pc-tower' }}
      />

      {/* 4. Sculpted Racing Gaming Chair + Instanced 5-Star Base & Casters */}
      <mesh
        geometry={merged.chairBlackGeo}
        material={materials.chairBlack}
        userData={{ interactive: 'gaming-chair' }}
      />
      <mesh
        geometry={merged.chairRedGeo}
        material={materials.chairRed}
        userData={{ interactive: 'gaming-chair' }}
      />
      <instancedMesh
        ref={starArmsMeshRef}
        args={[merged.starArmGeo, materials.matteBlack, 5]}
        userData={{ interactive: 'gaming-chair' }}
      />
      <instancedMesh
        ref={castersMeshRef}
        args={[merged.casterGeo, materials.caster, 5]}
        userData={{ interactive: 'gaming-chair' }}
      />
      {!isLowQuality && (
        <group
          position={[chairPosition[0], 0.49, chairPosition[2] + 0.22]}
          rotation={[0.12, 0, 0]}
        >
          <mesh
            position={[0, 0.74, -0.115]}
            rotation={[0, Math.PI, 0]}
            material={materials.embroideryMat}
          >
            <planeGeometry args={[0.18, 0.05]} />
          </mesh>
        </group>
      )}

      {/* 4B. Front-Left Desk Nameplate (hidden in Low quality, non-interactive) */}
      {!isLowQuality && (
        <mesh
          position={[0.24, deskHeight, 0.76]}
          rotation={[0, 0.28, 0]}
          geometry={merged.nameplateGeo}
          material={materials.nameplateMat}
        />
      )}

      {/* 5. Keyboard Key Grid Deck & 64 Instanced Keycaps */}
      <mesh
        position={[1.15, deskHeight + 0.0195, 0.58]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={materials.keyboardGrid}
      >
        <planeGeometry args={[0.4, 0.12]} />
      </mesh>
      <instancedMesh ref={keysMeshRef} args={[undefined, undefined, 64]} material={materials.keycap}>
        <boxGeometry args={[0.018, 0.006, 0.018]} />
      </instancedMesh>

      {/* 6. Wall Decor: 28 Hexagon Nanoleaf InstancedMesh (+ Dark Rims) & Minimalist Moon Poster on Wall A */}
      <instancedMesh ref={hexRimRef} args={[undefined, undefined, hexCount]} material={materials.hexRim}>
        <cylinderGeometry args={[0.082, 0.082, 0.012, 6]} />
      </instancedMesh>
      <instancedMesh ref={hexMeshRef} args={[undefined, undefined, hexCount]} material={materials.hexPanel}>
        <cylinderGeometry args={[0.071, 0.071, 0.012, 6]} />
      </instancedMesh>
      <mesh position={[0.38, 1.88, 0.016]} material={materials.posterFace}>
        <planeGeometry args={[0.41, 0.58]} />
      </mesh>

      {/* 6B. Streaming Desk Hardware (Boom Mic, Ring Light, Webcam, Macro Pad & ON AIR) */}
      <StreamingSetup />

      {/* 7. Single Gaming Corner RGB PointLight */}
      <pointLight
        ref={pointLightRef}
        position={pointLightLocalPos}
        intensity={pointLightIntensity}
        distance={pointLightDistance}
        decay={pointLightDecay}
        castShadow={false}
      />
    </group>
  );
}
