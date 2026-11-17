'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import TVScreen from '@/components/TVScreen';
import MiniFridge from '@/components/MiniFridge';
import { MEDIA_WALL_CONFIG } from '@/config/roomConfig';
import { THEMES_CONFIG } from '@/config/themeConfig';
import { useThemeStore } from '@/stores/themeStore';
import { useTvStore } from '@/stores/tvStore';
import { freezeStaticMatrices } from '@/utils/mergeHelpers';
import { getThemedTvRgbBrightness } from '@/utils/themeRegistry';

/**
 * Generates procedural vertical warm walnut wood slats canvas texture for a clean, simple backdrop.
 */
function createWoodSlatsTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const slatW = 58;
  const gapW = 6;
  const period = slatW + gapW;
  const numSlats = canvas.width / period;

  ctx.fillStyle = '#241913';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < numSlats; i++) {
    const x = i * period;
    const grad = ctx.createLinearGradient(x, 0, x + slatW, 0);
    grad.addColorStop(0.0, '#624735');
    grad.addColorStop(0.35, '#7a5942');
    grad.addColorStop(0.75, '#8a664c');
    grad.addColorStop(1.0, '#543c2c');

    ctx.fillStyle = grad;
    ctx.fillRect(x, 0, slatW, canvas.height);

    ctx.fillStyle = 'rgba(30, 18, 12, 0.14)';
    for (let gx = x + 4; gx < x + slatW - 4; gx += 7) {
      ctx.fillRect(gx, 0, 1.5, canvas.height);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5.2, 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Generates transparent rounded-rect radial falloff texture calibrated to the larger TV frame.
 */
function createGlowFalloffTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const imgData = ctx.createImageData(256, 256);
  const data = imgData.data;

  const innerHalfW = (MEDIA_WALL_CONFIG.tvWidth / MEDIA_WALL_CONFIG.glowPlaneWidth) * 0.5 * 0.88;
  const innerHalfH = (MEDIA_WALL_CONFIG.tvHeight / MEDIA_WALL_CONFIG.glowPlaneHeight) * 0.5 * 0.88;
  const outerHalfW = 0.5;
  const outerHalfH = 0.5;

  for (let py = 0; py < 256; py++) {
    const v = py / 255;
    const dyRel = Math.abs(v - 0.5);
    const ny = Math.max(0, dyRel - innerHalfH) / (outerHalfH - innerHalfH);

    for (let px = 0; px < 256; px++) {
      const u = px / 255;
      const dxRel = Math.abs(u - 0.5);
      const nx = Math.max(0, dxRel - innerHalfW) / (outerHalfW - innerHalfW);

      const dist = Math.hypot(nx, ny);
      let alpha = 0;
      if (dist < 1.0) {
        alpha = 0.5 * (1 + Math.cos(dist * Math.PI));
      }

      const idx = (py * 256 + px) * 4;
      const aByte = Math.round(alpha * 255);
      data[idx] = aByte > 0 ? 255 : 0;
      data[idx + 1] = aByte > 0 ? 255 : 0;
      data[idx + 2] = aByte > 0 ? 255 : 0;
      data[idx + 3] = aByte;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

/**
 * MediaWall Component — Simple Minimalist Wood-Slat Backdrop, Larger TV,
 * Designer Credenza Table, Xbox Series X (left), PS5 (right), and Premium Controllers.
 */
export default function MediaWall() {
  const {
    panelWidth,
    panelHeight,
    panelDepth,
    panelLocalZ,
    panelRoughness,
    tvWidth,
    tvHeight,
    tvDepth,
    tvCenterY,
    tvLocalZ,
    consoleWidth,
    consoleThickness,
    consoleDepth,
    consoleTopY,
    consoleLocalZ,
    legHeight,
    speakerWidth,
    speakerHeight,
    speakerDepth,
    speakerLeftLocalX,
    speakerRightLocalX,
    speakerLocalZ,
    glowPlaneWidth,
    glowPlaneHeight,
    glowLocalZ,
    glowOpacity,
    rgbLightIntensity,
    rgbLightDistance,
    rgbLightDecay,
    rgbMode,
    rgbSpeed,
    rgbStaticColor,
  } = MEDIA_WALL_CONFIG;

  const rootRef = useRef<THREE.Group>(null);
  const rgbColor = useRef(new THREE.Color(1, 0, 0));
  const pointLightRef = useRef<THREE.PointLight>(null);
  const rgbStripMatRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const glowPlaneMatRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const rgbHueOverride = useRef<string | null>(null);

  const woodSlatsTexture = useMemo(() => createWoodSlatsTexture(), []);
  const glowFalloffTexture = useMemo(() => createGlowFalloffTexture(), []);

  const materials = useMemo(() => {
    return {
      backingPanel: new THREE.MeshStandardMaterial({
        map: woodSlatsTexture,
        roughness: panelRoughness,
        metalness: 0.04,
      }),
      tvFrame: new THREE.MeshStandardMaterial({
        color: '#0d0e12',
        roughness: 0.42,
        metalness: 0.35,
      }),
      // Designer Credenza Materials (Light Oak + Warm Taupe Fronts + Champagne Brass)
      credenzaOak: new THREE.MeshStandardMaterial({
        color: '#7a5c44',
        roughness: 0.62,
        metalness: 0.05,
      }),
      credenzaTaupe: new THREE.MeshStandardMaterial({
        color: '#cbc6bc',
        roughness: 0.55,
        metalness: 0.08,
      }),
      credenzaInterior: new THREE.MeshStandardMaterial({
        color: '#25262e',
        roughness: 0.72,
        metalness: 0.1,
      }),
      champagneMetal: new THREE.MeshStandardMaterial({
        color: '#a38f72',
        roughness: 0.3,
        metalness: 0.85,
      }),
      gunmetal: new THREE.MeshStandardMaterial({
        color: '#2b2e38',
        roughness: 0.35,
        metalness: 0.8,
      }),
      // Consoles & Controllers Materials
      obsidianMatte: new THREE.MeshStandardMaterial({
        color: '#131418',
        roughness: 0.52,
        metalness: 0.22,
      }),
      ps5White: new THREE.MeshStandardMaterial({
        color: '#eef0f4',
        roughness: 0.32,
        metalness: 0.08,
      }),
      ps5CoreBlack: new THREE.MeshStandardMaterial({
        color: '#090a0d',
        roughness: 0.18,
        metalness: 0.45,
      }),
      ps5BlueLed: new THREE.MeshBasicMaterial({
        color: '#38bdf8',
        toneMapped: false,
      }),
      xboxGreenLed: new THREE.MeshBasicMaterial({
        color: '#22c55e',
        toneMapped: false,
      }),
      whiteLed: new THREE.MeshBasicMaterial({
        color: '#f8fafc',
        toneMapped: false,
      }),
      // Button Accent Colors
      btnRed: new THREE.MeshBasicMaterial({ color: '#ef4444', toneMapped: false }),
      btnBlue: new THREE.MeshBasicMaterial({ color: '#3b82f6', toneMapped: false }),
      btnGreen: new THREE.MeshBasicMaterial({ color: '#22c55e', toneMapped: false }),
      btnYellow: new THREE.MeshBasicMaterial({ color: '#eab308', toneMapped: false }),
      warmShelfLed: new THREE.MeshBasicMaterial({
        color: '#ffe4c4',
        toneMapped: false,
      }),
      // Speakers
      speakerCabinet: new THREE.MeshStandardMaterial({
        color: '#22242c',
        roughness: 0.55,
        metalness: 0.15,
      }),
      speakerGrille: new THREE.MeshStandardMaterial({
        color: '#2b2e38',
        roughness: 0.85,
      }),
      speakerWoofer: new THREE.MeshStandardMaterial({
        color: '#191b22',
        roughness: 0.45,
        metalness: 0.35,
      }),
      speakerTweeter: new THREE.MeshStandardMaterial({
        color: '#464a58',
        roughness: 0.25,
        metalness: 0.65,
      }),
      rgbStrip: new THREE.MeshBasicMaterial({
        color: '#ff0000',
        toneMapped: false,
      }),
      glowPlane: glowFalloffTexture
        ? new THREE.MeshBasicMaterial({
            map: glowFalloffTexture,
            color: '#ff0000',
            transparent: true,
            opacity: glowOpacity,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
          })
        : null,
    };
  }, [woodSlatsTexture, glowFalloffTexture, panelRoughness, glowOpacity]);

  useLayoutEffect(() => {
    rgbStripMatRef.current = materials.rgbStrip;
    glowPlaneMatRef.current = materials.glowPlane;
    freezeStaticMatrices(rootRef.current);
  }, [materials]);

  // Animate RGB bias lighting in ONE useFrame (Zero setState, Zero allocations)
  useFrame((state) => {
    const tvState = useTvStore.getState();

    if (tvState.powered && tvState.source === 'nightcast') {
      rgbHueOverride.current = '#b3122a';
    } else {
      rgbHueOverride.current = null;
    }

    const activeMode = THEMES_CONFIG[useThemeStore.getState().theme].tvRgbMode || rgbMode;
    if (activeMode === 'off') {
      if (pointLightRef.current) pointLightRef.current.intensity = 0;
      if (rgbStripMatRef.current) rgbStripMatRef.current.color.set('#000000');
      if (glowPlaneMatRef.current) glowPlaneMatRef.current.opacity = 0;
      return;
    }

    if (rgbHueOverride.current) {
      rgbColor.current.set(rgbHueOverride.current);
    } else if (activeMode === 'rainbow') {
      const time = state.clock.elapsedTime;
      const hue = (time * rgbSpeed) % 1;
      rgbColor.current.setHSL(hue, 0.9, 0.52);
    } else {
      rgbColor.current.set(rgbStaticColor);
    }

    const rgbBright = getThemedTvRgbBrightness();
    if (rgbStripMatRef.current) {
      rgbStripMatRef.current.color.copy(rgbColor.current).multiplyScalar(rgbBright);
    }
    if (glowPlaneMatRef.current) {
      glowPlaneMatRef.current.color.copy(rgbColor.current);
      glowPlaneMatRef.current.opacity = Math.min(0.5, glowOpacity * rgbBright);
    }
    if (pointLightRef.current) {
      pointLightRef.current.color.copy(rgbColor.current);
      pointLightRef.current.intensity = rgbLightIntensity * rgbBright;
    }
  });

  const stripW = tvWidth - 0.1;
  const stripH = tvHeight - 0.1;
  const stripThick = 0.022;
  const stripZ = 0.072;
  const cabinetCenterY = legHeight + consoleThickness / 2;

  return (
    <group
      ref={rootRef}
      position={MEDIA_WALL_CONFIG.groupPosition}
      rotation={[0, MEDIA_WALL_CONFIG.groupRotationY, 0]}
    >
      {/* 1. SIMPLE CLEAN SLATTED WOOD BACKDROP WALL */}
      <mesh position={[0, panelHeight / 2, panelLocalZ]} material={materials.backingPanel}>
        <boxGeometry args={[panelWidth, panelHeight, panelDepth]} />
      </mesh>

      {/* 2. Soft Wall Glow Plane behind Larger TV */}
      {materials.glowPlane && (
        <mesh position={[0, tvCenterY, glowLocalZ]} material={materials.glowPlane}>
          <planeGeometry args={[glowPlaneWidth, glowPlaneHeight]} />
        </mesh>
      )}

      {/* 3. TV Bias RGB Backlight Strips */}
      <group name="tv-rgb-strips">
        <mesh position={[0, tvCenterY + stripH / 2, stripZ]} material={materials.rgbStrip}>
          <boxGeometry args={[stripW, stripThick, stripThick]} />
        </mesh>
        <mesh position={[0, tvCenterY - stripH / 2, stripZ]} material={materials.rgbStrip}>
          <boxGeometry args={[stripW, stripThick, stripThick]} />
        </mesh>
        <mesh position={[-stripW / 2, tvCenterY, stripZ]} material={materials.rgbStrip}>
          <boxGeometry args={[stripThick, stripH, stripThick]} />
        </mesh>
        <mesh position={[stripW / 2, tvCenterY, stripZ]} material={materials.rgbStrip}>
          <boxGeometry args={[stripThick, stripH, stripThick]} />
        </mesh>
      </group>

      {/* 4. Bias PointLight */}
      <pointLight
        ref={pointLightRef}
        position={[0, tvCenterY, 0.35]}
        intensity={rgbLightIntensity}
        distance={rgbLightDistance}
        decay={rgbLightDecay}
        castShadow={false}
      />

      {/* 5. LARGER ~105" TV FRAME & INTERACTIVE SCREEN */}
      <group name="tv-unit">
        <mesh position={[0, tvCenterY, tvLocalZ]} material={materials.tvFrame}>
          <boxGeometry args={[tvWidth, tvHeight, tvDepth]} />
        </mesh>
        <TVScreen />
      </group>

      {/* 6. DESIGNER LIGHT-OAK & TAUPE MEDIA CREDENZA TABLE */}
      <group name="media-console">
        {/* 4 Slim Champagne Metal Legs raising the credenza off the floor */}
        {[
          [-consoleWidth / 2 + 0.14, legHeight / 2, consoleLocalZ - consoleDepth / 2 + 0.08],
          [consoleWidth / 2 - 0.14, legHeight / 2, consoleLocalZ - consoleDepth / 2 + 0.08],
          [-consoleWidth / 2 + 0.14, legHeight / 2, consoleLocalZ + consoleDepth / 2 - 0.08],
          [consoleWidth / 2 - 0.14, legHeight / 2, consoleLocalZ + consoleDepth / 2 - 0.08],
          [0, legHeight / 2, consoleLocalZ + consoleDepth / 2 - 0.08],
        ].map(([lx, ly, lz], idx) => (
          <mesh key={idx} position={[lx, ly, lz]} material={materials.champagneMetal}>
            <cylinderGeometry args={[0.016, 0.012, legHeight, 12]} />
          </mesh>
        ))}

        {/* Warm Oak Outer Credenza Carcass */}
        <RoundedBox
          args={[consoleWidth, consoleThickness, consoleDepth]}
          radius={0.015}
          smoothness={2}
          position={[0, cabinetCenterY, consoleLocalZ]}
          material={materials.credenzaOak}
        />

        {/* Top Champagne Trim Accent Lip */}
        <mesh position={[0, consoleTopY - 0.008, consoleLocalZ + consoleDepth / 2 + 0.001]} material={materials.champagneMetal}>
          <boxGeometry args={[consoleWidth - 0.04, 0.008, 0.006]} />
        </mesh>

        {/* Left & Right Light-Taupe Textured Drawers with Brushed Champagne Pulls */}
        {[-0.98, 0.98].map((dx, idx) => (
          <group key={idx} position={[dx, cabinetCenterY, consoleLocalZ + consoleDepth / 2 + 0.006]}>
            <RoundedBox args={[0.92, consoleThickness - 0.05, 0.02]} radius={0.006} smoothness={2} material={materials.credenzaTaupe} />
            <mesh position={[0, 0.09, 0.015]} material={materials.champagneMetal}>
              <boxGeometry args={[0.22, 0.012, 0.014]} />
            </mesh>
          </group>
        ))}

        {/* Center Recessed Open Media Shelf Bay + Warm Under-Lit LED Strip */}
        <group position={[0, cabinetCenterY, consoleLocalZ + consoleDepth / 2 - 0.02]}>
          <mesh position={[0, 0, -0.01]} material={materials.credenzaInterior}>
            <boxGeometry args={[0.92, consoleThickness - 0.07, 0.06]} />
          </mesh>
          <mesh position={[0, 0, 0.01]} material={materials.credenzaOak}>
            <boxGeometry args={[0.92, 0.02, 0.08]} />
          </mesh>
          <mesh position={[0, consoleThickness / 2 - 0.042, 0.015]} material={materials.warmShelfLed}>
            <boxGeometry args={[0.84, 0.007, 0.008]} />
          </mesh>
        </group>

        {/* Sleek Centered Soundbar */}
        <group position={[0, consoleTopY + 0.04, consoleLocalZ + 0.07]}>
          <RoundedBox args={[1.36, 0.072, 0.11]} radius={0.02} smoothness={2} material={materials.obsidianMatte} />
          <mesh position={[0, 0, 0.056]} material={materials.gunmetal}>
            <boxGeometry args={[1.28, 0.042, 0.004]} />
          </mesh>
          <mesh position={[0, 0.024, 0.059]} material={materials.whiteLed}>
            <boxGeometry args={[0.06, 0.004, 0.003]} />
          </mesh>
        </group>

        {/* === LEFT SIDE OF TABLE: XBOX SERIES X + PREMIUM XBOX CONTROLLER === */}
        <group name="xbox-setup" position={[-1.10, consoleTopY, consoleLocalZ]}>
          {/* Xbox Series X Monolith Tower */}
          <group position={[0, 0.15, 0]} rotation={[0, 0.18, 0]}>
            <mesh position={[0, -0.145, 0]} material={materials.gunmetal}>
              <cylinderGeometry args={[0.07, 0.075, 0.01, 20]} />
            </mesh>
            <RoundedBox args={[0.15, 0.30, 0.15]} radius={0.006} smoothness={2} material={materials.obsidianMatte} />
            {/* Iconic Green Top Vent Accent Ring */}
            <mesh position={[0, 0.151, 0]} rotation={[-Math.PI / 2, 0, 0]} material={materials.xboxGreenLed}>
              <ringGeometry args={[0.042, 0.058, 24]} />
            </mesh>
            <mesh position={[0, 0.1505, 0]} rotation={[-Math.PI / 2, 0, 0]} material={materials.ps5CoreBlack}>
              <circleGeometry args={[0.042, 24]} />
            </mesh>
            {/* Front Power LED + Disc Slot */}
            <mesh position={[-0.045, 0.115, 0.076]} material={materials.whiteLed}>
              <circleGeometry args={[0.007, 12]} />
            </mesh>
            <mesh position={[0.052, -0.05, 0.076]} material={materials.ps5CoreBlack}>
              <boxGeometry args={[0.005, 0.11, 0.002]} />
            </mesh>
          </group>

          {/* Premium Xbox Controller on Brushed Cradle */}
          <group position={[0.20, 0, 0.05]} rotation={[0, 0.25, 0]}>
            {/* Flat Charging Cradle Base seated flush on console top */}
            <RoundedBox args={[0.11, 0.018, 0.08]} radius={0.005} smoothness={2} position={[0, 0.009, 0]} material={materials.gunmetal} />
            {/* Angled Controller resting cleanly above the base */}
            <group position={[0, 0.036, 0]} rotation={[-0.38, 0, 0]}>
              {/* Controller Main Shell + Angled Ergonomic Grips */}
              <RoundedBox args={[0.145, 0.032, 0.082]} radius={0.012} smoothness={2} material={materials.obsidianMatte} />
              <RoundedBox args={[0.042, 0.03, 0.078]} radius={0.012} smoothness={2} position={[-0.058, -0.008, 0.032]} rotation={[0.15, 0.25, 0]} material={materials.obsidianMatte} />
              <RoundedBox args={[0.042, 0.03, 0.078]} radius={0.012} smoothness={2} position={[0.058, -0.008, 0.032]} rotation={[0.15, -0.25, 0]} material={materials.obsidianMatte} />
              {/* Metallic Bumpers */}
              <mesh position={[0, 0.006, -0.042]} material={materials.gunmetal}>
                <boxGeometry args={[0.12, 0.014, 0.008]} />
              </mesh>
              {/* Glowing Xbox Home Button */}
              <mesh position={[0, 0.017, -0.018]} rotation={[-Math.PI / 2, 0, 0]} material={materials.whiteLed}>
                <circleGeometry args={[0.008, 12]} />
              </mesh>
              {/* Asymmetrical Sticks + Faceted D-Pad + Colored ABXY */}
              <mesh position={[-0.038, 0.02, -0.01]} material={materials.gunmetal}>
                <cylinderGeometry args={[0.011, 0.011, 0.01, 12]} />
              </mesh>
              <mesh position={[0.024, 0.02, 0.014]} material={materials.gunmetal}>
                <cylinderGeometry args={[0.011, 0.011, 0.01, 12]} />
              </mesh>
              <mesh position={[-0.022, 0.018, 0.014]} material={materials.champagneMetal}>
                <cylinderGeometry args={[0.011, 0.011, 0.005, 8]} />
              </mesh>
              <mesh position={[0.042, 0.017, -0.02]} material={materials.btnYellow}><sphereGeometry args={[0.0038, 8, 8]} /></mesh>
              <mesh position={[0.05, 0.017, -0.012]} material={materials.btnRed}><sphereGeometry args={[0.0038, 8, 8]} /></mesh>
              <mesh position={[0.042, 0.017, -0.004]} material={materials.btnGreen}><sphereGeometry args={[0.0038, 8, 8]} /></mesh>
              <mesh position={[0.034, 0.017, -0.012]} material={materials.btnBlue}><sphereGeometry args={[0.0038, 8, 8]} /></mesh>
            </group>
          </group>
        </group>

        {/* === RIGHT SIDE OF TABLE: PS5 + PREMIUM DUALSENSE CONTROLLER === */}
        <group name="ps5-setup" position={[1.10, consoleTopY, consoleLocalZ]}>
          {/* PlayStation 5 Console */}
          <group position={[0, 0.185, 0]} rotation={[0, -0.22, 0]}>
            {/* Circular Matte Base Stand */}
            <mesh position={[0, -0.178, 0]} material={materials.obsidianMatte}>
              <cylinderGeometry args={[0.095, 0.105, 0.014, 24]} />
            </mesh>
            {/* Glossy Jet-Black Core */}
            <RoundedBox args={[0.054, 0.34, 0.22]} radius={0.012} smoothness={2} material={materials.ps5CoreBlack} />
            {/* Iconic Sweeping Pearl-White Side Plates */}
            <RoundedBox
              args={[0.014, 0.365, 0.245]}
              radius={0.006}
              smoothness={2}
              position={[-0.035, 0.008, 0]}
              rotation={[0, 0, 0.05]}
              material={materials.ps5White}
            />
            <RoundedBox
              args={[0.014, 0.365, 0.245]}
              radius={0.006}
              smoothness={2}
              position={[0.035, 0.008, 0]}
              rotation={[0, 0, -0.05]}
              material={materials.ps5White}
            />
            {/* Signature Blue LED Status Strips inside the V-Grooves */}
            <mesh position={[-0.025, 0.06, 0.112]} material={materials.ps5BlueLed}>
              <boxGeometry args={[0.004, 0.21, 0.005]} />
            </mesh>
            <mesh position={[0.025, 0.06, 0.112]} material={materials.ps5BlueLed}>
              <boxGeometry args={[0.004, 0.21, 0.005]} />
            </mesh>
          </group>

          {/* Premium PS5 DualSense Controller on Glowing Charging Dock */}
          <group position={[-0.20, 0, 0.05]} rotation={[0, -0.25, 0]}>
            {/* White Charging Station Base seated flush on console top */}
            <RoundedBox args={[0.12, 0.018, 0.085]} radius={0.005} smoothness={2} position={[0, 0.009, 0]} material={materials.ps5White} />
            <mesh position={[0, 0.011, 0.043]} material={materials.ps5BlueLed}>
              <boxGeometry args={[0.09, 0.004, 0.003]} />
            </mesh>
            {/* Angled Two-Tone DualSense Sculpted Body resting cleanly above dock */}
            <group position={[0, 0.036, 0]} rotation={[-0.38, 0, 0]}>
              <RoundedBox args={[0.15, 0.031, 0.084]} radius={0.013} smoothness={2} material={materials.ps5White} />
              <RoundedBox args={[0.04, 0.029, 0.08]} radius={0.012} smoothness={2} position={[-0.06, -0.008, 0.034]} rotation={[0.14, 0.26, 0]} material={materials.ps5White} />
              <RoundedBox args={[0.04, 0.029, 0.08]} radius={0.012} smoothness={2} position={[0.06, -0.008, 0.034]} rotation={[0.14, -0.26, 0]} material={materials.ps5White} />
              {/* Matte Black Lower Grip Trim + Touchpad */}
              <RoundedBox args={[0.09, 0.028, 0.042]} radius={0.008} smoothness={2} position={[0, -0.002, 0.018]} material={materials.ps5CoreBlack} />
              <RoundedBox args={[0.052, 0.006, 0.034]} radius={0.002} smoothness={2} position={[0, 0.015, -0.016]} material={materials.obsidianMatte} />
              {/* Signature DualSense Glowing Blue Lightbar Flanking Touchpad */}
              <mesh position={[-0.028, 0.016, -0.016]} rotation={[0, 0.18, 0]} material={materials.ps5BlueLed}>
                <boxGeometry args={[0.003, 0.004, 0.032]} />
              </mesh>
              <mesh position={[0.028, 0.016, -0.016]} rotation={[0, -0.18, 0]} material={materials.ps5BlueLed}>
                <boxGeometry args={[0.003, 0.004, 0.032]} />
              </mesh>
              {/* Symmetrical Black Thumbsticks */}
              <mesh position={[-0.022, 0.019, 0.012]} material={materials.ps5CoreBlack}>
                <cylinderGeometry args={[0.011, 0.011, 0.01, 12]} />
              </mesh>
              <mesh position={[0.022, 0.019, 0.012]} material={materials.ps5CoreBlack}>
                <cylinderGeometry args={[0.011, 0.011, 0.01, 12]} />
              </mesh>
            </group>
          </group>
        </group>
      </group>

      {/* 7. Floor-Standing Hi-Fi Tower Speakers */}
      <group name="tower-speakers">
        {[speakerLeftLocalX, speakerRightLocalX].map((sx, idx) => (
          <group key={idx} position={[sx, 0, speakerLocalZ]}>
            <RoundedBox
              args={[speakerWidth + 0.05, 0.04, speakerDepth + 0.05]}
              radius={0.008}
              smoothness={2}
              position={[0, 0.02, 0]}
              material={materials.gunmetal}
            />
            <RoundedBox
              args={[speakerWidth, speakerHeight - 0.04, speakerDepth]}
              radius={0.016}
              smoothness={2}
              position={[0, 0.04 + (speakerHeight - 0.04) / 2, 0]}
              material={materials.speakerCabinet}
            />
            <mesh position={[0, speakerHeight / 2 + 0.02, speakerDepth / 2 + 0.001]} material={materials.speakerGrille}>
              <planeGeometry args={[speakerWidth - 0.04, speakerHeight - 0.1]} />
            </mesh>
            {[0.32, 0.56].map((wy, wi) => (
              <group key={wi} position={[0, wy, speakerDepth / 2 + 0.003]}>
                <mesh material={materials.champagneMetal}>
                  <ringGeometry args={[0.088, 0.096, 28]} />
                </mesh>
                <mesh position={[0, 0, 0.001]} material={materials.speakerWoofer}>
                  <circleGeometry args={[0.088, 28]} />
                </mesh>
              </group>
            ))}
            <mesh position={[0, 0.78, speakerDepth / 2 + 0.003]} material={materials.speakerWoofer}>
              <circleGeometry args={[0.055, 24]} />
            </mesh>
            <mesh position={[0, 0.94, speakerDepth / 2 + 0.003]} material={materials.speakerTweeter}>
              <circleGeometry args={[0.028, 24]} />
            </mesh>
          </group>
        ))}
      </group>

      {/* 8. Gaming Mini-Fridge tucked in the Left Corner of the Media Wall side */}
      <MiniFridge position={[-4.56, 0, 0.42]} rotation={[0, 0.35, 0]} />
    </group>
  );
}
