'use client';

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { MEDIA_WALL_CONFIG } from '@/config/roomConfig';
import { useTvStore } from '@/stores/tvStore';

interface TVScreenProps {
  texture?: THREE.Texture | null;
  powered?: boolean;
}

/**
 * Creates the standby CanvasTexture (1280x720) once:
 * dark background, centered "NIGHTCAST" title, thin line, and "Press E to use TV".
 */
export function createStandbyCanvasTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Dark background
  ctx.fillStyle = '#09090c';
  ctx.fillRect(0, 0, 1280, 720);

  // Subtle radial vignette
  const grad = ctx.createRadialGradient(640, 360, 80, 640, 360, 640);
  grad.addColorStop(0, 'rgba(30, 14, 20, 0.35)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.7)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1280, 720);

  // Centered "NIGHTCAST" title
  ctx.fillStyle = '#e5e7eb';
  ctx.font = '600 54px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('N I G H T C A S T', 640, 315);

  // Thin accent line
  ctx.strokeStyle = 'rgba(179, 18, 42, 0.65)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(500, 362);
  ctx.lineTo(780, 362);
  ctx.stroke();

  // Small text "Press E to use TV"
  ctx.fillStyle = '#8b8d94';
  ctx.font = '400 20px system-ui, -apple-system, sans-serif';
  ctx.fillText('Press E to use TV', 640, 402);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * TVScreen Component
 * 16:9 Screen (1.92m x 1.08m) placed at local (0, 1.7, 0.135).
 * Accepts optional "texture" and "powered" props.
 * Marked with userData = { interactive: "tv" }.
 */
export default function TVScreen({ texture: textureProp, powered: poweredProp }: TVScreenProps) {
  const storePowered = useTvStore((s) => s.powered);
  const storeSource = useTvStore((s) => s.source);

  const isPowered = poweredProp !== undefined ? poweredProp : storePowered;
  const fallbackTexture = useMemo(() => createStandbyCanvasTexture(), []);
  const activeTexture = textureProp !== undefined ? textureProp : fallbackTexture;

  const showStandbyMap = isPowered && storeSource === 'standby' && Boolean(activeTexture);

  const material = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: showStandbyMap ? '#ffffff' : isPowered ? '#08080a' : '#050506',
      map: showStandbyMap ? activeTexture : null,
      toneMapped: false,
    });
  }, [showStandbyMap, isPowered, activeTexture]);

  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  return (
    <mesh
      position={[0, MEDIA_WALL_CONFIG.tvCenterY, MEDIA_WALL_CONFIG.screenLocalZ]}
      userData={{ interactive: 'tv' }}
      material={material}
    >
      <planeGeometry
        args={[
          MEDIA_WALL_CONFIG.screenWidth,
          MEDIA_WALL_CONFIG.screenHeight,
        ]}
      />
    </mesh>
  );
}
