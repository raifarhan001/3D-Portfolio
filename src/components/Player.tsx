'use client';

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import type { PointerLockControls as PointerLockControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import {
  PLAYER_CONFIG,
  ROOM_CONFIG,
  CAMERA_CONFIG,
  ALL_COLLIDERS,
} from '@/config/roomConfig';
import { usePcStore } from '@/stores/pcStore';
import { useInputStore } from '@/stores/inputStore';

interface PlayerProps {
  isLocked: boolean;
  onLock: () => void;
  onUnlock: () => void;
  controlsRef: React.RefObject<PointerLockControlsImpl | null>;
  movementEnabledRef: React.MutableRefObject<boolean>;
}

export default function Player({ isLocked, onLock, onUnlock, controlsRef, movementEnabledRef }: PlayerProps) {
  const { camera } = useThree();
  const inputMode = useInputStore((s) => s.mode);
  const focusExiting = useInputStore((s) => s.focusExiting);
  const interactiveActive = inputMode === 'focus' && !focusExiting;

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.isLocked = document.pointerLockElement !== null;
    }
  }, [controlsRef, isLocked, interactiveActive]);

  // Flag to ensure camera rotation is reset on first pointer lock
  const isFirstLock = useRef(true);

  // Current horizontal velocity
  const velocity = useRef(new THREE.Vector3());

  // Cached vector instances to avoid garbage collection churn in useFrame
  const forward = useRef(new THREE.Vector3());
  const right = useRef(new THREE.Vector3());
  const moveDirection = useRef(new THREE.Vector3());
  const targetVelocity = useRef(new THREE.Vector3());
  const upVector = useRef(new THREE.Vector3(0, 1, 0));

  // Active keyboard inputs
  const keys = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
  });

  // Reset player camera to entrance pose on mount and whenever returning to 'menu'
  useEffect(() => {
    if (inputMode !== 'menu') return;
    camera.position.set(...CAMERA_CONFIG.spawnPosition);
    camera.rotation.set(CAMERA_CONFIG.initialPitch, 0, 0, 'YXZ');
    camera.quaternion.setFromEuler(camera.rotation);
    isFirstLock.current = true;
  }, [camera, inputMode]);

  // Handler for pointer lock: reset camera rotation on first lock
  const handlePointerLock = () => {
    if (isFirstLock.current) {
      camera.rotation.set(CAMERA_CONFIG.initialPitch, 0, 0, 'YXZ');
      camera.quaternion.setFromEuler(camera.rotation);
      isFirstLock.current = false;
    }
    onLock();
  };

  // Track WASD, Arrow keys, and Shift for sprint
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const targetEl = event.target as HTMLElement | null;
      const tag = targetEl?.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        targetEl?.isContentEditable ||
        !movementEnabledRef.current ||
        useInputStore.getState().mode !== 'walking'
      ) {
        return;
      }

      switch (event.code) {
        case 'KeyW':
        case 'ArrowUp':
          keys.current.forward = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          keys.current.backward = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          keys.current.left = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          keys.current.right = true;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          keys.current.sprint = true;
          break;
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      switch (event.code) {
        case 'KeyW':
        case 'ArrowUp':
          keys.current.forward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          keys.current.backward = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          keys.current.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          keys.current.right = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          keys.current.sprint = false;
          break;
      }
    };

    const onBlur = () => {
      keys.current.forward = false;
      keys.current.backward = false;
      keys.current.left = false;
      keys.current.right = false;
      keys.current.sprint = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [movementEnabledRef]);

  useFrame((_, delta) => {
    // Controls idle unless actively in 'walking' state with movement enabled
    const curMode = useInputStore.getState().mode;
    if (!movementEnabledRef.current || curMode !== 'walking') {
      keys.current.forward = false;
      keys.current.backward = false;
      keys.current.left = false;
      keys.current.right = false;
      keys.current.sprint = false;
      velocity.current.set(0, 0, 0);
      return;
    }

    // Cap delta to prevent large physics jumps if frame drops or tab is switched
    const safeDelta = Math.min(delta, 0.1);

    // Calculate horizontal forward vector from camera orientation
    camera.getWorldDirection(forward.current);
    forward.current.y = 0;
    if (forward.current.lengthSq() < 0.0001) {
      forward.current.set(0, 0, -1);
    } else {
      forward.current.normalize();
    }

    // Right vector is perpendicular to forward in XZ plane
    right.current.crossVectors(forward.current, upVector.current).normalize();

    // Determine movement direction vector based on pressed keys
    moveDirection.current.set(0, 0, 0);

    if (isLocked && movementEnabledRef.current) {
      if (keys.current.forward) moveDirection.current.add(forward.current);
      if (keys.current.backward) moveDirection.current.sub(forward.current);
      if (keys.current.right) moveDirection.current.add(right.current);
      if (keys.current.left) moveDirection.current.sub(right.current);
    }

    if (moveDirection.current.lengthSq() > 0.0001) {
      moveDirection.current.normalize();
    }

    // Target velocity with walk or sprint speed
    const currentSpeed = keys.current.sprint ? PLAYER_CONFIG.sprintSpeed : PLAYER_CONFIG.walkSpeed;
    targetVelocity.current.copy(moveDirection.current).multiplyScalar(currentSpeed);

    // Frame-rate independent exponential acceleration and damping
    const isAccelerating = targetVelocity.current.lengthSq() > 0.001;
    const rate = isAccelerating ? PLAYER_CONFIG.acceleration : PLAYER_CONFIG.damping;
    const lerpFactor = 1 - Math.exp(-rate * safeDelta);

    velocity.current.lerp(targetVelocity.current, lerpFactor);

    // Update camera horizontal position
    camera.position.x += velocity.current.x * safeDelta;
    camera.position.z += velocity.current.z * safeDelta;
    camera.position.y = PLAYER_CONFIG.eyeHeight;

    // Update global camera position coordinates for spatial audio listener
    (window as unknown as { __cameraPos?: [number, number, number] }).__cameraPos = [
      camera.position.x,
      camera.position.y,
      camera.position.z,
    ];

    // Room collision bounds clamping with configured margin (0.4m)
    const halfWidth = ROOM_CONFIG.width / 2;
    const halfDepth = ROOM_CONFIG.depth / 2;
    const minX = -halfWidth + PLAYER_CONFIG.collisionMargin;
    const maxX = halfWidth - PLAYER_CONFIG.collisionMargin;
    const minZ = -halfDepth + PLAYER_CONFIG.collisionMargin;
    const maxZ = halfDepth - PLAYER_CONFIG.collisionMargin;

    if (camera.position.x < minX) {
      camera.position.x = minX;
      velocity.current.x = 0;
    } else if (camera.position.x > maxX) {
      camera.position.x = maxX;
      velocity.current.x = 0;
    }

    if (camera.position.z < minZ) {
      camera.position.z = minZ;
      velocity.current.z = 0;
    } else if (camera.position.z > maxZ) {
      camera.position.z = maxZ;
      velocity.current.z = 0;
    }

    // Collision resolution against Media Wall & Sofa Set & Gaming Corner furniture
    const margin = PLAYER_CONFIG.collisionMargin;
    const isChairOccupied = usePcStore.getState().chairSeated;
    for (let i = 0; i < ALL_COLLIDERS.length; i++) {
      const col = ALL_COLLIDERS[i];
      if (col.id === 'gaming-chair' && isChairOccupied) continue;
      const colMinX = col.min[0] - margin;
      const colMaxX = col.max[0] + margin;
      const colMinZ = col.min[2] - margin;
      const colMaxZ = col.max[2] + margin;

      if (
        camera.position.x > colMinX &&
        camera.position.x < colMaxX &&
        camera.position.z > colMinZ &&
        camera.position.z < colMaxZ
      ) {
        const dLeft = camera.position.x - colMinX;
        const dRight = colMaxX - camera.position.x;
        const dBack = camera.position.z - colMinZ;
        const dFront = colMaxZ - camera.position.z;
        const minPenetration = Math.min(dLeft, dRight, dBack, dFront);

        if (minPenetration === dRight) {
          camera.position.x = colMaxX;
          if (velocity.current.x < 0) velocity.current.x = 0;
        } else if (minPenetration === dLeft) {
          camera.position.x = colMinX;
          if (velocity.current.x > 0) velocity.current.x = 0;
        } else if (minPenetration === dFront) {
          camera.position.z = colMaxZ;
          if (velocity.current.z < 0) velocity.current.z = 0;
        } else if (minPenetration === dBack) {
          camera.position.z = colMinZ;
          if (velocity.current.z > 0) velocity.current.z = 0;
        }
      }
    }
  });

  return (
    <PointerLockControls
      ref={controlsRef}
      enabled={!interactiveActive}
      selector="#plc-manual-lock-only"
      onLock={handlePointerLock}
      onUnlock={onUnlock}
    />
  );
}
