'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three-stdlib';
import {
  ROOM_CONFIG,
  CEILING_PANEL_SYSTEM_CONFIG,
  RECT_AREA_LIGHT_CONFIG,
  FLOOR_CONFIG,
} from '@/config/roomConfig';
import { buildMergedGeometry, freezeStaticMatrices } from '@/utils/mergeHelpers';
import MediaWall from '@/components/MediaWall';
import SofaLounge from '@/components/SofaLounge';
import GramophoneCorner from '@/components/GramophoneCorner';
import GymCorner from '@/components/GymCorner';
import GamingCorner from '@/components/GamingCorner';
import CertificatesShelf from '@/components/CertificatesShelf';
import DeskPhone from '@/components/DeskPhone';
import WallDecor from '@/components/WallDecor';
import LightSwitch from '@/components/LightSwitch';
import WindowCurtains from '@/components/WindowCurtains';
import CenterRug from '@/components/CenterRug';
import SideTableCoffee from '@/components/SideTableCoffee';
import ArcadeCabinet from '@/components/ArcadeCabinet';
import RgbPerimeterLights from '@/components/RgbPerimeterLights';
import GameCollectionShelf from '@/components/GameCollectionShelf';
import ControllerWallDisplay from '@/components/ControllerWallDisplay';
import GamingWallDecor from '@/components/GamingWallDecor';
import LoungeSnacks from '@/components/LoungeSnacks';
import HeroNameSign from '@/components/HeroNameSign';
import EntranceDoormat from '@/components/EntranceDoormat';
import RobotCompanion from '@/components/RobotCompanion';
import { GAMING_ROOM_CONFIG, THEMES_CONFIG } from '@/config/themeConfig';
import { useThemed } from '@/utils/themeRegistry';

if (typeof window !== 'undefined') {
  RectAreaLightUniformsLib.init();
}

/**
 * Generates a subtle procedural fabric noise texture for the ceiling diffuser panel.
 */
function createNoiseTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const imgData = ctx.createImageData(256, 256);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const val = 236 + Math.floor(Math.random() * 20);
    data[i] = val;
    data[i + 1] = val;
    data[i + 2] = val;
    data[i + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    CEILING_PANEL_SYSTEM_CONFIG.noiseRepeat[0],
    CEILING_PANEL_SYSTEM_CONFIG.noiseRepeat[1]
  );
  return texture;
}

/**
 * Generates a seamless staggered oak plank CanvasTexture (1024x1024 = 2.4m x 2.4m tile).
 * Planks are 0.15m wide (64px) and 1.2m long (512px) with +-6% lightness variation,
 * subtle oak grain, and thin darker gaps.
 */
function createOakPlankTexture(roomWidth: number, roomDepth: number): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const rows = 16; // 16 * 0.15m = 2.4m tile height
  const cols = 2; // 2 * 1.2m = 2.4m tile width
  const plankH = size / rows; // 64px
  const plankW = size / cols; // 512px
  const gap = 2.5;

  // Deterministic pseudo-random per plank for clean +-6% lightness variation
  const hash = (n: number) => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };

  // Thin dark gap fill underneath planks
  ctx.fillStyle = '#5c4b3b';
  ctx.fillRect(0, 0, size, size);

  const staggerFractions = [0, 0.5, 0.25, 0.75, 0.15, 0.65, 0.35, 0.85];

  for (let r = 0; r < rows; r++) {
    const y = r * plankH;
    const offset = staggerFractions[r % staggerFractions.length] * plankW;

    for (let c = -1; c <= cols; c++) {
      const x = c * plankW + offset;
      // Normalize column index across tile wrap for consistent color across seam
      const wrappedCol = ((c % cols) + cols) % cols;
      const variation = (hash(r * 17 + wrappedCol) * 2 - 1) * 0.06; // +-6%
      const lVal = Math.round(240 * (1 + variation));
      const clamped = Math.max(210, Math.min(255, lVal));

      ctx.fillStyle = `rgb(${clamped}, ${Math.round(clamped * 0.99)}, ${Math.round(clamped * 0.97)})`;
      ctx.fillRect(x + gap * 0.5, y + gap * 0.5, plankW - gap, plankH - gap);

      // Subtle horizontal wood grain streaks
      ctx.fillStyle = 'rgba(110, 82, 52, 0.075)';
      for (let g = 0; g < 6; g++) {
        const gy = y + 6 + hash(r * 31 + wrappedCol * 7 + g) * (plankH - 12);
        ctx.fillRect(x + gap, gy, plankW - gap * 2, 1.5);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  // Tile covers 2.4m x 2.4m -> repeat so each plank stays 1.2m long x 0.15m wide
  const tileW = FLOOR_CONFIG.plankLength * cols;
  const tileH = FLOOR_CONFIG.plankWidth * rows;
  texture.repeat.set(roomWidth / tileW, roomDepth / tileH);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

/**
 * 3D Room Component — Light Oak Floor, Clean Single Luminous Ceiling, Plain Walls.
 */
export default function Room() {
  const { width, depth, height, wallColor, wallRoughness, wallMetalness } = ROOM_CONFIG;
  const wallThickness = 0.1;
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const halfHeight = height / 2;

  const panelYPos = height - CEILING_PANEL_SYSTEM_CONFIG.yOffsetFromCeiling;
  const areaLightYPos = height - RECT_AREA_LIGHT_CONFIG.yOffsetFromCeiling;

  const staticGroupRef = useRef<THREE.Group>(null);
  const rectLightRef = useRef<THREE.RectAreaLight>(null);

  useEffect(() => {
    RectAreaLightUniformsLib.init();
  }, []);

  useLayoutEffect(() => {
    freezeStaticMatrices(staticGroupRef.current);
  }, []);

  const noiseTexture = useMemo(() => createNoiseTexture(), []);
  const oakPlankTexture = useMemo(() => createOakPlankTexture(width, depth), [width, depth]);

  // Compute ceiling panels & merged static shell geometries
  const {
    panels,
    mergedRunnersGeo,
    mergedCoveLeftGeo,
    mergedCoveRightGeo,
    mergedWallsGeo,
    eastAccentWallGeo,
    mergedBaseboardsGeo,
  } = useMemo(() => {
    const { mode, gridRows, gridCols, margin, frameWidth, frameHeight } =
      CEILING_PANEL_SYSTEM_CONFIG;

    const activeW = width - margin * 2;
    const activeD = depth - margin * 2;

    const computedPanels =
      mode === 'single'
        ? [{ id: 'single-full-light-panel', cx: 0, cz: 0, width: activeW, depth: activeD }]
        : (() => {
            const pW = (activeW - (gridCols - 1) * frameWidth) / gridCols;
            const pD = (activeD - (gridRows - 1) * frameWidth) / gridRows;
            const startX = -width / 2 + margin + pW / 2;
            const startZ = -depth / 2 + margin + pD / 2;
            const list = [];
            for (let r = 0; r < gridRows; r++) {
              for (let c = 0; c < gridCols; c++) {
                list.push({
                  id: `ceiling-light-panel-${r}-${c}`,
                  cx: startX + c * (pW + frameWidth),
                  cz: startZ + r * (pD + frameWidth),
                  width: pW,
                  depth: pD,
                });
              }
            }
            return list;
          })();

    // Merge border runners (+ optional internal runners if grid) into 1 geometry
    const runnerParts = [
      { geometry: new THREE.BoxGeometry(width, frameHeight, margin), position: [0, panelYPos, -depth / 2 + margin / 2] as [number, number, number] },
      { geometry: new THREE.BoxGeometry(width, frameHeight, margin), position: [0, panelYPos, depth / 2 - margin / 2] as [number, number, number] },
      { geometry: new THREE.BoxGeometry(margin, frameHeight, activeD), position: [-width / 2 + margin / 2, panelYPos, 0] as [number, number, number] },
      { geometry: new THREE.BoxGeometry(margin, frameHeight, activeD), position: [width / 2 - margin / 2, panelYPos, 0] as [number, number, number] },
    ];
    if (mode === 'grid') {
      const pW = (activeW - (gridCols - 1) * frameWidth) / gridCols;
      const pD = (activeD - (gridRows - 1) * frameWidth) / gridRows;
      const runnerStartX = -width / 2 + margin + pW;
      for (let c = 0; c < gridCols - 1; c++) {
        const x = runnerStartX + c * (pW + frameWidth) + frameWidth / 2;
        runnerParts.push({ geometry: new THREE.BoxGeometry(frameWidth, frameHeight, activeD), position: [x, panelYPos, 0] });
      }
      const runnerStartZ = -depth / 2 + margin + pD;
      for (let r = 0; r < gridRows - 1; r++) {
        const z = runnerStartZ + r * (pD + frameWidth) + frameWidth / 2;
        runnerParts.push({ geometry: new THREE.BoxGeometry(activeW, frameHeight, frameWidth), position: [0, panelYPos, z] });
      }
    }

    const coveLeftGeo = buildMergedGeometry([
      { geometry: new THREE.BoxGeometry(width - 0.36, 0.012, 0.014), position: [0, height - 0.055, -halfDepth + 0.17] },
      { geometry: new THREE.BoxGeometry(0.014, 0.012, depth - 0.36), position: [-halfWidth + 0.17, height - 0.055, 0] },
    ]);
    const coveRightGeo = buildMergedGeometry([
      { geometry: new THREE.BoxGeometry(width - 0.36, 0.012, 0.014), position: [0, height - 0.055, halfDepth - 0.17] },
      { geometry: new THREE.BoxGeometry(0.014, 0.012, depth - 0.36), position: [halfWidth - 0.17, height - 0.055, 0] },
    ]);

    const wallsGeo = buildMergedGeometry([
      { geometry: new THREE.BoxGeometry(width + wallThickness * 2, height, wallThickness), position: [0, halfHeight, -halfDepth - wallThickness / 2] },
      { geometry: new THREE.BoxGeometry(width + wallThickness * 2, height, wallThickness), position: [0, halfHeight, halfDepth + wallThickness / 2] },
      { geometry: new THREE.BoxGeometry(wallThickness, height, depth), position: [-halfWidth - wallThickness / 2, halfHeight, 0] },
    ]);

    const eastAccentWallGeo = buildMergedGeometry([
      { geometry: new THREE.BoxGeometry(wallThickness, height, depth), position: [halfWidth + wallThickness / 2, halfHeight, 0] },
    ]);

    const baseboardsGeo = buildMergedGeometry([
      { geometry: new THREE.BoxGeometry(width, 0.09, 0.02), position: [0, 0.045, -halfDepth + 0.01] },
      { geometry: new THREE.BoxGeometry(width, 0.09, 0.02), position: [0, 0.045, halfDepth - 0.01] },
      { geometry: new THREE.BoxGeometry(0.02, 0.09, depth), position: [halfWidth - 0.01, 0.045, 0] },
    ]);

    return {
      panels: computedPanels,
      mergedRunnersGeo: buildMergedGeometry(runnerParts),
      mergedCoveLeftGeo: coveLeftGeo,
      mergedCoveRightGeo: coveRightGeo,
      mergedWallsGeo: wallsGeo,
      eastAccentWallGeo,
      mergedBaseboardsGeo: baseboardsGeo,
    };
  }, [width, depth, height, halfWidth, halfDepth, halfHeight, panelYPos, wallThickness]);

  const materials = useMemo(() => {
    return {
      wall: new THREE.MeshStandardMaterial({
        color: wallColor,
        roughness: wallRoughness,
        metalness: wallMetalness,
        side: THREE.DoubleSide,
      }),
      accentWall: new THREE.MeshStandardMaterial({
        color: GAMING_ROOM_CONFIG.accentWall.night,
        roughness: GAMING_ROOM_CONFIG.accentWall.roughness,
        metalness: GAMING_ROOM_CONFIG.accentWall.metalness,
        side: THREE.DoubleSide,
      }),
      floorPlank: new THREE.MeshStandardMaterial({
        color: FLOOR_CONFIG.color,
        roughness: FLOOR_CONFIG.roughness,
        metalness: FLOOR_CONFIG.metalness,
        map: oakPlankTexture,
      }),
      panelLuminous: new THREE.MeshBasicMaterial({
        color: CEILING_PANEL_SYSTEM_CONFIG.panelColor,
        map: noiseTexture,
        toneMapped: false,
        side: THREE.DoubleSide,
      }),
      ceilingBase: new THREE.MeshStandardMaterial({
        color: CEILING_PANEL_SYSTEM_CONFIG.baseColor,
        roughness: CEILING_PANEL_SYSTEM_CONFIG.baseRoughness,
        metalness: 0.08,
      }),
      frameRunner: new THREE.MeshStandardMaterial({
        color: CEILING_PANEL_SYSTEM_CONFIG.frameColor,
        roughness: CEILING_PANEL_SYSTEM_CONFIG.frameRoughness,
        metalness: 0.3,
      }),
      coveLeft: new THREE.MeshBasicMaterial({
        color: CEILING_PANEL_SYSTEM_CONFIG.coveLedColor,
        toneMapped: false,
      }),
      coveRight: new THREE.MeshBasicMaterial({
        color: CEILING_PANEL_SYSTEM_CONFIG.coveLedColor,
        toneMapped: false,
      }),
      darkTrim: new THREE.MeshStandardMaterial({
        color: '#3e424d',
        roughness: 0.65,
        metalness: 0.2,
      }),
    };
  }, [wallColor, wallRoughness, wallMetalness, noiseTexture, oakPlankTexture]);

  useThemed(
    rectLightRef,
    {
      day: { color: THEMES_CONFIG.day.rectLightColor, intensity: THEMES_CONFIG.day.rectLightIntensity },
      night: { color: THEMES_CONFIG.night.rectLightColor, intensity: THEMES_CONFIG.night.rectLightIntensity },
    },
    []
  );

  useThemed(
    materials.wall,
    {
      day: { color: THEMES_CONFIG.day.wallTint },
      night: { color: THEMES_CONFIG.night.wallTint },
    },
    [materials.wall]
  );

  useThemed(
    materials.accentWall,
    {
      day: { color: GAMING_ROOM_CONFIG.accentWall.day },
      night: { color: GAMING_ROOM_CONFIG.accentWall.night },
    },
    [materials.accentWall]
  );

  useThemed(
    materials.floorPlank,
    {
      day: { color: THEMES_CONFIG.day.floorTint },
      night: { color: THEMES_CONFIG.night.floorTint },
    },
    [materials.floorPlank]
  );

  useThemed(
    materials.panelLuminous,
    {
      day: {
        color: THEMES_CONFIG.day.ceilingPanelColor,
        intensity: THEMES_CONFIG.day.ceilingPanelIntensity,
      },
      night: {
        color: THEMES_CONFIG.night.ceilingPanelColor,
        intensity: THEMES_CONFIG.night.ceilingPanelIntensity,
      },
    },
    [materials.panelLuminous]
  );

  useThemed(
    materials.coveLeft,
    {
      day: {
        color: THEMES_CONFIG.day.slotLedLeftColor,
        intensity: THEMES_CONFIG.day.slotLedIntensity,
      },
      night: {
        color: THEMES_CONFIG.night.slotLedLeftColor,
        intensity: THEMES_CONFIG.night.slotLedIntensity,
      },
    },
    [materials.coveLeft]
  );

  useThemed(
    materials.coveRight,
    {
      day: {
        color: THEMES_CONFIG.day.slotLedRightColor,
        intensity: THEMES_CONFIG.day.slotLedIntensity,
      },
      night: {
        color: THEMES_CONFIG.night.slotLedRightColor,
        intensity: THEMES_CONFIG.night.slotLedIntensity,
      },
    },
    [materials.coveRight]
  );

  return (
    <group>
      <group ref={staticGroupRef}>
        {/* 1. Light Oak Staggered Plank Floor (#c9a574, roughness 0.8, metalness 0) */}
        <mesh position={[0, -wallThickness / 2, 0]}>
          <boxGeometry args={[width, wallThickness, depth]} />
          <meshStandardMaterial color="#8f6c47" roughness={0.9} />
        </mesh>

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} material={materials.floorPlank}>
          <planeGeometry args={[width, depth]} />
        </mesh>

        {/* 2. Ceiling Structural Base & Single Clean Luminous Panel + Dark Border */}
        <mesh position={[0, height + wallThickness / 2, 0]} material={materials.ceilingBase}>
          <boxGeometry args={[width, wallThickness, depth]} />
        </mesh>

        <group name="ceiling-light-panels">
          {panels.map((p) => (
            <mesh
              key={p.id}
              position={[p.cx, panelYPos, p.cz]}
              rotation={[Math.PI / 2, 0, 0]}
              material={materials.panelLuminous}
            >
              <planeGeometry args={[p.width, p.depth]} />
            </mesh>
          ))}
        </group>

        <mesh geometry={mergedRunnersGeo} material={materials.frameRunner} />

        {/* Perimeter Slot Lights (Cyan & Magenta in Night theme, warm cream in Day) */}
        <mesh geometry={mergedCoveLeftGeo} material={materials.coveLeft} />
        <mesh geometry={mergedCoveRightGeo} material={materials.coveRight} />

        {/* 3. Merged Perimeter Walls, East Dark Charcoal Accent Wall & Baseboards */}
        <mesh geometry={mergedWallsGeo} material={materials.wall} />
        <mesh geometry={eastAccentWallGeo} material={materials.accentWall} />
        <mesh geometry={mergedBaseboardsGeo} material={materials.darkTrim} />
      </group>

      {/* 4. Diffuse Ceiling RectAreaLight */}
      <rectAreaLight
        ref={rectLightRef}
        width={RECT_AREA_LIGHT_CONFIG.width}
        height={RECT_AREA_LIGHT_CONFIG.height}
        color={RECT_AREA_LIGHT_CONFIG.color}
        intensity={RECT_AREA_LIGHT_CONFIG.intensity}
        position={[0, areaLightYPos, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      />

      {/* 5. Media Wall on West Wall (x = -5) */}
      <MediaWall />

      {/* 6. Sofa Set, Armchair, Coffee Table & Plush Floor Rug */}
      <SofaLounge />

      {/* 7. Right Corner Table, Interactive Gramophone & Cassette Box */}
      <GramophoneCorner />

      {/* 8. South-East Corner Home Gym */}
      <GymCorner />

      {/* 9. Back-Right Corner Gaming Setup */}
      <GamingCorner />

      {/* 10. Step 4C Portfolio Sections & Wall Decoration */}
      <CertificatesShelf />
      <DeskPhone />
      <WallDecor />

      {/* 11. Step 5: Theme Switch, Curtains, Center Rug, Side Table & Playable Arcade */}
      <LightSwitch />
      <WindowCurtains />
      <CenterRug />
      <SideTableCoffee />
      <ArcadeCabinet />

      {/* 12. Step 6: RGB Gaming Room Features & Wall / Lounge Details */}
      <RgbPerimeterLights />
      <GameCollectionShelf />
      <ControllerWallDisplay />
      <GamingWallDecor />
      <LoungeSnacks />

      {/* 13. Identity Signage & Entrance Doormat */}
      <HeroNameSign />
      <EntranceDoormat />

      {/* 14. Interactive Bilingual Humanoid Companion (ELSA) */}
      <RobotCompanion />
    </group>
  );
}
