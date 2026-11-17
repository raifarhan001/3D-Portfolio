/**
 * Centralized Configuration for Room, Lighting, Materials, Media Wall, Furniture, Performance, and Camera.
 */
import { GAMING_ROOM_CONFIG, STEP5_COLLIDERS, STEP6_COLLIDERS } from '@/config/themeConfig';

export const ROOM_CONFIG = {
  // Dimensions in meters (Left wall at x = -5)
  width: 10,
  depth: 10,
  height: 3.5,

  // Light, warm modern stone-gray walls for an airy luxury gaming lounge
  wallColor: '#b4b7bf',
  wallRoughness: 0.85,
  wallMetalness: 0.03,
} as const;

export const MEDIA_WALL_CONFIG = {
  // Placement on Left Wall
  groupPosition: [-5.0, 0.0, 0.0] as [number, number, number],
  groupRotationY: Math.PI / 2, // Local +z points into the room

  // Simple unified warm-walnut fluted slat backdrop behind TV
  panelWidth: 5.2,
  panelHeight: 3.3,
  panelDepth: 0.05,
  panelLocalZ: 0.025,
  panelRoughness: 0.82,

  // Larger ~105" 16:9 TV Dimensions & Placement
  tvWidth: 2.48,
  tvHeight: 1.41,
  tvDepth: 0.04,
  tvCenterY: 1.72,
  tvLocalZ: 0.105, // Frame floats slightly off the slat wall
  screenLocalZ: 0.135, // Kept exact for TVInteraction & TVContent alignment
  screenWidth: 2.40,
  screenHeight: 1.35,

  // Modern Designer Media Credenza Table (raised on slim legs)
  consoleWidth: 3.0,
  consoleThickness: 0.34,
  consoleDepth: 0.48,
  consoleTopY: 0.50,
  consoleLocalZ: 0.31,
  legWidth: 0.04,
  legHeight: 0.16,
  legDepth: 0.04,

  // Floor Standing Hi-Fi Tower Speakers
  speakerWidth: 0.30,
  speakerHeight: 1.14,
  speakerDepth: 0.32,
  speakerLeftLocalX: -2.12,
  speakerRightLocalX: 2.12,
  speakerLocalZ: 0.30,

  // RGB Backlight (Bias Lighting)
  rgbMode: 'rainbow' as 'rainbow' | 'static' | 'off',
  rgbSpeed: 0.05,
  rgbStaticColor: '#00f0ff',
  rgbLightIntensity: 2.2,
  rgbLightDistance: 5.0,
  rgbLightDecay: 1.8,
  glowOpacity: 0.42, // Max <= 0.5
  glowPlaneWidth: 3.6,
  glowPlaneHeight: 2.25,
  glowLocalZ: 0.06,
} as const;

// World Axis-Aligned Bounding Box (AABB) Colliders computed from MediaWall transform
export const MEDIA_WALL_COLLIDERS = [
  {
    id: 'console-table',
    min: [-4.95, 0.0, -1.52] as [number, number, number],
    max: [-4.45, 0.52, 1.52] as [number, number, number],
  },
  {
    id: 'speaker-left',
    min: [-4.86, 0.0, 1.95] as [number, number, number],
    max: [-4.52, 1.16, 2.29] as [number, number, number],
  },
  {
    id: 'speaker-right',
    min: [-4.86, 0.0, -2.29] as [number, number, number],
    max: [-4.52, 1.16, -1.95] as [number, number, number],
  },
  {
    id: 'mini-fridge',
    min: [-4.98, 0.0, 4.16] as [number, number, number],
    max: [-4.16, 1.08, 4.98] as [number, number, number],
  },
  {
    id: 'gramophone-table',
    min: [-4.98, 0.0, -4.98] as [number, number, number],
    max: [-3.78, 1.3, -3.78] as [number, number, number],
  },
] as const;

// World AABB Colliders for Sofa Set, Coffee Table, Accent Chair & End Table
export const FURNITURE_COLLIDERS = [
  {
    id: 'sofa-main',
    min: [-0.78, 0.0, -1.48] as [number, number, number],
    max: [0.28, 0.85, 1.48] as [number, number, number],
  },
  {
    id: 'sofa-chaise',
    min: [-1.38, 0.0, 0.62] as [number, number, number],
    max: [-0.75, 0.48, 1.48] as [number, number, number],
  },
  {
    id: 'coffee-table',
    min: [-2.02, 0.0, -0.68] as [number, number, number],
    max: [-1.38, 0.42, 0.68] as [number, number, number],
  },
  {
    id: 'accent-chair',
    min: [-1.92, 0.0, -2.52] as [number, number, number],
    max: [-0.98, 0.85, -1.58] as [number, number, number],
  },
  {
    id: 'side-table',
    min: [-0.62, 0.0, -2.22] as [number, number, number],
    max: [-0.08, 0.56, -1.68] as [number, number, number],
  },
  {
    id: 'gym-treadmill',
    min: [3.18, 0.0, 1.82] as [number, number, number],
    max: [4.86, 1.4, 2.68] as [number, number, number],
  },
  {
    id: 'gym-dumbbell-rack',
    min: [1.85, 0.0, 4.34] as [number, number, number],
    max: [3.26, 0.9, 4.86] as [number, number, number],
  },
  {
    id: 'gym-bench-barbell',
    min: [3.46, 0.0, 3.04] as [number, number, number],
    max: [4.86, 1.35, 4.94] as [number, number, number],
  },
] as const;

export const GAMING_CORNER_CONFIG = {
  gamingCorner: { sx: 1, sz: -1 },
  rotationY: -Math.PI / 2,
  deskHeight: 0.75,
  deskThickness: 0.035,
  chairPosition: [1.25, 0.0, 1.4] as [number, number, number],
  chairSeatCameraPos: [1.25, 1.2, 1.4] as [number, number, number],
  mainMonitorPos: [1.15, 1.06, 0.28] as [number, number, number],
  monitorTiltX: -0.05,
  screenArcWidth: 0.95,
  screenHeight: 0.4,
  screenRadius: 1.8,
  pcCamDistanceFill: 0.75,
  pcCamMinDist: 0.55,
  pcCamMaxDist: 1.1,
  pcCamMoveTime: 0.8,
  pcInteractDistance: 2.5,
  chairInteractDistance: 2.8,
  rgbMode: 'rainbow' as 'rainbow' | 'static' | 'off',
  rgbSpeed: 0.08,
  rgbStaticColor: '#00f0ff',
  pointLightLocalPos: [1.2, 1.4, 0.8] as [number, number, number],
  pointLightIntensity: 1.5,
  pointLightDistance: 3.5,
  pointLightDecay: 2,
  hexCount: GAMING_ROOM_CONFIG.hexCount,
  bootDuration: 2.5,
} as const;

export function gamingCornerLocalToWorld(
  lx: number,
  ly: number,
  lz: number
): [number, number, number] {
  const cx = GAMING_CORNER_CONFIG.gamingCorner.sx * (ROOM_CONFIG.width / 2);
  const cz = GAMING_CORNER_CONFIG.gamingCorner.sz * (ROOM_CONFIG.depth / 2);
  const ry = GAMING_CORNER_CONFIG.rotationY;
  const c = Math.cos(ry);
  const s = Math.sin(ry);
  return [cx + lx * c + lz * s, ly, cz - lx * s + lz * c];
}

function gamingLocalBoxToWorldAabb(
  minL: [number, number, number],
  maxL: [number, number, number]
): { min: [number, number, number]; max: [number, number, number] } {
  const corners = [
    gamingCornerLocalToWorld(minL[0], minL[1], minL[2]),
    gamingCornerLocalToWorld(maxL[0], minL[1], minL[2]),
    gamingCornerLocalToWorld(minL[0], maxL[1], maxL[2]),
    gamingCornerLocalToWorld(maxL[0], maxL[1], maxL[2]),
  ];
  return {
    min: [
      Math.min(...corners.map((p) => p[0])),
      minL[1],
      Math.min(...corners.map((p) => p[2])),
    ],
    max: [
      Math.max(...corners.map((p) => p[0])),
      maxL[1],
      Math.max(...corners.map((p) => p[2])),
    ],
  };
}

export const GAMING_CORNER_COLLIDERS = [
  {
    id: 'gaming-desk',
    ...gamingLocalBoxToWorldAabb([0.05, 0.0, 0.03], [2.25, 1.35, 0.83]),
  },
  {
    id: 'gaming-chair',
    ...gamingLocalBoxToWorldAabb(
      [
        GAMING_CORNER_CONFIG.chairPosition[0] - 0.26,
        0.0,
        GAMING_CORNER_CONFIG.chairPosition[2] - 0.26,
      ],
      [
        GAMING_CORNER_CONFIG.chairPosition[0] + 0.26,
        1.35,
        GAMING_CORNER_CONFIG.chairPosition[2] + 0.26,
      ]
    ),
  },
] as const;

export const PORTFOLIO_COLLIDERS = [
  {
    id: 'certificates-shelf',
    min: [0.95, 0.0, -5.0] as [number, number, number],
    max: [2.55, 2.1, -4.8] as [number, number, number],
  },
  {
    id: 'floor-lamp',
    min: [-3.82, 0.0, 4.36] as [number, number, number],
    max: [-3.38, 1.65, 4.8] as [number, number, number],
  },
  {
    id: 'floor-plant',
    min: [0.81, 0.0, 4.36] as [number, number, number],
    max: [1.29, 1.3, 4.84] as [number, number, number],
  },
] as const;

export const ALL_COLLIDERS = [
  ...MEDIA_WALL_COLLIDERS,
  ...FURNITURE_COLLIDERS,
  ...GAMING_CORNER_COLLIDERS,
  ...PORTFOLIO_COLLIDERS,
  ...STEP5_COLLIDERS,
  ...STEP6_COLLIDERS,
] as const;

export const CEILING_PANEL_SYSTEM_CONFIG = {
  mode: 'single' as 'grid' | 'single',
  gridRows: 3,
  gridCols: 3,
  margin: 0.16,
  frameWidth: 0.06,
  frameHeight: 0.04,
  frameColor: '#242730',
  frameRoughness: 0.72,
  yOffsetFromCeiling: 0.03,
  // Bright luminous warm-off-white ceiling panel
  panelColor: '#f3f1ec',
  noiseRepeat: [8, 8] as [number, number],
  baseColor: '#2a2d36',
  baseRoughness: 0.9,
  coveLedColor: '#fff0dd',
} as const;

export const RECT_AREA_LIGHT_CONFIG = {
  width: 9.4,
  height: 9.4,
  yOffsetFromCeiling: 0.06,
  color: '#fff4e8',
  intensity: 1.9, // Bright, warm, airy illumination
} as const;

export const FLOOR_CONFIG = {
  // Light oak wood planks (0.15m wide x 1.2m long)
  color: '#c9a574',
  roughness: 0.8,
  metalness: 0.0,
  plankWidth: 0.15,
  plankLength: 1.2,
} as const;

export const LIGHTING_CONFIG = {
  ambientIntensity: 0.36,
  ambientColor: '#ffffff',
  hemisphereSkyColor: '#ffffff',
  hemisphereGroundColor: '#c9a67c',
  hemisphereIntensity: 0.68,
} as const;

export const RENDERER_CONFIG = {
  toneMappingExposure: 1.0,
} as const;

export const BLOOM_CONFIG = {
  intensity: 0.22,
  luminanceThreshold: 1.2,
  luminanceSmoothing: 0.25,
  resolutionScale: 0.5,
  mipmapBlur: true,
} as const;

export const PERFORMANCE_CONFIG = {
  dpr: [1, 1.25] as [number, number],
  showStats: true,
  showPerf: true,
} as const;

export const CAMERA_CONFIG = {
  eyeHeight: 1.7,
  spawnPosition: [0, 1.7, 4.0] as [number, number, number],
  spawnLookAt: [0, 1.7, 0] as [number, number, number],
  initialPitch: 0.0,
  initialYaw: 0.0,
  fov: 70,
} as const;

export const PLAYER_CONFIG = {
  eyeHeight: CAMERA_CONFIG.eyeHeight,
  spawnPosition: CAMERA_CONFIG.spawnPosition,
  spawnLookAt: CAMERA_CONFIG.spawnLookAt,
  fov: CAMERA_CONFIG.fov,

  // Movement dynamics (untouched)
  walkSpeed: 3.5,
  sprintSpeed: 6.5,
  acceleration: 12.0,
  damping: 8.5,

  // Collision margin
  collisionMargin: 0.4,
} as const;

export const TV_CONFIG = {
  tvInteractDistance: 3.5,
  tvCamDistance: 2.3,
  tvCamMoveTime: 0.8,
  nightcastUrl: 'https://night-cast.vercel.app/',
  tvVisibilityDistance: 8,
} as const;

export const SOFA_CONFIG = {
  interactDistance: 3.5,
  seatPosition: [-0.22, 1.24, 0.0] as [number, number, number],
  camMoveTime: 0.8,
} as const;

export interface GramophoneTrack {
  id: string;
  label: string;
  title: string;
  subtitle: string;
  color: string;
  src: string;
  notes: ReadonlyArray<number>; // Frequencies (Hz) used for built-in preview if mp3 not added yet
}

export const GRAMOPHONE_CONFIG = {
  interactDistance: 3.5,
  tablePosition: [-4.38, 0.0, -4.38] as [number, number, number],
  tableRotationY: Math.PI / 4,
  camPosition: [-3.35, 1.32, -3.35] as [number, number, number],
  camLookAt: [-4.38, 0.92, -4.38] as [number, number, number],
  camMoveTime: 0.8,
  defaultVolume: 0.7,
  tracks: [
    {
      id: 'cassette-1',
      label: 'NUSRAT',
      title: 'Unki Mehfil Main',
      subtitle: 'Nusrat Fateh Ali Khan',
      color: '#b91c1c',
      src: '/audio/unki-mehfil-main.mp3',
      notes: [220, 261.63, 329.63, 392.0],
    },
    {
      id: 'cassette-2',
      label: 'NUSRAT',
      title: 'Kali Kali Zulfon Ke',
      subtitle: 'Nusrat Fateh Ali Khan',
      color: '#1d4ed8',
      src: '/audio/kali-kali-zulfon.mp3',
      notes: [196, 246.94, 293.66, 369.99],
    },
    {
      id: 'cassette-3',
      label: 'NUSRAT',
      title: 'Saja Hai Maikhana',
      subtitle: 'Nusrat Fateh Ali Khan',
      color: '#7c3aed',
      src: '/audio/saja-hai-maikhana.mp3',
      notes: [174.61, 220, 261.63, 349.23],
    },
    {
      id: 'cassette-4',
      label: 'NUSRAT',
      title: 'Un Ka Andaz E Karam',
      subtitle: 'Nusrat Fateh Ali Khan',
      color: '#059669',
      src: '/audio/un-ka-andaz-e-karam.mp3',
      notes: [246.94, 293.66, 369.99, 440],
    },
    {
      id: 'cassette-5',
      label: 'MEHDI HASSAN',
      title: 'Rafta Rafta',
      subtitle: 'Mehdi Hassan',
      color: '#d97706',
      src: '/audio/rafta-rafta.mp3',
      notes: [261.63, 329.63, 392.0, 493.88],
    },
  ] as ReadonlyArray<GramophoneTrack>,
} as const;
