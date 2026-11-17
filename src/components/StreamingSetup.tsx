'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { buildMergedGeometry, freezeStaticMatrices, type GeometryPart } from '@/utils/mergeHelpers';
import { GAMING_CORNER_CONFIG } from '@/config/roomConfig';
import { SMALL_PROPS_UV, createSmallPropsAtlasTexture } from '@/utils/step6Textures';
import { useThemed } from '@/utils/themeRegistry';

/**
 * Builds a cylinder connecting point a -> b with exact length and orientation (zero floating joints).
 */
function buildStrutBetween(
  a: [number, number, number],
  b: [number, number, number],
  rTop: number,
  rBot: number
): GeometryPart {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const dir = vb.clone().sub(va);
  const len = Math.max(dir.length(), 0.001);
  const mid = va.clone().add(vb).multiplyScalar(0.5);
  const quat = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir.normalize()
  );
  const euler = new THREE.Euler().setFromQuaternion(quat, 'XYZ');
  return {
    geometry: new THREE.CylinderGeometry(rTop, rBot, len, 10),
    position: [mid.x, mid.y, mid.z],
    rotation: [euler.x, euler.y, euler.z],
  };
}

/**
 * Applies a sub-rectangle UV mapping from an atlas onto an existing BufferGeometry.
 */
function applyAtlasUvRect(
  geometry: THREE.BufferGeometry,
  uv: { u0: number; v0: number; u1: number; v1: number }
): THREE.BufferGeometry {
  const attr = geometry.getAttribute('uv');
  if (!attr) return geometry;
  const du = uv.u1 - uv.u0;
  const dv = uv.v1 - uv.v0;
  for (let i = 0; i < attr.count; i++) {
    attr.setXY(i, uv.u0 + attr.getX(i) * du, uv.v0 + attr.getY(i) * dv);
  }
  attr.needsUpdate = true;
  return geometry;
}

/**
 * StreamingSetup — Boom arm + condenser mic + pop filter, mini-tripod ring light behind PC,
 * monitor top webcam, 5x3 Stream Deck macro pad, and "ON AIR" illuminated Wall A plaque.
 * All geometry sits inside GamingCorner local desk space (zero clipping, 3 draw calls total).
 */
export default function StreamingSetup() {
  const groupRef = useRef<THREE.Group>(null);
  const deskY = GAMING_CORNER_CONFIG.deskHeight;

  const smallPropsAtlas = useMemo(() => createSmallPropsAtlasTexture(), []);

  useLayoutEffect(() => {
    freezeStaticMatrices(groupRef.current);
  }, []);

  const merged = useMemo(() => {
    const pPostBase: [number, number, number] = [0.62, deskY + 0.015, 0.09];
    const pPostTop: [number, number, number] = [0.62, deskY + 0.085, 0.09];
    const pElbow: [number, number, number] = [0.65, deskY + 0.44, 0.22];
    const pShock: [number, number, number] = [0.89, deskY + 0.275, 0.46];
    const pPop: [number, number, number] = [0.95, deskY + 0.285, 0.525];

    // 1. Unified Dark Matte / Brushed Anodized Hardware (Boom Arm, Mic, Tripod, Webcam, Macro Base, ON AIR Box)
    const hardwareParts: GeometryPart[] = [
      // A. Articulated Boom Arm Mic clamped cleanly at back-left [0.62, deskY, 0.09]
      { geometry: new THREE.BoxGeometry(0.055, 0.05, 0.065), position: [0.62, deskY + 0.01, 0.09] },
      buildStrutBetween(pPostBase, pPostTop, 0.012, 0.012),
      buildStrutBetween(pPostTop, pElbow, 0.009, 0.011),
      { geometry: new THREE.SphereGeometry(0.016, 10, 8), position: pElbow },
      buildStrutBetween(pElbow, pShock, 0.0085, 0.009),
      // Condenser mic body & windscreen capsule angled toward seated gamer
      { geometry: new THREE.SphereGeometry(0.014, 10, 8), position: pShock },
      { geometry: new THREE.CylinderGeometry(0.021, 0.02, 0.1, 14), position: [0.905, deskY + 0.285, 0.47], rotation: [-0.35, -0.35, 0] },
      { geometry: new THREE.SphereGeometry(0.022, 12, 10), position: [0.92, deskY + 0.325, 0.49] },
      // Pop filter gooseneck connecting shock mount directly to mesh ring
      buildStrutBetween(pShock, pPop, 0.004, 0.0045),
      { geometry: new THREE.TorusGeometry(0.048, 0.005, 8, 22), position: [0.955, deskY + 0.3, 0.545], rotation: [0.1, -0.32, 0] },

      // B. Webcam perched centered on top monitor bezel [1.15, 1.272, 0.272]
      { geometry: new RoundedBoxGeometry(0.085, 0.026, 0.032, 2, 0.006), position: [1.15, 1.28, 0.275] },
      { geometry: new THREE.BoxGeometry(0.036, 0.022, 0.016), position: [1.15, 1.262, 0.262] },
      { geometry: new THREE.CylinderGeometry(0.01, 0.012, 0.012, 16), position: [1.15, 1.28, 0.294], rotation: [Math.PI / 2, 0, 0] },

      // C. Ring Light Mini Tripod behind PC Case [2.05, deskY, 0.12]
      { geometry: new THREE.CylinderGeometry(0.018, 0.022, 0.04, 12), position: [2.05, deskY + 0.075, 0.12] },
      { geometry: new THREE.CylinderGeometry(0.008, 0.01, 0.1, 10), position: [2.05, deskY + 0.038, 0.07], rotation: [-0.55, 0, 0] },
      { geometry: new THREE.CylinderGeometry(0.008, 0.01, 0.1, 10), position: [2.01, deskY + 0.038, 0.155], rotation: [0.5, 0, -0.45] },
      { geometry: new THREE.CylinderGeometry(0.008, 0.01, 0.1, 10), position: [2.09, deskY + 0.038, 0.155], rotation: [0.5, 0, 0.45] },
      // Telescoping vertical pole rising cleanly above PC Case (top=1.21) to ring base 1.27
      { geometry: new THREE.CylinderGeometry(0.009, 0.012, 0.48, 12), position: [2.05, deskY + 0.31, 0.12] },
      // Ring outer housing backing behind glowing ring face
      { geometry: new THREE.TorusGeometry(0.118, 0.014, 10, 28), position: [2.05, 1.39, 0.115], rotation: [0.12, -0.35, 0] },

      // D. 5x3 Stream Deck Macro Pad Base Wedge [0.54, deskY, 0.56]
      { geometry: new RoundedBoxGeometry(0.124, 0.024, 0.088, 2, 0.006), position: [0.54, deskY + 0.014, 0.56], rotation: [0.42, 0.18, 0] },

      // E. "ON AIR" Dark Studio Box Frame on Wall A above monitor [1.15, 1.44, 0.02]
      { geometry: new RoundedBoxGeometry(0.28, 0.095, 0.034, 2, 0.006), position: [1.15, 1.44, 0.018] },
    ];

    // 2. Ring Light Emissive Halo Ring (facing gamer chair)
    const ringLightGeo = new THREE.TorusGeometry(0.116, 0.011, 10, 28);
    ringLightGeo.rotateX(0.12);
    ringLightGeo.rotateY(-0.35);
    ringLightGeo.translate(2.05, 1.39, 0.123);

    // 3. Illuminated Atlas Surfaces (Stream Deck 5x3 Key Grid + "ON AIR" Front Plate)
    const streamDeckFace = applyAtlasUvRect(new THREE.PlaneGeometry(0.106, 0.068), SMALL_PROPS_UV.streamDeck);
    const onAirFace = applyAtlasUvRect(new THREE.PlaneGeometry(0.256, 0.076), SMALL_PROPS_UV.onAir);
    const litPlatesGeo = buildMergedGeometry([
      {
        geometry: streamDeckFace,
        position: [0.542, deskY + 0.022, 0.566],
        rotation: [-Math.PI / 2 + 0.42, 0.18, 0],
      },
      {
        geometry: onAirFace,
        position: [1.15, 1.44, 0.036],
      },
    ]);

    return {
      hardwareGeo: buildMergedGeometry(hardwareParts),
      ringLightGeo,
      litPlatesGeo,
    };
  }, [deskY]);

  const materials = useMemo(() => {
    return {
      hardware: new THREE.MeshStandardMaterial({
        color: '#171a22',
        roughness: 0.48,
        metalness: 0.45,
      }),
      ringLight: new THREE.MeshBasicMaterial({
        color: '#fff6eb',
        toneMapped: false,
      }),
      litPlates: new THREE.MeshBasicMaterial({
        map: smallPropsAtlas ?? undefined,
        color: '#ffffff',
        toneMapped: false,
      }),
    };
  }, [smallPropsAtlas]);

  useThemed(
    materials.ringLight,
    {
      day: { color: '#fff6eb', intensity: 0.52 },
      night: { color: '#fff2e2', intensity: 1.32 },
    },
    [materials.ringLight]
  );

  useThemed(
    materials.litPlates,
    {
      day: { color: '#ffffff', intensity: 0.55 },
      night: { color: '#ffffff', intensity: 1.25 },
    },
    [materials.litPlates]
  );

  return (
    <group ref={groupRef} name="streaming-desk-setup">
      <mesh geometry={merged.hardwareGeo} material={materials.hardware} />
      <mesh geometry={merged.ringLightGeo} material={materials.ringLight} />
      <mesh geometry={merged.litPlatesGeo} material={materials.litPlates} />
    </group>
  );
}
