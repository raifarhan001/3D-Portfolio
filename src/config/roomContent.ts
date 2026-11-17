import { gamingCornerLocalToWorld, GAMING_CORNER_CONFIG } from '@/config/roomConfig';
import { IDENTITY_CONFIG } from '@/config/identityConfig';

export interface CertificateEntry {
  id: string;
  title: string;
  issuer: string;
  date: string;
  url: string;
  description: string;
  kind: 'image' | 'pdf';
  imageUrl: string;
  pdfUrl?: string;
}

export interface ShelfBookConfig {
  id: string;
  title: string;
  color: string;
  height: number;
  thickness: number;
  depth: number;
  tiltZ: number;
}

export interface StackedBookConfig {
  id: string;
  title: string;
  showSpineLabel: boolean;
  color: string;
  width: number;
  thickness: number;
  depth: number;
  offsetX: number;
  offsetZ: number;
  rotY: number;
}

export interface AchievementEntry {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  accentColor: string;
  secondaryColor: string;
  iconKind: 'shark' | 'pair';
  url: string;
}

export type WallItemKey =
  | 'certificatesShelf'
  | 'achievements'
  | 'phone'
  | 'controllerResume'
  | 'galleryWall'
  | 'neonSign'
  | 'fakeWindow'
  | 'wallClock'
  | 'acousticSlatPanel'
  | 'plants'
  | 'floorLamp'
  | 'worldMapPoster';

export type GraphicsQuality = 'high' | 'low';

function encodePublicPath(filePath: string): string {
  return (
    '/' +
    filePath
      .split('/')
      .filter(Boolean)
      .map((seg) => encodeURIComponent(seg))
      .join('/')
  );
}

export const ROOM_CONTENT_CONFIG = {
  /**
   * 3 verified certificates rendered from /public assets (no placeholders).
   */
  certificates: [
    {
      id: 'anthropic-ai-fluency',
      title: 'AI Fluency: Framework & Foundations',
      issuer: 'Anthropic · Claude Academy',
      date: 'August 22, 2026',
      url: '',
      description: 'Certificate of completion for the AI Fluency: Framework & Foundations curriculum.',
      kind: 'image',
      imageUrl: encodePublicPath('anthropic ai fluency framework & foundations Certificate.png'),
    },
    {
      id: 'aws-gen-ai',
      title: 'Introduction to Generative AI - Art of the Possible',
      issuer: 'AWS Training & Certification',
      date: 'June 28, 2026',
      url: '',
      description: 'AWS Training & Certification completion certificate on generative AI foundations and use cases.',
      kind: 'pdf',
      imageUrl: encodePublicPath('certificates/thumbs/aws-gen-ai.webp'),
      pdfUrl: encodePublicPath('AWS Gen AI.pdf'),
    },
    {
      id: 'aws-training-certificate',
      title: 'Foundations of Prompt Engineering',
      issuer: 'AWS Training & Certification',
      date: 'June 28, 2026',
      url: '',
      description: 'AWS Training & Certification completion certificate covering prompt design and engineering techniques.',
      kind: 'pdf',
      imageUrl: encodePublicPath('certificates/thumbs/aws-training-certificate.webp'),
      pdfUrl: encodePublicPath('AWS Training Certificate.pdf'),
    },
  ] as ReadonlyArray<CertificateEntry>,

  shelfFrameTotal: 3,
  shelfUpperCount: 3,

  achievements: [
    {
      id: 'pull-shark',
      title: 'Pull Shark',
      subtitle: 'GitHub Achievement',
      description: 'Awarded for merged pull requests across GitHub repositories.',
      accentColor: '#0ea5e9',
      secondaryColor: '#22d3ee',
      iconKind: 'shark',
      url: 'https://github.com/RaiFarhan0?tab=achievements',
    },
    {
      id: 'pair-extraordinaire',
      title: 'Pair Extraordinaire',
      subtitle: 'GitHub Achievement',
      description: 'Awarded for co-authored commits merged through collaborative pull requests.',
      accentColor: '#8b5cf6',
      secondaryColor: '#f59e0b',
      iconKind: 'pair',
      url: 'https://github.com/RaiFarhan0?tab=achievements',
    },
  ] as ReadonlyArray<AchievementEntry>,

  achievementsUrl: 'https://github.com/RaiFarhan0?tab=achievements',

  neonText: 'BUILD IT.',
  neonColor: '#38bdf8',

  wallItemsEnabled: {
    certificatesShelf: true,
    achievements: true,
    phone: true,
    controllerResume: true,
    galleryWall: true,
    neonSign: true,
    fakeWindow: true,
    wallClock: true,
    acousticSlatPanel: true,
    plants: true,
    floorLamp: true,
    worldMapPoster: true,
  } as Record<WallItemKey, boolean>,

  /**
   * Phone placement: free front-left top of the gaming desk (clear of headset stand and mousepad).
   */
  phone: {
    placement: 'gaming-desk-left' as const,
    localPosition: [0.34, GAMING_CORNER_CONFIG.deskHeight, 0.54] as [number, number, number],
    localRotationY: 0.34,
    camDistance: 0.42,
    camMoveTime: 0.75,
    interactDistance: 2.5,
    pulsePeriodSeconds: 6.0,
    notificationSender: IDENTITY_CONFIG.displayName,
    notificationText: "Let's build something together.",
  },

  /**
   * Resume controller placement: front-right edge of the gaming desk, scaled 1.4x.
   */
  controllerResume: {
    localPosition: [1.76, GAMING_CORNER_CONFIG.deskHeight, 0.72] as [number, number, number],
    localRotationY: -0.3,
    scale: 1.4,
    camDistance: 0.52,
    camMoveTime: 0.75,
    interactDistance: 2.5,
  },

  /**
   * Wall & floor item placements verified from Step 0 Audit (all >= 0.4m from furniture, flush 0.02m off wall).
   */
  placements: {
    certificatesShelf: {
      // North Wall (z = -5.0), x in [0.95, 2.55], clear of Gaming Wall B shelf (x >= 3.30)
      position: [1.75, 0, -4.98] as [number, number, number],
      rotationY: 0,
      width: 1.6,
      thickness: 0.03,
      depth: 0.18,
      oakColor: '#b08a5e',
      upperY: 1.78,
      lowerY: 1.25,
      camDistance: 1.1,
      camMoveTime: 0.7,
      interactDistance: 2.5,
    },
    fakeWindow: {
      // North Wall (largest empty wall), x in [-3.15, -1.35]
      position: [-2.25, 1.95, -4.98] as [number, number, number],
      rotationY: 0,
      width: 1.8,
      height: 1.2,
    },
    worldMapPoster: {
      // North Wall between Fake Window (-1.35) and Certificates Shelf (+0.95)
      position: [-0.2, 1.95, -4.98] as [number, number, number],
      rotationY: 0,
      width: 0.82,
      height: 0.54,
    },
    acousticSlatPanel: {
      // East Wall (x = +5.0), aligned with sofa z in [-1.55, +0.85], clear of desk (-2.75) & treadmill (+1.82)
      position: [4.98, 1.75, -0.35] as [number, number, number],
      rotationY: -Math.PI / 2,
      width: 2.4,
      height: 1.0,
      depth: 0.035,
      ledColor: '#ffd9a8',
    },
    galleryWall: {
      // South Wall (z = +5.0), x in [-2.88, -1.02], facing -Z
      position: [-1.95, 1.85, 4.98] as [number, number, number],
      rotationY: Math.PI,
    },
    neonSign: {
      // South Wall (z = +5.0), x in [-0.48, +0.98], height 2.2m, facing -Z
      position: [0.25, 2.2, 4.98] as [number, number, number],
      rotationY: Math.PI,
      width: 1.46,
      height: 0.44,
    },
    wallClock: {
      // West Wall (x = -5.0), z in [+3.16, +3.60], between Media Wall (+2.60) & Mini-Fridge (+4.16)
      position: [-4.98, 1.95, 3.38] as [number, number, number],
      rotationY: Math.PI / 2,
      radius: 0.22,
    },
    plants: {
      floorPlantPosition: [1.05, 0.0, 4.6] as [number, number, number],
      shelfPlantPosition: [2.05, 1.265, -4.89] as [number, number, number],
      deskPlantWorldPosition: gamingCornerLocalToWorld(
        0.18,
        GAMING_CORNER_CONFIG.deskHeight,
        0.18
      ),
    },
    floorLamp: {
      position: [-3.6, 0.0, 4.58] as [number, number, number],
      rotationY: 0.45,
      shadeEmissiveColor: '#ffdfba',
    },
  },

  qualityBehavior: {
    defaultQuality: 'high' as GraphicsQuality,
    lowHiddenItems: ['plants', 'neonSign', 'galleryWall', 'floorLamp'] as ReadonlyArray<WallItemKey>,
  },
} as const;

export function isWallItemVisible(_key?: WallItemKey, _quality?: GraphicsQuality): boolean {
  return true;
}

export const SHELF_BOOKS_CONFIG = {
  upperLayout: {
    frameWidth: 0.26,
    frameHeight: 0.2,
    frameDepth: 0.018,
    cardWidth: 0.214,
    cardHeight: 0.158,
    frameDx: [-0.6, -0.22, 0.16] as readonly [number, number, number],
    figureDx: 0.39,
    plaqueDx: [0.57, 0.71] as readonly [number, number],
  },
  lowerLayout: {
    standingStartX: -0.75,
    bookendX: -0.185,
    bookendColor: '#2a2d36',
    trophyX: 0.02, // Shifted right of bookend so standing books never collide; keeps clear of WallDecor plant at +0.30
    stackCenterX: 0.58,
    pageEdgeColor: '#ebe3cf',
    pageTopColor: '#cdc3ac',
    mugColor: '#ece7dd',
    coffeeColor: '#261710',
  },
  standingBooks: [
    { id: 'book-pytorch', title: 'PYTORCH', color: '#7c2d3b', height: 0.255, thickness: 0.036, depth: 0.168, tiltZ: 0 },
    { id: 'book-opencv', title: 'OPENCV', color: '#1e3a5f', height: 0.235, thickness: 0.032, depth: 0.16, tiltZ: 0 },
    { id: 'book-fastapi', title: 'FASTAPI', color: '#0f6266', height: 0.22, thickness: 0.028, depth: 0.156, tiltZ: 0 },
    { id: 'book-python', title: 'PYTHON', color: '#c7922b', height: 0.265, thickness: 0.042, depth: 0.172, tiltZ: 0 },
    { id: 'book-algorithms', title: 'ALGORITHMS', color: '#2b303b', height: 0.245, thickness: 0.038, depth: 0.166, tiltZ: 0 },
    { id: 'book-statistics', title: 'STATISTICS', color: '#28543c', height: 0.21, thickness: 0.03, depth: 0.154, tiltZ: 0 },
    { id: 'book-linear-algebra', title: 'LINEAR ALGEBRA', color: '#dfd4be', height: 0.25, thickness: 0.044, depth: 0.17, tiltZ: 0 },
    { id: 'book-nextjs', title: 'NEXT.JS', color: '#232730', height: 0.195, thickness: 0.024, depth: 0.152, tiltZ: 0 },
    { id: 'book-docker', title: 'DOCKER', color: '#254b75', height: 0.225, thickness: 0.034, depth: 0.162, tiltZ: -0.15 },
    { id: 'book-git', title: 'GIT', color: '#8b3a2b', height: 0.205, thickness: 0.026, depth: 0.154, tiltZ: -0.1 },
    { id: 'book-mediapipe', title: 'MEDIAPIPE', color: '#185c52', height: 0.238, thickness: 0.034, depth: 0.164, tiltZ: -0.05 },
  ] as ReadonlyArray<ShelfBookConfig>,
  stackedBooks: [
    { id: 'book-stack-cv', title: 'COMPUTER VISION', showSpineLabel: true, color: '#2b303b', width: 0.235, thickness: 0.034, depth: 0.162, offsetX: -0.008, offsetZ: 0.002, rotY: 0.07 },
    { id: 'book-stack-plain-1', title: '', showSpineLabel: false, color: '#7c2d3b', width: 0.215, thickness: 0.028, depth: 0.156, offsetX: 0.01, offsetZ: 0.004, rotY: -0.08 },
    { id: 'book-stack-ml', title: 'ML SYSTEMS', showSpineLabel: true, color: '#1e3a5f', width: 0.205, thickness: 0.03, depth: 0.152, offsetX: -0.005, offsetZ: -0.004, rotY: 0.09 },
    { id: 'book-stack-plain-2', title: '', showSpineLabel: false, color: '#28543c', width: 0.185, thickness: 0.024, depth: 0.144, offsetX: 0.006, offsetZ: 0.001, rotY: -0.06 },
  ] as ReadonlyArray<StackedBookConfig>,
} as const;

export function getCertificateByIndex(index: number): CertificateEntry {
  const list = ROOM_CONTENT_CONFIG.certificates;
  const clamped = Math.max(0, Math.min(list.length - 1, index));
  return list[clamped];
}
