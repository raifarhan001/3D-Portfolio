'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { CURTAINS_CONFIG, THEMES_CONFIG } from '@/config/themeConfig';
import { ROOM_CONTENT_CONFIG } from '@/config/roomContent';
import { usePortfolioStore } from '@/stores/portfolioStore';
import {
  buildMergedGeometry,
  freezeStaticMatrices,
  type GeometryPart,
} from '@/utils/mergeHelpers';
import { useThemed } from '@/utils/themeRegistry';

function buildPleatedDrapeGeometry(
  width: number,
  height: number,
  segW: number,
  segH: number,
  amplitude: number,
  folds: number,
  tiebackSideSign: number
): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(width, height, segW, segH);
  const pos = geo.getAttribute('position');

  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i);
    const ly = pos.getY(i);
    const u = lx / width + 0.5; // 0..1 across width
    const v = ly / height + 0.5; // 0 = bottom, 1 = top

    // Subtle waist pinch near y = 0.34 from floor (tieback zone)
    const pinchDist = Math.abs(v - 0.34);
    const pinch = pinchDist < 0.28 ? Math.cos((pinchDist / 0.28) * (Math.PI * 0.5)) * 0.22 : 0;
    const widthScale = 1 - pinch * 0.45;
    const pinchShiftX = tiebackSideSign * pinch * 0.045;

    const wave = Math.sin(u * folds * Math.PI * 2);
    const zOffset = wave * amplitude * (1 - pinch * 0.35) + amplitude;

    pos.setX(i, lx * widthScale + pinchShiftX);
    pos.setZ(i, zOffset);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/**
 * WindowCurtains — Open pleated drapes with rod, finials, tiebacks, and instanced rings
 * mounted cleanly onto the existing North Wall fake window. Strictly 3 draw calls total.
 */
export default function WindowCurtains() {
  const quality = usePortfolioStore((s) => s.graphicsQuality);
  const showWindow = ROOM_CONTENT_CONFIG.wallItemsEnabled.fakeWindow;

  const rootRef = useRef<THREE.Group>(null);
  const ringsInstRef = useRef<THREE.InstancedMesh>(null);

  const segs = quality === 'low' ? CURTAINS_CONFIG.lowSegments : CURTAINS_CONFIG.highSegments;
  const drapeHeight = CURTAINS_CONFIG.drapeTopY - CURTAINS_CONFIG.drapeBottomY;
  const drapeCenterY = CURTAINS_CONFIG.drapeBottomY + drapeHeight * 0.5;

  const fabricMat = useMemo(
    () =>
      new THREE.MeshLambertMaterial({
        color: CURTAINS_CONFIG.colors.day,
        side: THREE.DoubleSide,
      }),
    []
  );

  const hardwareMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: CURTAINS_CONFIG.rodColor,
        roughness: 0.34,
        metalness: 0.82,
      }),
    []
  );

  useThemed(
    fabricMat,
    {
      day: { color: THEMES_CONFIG.day.curtainColor },
      night: { color: THEMES_CONFIG.night.curtainColor },
    },
    [fabricMat]
  );

  const { drapesGeo, rodAndTiebacksGeo, ringGeo } = useMemo(() => {
    const [segW, segH] = segs;
    const [leftOff, rightOff] = CURTAINS_CONFIG.drapeOffsetsX;
    const cx = CURTAINS_CONFIG.windowCenterX;
    const z = CURTAINS_CONFIG.drapeZ;

    const leftDrape = buildPleatedDrapeGeometry(
      CURTAINS_CONFIG.drapeWidth,
      drapeHeight,
      segW,
      segH,
      CURTAINS_CONFIG.pleatAmplitude,
      CURTAINS_CONFIG.pleatFolds,
      -1
    );
    const rightDrape = buildPleatedDrapeGeometry(
      CURTAINS_CONFIG.drapeWidth,
      drapeHeight,
      segW,
      segH,
      CURTAINS_CONFIG.pleatAmplitude,
      CURTAINS_CONFIG.pleatFolds,
      1
    );

    const drapesMerged = buildMergedGeometry([
      { geometry: leftDrape, position: [cx + leftOff, drapeCenterY, z] },
      { geometry: rightDrape, position: [cx + rightOff, drapeCenterY, z] },
    ]);

    // Merge curtain rod + 2 finials + wall brackets + 2 tieback straps
    const rodParts: GeometryPart[] = [
      // Horizontal rod bar
      {
        geometry: new THREE.CylinderGeometry(
          CURTAINS_CONFIG.rodRadius,
          CURTAINS_CONFIG.rodRadius,
          CURTAINS_CONFIG.rodWidth,
          14
        ),
        position: [cx, CURTAINS_CONFIG.rodY, CURTAINS_CONFIG.rodZ],
        rotation: [0, 0, Math.PI / 2],
      },
      // Left & right spherical finials
      {
        geometry: new THREE.SphereGeometry(0.028, 12, 10),
        position: [cx - CURTAINS_CONFIG.rodWidth / 2 - 0.015, CURTAINS_CONFIG.rodY, CURTAINS_CONFIG.rodZ],
      },
      {
        geometry: new THREE.SphereGeometry(0.028, 12, 10),
        position: [cx + CURTAINS_CONFIG.rodWidth / 2 + 0.015, CURTAINS_CONFIG.rodY, CURTAINS_CONFIG.rodZ],
      },
    ];

    // 3 wall support brackets
    for (const bx of [cx - 1.24, cx, cx + 1.24]) {
      rodParts.push({
        geometry: new THREE.CylinderGeometry(0.008, 0.008, 0.12, 8),
        position: [bx, CURTAINS_CONFIG.rodY, -4.94],
        rotation: [Math.PI / 2, 0, 0],
      });
    }

    // 2 tailored tiebacks wrapping left & right pinched waists cleanly around fold peaks
    const tieY = CURTAINS_CONFIG.drapeBottomY + drapeHeight * 0.34;
    for (const [dx, side] of [
      [leftOff, -1],
      [rightOff, 1],
    ] as const) {
      rodParts.push({
        geometry: new THREE.TorusGeometry(0.115, 0.016, 8, 20),
        position: [cx + dx + side * 0.036, tieY, z + CURTAINS_CONFIG.pleatAmplitude],
        rotation: [Math.PI / 2, 0, 0],
        scale: [2.45, 0.68, 1.35],
      });
    }

    const rGeo = new THREE.TorusGeometry(0.024, 0.005, 6, 14);

    return {
      drapesGeo: drapesMerged,
      rodAndTiebacksGeo: buildMergedGeometry(rodParts),
      ringGeo: rGeo,
    };
  }, [drapeCenterY, drapeHeight, segs]);

  useLayoutEffect(() => {
    const inst = ringsInstRef.current;
    if (inst) {
      const dummy = new THREE.Object3D();
      const cx = CURTAINS_CONFIG.windowCenterX;
      const [leftOff, rightOff] = CURTAINS_CONFIG.drapeOffsetsX;
      const countPerSide = CURTAINS_CONFIG.ringCountPerSide;
      const span = CURTAINS_CONFIG.drapeWidth * 0.88;
      let idx = 0;

      for (const offX of [leftOff, rightOff]) {
        const startX = cx + offX - span / 2;
        for (let i = 0; i < countPerSide; i++) {
          const rx = startX + (span * i) / (countPerSide - 1);
          dummy.position.set(rx, CURTAINS_CONFIG.rodY, CURTAINS_CONFIG.rodZ);
          dummy.rotation.set(0, Math.PI / 2, 0);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          inst.setMatrixAt(idx++, dummy.matrix);
        }
      }
      inst.instanceMatrix.needsUpdate = true;
    }

    freezeStaticMatrices(rootRef.current);
  }, [segs]);

  useEffect(() => {
    return () => {
      drapesGeo.dispose();
      rodAndTiebacksGeo.dispose();
      ringGeo.dispose();
    };
  }, [drapesGeo, rodAndTiebacksGeo, ringGeo]);

  useEffect(() => {
    return () => {
      fabricMat.dispose();
      hardwareMat.dispose();
    };
  }, [fabricMat, hardwareMat]);

  if (!showWindow) return null;

  return (
    <group ref={rootRef} name="window-curtains">
      {/* Draw call 1: Pleated drapes (MeshLambertMaterial, themed Day/Night) */}
      <mesh geometry={drapesGeo} material={fabricMat} />
      {/* Draw call 2: Rod, finials, brackets, and tiebacks */}
      <mesh geometry={rodAndTiebacksGeo} material={hardwareMat} />
      {/* Draw call 3: Curtain rings InstancedMesh */}
      <instancedMesh
        ref={ringsInstRef}
        args={[ringGeo, hardwareMat, CURTAINS_CONFIG.ringCountPerSide * 2]}
      />
    </group>
  );
}
