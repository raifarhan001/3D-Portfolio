'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { useGymStore } from '@/stores/gymStore';
import { playGymPlateClinkSound } from '@/utils/sound';
import {
  buildMergedColoredGeometry,
  buildMergedGeometry,
  freezeStaticMatrices,
  type GeometryPart,
} from '@/utils/mergeHelpers';

/**
 * Generates an interlocking speckled black EPDM gym rubber tile texture (1024x1024, 5x5 tiles).
 */
function createRubberTilesTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#18191e';
  ctx.fillRect(0, 0, size, size);

  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = Math.random();
    if (r > 0.985) {
      const v = 135 + Math.floor(Math.random() * 60);
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v + 4;
    } else if (r > 0.981) {
      data[i] = 165;
      data[i + 1] = 28;
      data[i + 2] = 44;
    } else {
      const base = 22 + Math.floor(Math.random() * 10);
      data[i] = base;
      data[i + 1] = base + 1;
      data[i + 2] = base + 4;
    }
    data[i + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);

  const tiles = 5;
  const step = size / tiles;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.72)';
  ctx.lineWidth = 4;
  for (let t = 0; t <= tiles; t++) {
    const pos = t * step;
    ctx.beginPath();
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, size);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, pos);
    ctx.lineTo(size, pos);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1.5;
  for (let t = 0; t < tiles; t++) {
    const pos = t * step + 3;
    ctx.beginPath();
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, size);
    ctx.moveTo(0, pos);
    ctx.lineTo(size, pos);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Generates a repeating striped running-belt texture so treadmill motion reads clearly in 3D.
 */
function createTreadmillBeltTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const w = 256;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#111318';
  ctx.fillRect(0, 0, w, h);

  // Subtle tread cleats & center guide chevron
  ctx.fillStyle = '#1c202a';
  for (let y = 0; y < h; y += 32) {
    ctx.fillRect(14, y, w - 28, 7);
  }
  ctx.fillStyle = 'rgba(56, 189, 248, 0.28)';
  for (let y = 12; y < h; y += 64) {
    ctx.fillRect(w / 2 - 18, y, 36, 4);
  }
  ctx.fillStyle = 'rgba(179, 18, 42, 0.35)';
  ctx.fillRect(0, 0, 8, h);
  ctx.fillRect(w - 8, 0, 8, h);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 3.5);
  return tex;
}

interface TreadmillScreenHandle {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  tex: THREE.CanvasTexture;
}

function drawTreadmillScreen(
  ctx: CanvasRenderingContext2D,
  params: {
    running: boolean;
    speed: number;
    incline: number;
    distanceKm: number;
    heartRate: number;
    calories: number;
    phase: number;
  }
): void {
  const { running, speed, incline, distanceKm, heartRate, calories, phase } = params;

  ctx.fillStyle = '#090b10';
  ctx.fillRect(0, 0, 512, 256);

  // Header status strip
  ctx.fillStyle = running ? '#10b981' : '#b3122a';
  ctx.fillRect(18, 16, 476, 6);

  // Mode badge
  ctx.fillStyle = running ? 'rgba(16, 185, 129, 0.16)' : 'rgba(179, 18, 42, 0.18)';
  ctx.fillRect(28, 34, 152, 26);
  ctx.fillStyle = running ? '#34d399' : '#fda4af';
  ctx.font = '700 15px system-ui, -apple-system, sans-serif';
  const modeLabel = !running
    ? 'READY'
    : speed >= 11.5
      ? 'SPRINT'
      : speed >= 7
        ? 'JOG'
        : 'WALK';
  ctx.fillText(running ? `ACTIVE • ${modeLabel}` : 'STANDBY • PRESS E', 36, 52);

  // Primary Speed readout
  ctx.fillStyle = running ? '#38bdf8' : '#7dd3fc';
  ctx.font = 'bold 58px system-ui, -apple-system, sans-serif';
  ctx.fillText((running ? speed : 0).toFixed(1), 32, 120);
  ctx.fillStyle = '#9ca3af';
  ctx.font = '600 18px system-ui, -apple-system, sans-serif';
  ctx.fillText('KM/H', 142, 120);

  // Secondary telemetry
  ctx.fillStyle = '#f4f4f5';
  ctx.font = 'bold 30px system-ui, -apple-system, sans-serif';
  ctx.fillText(`${distanceKm.toFixed(2)} km`, 250, 82);

  ctx.fillStyle = '#f87171';
  ctx.font = 'bold 28px system-ui, -apple-system, sans-serif';
  ctx.fillText(`${Math.round(heartRate)} BPM`, 250, 124);

  ctx.fillStyle = '#fbbf24';
  ctx.font = '600 20px system-ui, -apple-system, sans-serif';
  ctx.fillText(`INC ${incline}%  •  ${Math.round(calories)} kcal`, 250, 158);

  // Dynamic intensity equalizer bars
  const activeBars = running ? Math.max(2, Math.min(12, Math.round((speed / 16) * 12))) : 0;
  for (let i = 0; i < 12; i++) {
    const baseH = 0.35 + ((i % 4) * 0.14);
    const wave = running ? Math.abs(Math.sin(phase * 6.2 + i * 0.65)) * 0.45 : 0;
    const hRatio = Math.min(1, baseH + wave);
    ctx.fillStyle =
      i < activeBars
        ? i >= 9
          ? '#ef4444'
          : i >= 5
            ? '#f59e0b'
            : '#38bdf8'
        : 'rgba(255,255,255,0.14)';
    const bh = hRatio * 50;
    ctx.fillRect(34 + i * 38, 232 - bh, 26, bh);
  }
}

function createTreadmillScreenHandle(): TreadmillScreenHandle | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  drawTreadmillScreen(ctx, {
    running: false,
    speed: 8.5,
    incline: 2,
    distanceKm: 0,
    heartRate: 76,
    calories: 0,
    phase: 0,
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return { canvas, ctx, tex };
}

const DUMBBELL_PAIRS = [
  { x: -0.5, r: 0.045, w: 0.038 },
  { x: -0.3, r: 0.052, w: 0.044 },
  { x: -0.1, r: 0.058, w: 0.05 },
  { x: 0.1, r: 0.064, w: 0.056 },
  { x: 0.3, r: 0.07, w: 0.062 },
  { x: 0.5, r: 0.076, w: 0.068 },
] as const;

// Helper to bake a parent transform onto child GeometryParts
function transformParts(
  parts: GeometryPart[],
  parentPos: [number, number, number],
  parentRot: [number, number, number]
): GeometryPart[] {
  const mParent = new THREE.Matrix4().compose(
    new THREE.Vector3(...parentPos),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...parentRot, 'XYZ')),
    new THREE.Vector3(1, 1, 1)
  );
  const mChild = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const scale = new THREE.Vector3();

  return parts.map((p) => {
    mChild.compose(
      new THREE.Vector3(...(p.position || [0, 0, 0])),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...(p.rotation || [0, 0, 0]), 'XYZ')),
      new THREE.Vector3(...(p.scale || [1, 1, 1]))
    );
    mChild.premultiply(mParent);
    mChild.decompose(pos, quat, scale);
    euler.setFromQuaternion(quat, 'XYZ');
    return {
      geometry: p.geometry,
      position: [pos.x, pos.y, pos.z],
      rotation: [euler.x, euler.y, euler.z],
      scale: [scale.x, scale.y, scale.z],
    };
  });
}

/**
 * GymCorner Component — Static structural meshes merged & frozen, paired with interactive animated
 * treadmill belt + live LED display, Olympic bench press barbell/plates, and curling hex dumbbells.
 */
export default function GymCorner() {
  const staticGroupRef = useRef<THREE.Group>(null);
  const barbellGroupRef = useRef<THREE.Group>(null);
  const leftDbGroupRef = useRef<THREE.Group>(null);
  const rightDbGroupRef = useRef<THREE.Group>(null);
  const treadmillLedRef = useRef<THREE.Mesh>(null);
  const treadmillBeltMeshRef = useRef<THREE.Mesh>(null);
  const treadmillScreenMeshRef = useRef<THREE.Mesh>(null);

  // Plate visibility refs driven from useGymStore without re-rendering React tree every frame
  const yellowPlatesRef = useRef<THREE.Group>(null);
  const crimsonPlatesRef = useRef<THREE.Group>(null);
  const blackOuterPlatesRef = useRef<THREE.Group>(null);
  const barClipsRef = useRef<THREE.Group>(null);

  const beltTexRef = useRef<THREE.CanvasTexture | null>(null);
  const screenHandleRef = useRef<TreadmillScreenHandle | null>(null);
  const lastScreenDrawRef = useRef(0);
  const lastScreenSigRef = useRef('');

  const rubberTex = useMemo(() => createRubberTilesTexture(), []);

  useLayoutEffect(() => {
    freezeStaticMatrices(staticGroupRef.current);

    const bTex = createTreadmillBeltTexture();
    beltTexRef.current = bTex;
    if (bTex && treadmillBeltMeshRef.current) {
      const mat = treadmillBeltMeshRef.current.material as THREE.MeshStandardMaterial;
      mat.map = bTex;
      mat.needsUpdate = true;
    }

    const sHandle = createTreadmillScreenHandle();
    screenHandleRef.current = sHandle;
    if (sHandle && treadmillScreenMeshRef.current) {
      const mat = treadmillScreenMeshRef.current.material as THREE.MeshBasicMaterial;
      mat.map = sHandle.tex;
      mat.needsUpdate = true;
    }

    return () => {
      bTex?.dispose();
      sHandle?.tex.dispose();
    };
  }, []);

  const merged = useMemo(() => {
    const steelParts: GeometryPart[] = [];
    const chromeParts: GeometryPart[] = [];
    const rubberWeightParts: GeometryPart[] = [];
    const crimsonParts: GeometryPart[] = [];
    const benchLeatherParts: GeometryPart[] = [];

    // --- 1. Mat Border ---
    const matEdgeGeo = buildMergedGeometry([
      { geometry: new THREE.BoxGeometry(3.34, 0.01, 0.03), position: [3.3, 0.005, 1.64] },
      { geometry: new THREE.BoxGeometry(0.03, 0.01, 3.34), position: [1.64, 0.005, 3.3] },
    ]);

    // --- 2. Treadmill at [4.02, 0.015, 2.25], rot [0, -Math.PI/2, 0] ---
    const tmPos: [number, number, number] = [4.02, 0.015, 2.25];
    const tmRot: [number, number, number] = [0, -Math.PI / 2, 0];

    steelParts.push(
      ...transformParts(
        [
          { geometry: new RoundedBoxGeometry(0.8, 0.11, 1.62, 2, 0.02), position: [0, 0.07, 0.1] },
          { geometry: new RoundedBoxGeometry(0.76, 0.16, 0.34, 2, 0.03), position: [0, 0.15, -0.58] },
          { geometry: new THREE.BoxGeometry(0.075, 1.1, 0.1), position: [-0.34, 0.68, -0.56], rotation: [0.18, 0, 0] },
          { geometry: new THREE.BoxGeometry(0.075, 1.1, 0.1), position: [0.34, 0.68, -0.56], rotation: [0.18, 0, 0] },
          { geometry: new RoundedBoxGeometry(0.055, 0.05, 0.56, 2, 0.02), position: [-0.34, 0.93, -0.28], rotation: [-0.18, 0, 0] },
          { geometry: new RoundedBoxGeometry(0.055, 0.05, 0.56, 2, 0.02), position: [0.34, 0.93, -0.28], rotation: [-0.18, 0, 0] },
          { geometry: new RoundedBoxGeometry(0.78, 0.28, 0.18, 2, 0.025), position: [0, 1.24, -0.44], rotation: [-0.45, 0, 0] },
        ],
        tmPos,
        tmRot
      )
    );
    crimsonParts.push(
      ...transformParts(
        [
          { geometry: new THREE.BoxGeometry(0.025, 0.02, 1.44), position: [-0.36, 0.11, 0.14] },
          { geometry: new THREE.BoxGeometry(0.025, 0.02, 1.44), position: [0.36, 0.11, 0.14] },
        ],
        tmPos,
        tmRot
      )
    );

    // --- 3. Dumbbell Rack + 12 Hex Dumbbells at [2.55, 0.015, 4.6], rot [0, Math.PI, 0] ---
    const drPos: [number, number, number] = [2.55, 0.015, 4.6];
    const drRot: [number, number, number] = [0, Math.PI, 0];
    const drSteel: GeometryPart[] = [
      { geometry: new THREE.BoxGeometry(0.06, 0.04, 0.48), position: [-0.64, 0.02, 0] },
      { geometry: new THREE.BoxGeometry(0.06, 0.04, 0.48), position: [0.64, 0.02, 0] },
      { geometry: new THREE.BoxGeometry(0.055, 0.8, 0.07), position: [-0.64, 0.42, 0], rotation: [0.12, 0, 0] },
      { geometry: new THREE.BoxGeometry(0.055, 0.8, 0.07), position: [0.64, 0.42, 0], rotation: [0.12, 0, 0] },
      { geometry: new THREE.BoxGeometry(1.34, 0.03, 0.24), position: [0, 0.34, 0.04], rotation: [-0.18, 0, 0] },
      { geometry: new THREE.BoxGeometry(1.34, 0.03, 0.24), position: [0, 0.68, -0.04], rotation: [-0.18, 0, 0] },
    ];
    steelParts.push(...transformParts(drSteel, drPos, drRot));
    crimsonParts.push(...transformParts([{ geometry: new THREE.BoxGeometry(1.32, 0.015, 0.01), position: [0, 0.68, 0.085] }], drPos, drRot));

    const drChrome: GeometryPart[] = [];
    const drRubber: GeometryPart[] = [];
    [
      { y: 0.745, z: -0.04, scale: 0.85 },
      { y: 0.405, z: 0.04, scale: 1.08 },
    ].forEach((tier) => {
      DUMBBELL_PAIRS.forEach((db) => {
        const headR = db.r * tier.scale;
        const headW = db.w * tier.scale;
        drChrome.push({
          geometry: new THREE.CylinderGeometry(0.014, 0.014, 0.14, 10),
          position: [db.x, tier.y, tier.z],
          rotation: [Math.PI / 2, 0, 0],
        });
        drRubber.push({
          geometry: new THREE.CylinderGeometry(headR, headR, headW, 6),
          position: [db.x, tier.y, tier.z - 0.07 - headW / 2],
          rotation: [Math.PI / 2, 0, 0],
        });
        drRubber.push({
          geometry: new THREE.CylinderGeometry(headR, headR, headW, 6),
          position: [db.x, tier.y, tier.z + 0.07 + headW / 2],
          rotation: [Math.PI / 2, 0, 0],
        });
      });
    });
    chromeParts.push(...transformParts(drChrome, drPos, drRot));
    rubberWeightParts.push(...transformParts(drRubber, drPos, drRot));

    // --- 4. Bench Press Frame & Bench (Barbell is separate dynamic group) ---
    const bpPos: [number, number, number] = [4.16, 0.015, 4.0];
    const bpRot: [number, number, number] = [0, -Math.PI / 2, 0];
    steelParts.push(
      ...transformParts(
        [
          { geometry: new THREE.BoxGeometry(0.06, 0.05, 0.62), position: [-0.58, 0.025, -0.13] },
          { geometry: new THREE.BoxGeometry(0.06, 1.24, 0.06), position: [-0.58, 0.62, -0.38] },
          { geometry: new THREE.BoxGeometry(0.06, 0.05, 0.62), position: [0.58, 0.025, -0.13] },
          { geometry: new THREE.BoxGeometry(0.06, 1.24, 0.06), position: [0.58, 0.62, -0.38] },
          { geometry: new THREE.BoxGeometry(1.16, 0.05, 0.05), position: [0, 0.35, -0.38] },
          { geometry: new THREE.BoxGeometry(0.06, 0.42, 0.06), position: [0, 0.21, -0.27] },
          { geometry: new THREE.BoxGeometry(0.06, 0.42, 0.06), position: [0, 0.21, 0.56] },
          { geometry: new THREE.BoxGeometry(0.42, 0.04, 0.08), position: [0, 0.02, 0.56] },
          { geometry: new THREE.BoxGeometry(0.06, 0.05, 0.92), position: [0, 0.38, 0.14] },
        ],
        bpPos,
        bpRot
      )
    );
    benchLeatherParts.push(
      ...transformParts(
        [
          { geometry: new RoundedBoxGeometry(0.3, 0.075, 0.76, 2, 0.015), position: [0, 0.45, 0.04] },
          { geometry: new RoundedBoxGeometry(0.3, 0.075, 0.32, 2, 0.015), position: [0, 0.45, 0.62] },
        ],
        bpPos,
        bpRot
      )
    );
    crimsonParts.push(
      ...transformParts(
        [
          { geometry: new THREE.BoxGeometry(0.07, 0.04, 0.08), position: [-0.58, 0.94, -0.34] },
          { geometry: new THREE.BoxGeometry(0.07, 0.04, 0.08), position: [0.58, 0.94, -0.34] },
        ],
        bpPos,
        bpRot
      )
    );

    // --- 5. Floor Barbell (Static) ---
    const fwPos: [number, number, number] = [2.45, 0.015, 3.45];
    const fwRot: [number, number, number] = [0, 0.4, 0];
    chromeParts.push(
      ...transformParts(
        [
          { geometry: new THREE.CylinderGeometry(0.013, 0.013, 1.32, 12), position: [0, 0.15, 0], rotation: [0, 0, Math.PI / 2] },
        ],
        fwPos,
        fwRot
      )
    );
    rubberWeightParts.push(
      ...transformParts(
        [
          { geometry: new THREE.CylinderGeometry(0.15, 0.15, 0.038, 20), position: [-0.48, 0.15, 0], rotation: [0, 0, Math.PI / 2] },
          { geometry: new THREE.CylinderGeometry(0.15, 0.15, 0.038, 20), position: [0.48, 0.15, 0], rotation: [0, 0, Math.PI / 2] },
        ],
        fwPos,
        fwRot
      )
    );
    crimsonParts.push(
      ...transformParts(
        [
          { geometry: new THREE.CylinderGeometry(0.125, 0.125, 0.03, 20), position: [-0.53, 0.15, 0], rotation: [0, 0, Math.PI / 2] },
          { geometry: new THREE.CylinderGeometry(0.125, 0.125, 0.03, 20), position: [0.53, 0.15, 0], rotation: [0, 0, Math.PI / 2] },
        ],
        fwPos,
        fwRot
      )
    );

    return {
      matEdgeGeo,
      steelGeo: buildMergedGeometry(steelParts),
      chromeGeo: buildMergedGeometry(chromeParts),
      coloredEquipmentGeo: buildMergedColoredGeometry([
        ...rubberWeightParts.map((p) => ({ ...p, color: '#15161b' })),
        ...crimsonParts.map((p) => ({ ...p, color: '#b3122a' })),
        ...benchLeatherParts.map((p) => ({ ...p, color: '#1e2028' })),
      ]),
    };
  }, []);

  const dynamicGeos = useMemo(() => {
    return {
      bar: new THREE.CylinderGeometry(0.014, 0.014, 1.92, 14),
      clip: new THREE.CylinderGeometry(0.032, 0.032, 0.03, 14),
      bluePlate: new THREE.CylinderGeometry(0.21, 0.21, 0.045, 24),
      yellowPlate: new THREE.CylinderGeometry(0.19, 0.19, 0.038, 24),
      crimsonPlate: new THREE.CylinderGeometry(0.17, 0.17, 0.032, 24),
      outerPlate: new THREE.CylinderGeometry(0.155, 0.155, 0.028, 24),
      dbHandle: new THREE.CylinderGeometry(0.014, 0.014, 0.14, 10),
      dbHead: new THREE.CylinderGeometry(0.06, 0.06, 0.052, 6),
    };
  }, []);

  const materials = useMemo(() => {
    return {
      rubberMat: new THREE.MeshStandardMaterial({
        map: rubberTex,
        roughness: 0.92,
        metalness: 0.04,
      }),
      matEdge: new THREE.MeshStandardMaterial({
        color: '#121318',
        roughness: 0.88,
        metalness: 0.05,
      }),
      steelDark: new THREE.MeshStandardMaterial({
        color: '#1b1d24',
        roughness: 0.42,
        metalness: 0.75,
      }),
      chrome: new THREE.MeshStandardMaterial({
        color: '#c4cad4',
        roughness: 0.22,
        metalness: 0.9,
      }),
      beltTrack: new THREE.MeshStandardMaterial({
        color: '#16181f',
        roughness: 0.85,
        metalness: 0.05,
      }),
      coloredEquipment: new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.65,
        metalness: 0.15,
      }),
      plateBlue: new THREE.MeshStandardMaterial({
        color: '#1d4ed8',
        roughness: 0.52,
        metalness: 0.18,
      }),
      plateYellow: new THREE.MeshStandardMaterial({
        color: '#ca8a04',
        roughness: 0.52,
        metalness: 0.18,
      }),
      plateCrimson: new THREE.MeshStandardMaterial({
        color: '#b3122a',
        roughness: 0.52,
        metalness: 0.18,
      }),
      plateDarkRubber: new THREE.MeshStandardMaterial({
        color: '#15161b',
        roughness: 0.68,
        metalness: 0.14,
      }),
      treadmillScreen: new THREE.MeshBasicMaterial({
        toneMapped: false,
      }),
      emergencyRed: new THREE.MeshBasicMaterial({
        color: '#ef4444',
        toneMapped: false,
      }),
      hitbox: new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
        colorWrite: false,
        side: THREE.DoubleSide,
      }),
    };
  }, [rubberTex]);

  useFrame((state, delta) => {
    const gym = useGymStore.getState();

    // Advance live simulation
    gym.tickWorkout(delta, () => {
      playGymPlateClinkSound();
    });

    const nextState = useGymStore.getState();

    // 1. Scroll treadmill belt texture seamlessly
    const bTex = beltTexRef.current;
    if (bTex) {
      bTex.offset.y = -nextState.beltOffset * 2;
    }

    // Pulse stop/power LED subtly when treadmill runs
    if (treadmillLedRef.current) {
      const mat = treadmillLedRef.current.material as THREE.MeshBasicMaterial;
      mat.color.set(nextState.treadmillRunning ? '#10b981' : '#ef4444');
    }

    // 2. Redraw Treadmill digital LED console at ~6 Hz or immediately when settings change
    const sHandle = screenHandleRef.current;
    if (sHandle) {
      const sig = `${nextState.treadmillRunning ? 1 : 0}:${nextState.treadmillSpeed.toFixed(1)}:${nextState.treadmillIncline}:${nextState.distanceKm.toFixed(2)}:${Math.round(nextState.heartRate)}:${Math.round(nextState.calories)}`;
      const elapsed = state.clock.elapsedTime;
      if (sig !== lastScreenSigRef.current && elapsed - lastScreenDrawRef.current >= 0.16) {
        lastScreenSigRef.current = sig;
        lastScreenDrawRef.current = elapsed;
        drawTreadmillScreen(sHandle.ctx, {
          running: nextState.treadmillRunning,
          speed: nextState.treadmillSpeed,
          incline: nextState.treadmillIncline,
          distanceKm: nextState.distanceKm,
          heartRate: nextState.heartRate,
          calories: nextState.calories,
          phase: elapsed,
        });
        sHandle.tex.needsUpdate = true;
      }
    }

    // 3. Animate Bench Press Olympic Barbell + Weight Plate Visibility
    if (barbellGroupRef.current) {
      const p = nextState.benchPressing ? nextState.benchPhase : 0;
      // Smooth sine wave dip to chest & press back to lockout
      const pressWave = Math.sin(p * Math.PI);
      // Slight horizontal un-rack shift over chest when pressing
      const unrackShift = nextState.benchPressing
        ? Math.min(1, Math.sin(Math.min(1, p) * Math.PI) * 3.2)
        : 0;
      barbellGroupRef.current.position.set(
        0,
        0.97 - pressWave * 0.30,
        -0.34 + unrackShift * 0.16
      );
      barbellGroupRef.current.rotation.z = pressWave * 0.014 * Math.sin(p * Math.PI * 2);
    }

    const bw = nextState.benchWeightKg;
    if (yellowPlatesRef.current) yellowPlatesRef.current.visible = bw >= 80;
    if (crimsonPlatesRef.current) crimsonPlatesRef.current.visible = bw >= 100;
    if (blackOuterPlatesRef.current) blackOuterPlatesRef.current.visible = bw >= 120;
    if (barClipsRef.current) {
      barClipsRef.current.position.x = bw >= 120 ? 0.036 : bw >= 100 ? 0 : bw >= 80 ? -0.045 : -0.095;
    }

    // 4. Animate Floor Hex Dumbbells for curl reps
    const curlWave = nextState.curlActive ? Math.sin(nextState.curlPhase * Math.PI) : 0;
    const dbScale = 0.85 + ((nextState.dumbbellWeightKg - 10) / 15) * 0.32;
    if (leftDbGroupRef.current) {
      leftDbGroupRef.current.position.set(-0.22, 0.06 + curlWave * 0.68, 0.42 - curlWave * 0.12);
      leftDbGroupRef.current.rotation.set(curlWave * 0.45, 0.3 - curlWave * 0.25, curlWave * 0.18);
      leftDbGroupRef.current.scale.setScalar(dbScale);
    }
    if (rightDbGroupRef.current) {
      rightDbGroupRef.current.position.set(0.22, 0.06 + curlWave * 0.68, 0.42 - curlWave * 0.12);
      rightDbGroupRef.current.rotation.set(curlWave * 0.45, -0.2 + curlWave * 0.25, -curlWave * 0.18);
      rightDbGroupRef.current.scale.setScalar(dbScale);
    }
  });

  return (
    <group name="home-gym-corner">
      {/* Static frozen structural meshes */}
      <group ref={staticGroupRef} name="home-gym-static">
        {/* 1. Rubber Floor Tiles + Merged Trim Border */}
        <mesh position={[3.3, 0.008, 3.3]} material={materials.rubberMat}>
          <boxGeometry args={[3.3, 0.014, 3.3]} />
        </mesh>
        <mesh geometry={merged.matEdgeGeo} material={materials.matEdge} />

        {/* 2. Merged Gym Equipment Meshes */}
        <mesh geometry={merged.steelGeo} material={materials.steelDark} />
        <mesh geometry={merged.chromeGeo} material={materials.chrome} />
        <mesh geometry={merged.coloredEquipmentGeo} material={materials.coloredEquipment} />
      </group>

      {/* 3. Treadmill Running Belt, Digital Screen & Stop/Power LED */}
      <group position={[4.02, 0.015, 2.25]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh ref={treadmillBeltMeshRef} position={[0, 0.13, 0.14]} material={materials.beltTrack}>
          <boxGeometry args={[0.58, 0.015, 1.38]} />
        </mesh>
        <group position={[0, 1.24, -0.44]} rotation={[-0.45, 0, 0]}>
          <mesh ref={treadmillScreenMeshRef} position={[0, 0.01, 0.092]} material={materials.treadmillScreen}>
            <planeGeometry args={[0.48, 0.21]} />
          </mesh>
          <mesh ref={treadmillLedRef} position={[0, -0.1, 0.095]} material={materials.emergencyRed}>
            <boxGeometry args={[0.05, 0.025, 0.012]} />
          </mesh>
        </group>
      </group>

      {/* 4. Animated Olympic Bench Press Barbell + Swappable Weight Plates */}
      <group position={[4.16, 0.015, 4.0]} rotation={[0, -Math.PI / 2, 0]}>
        <group ref={barbellGroupRef} position={[0, 0.97, -0.34]}>
          <mesh geometry={dynamicGeos.bar} material={materials.chrome} rotation={[0, 0, Math.PI / 2]} />

          {/* Blue 20kg base plates */}
          <mesh
            geometry={dynamicGeos.bluePlate}
            material={materials.plateBlue}
            position={[-0.68, 0, 0]}
            rotation={[0, 0, Math.PI / 2]}
          />
          <mesh
            geometry={dynamicGeos.bluePlate}
            material={materials.plateBlue}
            position={[0.68, 0, 0]}
            rotation={[0, 0, Math.PI / 2]}
          />

          {/* Yellow 15kg plates */}
          <group ref={yellowPlatesRef}>
            <mesh
              geometry={dynamicGeos.yellowPlate}
              material={materials.plateYellow}
              position={[-0.735, 0, 0]}
              rotation={[0, 0, Math.PI / 2]}
            />
            <mesh
              geometry={dynamicGeos.yellowPlate}
              material={materials.plateYellow}
              position={[0.735, 0, 0]}
              rotation={[0, 0, Math.PI / 2]}
            />
          </group>

          {/* Crimson 10kg plates */}
          <group ref={crimsonPlatesRef}>
            <mesh
              geometry={dynamicGeos.crimsonPlate}
              material={materials.plateCrimson}
              position={[-0.785, 0, 0]}
              rotation={[0, 0, Math.PI / 2]}
            />
            <mesh
              geometry={dynamicGeos.crimsonPlate}
              material={materials.plateCrimson}
              position={[0.785, 0, 0]}
              rotation={[0, 0, Math.PI / 2]}
            />
          </group>

          {/* Outer 10kg dark rubber plates (120kg mode) */}
          <group ref={blackOuterPlatesRef} visible={false}>
            <mesh
              geometry={dynamicGeos.outerPlate}
              material={materials.plateDarkRubber}
              position={[-0.822, 0, 0]}
              rotation={[0, 0, Math.PI / 2]}
            />
            <mesh
              geometry={dynamicGeos.outerPlate}
              material={materials.plateDarkRubber}
              position={[0.822, 0, 0]}
              rotation={[0, 0, Math.PI / 2]}
            />
          </group>

          {/* Barbell collars */}
          <group ref={barClipsRef}>
            <mesh
              geometry={dynamicGeos.clip}
              material={materials.chrome}
              position={[-0.825, 0, 0]}
              rotation={[0, 0, Math.PI / 2]}
            />
            <mesh
              geometry={dynamicGeos.clip}
              material={materials.chrome}
              position={[0.825, 0, 0]}
              rotation={[0, 0, Math.PI / 2]}
            />
          </group>
        </group>
      </group>

      {/* 5. Animated Floor Hex Dumbbells */}
      <group position={[2.45, 0.015, 3.45]} rotation={[0, 0.4, 0]}>
        <group ref={leftDbGroupRef} position={[-0.22, 0.06, 0.42]} rotation={[0, 0.3, 0]}>
          <mesh geometry={dynamicGeos.dbHandle} material={materials.chrome} rotation={[Math.PI / 2, 0, 0]} />
          <mesh
            geometry={dynamicGeos.dbHead}
            material={materials.plateDarkRubber}
            position={[0, 0, -0.095]}
            rotation={[Math.PI / 2, 0, 0]}
          />
          <mesh
            geometry={dynamicGeos.dbHead}
            material={materials.plateDarkRubber}
            position={[0, 0, 0.095]}
            rotation={[Math.PI / 2, 0, 0]}
          />
        </group>
        <group ref={rightDbGroupRef} position={[0.22, 0.06, 0.42]} rotation={[0, -0.2, 0]}>
          <mesh geometry={dynamicGeos.dbHandle} material={materials.chrome} rotation={[Math.PI / 2, 0, 0]} />
          <mesh
            geometry={dynamicGeos.dbHead}
            material={materials.plateDarkRubber}
            position={[0, 0, -0.095]}
            rotation={[Math.PI / 2, 0, 0]}
          />
          <mesh
            geometry={dynamicGeos.dbHead}
            material={materials.plateDarkRubber}
            position={[0, 0, 0.095]}
            rotation={[Math.PI / 2, 0, 0]}
          />
        </group>
      </group>

      {/* 6. Invisible Interactive Raycast Hit Volumes per Station */}
      <mesh
        name="gym-hitbox-treadmill"
        position={[4.02, 0.72, 2.25]}
        userData={{ interactive: 'gym', gymStation: 'treadmill' }}
        material={materials.hitbox}
      >
        <boxGeometry args={[1.68, 1.44, 0.92]} />
      </mesh>
      <mesh
        name="gym-hitbox-bench"
        position={[4.16, 0.65, 4.0]}
        userData={{ interactive: 'gym', gymStation: 'bench' }}
        material={materials.hitbox}
      >
        <boxGeometry args={[1.45, 1.3, 1.95]} />
      </mesh>
      <mesh
        name="gym-hitbox-dumbbells"
        position={[2.5, 0.48, 4.0]}
        userData={{ interactive: 'gym', gymStation: 'dumbbells' }}
        material={materials.hitbox}
      >
        <boxGeometry args={[1.55, 0.96, 1.85]} />
      </mesh>
    </group>
  );
}
