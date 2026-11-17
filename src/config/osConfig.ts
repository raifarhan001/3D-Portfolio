import { IDENTITY_CONFIG } from '@/config/identityConfig';

export interface ExtraProjectConfig {
  id: string;
  name: string;
  description: string;
  liveUrl: string;
  tags: string[];
}

export interface RecycleBinFileConfig {
  id: string;
  name: string;
  size: string;
  type: string;
  kind: 'text' | 'archive' | 'video';
}

export const OS_CONFIG = {
  osName: 'Rai XP',
  userDisplayName: IDENTITY_CONFIG.displayName,
  computerName: 'RAI-WORKSTATION',
  versionLabel: 'Rai XP Professional (Version 2026)',

  desktopVirtualSize: {
    width: 1280,
    height: 540,
  },

  /** Canvas 3D monitor texture size (21:9 ultrawide) */
  monitorCanvasSize: {
    width: 1920,
    height: 810,
  },

  /** Boot stages in seconds: black lead-in, 3-block logo progress bar (3s), Welcome screen (1.2s) */
  bootDuration: {
    blackLead: 0.25,
    logoBar: 3.0,
    welcome: 1.2,
    total: 4.45,
  },

  colors: {
    titleActiveStart: '#0058e6',
    titleActiveEnd: '#3a93ff',
    titleInactive: '#7a96df',
    windowBody: '#ece9d8',
    windowBorder: '#0831d9',
    taskbarStart: '#245edb',
    taskbarEnd: '#3f8cf3',
    taskbarTopEdge: '#66a5f8',
    selectedBg: '#316ac5',
    selectedText: '#ffffff',
    startBtnStart: '#3d9d3d',
    startBtnEnd: '#287728',
    taskPaneBgTop: '#7ba2e7',
    taskPaneBgBottom: '#6375d6',
    taskCardBg: '#d6dff7',
    taskHeaderBgStart: '#ffffff',
    taskHeaderBgEnd: '#c6d3f7',
    taskLinkText: '#215dc6',
  },

  fonts: {
    ui: 'Tahoma, Verdana, "Segoe UI", sans-serif',
    title: '"Trebuchet MS", Tahoma, Verdana, sans-serif',
    mono: 'Consolas, "Courier New", monospace',
    minSizePx: 12,
  },

  contact: {
    email: 'raifarhan003@gmail.com',
    github: 'https://github.com/RaiFarhan0',
    linkedin: 'https://linkedin.com/in/rai-farhan',
    fiverr: 'https://www.fiverr.com/rai_farhan',
  },

  resumeUrl: '/Rai_Farhan_CV.pdf',

  skills: {
    languages: ['Python', 'C++', 'JavaScript', 'TypeScript'],
    aiMl: [
      'PyTorch',
      'OpenCV',
      'NumPy',
      'Pandas',
      'scikit-learn',
      'MediaPipe',
      'ONNX Runtime',
      'TensorFlow Lite',
    ],
    appEng: [
      'FastAPI',
      'Flask',
      'React',
      'Node.js',
      'Next.js',
      'Docker',
      'Git',
      'GitHub',
      'VS Code',
    ],
  },

  excludeRepos: ['RaiFarhan0'],

  pinnedOrder: [
    'Detect-Deepfakes-from-Facial-Blood-Flow',
    'VoicePulse-AI',
    'DocuPulse-AI',
    'DataPulse-AI',
    'SignAi',
    'Email-Assistant',
    'Text-to-Hand-Written',
  ],

  extraProjects: [
    {
      id: 'NightCast',
      name: 'NightCast',
      description: 'Cinematic streaming discovery app',
      liveUrl: 'https://night-cast.vercel.app/',
      tags: [],
    },
  ] satisfies ExtraProjectConfig[],

  recycleBinFiles: [
    {
      id: 'bugs_final_FINAL.txt',
      name: 'bugs_final_FINAL.txt',
      size: '42 KB',
      type: 'Text Document',
      kind: 'text',
    },
    {
      id: 'old_portfolio_v1.zip',
      name: 'old_portfolio_v1.zip',
      size: '18.4 MB',
      type: 'Compressed (zipped) Folder',
      kind: 'archive',
    },
    {
      id: 'tutorial_hell.mp4',
      name: 'tutorial_hell.mp4',
      size: '404 MB',
      type: 'Media Clip',
      kind: 'video',
    },
    {
      id: 'TODO_someday.md',
      name: 'TODO_someday.md',
      size: '1 KB',
      type: 'Markdown File',
      kind: 'text',
    },
  ] satisfies RecycleBinFileConfig[],

  jokes: {
    'bugs_final_FINAL.txt':
      'Cannot open bugs_final_FINAL.txt: 99 bugs fixed, 127 new ones appeared on line 1.',
    'old_portfolio_v1.zip':
      'Archive corrupted: contains 43 unused animations and a 12 MB hero GIF from 2022.',
    'tutorial_hell.mp4':
      'Codec error 0x80040265: Video only shows "npm create next-app" on an infinite loop.',
    'TODO_someday.md':
      'Access denied: Rai promised he would clean up those TODOs right after deploying.',
    default: 'Cannot read file: This item was moved to Recycle Bin for everyone’s safety.',
  } as Record<string, string>,

  aboutFallback: {
    name: 'Rai Farhan',
    role: 'AI/ML Engineer',
    based_in: 'Pakistan',
    interests: ['Computer Vision', 'Deep Learning', 'AI Agents', 'Audio Intelligence'],
    mindset: 'Build and iterate',
    bigPicture:
      "I'm Rai Farhan, an AI/ML developer interested in building intelligent systems that connect machine learning research with practical software engineering. From visual perception to speech pipelines and tool-using AI agents, I enjoy working on the entire process: understanding the problem, experimenting with models, engineering the pipeline, and turning it into something usable.",
    exploring: [
      'LOCAL-FIRST AI — Running useful models with fewer cloud dependencies.',
      'VISION SYSTEMS — Making visual information actionable.',
      'AGENTIC SOFTWARE — Connecting models with tools and workflows.',
      'AUDIO PIPELINES — Speech processing from input to output.',
    ],
  },
} as const;
