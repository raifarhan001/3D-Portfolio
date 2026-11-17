export type WelcomeFeatureIcon = 'tv' | 'pc' | 'certificate' | 'phone';

export type LoadingStageKey = 'github' | 'bundle' | 'textures' | 'shaders' | 'ready';

export type QualityPreference = 'high';

export interface WelcomeSceneSpec {
  id: 'scene-1' | 'scene-2' | 'scene-3';
  src: string;
  alt: string;
  driftClass: string;
}

export interface WelcomeShortcutSpec {
  keys: string;
  action: string;
}

export const WELCOME_CONFIG = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://raifarhan.dev',

  theme: {
    background: '#07080B',
    surface: '#10131C',
    surfaceElevated: '#151925',
    border: 'rgba(255,255,255,0.08)',
    borderStrong: 'rgba(255,255,255,0.16)',
    text: '#F2EDE4',
    muted: '#A59F94',
    accent: '#6C8CFF',
    accentTextOnFill: '#07080B',
    warmHighlight: '#FFB36B',
  },

  cinema: {
    monogram: 'R.',
    palette: {
      ink: '#07080B',
      warmWhite: '#F2EDE4',
      tagline: '#CFC8BB',
      muted: '#A59F94',
      amber: '#FFB36B',
    },
    fonts: {
      display: 'Instrument Serif',
      body: 'Inter Tight',
      mono: 'JetBrains Mono',
    },
    timings: {
      introDurationMs: 3200,
      sceneIntervalMs: 7000,
      sceneFadeMs: 1400,
      parallaxIdleStopMs: 2000,
      enterTextFadeMs: 250,
      enterDollyMs: 600,
    },
    scenes: [
      {
        id: 'scene-1',
        src: '/welcome/scene-1.webp',
        alt: '3D portfolio lounge viewed from the entrance looking toward the RGB backlit TV wall and sofa silhouette',
        driftClass: 'welcome-scene-drift-1',
      },
      {
        id: 'scene-2',
        src: '/welcome/scene-2.webp',
        alt: 'Gaming corner with RGB hexagons, lit monitor setup, and illuminated neon name sign',
        driftClass: 'welcome-scene-drift-2',
      },
      {
        id: 'scene-3',
        src: '/welcome/scene-3.webp',
        alt: 'Arcade Snake cabinet, wall display shelves, and neon signs in warm night ambiance',
        driftClass: 'welcome-scene-drift-3',
      },
    ] as ReadonlyArray<WelcomeSceneSpec>,
    ringText: 'ENTER THE ROOM \u00b7 ENTER THE ROOM \u00b7 ',
    soundHint: 'Sound on recommended',
    unsupportedNote: '3D needs a desktop browser',
    shortcuts: [
      { keys: 'W A S D', action: 'walk' },
      { keys: 'E', action: 'interact' },
      { keys: 'F', action: 'sit' },
      { keys: 'Q', action: 'leave' },
    ] as ReadonlyArray<WelcomeShortcutSpec>,
  },

  seo: {
    title: 'Rai Farhan | AI/ML Engineer',
    quickTitle: 'Quick View — Rai Farhan | AI/ML Engineer',
    ogAlt: 'Rai Farhan interactive 3D AI/ML engineer portfolio room',
    posterUrl: '/welcome/scene-1.webp',
    ogImageUrl: '/welcome-og.jpg',
    ogWidth: 1200,
    ogHeight: 630,
  },

  fallbackName: 'Rai Farhan',
  availability: 'Available for freelance',
  tagline: 'I build AI systems that do more than generate text.',
  roles: ['Computer Vision', 'Machine Learning', 'AI Agents', 'Audio AI'] as ReadonlyArray<string>,

  cta: {
    enterRoom: 'Enter the room',
    loadingPrefix: 'Loading the room',
    quickView: 'Quick view',
    unsupportedNote: '3D needs a desktop browser',
  },

  links: {
    githubLabel: 'GitHub',
    linkedinLabel: 'LinkedIn',
    fiverrLabel: 'Fiverr',
    emailLabel: 'Email',
    resumeLabel: 'Resume',
  },

  qualityLabel: 'Quality',
  qualityOptions: [
    { id: 'high', label: 'High' },
  ] as ReadonlyArray<{ id: QualityPreference; label: string }>,

  loadingStages: {
    github: 'Compiling GitHub data',
    bundle: 'Loading 3D workspace',
    textures: 'Loading textures',
    shaders: 'Warming up shaders',
    ready: 'Room ready',
  } as Record<LoadingStageKey, string>,

  footerCredit: 'Built with Next.js, React Three Fiber and way too many iterations.',

  quickView: {
    enter3dCta: 'Enter the 3D room',
    navAbout: 'About',
    navProjects: 'Projects',
    navCertificates: 'Certificates',
    navContact: 'Contact',
    aboutHeading: 'About',
    bigPictureLabel: 'The big picture',
    exploringLabel: 'Currently exploring',
    profileMetaLabels: {
      role: 'Role',
      basedIn: 'Location',
      mindset: 'Approach',
      interests: 'Focus areas',
    },
    projectsHeading: 'Projects',
    projectsSubheading: 'Open-source systems and shipped applications from GitHub.',
    githubButton: 'GitHub',
    liveButton: 'Live',
    starsLabel: 'Stars',
    updatedLabel: 'Updated',
    featuredBadge: 'Featured App',
    certificatesHeading: 'Certificates & Achievements',
    certificatesSubheading: 'Credentials and verified GitHub milestones.',
    verifyButton: 'Verify',
    viewFileButton: 'View',
    downloadButton: 'Download',
    contactHeading: 'Contact',
    contactSubheading: 'Open for AI/ML engineering, computer vision pipelines, and agentic systems.',
    sendEmailCta: 'Send an email',
    enterRoomBottomCta: 'Explore the 3D room instead',
  },
} as const;
