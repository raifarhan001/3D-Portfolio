export type RobotStationId =
  | 'dock'
  | 'center'
  | 'tv'
  | 'sofa'
  | 'gramophone'
  | 'certificates'
  | 'pc'
  | 'arcade'
  | 'gym';

export type RobotActionType =
  | 'set_theme'
  | 'toggle_theme'
  | 'set_tv_power'
  | 'set_tv_source'
  | 'play_tv_song'
  | 'focus_tv'
  | 'power_pc'
  | 'open_pc_window'
  | 'play_music'
  | 'pause_music'
  | 'set_music_volume'
  | 'set_sfx_muted'
  | 'show_certificates'
  | 'show_achievements'
  | 'show_phone'
  | 'walk_to'
  | 'set_mode'
  | 'start_tour'
  | 'wave';

export interface RobotActionSpec {
  type: RobotActionType;
  value?: string;
  trackId?: string;
  station?: RobotStationId;
}

export interface RobotStationSpec {
  id: RobotStationId;
  label: string;
  position: readonly [number, number]; // [x, z]
  faceAt: readonly [number, number]; // [lookX, lookZ]
  tourLineEn: string;
  tourLineUr: string;
}

export const ROBOT_STATIONS: Record<RobotStationId, RobotStationSpec> = {
  dock: {
    id: 'dock',
    label: 'Entrance Dock',
    position: [-0.95, 2.35],
    faceAt: [0.0, 4.0],
    tourLineEn: 'Welcome to Rai Farhan’s 3D studio. I’m ELSA... your charming little guide with a mind of her own.',
    tourLineUr: 'Rai Farhan ke 3D room mein khush aamdeed! Main ELSA hoon... zara sambhal ke, main thori naughty hoon.',
  },
  center: {
    id: 'center',
    label: 'Center Lounge',
    position: [1.85, -0.35],
    faceAt: [0.0, 0.0],
    tourLineEn: 'This is the main center lounge, connecting every zone of the room.',
    tourLineUr: 'Yeh room ka center lounge hai jahan se har corner asaani se access hota hai.',
  },
  tv: {
    id: 'tv',
    label: 'Media Wall & Smart TV',
    position: [-3.15, -1.55],
    faceAt: [-4.8, 0.0],
    tourLineEn: 'Here is the 105-inch Smart TV with NightCast movies, YouTube Music streaming, and fullscreen mode.',
    tourLineUr: 'Yeh 105-inch Smart TV hai jis par NightCast movies, YouTube Music aur fullscreen mode sab chalta hai.',
  },
  sofa: {
    id: 'sofa',
    label: 'Sofa Lounge',
    position: [1.1, 0.2],
    faceAt: [-2.0, 0.0],
    tourLineEn: 'Feel free to sit on the sofa (press E) for relaxed head-look viewing.',
    tourLineUr: 'Aap sofa par baith kar E dabaa ke TV aur room enjoy kar sakte hain.',
  },
  gramophone: {
    id: 'gramophone',
    label: 'Vinyl Gramophone',
    position: [-3.15, -3.15],
    faceAt: [-4.38, -4.38],
    tourLineEn: 'Our vintage Gramophone plays timeless classics: Unki Mehfil Main, Kali Kali Zulfon, Saja Hai Maikhana, Un Ka Andaz E Karam, and Rafta Rafta.',
    tourLineUr: 'Yeh vintage Gramophone hai jahan Unki Mehfil Main, Kali Kali Zulfon, Saja Hai Maikhana, Un Ka Andaz E Karam aur Rafta Rafta bajte hain.',
  },
  certificates: {
    id: 'certificates',
    label: 'Certificates & Achievements',
    position: [0.25, -3.65],
    faceAt: [1.75, -4.98],
    tourLineEn: 'Up here are Rai’s Anthropic & AWS certifications alongside GitHub Pull Shark & Pair Extraordinaire plaques.',
    tourLineUr: 'Yahan Rai ke Anthropic aur AWS certificates ke saath GitHub Pull Shark aur Pair Extraordinaire awards hain.',
  },
  pc: {
    id: 'pc',
    label: 'Gaming Corner & Rai XP PC',
    position: [2.25, -2.55],
    faceAt: [4.5, -3.85],
    tourLineEn: 'This workstation runs Rai XP, where you can explore GitHub AI projects, skills, and Rai’s interactive CV.',
    tourLineUr: 'Yeh Rai XP workstation hai jahan aap Rai ke GitHub AI projects, skills aur CV dekh sakte hain.',
  },
  arcade: {
    id: 'arcade',
    label: 'Snake Arcade Cabinet',
    position: [3.25, -1.25],
    faceAt: [4.55, -1.95],
    tourLineEn: 'Want a break? You can play classic Snake right on this arcade cabinet.',
    tourLineUr: 'Thori gaming karni ho to is arcade machine par classic Snake game khel sakte hain.',
  },
  gym: {
    id: 'gym',
    label: 'Fitness Zone',
    position: [2.05, 2.45],
    faceAt: [3.8, 3.3],
    tourLineEn: 'Over here is the fitness area with a treadmill, dumbbells, and workout bench.',
    tourLineUr: 'Is taraf fitness corner hai jahan treadmill, dumbbells aur bench rakhe hain.',
  },
};

export const PATROL_ROUTE: ReadonlyArray<RobotStationId> = [
  'dock',
  'tv',
  'gramophone',
  'certificates',
  'pc',
  'arcade',
  'center',
];

export const TOUR_ROUTE: ReadonlyArray<RobotStationId> = [
  'tv',
  'gramophone',
  'certificates',
  'pc',
  'arcade',
  'dock',
];

export const ROBOT_CONFIG = {
  name: 'ELSA',
  height: 1.62,
  collisionRadius: 0.32,
  navGridSize: 40, // 10m / 40 = 0.25m per cell
  navColliderMargin: 0.34,
  walkSpeed: 1.45,
  followSpeed: 1.75,
  turnSpeed: 6.5,
  followMinDist: 1.55,
  followResumeDist: 2.35,
  patrolPauseMinSec: 3.5,
  patrolPauseMaxSec: 6.5,
  interactDistance: 3.8,
  camDistance: 1.48,
  camEyeHeight: 1.38,
  camTargetHeight: 1.32,
  camMoveTime: 0.65,
  ttsVoiceName: 'Aoede',
  allowedActionTypes: [
    'set_theme',
    'toggle_theme',
    'set_tv_power',
    'set_tv_source',
    'play_tv_song',
    'focus_tv',
    'power_pc',
    'open_pc_window',
    'play_music',
    'pause_music',
    'set_music_volume',
    'set_sfx_muted',
    'show_certificates',
    'show_achievements',
    'show_phone',
    'walk_to',
    'set_mode',
    'start_tour',
    'wave',
  ] as ReadonlyArray<RobotActionType>,
  quickPrompts: [
    { label: 'Lights Night mode', prompt: 'Turn on night mode' },
    { label: 'Play song on TV', prompt: 'Play Starboy on TV' },
    { label: 'Open Rai PC', prompt: 'Turn on the PC and show Rai’s CV' },
    { label: 'Rai’s AI projects?', prompt: 'Tell me about Rai Farhan’s AI projects and skills' },
    { label: 'Room Tour', prompt: 'Give me a tour of the room' },
    { label: 'Come with me', prompt: 'Follow me' },
  ],
} as const;
