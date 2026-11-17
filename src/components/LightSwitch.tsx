'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { LIGHT_SWITCH_CONFIG, THEMES_CONFIG } from '@/config/themeConfig';
import { useThemeStore } from '@/stores/themeStore';
import { useThemed } from '@/utils/themeRegistry';

const _dummy = new THREE.Object3D();
const _plateColor = new THREE.Color();

function updateRockerMatrix(mesh: THREE.InstancedMesh, tilt: number, plateDepth: number): void {
  _dummy.position.set(0, 0, plateDepth + 0.002);
  _dummy.rotation.set(tilt, 0, 0);
  _dummy.scale.set(0.026, 0.054, 0.011);
  _dummy.updateMatrix();
  mesh.setMatrixAt(1, _dummy.matrix);
  mesh.instanceMatrix.needsUpdate = true;
}

/**
 * LightSwitch — Wall plate + pivoting rocker switch in ONE InstancedMesh + tiny status LED.
 * Strictly 2 draw calls. Rocker animates +-0.25 rad over 120ms cleanly on Day/Night toggle.
 */
export default function LightSwitch() {
  const {
    position,
    rotationY,
    plateWidth,
    plateHeight,
    plateDepth,
    plateColor,
    rockerColor,
    rockerTiltRad,
    rockerDurationSec,
  } = LIGHT_SWITCH_CONFIG;

  const instRef = useRef<THREE.InstancedMesh>(null);

  const initialTilt = useThemeStore.getState().theme === 'night' ? -rockerTiltRad : rockerTiltRad;
  const curAngleRef = useRef(initialTilt);
  const startAngleRef = useRef(initialTilt);
  const targetAngleRef = useRef(initialTilt);
  const animElapsedRef = useRef(1);
  const lastThemeRef = useRef(useThemeStore.getState().theme);

  const { geometry, materials } = useMemo(() => {
    const unitBox = new RoundedBoxGeometry(1, 1, 1, 2, 0.14);
    const switchBodyMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.38,
      metalness: 0.05,
    });
    const statusLedMat = new THREE.MeshBasicMaterial({
      color: THEMES_CONFIG.day.switchLedColor,
      toneMapped: false,
    });
    return {
      geometry: unitBox,
      materials: { switchBodyMat, statusLedMat },
    };
  }, []);

  useThemed(
    materials.statusLedMat,
    {
      day: {
        color: THEMES_CONFIG.day.switchLedColor,
        intensity: THEMES_CONFIG.day.switchLedIntensity,
      },
      night: {
        color: THEMES_CONFIG.night.switchLedColor,
        intensity: THEMES_CONFIG.night.switchLedIntensity,
      },
    },
    [materials.statusLedMat]
  );

  useLayoutEffect(() => {
    const mesh = instRef.current;
    if (!mesh) return;

    // Instance 0: static off-white beveled wall plate
    _dummy.position.set(0, 0, plateDepth * 0.5);
    _dummy.rotation.set(0, 0, 0);
    _dummy.scale.set(plateWidth, plateHeight, plateDepth);
    _dummy.updateMatrix();
    mesh.setMatrixAt(0, _dummy.matrix);
    _plateColor.set(plateColor);
    mesh.setColorAt(0, _plateColor);

    // Instance 1: rocker paddle
    updateRockerMatrix(mesh, curAngleRef.current, plateDepth);
    _plateColor.set(rockerColor);
    mesh.setColorAt(1, _plateColor);

    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [plateColor, plateDepth, plateHeight, plateWidth, rockerColor]);

  useEffect(() => {
    return () => {
      geometry.dispose();
      materials.switchBodyMat.dispose();
      materials.statusLedMat.dispose();
    };
  }, [geometry, materials]);

  useFrame((_, delta) => {
    const theme = useThemeStore.getState().theme;
    if (theme !== lastThemeRef.current) {
      lastThemeRef.current = theme;
      startAngleRef.current = curAngleRef.current;
      targetAngleRef.current = theme === 'night' ? -rockerTiltRad : rockerTiltRad;
      animElapsedRef.current = 0;
    }

    if (animElapsedRef.current < 1 && instRef.current) {
      animElapsedRef.current = Math.min(1, animElapsedRef.current + Math.min(delta, 0.05) / rockerDurationSec);
      const t = 1 - Math.pow(1 - animElapsedRef.current, 2);
      curAngleRef.current =
        startAngleRef.current + (targetAngleRef.current - startAngleRef.current) * t;
      updateRockerMatrix(instRef.current, curAngleRef.current, plateDepth);
    }
  });

  return (
    <group name="light-switch" position={position} rotation={[0, rotationY, 0]}>
      {/* Draw call 1: Wall plate + Rocker paddle InstancedMesh */}
      <instancedMesh
        ref={instRef}
        args={[geometry, materials.switchBodyMat, 2]}
        userData={{ interactive: 'switch', dynamicTransform: true }}
      />
      {/* Draw call 2: Tiny status LED (amber in Day, cyan in Night) */}
      <mesh
        position={[0, 0.044, plateDepth + 0.002]}
        material={materials.statusLedMat}
        userData={{ interactive: 'switch' }}
      >
        <boxGeometry args={[0.014, 0.004, 0.003]} />
      </mesh>
    </group>
  );
}
