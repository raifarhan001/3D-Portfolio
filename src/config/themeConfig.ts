import { IDENTITY_CONFIG } from '@/config/identityConfig';

/**
 * Centralized Step 5 configuration: Day/Night theme palette & intensities,
 * light switch, SFX audio defaults, arcade cabinet & Snake rules,
 * window curtains, center rug, side table + coffee mug + books, and colliders.
 */
export { IDENTITY_CONFIG };

export type RoomTheme = 'day' | 'night';
export type RgbThemeMode = 'rainbow' | 'static' | 'off';

export interface ThemeMoodSpec {
  hemisphereSkyColor: string;
  hemisphereGroundColor: string;
  hemisphereIntensity: number;
  ambientColor: string;
  ambientIntensity: number;
  rectLightColor: string;
  rectLightIntensity: number;
  ceilingPanelColor: string;
  ceilingPanelIntensity: number;
  slotLedLeftColor: string;
  slotLedRightColor: string;
  slotLedIntensity: number;
  wallTint: string;
  floorTint: string;
  neonColor: string;
  neonIntensity: number;
  hexagonBrightness: number;
  tvRgbMode: RgbThemeMode;
  tvRgbBrightness: number;
  deskRgbMode: RgbThemeMode;
  deskRgbBrightness: number;
  windowMix: number; // 0 = day sky, 1 = night skyline
  windowBrightness: number;
  windowUnderGlowColor: string;
  windowUnderGlowOpacity: number;
  curtainColor: string;
  floorLampEmissive: string;
  floorLampIntensity: number;
  sideLampEmissive: string;
  sideLampIntensity: number;
  slatLedColor: string;
  slatLedIntensity: number;
  switchLedColor: string;
  switchLedIntensity: number;
  exposure: number;
  bloomThreshold: number;
  bloomIntensity: number;
}

export const THEMES_CONFIG: Record<RoomTheme, ThemeMoodSpec> = {
  day: {
    hemisphereSkyColor: '#ffffff',
    hemisphereGroundColor: '#c9a67c',
    hemisphereIntensity: 0.68,
    ambientColor: '#ffffff',
    ambientIntensity: 0.36,
    rectLightColor: '#fff4e8',
    rectLightIntensity: 1.9,
    ceilingPanelColor: '#f3f1ec',
    ceilingPanelIntensity: 1.0,
    slotLedLeftColor: '#fff0dd',
    slotLedRightColor: '#fff0dd',
    slotLedIntensity: 1.0,
    wallTint: '#b4b7bf',
    floorTint: '#c9a574',
    neonColor: '#38bdf8',
    neonIntensity: 0.22,
    hexagonBrightness: 0.45,
    tvRgbMode: 'rainbow',
    tvRgbBrightness: 0.6,
    deskRgbMode: 'rainbow',
    deskRgbBrightness: 0.55,
    windowMix: 0,
    windowBrightness: 1.0,
    windowUnderGlowColor: '#e0f2fe',
    windowUnderGlowOpacity: 0.08,
    curtainColor: '#c9b8a0',
    floorLampEmissive: '#dfd6c8',
    floorLampIntensity: 0.85,
    sideLampEmissive: '#e6ddd0',
    sideLampIntensity: 0.85,
    slatLedColor: '#ebd4b8',
    slatLedIntensity: 0.65,
    switchLedColor: '#f59e0b',
    switchLedIntensity: 1.25,
    exposure: 1.0,
    bloomThreshold: 1.2,
    bloomIntensity: 0.22,
  },
  night: {
    hemisphereSkyColor: '#1a2040',
    hemisphereGroundColor: '#1a0f25',
    hemisphereIntensity: 0.35,
    ambientColor: '#7f98d4',
    ambientIntensity: 0.16,
    rectLightColor: '#526ca8',
    rectLightIntensity: 0.38,
    ceilingPanelColor: '#486099',
    ceilingPanelIntensity: 0.21,
    slotLedLeftColor: '#22d3ee',
    slotLedRightColor: '#e879f9',
    slotLedIntensity: 1.35,
    wallTint: '#7f89a3',
    floorTint: '#9c8369',
    neonColor: '#38bdf8',
    neonIntensity: 1.85,
    hexagonBrightness: 1.2,
    tvRgbMode: 'rainbow',
    tvRgbBrightness: 1.2,
    deskRgbMode: 'rainbow',
    deskRgbBrightness: 1.2,
    windowMix: 1,
    windowBrightness: 1.05,
    windowUnderGlowColor: '#7dd3fc',
    windowUnderGlowOpacity: 0.42,
    curtainColor: '#3a3550',
    floorLampEmissive: '#ffd59e',
    floorLampIntensity: 1.58,
    sideLampEmissive: '#ffd8a8',
    sideLampIntensity: 1.5,
    slatLedColor: '#ffd296',
    slatLedIntensity: 1.5,
    switchLedColor: '#22d3ee',
    switchLedIntensity: 1.4,
    exposure: 1.15,
    bloomThreshold: 0.92,
    bloomIntensity: 0.28,
  },
};

export const STEP5_HOTKEYS = {
  themeToggleKey: 'KeyT',
  themeToggleLabel: 'T',
  sfxMuteKey: 'KeyM',
  sfxMuteLabel: 'M',
} as const;

export const LIGHT_SWITCH_CONFIG = {
  // South Wall near entrance spawn [0, 1.7, 4.0], flush to wall (0.015m off z=5.0)
  position: [0.0, 1.25, 4.985] as [number, number, number],
  rotationY: Math.PI,
  plateWidth: 0.085,
  plateHeight: 0.13,
  plateDepth: 0.012,
  plateColor: '#eceef2',
  rockerColor: '#f8fafc',
  rockerTiltRad: 0.25,
  rockerDurationSec: 0.12,
  interactDistance: 2.0,
  toastDurationMs: 1500,
} as const;

export const SFX_CONFIG = {
  storageKey: 'room-sfx-muted',
  defaultMuted: false,
} as const;

export const THEME_STORAGE_KEY = 'room-theme';

export const ARCADE_CONFIG = {
  // Free East Wall 1.20m segment between Gaming Desk (z = -2.75) and Acoustic Slat Panel (z = -1.55)
  // Back sits 0.02m off East wall (x = 5.0), facing -X into the open center floor
  position: [4.555, 0.0, -1.95] as [number, number, number],
  rotationY: -Math.PI / 2,
  width: 0.72,
  height: 1.8,
  depth: 0.85,
  bodyWidth: 0.68,
  camDistance: 0.9,
  camMoveTime: 0.72,
  interactDistance: 2.5,
  idleCheckHz: 4,
  idleCullDistSq: 64, // 8m^2
  arcadeColors: {
    body: '#101014',
    bezel: '#0a0b0e',
    controlPanel: '#161820',
    metal: '#3a3f4c',
    sideStripe: '#22d3ee',
    marqueeBg: '#0c1022',
    marqueeAccent: '#22d3ee',
    marqueeHot: '#f43f5e',
    coinSlot: '#fb923c',
    joystickBall: '#e11d48',
    buttonPrimary: '#22d3ee',
    buttonSecondary: '#f43f5e',
  },
} as const;

export const SNAKE_CONFIG = {
  cols: 20,
  rows: 18,
  baseTps: 8,
  tpsIncrement: 0.4,
  foodsPerSpeedStep: 5,
  maxTps: 16,
  pointsPerFood: 10,
  maxQueuedDirections: 2,
  canvasWidth: 256,
  canvasHeight: 224,
  highScoreStorageKey: 'room-arcade-snake-highscore',
  colors: {
    bg: '#06090f',
    gridLine: '#111a28',
    topBarBg: '#0c1322',
    snakeHead: '#86efac',
    snakeBody: '#22c55e',
    food: '#ef4444',
    foodAlt: '#fca5a5',
    titleNeon: '#4ade80',
    accentCyan: '#22d3ee',
    text: '#f8fafc',
    muted: '#94a3b8',
    gameOver: '#f43f5e',
  },
} as const;

export const CURTAINS_CONFIG = {
  // Mounted on existing North Wall fake window ([-2.25, 1.95, -4.98], w=1.8, h=1.2)
  windowCenterX: -2.25,
  windowWallZ: -4.98,
  drapeWidth: 0.7,
  drapeTopY: 3.35, // 0.15m below 3.5m ceiling
  drapeBottomY: 0.1, // 0.10m above y=0 floor
  drapeOffsetsX: [-0.93, 0.93] as readonly [number, number],
  drapeZ: -4.88,
  pleatAmplitude: 0.035,
  pleatFolds: 7,
  highSegments: [12, 24] as readonly [number, number],
  lowSegments: [6, 12] as readonly [number, number],
  rodRadius: 0.012,
  rodWidth: 2.62,
  rodY: 3.365,
  rodZ: -4.88,
  rodColor: '#262932',
  ringCountPerSide: 7,
  colors: {
    day: '#c9b8a0',
    night: '#3a3550',
  },
} as const;

export const CENTER_RUG_CONFIG = {
  // Placed parallel to walls in largest free East-Center floor rectangle [0.28..4.98] x [-2.75..1.65]
  // Occupies x in [0.90, 3.20] and z in [-2.25, 1.15] -> >= 0.50m clear of Sofa, Gaming Desk, Gym Mat & Arcade
  position: [2.05, 0.006, -0.55] as [number, number, number],
  width: 2.3, // along X
  length: 3.4, // along Z
  thickness: 0.012,
  textureWidth: 1024,
  textureHeight: 704,
  colors: {
    baseNavy: '#1c2340',
    sand: '#c9a574',
    sandLight: '#dec298',
    mutedRed: '#9b3d3d',
    fringe: '#d8ccb8',
  },
} as const;

export const SIDE_TABLE_CONFIG = {
  // Next to the Arcade cabinet along East Wall beneath Acoustic Slat Panel (x in [4.36, 4.92], z in [-1.18, -0.62])
  // Leaves 0.41m clearance from Arcade (z = -1.59) and 1.16m walkway clearance from Center Rug (x = 3.20)
  position: [4.64, 0.0, -0.9] as [number, number, number],
  topRadius: 0.28,
  height: 0.55,
  walnutColor: '#3a2a20',
  bookSpines: ['#233554', '#6b2737', '#264d3b', '#b58b2a'] as readonly [
    string,
    string,
    string,
    string,
  ],
  pageColor: '#e6dfd0',
  mugColor: '#ece7dd',
  coffeeColor: '#21130b',
  steamCheckHz: 4,
  steamCullDistSq: 36, // 6m^2
} as const;

export const STEP5_COLLIDERS = [
  {
    id: 'arcade-cabinet',
    min: [
      ARCADE_CONFIG.position[0] - ARCADE_CONFIG.depth / 2,
      0.0,
      ARCADE_CONFIG.position[2] - ARCADE_CONFIG.width / 2,
    ] as [number, number, number],
    max: [
      ARCADE_CONFIG.position[0] + ARCADE_CONFIG.depth / 2,
      ARCADE_CONFIG.height,
      ARCADE_CONFIG.position[2] + ARCADE_CONFIG.width / 2,
    ] as [number, number, number],
  },
  {
    id: 'step5-side-table',
    min: [
      SIDE_TABLE_CONFIG.position[0] - SIDE_TABLE_CONFIG.topRadius,
      0.0,
      SIDE_TABLE_CONFIG.position[2] - SIDE_TABLE_CONFIG.topRadius,
    ] as [number, number, number],
    max: [
      SIDE_TABLE_CONFIG.position[0] + SIDE_TABLE_CONFIG.topRadius,
      SIDE_TABLE_CONFIG.height + 0.25,
      SIDE_TABLE_CONFIG.position[2] + SIDE_TABLE_CONFIG.topRadius,
    ] as [number, number, number],
  },
  {
    id: 'window-curtains',
    min: [-3.56, 0.0, -5.0] as [number, number, number],
    max: [-0.94, 3.4, -4.83] as [number, number, number],
  },
] as const;

export const GAMING_ROOM_CONFIG = {
  defaultTheme: 'night' as RoomTheme,
  posterTheme: 'night' as RoomTheme,
  accentWall: {
    day: '#3a3b44',
    night: '#212531',
    roughness: 0.9,
    metalness: 0.04,
  },
  hexCount: 28,
  rgbStrip: {
    speed: 0.14,
    dayIntensity: 0.35,
    nightIntensity: 1.0,
    thickness: 0.02,
    baseboardTopY: 0.10,
    consoleUndersideY: 0.148,
    sofaUndersideY: 0.102,
    diagonalBarCount: 3,
    diagonalBarLength: 1.0,
    diagonalBarWidth: 0.032,
  },
  gameTitles: [
    { title: 'NEON RUNNER', tag: 'SCI-FI', bg: '#0f172a', accent: '#22d3ee' },
    { title: 'PIXEL KNIGHT', tag: 'QUEST', bg: '#1f102e', accent: '#f43f5e' },
    { title: 'DEPTH 9', tag: 'SURVIVAL', bg: '#0b2229', accent: '#38bdf8' },
    { title: 'ORBIT RACE', tag: 'ARCADE', bg: '#1e1b4b', accent: '#fb923c' },
    { title: 'SIGNAL LOST', tag: 'MYSTERY', bg: '#111827', accent: '#a855f7' },
    { title: 'VOID DRIFT', tag: 'RACING', bg: '#170f23', accent: '#ec4899' },
    { title: 'CYBERPULSE', tag: 'ACTION', bg: '#081b26', accent: '#2dd4bf' },
    { title: 'STAR FORGE', tag: 'SANDBOX', bg: '#1c150c', accent: '#f59e0b' },
    { title: 'GRID ECHO', tag: 'PUZZLE', bg: '#091f1a', accent: '#4ade80' },
    { title: 'HYPER DASH', tag: 'SPEED', bg: '#260d18', accent: '#fb7185' },
    { title: 'CORE BREACH', tag: 'MECH', bg: '#161b26', accent: '#60a5fa' },
    { title: 'SOLAR WIND', tag: 'ADVENTURE', bg: '#1e180b', accent: '#facc15' },
    { title: 'SKY VAULT', tag: 'CO-OP', bg: '#0d1e2b', accent: '#67e8f9' },
    { title: 'NIGHT SHIFT', tag: 'STEALTH', bg: '#141320', accent: '#c084fc' },
    { title: 'CHRONO BIT', tag: 'RETRO', bg: '#191429', accent: '#34d399' },
    { title: 'ZERO VECTOR', tag: 'ARENA', bg: '#1f1116', accent: '#f87171' },
  ] as const,
  cartridgeTitles: [
    'PIXEL QUEST',
    'TURBO BIT',
    'COSMO HOP',
    'DUNE RACE',
    'STAR BIT',
  ] as const,
  gameCollectionShelf: {
    position: [2.65, 0.0, 4.98] as [number, number, number],
    rotationY: Math.PI,
    width: 1.8,
    depth: 0.2,
    thickness: 0.03,
    shelfYs: [1.48, 1.9, 2.32] as readonly [number, number, number],
    oakColor: '#b08a5e',
  },
  controllerWallDisplay: {
    position: [4.98, 2.08, 3.75] as [number, number, number],
    rotationY: -Math.PI / 2,
    width: 1.6,
    height: 0.5,
  },
  postersCluster: {
    position: [-4.98, 2.18, -3.78] as [number, number, number],
    rotationY: Math.PI / 2,
  },
  neonSigns: {
    levelUp: {
      text: 'LEVEL UP',
      position: [4.25, 2.15, 4.98] as [number, number, number],
      rotationY: Math.PI,
      width: 0.92,
      height: 0.4,
    },
    controllerIcon: {
      position: [-4.4, 2.15, 4.98] as [number, number, number],
      rotationY: Math.PI,
      width: 0.78,
      height: 0.44,
    },
  },
  highScoreBoard: {
    position: [4.98, 2.14, -2.0] as [number, number, number],
    rotationY: -Math.PI / 2,
    width: 0.86,
    height: 0.29,
    cullDistSq: 64,
    labelName: 'RAI',
    highScoreKey: SNAKE_CONFIG.highScoreStorageKey,
  },
  beanBag: {
    position: [4.25, 0.0, 0.55] as [number, number, number],
    rotationY: -Math.PI * 0.62,
    radius: 0.4,
    height: 0.54,
    color: '#262b38',
    seamColor: '#38bdf8',
    camPosition: [3.95, 0.82, 0.42] as [number, number, number],
    camLookAt: [-4.6, 1.55, 0.0] as [number, number, number],
    interactDistance: 2.5,
  },
} as const;

export const STEP6_COLLIDERS = [
  {
    id: 'bean-bag',
    min: [3.85, 0.0, 0.15] as [number, number, number],
    max: [4.65, 0.6, 0.95] as [number, number, number],
  },
] as const;
