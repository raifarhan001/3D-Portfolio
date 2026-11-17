'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { CENTER_RUG_CONFIG, THEMES_CONFIG } from '@/config/themeConfig';
import { freezeStaticMatrices } from '@/utils/mergeHelpers';
import { createCenterRugTexture } from '@/utils/step5Textures';
import { useThemed } from '@/utils/themeRegistry';

/**
 * CenterRug — Large 3.4m x 2.3m geometric area rug placed parallel to walls
 * in the largest free center-east floor rectangle. Strictly 1 draw call, no collider.
 */
export default function CenterRug() {
  const meshRef = useRef<THREE.Mesh>(null);
  const { position, width, length, thickness } = CENTER_RUG_CONFIG;

  const rugTex = useMemo(() => createCenterRugTexture(), []);

  const { geometry, material } = useMemo(() => {
    // Rotate plane/box UVs cleanly so the 1024px long axis (with fringes) maps to length (Z)
    const geo = new THREE.BoxGeometry(length, thickness, width);
    const mat = new THREE.MeshStandardMaterial({
      map: rugTex,
      color: '#ffffff',
      roughness: 0.92,
      metalness: 0.02,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    return { geometry: geo, material: mat };
  }, [length, thickness, width, rugTex]);

  useThemed(
    material,
    {
      day: { color: '#ffffff' },
      night: { color: THEMES_CONFIG.night.floorTint },
    },
    [material]
  );

  useLayoutEffect(() => {
    freezeStaticMatrices(meshRef.current);
  }, []);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
      rugTex?.dispose();
    };
  }, [geometry, material, rugTex]);

  return (
    <mesh
      ref={meshRef}
      name="center-rug"
      position={position}
      rotation={[0, Math.PI / 2, 0]}
      geometry={geometry}
      material={material}
    />
  );
}
