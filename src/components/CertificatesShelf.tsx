'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {
  ROOM_CONTENT_CONFIG,
  SHELF_BOOKS_CONFIG,
  isWallItemVisible,
} from '@/config/roomContent';
import { usePortfolioStore } from '@/stores/portfolioStore';
import {
  buildMergedColoredGeometry,
  buildMergedGeometry,
  freezeStaticMatrices,
  type ColoredGeometryPart,
  type GeometryPart,
} from '@/utils/mergeHelpers';
import {
  applyAtlasUVsToPlane,
  BOOKS_ATLAS_WHITE_UV,
  createBooksSpineAtlasTexture,
  createCertificatesAtlas,
  getAchievementAtlasUVs,
  getBookSpineAtlasUVs,
  getCertificateAtlasUVs,
  type AtlasUVRect,
} from '@/utils/portfolioTextures';

const { upperLayout, lowerLayout, standingBooks, stackedBooks } = SHELF_BOOKS_CONFIG;

const FRAME_W = upperLayout.frameWidth;
const FRAME_H = upperLayout.frameHeight;
const FRAME_D = upperLayout.frameDepth;
const CARD_W = upperLayout.cardWidth;
const CARD_H = upperLayout.cardHeight;
const LEAN_TILT_X = -0.14; // Leans top slightly backward toward wall (-Z)
const SHELF_FRAME_Z = 0.098;
const SHELF_PLAQUE_Z = 0.098;
const STANDING_GROUP_START_X = -0.69;

export interface ShelfBookVertexRange {
  id: string;
  title: string;
  kind: 'standing' | 'stacked';
  vertexStart: number;
  vertexCount: number;
}

interface FrameLocalSpec {
  dx: number;
  shelfTopY: number;
  localZ: number;
}

const FRAME_SLOTS: ReadonlyArray<FrameLocalSpec> = upperLayout.frameDx.map((dx) => ({
  dx,
  shelfTopY: ROOM_CONTENT_CONFIG.placements.certificatesShelf.upperY + 0.015,
  localZ: SHELF_FRAME_Z,
}));

const PLAQUE_SLOTS = upperLayout.plaqueDx.map((dx) => ({
  dx,
  shelfTopY: ROOM_CONTENT_CONFIG.placements.certificatesShelf.upperY + 0.015,
  localZ: SHELF_PLAQUE_Z,
}));

function computeSlotLocalCenter(
  dx: number,
  shelfTopY: number,
  localZ: number,
  h: number
): [number, number, number] {
  const halfH = h / 2;
  const cy = shelfTopY + halfH * Math.cos(LEAN_TILT_X);
  const cz = localZ + halfH * Math.sin(LEAN_TILT_X);
  return [dx, cy, cz];
}

export function getCertificateWorldPose(index: number): {
  target: THREE.Vector3;
  cameraPos: THREE.Vector3;
} {
  const cfg = ROOM_CONTENT_CONFIG.placements.certificatesShelf;
  const slot = FRAME_SLOTS[Math.max(0, Math.min(FRAME_SLOTS.length - 1, index))];
  const [lx, ly, lz] = computeSlotLocalCenter(slot.dx, slot.shelfTopY, slot.localZ, FRAME_H);

  const localPos = new THREE.Vector3(lx, ly, lz);
  const groupEuler = new THREE.Euler(0, cfg.rotationY, 0, 'XYZ');
  localPos.applyEuler(groupEuler).add(new THREE.Vector3(...cfg.position));

  const normal = new THREE.Vector3(0, -Math.sin(LEAN_TILT_X), Math.cos(LEAN_TILT_X))
    .applyEuler(groupEuler)
    .normalize();

  const camPos = localPos.clone().addScaledVector(normal, cfg.camDistance);
  return { target: localPos, cameraPos: camPos };
}

export function getAchievementsWorldPose(): {
  target: THREE.Vector3;
  cameraPos: THREE.Vector3;
} {
  const cfg = ROOM_CONTENT_CONFIG.placements.certificatesShelf;
  const midDx = (PLAQUE_SLOTS[0].dx + PLAQUE_SLOTS[1].dx) / 2;
  const [lx, ly, lz] = computeSlotLocalCenter(
    midDx,
    PLAQUE_SLOTS[0].shelfTopY,
    PLAQUE_SLOTS[0].localZ,
    0.125
  );
  const localPos = new THREE.Vector3(lx, ly, lz);
  const groupEuler = new THREE.Euler(0, cfg.rotationY, 0, 'XYZ');
  localPos.applyEuler(groupEuler).add(new THREE.Vector3(...cfg.position));
  const normal = new THREE.Vector3(0, -Math.sin(LEAN_TILT_X), Math.cos(LEAN_TILT_X))
    .applyEuler(groupEuler)
    .normalize();
  const camPos = localPos.clone().addScaledVector(normal, cfg.camDistance);
  return { target: localPos, cameraPos: camPos };
}

const _bookColor = new THREE.Color();
const _whiteColor = new THREE.Color('#ffffff');

/**
 * Prepares a single box primitive for the merged books geometry:
 * - Spine face (+Z normal) maps to the book's slot in the spine atlas with pure white vertex color
 * - All non-spine faces map to the atlas white pixel with explicit vertexColor
 */
function prepareBookBoxPart(
  w: number,
  h: number,
  d: number,
  localOffset: THREE.Vector3,
  bookMatrix: THREE.Matrix4,
  fillHex: string,
  spineUV: AtlasUVRect | null
): THREE.BufferGeometry {
  const indexed = new THREE.BoxGeometry(w, h, d);
  const g = indexed.toNonIndexed();
  indexed.dispose();

  for (const key of Object.keys(g.attributes)) {
    if (key !== 'position' && key !== 'normal' && key !== 'uv') {
      g.deleteAttribute(key);
    }
  }

  const posAttr = g.getAttribute('position');
  const normAttr = g.getAttribute('normal');
  const uvAttr = g.getAttribute('uv');
  const count = posAttr.count;
  const colors = new Float32Array(count * 3);

  _bookColor.set(fillHex);

  for (let i = 0; i < count; i++) {
    const isSpineFace = spineUV !== null && normAttr.getZ(i) > 0.9;
    if (isSpineFace && spineUV) {
      const u = uvAttr.getX(i);
      const v = uvAttr.getY(i);
      uvAttr.setXY(
        i,
        spineUV.u0 + u * (spineUV.u1 - spineUV.u0),
        spineUV.v0 + v * (spineUV.v1 - spineUV.v0)
      );
      colors[i * 3] = _whiteColor.r;
      colors[i * 3 + 1] = _whiteColor.g;
      colors[i * 3 + 2] = _whiteColor.b;
    } else {
      uvAttr.setXY(i, BOOKS_ATLAS_WHITE_UV.u, BOOKS_ATLAS_WHITE_UV.v);
      const shade = normAttr.getY(i) > 0.9 ? 0.92 : 1.0;
      colors[i * 3] = _bookColor.r * shade;
      colors[i * 3 + 1] = _bookColor.g * shade;
      colors[i * 3 + 2] = _bookColor.b * shade;
    }
  }

  uvAttr.needsUpdate = true;
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const subMat = new THREE.Matrix4().makeTranslation(localOffset.x, localOffset.y, localOffset.z);
  const combinedMat = new THREE.Matrix4().multiplyMatrices(bookMatrix, subMat);
  g.applyMatrix4(combinedMat);
  return g;
}

function appendBookGeometry(
  targetParts: THREE.BufferGeometry[],
  w: number,
  h: number,
  d: number,
  colorHex: string,
  slotIndex: number,
  bookMatrix: THREE.Matrix4,
  isLow: boolean
): number {
  const spineUV = getBookSpineAtlasUVs(slotIndex);

  if (isLow) {
    const simple = prepareBookBoxPart(w, h, d, new THREE.Vector3(), bookMatrix, colorHex, spineUV);
    targetParts.push(simple);
    return simple.getAttribute('position').count;
  }

  const boardT = 0.0034;
  const spineD = 0.006;
  const pageW = Math.max(0.006, w - boardT * 2);
  const pageH = Math.max(0.02, h - 0.0065);
  const pageD = Math.max(0.02, d - 0.0075);

  const subGeos = [
    // Spine slab at +Z front face with full T x H spine UV
    prepareBookBoxPart(
      w,
      h,
      spineD,
      new THREE.Vector3(0, 0, d / 2 - spineD / 2),
      bookMatrix,
      colorHex,
      spineUV
    ),
    // Left hardcover board (-X) with subtle overhang over pages
    prepareBookBoxPart(
      boardT,
      h,
      d - spineD * 0.65,
      new THREE.Vector3(-(w - boardT) / 2, 0, -spineD * 0.325),
      bookMatrix,
      colorHex,
      null
    ),
    // Right hardcover board (+X)
    prepareBookBoxPart(
      boardT,
      h,
      d - spineD * 0.65,
      new THREE.Vector3((w - boardT) / 2, 0, -spineD * 0.325),
      bookMatrix,
      colorHex,
      null
    ),
    // Recessed cream paper page block visible along top (+Y), bottom (-Y) & fore-edge (-Z)
    prepareBookBoxPart(
      pageW,
      pageH,
      pageD,
      new THREE.Vector3(0, 0, -0.0018),
      bookMatrix,
      lowerLayout.pageEdgeColor,
      null
    ),
  ];

  let verts = 0;
  for (const g of subGeos) {
    verts += g.getAttribute('position').count;
    targetParts.push(g);
  }
  return verts;
}

export default function CertificatesShelf() {
  const graphicsQuality = usePortfolioStore((s) => s.graphicsQuality);
  const isLow = graphicsQuality === 'low';
  const visible = isWallItemVisible('certificatesShelf', graphicsQuality);
  const showAchievements = isWallItemVisible('achievements', graphicsQuality);

  const groupRef = useRef<THREE.Group>(null);
  const framesInstRef = useRef<THREE.InstancedMesh>(null);

  const cfg = ROOM_CONTENT_CONFIG.placements.certificatesShelf;

  const atlasTex = useMemo(
    () =>
      createCertificatesAtlas(
        ROOM_CONTENT_CONFIG.shelfFrameTotal,
        ROOM_CONTENT_CONFIG.achievements,
        CARD_W,
        CARD_H
      ),
    []
  );

  const booksAtlasTex = useMemo(
    () => createBooksSpineAtlasTexture(standingBooks, stackedBooks),
    []
  );

  const geometries = useMemo(() => {
    // 1. Two oak floating shelves (1.6m wide, 0.03 thick, 0.18 deep) merged
    const shelvesGeo = buildMergedGeometry([
      {
        geometry: new RoundedBoxGeometry(cfg.width, cfg.thickness, cfg.depth, 2, 0.004),
        position: [0, cfg.upperY, cfg.depth / 2],
      },
      {
        geometry: new RoundedBoxGeometry(cfg.width, cfg.thickness, cfg.depth, 2, 0.004),
        position: [0, cfg.lowerY, cfg.depth / 2],
      },
    ]);

    // 2. Single template for InstancedMesh certificate frames (landscape 0.26 x 0.20)
    const rim = 0.011;
    const frameTemplateGeo = buildMergedColoredGeometry([
      {
        geometry: new THREE.BoxGeometry(FRAME_W - 0.004, FRAME_H - 0.004, 0.006),
        position: [0, 0, -0.004],
        color: '#181a20',
      },
      {
        geometry: new THREE.BoxGeometry(FRAME_W - rim * 2, FRAME_H - rim * 2, 0.003),
        position: [0, 0, 0.0005],
        color: '#f4f3ef',
      },
      {
        geometry: new THREE.BoxGeometry(FRAME_W, rim, FRAME_D),
        position: [0, (FRAME_H - rim) / 2, 0],
        color: '#111318',
      },
      {
        geometry: new THREE.BoxGeometry(FRAME_W, rim, FRAME_D),
        position: [0, -(FRAME_H - rim) / 2, 0],
        color: '#111318',
      },
      {
        geometry: new THREE.BoxGeometry(rim, FRAME_H - rim * 2, FRAME_D),
        position: [-(FRAME_W - rim) / 2, 0, 0],
        color: '#111318',
      },
      {
        geometry: new THREE.BoxGeometry(rim, FRAME_H - rim * 2, FRAME_D),
        position: [(FRAME_W - rim) / 2, 0, 0],
        color: '#111318',
      },
    ]);

    // 3. Merged card faces (3 real certs -> faceIndex 0..5) + 2 achievement plaques (faceIndex 6..9)
    const cardParts: GeometryPart[] = [];
    FRAME_SLOTS.forEach((slot, idx) => {
      const plane = new THREE.PlaneGeometry(CARD_W, CARD_H);
      applyAtlasUVsToPlane(plane, getCertificateAtlasUVs(idx));
      const [cx, cy, cz] = computeSlotLocalCenter(slot.dx, slot.shelfTopY, slot.localZ, FRAME_H);
      const offsetZ = 0.0026;
      cardParts.push({
        geometry: plane,
        position: [cx, cy - Math.sin(LEAN_TILT_X) * offsetZ, cz + Math.cos(LEAN_TILT_X) * offsetZ],
        rotation: [LEAN_TILT_X, 0, 0],
      });
    });

    if (showAchievements) {
      PLAQUE_SLOTS.forEach((slot, idx) => {
        const plane = new THREE.PlaneGeometry(0.114, 0.114);
        applyAtlasUVsToPlane(plane, getAchievementAtlasUVs(idx));
        const [cx, cy, cz] = computeSlotLocalCenter(slot.dx, slot.shelfTopY, slot.localZ, 0.125);
        const offsetZ = 0.0075;
        cardParts.push({
          geometry: plane,
          position: [cx, cy - Math.sin(LEAN_TILT_X) * offsetZ, cz + Math.cos(LEAN_TILT_X) * offsetZ],
          rotation: [LEAN_TILT_X, 0, 0],
        });
      });
    }

    const cardsAndBadgesGeo = buildMergedGeometry(cardParts);

    // 4. Merged Lower Shelf Books (11 standing + 4 stacked = 15 crisp books in 1 draw call)
    const lowerTop = cfg.lowerY + cfg.thickness / 2;
    const shelfBookZ = 0.092;
    const bookGeoParts: THREE.BufferGeometry[] = [];
    const booksMeta: ShelfBookVertexRange[] = [];
    let vertexCursor = 0;

    let cursorX = STANDING_GROUP_START_X;
    let prevTiltAbs = 0;
    let prevH = 0;
    let prevT = 0;
    let prevCx = STANDING_GROUP_START_X;
    let lastRightMaxX = STANDING_GROUP_START_X;

    standingBooks.forEach((book, idx) => {
      const tiltAbs = Math.abs(book.tiltZ); // book.tiltZ <= 0 leans top toward +X
      const rotZ = book.tiltZ;
      const cosT = Math.cos(tiltAbs);
      const sinT = Math.sin(tiltAbs);

      let cx: number;
      if (tiltAbs === 0 && idx === 0) {
        cx = cursorX + book.thickness / 2;
        cursorX += book.thickness + 0.002;
        lastRightMaxX = cx + book.thickness / 2;
      } else if (tiltAbs === 0) {
        cx = cursorX + book.thickness / 2;
        cursorX += book.thickness + 0.002;
        lastRightMaxX = cx + book.thickness / 2;
      } else {
        const cosPrev = Math.cos(prevTiltAbs);
        const sinPrev = Math.sin(prevTiltAbs);
        const rightXOfPrev = (s: number) =>
          prevCx + (prevT / 2) * cosPrev + (s / cosPrev - prevH / 2) * sinPrev;
        const leftXOffsetOfCurr = (s: number) =>
          -(book.thickness / 2) * cosT +
          ((s - book.thickness * sinT) / cosT - book.height / 2) * sinT;

        const sLow = book.thickness * sinT;
        const sHigh = Math.min(prevH * cosPrev, sLow + book.height * cosT) * 0.96;

        const cxMinLow = rightXOfPrev(sLow) - leftXOffsetOfCurr(sLow) + 0.002;
        const cxMinHigh = rightXOfPrev(sHigh) - leftXOffsetOfCurr(sHigh) + 0.002;
        cx = Math.max(cxMinLow, cxMinHigh);
        lastRightMaxX = cx + (book.thickness / 2) * cosT + (book.height / 2) * sinT;
      }

      // Compute center Y so the lowest bottom corner rests flush on y = lowerTop
      const cy = lowerTop + (book.thickness / 2) * sinT + (book.height / 2) * cosT;
      const bookMat = new THREE.Matrix4().compose(
        new THREE.Vector3(cx, cy, shelfBookZ),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, rotZ, 'XYZ')),
        new THREE.Vector3(1, 1, 1)
      );

      const vCount = appendBookGeometry(
        bookGeoParts,
        book.thickness,
        book.height,
        book.depth,
        book.color,
        idx,
        bookMat,
        isLow
      );
      booksMeta.push({
        id: book.id,
        title: book.title,
        kind: 'standing',
        vertexStart: vertexCursor,
        vertexCount: vCount,
      });
      vertexCursor += vCount;

      prevTiltAbs = tiltAbs;
      prevH = book.height;
      prevT = book.thickness;
      prevCx = cx;
    });

    const bookendBladeX = lastRightMaxX + 0.0025;

    // Horizontally stacked books on the right (centerX = +0.58)
    let stackCursorY = lowerTop;
    stackedBooks.forEach((book, idx) => {
      const slotIdx = standingBooks.length + idx;
      const cx = lowerLayout.stackCenterX + book.offsetX;
      const cy = stackCursorY + book.thickness / 2;
      const cz = shelfBookZ + book.offsetZ;

      // Rz(+PI/2) lays book flat (+X->+Y thickness, +Y->-X width, +Z spine preserved facing viewer),
      // followed by Ry(rotY) around vertical shelf axis.
      const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), book.rotY);
      const qFlat = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 0, 1),
        Math.PI / 2
      );
      const bookMat = new THREE.Matrix4().compose(
        new THREE.Vector3(cx, cy, cz),
        qYaw.multiply(qFlat),
        new THREE.Vector3(1, 1, 1)
      );

      const vCount = appendBookGeometry(
        bookGeoParts,
        book.thickness,
        book.width,
        book.depth,
        book.color,
        slotIdx,
        bookMat,
        isLow
      );
      booksMeta.push({
        id: book.id,
        title: book.title,
        kind: 'stacked',
        vertexStart: vertexCursor,
        vertexCount: vCount,
      });
      vertexCursor += vCount;
      stackCursorY += book.thickness;
    });

    const booksGeo = mergeGeometries(bookGeoParts, false) ?? new THREE.BufferGeometry();
    for (const part of bookGeoParts) {
      part.dispose();
    }
    booksGeo.computeBoundingSphere();

    // 5. Merged small shelf props (achievement plaques, upgraded robot figure, trophy, bookend, mug)
    const propsParts: ColoredGeometryPart[] = [];

    if (showAchievements) {
      PLAQUE_SLOTS.forEach((slot) => {
        const [cx, cy, cz] = computeSlotLocalCenter(slot.dx, slot.shelfTopY, slot.localZ, 0.125);
        propsParts.push({
          geometry: new RoundedBoxGeometry(0.124, 0.124, 0.013, 2, 0.003),
          position: [cx, cy, cz],
          rotation: [LEAN_TILT_X, 0, 0],
          color: '#161b22',
        });
      });
    }

    // L-shaped matte charcoal metal bookend supporting standing books
    const bookendBladeT = 0.005;
    propsParts.push(
      {
        geometry: new THREE.BoxGeometry(0.068, 0.004, 0.132),
        position: [bookendBladeX - 0.032, lowerTop + 0.002, shelfBookZ],
        color: lowerLayout.bookendColor,
      },
      {
        geometry: new RoundedBoxGeometry(bookendBladeT, 0.145, 0.126, 2, 0.0015),
        position: [bookendBladeX + bookendBladeT / 2, lowerTop + 0.0725, shelfBookZ],
        color: lowerLayout.bookendColor,
      }
    );

    // Golden Trophy Cup centered on lower shelf (x = +0.02, clear of bookend and WallDecor plant at +0.30)
    const trophyX = lowerLayout.trophyX;
    const trophyZ = 0.095;
    propsParts.push(
      {
        geometry: new THREE.BoxGeometry(0.052, 0.022, 0.052),
        position: [trophyX, lowerTop + 0.011, trophyZ],
        color: '#181a20',
      },
      {
        geometry: new THREE.CylinderGeometry(0.01, 0.018, 0.032, 12),
        position: [trophyX, lowerTop + 0.038, trophyZ],
        color: '#d4a64a',
      },
      {
        geometry: new THREE.CylinderGeometry(0.028, 0.014, 0.046, 14),
        position: [trophyX, lowerTop + 0.077, trophyZ],
        color: '#eab308',
      },
      {
        geometry: new THREE.TorusGeometry(0.018, 0.0035, 8, 14, Math.PI),
        position: [trophyX - 0.024, lowerTop + 0.077, trophyZ],
        rotation: [0, 0, Math.PI / 2],
        color: '#d4a64a',
      },
      {
        geometry: new THREE.TorusGeometry(0.018, 0.0035, 8, 14, Math.PI),
        position: [trophyX + 0.024, lowerTop + 0.077, trophyZ],
        rotation: [0, 0, -Math.PI / 2],
        color: '#d4a64a',
      }
    );

    // Ceramic coffee mug resting cleanly atop the 4 stacked books
    const topBook = stackedBooks[stackedBooks.length - 1];
    const mugX = lowerLayout.stackCenterX + (topBook?.offsetX ?? 0);
    const mugZ = shelfBookZ + (topBook?.offsetZ ?? 0);
    const mugH = 0.058;
    const mugR = 0.028;
    propsParts.push(
      {
        geometry: new THREE.CylinderGeometry(mugR, mugR * 0.92, mugH, 16),
        position: [mugX, stackCursorY + mugH / 2, mugZ],
        color: lowerLayout.mugColor,
      },
      {
        geometry: new THREE.CylinderGeometry(mugR * 0.84, mugR * 0.84, 0.004, 14),
        position: [mugX, stackCursorY + mugH - 0.001, mugZ],
        color: lowerLayout.coffeeColor,
      },
      {
        geometry: new THREE.TorusGeometry(0.014, 0.0042, 8, 12, Math.PI),
        position: [mugX + mugR - 0.002, stackCursorY + mugH * 0.52, mugZ],
        rotation: [0, 0, -Math.PI / 2],
        color: lowerLayout.mugColor,
      }
    );

    // Small Robot Figure on upper shelf at dx = +0.39 between certificates and GitHub plaques
    const figX = upperLayout.figureDx;
    const upperTop = cfg.upperY + cfg.thickness / 2;
    const figZ = 0.096;
    propsParts.push(
      // Base pedestal
      {
        geometry: new THREE.CylinderGeometry(0.028, 0.03, 0.009, 14),
        position: [figX, upperTop + 0.0045, figZ],
        color: '#1e293b',
      },
      // Feet & lower legs
      {
        geometry: new THREE.BoxGeometry(0.012, 0.014, 0.018),
        position: [figX - 0.01, upperTop + 0.016, figZ],
        color: '#475569',
      },
      {
        geometry: new THREE.BoxGeometry(0.012, 0.014, 0.018),
        position: [figX + 0.01, upperTop + 0.016, figZ],
        color: '#475569',
      },
      // Torso + chest accent core
      {
        geometry: new RoundedBoxGeometry(0.038, 0.038, 0.028, 2, 0.005),
        position: [figX, upperTop + 0.042, figZ],
        color: '#334155',
      },
      {
        geometry: new THREE.CylinderGeometry(0.006, 0.006, 0.004, 10),
        position: [figX, upperTop + 0.044, figZ + 0.014],
        rotation: [Math.PI / 2, 0, 0],
        color: '#38bdf8',
      },
      // Stubby arms
      {
        geometry: new RoundedBoxGeometry(0.01, 0.028, 0.012, 2, 0.003),
        position: [figX - 0.025, upperTop + 0.041, figZ],
        rotation: [0, 0, 0.14],
        color: '#cbd5e1',
      },
      {
        geometry: new RoundedBoxGeometry(0.01, 0.028, 0.012, 2, 0.003),
        position: [figX + 0.025, upperTop + 0.041, figZ],
        rotation: [0, 0, -0.14],
        color: '#cbd5e1',
      },
      // Head + cyan visor + antenna
      {
        geometry: new RoundedBoxGeometry(0.044, 0.038, 0.038, 2, 0.008),
        position: [figX, upperTop + 0.082, figZ],
        color: '#e2e8f0',
      },
      {
        geometry: new THREE.BoxGeometry(0.029, 0.011, 0.004),
        position: [figX, upperTop + 0.083, figZ + 0.019],
        color: '#38bdf8',
      },
      {
        geometry: new THREE.CylinderGeometry(0.002, 0.002, 0.015, 6),
        position: [figX, upperTop + 0.107, figZ],
        color: '#94a3b8',
      },
      {
        geometry: new THREE.SphereGeometry(0.004, 8, 8),
        position: [figX, upperTop + 0.115, figZ],
        color: '#38bdf8',
      }
    );

    const propsGeo = buildMergedColoredGeometry(propsParts);

    return {
      shelvesGeo,
      frameTemplateGeo,
      cardsAndBadgesGeo,
      booksGeo,
      booksMeta,
      propsGeo,
    };
  }, [cfg.depth, cfg.lowerY, cfg.thickness, cfg.upperY, cfg.width, isLow, showAchievements]);

  const materials = useMemo(() => {
    return {
      oak: new THREE.MeshStandardMaterial({
        color: cfg.oakColor,
        roughness: 0.72,
        metalness: 0.04,
      }),
      frameColored: new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.52,
        metalness: 0.14,
      }),
      atlas: new THREE.MeshStandardMaterial({
        map: atlasTex,
        roughness: 0.78,
        metalness: 0.02,
      }),
      booksAtlas: new THREE.MeshLambertMaterial({
        map: booksAtlasTex,
        vertexColors: true,
      }),
      propsColored: new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.38,
        metalness: 0.35,
      }),
    };
  }, [atlasTex, booksAtlasTex, cfg.oakColor]);

  useLayoutEffect(() => {
    if (!framesInstRef.current) return;
    const dummy = new THREE.Object3D();
    FRAME_SLOTS.forEach((slot, i) => {
      const [cx, cy, cz] = computeSlotLocalCenter(slot.dx, slot.shelfTopY, slot.localZ, FRAME_H);
      dummy.position.set(cx, cy, cz);
      dummy.rotation.set(LEAN_TILT_X, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      framesInstRef.current!.setMatrixAt(i, dummy.matrix);
    });
    framesInstRef.current.instanceMatrix.needsUpdate = true;
    freezeStaticMatrices(groupRef.current);
  }, [visible, isLow]);

  useEffect(() => {
    return () => {
      geometries.shelvesGeo.dispose();
      geometries.frameTemplateGeo.dispose();
      geometries.cardsAndBadgesGeo.dispose();
      geometries.booksGeo.dispose();
      geometries.propsGeo.dispose();
    };
  }, [geometries]);

  useEffect(() => {
    return () => {
      Object.values(materials).forEach((m) => m.dispose());
      if (atlasTex) {
        atlasTex.userData.__disposed = true;
        atlasTex.dispose();
      }
      if (booksAtlasTex) {
        booksAtlasTex.userData.__disposed = true;
        booksAtlasTex.dispose();
      }
    };
  }, [materials, atlasTex, booksAtlasTex]);

  if (!visible) return null;

  return (
    <group
      ref={groupRef}
      name="certificates-shelf"
      position={cfg.position}
      rotation={[0, cfg.rotationY, 0]}
    >
      <mesh geometry={geometries.shelvesGeo} material={materials.oak} />
      <instancedMesh
        ref={framesInstRef}
        args={[geometries.frameTemplateGeo, materials.frameColored, FRAME_SLOTS.length]}
        userData={{ interactive: 'certificate' }}
      />
      <mesh
        geometry={geometries.cardsAndBadgesGeo}
        material={materials.atlas}
        userData={{ interactive: 'certificate-or-achievement' }}
      />
      <mesh
        name="certificates-shelf-books"
        geometry={geometries.booksGeo}
        material={materials.booksAtlas}
        userData={{ booksMeta: geometries.booksMeta }}
      />
      <mesh geometry={geometries.propsGeo} material={materials.propsColored} />
    </group>
  );
}
