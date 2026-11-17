'use client';

import { useMemo, useRef, useState, useEffect, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { GRAMOPHONE_CONFIG, type GramophoneTrack } from '@/config/roomConfig';
import { useTvStore } from '@/stores/tvStore';
import { usePcStore } from '@/stores/pcStore';
import { buildMergedGeometry, freezeStaticMatrices, type GeometryPart } from '@/utils/mergeHelpers';

/**
 * Generates a crisp procedural CanvasTexture label for an interactive cassette case.
 */
function createCassetteLabelTexture(track: GramophoneTrack, index: number): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 320;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#15161c';
  ctx.fillRect(0, 0, 512, 320);

  ctx.fillStyle = track.color;
  ctx.fillRect(24, 24, 464, 96);

  ctx.fillStyle = '#f3efe6';
  ctx.fillRect(24, 120, 464, 148);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 30px system-ui, -apple-system, sans-serif';
  ctx.fillText(`CASSETTE 0${index + 1}`, 44, 72);

  ctx.font = '600 20px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.textAlign = 'right';
  ctx.fillText(track.label, 468, 72);
  ctx.textAlign = 'left';

  ctx.fillStyle = '#18181b';
  ctx.font = 'bold 28px system-ui, -apple-system, sans-serif';
  ctx.fillText(track.title, 44, 168);

  ctx.fillStyle = '#1f2029';
  ctx.fillRect(110, 192, 292, 56);

  ctx.fillStyle = '#e5e7eb';
  ctx.beginPath();
  ctx.arc(172, 220, 18, 0, Math.PI * 2);
  ctx.arc(340, 220, 18, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#111216';
  ctx.beginPath();
  ctx.arc(172, 220, 8, 0, Math.PI * 2);
  ctx.arc(340, 220, 8, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/**
 * Generates a curved flared gramophone horn geometry via LatheGeometry once.
 */
function createHornGeometry(): THREE.LatheGeometry {
  const points: THREE.Vector2[] = [];
  const steps = 16;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const r = 0.015 + 0.16 * Math.pow(t, 2.6);
    const y = t * 0.36;
    points.push(new THREE.Vector2(r, y));
  }
  return new THREE.LatheGeometry(points, 28);
}

function bakeToGroup(
  parts: GeometryPart[],
  parentPos: [number, number, number],
  parentRot: [number, number, number] = [0, 0, 0]
): GeometryPart[] {
  const mParent = new THREE.Matrix4().compose(
    new THREE.Vector3(...parentPos),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...parentRot, 'XYZ')),
    new THREE.Vector3(1, 1, 1)
  );
  const mChild = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const scale = new THREE.Vector3();

  return parts.map((p) => {
    mChild.compose(
      new THREE.Vector3(...(p.position || [0, 0, 0])),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...(p.rotation || [0, 0, 0]), 'XYZ')),
      new THREE.Vector3(...(p.scale || [1, 1, 1]))
    );
    mChild.premultiply(mParent);
    mChild.decompose(pos, quat, scale);
    euler.setFromQuaternion(quat, 'XYZ');
    return {
      geometry: p.geometry,
      position: [pos.x, pos.y, pos.z],
      rotation: [euler.x, euler.y, euler.z],
      scale: [scale.x, scale.y, scale.z],
    };
  });
}

/**
 * GramophoneCorner Component — Merged static table, shelf sleeves, crate & brass horn parts
 * (26 draw calls down from 55; spinning vinyl, swinging tonearm & 5 clickable cassettes remain dynamic).
 */
export default function GramophoneCorner() {
  const gramophoneMode = useTvStore((s) => s.gramophoneMode);
  const gramophonePlaying = useTvStore((s) => s.gramophonePlaying);
  const gramophoneTrackId = useTvStore((s) => s.gramophoneTrackId);
  const tvExiting = useTvStore((s) => s.tvExiting);

  const [hoveredTrackId, setHoveredTrackId] = useState<string | null>(null);

  const rootGroupRef = useRef<THREE.Group>(null);
  const recordRef = useRef<THREE.Group>(null);
  const tonearmRef = useRef<THREE.Group>(null);
  const cassetteGroupRefs = useRef<Array<THREE.Group | null>>([]);

  const canClickCassettes = gramophoneMode && !tvExiting;

  useLayoutEffect(() => {
    freezeStaticMatrices(rootGroupRef.current);
  }, []);

  useEffect(() => {
    if (!canClickCassettes) {
      document.body.style.cursor = 'auto';
    }
    return () => {
      document.body.style.cursor = 'auto';
    };
  }, [canClickCassettes]);

  const cassetteTextures = useMemo(() => {
    return GRAMOPHONE_CONFIG.tracks.map((track, idx) => createCassetteLabelTexture(track, idx));
  }, []);

  const activeTrack = useMemo(() => {
    return GRAMOPHONE_CONFIG.tracks.find((t) => t.id === gramophoneTrackId) || null;
  }, [gramophoneTrackId]);

  const merged = useMemo(() => {
    const tableW = 1.06;
    const tableD = 0.62;
    const tableH = 0.74;
    const gramoPos: [number, number, number] = [-0.22, tableH, 0.03];
    const cratePos: [number, number, number] = [0.25, tableH, 0.05];
    const crateRot: [number, number, number] = [0, -0.18, 0];

    const legCoords = [
      [-tableW / 2 + 0.08, 0, -tableD / 2 + 0.08],
      [tableW / 2 - 0.08, 0, -tableD / 2 + 0.08],
      [-tableW / 2 + 0.08, 0, tableD / 2 - 0.08],
      [tableW / 2 - 0.08, 0, tableD / 2 - 0.08],
    ];

    const gunmetalGeo = buildMergedGeometry(
      legCoords.map(([lx, , lz]) => ({
        geometry: new THREE.CylinderGeometry(0.02, 0.014, tableH - 0.04, 12),
        position: [lx, (tableH - 0.04) / 2, lz],
      }))
    );

    const tableWalnutGeo = buildMergedGeometry([
      { geometry: new RoundedBoxGeometry(tableW - 0.14, 0.026, tableD - 0.14, 2, 0.008), position: [0, 0.22, 0] },
      { geometry: new RoundedBoxGeometry(tableW - 0.08, 0.09, tableD - 0.08, 2, 0.01), position: [0, tableH - 0.085, 0] },
      { geometry: new RoundedBoxGeometry(tableW, 0.042, tableD, 2, 0.014), position: [0, tableH - 0.021, 0] },
      // Crank wood handle grip on gramophone
      ...bakeToGroup(
        [{ geometry: new THREE.CylinderGeometry(0.01, 0.01, 0.032, 10), position: [0.235, 0.007, 0.03], rotation: [0, 0, Math.PI / 2] }],
        gramoPos
      ),
    ]);

    const shelfSleevesGeo = buildMergedGeometry(
      [-0.25, -0.21, -0.17].map((sx) => ({
        geometry: new THREE.BoxGeometry(0.018, 0.24, 0.26),
        position: [sx, 0.34, 0],
        rotation: [0, 0, -0.08],
      }))
    );

    const crateWalnutGeo = buildMergedGeometry([
      ...bakeToGroup(
        [{ geometry: new RoundedBoxGeometry(0.38, 0.105, 0.38, 2, 0.014), position: [0, 0.0525, 0] }],
        gramoPos
      ),
      ...bakeToGroup(
        [
          { geometry: new RoundedBoxGeometry(0.35, 0.02, 0.34, 2, 0.006), position: [0, 0.01, 0] },
          { geometry: new THREE.BoxGeometry(0.35, 0.12, 0.02), position: [0, 0.07, -0.16] },
          { geometry: new THREE.BoxGeometry(0.02, 0.1, 0.32), position: [-0.165, 0.06, 0] },
          { geometry: new THREE.BoxGeometry(0.02, 0.1, 0.32), position: [0.165, 0.06, 0] },
          { geometry: new THREE.BoxGeometry(0.35, 0.065, 0.02), position: [0, 0.04, 0.16] },
        ],
        cratePos,
        crateRot
      ),
    ]);

    const hornGeo = createHornGeometry();
    const brassParts: GeometryPart[] = [
      ...legCoords.map(([lx, , lz]) => ({
        geometry: new THREE.CylinderGeometry(0.015, 0.014, 0.05, 12),
        position: [lx, 0.025, lz] as [number, number, number],
      })),
      { geometry: new THREE.BoxGeometry(0.18, 0.012, 0.016), position: [0, tableH - 0.085, tableD / 2 - 0.032] },
      { geometry: new THREE.BoxGeometry(tableW - 0.04, 0.006, 0.006), position: [0, tableH - 0.038, tableD / 2 - 0.002] },
      ...bakeToGroup(
        [
          { geometry: new THREE.BoxGeometry(0.395, 0.022, 0.395), position: [0, 0.012, 0] },
          { geometry: new THREE.CylinderGeometry(0.014, 0.016, 0.02, 14), position: [0.13, 0.11, 0.14] },
          { geometry: new THREE.CylinderGeometry(0.007, 0.007, 0.05, 10), position: [0.195, 0.055, 0.03], rotation: [0, 0, Math.PI / 2] },
          { geometry: new THREE.BoxGeometry(0.01, 0.055, 0.01), position: [0.22, 0.03, 0.03] },
          { geometry: new THREE.CylinderGeometry(0.152, 0.156, 0.014, 32), position: [0, 0.11, 0] },
          { geometry: new THREE.CylinderGeometry(0.016, 0.024, 0.16, 14), position: [-0.12, 0.185, -0.12] },
          { geometry: new THREE.CylinderGeometry(0.018, 0.016, 0.09, 14), position: [-0.1, 0.28, -0.1], rotation: [0.45, 0.35, -0.25] },
          { geometry: hornGeo, position: [-0.075, 0.315, -0.075], rotation: [0.88, 0.25, -0.35] },
        ],
        gramoPos
      ),
      ...bakeToGroup(
        [{ geometry: new THREE.BoxGeometry(0.14, 0.024, 0.005), position: [0, 0.042, 0.172] }],
        cratePos,
        crateRot
      ),
    ];

    return {
      gunmetalGeo,
      tableWalnutGeo,
      shelfSleevesGeo,
      crateWalnutGeo,
      brassGeo: buildMergedGeometry(brassParts),
    };
  }, []);

  const materials = useMemo(() => {
    return {
      tableWalnut: new THREE.MeshStandardMaterial({ color: '#634632', roughness: 0.6, metalness: 0.06 }),
      crateWalnut: new THREE.MeshStandardMaterial({ color: '#4c3424', roughness: 0.65, metalness: 0.05 }),
      gunmetal: new THREE.MeshStandardMaterial({ color: '#252730', roughness: 0.35, metalness: 0.82 }),
      brass: new THREE.MeshStandardMaterial({
        color: '#c7a254',
        roughness: 0.28,
        metalness: 0.86,
        side: THREE.DoubleSide,
      }),
      vinylBlack: new THREE.MeshStandardMaterial({ color: '#0e0f13', roughness: 0.24, metalness: 0.35 }),
      vinylGrooves: new THREE.MeshStandardMaterial({ color: '#1c1e26', roughness: 0.32, metalness: 0.45 }),
      cassetteShell: new THREE.MeshStandardMaterial({ color: '#1b1d24', roughness: 0.45, metalness: 0.2 }),
      activeGlow: new THREE.MeshBasicMaterial({ color: '#22c55e', toneMapped: false }),
      idleLed: new THREE.MeshBasicMaterial({ color: '#f59e0b', toneMapped: false }),
      vinylLabel: new THREE.MeshStandardMaterial({ color: '#b91c1c', roughness: 0.5 }),
      cassetteFaceMats: cassetteTextures.map(
        (tex, idx) =>
          new THREE.MeshStandardMaterial({
            map: tex,
            color: tex ? '#ffffff' : GRAMOPHONE_CONFIG.tracks[idx].color,
            roughness: 0.45,
            metalness: 0.1,
          })
      ),
    };
  }, [cassetteTextures]);

  useEffect(() => {
    materials.vinylLabel.color.set(activeTrack ? activeTrack.color : '#c7a254');
  }, [activeTrack, materials]);

  useFrame((_, delta) => {
    const pcState = usePcStore.getState();
    if (
      pcState.pcMode &&
      pcState.pcArrived &&
      !pcState.pcExiting &&
      pcState.poweredPC &&
      pcState.bootState === 'desktop'
    ) {
      return;
    }
    const dt = Math.min(delta, 0.1);
    const { gramophonePlaying: playing, gramophoneTrackId: currentId } = useTvStore.getState();

    if (recordRef.current && playing) {
      recordRef.current.rotation.y -= dt * 2.2;
    }

    if (tonearmRef.current) {
      const targetArmY = playing ? 0.36 : -0.24;
      tonearmRef.current.rotation.y = THREE.MathUtils.lerp(
        tonearmRef.current.rotation.y,
        targetArmY,
        Math.min(1, dt * 6)
      );
    }

    GRAMOPHONE_CONFIG.tracks.forEach((track, idx) => {
      const grp = cassetteGroupRefs.current[idx];
      if (!grp) return;
      const isActive = currentId === track.id;
      const isHovered = canClickCassettes && hoveredTrackId === track.id;
      const targetY = isActive ? 0.042 : isHovered ? 0.024 : 0.0;
      grp.position.y = THREE.MathUtils.lerp(grp.position.y, targetY, Math.min(1, dt * 10));
    });
  });

  const tableH = 0.74;

  return (
    <group
      ref={rootGroupRef}
      name="gramophone-corner"
      position={GRAMOPHONE_CONFIG.tablePosition}
      rotation={[0, GRAMOPHONE_CONFIG.tableRotationY, 0]}
    >
      {/* 1. MERGED STATIC TABLE, SHELF SLEEVES, CRATE & BRASS HORN */}
      <mesh geometry={merged.gunmetalGeo} material={materials.gunmetal} userData={{ interactive: 'gramophone' }} />
      <mesh geometry={merged.tableWalnutGeo} material={materials.tableWalnut} userData={{ interactive: 'gramophone' }} />
      <mesh geometry={merged.shelfSleevesGeo} material={materials.cassetteShell} userData={{ interactive: 'gramophone' }} />
      <mesh geometry={merged.crateWalnutGeo} material={materials.crateWalnut} userData={{ interactive: 'gramophone' }} />
      <mesh geometry={merged.brassGeo} material={materials.brass} userData={{ interactive: 'gramophone' }} />

      {/* 2. DYNAMIC GRAMOPHONE PARTS (LED, Spinning Vinyl, Swinging Tonearm) */}
      <group position={[-0.22, tableH, 0.03]}>
        <mesh position={[-0.13, 0.06, 0.192]} material={gramophonePlaying ? materials.activeGlow : materials.idleLed}>
          <circleGeometry args={[0.008, 12]} />
        </mesh>

        {/* Spinning Vinyl Record */}
        <group ref={recordRef} position={[0, 0.121, 0]} userData={{ dynamicTransform: true }}>
          <mesh material={materials.vinylBlack} userData={{ interactive: 'gramophone', dynamicTransform: true }}>
            <cylinderGeometry args={[0.145, 0.145, 0.006, 36]} />
          </mesh>
          <mesh position={[0, 0.0036, 0]} rotation={[-Math.PI / 2, 0, 0]} material={materials.vinylGrooves} userData={{ dynamicTransform: true }}>
            <ringGeometry args={[0.065, 0.135, 36]} />
          </mesh>
          <mesh position={[0, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]} material={materials.vinylLabel} userData={{ dynamicTransform: true }}>
            <circleGeometry args={[0.05, 28]} />
          </mesh>
          <mesh position={[0, 0.012, 0]} material={materials.brass} userData={{ dynamicTransform: true }}>
            <cylinderGeometry args={[0.005, 0.005, 0.024, 12]} />
          </mesh>
        </group>

        {/* Swinging Brass Tonearm */}
        <group ref={tonearmRef} position={[0.135, 0.145, -0.11]} rotation={[0, -0.24, 0]} userData={{ dynamicTransform: true }}>
          <mesh position={[0, -0.022, 0]} material={materials.brass} userData={{ dynamicTransform: true }}>
            <cylinderGeometry args={[0.018, 0.022, 0.044, 14]} />
          </mesh>
          <mesh position={[-0.04, 0.002, 0.08]} rotation={[Math.PI / 2, 0, 0.42]} material={materials.brass} userData={{ dynamicTransform: true }}>
            <cylinderGeometry args={[0.006, 0.006, 0.18, 10]} />
          </mesh>
          <mesh position={[-0.075, -0.005, 0.16]} rotation={[0, 0.42, 0]} material={materials.gunmetal} userData={{ dynamicTransform: true }}>
            <boxGeometry args={[0.022, 0.014, 0.032]} />
          </mesh>
        </group>
      </group>

      {/* 3. CLICKABLE ANIMATED CASSETTES INSIDE BOX */}
      <group position={[0.25, tableH, 0.05]} rotation={[0, -0.18, 0]}>
        {GRAMOPHONE_CONFIG.tracks.map((track, idx) => {
          const zPos = 0.105 - idx * 0.052;
          const baseHeight = 0.082 + idx * 0.013;
          const isActive = gramophoneTrackId === track.id;
          const isHovered = canClickCassettes && hoveredTrackId === track.id;

          return (
            <group
              key={track.id}
              ref={(el) => {
                cassetteGroupRefs.current[idx] = el;
              }}
              position={[0, 0, zPos]}
              userData={{ dynamicTransform: true }}
            >
              <group
                position={[0, baseHeight, 0]}
                rotation={[-0.18, 0, 0]}
                userData={{ dynamicTransform: true }}
                onPointerOver={(e) => {
                  if (!canClickCassettes) return;
                  e.stopPropagation();
                  setHoveredTrackId(track.id);
                  document.body.style.cursor = 'pointer';
                }}
                onPointerOut={(e) => {
                  if (!canClickCassettes) return;
                  e.stopPropagation();
                  setHoveredTrackId((curr) => (curr === track.id ? null : curr));
                  document.body.style.cursor = 'auto';
                }}
                onClick={(e) => {
                  if (!canClickCassettes) return;
                  e.stopPropagation();
                  useTvStore.getState().playCassette(track.id);
                }}
              >
                <RoundedBox
                  args={[0.25, 0.15, 0.024]}
                  radius={0.006}
                  smoothness={2}
                  userData={{ interactive: 'gramophone', dynamicTransform: true }}
                  material={materials.cassetteShell}
                />
                <mesh position={[0, 0, 0.013]} material={materials.cassetteFaceMats[idx]} userData={{ interactive: 'gramophone', dynamicTransform: true }}>
                  <planeGeometry args={[0.23, 0.134]} />
                </mesh>
                <mesh position={[0, 0.076, 0]} userData={{ interactive: 'gramophone', dynamicTransform: true }}>
                  <boxGeometry args={[0.246, 0.006, 0.022]} />
                  <meshBasicMaterial color={isActive ? '#22c55e' : isHovered ? '#ffffff' : track.color} toneMapped={false} />
                </mesh>
              </group>
            </group>
          );
        })}
      </group>
    </group>
  );
}
