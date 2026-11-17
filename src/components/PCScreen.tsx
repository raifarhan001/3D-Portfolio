'use client';

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

interface PCScreenProps {
  texture?: THREE.Texture | null;
  powered?: boolean;
  width?: number;
  height?: number;
  geometry?: THREE.BufferGeometry;
  position?: [number, number, number];
  rotation?: [number, number, number];
  interactiveId?: string;
}

/**
 * PCScreen — TVScreen-style monitor display accepting `texture`, `powered`, and optional custom `geometry`
 * (e.g. concave curved CylinderGeometry segment). Always uses FrontSide (DoubleSide off) with toneMapped false.
 */
export default function PCScreen({
  texture = null,
  powered = false,
  width = 0.95,
  height = 0.4,
  geometry,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  interactiveId,
}: PCScreenProps) {
  const showTexture = Boolean(powered && texture);

  const material = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: showTexture ? '#ffffff' : '#050506',
      map: showTexture ? texture : null,
      toneMapped: false,
      side: THREE.FrontSide,
    });
  }, [showTexture, texture]);

  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  return (
    <mesh
      position={position}
      rotation={rotation}
      geometry={geometry}
      userData={interactiveId ? { interactive: interactiveId } : undefined}
      material={material}
    >
      {!geometry && <planeGeometry args={[width, height]} />}
    </mesh>
  );
}
