'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { IDENTITY_CONFIG } from '@/config/identityConfig';
import { createHeroNameNeonTexture } from '@/utils/identityTextures';
import { freezeStaticMatrices } from '@/utils/mergeHelpers';
import { useThemed } from '@/utils/themeRegistry';

const CLIP_OFFSETS_X = [-0.88, -0.44, 0.0, 0.44, 0.88] as const;

/**
 * HeroNameSign — Main illuminated glass-tube neon name display ("RAI FARHAN")
 * mounted cleanly on the North Wall segment directly facing entrance spawn.
 * 3 draw calls (backing plate + instanced clips + emissive neon tube plane); stays visible in Low & High quality.
 */
export default function HeroNameSign() {
  const groupRef = useRef<THREE.Group>(null);
  const clipsRef = useRef<THREE.InstancedMesh>(null);

  const width = IDENTITY_CONFIG.nameSignMaxWidth;
  const textHeight = width * (512 / 2048); // Exact 4:1 texture aspect preservation
  const backingWidth = width + 0.08;
  const backingHeight = 0.31;

  const neonTex = useMemo(
    () =>
      createHeroNameNeonTexture(
        IDENTITY_CONFIG.displayName,
        IDENTITY_CONFIG.nameNeonColor,
        IDENTITY_CONFIG.nameNeonCoreColor
      ),
    []
  );

  const geos = useMemo(() => {
    return {
      backing: new THREE.BoxGeometry(backingWidth, backingHeight, 0.012),
      clip: new THREE.BoxGeometry(0.016, 0.032, 0.022),
      neonPlane: new THREE.PlaneGeometry(width, textHeight),
    };
  }, [backingWidth, backingHeight, width, textHeight]);

  const materials = useMemo(() => {
    return {
      backing: new THREE.MeshStandardMaterial({
        color: '#141720',
        roughness: 0.72,
        metalness: 0.25,
      }),
      clip: new THREE.MeshStandardMaterial({
        color: '#222633',
        roughness: 0.42,
        metalness: 0.65,
      }),
      neon: new THREE.MeshBasicMaterial({
        color: '#ffffff',
        map: neonTex ?? undefined,
        transparent: true,
        alphaTest: 0.1,
        toneMapped: false,
      }),
    };
  }, [neonTex]);

  useThemed(
    materials.backing,
    {
      day: { color: '#282d3b' },
      night: { color: '#141720' },
    },
    [materials.backing]
  );

  useThemed(
    materials.neon,
    {
      day: { color: '#ffffff', intensity: 0.35 },
      night: { color: '#ffffff', intensity: 1.0 },
    },
    [materials.neon]
  );

  useLayoutEffect(() => {
    const clips = clipsRef.current;
    if (clips) {
      const dummy = new THREE.Object3D();
      CLIP_OFFSETS_X.forEach((cx, idx) => {
        dummy.position.set(cx, -backingHeight * 0.44, 0.014);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        clips.setMatrixAt(idx, dummy.matrix);
      });
      clips.instanceMatrix.needsUpdate = true;
      clips.computeBoundingSphere();
    }
    freezeStaticMatrices(groupRef.current);
  }, [backingHeight]);

  useEffect(() => {
    return () => {
      geos.backing.dispose();
      geos.clip.dispose();
      geos.neonPlane.dispose();
      Object.values(materials).forEach((m) => m.dispose());
      neonTex?.dispose();
    };
  }, [geos, materials, neonTex]);

  return (
    <group
      ref={groupRef}
      name="hero-name-neon-sign"
      position={IDENTITY_CONFIG.nameSignPosition}
      rotation={[0, IDENTITY_CONFIG.nameSignRotationY, 0]}
    >
      <mesh position={[0, 0, 0.008]} geometry={geos.backing} material={materials.backing} />
      <instancedMesh
        ref={clipsRef}
        args={[geos.clip, materials.clip, CLIP_OFFSETS_X.length]}
      />
      <mesh position={[0, 0, 0.022]} geometry={geos.neonPlane} material={materials.neon} />
    </group>
  );
}
