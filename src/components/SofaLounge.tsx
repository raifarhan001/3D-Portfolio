'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { buildMergedGeometry, freezeStaticMatrices, type GeometryPart } from '@/utils/mergeHelpers';
import { THEMES_CONFIG } from '@/config/themeConfig';
import { useThemed } from '@/utils/themeRegistry';

/**
 * Generates a procedural plush woven rug texture (1024x1024).
 */
function createRugTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#d4cfc4';
  ctx.fillRect(0, 0, size, size);

  const imgData = ctx.getImageData(0, 0, size, size);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const px = (i / 4) % size;
    const py = Math.floor(i / 4 / size);
    const weave = ((px + py) % 4 === 0 ? 5 : -3) + (Math.random() * 14 - 7);
    data[i] = Math.max(0, Math.min(255, data[i] + weave));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + weave));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + weave));
  }
  ctx.putImageData(imgData, 0, 0);

  ctx.strokeStyle = 'rgba(62, 58, 54, 0.25)';
  ctx.lineWidth = 18;
  ctx.strokeRect(38, 38, size - 76, size - 76);

  ctx.strokeStyle = 'rgba(138, 36, 48, 0.45)';
  ctx.lineWidth = 4;
  ctx.strokeRect(68, 68, size - 136, size - 136);

  ctx.strokeStyle = 'rgba(62, 58, 54, 0.14)';
  ctx.lineWidth = 2;
  ctx.strokeRect(104, 104, size - 208, size - 208);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/**
 * Generates subtle micro-woven fabric texture for sofa cushions.
 */
function createFabricTexture(baseHex: string): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, size, size);

  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 14;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function bakeParts(
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
 * SofaLounge Component — Merged static sofa cushions, bases, legs, pillows, and book/table props.
 * Reduces 47 draw calls down to 12 draw calls with matrixAutoUpdate = false.
 */
export default function SofaLounge() {
  const groupRef = useRef<THREE.Group>(null);
  const rugTexture = useMemo(() => createRugTexture(), []);
  const sofaFabricTex = useMemo(() => createFabricTexture('#7b808c'), []);
  const crimsonFabric = useMemo(() => createFabricTexture('#82202f'), []);

  useLayoutEffect(() => {
    freezeStaticMatrices(groupRef.current);
  }, []);

  const merged = useMemo(() => {
    const sofaPos: [number, number, number] = [-0.25, 0, 0];
    const chairPos: [number, number, number] = [-1.45, 0, -2.05];
    const chairRot: [number, number, number] = [0, -Math.PI * 0.65, 0];
    const coffeePos: [number, number, number] = [-1.7, 0, 0];
    const sidePos: [number, number, number] = [-0.35, 0, -1.95];

    // Main L-Sofa fabric cushions (interactive: 'sofa')
    const mainFabricParts: GeometryPart[] = [
      ...[-0.84, 0, 0.84].map((cz) => ({
        geometry: new RoundedBoxGeometry(0.82, 0.19, 0.82, 2, 0.055),
        position: [-0.04, 0.32, cz] as [number, number, number],
      })),
      { geometry: new RoundedBoxGeometry(0.7, 0.19, 0.82, 2, 0.055), position: [-0.76, 0.32, 1.01] },
      { geometry: new RoundedBoxGeometry(0.2, 0.62, 2.86, 2, 0.04), position: [0.38, 0.51, 0] },
      ...[-0.84, 0, 0.84].map((cz) => ({
        geometry: new RoundedBoxGeometry(0.2, 0.44, 0.8, 2, 0.06),
        position: [0.22, 0.59, cz] as [number, number, number],
        rotation: [0, 0, -0.14] as [number, number, number],
      })),
      { geometry: new RoundedBoxGeometry(0.94, 0.42, 0.18, 2, 0.05), position: [0, 0.42, -1.34] },
      { geometry: new RoundedBoxGeometry(0.94, 0.42, 0.18, 2, 0.05), position: [0, 0.42, 1.34] },
    ];

    // Armchair fabric
    const chairFabricParts = bakeParts(
      [
        { geometry: new RoundedBoxGeometry(0.68, 0.16, 0.68, 2, 0.05), position: [0, 0.38, 0.03] },
        { geometry: new RoundedBoxGeometry(0.72, 0.44, 0.16, 2, 0.05), position: [0, 0.58, -0.3], rotation: [0.14, 0, 0] },
        { geometry: new RoundedBoxGeometry(0.15, 0.32, 0.64, 2, 0.04), position: [-0.32, 0.5, -0.02] },
        { geometry: new RoundedBoxGeometry(0.15, 0.32, 0.64, 2, 0.04), position: [0.32, 0.5, -0.02] },
      ],
      chairPos,
      chairRot
    );

    // Walnut bases
    const sofaBaseParts: GeometryPart[] = [
      ...bakeParts(
        [
          { geometry: new RoundedBoxGeometry(0.96, 0.12, 2.86, 2, 0.02), position: [0, 0.17, 0] },
          { geometry: new RoundedBoxGeometry(0.68, 0.12, 0.84, 2, 0.02), position: [-0.78, 0.17, 1.01] },
        ],
        sofaPos
      ),
      ...bakeParts([{ geometry: new RoundedBoxGeometry(0.76, 0.1, 0.76, 2, 0.03), position: [0, 0.26, 0] }], chairPos, chairRot),
    ];

    // Metal legs & lamp trim
    const metalLegParts: GeometryPart[] = [
      ...bakeParts(
        [
          [-0.42, 0.06, -1.36],
          [0.42, 0.06, -1.36],
          [-0.42, 0.06, 1.36],
          [0.42, 0.06, 1.36],
          [-1.04, 0.06, 0.72],
          [-1.04, 0.06, 1.36],
        ].map((p) => ({
          geometry: new THREE.CylinderGeometry(0.025, 0.016, 0.12, 10),
          position: p as [number, number, number],
        })),
        sofaPos
      ),
      ...bakeParts(
        [
          { geometry: new THREE.CylinderGeometry(0.3, 0.32, 0.035, 24), position: [0, 0.02, 0] },
          { geometry: new THREE.CylinderGeometry(0.04, 0.05, 0.22, 12), position: [0, 0.13, 0] },
        ],
        chairPos,
        chairRot
      ),
      ...bakeParts(
        [
          [-0.28, 0.18, -0.6],
          [0.28, 0.18, -0.6],
          [-0.28, 0.18, 0.6],
          [0.28, 0.18, 0.6],
        ].map((p) => ({
          geometry: new THREE.BoxGeometry(0.03, 0.36, 0.03),
          position: p as [number, number, number],
        })),
        coffeePos
      ),
      ...bakeParts(
        [
          { geometry: new THREE.CylinderGeometry(0.25, 0.25, 0.02, 24), position: [0, 0.51, 0] },
          { geometry: new THREE.CylinderGeometry(0.07, 0.08, 0.04, 16), position: [0, 0.54, 0] },
          { geometry: new THREE.CylinderGeometry(0.098, 0.098, 0.012, 20), position: [0, 0.805, 0] },
        ],
        sidePos
      ),
    ];

    // Crimson accent pillows & blanket
    const pillowCrimsonParts: GeometryPart[] = [
      ...bakeParts(
        [
          { geometry: new RoundedBoxGeometry(0.13, 0.34, 0.36, 2, 0.045), position: [0.04, 0.56, -1.04], rotation: [0.25, 0.32, -0.22] },
          { geometry: new RoundedBoxGeometry(0.13, 0.34, 0.36, 2, 0.045), position: [0.04, 0.56, 1.04], rotation: [-0.25, -0.32, -0.22] },
          { geometry: new RoundedBoxGeometry(0.46, 0.045, 0.62, 2, 0.018), position: [-0.78, 0.43, 1.02], rotation: [0, 0.08, 0] },
        ],
        sofaPos
      ),
      ...bakeParts(
        [{ geometry: new RoundedBoxGeometry(0.42, 0.24, 0.11, 2, 0.04), position: [0, 0.53, -0.17], rotation: [0.2, 0, 0] }],
        chairPos,
        chairRot
      ),
    ];

    // Slate/cream pillows
    const pillowSlateParts = bakeParts(
      [
        { geometry: new RoundedBoxGeometry(0.12, 0.31, 0.33, 2, 0.045), position: [-0.02, 0.54, -0.78], rotation: [0.15, 0.18, -0.25] },
        { geometry: new RoundedBoxGeometry(0.12, 0.3, 0.32, 2, 0.045), position: [-0.03, 0.54, 0.78], rotation: [-0.12, -0.2, -0.26] },
      ],
      sofaPos
    );

    // Table wood (coffee shelf + side table body)
    const tableWoodParts: GeometryPart[] = [
      ...bakeParts([{ geometry: new RoundedBoxGeometry(0.56, 0.035, 1.18, 2, 0.01), position: [0, 0.14, 0] }], coffeePos),
      ...bakeParts([{ geometry: new THREE.CylinderGeometry(0.24, 0.22, 0.5, 24), position: [0, 0.25, 0] }], sidePos),
    ];

    // Coffee table books & gamepad props
    const propMatteParts = bakeParts(
      [
        { geometry: new THREE.BoxGeometry(0.24, 0.032, 0.32), position: [0.04, 0.4, -0.25], rotation: [0, 0.18, 0] },
        { geometry: new RoundedBoxGeometry(0.1, 0.025, 0.15, 2, 0.01), position: [-0.08, 0.395, 0.22], rotation: [0, -0.4, 0] },
      ],
      coffeePos
    );
    const propAccentParts = bakeParts(
      [
        { geometry: new THREE.BoxGeometry(0.22, 0.003, 0.3), position: [0.04, 0.417, -0.25], rotation: [0, 0.18, 0] },
        { geometry: new THREE.CylinderGeometry(0.012, 0.012, 0.008, 12), position: [-0.08, 0.411, 0.19], rotation: [0, -0.4, 0] },
      ],
      coffeePos
    );

    return {
      mainSofaFabricGeo: buildMergedGeometry(bakeParts(mainFabricParts, sofaPos)),
      armchairFabricGeo: buildMergedGeometry(chairFabricParts),
      sofaBaseGeo: buildMergedGeometry(sofaBaseParts),
      metalLegGeo: buildMergedGeometry(metalLegParts),
      pillowCrimsonGeo: buildMergedGeometry(pillowCrimsonParts),
      pillowSlateGeo: buildMergedGeometry(pillowSlateParts),
      tableWoodGeo: buildMergedGeometry(tableWoodParts),
      propMatteGeo: buildMergedGeometry(propMatteParts),
      propAccentGeo: buildMergedGeometry(propAccentParts),
      smokedGlassGeo: new RoundedBoxGeometry(0.64, 0.025, 1.32, 2, 0.008),
    };
  }, []);

  const materials = useMemo(() => {
    return {
      rug: new THREE.MeshStandardMaterial({
        map: rugTexture,
        roughness: 0.94,
        metalness: 0.02,
      }),
      sofaFabric: new THREE.MeshStandardMaterial({
        map: sofaFabricTex,
        roughness: 0.88,
        metalness: 0.03,
      }),
      sofaBase: new THREE.MeshStandardMaterial({
        color: '#5c4432',
        roughness: 0.68,
        metalness: 0.06,
      }),
      metalLeg: new THREE.MeshStandardMaterial({
        color: '#9c896d',
        roughness: 0.32,
        metalness: 0.82,
      }),
      pillowCrimson: new THREE.MeshStandardMaterial({
        map: crimsonFabric,
        roughness: 0.86,
        metalness: 0.04,
      }),
      pillowSlate: new THREE.MeshStandardMaterial({
        color: '#c8c3b8',
        roughness: 0.85,
        metalness: 0.03,
      }),
      tableWood: new THREE.MeshStandardMaterial({
        color: '#5a4230',
        roughness: 0.65,
        metalness: 0.06,
      }),
      smokedGlass: new THREE.MeshPhysicalMaterial({
        color: '#20242c',
        roughness: 0.12,
        metalness: 0.12,
        transparent: true,
        opacity: 0.65,
      }),
      propMatte: new THREE.MeshStandardMaterial({
        color: '#23252c',
        roughness: 0.52,
        metalness: 0.25,
      }),
      propAccent: new THREE.MeshStandardMaterial({
        color: '#b3122a',
        roughness: 0.4,
        metalness: 0.2,
      }),
      lampShade: new THREE.MeshBasicMaterial({
        color: '#fff1df',
        toneMapped: false,
      }),
    };
  }, [rugTexture, sofaFabricTex, crimsonFabric]);

  useThemed(
    materials.lampShade,
    {
      day: {
        color: THEMES_CONFIG.day.sideLampEmissive,
        intensity: THEMES_CONFIG.day.sideLampIntensity,
      },
      night: {
        color: THEMES_CONFIG.night.sideLampEmissive,
        intensity: THEMES_CONFIG.night.sideLampIntensity,
      },
    },
    [materials.lampShade]
  );

  useThemed(
    materials.rug,
    {
      day: { color: '#ffffff' },
      night: { color: '#a8b2c9' },
    },
    [materials.rug]
  );

  return (
    <group ref={groupRef} name="sofa-lounge-set">
      {/* 1. Plush Woven Floor Rug */}
      <mesh position={[-2.05, 0.006, 0]} material={materials.rug}>
        <boxGeometry args={[3.8, 0.01, 4.6]} />
      </mesh>

      {/* 2. Merged Interactive Main L-Sofa + Armchair + Pillows + Legs */}
      <mesh geometry={merged.mainSofaFabricGeo} material={materials.sofaFabric} userData={{ interactive: 'sofa' }} />
      <mesh geometry={merged.armchairFabricGeo} material={materials.sofaFabric} />
      <mesh geometry={merged.sofaBaseGeo} material={materials.sofaBase} />
      <mesh geometry={merged.metalLegGeo} material={materials.metalLeg} />
      <mesh geometry={merged.pillowCrimsonGeo} material={materials.pillowCrimson} />
      <mesh geometry={merged.pillowSlateGeo} material={materials.pillowSlate} />

      {/* 3. Merged Table Wood & Books/Props */}
      <mesh geometry={merged.tableWoodGeo} material={materials.tableWood} />
      <mesh geometry={merged.propMatteGeo} material={materials.propMatte} />
      <mesh geometry={merged.propAccentGeo} material={materials.propAccent} />

      {/* 4. Smoked Glass Coffee Tabletop & Ambient Lamp Shade */}
      <mesh position={[-1.7, 0.37, 0]} geometry={merged.smokedGlassGeo} material={materials.smokedGlass} />
      <mesh position={[-0.35, 0.68, -1.95]} material={materials.lampShade}>
        <cylinderGeometry args={[0.095, 0.115, 0.24, 20]} />
      </mesh>
    </group>
  );
}
