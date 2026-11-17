'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { buildMergedGeometry, freezeStaticMatrices, type GeometryPart } from '@/utils/mergeHelpers';
import { GAMING_ROOM_CONFIG, THEMES_CONFIG } from '@/config/themeConfig';
import { useThemeStore } from '@/stores/themeStore';
import { useInputStore } from '@/stores/inputStore';
import { usePortfolioStore } from '@/stores/portfolioStore';
import { getThemeT } from '@/utils/themeRegistry';
import { createRgbWaveGradientTexture } from '@/utils/step6Textures';

interface StripSegment {
  size: [number, number, number];
  pos: [number, number, number];
  axis: 'x' | 'z';
}

/**
 * Maps a horizontal LED segment's UVs continuously along its length with a cumulative phase offset
 * so the single 1024x1 gradient texture flows seamlessly around walls, console, and sofa base.
 */
function buildStripSegment(seg: StripSegment, uOffset: number, uScale = 0.32): GeometryPart {
  const geo = new THREE.BoxGeometry(seg.size[0], seg.size[1], seg.size[2]);
  const length = seg.axis === 'x' ? seg.size[0] : seg.size[2];
  const posAttr = geo.getAttribute('position');
  const uvAttr = geo.getAttribute('uv');
  const halfLen = Math.max(length * 0.5, 0.001);

  for (let i = 0; i < uvAttr.count; i++) {
    const along = seg.axis === 'x' ? posAttr.getX(i) : posAttr.getZ(i);
    const norm = (along + halfLen) / (halfLen * 2);
    uvAttr.setXY(i, uOffset + norm * length * uScale, 0.5);
  }
  uvAttr.needsUpdate = true;

  return { geometry: geo, position: seg.pos };
}

const DIAGONAL_BAR_POSES: ReadonlyArray<{ pos: [number, number, number]; rot: [number, number, number] }> = [
  { pos: [4.982, 1.98, 1.56], rot: [Math.PI * 0.21, 0, 0] },
  { pos: [4.982, 2.24, 1.82], rot: [Math.PI * 0.21, 0, 0] },
  { pos: [4.982, 2.5, 2.08], rot: [Math.PI * 0.21, 0, 0] },
];

/**
 * RgbPerimeterLights — Single theme-aware perimeter LED system (2 draw calls total, 0 real lights):
 * 1) Merged LED strip on all free baseboard tops, TV console underside & L-sofa base.
 * 2) InstancedMesh of 3 staggered diagonal RGB light bars on East Charcoal Accent Wall.
 */
export default function RgbPerimeterLights() {
  const rootRef = useRef<THREE.Group>(null);
  const barsRef = useRef<THREE.InstancedMesh>(null);
  const ledMatRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const gradTexRef = useRef<THREE.CanvasTexture | null>(null);
  const timerRef = useRef(0.1);
  const lastScalarRef = useRef(-1);

  const gradientTex = useMemo(() => createRgbWaveGradientTexture(), []);

  const merged = useMemo(() => {
    const t = GAMING_ROOM_CONFIG.rgbStrip.thickness;
    const baseY = GAMING_ROOM_CONFIG.rgbStrip.baseboardTopY;
    const consoleY = GAMING_ROOM_CONFIG.rgbStrip.consoleUndersideY;
    const sofaY = GAMING_ROOM_CONFIG.rgbStrip.sofaUndersideY;

    // 1. Free wall skirting tops + console underside + L-sofa base perimeter
    const segments: StripSegment[] = [
      // North free skirting (clears Gramophone <= -3.78 and Gaming Desk >= +2.75)
      { size: [6.4, t, t], pos: [-0.52, baseY, -4.985], axis: 'x' },
      // East free skirting (between Arcade -1.59 and Treadmill +1.82)
      { size: [t, t, 3.28], pos: [4.985, baseY, 0.12], axis: 'z' },
      // South free skirting (between Floor Lamp -3.38 and Gym Rack +1.65)
      { size: [4.88, t, t], pos: [-0.86, baseY, 4.985], axis: 'x' },
      // West free skirting (between Gramophone & Media Wall, and Media Wall & Mini-Fridge)
      { size: [t, t, 1.07], pos: [-4.985, baseY, -3.185], axis: 'z' },
      { size: [t, t, 1.45], pos: [-4.985, baseY, 3.375], axis: 'z' },
      // TV Console front underside strip (y=0.148 beneath legHeight=0.16)
      { size: [t, t, 2.84], pos: [-4.52, consoleY, 0.0], axis: 'z' },
      // L-Sofa base perimeter underglow strips (y=0.102 beneath base bottom 0.11)
      { size: [t, t, 1.94], pos: [-0.71, sofaY, -0.39], axis: 'z' },
      { size: [t, t, 2.72], pos: [0.21, sofaY, 0.0], axis: 'z' },
      { size: [0.92, t, t], pos: [-0.25, sofaY, -1.36], axis: 'x' },
      { size: [0.62, t, t], pos: [-1.02, sofaY, 0.62], axis: 'x' },
      { size: [t, t, 0.76], pos: [-1.33, sofaY, 1.0], axis: 'z' },
      { size: [1.54, t, t], pos: [-0.56, sofaY, 1.38], axis: 'x' },
    ];

    let accU = 0;
    const stripParts: GeometryPart[] = segments.map((seg) => {
      const len = seg.axis === 'x' ? seg.size[0] : seg.size[2];
      const part = buildStripSegment(seg, accU);
      accU += len * 0.32;
      return part;
    });

    // Diagonal light bar geometry remapping Y length into U for seamless shared gradient wave
    const barGeo = new THREE.BoxGeometry(
      0.022,
      GAMING_ROOM_CONFIG.rgbStrip.diagonalBarLength,
      GAMING_ROOM_CONFIG.rgbStrip.diagonalBarWidth
    );
    const barPos = barGeo.getAttribute('position');
    const barUv = barGeo.getAttribute('uv');
    const halfBarLen = GAMING_ROOM_CONFIG.rgbStrip.diagonalBarLength * 0.5;
    for (let i = 0; i < barUv.count; i++) {
      const along = (barPos.getY(i) + halfBarLen) / (halfBarLen * 2);
      barUv.setXY(i, along * 0.75, 0.5);
    }
    barUv.needsUpdate = true;

    return {
      perimeterGeo: buildMergedGeometry(stripParts),
      barGeo,
    };
  }, []);

  const ledMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      map: gradientTex ?? undefined,
      color: '#ffffff',
      toneMapped: false,
    });
  }, [gradientTex]);

  useLayoutEffect(() => {
    ledMatRef.current = ledMaterial;
    gradTexRef.current = gradientTex;
    const bars = barsRef.current;
    if (bars) {
      const dummy = new THREE.Object3D();
      const tint = new THREE.Color();
      DIAGONAL_BAR_POSES.forEach((pose, idx) => {
        dummy.position.set(...pose.pos);
        dummy.rotation.set(...pose.rot);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        bars.setMatrixAt(idx, dummy.matrix);
        // Subtle per-bar warmth/cyan shift multiplier without fighting rainbow gradient
        tint.setHSL(idx === 0 ? 0.52 : idx === 1 ? 0.85 : 0.0, 0.08, 0.98);
        bars.setColorAt(idx, tint);
      });
      bars.instanceMatrix.needsUpdate = true;
      bars.computeBoundingSphere();
      if (bars.instanceColor) bars.instanceColor.needsUpdate = true;
    }
    freezeStaticMatrices(rootRef.current);
  }, [ledMaterial, gradientTex]);

  useEffect(() => {
    return () => {
      merged.perimeterGeo.dispose();
      merged.barGeo.dispose();
      ledMaterial.dispose();
      gradientTex?.dispose();
    };
  }, [merged, ledMaterial, gradientTex]);

  useFrame((state, delta) => {
    const mat = ledMatRef.current;
    const tex = gradTexRef.current;
    if (!mat) return;

    const theme = useThemeStore.getState().theme;
    const mode = THEMES_CONFIG[theme].tvRgbMode || 'rainbow';
    const isPaused = useInputStore.getState().mode === 'paused';
    const isLow = usePortfolioStore.getState().graphicsQuality === 'low';
    const camPos = state.camera.position;
    const inRoomRange = Math.abs(camPos.x) < 12 && Math.abs(camPos.z) < 12;

    const themeT = getThemeT();
    const brightness = THREE.MathUtils.lerp(
      GAMING_ROOM_CONFIG.rgbStrip.dayIntensity,
      GAMING_ROOM_CONFIG.rgbStrip.nightIntensity,
      themeT
    );

    // Always keep brightness synced across Day/Night transitions (zero idle churn)
    if (mode === 'off') {
      if (lastScalarRef.current !== 0) {
        mat.color.set('#0b0d14');
        lastScalarRef.current = 0;
      }
      return;
    }

    if (mode === 'static') {
      mat.color.set('#22d3ee').multiplyScalar(brightness);
      if (tex && tex.offset.x !== 0) {
        tex.offset.x = 0;
      }
      return;
    }

    if (Math.abs(lastScalarRef.current - brightness) > 0.002) {
      mat.color.setRGB(brightness, brightness, brightness);
      lastScalarRef.current = brightness;
    }

    // Throttle texture wave scrolling to 15Hz; freeze when paused, Low quality, or distant
    if (isPaused || isLow || !inRoomRange || !tex) {
      return;
    }

    timerRef.current += Math.min(delta, 0.1);
    if (timerRef.current >= 1 / 15) {
      tex.offset.x = (tex.offset.x - timerRef.current * GAMING_ROOM_CONFIG.rgbStrip.speed) % 1;
      timerRef.current = 0;
    }
  });

  return (
    <group ref={rootRef} name="rgb-perimeter-lighting">
      <mesh geometry={merged.perimeterGeo} material={ledMaterial} />
      <instancedMesh ref={barsRef} args={[merged.barGeo, ledMaterial, DIAGONAL_BAR_POSES.length]} />
    </group>
  );
}
