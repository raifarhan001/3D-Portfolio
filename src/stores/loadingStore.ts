'use client';

import { create } from 'zustand';
import type { LoadingStageKey } from '@/config/welcomeConfig';

export type DetectedGpuTier = 'high' | 'low' | 'unsupported';

interface RoomLoadState {
  started: boolean;
  percent: number;
  stageKey: LoadingStageKey;
  ready: boolean;
  capabilitiesChecked: boolean;
  webglSupported: boolean;
  isMobile: boolean;
  gpuTier: DetectedGpuTier;
  requestEnterLock: (() => void) | null;

  startLoading: () => void;
  setProgress: (percent: number, stageKey: LoadingStageKey) => void;
  setCapabilities: (caps: {
    webglSupported: boolean;
    isMobile: boolean;
    gpuTier: DetectedGpuTier;
  }) => void;
  markReady: () => void;
  registerEnterLock: (fn: (() => void) | null) => void;
}

export const useRoomLoadStore = create<RoomLoadState>((set) => ({
  started: false,
  percent: 0,
  stageKey: 'github',
  ready: false,
  capabilitiesChecked: false,
  webglSupported: true,
  isMobile: false,
  gpuTier: 'high',
  requestEnterLock: null,

  startLoading: () =>
    set((s) => (s.started ? s : { started: true, percent: Math.max(s.percent, 8), stageKey: 'github' })),

  setProgress: (percent, stageKey) =>
    set((s) => {
      if (s.ready) return s;
      const clamped = Math.max(s.percent, Math.min(99, Math.round(percent)));
      return {
        percent: clamped,
        stageKey,
      };
    }),

  setCapabilities: ({ webglSupported, isMobile, gpuTier }) =>
    set({
      capabilitiesChecked: true,
      webglSupported,
      isMobile,
      gpuTier,
    }),

  markReady: () =>
    set({
      started: true,
      percent: 100,
      stageKey: 'ready',
      ready: true,
    }),

  registerEnterLock: (requestEnterLock) => set({ requestEnterLock }),
}));
