'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {
  buildMergedColoredGeometry,
  buildMergedGeometry,
  freezeStaticMatrices,
  type ColoredGeometryPart,
} from '@/utils/mergeHelpers';
import { GAMING_ROOM_CONFIG } from '@/config/themeConfig';
import { usePortfolioStore } from '@/stores/portfolioStore';
import { useThemed } from '@/utils/themeRegistry';

const HOOK_XS = [-0.58, -0.29, 0.0, 0.29, 0.58] as const;

/**
 * Generates 100% original stylized generic controller parts seated at (cx, 0, z)
 * with distinct silhouette/button accents (no trademarked shells or logos).
 */
function buildGenericControllerParts(cx: number, variant: number): ColoredGeometryPart[] {
  const z = 0.045;
  const parts: ColoredGeometryPart[] = [];

  if (variant === 0) {
    // 1. Retro Rectangular Gray Pad
    parts.push(
      { geometry: new RoundedBoxGeometry(0.145, 0.068, 0.022, 2, 0.008), position: [cx, 0.0, z], color: '#d4d6dc' },
      { geometry: new THREE.BoxGeometry(0.072, 0.042, 0.004), position: [cx, -0.002, z + 0.011], color: '#3b4252' },
      { geometry: new THREE.BoxGeometry(0.012, 0.032, 0.006), position: [cx - 0.044, 0.0, z + 0.012], color: '#111827' },
      { geometry: new THREE.BoxGeometry(0.032, 0.012, 0.006), position: [cx - 0.044, 0.0, z + 0.012], color: '#111827' },
      { geometry: new THREE.SphereGeometry(0.007, 8, 8), position: [cx + 0.036, -0.005, z + 0.012], color: '#dc2626' },
      { geometry: new THREE.SphereGeometry(0.007, 8, 8), position: [cx + 0.052, 0.006, z + 0.012], color: '#dc2626' }
    );
  } else if (variant === 1) {
    // 2. Classic 90s Slate-Violet Boomerang Pad
    parts.push(
      { geometry: new RoundedBoxGeometry(0.145, 0.058, 0.024, 2, 0.012), position: [cx, 0.008, z], color: '#475569' },
      { geometry: new RoundedBoxGeometry(0.036, 0.074, 0.026, 2, 0.012), position: [cx - 0.058, -0.026, z + 0.004], rotation: [0, 0, -0.28], color: '#475569' },
      { geometry: new RoundedBoxGeometry(0.036, 0.074, 0.026, 2, 0.012), position: [cx + 0.058, -0.026, z + 0.004], rotation: [0, 0, 0.28], color: '#475569' },
      { geometry: new THREE.CylinderGeometry(0.011, 0.011, 0.01, 10), position: [cx - 0.025, -0.004, z + 0.014], rotation: [Math.PI / 2, 0, 0], color: '#a855f7' },
      { geometry: new THREE.CylinderGeometry(0.011, 0.011, 0.01, 10), position: [cx + 0.025, -0.004, z + 0.014], rotation: [Math.PI / 2, 0, 0], color: '#a855f7' },
      { geometry: new THREE.SphereGeometry(0.006, 8, 8), position: [cx + 0.048, 0.018, z + 0.014], color: '#c084fc' },
      { geometry: new THREE.SphereGeometry(0.006, 8, 8), position: [cx + 0.058, 0.008, z + 0.014], color: '#38bdf8' }
    );
  } else if (variant === 2) {
    // 3. Slate-Obsidian Symmetrical Dual-Stick Pro Pad
    parts.push(
      { geometry: new RoundedBoxGeometry(0.15, 0.068, 0.028, 2, 0.014), position: [cx, 0.008, z], color: '#334155' },
      { geometry: new RoundedBoxGeometry(0.038, 0.082, 0.028, 2, 0.014), position: [cx - 0.062, -0.028, z + 0.006], rotation: [0, 0, -0.32], color: '#1e293b' },
      { geometry: new RoundedBoxGeometry(0.038, 0.082, 0.028, 2, 0.014), position: [cx + 0.062, -0.028, z + 0.006], rotation: [0, 0, 0.32], color: '#1e293b' },
      { geometry: new THREE.BoxGeometry(0.052, 0.005, 0.004), position: [cx, 0.022, z + 0.015], color: '#22d3ee' },
      { geometry: new THREE.CylinderGeometry(0.011, 0.011, 0.01, 10), position: [cx - 0.025, -0.012, z + 0.016], rotation: [Math.PI / 2, 0, 0], color: '#475569' },
      { geometry: new THREE.CylinderGeometry(0.011, 0.011, 0.01, 10), position: [cx + 0.025, -0.012, z + 0.016], rotation: [Math.PI / 2, 0, 0], color: '#475569' }
    );
  } else if (variant === 3) {
    // 4. Crisp White Asymmetric Grip Pad + Orange Shoulder Triggers
    parts.push(
      { geometry: new RoundedBoxGeometry(0.148, 0.068, 0.028, 2, 0.014), position: [cx, 0.008, z], color: '#f1f5f9' },
      { geometry: new RoundedBoxGeometry(0.038, 0.078, 0.028, 2, 0.013), position: [cx - 0.06, -0.026, z + 0.005], rotation: [0, 0, -0.28], color: '#f1f5f9' },
      { geometry: new RoundedBoxGeometry(0.038, 0.078, 0.028, 2, 0.013), position: [cx + 0.06, -0.026, z + 0.005], rotation: [0, 0, 0.28], color: '#f1f5f9' },
      { geometry: new THREE.BoxGeometry(0.032, 0.008, 0.02), position: [cx - 0.044, 0.044, z], color: '#f97316' },
      { geometry: new THREE.BoxGeometry(0.032, 0.008, 0.02), position: [cx + 0.044, 0.044, z], color: '#f97316' },
      { geometry: new THREE.CylinderGeometry(0.012, 0.012, 0.01, 10), position: [cx - 0.044, 0.014, z + 0.016], rotation: [Math.PI / 2, 0, 0], color: '#1e293b' },
      { geometry: new THREE.CylinderGeometry(0.012, 0.012, 0.01, 10), position: [cx + 0.022, -0.012, z + 0.016], rotation: [Math.PI / 2, 0, 0], color: '#1e293b' },
      { geometry: new THREE.SphereGeometry(0.0055, 8, 8), position: [cx + 0.048, 0.016, z + 0.016], color: '#fb923c' }
    );
  } else {
    // 5. Compact Teal/Amber Dual-Tone Esports Pad
    parts.push(
      { geometry: new RoundedBoxGeometry(0.136, 0.064, 0.024, 2, 0.012), position: [cx, 0.006, z], color: '#0f766e' },
      { geometry: new RoundedBoxGeometry(0.034, 0.068, 0.024, 2, 0.011), position: [cx - 0.055, -0.022, z + 0.004], rotation: [0, 0, -0.24], color: '#134e4a' },
      { geometry: new RoundedBoxGeometry(0.034, 0.068, 0.024, 2, 0.011), position: [cx + 0.055, -0.022, z + 0.004], rotation: [0, 0, 0.24], color: '#134e4a' },
      { geometry: new THREE.CylinderGeometry(0.011, 0.011, 0.01, 10), position: [cx - 0.038, 0.01, z + 0.014], rotation: [Math.PI / 2, 0, 0], color: '#facc15' },
      { geometry: new THREE.CylinderGeometry(0.011, 0.011, 0.01, 10), position: [cx + 0.022, -0.012, z + 0.014], rotation: [Math.PI / 2, 0, 0], color: '#facc15' },
      { geometry: new THREE.BoxGeometry(0.018, 0.018, 0.005), position: [cx + 0.044, 0.012, z + 0.013], rotation: [0, 0, Math.PI / 4], color: '#fbbf24' }
    );
  }

  return parts;
}

/**
 * ControllerWallDisplay — East Charcoal Accent Wall pegboard (1.6m x 0.5m)
 * displaying 5 distinct stylized generic controllers + thin RGB edge trim (2-3 draws total).
 */
export default function ControllerWallDisplay() {
  const groupRef = useRef<THREE.Group>(null);
  const isLow = usePortfolioStore((s) => s.graphicsQuality === 'low');
  const cfg = GAMING_ROOM_CONFIG.controllerWallDisplay;

  const merged = useMemo(() => {
    const w = cfg.width;
    const h = cfg.height;

    // 1. Matte dark anodized backing + 5 brushed steel twin-prong hooks
    const mountParts: ColoredGeometryPart[] = [
      { geometry: new RoundedBoxGeometry(w, h, 0.02, 2, 0.006), position: [0, 0, 0.01], color: '#242938' },
    ];
    for (const hx of HOOK_XS) {
      // Peg plate + twin support prongs cradling controller body
      mountParts.push(
        { geometry: new THREE.BoxGeometry(0.048, 0.052, 0.008), position: [hx, 0.0, 0.024], color: '#2b3140' },
        { geometry: new THREE.CylinderGeometry(0.0035, 0.0035, 0.034, 8), position: [hx - 0.015, -0.015, 0.042], rotation: [Math.PI / 2, 0, 0], color: '#94a3b8' },
        { geometry: new THREE.CylinderGeometry(0.0035, 0.0035, 0.034, 8), position: [hx + 0.015, -0.015, 0.042], rotation: [Math.PI / 2, 0, 0], color: '#94a3b8' }
      );
    }

    // 2. Thin glowing perimeter RGB edge trim
    const rimT = 0.009;
    const rgbRimGeo = buildMergedGeometry([
      { geometry: new THREE.BoxGeometry(w + rimT * 2, rimT, rimT), position: [0, h / 2 + rimT / 2, 0.012] },
      { geometry: new THREE.BoxGeometry(w + rimT * 2, rimT, rimT), position: [0, -h / 2 - rimT / 2, 0.012] },
      { geometry: new THREE.BoxGeometry(rimT, h, rimT), position: [-w / 2 - rimT / 2, 0, 0.012] },
      { geometry: new THREE.BoxGeometry(rimT, h, rimT), position: [w / 2 + rimT / 2, 0, 0.012] },
    ]);

    // 3. All 5 generic controllers merged into ONE geometry
    const ctrlParts: ColoredGeometryPart[] = HOOK_XS.flatMap((hx, i) => buildGenericControllerParts(hx, i));

    return {
      mountGeo: buildMergedColoredGeometry(mountParts),
      rgbRimGeo,
      controllersGeo: buildMergedColoredGeometry(ctrlParts),
    };
  }, [cfg.width, cfg.height]);

  const materials = useMemo(() => {
    return {
      vertexColor: new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.45,
        metalness: 0.25,
      }),
      rgbRim: new THREE.MeshBasicMaterial({
        color: '#22d3ee',
        toneMapped: false,
      }),
    };
  }, []);

  useThemed(
    materials.rgbRim,
    {
      day: { color: '#38bdf8', intensity: 0.45 },
      night: { color: '#22d3ee', intensity: 1.15 },
    },
    [materials.rgbRim]
  );

  useLayoutEffect(() => {
    freezeStaticMatrices(groupRef.current);
  }, [isLow]);

  useEffect(() => {
    return () => {
      merged.mountGeo.dispose();
      merged.rgbRimGeo.dispose();
      merged.controllersGeo.dispose();
      Object.values(materials).forEach((m) => m.dispose());
    };
  }, [merged, materials]);

  return (
    <group
      ref={groupRef}
      name="controller-wall-display"
      position={cfg.position}
      rotation={[0, cfg.rotationY, 0]}
    >
      <mesh geometry={merged.mountGeo} material={materials.vertexColor} />
      <mesh geometry={merged.rgbRimGeo} material={materials.rgbRim} />
      {!isLow && <mesh geometry={merged.controllersGeo} material={materials.vertexColor} />}
    </group>
  );
}
