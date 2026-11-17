'use client';

import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useTvStore } from '@/stores/tvStore';
import { TV_CONFIG, MEDIA_WALL_CONFIG } from '@/config/roomConfig';
import TVScreenContent from '@/components/TVScreenContent';

// TV screen center in world coordinates (MediaWall at [-5, 0, 0] rotated +90deg around Y)
const TV_SCREEN_WORLD_X = MEDIA_WALL_CONFIG.groupPosition[0] + MEDIA_WALL_CONFIG.screenLocalZ;
const TV_SCREEN_WORLD_Y = MEDIA_WALL_CONFIG.tvCenterY;
const TV_SCREEN_WORLD_Z = 0;

// Html transform sizing: at distanceFactor=10, 1 CSS px = 10/400 = 0.025 world units.
// For 1280px width to match screenWidth (1.92m), scale = 1.92 / (1280 * 0.025) = 0.06.
const IFRAME_W = 1280;
const IFRAME_H = 720;
const HTML_DISTANCE_FACTOR = 10;
const HTML_SCALE = MEDIA_WALL_CONFIG.screenWidth / (IFRAME_W * (HTML_DISTANCE_FACTOR / 400));

// Pre-allocated vectors for zero-allocation useFrame visibility check
const _camPos = new THREE.Vector3();
const _tvPos = new THREE.Vector3(TV_SCREEN_WORLD_X, TV_SCREEN_WORLD_Y, TV_SCREEN_WORLD_Z);
const _camFwd = new THREE.Vector3();
const _dirToTv = new THREE.Vector3();

/**
 * TVContent — places the 1280x720 Smart TV Home Screen / NightCast / YouTube Music view
 * directly on the 1.92m x 1.08m screen plane. When TV Fullscreen overlay is active,
 * hands off live iframe rendering to TVFullscreenOverlay so audio never duplicates.
 */
export default function TVContent() {
  const powered = useTvStore((s) => s.powered);
  const tvMode = useTvStore((s) => s.tvMode);
  const isSeated = useTvStore((s) => s.isSeated);
  const tvExiting = useTvStore((s) => s.tvExiting);
  const tvFullscreen = useTvStore((s) => s.tvFullscreen);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const { camera } = useThree();

  const canInteract = (tvMode || isSeated) && !tvExiting && !tvFullscreen;

  // Reclaim window focus if leaving TV/sofa focus while an inner iframe or control holds focus
  useEffect(() => {
    if (
      !canInteract &&
      document.activeElement instanceof HTMLElement &&
      wrapperRef.current?.contains(document.activeElement)
    ) {
      document.activeElement.blur();
      window.focus();
    }
  }, [canInteract]);

  // Zero-allocation visibility check each frame (opacity only — no unmount or display:none)
  useFrame(() => {
    const el = wrapperRef.current;
    if (!el) return;

    _camPos.copy(camera.position);
    _dirToTv.subVectors(_tvPos, _camPos);
    const dist = _dirToTv.length();
    if (dist > 0.0001) {
      _dirToTv.divideScalar(dist);
    }

    camera.getWorldDirection(_camFwd);
    const dot = _camFwd.dot(_dirToTv);

    const behindScreen = _camPos.x <= TV_SCREEN_WORLD_X;
    const tooFar = dist > TV_CONFIG.tvVisibilityDistance;
    const lookingAway = dot < 0;
    const hidden = behindScreen || tooFar || lookingAway || tvFullscreen;

    if (hidden) {
      if (el.style.opacity !== '0') {
        el.style.opacity = '0';
        el.style.pointerEvents = 'none';
      }
    } else {
      if (el.style.opacity !== '1') {
        el.style.opacity = '1';
      }
      const desiredPE = canInteract ? 'auto' : 'none';
      if (el.style.pointerEvents !== desiredPE) {
        el.style.pointerEvents = desiredPE;
      }
    }
  });

  // Unmount everything when TV is powered OFF
  if (!powered) return null;

  return (
    <Html
      transform
      distanceFactor={HTML_DISTANCE_FACTOR}
      position={[
        TV_SCREEN_WORLD_X + 0.004,
        TV_SCREEN_WORLD_Y,
        TV_SCREEN_WORLD_Z,
      ]}
      rotation={[0, Math.PI / 2, 0]}
      scale={[HTML_SCALE, HTML_SCALE, HTML_SCALE]}
      zIndexRange={[30, 10]}
      pointerEvents={canInteract ? 'auto' : 'none'}
    >
      <div
        ref={wrapperRef}
        style={{
          position: 'relative',
          width: `${IFRAME_W}px`,
          height: `${IFRAME_H}px`,
          pointerEvents: canInteract ? 'auto' : 'none',
          opacity: 1,
          transition: 'opacity 0.25s ease',
          overflow: 'hidden',
          backgroundColor: '#070709',
          userSelect: 'none',
        }}
      >
        {/* Transparent 24px top strip outside iframe so clicking reclaims keyboard focus from embeds */}
        <div
          data-tv-focus-strip="true"
          onPointerDown={(e) => {
            e.stopPropagation();
            window.focus();
          }}
          onClick={(e) => {
            e.stopPropagation();
            window.focus();
          }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '24px',
            zIndex: 40,
            background: 'transparent',
            pointerEvents: canInteract ? 'auto' : 'none',
          }}
        />

        {tvFullscreen ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#09090d',
              color: '#9ca3af',
              fontFamily: 'system-ui, sans-serif',
              fontSize: '24px',
            }}
          >
            Playing in Fullscreen Mode
          </div>
        ) : (
          <TVScreenContent mode="3d" canInteract={canInteract} />
        )}
      </div>
    </Html>
  );
}
