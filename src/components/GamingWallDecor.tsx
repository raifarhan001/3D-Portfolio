'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { buildMergedGeometry, freezeStaticMatrices, type GeometryPart } from '@/utils/mergeHelpers';
import { GAMING_ROOM_CONFIG } from '@/config/themeConfig';
import { useArcadeStore } from '@/stores/arcadeStore';
import { useThemed } from '@/utils/themeRegistry';
import {
  POSTER_ATLAS_METRICS,
  createGamingPostersAtlasTexture,
  createHighScoreBoardTexture,
  createNeonSignsAtlasTexture,
  redrawHighScoreBoardTexture,
} from '@/utils/step6Textures';

interface PosterSlotSpec {
  offset: [number, number];
  w: number;
  h: number;
  featured?: boolean;
}

const POSTER_SLOTS: ReadonlyArray<PosterSlotSpec> = [
  { offset: [0.0, 0.0], w: 0.46, h: 0.62, featured: true }, // Synthwave Horizon
  { offset: [-0.5, 0.22], w: 0.4, h: 0.3 }, // Pixel Night Skyline
  { offset: [-0.5, -0.22], w: 0.4, h: 0.44, featured: true }, // INSERT COIN
  { offset: [0.51, 0.2], w: 0.42, h: 0.38 }, // ACHIEVEMENT UNLOCKED
  { offset: [0.51, -0.24], w: 0.42, h: 0.36 }, // KEYCAP EXPLODED
];

/**
 * Helper to create a poster artwork plane mapped to its exact Posters Atlas slot.
 */
function createMappedPosterPlane(
  w: number,
  h: number,
  uv: { u0: number; v0: number; u1: number; v1: number }
): THREE.PlaneGeometry {
  const geo = new THREE.PlaneGeometry(w, h);
  const attr = geo.getAttribute('uv');
  const du = uv.u1 - uv.u0;
  const dv = uv.v1 - uv.v0;
  for (let i = 0; i < attr.count; i++) {
    attr.setXY(i, uv.u0 + attr.getX(i) * du, uv.v0 + attr.getY(i) * dv);
  }
  attr.needsUpdate = true;
  return geo;
}

/**
 * Maps a unit PlaneGeometry sub-rect [u0..u1] for left/right halves of the Neon Signs Atlas.
 */
function createNeonQuad(w: number, h: number, u0: number, u1: number): THREE.PlaneGeometry {
  const geo = new THREE.PlaneGeometry(w, h);
  const attr = geo.getAttribute('uv');
  for (let i = 0; i < attr.count; i++) {
    attr.setXY(i, u0 + attr.getX(i) * (u1 - u0), attr.getY(i));
  }
  attr.needsUpdate = true;
  return geo;
}

function readStoredHighScore(storageKey: string): number {
  if (typeof window === 'undefined') return 0;
  try {
    const parsed = Number(window.localStorage.getItem(storageKey) ?? '0');
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
  } catch {
    return 0;
  }
}

/**
 * GamingWallDecor — 3 cohesive wall decor units in 6 draw calls:
 * 1) 5 Gaming Posters above Gramophone (Instanced frames + merged rims + 1 2048x1024 Atlas)
 * 2) 2 Transparent Neon Signs ("LEVEL UP" South-East + Pixel Controller South-West) on 1 Atlas
 * 3) High Score LED Board above Arcade Cabinet updating ONLY when high score changes & <= 8m
 */
export default function GamingWallDecor() {
  const groupRef = useRef<THREE.Group>(null);
  const posterFramesRef = useRef<THREE.InstancedMesh>(null);
  const lastDrawnScoreRef = useRef<number>(-1);
  const pendingScoreRef = useRef<number | null>(null);

  const highScoreStore = useArcadeStore((s) => s.highScore);
  const postersCfg = GAMING_ROOM_CONFIG.postersCluster;
  const neonCfg = GAMING_ROOM_CONFIG.neonSigns;
  const boardCfg = GAMING_ROOM_CONFIG.highScoreBoard;

  const textures = useMemo(() => {
    const initialScore = Math.max(
      useArcadeStore.getState().highScore,
      readStoredHighScore(boardCfg.highScoreKey)
    );
    return {
      postersAtlas: createGamingPostersAtlasTexture(),
      neonAtlas: createNeonSignsAtlasTexture(),
      highScoreBoard: createHighScoreBoardTexture(initialScore, boardCfg.labelName),
      initialScore,
    };
  }, [boardCfg.highScoreKey, boardCfg.labelName]);

  const geos = useMemo(() => {
    const [cx, cy, cz] = postersCfg.position;
    const mRoot = new THREE.Matrix4().compose(
      new THREE.Vector3(cx, cy, cz),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, postersCfg.rotationY, 0)),
      new THREE.Vector3(1, 1, 1)
    );

    const artParts: GeometryPart[] = [];
    const rimParts: GeometryPart[] = [];
    const worldPos = new THREE.Vector3();
    const worldQuat = new THREE.Quaternion();
    const worldEuler = new THREE.Euler();

    POSTER_SLOTS.forEach((slot, idx) => {
      const mLocal = new THREE.Matrix4().makeTranslation(slot.offset[0], slot.offset[1], 0.017);
      const mCombined = new THREE.Matrix4().multiplyMatrices(mRoot, mLocal);
      const s = new THREE.Vector3();
      mCombined.decompose(worldPos, worldQuat, s);
      worldEuler.setFromQuaternion(worldQuat, 'XYZ');

      artParts.push({
        geometry: createMappedPosterPlane(slot.w - 0.022, slot.h - 0.022, POSTER_ATLAS_METRICS.slots[idx]),
        position: [worldPos.x, worldPos.y, worldPos.z],
        rotation: [worldEuler.x, worldEuler.y, worldEuler.z],
      });

      if (slot.featured) {
        const t = 0.008;
        const rimOffsets: Array<[THREE.BoxGeometry, number, number]> = [
          [new THREE.BoxGeometry(slot.w + t * 2, t, 0.006), 0, slot.h / 2 + t / 2],
          [new THREE.BoxGeometry(slot.w + t * 2, t, 0.006), 0, -slot.h / 2 - t / 2],
          [new THREE.BoxGeometry(t, slot.h, 0.006), -slot.w / 2 - t / 2, 0],
          [new THREE.BoxGeometry(t, slot.h, 0.006), slot.w / 2 + t / 2, 0],
        ];
        for (const [boxGeo, ox, oy] of rimOffsets) {
          const mRim = new THREE.Matrix4().makeTranslation(slot.offset[0] + ox, slot.offset[1] + oy, 0.009);
          const mRimWorld = new THREE.Matrix4().multiplyMatrices(mRoot, mRim);
          mRimWorld.decompose(worldPos, worldQuat, s);
          worldEuler.setFromQuaternion(worldQuat, 'XYZ');
          rimParts.push({
            geometry: boxGeo,
            position: [worldPos.x, worldPos.y, worldPos.z],
            rotation: [worldEuler.x, worldEuler.y, worldEuler.z],
          });
        }
      }
    });

    // 2 Transparent Neon Signs merged into ONE single quad mesh
    const neonParts: GeometryPart[] = [
      {
        geometry: createNeonQuad(neonCfg.levelUp.width, neonCfg.levelUp.height, 0.0, 0.5),
        position: neonCfg.levelUp.position,
        rotation: [0, neonCfg.levelUp.rotationY, 0],
      },
      {
        geometry: createNeonQuad(neonCfg.controllerIcon.width, neonCfg.controllerIcon.height, 0.5, 1.0),
        position: neonCfg.controllerIcon.position,
        rotation: [0, neonCfg.controllerIcon.rotationY, 0],
      },
    ];

    return {
      frameTemplate: new THREE.BoxGeometry(1, 1, 0.016),
      postersArtGeo: buildMergedGeometry(artParts),
      postersRimGeo: buildMergedGeometry(rimParts),
      neonSignsGeo: buildMergedGeometry(neonParts),
      boardFrameGeo: new THREE.BoxGeometry(boardCfg.width + 0.04, boardCfg.height + 0.04, 0.022),
      boardScreenGeo: new THREE.PlaneGeometry(boardCfg.width, boardCfg.height),
    };
  }, [postersCfg, neonCfg, boardCfg.width, boardCfg.height]);

  const materials = useMemo(() => {
    return {
      frameDark: new THREE.MeshStandardMaterial({
        color: '#141720',
        roughness: 0.48,
        metalness: 0.35,
      }),
      postersArt: new THREE.MeshStandardMaterial({
        map: textures.postersAtlas ?? undefined,
        roughness: 0.42,
        metalness: 0.06,
      }),
      posterNeonRim: new THREE.MeshBasicMaterial({
        color: '#22d3ee',
        toneMapped: false,
      }),
      neonSigns: new THREE.MeshBasicMaterial({
        map: textures.neonAtlas ?? undefined,
        color: '#ffffff',
        transparent: true,
        alphaTest: 0.05,
        toneMapped: false,
      }),
      highScoreScreen: new THREE.MeshBasicMaterial({
        map: textures.highScoreBoard ?? undefined,
        color: '#ffffff',
        toneMapped: false,
      }),
    };
  }, [textures]);

  useThemed(
    materials.posterNeonRim,
    {
      day: { color: '#38bdf8', intensity: 0.35 },
      night: { color: '#22d3ee', intensity: 1.15 },
    },
    [materials.posterNeonRim]
  );

  useThemed(
    materials.neonSigns,
    {
      day: { color: '#ffffff', intensity: 0.3 },
      night: { color: '#ffffff', intensity: 1.05 },
    },
    [materials.neonSigns]
  );

  useThemed(
    materials.highScoreScreen,
    {
      day: { color: '#ffffff', intensity: 0.85 },
      night: { color: '#ffffff', intensity: 1.15 },
    },
    [materials.highScoreScreen]
  );

  // Sync High Score LED Board on store change or storage event (only draws on change)
  useEffect(() => {
    const activeBest = Math.max(highScoreStore, readStoredHighScore(boardCfg.highScoreKey));
    if (lastDrawnScoreRef.current === -1) {
      lastDrawnScoreRef.current = textures.initialScore;
    }
    if (activeBest !== lastDrawnScoreRef.current) {
      pendingScoreRef.current = activeBest;
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key === boardCfg.highScoreKey) {
        const nextVal = readStoredHighScore(boardCfg.highScoreKey);
        if (nextVal !== lastDrawnScoreRef.current) {
          pendingScoreRef.current = nextVal;
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [highScoreStore, boardCfg.highScoreKey, textures.initialScore]);

  useFrame((state) => {
    if (pendingScoreRef.current === null) return;
    const dx = state.camera.position.x - boardCfg.position[0];
    const dz = state.camera.position.z - boardCfg.position[2];
    if (dx * dx + dz * dz <= boardCfg.cullDistSq) {
      redrawHighScoreBoardTexture(
        textures.highScoreBoard,
        pendingScoreRef.current,
        boardCfg.labelName
      );
      lastDrawnScoreRef.current = pendingScoreRef.current;
      pendingScoreRef.current = null;
    }
  });

  useLayoutEffect(() => {
    const frames = posterFramesRef.current;
    if (frames) {
      const mRoot = new THREE.Matrix4().compose(
        new THREE.Vector3(...postersCfg.position),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, postersCfg.rotationY, 0)),
        new THREE.Vector3(1, 1, 1)
      );
      const mLocal = new THREE.Matrix4();
      const dummy = new THREE.Object3D();

      POSTER_SLOTS.forEach((slot, idx) => {
        mLocal.compose(
          new THREE.Vector3(slot.offset[0], slot.offset[1], 0.008),
          new THREE.Quaternion(),
          new THREE.Vector3(slot.w, slot.h, 1)
        );
        dummy.matrix.multiplyMatrices(mRoot, mLocal);
        frames.setMatrixAt(idx, dummy.matrix);
      });
      frames.instanceMatrix.needsUpdate = true;
      frames.computeBoundingSphere();
    }
    freezeStaticMatrices(groupRef.current);
  }, [postersCfg]);

  useEffect(() => {
    return () => {
      geos.frameTemplate.dispose();
      geos.postersArtGeo.dispose();
      geos.postersRimGeo.dispose();
      geos.neonSignsGeo.dispose();
      geos.boardFrameGeo.dispose();
      geos.boardScreenGeo.dispose();
      Object.values(materials).forEach((m) => m.dispose());
      textures.postersAtlas?.dispose();
      textures.neonAtlas?.dispose();
      textures.highScoreBoard?.dispose();
    };
  }, [geos, materials, textures]);

  return (
    <group ref={groupRef} name="gaming-wall-decor">
      {/* 1. 5 Gaming Posters above Gramophone (Instanced Frames + 2 Edge Rims + Atlas Planes) */}
      <instancedMesh
        ref={posterFramesRef}
        args={[geos.frameTemplate, materials.frameDark, POSTER_SLOTS.length]}
      />
      <mesh geometry={geos.postersArtGeo} material={materials.postersArt} />
      <mesh geometry={geos.postersRimGeo} material={materials.posterNeonRim} />

      {/* 2. 2 Transparent Neon Signs ("LEVEL UP" & Pixel Controller) on 1 Atlas */}
      <mesh geometry={geos.neonSignsGeo} material={materials.neonSigns} />

      {/* 3. High Score LED Board directly above Arcade Cabinet */}
      <group position={boardCfg.position} rotation={[0, boardCfg.rotationY, 0]}>
        <mesh position={[0, 0, 0.011]} geometry={geos.boardFrameGeo} material={materials.frameDark} />
        <mesh position={[0, 0, 0.023]} geometry={geos.boardScreenGeo} material={materials.highScoreScreen} />
      </group>
    </group>
  );
}
