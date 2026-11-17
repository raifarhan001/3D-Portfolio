'use client';

import { create } from 'zustand';
import type { QuadPoints } from '@/utils/homography';

export type PCBootState = 'off' | 'booting' | 'desktop';

interface PCState {
  poweredPC: boolean;
  bootState: PCBootState;
  bootNonce: number;
  hasPoweredOnce: boolean;
  pcMode: boolean;
  pcArrived: boolean;
  chairSeated: boolean;
  pcExiting: boolean;
  screenCorners: QuadPoints | null;

  powerOnPC: () => void;
  powerOffPC: () => void;
  togglePCPower: () => void;
  restartPC: () => void;
  setBootState: (state: PCBootState) => void;
  setPcMode: (v: boolean) => void;
  setPcArrived: (v: boolean) => void;
  setChairSeated: (v: boolean) => void;
  setPcExiting: (v: boolean) => void;
  setScreenCorners: (corners: QuadPoints | null) => void;
}

export const usePcStore = create<PCState>((set) => ({
  poweredPC: false,
  bootState: 'off',
  bootNonce: 0,
  hasPoweredOnce: false,
  pcMode: false,
  pcArrived: false,
  chairSeated: false,
  pcExiting: false,
  screenCorners: null,

  powerOnPC: () =>
    set((s) => ({
      poweredPC: true,
      hasPoweredOnce: true,
      bootState: 'booting',
      bootNonce: s.bootNonce + 1,
    })),

  powerOffPC: () =>
    set({
      poweredPC: false,
      bootState: 'off',
      pcArrived: false,
    }),

  togglePCPower: () =>
    set((s) =>
      s.poweredPC
        ? {
            poweredPC: false,
            bootState: 'off',
            pcArrived: false,
          }
        : {
            poweredPC: true,
            hasPoweredOnce: true,
            bootState: 'booting',
            bootNonce: s.bootNonce + 1,
          }
    ),

  restartPC: () =>
    set((s) => ({
      poweredPC: true,
      hasPoweredOnce: true,
      bootState: 'booting',
      bootNonce: s.bootNonce + 1,
    })),

  setBootState: (bootState) => set({ bootState }),

  setPcMode: (pcMode) =>
    set((s) => ({
      pcMode,
      pcArrived: pcMode ? s.pcArrived : false,
      screenCorners: pcMode ? s.screenCorners : null,
    })),

  setPcArrived: (pcArrived) => set({ pcArrived }),
  setChairSeated: (chairSeated) => set({ chairSeated }),
  setPcExiting: (pcExiting) => set({ pcExiting }),
  setScreenCorners: (screenCorners) => set({ screenCorners }),
}));
