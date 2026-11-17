'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {
  buildMergedColoredGeometry,
  buildMergedGeometry,
  freezeStaticMatrices,
  type ColoredGeometryPart,
  type GeometryPart,
} from '@/utils/mergeHelpers';

interface MiniFridgeProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
}

/**
 * MiniFridge Component — Merged static cabinet, shelves, bottles, cans & fruits (21 draw calls, down from 56)
 */
export default function MiniFridge({
  position = [-4.56, 0, 0.42],
  rotation = [0, 0.35, 0],
}: MiniFridgeProps) {
  const groupRef = useRef<THREE.Group>(null);

  useLayoutEffect(() => {
    freezeStaticMatrices(groupRef.current);
  }, []);

  const merged = useMemo(() => {
    const W = 0.64;
    const H = 1.04;
    const D = 0.56;
    const wallT = 0.045;
    const footH = 0.025;

    const bodyBlackGeo = buildMergedGeometry([
      { geometry: new THREE.BoxGeometry(W, H, wallT), position: [0, footH + H / 2, -D / 2 + wallT / 2] },
      { geometry: new THREE.BoxGeometry(wallT, H, D), position: [-W / 2 + wallT / 2, footH + H / 2, 0] },
      { geometry: new THREE.BoxGeometry(wallT, H, D), position: [W / 2 - wallT / 2, footH + H / 2, 0] },
      { geometry: new THREE.BoxGeometry(W, wallT, D), position: [0, footH + H - wallT / 2, 0] },
      { geometry: new THREE.BoxGeometry(W, wallT, D), position: [0, footH + wallT / 2, 0] },
    ]);

    const doorFrameGeo = buildMergedGeometry([
      // 4 rubber feet
      { geometry: new THREE.CylinderGeometry(0.022, 0.026, footH, 10), position: [-W / 2 + 0.06, footH / 2, -D / 2 + 0.06] },
      { geometry: new THREE.CylinderGeometry(0.022, 0.026, footH, 10), position: [W / 2 - 0.06, footH / 2, -D / 2 + 0.06] },
      { geometry: new THREE.CylinderGeometry(0.022, 0.026, footH, 10), position: [-W / 2 + 0.06, footH / 2, D / 2 - 0.06] },
      { geometry: new THREE.CylinderGeometry(0.022, 0.026, footH, 10), position: [W / 2 - 0.06, footH / 2, D / 2 - 0.06] },
      // 4 door rails
      { geometry: new THREE.BoxGeometry(W, 0.06, 0.026), position: [0, footH + H - 0.03, D / 2 + 0.01] },
      { geometry: new THREE.BoxGeometry(W, 0.06, 0.026), position: [0, footH + 0.03, D / 2 + 0.01] },
      { geometry: new THREE.BoxGeometry(0.06, H - 0.12, 0.026), position: [-W / 2 + 0.03, footH + H / 2, D / 2 + 0.01] },
      { geometry: new THREE.BoxGeometry(0.06, H - 0.12, 0.026), position: [W / 2 - 0.03, footH + H / 2, D / 2 + 0.01] },
    ]);

    const interiorWhiteGeo = buildMergedGeometry([
      { geometry: new THREE.PlaneGeometry(W - wallT * 2, H - wallT * 2), position: [0, footH + H / 2, -D / 2 + wallT + 0.004] },
      { geometry: new THREE.PlaneGeometry(D - wallT * 1.4, H - wallT * 2), position: [-W / 2 + wallT + 0.004, footH + H / 2, 0], rotation: [0, Math.PI / 2, 0] },
      { geometry: new THREE.PlaneGeometry(D - wallT * 1.4, H - wallT * 2), position: [W / 2 - wallT - 0.004, footH + H / 2, 0], rotation: [0, -Math.PI / 2, 0] },
      { geometry: new THREE.PlaneGeometry(W - wallT * 2, D - wallT * 1.4), position: [0, footH + wallT + 0.004, 0], rotation: [-Math.PI / 2, 0, 0] },
      { geometry: new THREE.PlaneGeometry(W - wallT * 2, D - wallT * 1.4), position: [0, footH + H - wallT - 0.004, 0], rotation: [Math.PI / 2, 0, 0] },
    ]);

    const shelfGlassGeo = buildMergedGeometry([
      { geometry: new THREE.BoxGeometry(W - wallT * 2 - 0.02, 0.012, D - 0.12), position: [0, footH + 0.62, 0] },
      { geometry: new THREE.BoxGeometry(W - wallT * 2 - 0.02, 0.012, D - 0.12), position: [0, footH + 0.38, 0] },
    ]);

    const canXs = [-0.2, -0.1, 0.0, 0.1, 0.2];
    const bottleXs = [-0.03, 0.055, 0.14, 0.22];

    const chromeParts: GeometryPart[] = [
      { geometry: new THREE.CylinderGeometry(0.018, 0.018, 0.02, 12), position: [W / 2 - wallT - 0.04, footH + H - 0.12, 0.09], rotation: [Math.PI / 2, 0, 0] },
      ...canXs.map((cx) => ({
        geometry: new THREE.CylinderGeometry(0.029, 0.031, 0.006, 14),
        position: [cx, footH + 0.705 + 0.077, 0.07] as [number, number, number],
      })),
      ...bottleXs.map((bx) => ({
        geometry: new THREE.CylinderGeometry(0.014, 0.014, 0.014, 12),
        position: [bx, footH + 0.47 + 0.104, 0.08] as [number, number, number],
      })),
      { geometry: new THREE.BoxGeometry(0.016, 0.24, 0.016), position: [-W / 2 + 0.01, footH + H / 2 + 0.12, D / 2 + 0.03] },
      { geometry: new THREE.CylinderGeometry(0.012, 0.012, 0.005, 14), position: [0, footH + 0.03, D / 2 + 0.024] },
    ];

    const coloredItemParts: ColoredGeometryPart[] = [
      {
        geometry: new RoundedBoxGeometry(0.14, 0.18, 0.08, 2, 0.018),
        position: [-0.17, footH + 0.48, 0.07],
        rotation: [0.08, 0.18, -0.05],
        color: '#b91c1c',
      },
      // 5 Energy Drink Cans (merged by vertex color)
      { geometry: new THREE.CylinderGeometry(0.032, 0.032, 0.15, 14), position: [-0.2, footH + 0.705, 0.07], color: '#dc2626' },
      { geometry: new THREE.CylinderGeometry(0.032, 0.032, 0.15, 14), position: [-0.1, footH + 0.705, 0.07], color: '#06b6d4' },
      { geometry: new THREE.CylinderGeometry(0.032, 0.032, 0.15, 14), position: [0.0, footH + 0.705, 0.07], color: '#18181b' },
      { geometry: new THREE.CylinderGeometry(0.032, 0.032, 0.15, 14), position: [0.1, footH + 0.705, 0.07], color: '#1d4ed8' },
      { geometry: new THREE.CylinderGeometry(0.032, 0.032, 0.15, 14), position: [0.2, footH + 0.705, 0.07], color: '#d97706' },
      // Fruits in crisper bin
      { geometry: new THREE.SphereGeometry(0.048, 12, 10), position: [-0.14, footH + 0.13, 0.08], color: '#ea580c' },
      { geometry: new THREE.SphereGeometry(0.044, 12, 10), position: [0.02, footH + 0.18, 0.03], color: '#ea580c' },
      { geometry: new THREE.SphereGeometry(0.05, 12, 10), position: [-0.04, footH + 0.14, 0.06], color: '#eab308' },
      { geometry: new THREE.SphereGeometry(0.048, 12, 10), position: [0.15, footH + 0.14, 0.06], color: '#eab308' },
      { geometry: new THREE.SphereGeometry(0.046, 12, 10), position: [0.06, footH + 0.13, 0.09], color: '#65a30d' },
      { geometry: new THREE.SphereGeometry(0.042, 12, 10), position: [-0.09, footH + 0.18, 0.02], color: '#65a30d' },
    ];

    const waterBottleParts: GeometryPart[] = [];
    bottleXs.forEach((bx) => {
      waterBottleParts.push(
        { geometry: new THREE.CylinderGeometry(0.028, 0.028, 0.15, 12), position: [bx, footH + 0.47, 0.08] },
        { geometry: new THREE.CylinderGeometry(0.013, 0.026, 0.026, 12), position: [bx, footH + 0.47 + 0.085, 0.08] }
      );
      coloredItemParts.push({
        geometry: new THREE.CylinderGeometry(0.029, 0.029, 0.045, 12),
        position: [bx, footH + 0.46, 0.08],
        color: '#ef4444',
      });
    });

    return {
      bodyBlackGeo,
      doorFrameGeo,
      interiorWhiteGeo,
      shelfGlassGeo,
      chromeGeo: buildMergedGeometry(chromeParts),
      waterBottleGeo: buildMergedGeometry(waterBottleParts),
      coloredItemsGeo: buildMergedColoredGeometry(coloredItemParts),
      chillerGeo: new RoundedBoxGeometry(W - wallT * 2 - 0.08, 0.16, 0.34, 2, 0.008),
    };
  }, []);

  const materials = useMemo(() => {
    return {
      bodyBlack: new THREE.MeshStandardMaterial({ color: '#111216', roughness: 0.48, metalness: 0.25 }),
      doorFrame: new THREE.MeshStandardMaterial({ color: '#0b0c0f', roughness: 0.38, metalness: 0.35 }),
      chrome: new THREE.MeshStandardMaterial({ color: '#b8bec9', roughness: 0.25, metalness: 0.85 }),
      interiorWhite: new THREE.MeshStandardMaterial({
        color: '#eef2f7',
        emissive: '#dbeafe',
        emissiveIntensity: 0.45,
        roughness: 0.5,
      }),
      interiorLed: new THREE.MeshBasicMaterial({ color: '#f0f7ff', toneMapped: false }),
      chillerBox: new THREE.MeshStandardMaterial({
        color: '#f1f5f9',
        emissive: '#e2e8f0',
        emissiveIntensity: 0.25,
        roughness: 0.4,
      }),
      shelfGlass: new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.2, metalness: 0.4 }),
      glassPane: new THREE.MeshPhysicalMaterial({
        color: '#e0f2fe',
        roughness: 0.08,
        metalness: 0.05,
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
      }),
      crisperBin: new THREE.MeshPhysicalMaterial({
        color: '#e2e8f0',
        roughness: 0.25,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      }),
      canNeonGreen: new THREE.MeshBasicMaterial({ color: '#22c55e', toneMapped: false }),
      waterBottle: new THREE.MeshPhysicalMaterial({ color: '#bae6fd', roughness: 0.12, transparent: true, opacity: 0.78 }),
      coloredItems: new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.42,
        metalness: 0.35,
      }),
    };
  }, []);

  const W = 0.64;
  const H = 1.04;
  const D = 0.56;
  const wallT = 0.045;
  const footH = 0.025;

  return (
    <group ref={groupRef} name="gaming-mini-fridge" position={position} rotation={rotation}>
      <mesh geometry={merged.bodyBlackGeo} material={materials.bodyBlack} />
      <mesh geometry={merged.doorFrameGeo} material={materials.doorFrame} />
      <mesh geometry={merged.interiorWhiteGeo} material={materials.interiorWhite} />
      <mesh geometry={merged.shelfGlassGeo} material={materials.shelfGlass} />
      <mesh geometry={merged.chromeGeo} material={materials.chrome} />
      <mesh geometry={merged.waterBottleGeo} material={materials.waterBottle} />
      <mesh geometry={merged.coloredItemsGeo} material={materials.coloredItems} />

      <mesh position={[0, footH + H - wallT - 0.012, D / 2 - 0.12]} material={materials.interiorLed}>
        <boxGeometry args={[W - wallT * 2 - 0.06, 0.012, 0.025]} />
      </mesh>
      <mesh position={[-0.03, footH + H - 0.135, -0.02]} geometry={merged.chillerGeo} material={materials.chillerBox} />
      <mesh position={[0.0, footH + 0.715, 0.07]} material={materials.canNeonGreen}><cylinderGeometry args={[0.033, 0.033, 0.035, 14]} /></mesh>

      {/* Crisper Shield & Front Glass Pane */}
      <mesh position={[0, footH + 0.16, 0.18]} material={materials.crisperBin}>
        <boxGeometry args={[W - wallT * 2 - 0.04, 0.18, 0.015]} />
      </mesh>
      <mesh position={[0, footH + H / 2, D / 2 + 0.01]} material={materials.glassPane}>
        <planeGeometry args={[W - 0.12, H - 0.12]} />
      </mesh>
    </group>
  );
}
