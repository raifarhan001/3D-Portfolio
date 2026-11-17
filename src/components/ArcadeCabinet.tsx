'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { ARCADE_CONFIG, SNAKE_CONFIG } from '@/config/themeConfig';
import {
  createInitialSnakeState,
  queueSnakeDirection,
  startSnakeGame,
  stepSnake,
  type SnakeDirection,
  type SnakeState,
} from '@/games/snake';
import { useArcadeStore } from '@/stores/arcadeStore';
import { useInputStore } from '@/stores/inputStore';
import { usePortfolioStore } from '@/stores/portfolioStore';
import { usePcStore } from '@/stores/pcStore';
import {
  buildMergedColoredGeometry,
  freezeStaticMatrices,
  type ColoredGeometryPart,
} from '@/utils/mergeHelpers';
import {
  playSnakeEatSound,
  playSnakeGameOverSound,
  playSnakeStartSound,
} from '@/utils/sound';
import {
  createArcadeMarqueeTexture,
  drawSnakeAttractScreen,
  drawSnakeGameScreen,
} from '@/utils/step5Textures';

const SCREEN_TILT_RAD = THREE.MathUtils.degToRad(12.5);
// Local screen pose: centered at x=0, y=1.255, z=0.078, tilted back 12.5deg around X
const SCREEN_LOCAL_CENTER = new THREE.Vector3(0, 1.255, 0.078);
const _arcadeWorldPos = new THREE.Vector3(...ARCADE_CONFIG.position);
const _camDir = new THREE.Vector3();
const _toCabinet = new THREE.Vector3();
const _btnDummy = new THREE.Object3D();
const _btnCol = new THREE.Color();

export function getArcadeWorldPose(): {
  cameraPos: THREE.Vector3;
  target: THREE.Vector3;
} {
  const ry = ARCADE_CONFIG.rotationY;
  const sinR = Math.sin(ry);
  const cosR = Math.cos(ry);

  const toWorld = (v: THREE.Vector3): THREE.Vector3 =>
    new THREE.Vector3(
      ARCADE_CONFIG.position[0] + v.x * cosR + v.z * sinR,
      ARCADE_CONFIG.position[1] + v.y,
      ARCADE_CONFIG.position[2] - v.x * sinR + v.z * cosR
    );

  // Screen plane normal tilts upward by 12deg toward +Z local
  const dist = ARCADE_CONFIG.camDistance;
  const camLocal = new THREE.Vector3(
    SCREEN_LOCAL_CENTER.x,
    SCREEN_LOCAL_CENTER.y + Math.sin(SCREEN_TILT_RAD) * dist,
    SCREEN_LOCAL_CENTER.z + Math.cos(SCREEN_TILT_RAD) * dist
  );

  return {
    cameraPos: toWorld(camLocal),
    target: toWorld(SCREEN_LOCAL_CENTER),
  };
}

/**
 * ArcadeCabinet — Upright extruded arcade cabinet with lit marquee, 12deg tilted 256x224 pixel
 * CRT Snake screen, responsive tilting joystick, 2 flashing action buttons, and coin door.
 * Strictly <= 7 draw calls total (<= 8 limit).
 */
export default function ArcadeCabinet() {
  const { camera } = useThree();
  const quality = usePortfolioStore((s) => s.graphicsQuality);

  const rootRef = useRef<THREE.Group>(null);
  const joystickRef = useRef<THREE.Group>(null);
  const buttonsInstRef = useRef<THREE.InstancedMesh>(null);
  const screenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const screenCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const screenTexRef = useRef<THREE.CanvasTexture | null>(null);

  const snakeRef = useRef<SnakeState>(createInitialSnakeState({ status: 'idle' }));
  const tickAccumRef = useRef(0);
  const attractTimerRef = useRef(0.5);
  const visCheckTimerRef = useRef(0.25);
  const attractVisibleRef = useRef(true);
  const blinkPhaseRef = useRef(0);
  const joyTiltRef = useRef<{ x: number; z: number }>({ x: 0, z: 0 });
  const btnFlashTimerRef = useRef<[number, number]>([0, 0]);
  const lastWasFocusRef = useRef(false);

  const marqueeTex = useMemo(() => createArcadeMarqueeTexture(), []);

  const { screenCanvas, screenCtx, screenTex } = useMemo(() => {
    if (typeof document === 'undefined') {
      return { screenCanvas: null, screenCtx: null, screenTex: null };
    }
    const c = document.createElement('canvas');
    c.width = SNAKE_CONFIG.canvasWidth;
    c.height = SNAKE_CONFIG.canvasHeight;
    const ctx = c.getContext('2d');
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    if (ctx) {
      drawSnakeAttractScreen(ctx, c.width, c.height, true, 0);
      tex.needsUpdate = true;
    }
    return { screenCanvas: c, screenCtx: ctx, screenTex: tex };
  }, []);

  const {
    bodyAndMetalGeo,
    controlPanelGeo,
    emissiveTrimGeo,
    marqueeGeo,
    screenGeo,
    joystickGeo,
    buttonGeo,
    materials,
  } = useMemo(() => {
    const { bodyWidth, arcadeColors } = ARCADE_CONFIG;
    const centerShiftZ = -0.425;

    // 1. Classic upright side silhouette shape extruded 0.68m wide
    const cabinetShape = new THREE.Shape();
    cabinetShape.moveTo(0, 0);
    cabinetShape.lineTo(0, 1.8);
    cabinetShape.lineTo(0.56, 1.8);
    cabinetShape.lineTo(0.61, 1.56);
    cabinetShape.lineTo(0.42, 1.48);
    cabinetShape.lineTo(0.52, 1.03);
    cabinetShape.lineTo(0.81, 0.955);
    cabinetShape.lineTo(0.81, 0.87);
    cabinetShape.lineTo(0.57, 0.84);
    cabinetShape.lineTo(0.57, 0);
    cabinetShape.closePath();

    const bodyRaw = new THREE.ExtrudeGeometry(cabinetShape, {
      depth: bodyWidth,
      bevelEnabled: true,
      bevelThickness: 0.014,
      bevelSize: 0.012,
      bevelSegments: 1,
      curveSegments: 1,
    });
    // Rotate so +X silhouette -> +Z front, extrude depth -> centered X [-0.34..+0.34]
    bodyRaw.rotateY(-Math.PI / 2);
    bodyRaw.translate(bodyWidth / 2, 0, centerShiftZ);

    // Side glowing profile stripe silhouette
    const stripeShape = new THREE.Shape();
    stripeShape.moveTo(0.03, 0.05);
    stripeShape.lineTo(0.03, 1.77);
    stripeShape.lineTo(0.54, 1.77);
    stripeShape.lineTo(0.585, 1.57);
    stripeShape.lineTo(0.555, 1.57);
    stripeShape.lineTo(0.52, 1.74);
    stripeShape.lineTo(0.06, 1.74);
    stripeShape.lineTo(0.06, 0.05);
    stripeShape.closePath();

    const leftStripe = new THREE.ExtrudeGeometry(stripeShape, { depth: 0.008, bevelEnabled: false });
    leftStripe.rotateY(-Math.PI / 2);
    leftStripe.translate(-bodyWidth / 2 - 0.013, 0, centerShiftZ);

    const rightStripe = new THREE.ExtrudeGeometry(stripeShape, { depth: 0.008, bevelEnabled: false });
    rightStripe.rotateY(-Math.PI / 2);
    rightStripe.translate(bodyWidth / 2 + 0.021, 0, centerShiftZ);

    // 4-piece recessed bezel inner shadow frame surrounding the 0.52 x 0.40 screen at z=0.088
    const rimThick = 0.032;
    const rimDepth = 0.028;
    const scrW = 0.52;
    const scrH = 0.4;
    const staticBodyParts: ColoredGeometryPart[] = [
      { geometry: bodyRaw, color: arcadeColors.body },
      // Dark screen recessed bezel backing plate
      {
        geometry: new THREE.BoxGeometry(scrW + rimThick * 2, scrH + rimThick * 2, 0.024),
        position: [0, 1.255, 0.06],
        rotation: [-SCREEN_TILT_RAD, 0, 0],
        color: arcadeColors.bezel,
      },
      // Inner shadow perimeter rims proudly framing the CRT screen
      {
        geometry: new THREE.BoxGeometry(scrW + rimThick * 2, rimThick, rimDepth),
        position: [0, 1.255 + (scrH + rimThick) / 2, 0.075],
        rotation: [-SCREEN_TILT_RAD, 0, 0],
        color: '#06070a',
      },
      {
        geometry: new THREE.BoxGeometry(scrW + rimThick * 2, rimThick, rimDepth),
        position: [0, 1.255 - (scrH + rimThick) / 2, 0.075],
        rotation: [-SCREEN_TILT_RAD, 0, 0],
        color: '#06070a',
      },
      {
        geometry: new THREE.BoxGeometry(rimThick, scrH, rimDepth),
        position: [-(scrW + rimThick) / 2, 1.255, 0.075],
        rotation: [-SCREEN_TILT_RAD, 0, 0],
        color: '#06070a',
      },
      {
        geometry: new THREE.BoxGeometry(rimThick, scrH, rimDepth),
        position: [(scrW + rimThick) / 2, 1.255, 0.075],
        rotation: [-SCREEN_TILT_RAD, 0, 0],
        color: '#06070a',
      },
      // Top marquee dark trim backing
      {
        geometry: new THREE.BoxGeometry(0.66, 0.215, 0.022),
        position: [0, 1.68, 0.168],
        rotation: [0.205, 0, 0],
        color: arcadeColors.bezel,
      },
      // Lower metallic coin door + recessed face + kick plate proud of z=+0.157 body front
      {
        geometry: new THREE.BoxGeometry(0.35, 0.39, 0.016),
        position: [0, 0.44, 0.162],
        color: arcadeColors.metal,
      },
      {
        geometry: new THREE.BoxGeometry(0.31, 0.35, 0.018),
        position: [0, 0.44, 0.168],
        color: '#20242c',
      },
      // Small lower chrome kick plate at cabinet base
      {
        geometry: new THREE.BoxGeometry(0.64, 0.09, 0.018),
        position: [0, 0.055, 0.164],
        color: arcadeColors.metal,
      },
      // Speaker grille bar under marquee overhang
      {
        geometry: new THREE.BoxGeometry(0.48, 0.036, 0.018),
        position: [0, 1.52, 0.115],
        color: '#1b1d24',
      },
    ];

    const cPanelGeo = new RoundedBoxGeometry(0.66, 0.042, 0.29, 2, 0.008);

    const emissiveParts: ColoredGeometryPart[] = [
      { geometry: leftStripe, color: arcadeColors.sideStripe },
      { geometry: rightStripe, color: arcadeColors.sideStripe },
      // Glowing coin insert slots proudly in front of z=+0.177 coin door face
      {
        geometry: new THREE.BoxGeometry(0.035, 0.055, 0.01),
        position: [-0.07, 0.5, 0.18],
        color: arcadeColors.coinSlot,
      },
      {
        geometry: new THREE.BoxGeometry(0.035, 0.055, 0.01),
        position: [0.07, 0.5, 0.18],
        color: arcadeColors.coinSlot,
      },
    ];

    // Joystick stick + top red ball (pivot at base [0,0,0])
    const stickParts: ColoredGeometryPart[] = [
      { geometry: new THREE.CylinderGeometry(0.008, 0.008, 0.065, 10), position: [0, 0.032, 0], color: '#cbd5e1' },
      { geometry: new THREE.SphereGeometry(0.021, 14, 12), position: [0, 0.07, 0], color: arcadeColors.joystickBall },
    ];

    return {
      bodyAndMetalGeo: buildMergedColoredGeometry(staticBodyParts),
      controlPanelGeo: cPanelGeo,
      emissiveTrimGeo: buildMergedColoredGeometry(emissiveParts),
      marqueeGeo: new THREE.PlaneGeometry(0.62, 0.19),
      screenGeo: new THREE.PlaneGeometry(0.52, 0.4),
      joystickGeo: buildMergedColoredGeometry(stickParts),
      buttonGeo: new THREE.CylinderGeometry(0.02, 0.022, 0.018, 16),
      materials: {
        bodyMat: new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.62,
          metalness: 0.25,
        }),
        panelMat: new THREE.MeshStandardMaterial({
          color: arcadeColors.controlPanel,
          roughness: 0.46,
          metalness: 0.18,
        }),
        emissiveTrimMat: new THREE.MeshBasicMaterial({
          vertexColors: true,
          toneMapped: false,
        }),
        marqueeMat: new THREE.MeshBasicMaterial({
          map: marqueeTex,
          color: '#ffffff',
          toneMapped: false,
        }),
        screenMat: new THREE.MeshBasicMaterial({
          map: screenTex,
          toneMapped: false,
        }),
        joystickMat: new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.3,
          metalness: 0.35,
        }),
        buttonsMat: new THREE.MeshBasicMaterial({
          color: '#ffffff',
          toneMapped: false,
        }),
      },
    };
  }, [marqueeTex, screenTex]);

  // Register interactive Snake handlers + localStorage high score hydration
  useEffect(() => {
    useArcadeStore.getState().hydrate();
    const savedHi = useArcadeStore.getState().highScore;
    if (savedHi > snakeRef.current.highScore) {
      snakeRef.current.highScore = savedHi;
    }

    const redraw = () => {
      const ctx = screenCtxRef.current;
      const canvas = screenCanvasRef.current;
      const tex = screenTexRef.current;
      if (!ctx || !canvas || !tex) return;
      drawSnakeGameScreen(ctx, canvas.width, canvas.height, snakeRef.current, true);
      tex.needsUpdate = true;
    };

    const startOrRestart = () => {
      snakeRef.current = startSnakeGame(snakeRef.current);
      tickAccumRef.current = 0;
      btnFlashTimerRef.current[0] = 0.16;
      btnFlashTimerRef.current[1] = 0.16;
      playSnakeStartSound();
      useArcadeStore
        .getState()
        .setSnapshot(snakeRef.current.status, snakeRef.current.score, snakeRef.current.highScore);
      redraw();
    };

    const enqueueDirection = (dir: SnakeDirection) => {
      if (snakeRef.current.status !== 'playing') return;
      if (queueSnakeDirection(snakeRef.current, dir)) {
        if (dir === 'up') joyTiltRef.current = { x: -0.32, z: 0 };
        else if (dir === 'down') joyTiltRef.current = { x: 0.32, z: 0 };
        else if (dir === 'left') joyTiltRef.current = { x: 0, z: 0.32 };
        else joyTiltRef.current = { x: 0, z: -0.32 };
      }
    };

    useArcadeStore.getState().registerHandlers({ startOrRestart, enqueueDirection });
    return () => {
      useArcadeStore.getState().registerHandlers(null);
    };
  }, [screenCanvas, screenCtx, screenTex]);

  useLayoutEffect(() => {
    screenCanvasRef.current = screenCanvas;
    screenCtxRef.current = screenCtx;
    screenTexRef.current = screenTex;

    const btns = buttonsInstRef.current;
    if (btns) {
      const baseCols = [
        ARCADE_CONFIG.arcadeColors.buttonPrimary,
        ARCADE_CONFIG.arcadeColors.buttonSecondary,
      ];
      for (let i = 0; i < 2; i++) {
        _btnDummy.position.set(0.06 + i * 0.085, 0.025, 0.025 - i * 0.015);
        _btnDummy.rotation.set(0, 0, 0);
        _btnDummy.scale.set(1, 1, 1);
        _btnDummy.updateMatrix();
        btns.setMatrixAt(i, _btnDummy.matrix);
        _btnCol.set(baseCols[i]).multiplyScalar(0.85);
        btns.setColorAt(i, _btnCol);
      }
      btns.instanceMatrix.needsUpdate = true;
      if (btns.instanceColor) btns.instanceColor.needsUpdate = true;
    }

    freezeStaticMatrices(rootRef.current);
  }, [screenCanvas, screenCtx, screenTex]);

  useEffect(() => {
    return () => {
      bodyAndMetalGeo.dispose();
      controlPanelGeo.dispose();
      emissiveTrimGeo.dispose();
      marqueeGeo.dispose();
      screenGeo.dispose();
      joystickGeo.dispose();
      buttonGeo.dispose();
      Object.values(materials).forEach((m) => m.dispose());
      marqueeTex?.dispose();
      screenTex?.dispose();
    };
  }, [
    bodyAndMetalGeo,
    controlPanelGeo,
    emissiveTrimGeo,
    marqueeGeo,
    screenGeo,
    joystickGeo,
    buttonGeo,
    materials,
    marqueeTex,
    screenTex,
  ]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.08);
    const pc = usePcStore.getState();
    if (pc.pcMode && pc.pcArrived && !pc.pcExiting && pc.poweredPC && pc.bootState === 'desktop') {
      return;
    }

    const inputState = useInputStore.getState();
    const isPlayingFocused =
      inputState.mode === 'focus' &&
      inputState.focusKind === 'arcade' &&
      !inputState.focusExiting;

    // Detect transition entering/leaving arcade focus mode
    if (isPlayingFocused && !lastWasFocusRef.current) {
      lastWasFocusRef.current = true;
      if (snakeRef.current.status !== 'playing') {
        snakeRef.current = startSnakeGame(snakeRef.current);
        tickAccumRef.current = 0;
        playSnakeStartSound();
      }
      useArcadeStore
        .getState()
        .setSnapshot(snakeRef.current.status, snakeRef.current.score, snakeRef.current.highScore);
      const ctx = screenCtxRef.current;
      const canvas = screenCanvasRef.current;
      const tex = screenTexRef.current;
      if (ctx && canvas && tex) {
        drawSnakeGameScreen(ctx, canvas.width, canvas.height, snakeRef.current, true);
        tex.needsUpdate = true;
      }
    } else if (!isPlayingFocused && lastWasFocusRef.current) {
      lastWasFocusRef.current = false;
      snakeRef.current.status = 'idle';
      tickAccumRef.current = 0;
      useArcadeStore.getState().setSnapshot('idle', 0, snakeRef.current.highScore);
      const ctx = screenCtxRef.current;
      const canvas = screenCanvasRef.current;
      const tex = screenTexRef.current;
      if (ctx && canvas && tex) {
        drawSnakeAttractScreen(ctx, canvas.width, canvas.height, true, snakeRef.current.highScore);
        tex.needsUpdate = true;
      }
    }

    // Joystick & action button visual feedback damping
    if (joystickRef.current) {
      joystickRef.current.rotation.x += (joyTiltRef.current.x - joystickRef.current.rotation.x) * Math.min(1, dt * 16);
      joystickRef.current.rotation.z += (joyTiltRef.current.z - joystickRef.current.rotation.z) * Math.min(1, dt * 16);
      joyTiltRef.current.x *= Math.exp(-8 * dt);
      joyTiltRef.current.z *= Math.exp(-8 * dt);
    }

    if (buttonsInstRef.current) {
      let dirtyBtn = false;
      const baseCols = [
        ARCADE_CONFIG.arcadeColors.buttonPrimary,
        ARCADE_CONFIG.arcadeColors.buttonSecondary,
      ];
      for (let i = 0; i < 2; i++) {
        if (btnFlashTimerRef.current[i] > 0) {
          btnFlashTimerRef.current[i] = Math.max(0, btnFlashTimerRef.current[i] - dt);
          const lit = btnFlashTimerRef.current[i] > 0;
          _btnCol.set(baseCols[i]).multiplyScalar(lit ? 1.55 : 0.85);
          buttonsInstRef.current.setColorAt(i, _btnCol);
          _btnDummy.position.set(0.06 + i * 0.085, lit ? 0.019 : 0.025, 0.025 - i * 0.015);
          _btnDummy.rotation.set(0, 0, 0);
          _btnDummy.scale.set(1, 1, 1);
          _btnDummy.updateMatrix();
          buttonsInstRef.current.setMatrixAt(i, _btnDummy.matrix);
          dirtyBtn = true;
        }
      }
      if (dirtyBtn) {
        buttonsInstRef.current.instanceMatrix.needsUpdate = true;
        if (buttonsInstRef.current.instanceColor) {
          buttonsInstRef.current.instanceColor.needsUpdate = true;
        }
      }
    }

    if (typeof document !== 'undefined' && document.hidden) {
      return;
    }

    // Playable Snake fixed-timestep loop when focused
    if (isPlayingFocused) {
      if (snakeRef.current.status === 'playing') {
        const tickSec = 1 / snakeRef.current.tps;
        tickAccumRef.current += dt;
        let stepped = false;

        // Cap catch-up steps cleanly to avoid spiral of death
        let guard = 0;
        while (tickAccumRef.current >= tickSec && snakeRef.current.status === 'playing' && guard < 3) {
          tickAccumRef.current -= tickSec;
          guard++;
          const ev = stepSnake(snakeRef.current);
          stepped = true;
          if (ev === 'eat') {
            btnFlashTimerRef.current[0] = 0.14;
            playSnakeEatSound();
            useArcadeStore
              .getState()
              .setSnapshot(
                snakeRef.current.status,
                snakeRef.current.score,
                snakeRef.current.highScore
              );
          } else if (ev === 'gameover') {
            btnFlashTimerRef.current[1] = 0.25;
            playSnakeGameOverSound();
            useArcadeStore
              .getState()
              .setSnapshot(
                snakeRef.current.status,
                snakeRef.current.score,
                snakeRef.current.highScore
              );
            break;
          }
        }

        const ctx = screenCtxRef.current;
        const canvas = screenCanvasRef.current;
        const tex = screenTexRef.current;
        if (stepped && ctx && canvas && tex) {
          blinkPhaseRef.current = (blinkPhaseRef.current + 1) % 4;
          drawSnakeGameScreen(ctx, canvas.width, canvas.height, snakeRef.current, blinkPhaseRef.current !== 0);
          tex.needsUpdate = true;
        }
      }
      return;
    }

    // Idle attract screen: check distance (<8m) & view frustum at 4Hz, redraw at 2Hz (High) / 1Hz (Low)
    visCheckTimerRef.current += dt;
    if (visCheckTimerRef.current >= 1 / ARCADE_CONFIG.idleCheckHz) {
      visCheckTimerRef.current = 0;
      const distSq = camera.position.distanceToSquared(_arcadeWorldPos);
      if (distSq > ARCADE_CONFIG.idleCullDistSq) {
        attractVisibleRef.current = false;
      } else {
        camera.getWorldDirection(_camDir);
        _toCabinet.subVectors(_arcadeWorldPos, camera.position).normalize();
        attractVisibleRef.current = _camDir.dot(_toCabinet) > 0.05 || distSq < 4.0;
      }
    }

    const ctx = screenCtxRef.current;
    const canvas = screenCanvasRef.current;
    const tex = screenTexRef.current;
    if (!attractVisibleRef.current || !ctx || !canvas || !tex) return;

    const attractInterval = quality === 'low' ? 1.0 : 0.5;
    attractTimerRef.current += dt;
    if (attractTimerRef.current >= attractInterval) {
      attractTimerRef.current = 0;
      blinkPhaseRef.current = (blinkPhaseRef.current + 1) % 2;
      drawSnakeAttractScreen(ctx, canvas.width, canvas.height, blinkPhaseRef.current === 0, snakeRef.current.highScore);
      tex.needsUpdate = true;
    }
  });

  return (
    <group
      ref={rootRef}
      name="arcade-cabinet"
      position={ARCADE_CONFIG.position}
      rotation={[0, ARCADE_CONFIG.rotationY, 0]}
    >
      {/* Draw call 1: Cabinet body silhouette, bezel rim, coin door & kick plate */}
      <mesh geometry={bodyAndMetalGeo} material={materials.bodyMat} />

      {/* Draw call 2: Sloped control panel deck mounted proudly above lower shelf (interactive) */}
      <group position={[0, 1.005, 0.25]} rotation={[0.22, 0, 0]}>
        <mesh
          geometry={controlPanelGeo}
          material={materials.panelMat}
          userData={{ interactive: 'arcade' }}
        />
        {/* Draw call 6: Tilting joystick */}
        <group
          ref={joystickRef}
          position={[-0.14, 0.022, 0.015]}
          userData={{ dynamicTransform: true }}
        >
          <mesh geometry={joystickGeo} material={materials.joystickMat} />
        </group>
        {/* Draw call 7: Two emissive buttons */}
        <instancedMesh
          ref={buttonsInstRef}
          args={[buttonGeo, materials.buttonsMat, 2]}
          userData={{ dynamicTransform: true }}
        />
      </group>

      {/* Draw call 3: Neon side stripes + glowing coin slot */}
      <mesh geometry={emissiveTrimGeo} material={materials.emissiveTrimMat} />

      {/* Draw call 4: Lit retro "ARCADE" top marquee */}
      <mesh
        position={[0, 1.69, 0.186]}
        rotation={[0.205, 0, 0]}
        geometry={marqueeGeo}
        material={materials.marqueeMat}
      />

      {/* Draw call 5: Tilted 256x224 pixel CRT screen (interactive) */}
      <mesh
        position={[SCREEN_LOCAL_CENTER.x, SCREEN_LOCAL_CENTER.y, SCREEN_LOCAL_CENTER.z]}
        rotation={[-SCREEN_TILT_RAD, 0, 0]}
        geometry={screenGeo}
        material={materials.screenMat}
        userData={{ interactive: 'arcade' }}
      />
    </group>
  );
}
