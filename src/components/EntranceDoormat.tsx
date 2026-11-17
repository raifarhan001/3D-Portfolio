'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { IDENTITY_CONFIG } from '@/config/identityConfig';
import { createDoormatTexture } from '@/utils/identityTextures';
import { freezeStaticMatrices } from '@/utils/mergeHelpers';

/**
 * EntranceDoormat — Flat woven coir doormat (1.0m x 0.6m) placed directly ahead
 * of spawn along the walkway without blocking player movement (0 colliders, 1 draw call).
 */
export default function EntranceDoormat() {
  const groupRef = useRef<THREE.Group>(null);
  const W = 1.0;
  const H = 0.01;
  const D = 0.6;

  const doormatTex = useMemo(
    () => createDoormatTexture(IDENTITY_CONFIG.doormatText, IDENTITY_CONFIG.displayName),
    []
  );

  const geo = useMemo(() => {
    const box = new THREE.BoxGeometry(W, H, D);
    const pos = box.getAttribute('position');
    const norm = box.getAttribute('normal');
    const uv = box.getAttribute('uv');

    for (let i = 0; i < uv.count; i++) {
      if (norm.getY(i) > 0.5) {
        // Explicit top face mapping: -X left -> u=0, -Z top -> v=1 (upright when standing at +Z looking -Z)
        const u = pos.getX(i) / W + 0.5;
        const v = 0.5 - pos.getZ(i) / D;
        uv.setXY(i, u, v);
      } else {
        // Edges sample solid dark coir border grain
        uv.setXY(i, 0.02, 0.02);
      }
    }
    uv.needsUpdate = true;
    return box;
  }, []);

  const mat = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      map: doormatTex ?? undefined,
      roughness: 0.95,
      metalness: 0.02,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
  }, [doormatTex]);

  useLayoutEffect(() => {
    freezeStaticMatrices(groupRef.current);
  }, []);

  useEffect(() => {
    return () => {
      geo.dispose();
      mat.dispose();
      doormatTex?.dispose();
    };
  }, [geo, mat, doormatTex]);

  return (
    <group ref={groupRef} name="entrance-doormat">
      <mesh position={IDENTITY_CONFIG.doormatPosition} geometry={geo} material={mat} />
    </group>
  );
}
