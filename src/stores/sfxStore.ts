'use client';

import { create } from 'zustand';
import { SFX_CONFIG } from '@/config/themeConfig';

function loadMuted(): boolean {
  if (typeof window === 'undefined') return SFX_CONFIG.defaultMuted;
  try {
    const raw = window.localStorage.getItem(SFX_CONFIG.storageKey);
    if (raw === 'true') return true;
    if (raw === 'false') return false;
  } catch {
    // ignore storage errors
  }
  return SFX_CONFIG.defaultMuted;
}

function saveMuted(muted: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SFX_CONFIG.storageKey, muted ? 'true' : 'false');
  } catch {
    // ignore storage errors
  }
}

interface SfxState {
  muted: boolean;
  hydrated: boolean;
  hydrate: () => void;
  setMuted: (muted: boolean) => void;
  toggleMute: () => boolean;
}

export const useSfxStore = create<SfxState>((set, get) => ({
  muted: SFX_CONFIG.defaultMuted,
  hydrated: false,

  hydrate: () => {
    if (get().hydrated) return;
    set({
      muted: loadMuted(),
      hydrated: true,
    });
  },

  setMuted: (muted) => {
    saveMuted(muted);
    set({ muted });
  },

  toggleMute: () => {
    const next = !get().muted;
    saveMuted(next);
    set({ muted: next });
    return next;
  },
}));
