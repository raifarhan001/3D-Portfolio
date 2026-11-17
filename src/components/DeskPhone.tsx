'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {
  GAMING_CORNER_CONFIG,
  gamingCornerLocalToWorld,
} from '@/config/roomConfig';
import { ROOM_CONTENT_CONFIG, isWallItemVisible } from '@/config/roomContent';
import { usePortfolioStore } from '@/stores/portfolioStore';
import { usePcStore } from '@/stores/pcStore';
import { buildMergedColoredGeometry, freezeStaticMatrices } from '@/utils/mergeHelpers';
import { createPhoneLockScreenTextures } from '@/utils/portfolioTextures';

const PHONE_W = 0.075;
const PHONE_H = 0.155;
const PHONE_D = 0.008;
const PHONE_TILT_X = -0.28; // Leans back comfortably on stand
const PHONE_BASE_Y = 0.008;
const PHONE_CENTER_Y = PHONE_BASE_Y + (PHONE_H / 2) * Math.cos(PHONE_TILT_X);
const PHONE_CENTER_Z = 0.004 + (PHONE_H / 2) * Math.sin(PHONE_TILT_X);

export function getPhoneWorldPose(): {
  target: THREE.Vector3;
  cameraPos: THREE.Vector3;
} {
  const cfg = ROOM_CONTENT_CONFIG.phone;
  const worldOrigin = new THREE.Vector3(...gamingCornerLocalToWorld(...cfg.localPosition));
  const worldYaw = GAMING_CORNER_CONFIG.rotationY + cfg.localRotationY;
  const groupEuler = new THREE.Euler(0, worldYaw, 0, 'XYZ');

  const localCenter = new THREE.Vector3(0, PHONE_CENTER_Y, PHONE_CENTER_Z);
  const target = localCenter.clone().applyEuler(groupEuler).add(worldOrigin);

  const screenNormal = new THREE.Vector3(
    0,
    -Math.sin(PHONE_TILT_X),
    Math.cos(PHONE_TILT_X)
  )
    .applyEuler(groupEuler)
    .normalize();

  const cameraPos = target.clone().addScaledVector(screenNormal, cfg.camDistance);
  return { target, cameraPos };
}

export default function DeskPhone() {
  const graphicsQuality = usePortfolioStore((s) => s.graphicsQuality);
  const visible = isWallItemVisible('phone', graphicsQuality);

  const rootRef = useRef<THREE.Group>(null);
  const screenMeshRef = useRef<THREE.Mesh>(null);
  const cfg = ROOM_CONTENT_CONFIG.phone;

  const worldPos = useMemo(
    () => gamingCornerLocalToWorld(...cfg.localPosition),
    [cfg.localPosition]
  );
  const worldYaw = GAMING_CORNER_CONFIG.rotationY + cfg.localRotationY;

  const { mapTex, emissiveMapTex } = useMemo(() => createPhoneLockScreenTextures(), []);

  const bodyGeo = useMemo(() => {
    const phoneCenter: [number, number, number] = [0, PHONE_CENTER_Y, PHONE_CENTER_Z];
    const phoneRot: [number, number, number] = [PHONE_TILT_X, 0, 0];

    const sinT = Math.sin(PHONE_TILT_X);
    const cosT = Math.cos(PHONE_TILT_X);
    const toPhone = (lx: number, ly: number, lz: number): [number, number, number] => [
      phoneCenter[0] + lx,
      phoneCenter[1] + ly * cosT - lz * sinT,
      phoneCenter[2] + ly * sinT + lz * cosT,
    ];

    return buildMergedColoredGeometry([
      // Desk Stand Base (0.07m wide)
      {
        geometry: new RoundedBoxGeometry(0.07, 0.008, 0.084, 2, 0.002),
        position: [0, 0.004, -0.006],
        color: '#15171d',
      },
      // Stand Front Retaining Lip
      {
        geometry: new RoundedBoxGeometry(0.07, 0.011, 0.007, 2, 0.002),
        position: [0, 0.009, 0.014],
        color: '#15171d',
      },
      // Stand Angled Back Rest Spine
      {
        geometry: new RoundedBoxGeometry(0.036, 0.088, 0.008, 2, 0.002),
        position: [0, 0.048, -0.022],
        rotation: [PHONE_TILT_X, 0, 0],
        color: '#15171d',
      },
      // Smartphone Frame (RoundedBox 0.075 x 0.155 x 0.008)
      {
        geometry: new RoundedBoxGeometry(PHONE_W, PHONE_H, PHONE_D, 3, 0.003),
        position: phoneCenter,
        rotation: phoneRot,
        color: '#101217',
      },
      // Camera Bump Island on Rear (-z)
      {
        geometry: new RoundedBoxGeometry(0.026, 0.028, 0.003, 2, 0.004),
        position: toPhone(-0.018, 0.056, -PHONE_D / 2 - 0.0012),
        rotation: phoneRot,
        color: '#1b1e26',
      },
      // Camera Lenses
      {
        geometry: new THREE.CylinderGeometry(0.0048, 0.0048, 0.002, 12),
        position: toPhone(-0.023, 0.062, -PHONE_D / 2 - 0.0026),
        rotation: [PHONE_TILT_X + Math.PI / 2, 0, 0],
        color: '#07080c',
      },
      {
        geometry: new THREE.CylinderGeometry(0.0048, 0.0048, 0.002, 12),
        position: toPhone(-0.013, 0.05, -PHONE_D / 2 - 0.0026),
        rotation: [PHONE_TILT_X + Math.PI / 2, 0, 0],
        color: '#07080c',
      },
    ]);
  }, []);

  const materials = useMemo(() => {
    return {
      body: new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.36,
        metalness: 0.48,
      }),
      screen: new THREE.MeshStandardMaterial({
        map: mapTex,
        emissive: '#38bdf8',
        emissiveMap: emissiveMapTex,
        emissiveIntensity: 0.35,
        roughness: 0.14,
        metalness: 0.1,
      }),
    };
  }, [mapTex, emissiveMapTex]);

  useLayoutEffect(() => {
    freezeStaticMatrices(rootRef.current);
  }, [visible]);

  useEffect(() => {
    return () => {
      bodyGeo.dispose();
      materials.body.dispose();
      materials.screen.dispose();
      mapTex?.dispose();
      emissiveMapTex?.dispose();
    };
  }, [bodyGeo, materials, mapTex, emissiveMapTex]);

  // Pulse notification card emissiveIntensity once every 6 seconds (no state updates)
  useFrame((state) => {
    if (!visible) return;
    const pc = usePcStore.getState();
    if (pc.pcMode && pc.pcArrived && !pc.pcExiting && pc.poweredPC && pc.bootState === 'desktop') {
      return;
    }
    const period = cfg.pulsePeriodSeconds;
    const phase = state.clock.elapsedTime % period;
    const pulse = phase < 1.3 ? Math.sin((phase / 1.3) * Math.PI) : 0;
    const mat = screenMeshRef.current?.material as THREE.MeshStandardMaterial | undefined;
    if (mat) {
      mat.emissiveIntensity = 0.25 + pulse * 1.05;
    }
  });

  if (!visible) return null;

  const screenOffset = PHONE_D / 2 + 0.0006;
  const screenPos: [number, number, number] = [
    0,
    PHONE_CENTER_Y - Math.sin(PHONE_TILT_X) * screenOffset,
    PHONE_CENTER_Z + Math.cos(PHONE_TILT_X) * screenOffset,
  ];

  return (
    <group ref={rootRef} name="desk-phone" position={worldPos} rotation={[0, worldYaw, 0]}>
      <mesh geometry={bodyGeo} material={materials.body} userData={{ interactive: 'phone' }} />
      <mesh
        ref={screenMeshRef}
        position={screenPos}
        rotation={[PHONE_TILT_X, 0, 0]}
        material={materials.screen}
        userData={{ interactive: 'phone' }}
      >
        <planeGeometry args={[0.069, 0.148]} />
      </mesh>
    </group>
  );
}
