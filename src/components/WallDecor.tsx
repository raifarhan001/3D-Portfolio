'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ROOM_CONTENT_CONFIG, isWallItemVisible } from '@/config/roomContent';
import { usePortfolioStore } from '@/stores/portfolioStore';
import { usePcStore } from '@/stores/pcStore';
import {
  buildMergedColoredGeometry,
  buildMergedGeometry,
  freezeStaticMatrices,
  type ColoredGeometryPart,
  type GeometryPart,
} from '@/utils/mergeHelpers';
import {
  applyAtlasUVsToPlane,
  createClockFaceTexture,
  createCoolGlowStripTexture,
  createGalleryAtlas,
  createNeonSignTexture,
  createNightCityWindowTexture,
  createWalnutSlatsTexture,
  createWorldMapTexture,
  getAtlasCellUVs,
} from '@/utils/portfolioTextures';
import { THEMES_CONFIG } from '@/config/themeConfig';
import { createDaySkyWindowTexture } from '@/utils/step5Textures';
import { useThemed } from '@/utils/themeRegistry';

interface GalleryFrameSpec {
  dx: number;
  dy: number;
  w: number;
  h: number;
  frameColor: string;
  atlasIndex: number;
}

const GALLERY_FRAMES: ReadonlyArray<GalleryFrameSpec> = [
  { dx: -0.58, dy: 0.28, w: 0.46, h: 0.6, frameColor: '#181a20', atlasIndex: 0 },
  { dx: -0.02, dy: 0.36, w: 0.56, h: 0.4, frameColor: '#c9a574', atlasIndex: 1 },
  { dx: 0.5, dy: 0.32, w: 0.38, h: 0.48, frameColor: '#c9a574', atlasIndex: 5 },
  { dx: -0.56, dy: -0.28, w: 0.42, h: 0.42, frameColor: '#c9a574', atlasIndex: 3 },
  { dx: -0.06, dy: -0.18, w: 0.44, h: 0.56, frameColor: '#181a20', atlasIndex: 2 },
  { dx: 0.48, dy: -0.16, w: 0.52, h: 0.38, frameColor: '#181a20', atlasIndex: 4 },
];

function buildHollowUnitFrameGeometry(): THREE.BufferGeometry {
  const t = 0.045;
  const d = 0.022;
  return buildMergedGeometry([
    { geometry: new THREE.BoxGeometry(1, t, d), position: [0, 0.5 - t / 2, 0] },
    { geometry: new THREE.BoxGeometry(1, t, d), position: [0, -0.5 + t / 2, 0] },
    { geometry: new THREE.BoxGeometry(t, 1 - t * 2, d), position: [-0.5 + t / 2, 0, 0] },
    { geometry: new THREE.BoxGeometry(t, 1 - t * 2, d), position: [0.5 - t / 2, 0, 0] },
  ]);
}

function addPlantToParts(
  pots: ColoredGeometryPart[],
  foliage: ColoredGeometryPart[],
  origin: [number, number, number],
  scaleFactor: number,
  leafCount: number,
  potColor: string
): void {
  const [ox, oy, oz] = origin;
  const potH = 0.26 * scaleFactor;
  const potRTop = 0.14 * scaleFactor;
  const potRBot = 0.1 * scaleFactor;

  pots.push(
    {
      geometry: new THREE.CylinderGeometry(potRTop, potRBot, potH, 12),
      position: [ox, oy + potH / 2, oz],
      color: potColor,
    },
    {
      geometry: new THREE.CylinderGeometry(potRTop * 0.9, potRTop * 0.9, 0.015 * scaleFactor, 12),
      position: [ox, oy + potH - 0.01 * scaleFactor, oz],
      color: '#2d2219',
    }
  );

  const greenPalette = ['#4b7f52', '#5c9463', '#3e6b44', '#6ba368'];
  const up = new THREE.Vector3(0, 1, 0);
  const dir = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const euler = new THREE.Euler(0, 0, 0, 'XYZ');

  for (let i = 0; i < leafCount; i++) {
    const yaw = (i / leafCount) * Math.PI * 2 + (i % 2) * 0.22;
    const tier = i % 3;
    const tilt = 0.2 + tier * 0.17;
    const stemLen = (0.3 + tier * 0.12) * scaleFactor;
    const leafW = (0.075 + (i % 2) * 0.022) * scaleFactor;
    const leafL = (0.24 + tier * 0.06) * scaleFactor;

    dir.set(Math.sin(yaw) * Math.sin(tilt), Math.cos(tilt), Math.cos(yaw) * Math.sin(tilt)).normalize();
    quat.setFromUnitVectors(up, dir);
    euler.setFromQuaternion(quat, 'XYZ');

    const baseY = oy + potH * 0.92;
    const tipX = ox + dir.x * stemLen;
    const tipY = baseY + dir.y * stemLen;
    const tipZ = oz + dir.z * stemLen;

    // Stem cylinder aligned radially along dir
    foliage.push({
      geometry: new THREE.CylinderGeometry(
        0.008 * scaleFactor,
        0.012 * scaleFactor,
        stemLen,
        6
      ),
      position: [ox + dir.x * (stemLen * 0.5), baseY + dir.y * (stemLen * 0.5), oz + dir.z * (stemLen * 0.5)],
      rotation: [euler.x, euler.y, euler.z],
      color: '#3a5f3e',
    });

    // Leaf blade angled slightly further outward
    dir.set(
      Math.sin(yaw) * Math.sin(tilt + 0.45),
      Math.cos(tilt + 0.45),
      Math.cos(yaw) * Math.sin(tilt + 0.45)
    ).normalize();
    quat.setFromUnitVectors(up, dir);
    euler.setFromQuaternion(quat, 'XYZ');

    foliage.push({
      geometry: new THREE.ConeGeometry(leafW, leafL, 4),
      position: [tipX + dir.x * (leafL * 0.35), tipY + dir.y * (leafL * 0.35), tipZ + dir.z * (leafL * 0.35)],
      rotation: [euler.x, euler.y, euler.z],
      scale: [1, 1, 0.26],
      color: greenPalette[i % greenPalette.length],
    });
  }
}

export default function WallDecor() {
  const graphicsQuality = usePortfolioStore((s) => s.graphicsQuality);

  const showWindow = isWallItemVisible('fakeWindow', graphicsQuality);
  const showWorldMap = isWallItemVisible('worldMapPoster', graphicsQuality);
  const showClock = isWallItemVisible('wallClock', graphicsQuality);
  const showSlatPanel = isWallItemVisible('acousticSlatPanel', graphicsQuality);
  const showGallery = isWallItemVisible('galleryWall', graphicsQuality);
  const showNeon = isWallItemVisible('neonSign', graphicsQuality);
  const showPlants = isWallItemVisible('plants', graphicsQuality);
  const showFloorLamp = isWallItemVisible('floorLamp', graphicsQuality);

  const rootRef = useRef<THREE.Group>(null);
  const galleryFramesInstRef = useRef<THREE.InstancedMesh>(null);
  const hourHandRef = useRef<THREE.Mesh>(null);
  const minuteHandRef = useRef<THREE.Mesh>(null);
  const secondHandRef = useRef<THREE.Mesh>(null);
  const clockTimerRef = useRef(1.0);

  const placements = ROOM_CONTENT_CONFIG.placements;

  const textures = useMemo(() => {
    return {
      galleryAtlas: createGalleryAtlas(),
      neonSign: createNeonSignTexture(ROOM_CONTENT_CONFIG.neonText, ROOM_CONTENT_CONFIG.neonColor),
      daySky: createDaySkyWindowTexture(),
      nightCity: createNightCityWindowTexture(),
      coolGlow: createCoolGlowStripTexture(),
      clockFace: createClockFaceTexture(),
      walnutSlats: createWalnutSlatsTexture(2.4),
      worldMap: createWorldMapTexture(),
    };
  }, []);

  const geometries = useMemo(() => {
    // 1. North Wall Wooden Frames (Fake Window + World Map frame merged together)
    const northWoodParts: GeometryPart[] = [];
    if (ROOM_CONTENT_CONFIG.wallItemsEnabled.fakeWindow) {
      const fw = placements.fakeWindow;
      const fwW = fw.width;
      const fwH = fw.height;
      const fwRail = 0.055;
      const fwDepth = 0.045;
      const [fwx, fwy, fwz] = fw.position;

      northWoodParts.push(
        { geometry: new THREE.BoxGeometry(fwW, fwRail, fwDepth), position: [fwx, fwy + (fwH - fwRail) / 2, fwz + fwDepth / 2] },
        { geometry: new THREE.BoxGeometry(fwW, fwRail, fwDepth), position: [fwx, fwy - (fwH - fwRail) / 2, fwz + fwDepth / 2] },
        { geometry: new THREE.BoxGeometry(fwRail, fwH - fwRail * 2, fwDepth), position: [fwx - (fwW - fwRail) / 2, fwy, fwz + fwDepth / 2] },
        { geometry: new THREE.BoxGeometry(fwRail, fwH - fwRail * 2, fwDepth), position: [fwx + (fwW - fwRail) / 2, fwy, fwz + fwDepth / 2] },
        { geometry: new THREE.BoxGeometry(fwW + 0.1, 0.032, 0.095), position: [fwx, fwy - fwH / 2 - 0.012, fwz + 0.045] },
        { geometry: new THREE.BoxGeometry(0.028, fwH - fwRail * 2, 0.025), position: [fwx, fwy, fwz + 0.024] },
        { geometry: new THREE.BoxGeometry(fwW - fwRail * 2, 0.026, 0.025), position: [fwx, fwy + 0.08, fwz + 0.024] }
      );
    }

    if (ROOM_CONTENT_CONFIG.wallItemsEnabled.worldMapPoster) {
      const wm = placements.worldMapPoster;
      const [wmx, wmy, wmz] = wm.position;
      const wmRim = 0.024;
      const wmD = 0.024;
      northWoodParts.push(
        { geometry: new THREE.BoxGeometry(wm.width, wmRim, wmD), position: [wmx, wmy + (wm.height - wmRim) / 2, wmz + wmD / 2] },
        { geometry: new THREE.BoxGeometry(wm.width, wmRim, wmD), position: [wmx, wmy - (wm.height - wmRim) / 2, wmz + wmD / 2] },
        { geometry: new THREE.BoxGeometry(wmRim, wm.height - wmRim * 2, wmD), position: [wmx - (wm.width - wmRim) / 2, wmy, wmz + wmD / 2] },
        { geometry: new THREE.BoxGeometry(wmRim, wm.height - wmRim * 2, wmD), position: [wmx + (wm.width - wmRim) / 2, wmy, wmz + wmD / 2] }
      );
    }

    const northWoodFramesGeo =
      northWoodParts.length > 0 ? buildMergedGeometry(northWoodParts) : new THREE.BufferGeometry();

    // 2. Gallery Wall: 1 InstancedMesh template for frames + 1 merged plane geo mapped to atlas
    const galleryFrameUnitGeo = buildHollowUnitFrameGeometry();
    const galleryArtParts: GeometryPart[] = GALLERY_FRAMES.map((spec) => {
      const plane = new THREE.PlaneGeometry(spec.w * 0.91, spec.h * 0.91);
      applyAtlasUVsToPlane(plane, getAtlasCellUVs(spec.atlasIndex, 3, 2, 2048, 1024, 4));
      return {
        geometry: plane,
        position: [spec.dx, spec.dy, 0.005],
      };
    });
    const galleryArtGeo = buildMergedGeometry(galleryArtParts);

    // 3. Wall Clock frame + 3 hand geometries (pivoted cleanly at [0,0,0])
    const clockR = placements.wallClock.radius;
    const clockFrameGeo = buildMergedGeometry([
      { geometry: new THREE.TorusGeometry(clockR, 0.015, 12, 36), position: [0, 0, 0.014] },
      { geometry: new THREE.CylinderGeometry(clockR + 0.012, clockR + 0.012, 0.014, 36), position: [0, 0, 0.007], rotation: [Math.PI / 2, 0, 0] },
      { geometry: new THREE.CylinderGeometry(0.012, 0.012, 0.018, 14), position: [0, 0, 0.02], rotation: [Math.PI / 2, 0, 0] },
    ]);
    const hourHandGeo = new THREE.BoxGeometry(0.014, clockR * 0.5, 0.004);
    hourHandGeo.translate(0, clockR * 0.2, 0);
    const minuteHandGeo = new THREE.BoxGeometry(0.01, clockR * 0.72, 0.004);
    minuteHandGeo.translate(0, clockR * 0.3, 0);
    const secondHandGeo = new THREE.BoxGeometry(0.005, clockR * 0.82, 0.003);
    secondHandGeo.translate(0, clockR * 0.32, 0);

    // 4. Acoustic Slat Panel back LED strip (top + bottom warm strips merged)
    const sp = placements.acousticSlatPanel;
    const slatLedGeo = buildMergedGeometry([
      { geometry: new THREE.BoxGeometry(sp.width - 0.04, 0.012, 0.014), position: [0, sp.height / 2 + 0.006, 0.011] },
      { geometry: new THREE.BoxGeometry(sp.width - 0.04, 0.012, 0.014), position: [0, -sp.height / 2 - 0.006, 0.011] },
    ]);

    // 5. 3 Low-Poly Potted Plants merged into 2 meshes (pots + soft green foliage)
    const potParts: ColoredGeometryPart[] = [];
    const leafParts: ColoredGeometryPart[] = [];
    addPlantToParts(potParts, leafParts, placements.plants.floorPlantPosition, 1.15, 13, '#d6d1c7');
    addPlantToParts(potParts, leafParts, placements.plants.shelfPlantPosition, 0.26, 8, '#363b45');
    addPlantToParts(potParts, leafParts, placements.plants.deskPlantWorldPosition, 0.23, 7, '#d6d1c7');
    const plantsPotsGeo = buildMergedColoredGeometry(potParts);
    const plantsLeavesGeo = buildMergedColoredGeometry(leafParts);

    // 6. Floor Lamp stand merged (base + vertical pole + top horizontal arm + drop stem to shade top)
    const lampStandGeo = buildMergedGeometry([
      { geometry: new THREE.CylinderGeometry(0.15, 0.16, 0.022, 22), position: [0, 0.011, 0] },
      { geometry: new THREE.CylinderGeometry(0.013, 0.016, 1.7, 12), position: [0, 0.86, 0] },
      { geometry: new THREE.CylinderGeometry(0.01, 0.01, 0.18, 10), position: [0, 1.71, 0.08], rotation: [Math.PI / 2, 0, 0] },
      { geometry: new THREE.CylinderGeometry(0.011, 0.011, 0.1, 10), position: [0, 1.66, 0.16] },
      { geometry: new THREE.CylinderGeometry(0.098, 0.098, 0.008, 20), position: [0, 1.62, 0.16] },
    ]);

    return {
      northWoodFramesGeo,
      galleryFrameUnitGeo,
      galleryArtGeo,
      clockFrameGeo,
      hourHandGeo,
      minuteHandGeo,
      secondHandGeo,
      slatLedGeo,
      plantsPotsGeo,
      plantsLeavesGeo,
      lampStandGeo,
    };
  }, [placements]);

  const materials = useMemo(() => {
    const windowGlass = new THREE.ShaderMaterial({
      uniforms: {
        uDayMap: { value: textures.daySky },
        uNightMap: { value: textures.nightCity },
        uMix: { value: THEMES_CONFIG.day.windowMix },
        uBrightness: { value: THEMES_CONFIG.day.windowBrightness },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uDayMap;
        uniform sampler2D uNightMap;
        uniform float uMix;
        uniform float uBrightness;
        varying vec2 vUv;
        void main() {
          vec4 sampled;
          if (uMix <= 0.001) {
            sampled = texture2D(uDayMap, vUv);
          } else if (uMix >= 0.999) {
            sampled = texture2D(uNightMap, vUv);
          } else {
            sampled = mix(texture2D(uDayMap, vUv), texture2D(uNightMap, vUv), uMix);
          }
          gl_FragColor = vec4(sampled.rgb * uBrightness, 1.0);
          #include <colorspace_fragment>
        }
      `,
      toneMapped: false,
    });

    return {
      oakWood: new THREE.MeshStandardMaterial({
        color: '#8c6745',
        roughness: 0.7,
        metalness: 0.05,
      }),
      nightCity: windowGlass,
      coolGlow: new THREE.MeshBasicMaterial({
        map: textures.coolGlow,
        color: THEMES_CONFIG.day.windowUnderGlowColor,
        transparent: true,
        opacity: THEMES_CONFIG.day.windowUnderGlowOpacity,
        depthWrite: false,
        toneMapped: false,
      }),
      worldMap: new THREE.MeshStandardMaterial({
        map: textures.worldMap,
        roughness: 0.45,
        metalness: 0.05,
      }),
      galleryFrame: new THREE.MeshStandardMaterial({
        color: '#ffffff',
        roughness: 0.58,
        metalness: 0.08,
      }),
      galleryArt: new THREE.MeshStandardMaterial({
        map: textures.galleryAtlas,
        roughness: 0.48,
        metalness: 0.04,
      }),
      neonSign: new THREE.MeshBasicMaterial({
        map: textures.neonSign,
        color: THEMES_CONFIG.day.neonColor,
        transparent: true,
        alphaTest: 0.1,
        toneMapped: false,
      }),
      clockFrame: new THREE.MeshStandardMaterial({
        color: '#14161c',
        roughness: 0.45,
        metalness: 0.35,
      }),
      clockFace: new THREE.MeshStandardMaterial({
        map: textures.clockFace,
        roughness: 0.5,
        metalness: 0.05,
      }),
      clockSecondHand: new THREE.MeshStandardMaterial({
        color: '#b3122a',
        roughness: 0.4,
      }),
      slatPanel: new THREE.MeshStandardMaterial({
        map: textures.walnutSlats,
        roughness: 0.82,
        metalness: 0.04,
      }),
      slatLed: new THREE.MeshBasicMaterial({
        color: THEMES_CONFIG.day.slatLedColor,
        toneMapped: false,
      }),
      plantsPots: new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.75,
        metalness: 0.04,
      }),
      plantsLeaves: new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.68,
        metalness: 0.02,
      }),
      lampStand: new THREE.MeshStandardMaterial({
        color: '#1e2028',
        roughness: 0.36,
        metalness: 0.8,
      }),
      lampShade: new THREE.MeshBasicMaterial({
        color: THEMES_CONFIG.day.floorLampEmissive,
        toneMapped: false,
        side: THREE.DoubleSide,
      }),
    };
  }, [textures]);

  const windowMeshRef = useRef<THREE.Mesh>(null);

  useThemed(
    null,
    {
      day: {},
      night: {},
      onUpdate: (t) => {
        const mat = windowMeshRef.current?.material as THREE.ShaderMaterial | undefined;
        const uniforms = mat?.uniforms;
        if (uniforms?.uMix) uniforms.uMix.value = THREE.MathUtils.lerp(THEMES_CONFIG.day.windowMix, THEMES_CONFIG.night.windowMix, t);
        if (uniforms?.uBrightness) uniforms.uBrightness.value = THREE.MathUtils.lerp(THEMES_CONFIG.day.windowBrightness, THEMES_CONFIG.night.windowBrightness, t);
      },
    },
    []
  );

  useThemed(
    materials.coolGlow,
    {
      day: {
        color: THEMES_CONFIG.day.windowUnderGlowColor,
        opacity: THEMES_CONFIG.day.windowUnderGlowOpacity,
      },
      night: {
        color: THEMES_CONFIG.night.windowUnderGlowColor,
        opacity: THEMES_CONFIG.night.windowUnderGlowOpacity,
      },
    },
    [materials.coolGlow]
  );

  useThemed(
    materials.neonSign,
    {
      day: { color: THEMES_CONFIG.day.neonColor, intensity: THEMES_CONFIG.day.neonIntensity },
      night: { color: THEMES_CONFIG.night.neonColor, intensity: THEMES_CONFIG.night.neonIntensity },
    },
    [materials.neonSign]
  );

  useThemed(
    materials.slatLed,
    {
      day: { color: THEMES_CONFIG.day.slatLedColor, intensity: THEMES_CONFIG.day.slatLedIntensity },
      night: { color: THEMES_CONFIG.night.slatLedColor, intensity: THEMES_CONFIG.night.slatLedIntensity },
    },
    [materials.slatLed]
  );

  useThemed(
    materials.lampShade,
    {
      day: {
        color: THEMES_CONFIG.day.floorLampEmissive,
        intensity: THEMES_CONFIG.day.floorLampIntensity,
      },
      night: {
        color: THEMES_CONFIG.night.floorLampEmissive,
        intensity: THEMES_CONFIG.night.floorLampIntensity,
      },
    },
    [materials.lampShade]
  );

  const updateClockHands = () => {
    const now = new Date();
    const sec = now.getSeconds();
    const min = now.getMinutes() + sec / 60;
    const hr = (now.getHours() % 12) + min / 60;
    if (secondHandRef.current) secondHandRef.current.rotation.z = -(sec / 60) * Math.PI * 2;
    if (minuteHandRef.current) minuteHandRef.current.rotation.z = -(min / 60) * Math.PI * 2;
    if (hourHandRef.current) hourHandRef.current.rotation.z = -(hr / 12) * Math.PI * 2;
  };

  useLayoutEffect(() => {
    if (galleryFramesInstRef.current) {
      const dummy = new THREE.Object3D();
      const col = new THREE.Color();
      GALLERY_FRAMES.forEach((spec, i) => {
        dummy.position.set(spec.dx, spec.dy, 0.011);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(spec.w, spec.h, 1);
        dummy.updateMatrix();
        galleryFramesInstRef.current!.setMatrixAt(i, dummy.matrix);
        col.set(spec.frameColor);
        galleryFramesInstRef.current!.setColorAt(i, col);
      });
      galleryFramesInstRef.current.instanceMatrix.needsUpdate = true;
      if (galleryFramesInstRef.current.instanceColor) {
        galleryFramesInstRef.current.instanceColor.needsUpdate = true;
      }
    }
    updateClockHands();
    freezeStaticMatrices(rootRef.current);
  }, []);

  useEffect(() => {
    return () => {
      Object.values(geometries).forEach((g) => g.dispose());
      Object.values(materials).forEach((m) => m.dispose());
      Object.values(textures).forEach((t) => t?.dispose());
    };
  }, [geometries, materials, textures]);

  // Update clock hands once per second (throttled useFrame, zero allocations, zero state)
  useFrame((_, delta) => {
    if (!showClock) return;
    const pc = usePcStore.getState();
    if (pc.pcMode && pc.pcArrived && !pc.pcExiting && pc.poweredPC && pc.bootState === 'desktop') {
      return;
    }
    clockTimerRef.current += Math.min(delta, 0.25);
    if (clockTimerRef.current >= 1.0) {
      clockTimerRef.current = 0;
      updateClockHands();
    }
  });

  const fw = placements.fakeWindow;
  const wm = placements.worldMapPoster;
  const sp = placements.acousticSlatPanel;
  const wc = placements.wallClock;

  return (
    <group ref={rootRef} name="wall-decor">
      {/* North Wall: Wooden Frame (Fake Window + World Map frame merged) */}
      {(showWindow || showWorldMap) && (
        <mesh geometry={geometries.northWoodFramesGeo} material={materials.oakWood} />
      )}

      {/* 4c. Fake Window Night City Glass + Subtle Cool Under-Glow */}
      {showWindow && (
        <group name="fake-window">
          <mesh
            ref={windowMeshRef}
            position={[fw.position[0], fw.position[1], fw.position[2] + 0.014]}
            material={materials.nightCity}
          >
            <planeGeometry args={[fw.width - 0.11, fw.height - 0.11]} />
          </mesh>
          <mesh
            position={[fw.position[0], fw.position[1] - fw.height / 2 - 0.13, fw.position[2] + 0.004]}
            material={materials.coolGlow}
          >
            <planeGeometry args={[fw.width - 0.04, 0.22]} />
          </mesh>
        </group>
      )}

      {/* 4h. World Map Poster with Pakistan Pin */}
      {showWorldMap && (
        <mesh
          position={[wm.position[0], wm.position[1], wm.position[2] + 0.01]}
          material={materials.worldMap}
        >
          <planeGeometry args={[wm.width - 0.048, wm.height - 0.048]} />
        </mesh>
      )}

      {/* 4d. Round Wall Clock (West Wall) */}
      {showClock && (
        <group name="wall-clock" position={wc.position} rotation={[0, wc.rotationY, 0]}>
          <mesh geometry={geometries.clockFrameGeo} material={materials.clockFrame} />
          <mesh position={[0, 0, 0.015]} material={materials.clockFace}>
            <circleGeometry args={[wc.radius - 0.012, 36]} />
          </mesh>
          <mesh
            ref={hourHandRef}
            position={[0, 0, 0.021]}
            geometry={geometries.hourHandGeo}
            material={materials.clockFrame}
            userData={{ dynamicTransform: true }}
          />
          <mesh
            ref={minuteHandRef}
            position={[0, 0, 0.025]}
            geometry={geometries.minuteHandGeo}
            material={materials.clockFrame}
            userData={{ dynamicTransform: true }}
          />
          <mesh
            ref={secondHandRef}
            position={[0, 0, 0.029]}
            geometry={geometries.secondHandGeo}
            material={materials.clockSecondHand}
            userData={{ dynamicTransform: true }}
          />
        </group>
      )}

      {/* 4e. Acoustic Wood Slat Panel Strip (East Wall) + Warm Emissive LED */}
      {showSlatPanel && (
        <group name="acoustic-slat-panel" position={sp.position} rotation={[0, sp.rotationY, 0]}>
          <mesh position={[0, 0, sp.depth / 2]} material={materials.slatPanel}>
            <boxGeometry args={[sp.width, sp.height, sp.depth]} />
          </mesh>
          <mesh geometry={geometries.slatLedGeo} material={materials.slatLed} />
        </group>
      )}

      {/* 4a. Gallery Wall (hidden in graphics low mode) */}
      <group
        name="gallery-wall"
        position={placements.galleryWall.position}
        rotation={[0, placements.galleryWall.rotationY, 0]}
        visible={showGallery}
      >
        <instancedMesh
          ref={galleryFramesInstRef}
          args={[geometries.galleryFrameUnitGeo, materials.galleryFrame, GALLERY_FRAMES.length]}
        />
        <mesh geometry={geometries.galleryArtGeo} material={materials.galleryArt} />
      </group>

      {/* 4b. Neon Sign "BUILD IT." (hidden in graphics low mode) */}
      <mesh
        name="neon-sign"
        position={placements.neonSign.position}
        rotation={[0, placements.neonSign.rotationY, 0]}
        material={materials.neonSign}
        visible={showNeon}
      >
        <planeGeometry args={[placements.neonSign.width, placements.neonSign.height]} />
      </mesh>

      {/* 4f. 3 Low-Poly Potted Plants merged (hidden in graphics low mode) */}
      <group name="potted-plants" visible={showPlants}>
        <mesh geometry={geometries.plantsPotsGeo} material={materials.plantsPots} />
        <mesh geometry={geometries.plantsLeavesGeo} material={materials.plantsLeaves} />
      </group>

      {/* 4g. Floor Lamp (hidden in graphics low mode) */}
      <group
        name="floor-lamp"
        position={placements.floorLamp.position}
        rotation={[0, placements.floorLamp.rotationY, 0]}
        visible={showFloorLamp}
      >
        <mesh geometry={geometries.lampStandGeo} material={materials.lampStand} />
        <mesh position={[0, 1.5, 0.16]} material={materials.lampShade}>
          <cylinderGeometry args={[0.1, 0.21, 0.24, 22, 1, true]} />
        </mesh>
      </group>
    </group>
  );
}
