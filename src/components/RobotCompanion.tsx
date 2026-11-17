'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { ROBOT_CONFIG, ROBOT_STATIONS } from '@/config/robotConfig';
import { monaLivePose, useRobotStore } from '@/stores/robotStore';
import { useInputStore } from '@/stores/inputStore';
import { useThemeStore } from '@/stores/themeStore';
import { buildElsaSkinnedRig, type ElsaRigHandles } from '@/utils/elsaRig';
import { findNearestWalkableWorld } from '@/utils/robotNav';

const ELSA_MODEL_PATH = '/models/elsa.glb';
const _tmpVec = new THREE.Vector3();

function wrapAngle(a: number): number {
  let x = a;
  while (x > Math.PI) x -= Math.PI * 2;
  while (x < -Math.PI) x += Math.PI * 2;
  return x;
}

function lerpAngle(current: number, target: number, alpha: number): number {
  const diff = wrapAngle(target - current);
  return wrapAngle(current + diff * alpha);
}

/**
 * ELSA — 3D character loaded from /models/elsa.glb (DeadlyBeauty.glb) with a
 * smooth 7-bone procedural SkinnedMesh rig for catwalk stride, hip/skirt sway,
 * torso counter-rotation, breathing, playful head tracking, and A* navigation.
 */
export default function RobotCompanion() {
  const { camera } = useThree();
  const gltf = useGLTF(ELSA_MODEL_PATH);

  const rootRef = useRef<THREE.Group>(null);
  const modelMountRef = useRef<THREE.Group>(null);
  const rigRef = useRef<ElsaRigHandles | null>(null);

  const walkPhaseRef = useRef(0);
  const pauseTimerRef = useRef(2.8);
  const followRecalcTimerRef = useRef(0);
  const waveBlendRef = useRef(0);
  const speedBlendRef = useRef(0);

  const theme = useThemeStore((s) => s.theme);

  // Build, attach & dispose rigged SkinnedMesh imperatively via refs (React 19 StrictMode-safe)
  useEffect(() => {
    const mount = modelMountRef.current;
    if (!mount) return;
    const built = buildElsaSkinnedRig(gltf.scene);
    if (!built) return;
    rigRef.current = built;
    mount.scale.setScalar(built.modelScale);
    mount.add(built.skinnedMesh);
    return () => {
      mount.remove(built.skinnedMesh);
      if (rigRef.current === built) rigRef.current = null;
      built.dispose();
    };
  }, [gltf.scene]);

  // Welcome & introduce ELSA whenever a visitor enters the room from the menu
  useEffect(() => {
    let wasMenu = useInputStore.getState().mode === 'menu';
    const unsub = useInputStore.subscribe((state) => {
      if (state.mode === 'menu') {
        wasMenu = true;
        return;
      }
      if (wasMenu) {
        wasMenu = false;
        pauseTimerRef.current = Math.max(pauseTimerRef.current, 6.5);
        useRobotStore.getState().welcomeVisitor();
      }
    });
    return unsub;
  }, []);

  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const root = rootRef.current;
    if (!root) return;

    const robot = useRobotStore.getState();
    const input = useInputStore.getState();
    const talkingToPlayer = input.mode === 'focus' && input.focusKind === 'robot';
    const inMenu = input.mode === 'menu';

    const distToPlayer = Math.hypot(
      camera.position.x - monaLivePose.x,
      camera.position.z - monaLivePose.z
    );
    const angleToPlayer = Math.atan2(
      camera.position.x - monaLivePose.x,
      camera.position.z - monaLivePose.z
    );

    camera.getWorldDirection(_tmpVec);
    const toMonaX = (monaLivePose.x - camera.position.x) / Math.max(distToPlayer, 0.01);
    const toMonaZ = (monaLivePose.z - camera.position.z) / Math.max(distToPlayer, 0.01);
    const playerAttendingMona =
      robot.mode === 'patrol' &&
      distToPlayer < 2.6 &&
      _tmpVec.x * toMonaX + _tmpVec.z * toMonaZ > 0.68;

    let moving = false;

    if (!inMenu && !talkingToPlayer && !playerAttendingMona) {
      // 1. Follow behavior recalculation
      if (robot.mode === 'follow') {
        followRecalcTimerRef.current -= dt;
        if (
          distToPlayer > ROBOT_CONFIG.followResumeDist &&
          followRecalcTimerRef.current <= 0
        ) {
          followRecalcTimerRef.current = 0.45;
          const dirX = (monaLivePose.x - camera.position.x) / Math.max(distToPlayer, 0.01);
          const dirZ = (monaLivePose.z - camera.position.z) / Math.max(distToPlayer, 0.01);
          const goalRawX = camera.position.x + dirX * ROBOT_CONFIG.followMinDist;
          const goalRawZ = camera.position.z + dirZ * ROBOT_CONFIG.followMinDist;
          const [safeX, safeZ] = findNearestWalkableWorld(goalRawX, goalRawZ);
          robot.walkToPoint(safeX, safeZ, [camera.position.x, camera.position.z]);
        } else if (distToPlayer <= ROBOT_CONFIG.followMinDist && robot.waypoints.length > 0) {
          robot.clearPath();
        }
      }

      // 2. Steer along active A* waypoints
      if (robot.waypoints.length > 0) {
        const [wx, wz] = robot.waypoints[0];
        const dx = wx - monaLivePose.x;
        const dz = wz - monaLivePose.z;
        const dist = Math.hypot(dx, dz);

        if (dist < 0.11) {
          robot.consumeWaypoint();
        } else {
          const dotPlayer =
            ((camera.position.x - monaLivePose.x) * dx +
              (camera.position.z - monaLivePose.z) * dz) /
            Math.max(dist * Math.max(distToPlayer, 0.01), 0.01);

          if (distToPlayer < 0.95 && dotPlayer > 0.45) {
            monaLivePose.yaw = lerpAngle(monaLivePose.yaw, angleToPlayer, Math.min(1, dt * 6));
          } else {
            const speed =
              robot.mode === 'follow' ? ROBOT_CONFIG.followSpeed : ROBOT_CONFIG.walkSpeed;
            const step = Math.min(dist, speed * dt);
            monaLivePose.x += (dx / dist) * step;
            monaLivePose.z += (dz / dist) * step;

            const moveYaw = Math.atan2(dx, dz);
            monaLivePose.yaw = lerpAngle(
              monaLivePose.yaw,
              moveYaw,
              Math.min(1, dt * ROBOT_CONFIG.turnSpeed)
            );
            moving = true;
          }
        }
      } else if (robot.mode === 'patrol' && !robot.isSpeaking && Date.now() >= robot.waveUntil) {
        pauseTimerRef.current -= dt;
        if (pauseTimerRef.current <= 0) {
          pauseTimerRef.current =
            ROBOT_CONFIG.patrolPauseMinSec +
            Math.random() * (ROBOT_CONFIG.patrolPauseMaxSec - ROBOT_CONFIG.patrolPauseMinSec);
          robot.advancePatrol();
        }
      }
    }

    if (!moving) {
      if (talkingToPlayer || robot.mode === 'follow' || distToPlayer < 2.6) {
        monaLivePose.yaw = lerpAngle(monaLivePose.yaw, angleToPlayer, Math.min(1, dt * 5.2));
      } else if (robot.facingTarget) {
        const fYaw = Math.atan2(
          robot.facingTarget[0] - monaLivePose.x,
          robot.facingTarget[1] - monaLivePose.z
        );
        monaLivePose.yaw = lerpAngle(monaLivePose.yaw, fYaw, Math.min(1, dt * 3.8));
      } else {
        const spec = ROBOT_STATIONS[robot.station];
        const fYaw = Math.atan2(
          spec.faceAt[0] - monaLivePose.x,
          spec.faceAt[1] - monaLivePose.z
        );
        monaLivePose.yaw = lerpAngle(monaLivePose.yaw, fYaw, Math.min(1, dt * 3.5));
      }
    }

    monaLivePose.walking = moving;
    root.position.set(monaLivePose.x, 0, monaLivePose.z);
    root.rotation.y = monaLivePose.yaw;

    const rig = rigRef.current;
    if (!rig) return;

    // 3. Smooth catwalk stride, skirt flow, torso counter-twist, breathing & playful gestures
    const targetSpeedBlend = moving ? 1 : 0;
    speedBlendRef.current = THREE.MathUtils.lerp(
      speedBlendRef.current,
      targetSpeedBlend,
      Math.min(1, dt * 7.5)
    );
    const sb = speedBlendRef.current;

    if (moving || sb > 0.02) {
      walkPhaseRef.current += dt * (ROBOT_CONFIG.walkSpeed * 5.2);
    }

    const t = state.clock.elapsedTime;
    const phase = walkPhaseRef.current;

    const isWaving = Date.now() < robot.waveUntil;
    waveBlendRef.current = THREE.MathUtils.lerp(
      waveBlendRef.current,
      isWaving ? 1 : 0,
      Math.min(1, dt * 6.5)
    );
    const wb = waveBlendRef.current;

    const breath = Math.sin(t * 2.0) * 0.013;
    const idleHipSway = Math.sin(t * 1.15) * 0.022 * (1 - sb);
    const talkSwayY = robot.isSpeaking ? Math.sin(t * 3.0) * 0.055 : 0;
    const talkTiltZ = robot.isSpeaking ? Math.sin(t * 2.3) * 0.032 : 0;
    const talkLeanX = robot.isSpeaking ? -0.022 + Math.sin(t * 4.4) * 0.015 : 0;

    // Root vertical step bounce & forward walking lean
    rig.rootBone.position.y = Math.abs(Math.sin(phase)) * 0.024 * sb;
    rig.rootBone.rotation.x = 0.036 * sb;

    // Lower legs stride smoothly below dress hem without distorting skirt
    rig.frontLegBone.rotation.x = (0.06 + Math.sin(phase) * 0.23) * sb;
    rig.backLegBone.rotation.x = (-0.06 - Math.sin(phase) * 0.23) * sb;

    // Pelvis catwalk hip sway & idle weight shift
    rig.pelvisBone.position.x = Math.sin(phase) * 0.016 * sb;
    rig.pelvisBone.rotation.z = Math.sin(phase) * 0.055 * sb + idleHipSway;
    rig.pelvisBone.rotation.y = -Math.sin(phase) * 0.095 * sb;

    // Skirt trailing lag & hem bounce
    rig.skirtBone.rotation.z = Math.sin(phase - 0.72) * 0.065 * sb;
    rig.skirtBone.rotation.x = -0.024 * sb + Math.sin(phase * 2 - 0.5) * 0.02 * sb;

    // Torso counter-rotation, breathing & conversational charm
    rig.torsoBone.rotation.y = Math.sin(phase) * 0.11 * sb + talkSwayY;
    rig.torsoBone.rotation.z =
      -Math.sin(phase) * 0.042 * sb + talkTiltZ + Math.sin(t * 3.2) * 0.025 * wb;
    rig.torsoBone.rotation.x = breath + talkLeanX - 0.035 * wb;

    // Head tracking + playful tilt & speaking nod
    let targetLocalYaw = Math.sin(t * 0.65) * 0.06;
    let targetPitch = 0;
    let targetRoll = Math.sin(t * 1.1) * 0.025;

    if (talkingToPlayer || (!moving && distToPlayer < 3.6)) {
      const relYaw = wrapAngle(angleToPlayer - monaLivePose.yaw);
      targetLocalYaw = THREE.MathUtils.clamp(relYaw, -0.52, 0.52);
      const dy = camera.position.y - 1.48;
      targetPitch = THREE.MathUtils.clamp(
        -Math.atan2(dy, Math.max(distToPlayer, 0.6)) * 0.45,
        -0.22,
        0.2
      );
      if (robot.isSpeaking) {
        targetPitch += Math.sin(t * 5.2) * 0.035;
        targetRoll = 0.055 + Math.sin(t * 2.1) * 0.03;
      } else if (talkingToPlayer) {
        targetRoll = 0.048;
      } else if (wb > 0.05) {
        targetRoll = 0.07 * wb;
      }
    }

    rig.headBone.rotation.y = lerpAngle(rig.headBone.rotation.y, targetLocalYaw, Math.min(1, dt * 6));
    rig.headBone.rotation.x = THREE.MathUtils.lerp(
      rig.headBone.rotation.x,
      targetPitch,
      Math.min(1, dt * 6)
    );
    rig.headBone.rotation.z = THREE.MathUtils.lerp(
      rig.headBone.rotation.z,
      targetRoll,
      Math.min(1, dt * 5)
    );
  });

  const initialPos = useMemo(
    () => [monaLivePose.x, 0, monaLivePose.z] as [number, number, number],
    []
  );

  return (
    <group ref={rootRef} name="robot-elsa" position={initialPos} rotation={[0, monaLivePose.yaw, 0]}>
      {/* Rigged ELSA GLB Character */}
      <group ref={modelMountRef} />

      {/* Soft face-fill light so ELSA stays crisp and flattering in Night & Day modes */}
      <pointLight
        position={[0, 1.48, 0.72]}
        color="#ffe8dc"
        intensity={theme === 'night' ? 0.5 : 0.22}
        distance={2.1}
        decay={2}
      />

      {/* Lightweight invisible raycast hitbox for 60Hz hover/E interaction */}
      <mesh position={[0, 0.84, 0]} userData={{ interactive: 'robot' }}>
        <cylinderGeometry args={[0.28, 0.25, 1.66, 10]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

useGLTF.preload(ELSA_MODEL_PATH);
