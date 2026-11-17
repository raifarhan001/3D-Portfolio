'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {
  buildMergedColoredGeometry,
  buildMergedGeometry,
  freezeStaticMatrices,
  type ColoredGeometryPart,
  type GeometryPart,
} from '@/utils/mergeHelpers';
import { GAMING_ROOM_CONFIG } from '@/config/themeConfig';
import { usePortfolioStore } from '@/stores/portfolioStore';
import {
  createGameShelfAtlasTexture,
  getCartridgeUvRect,
  getGameCaseFullUvRect,
} from '@/utils/step6Textures';
import { useThemed } from '@/utils/themeRegistry';

/**
 * Creates a MeshStandardMaterial supporting per-instance UV sub-rectangles (aUvRect vec4)
 * injected directly after Three.js uv_vertex so 16 cases and 5 cartridges share 1 atlas cleanly.
 */
function createInstancedAtlasMaterial(map: THREE.Texture | null): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    map: map ?? undefined,
    roughness: 0.42,
    metalness: 0.08,
  });
  mat.customProgramCacheKey = () => 'step6-instanced-atlas-uv-v1';
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', 'attribute vec4 aUvRect;\n#include <common>')
      .replace(
        '#include <uv_vertex>',
        '#include <uv_vertex>\n#ifdef USE_MAP\n  vMapUv = aUvRect.xy + vMapUv * aUvRect.zw;\n#endif'
      );
  };
  return mat;
}

/**
 * Customizes a box template geometry so its front (+Z) face shows the spine (u in [0.785..0.995]),
 * left/right (+/-X) sides show full front cover art (u in [0.01..0.77]),
 * and top/bottom/back edges sample a dark solid corner band.
 */
function createGameCaseGeometry(): THREE.BoxGeometry {
  const geo = new THREE.BoxGeometry(0.024, 0.19, 0.135);
  const uv = geo.getAttribute('uv');
  const norm = geo.getAttribute('normal');

  for (let i = 0; i < uv.count; i++) {
    const nx = norm.getX(i);
    const nz = norm.getZ(i);
    const u = uv.getX(i);
    const v = uv.getY(i);

    if (nz > 0.5) {
      // Outward spine face
      uv.setXY(i, 0.785 + u * 0.21, 0.02 + v * 0.96);
    } else if (Math.abs(nx) > 0.5) {
      // Side faces carry full cover art
      uv.setXY(i, 0.01 + u * 0.76, 0.02 + v * 0.96);
    } else {
      // Edge plastic
      uv.setXY(i, 0.02, 0.96);
    }
  }
  uv.needsUpdate = true;
  return geo;
}

/**
 * Retro cartridge template mapping front (+Z) face to full cartridge sticker tile
 * and other faces to textured shell dark edge.
 */
function createCartridgeGeometry(): THREE.BoxGeometry {
  const geo = new THREE.BoxGeometry(0.11, 0.092, 0.022);
  const uv = geo.getAttribute('uv');
  const norm = geo.getAttribute('normal');
  for (let i = 0; i < uv.count; i++) {
    if (norm.getZ(i) > 0.5) {
      uv.setXY(i, 0.02 + uv.getX(i) * 0.96, 0.04 + uv.getY(i) * 0.92);
    } else {
      uv.setXY(i, 0.03, 0.92);
    }
  }
  uv.needsUpdate = true;
  return geo;
}

/**
 * GameCollectionShelf — 3-tier oak wall shelf on South-East wall above Gym Rack (5-6 draws total):
 * Row 1: Retro Console + 2 Pads + 5 Instanced Cartridges
 * Row 2: 16 Instanced Game Cases + Stylized VR Headset + Voxel Knight Figure (hidden in Low quality)
 * Row 3: Golden Pull Shark Trophy + Emissive Pixel Heart Lamp + Tiny Potted Plant + Handheld Console
 */
export default function GameCollectionShelf() {
  const groupRef = useRef<THREE.Group>(null);
  const casesRef = useRef<THREE.InstancedMesh>(null);
  const cartsRef = useRef<THREE.InstancedMesh>(null);
  const isLow = usePortfolioStore((s) => s.graphicsQuality === 'low');

  const cfg = GAMING_ROOM_CONFIG.gameCollectionShelf;
  const gameAtlas = useMemo(() => createGameShelfAtlasTexture(), []);

  const merged = useMemo(() => {
    const [y1, y2, y3] = cfg.shelfYs;
    const t1 = y1 + cfg.thickness / 2;
    const t2 = y2 + cfg.thickness / 2;
    const t3 = y3 + cfg.thickness / 2;
    const cz = cfg.depth / 2;

    // 1. 3 Oak Floating Shelf Planks
    const oakGeo = buildMergedGeometry([
      { geometry: new RoundedBoxGeometry(cfg.width, cfg.thickness, cfg.depth, 2, 0.005), position: [0, y1, cz] },
      { geometry: new RoundedBoxGeometry(cfg.width, cfg.thickness, cfg.depth, 2, 0.005), position: [0, y2, cz] },
      { geometry: new RoundedBoxGeometry(cfg.width, cfg.thickness, cfg.depth, 2, 0.005), position: [0, y3, cz] },
    ]);

    // 2. Brackets + Console + 2 Pads + Pull Shark Trophy + Handheld + Tiny Plant
    const staticParts: ColoredGeometryPart[] = [
      // Vertical black steel shelf frame uprights flush to wall
      { geometry: new THREE.BoxGeometry(0.024, 0.92, 0.022), position: [-0.76, y2, 0.012], color: '#171921' },
      { geometry: new THREE.BoxGeometry(0.024, 0.92, 0.022), position: [0.76, y2, 0.012], color: '#171921' },

      // ROW 1: Two-Tone Retro Console [-0.52, t1, 0.10]
      { geometry: new RoundedBoxGeometry(0.26, 0.044, 0.16, 2, 0.006), position: [-0.52, t1 + 0.022, 0.1], color: '#272a36' },
      { geometry: new THREE.BoxGeometry(0.24, 0.018, 0.15), position: [-0.52, t1 + 0.046, 0.1], color: '#d6d3cb' },
      { geometry: new THREE.BoxGeometry(0.11, 0.012, 0.024), position: [-0.52, t1 + 0.056, 0.09], color: '#11131a' },
      { geometry: new THREE.BoxGeometry(0.014, 0.006, 0.008), position: [-0.42, t1 + 0.024, 0.181], color: '#f97316' },

      // 2 Compact Wired Retro Pads sitting beside console
      { geometry: new RoundedBoxGeometry(0.1, 0.016, 0.05, 2, 0.005), position: [-0.24, t1 + 0.008, 0.12], rotation: [0, 0.25, 0], color: '#d1d5db' },
      { geometry: new THREE.BoxGeometry(0.024, 0.006, 0.014), position: [-0.27, t1 + 0.018, 0.12], rotation: [0, 0.25, 0], color: '#1e293b' },
      { geometry: new THREE.SphereGeometry(0.006, 8, 8), position: [-0.21, t1 + 0.018, 0.12], color: '#e11d48' },

      { geometry: new RoundedBoxGeometry(0.1, 0.016, 0.05, 2, 0.005), position: [-0.07, t1 + 0.008, 0.11], rotation: [0, -0.2, 0], color: '#d1d5db' },
      { geometry: new THREE.BoxGeometry(0.024, 0.006, 0.014), position: [-0.1, t1 + 0.018, 0.11], rotation: [0, -0.2, 0], color: '#1e293b' },
      { geometry: new THREE.SphereGeometry(0.006, 8, 8), position: [-0.04, t1 + 0.018, 0.11], color: '#e11d48' },

      // ROW 3: Golden "Pull Shark" Trophy [-0.56, t3, 0.10]
      { geometry: new THREE.CylinderGeometry(0.042, 0.048, 0.026, 16), position: [-0.56, t3 + 0.013, 0.1], color: '#2b2016' },
      { geometry: new THREE.CylinderGeometry(0.034, 0.04, 0.01, 16), position: [-0.56, t3 + 0.03, 0.1], color: '#f59e0b' },
      // Swept Shark-Fin Gold Silhouette
      { geometry: new THREE.ConeGeometry(0.036, 0.11, 4), position: [-0.56, t3 + 0.088, 0.1], rotation: [0, Math.PI / 4, -0.18], scale: [0.45, 1, 1.15], color: '#fbbf24' },

      // Pixel Heart Lamp dark base [-0.16, t3, 0.10]
      { geometry: new THREE.BoxGeometry(0.11, 0.018, 0.055), position: [-0.16, t3 + 0.009, 0.1], color: '#161820' },

      // Stylized Teal Handheld Console on stand [+0.22, t3, 0.10]
      { geometry: new RoundedBoxGeometry(0.16, 0.074, 0.022, 2, 0.006), position: [0.22, t3 + 0.044, 0.1], rotation: [-0.22, -0.18, 0], color: '#0d9488' },
      { geometry: new THREE.BoxGeometry(0.092, 0.052, 0.004), position: [0.22, t3 + 0.045, 0.112], rotation: [-0.22, -0.18, 0], color: '#0f172a' },
      { geometry: new THREE.CylinderGeometry(0.014, 0.018, 0.014, 10), position: [0.22, t3 + 0.007, 0.09], color: '#1e293b' },

      // Tiny Potted Ceramic Plant [+0.58, t3, 0.10]
      { geometry: new THREE.CylinderGeometry(0.042, 0.032, 0.072, 14), position: [0.58, t3 + 0.036, 0.1], color: '#e5dfd5' },
      { geometry: new THREE.ConeGeometry(0.028, 0.075, 7), position: [0.58, t3 + 0.095, 0.1], color: '#4a7c45' },
      { geometry: new THREE.ConeGeometry(0.022, 0.06, 7), position: [0.555, t3 + 0.088, 0.115], rotation: [0.25, 0, 0.45], color: '#3b6837' },
      { geometry: new THREE.ConeGeometry(0.022, 0.06, 7), position: [0.605, t3 + 0.088, 0.09], rotation: [-0.2, 0, -0.45], color: '#5c9456' },
    ];

    // 3. Emissive Pixel Heart Lamp voxels centered on base [-0.16, t3 + 0.02, 0.10]
    const px = 0.017;
    const heartPattern = [
      ' 11 11 ',
      '1111111',
      '1111111',
      ' 11111 ',
      '  111  ',
      '   1   ',
    ];
    const heartParts: GeometryPart[] = [];
    heartPattern.forEach((rowStr, rIdx) => {
      for (let cIdx = 0; cIdx < rowStr.length; cIdx++) {
        if (rowStr[cIdx] === '1') {
          heartParts.push({
            geometry: new THREE.BoxGeometry(px * 0.95, px * 0.95, px * 1.15),
            position: [-0.16 + (cIdx - 3) * px, t3 + 0.118 - rIdx * px, 0.1],
          });
        }
      }
    });

    // 4. High-Quality Detailed Collectibles (Row 2: Stylized VR Headset & Voxel Knight)
    const highDetailParts: ColoredGeometryPart[] = [
      // Stylized VR Headset & Halo Strap [+0.54, t2, 0.10]
      { geometry: new RoundedBoxGeometry(0.155, 0.078, 0.08, 2, 0.024), position: [0.54, t2 + 0.044, 0.11], rotation: [0, -0.25, 0], color: '#eceef3' },
      { geometry: new THREE.BoxGeometry(0.14, 0.058, 0.016), position: [0.525, t2 + 0.044, 0.148], rotation: [0, -0.25, 0], color: '#111622' },
      { geometry: new THREE.TorusGeometry(0.056, 0.008, 8, 20, Math.PI * 1.35), position: [0.555, t2 + 0.052, 0.068], rotation: [Math.PI / 2, 0, -0.45], color: '#272c38' },

      // Voxel Knight Collectible Figure [+0.28, t2, 0.10]
      { geometry: new THREE.BoxGeometry(0.05, 0.01, 0.05), position: [0.28, t2 + 0.005, 0.1], color: '#1e293b' },
      { geometry: new THREE.BoxGeometry(0.036, 0.056, 0.028), position: [0.28, t2 + 0.038, 0.1], color: '#38bdf8' },
      { geometry: new THREE.BoxGeometry(0.044, 0.044, 0.042), position: [0.28, t2 + 0.088, 0.1], color: '#cbd5e1' },
      { geometry: new THREE.BoxGeometry(0.028, 0.01, 0.045), position: [0.28, t2 + 0.09, 0.104], color: '#0f172a' },
      { geometry: new THREE.BoxGeometry(0.01, 0.034, 0.048), position: [0.28, t2 + 0.12, 0.1], color: '#f43f5e' },
      // Tiny voxel shield
      { geometry: new THREE.BoxGeometry(0.008, 0.046, 0.034), position: [0.255, t2 + 0.042, 0.112], rotation: [0, 0.3, 0], color: '#fbbf24' },
    ];

    // 5. Game Case & Cartridge Templates with per-instance aUvRect attribute
    const caseGeo = createGameCaseGeometry();
    const caseRects = new Float32Array(16 * 4);
    for (let i = 0; i < 16; i++) {
      caseRects.set(getGameCaseFullUvRect(i), i * 4);
    }
    caseGeo.setAttribute('aUvRect', new THREE.InstancedBufferAttribute(caseRects, 4));

    const cartGeo = createCartridgeGeometry();
    const cartRects = new Float32Array(5 * 4);
    for (let i = 0; i < 5; i++) {
      cartRects.set(getCartridgeUvRect(i), i * 4);
    }
    cartGeo.setAttribute('aUvRect', new THREE.InstancedBufferAttribute(cartRects, 4));

    return {
      oakGeo,
      staticGeo: buildMergedColoredGeometry(staticParts),
      heartGeo: buildMergedGeometry(heartParts),
      highDetailGeo: buildMergedColoredGeometry(highDetailParts),
      caseGeo,
      cartGeo,
    };
  }, [cfg]);

  const materials = useMemo(() => {
    return {
      oak: new THREE.MeshStandardMaterial({
        color: cfg.oakColor,
        roughness: 0.65,
        metalness: 0.05,
      }),
      vertexColor: new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.45,
        metalness: 0.25,
      }),
      heartLamp: new THREE.MeshBasicMaterial({
        color: '#ff2e63',
        toneMapped: false,
      }),
      atlasInstanced: createInstancedAtlasMaterial(gameAtlas),
    };
  }, [cfg.oakColor, gameAtlas]);

  useThemed(
    materials.heartLamp,
    {
      day: { color: '#ff2e63', intensity: 0.65 },
      night: { color: '#ff2e63', intensity: 1.45 },
    },
    [materials.heartLamp]
  );

  useLayoutEffect(() => {
    const [, y1, y2] = [cfg.shelfYs[0], cfg.shelfYs[0], cfg.shelfYs[1]];
    const t1 = y1 + cfg.thickness / 2;
    const t2 = y2 + cfg.thickness / 2;
    const dummy = new THREE.Object3D();

    // Place 16 game cases cleanly across Row 2 [-0.68..+0.06] (14 upright + 2 angled showcase end-caps)
    if (casesRef.current) {
      for (let i = 0; i < 16; i++) {
        if (i < 13) {
          dummy.position.set(-0.68 + i * 0.032, t2 + 0.095, 0.112);
          dummy.rotation.set(0, 0, i === 12 ? -0.14 : 0);
        } else if (i === 13) {
          // Leaning showcase end case facing slightly outward to show cover artwork
          dummy.position.set(-0.23, t2 + 0.095, 0.115);
          dummy.rotation.set(-0.08, -0.58, -0.12);
        } else {
          // 2 small horizontal stacked cases beside Knight
          dummy.position.set(0.02, t2 + 0.012 + (i - 14) * 0.0245, 0.105);
          dummy.rotation.set(0, 0.15 * (i - 14), Math.PI / 2);
        }
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        casesRef.current.setMatrixAt(i, dummy.matrix);
      }
      casesRef.current.instanceMatrix.needsUpdate = true;
      casesRef.current.computeBoundingSphere();
    }

    // Place 5 retro cartridges stepped upright on Row 1 [+0.20..+0.68]
    if (cartsRef.current) {
      for (let i = 0; i < 5; i++) {
        dummy.position.set(0.18 + i * 0.132, t1 + 0.046, 0.115);
        dummy.rotation.set(-0.18, -0.1 + (i % 2) * 0.08, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        cartsRef.current.setMatrixAt(i, dummy.matrix);
      }
      cartsRef.current.instanceMatrix.needsUpdate = true;
      cartsRef.current.computeBoundingSphere();
    }

    freezeStaticMatrices(groupRef.current);
  }, [cfg, isLow]);

  useEffect(() => {
    return () => {
      merged.oakGeo.dispose();
      merged.staticGeo.dispose();
      merged.heartGeo.dispose();
      merged.highDetailGeo.dispose();
      merged.caseGeo.dispose();
      merged.cartGeo.dispose();
      Object.values(materials).forEach((m) => m.dispose());
      gameAtlas?.dispose();
    };
  }, [merged, materials, gameAtlas]);

  return (
    <group
      ref={groupRef}
      name="game-collection-shelf"
      position={cfg.position}
      rotation={[0, cfg.rotationY, 0]}
    >
      <mesh geometry={merged.oakGeo} material={materials.oak} />
      <mesh geometry={merged.staticGeo} material={materials.vertexColor} />
      <mesh geometry={merged.heartGeo} material={materials.heartLamp} />
      <instancedMesh
        ref={casesRef}
        args={[merged.caseGeo, materials.atlasInstanced, 16]}
      />
      <instancedMesh
        ref={cartsRef}
        args={[merged.cartGeo, materials.atlasInstanced, 5]}
      />
      {!isLow && <mesh geometry={merged.highDetailGeo} material={materials.vertexColor} />}
    </group>
  );
}
