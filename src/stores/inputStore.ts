'use client';

import { create } from 'zustand';

export type InputMode = 'menu' | 'walking' | 'paused' | 'focus';

export type ActiveFocusKind =
  | 'tv'
  | 'sofa'
  | 'gramophone'
  | 'pc'
  | 'gaming-chair'
  | 'certificate'
  | 'achievements'
  | 'phone'
  | 'resume'
  | 'arcade'
  | 'beanbag'
  | 'robot'
  | 'gym';

// Synchronous flag so PointerLockControls unlock events caused by our own exitPointerLock()
// while entering focus are ignored cleanly without React state races.
let _expectedUnlock = false;

export function setExpectedUnlock(expected: boolean): void {
  _expectedUnlock = expected;
}

export function consumeExpectedUnlock(): boolean {
  if (_expectedUnlock) {
    _expectedUnlock = false;
    return true;
  }
  return false;
}

interface InputState {
  mode: InputMode;
  focusKind: ActiveFocusKind | null;
  focusExiting: boolean;

  onPointerLocked: () => void;
  onPointerUnlocked: () => void;
  enterMenu: () => void;
  enterPaused: () => void;
  beginFocus: (kind: ActiveFocusKind) => void;
  beginExitFocus: () => void;
  finishExitFocus: (targetMode: 'walking' | 'paused') => void;
}

export const useInputStore = create<InputState>((set, get) => ({
  mode: 'menu',
  focusKind: null,
  focusExiting: false,

  onPointerLocked: () => {
    const { mode, focusExiting } = get();
    // During an exit-to-walking transition, keep focusExiting until camera glide completes
    if (mode === 'focus' && focusExiting) {
      return;
    }
    set({ mode: 'walking', focusKind: null, focusExiting: false });
  },

  onPointerUnlocked: () => {
    if (consumeExpectedUnlock()) {
      return;
    }
    const { mode } = get();
    // Only transition walking -> paused when pointer lock is lost unexpectedly (e.g. browser Esc)
    if (mode === 'walking') {
      set({ mode: 'paused' });
    }
  },

  enterMenu: () => set({ mode: 'menu', focusKind: null, focusExiting: false }),

  enterPaused: () => set({ mode: 'paused', focusKind: null, focusExiting: false }),

  beginFocus: (kind) =>
    set({
      mode: 'focus',
      focusKind: kind,
      focusExiting: false,
    }),

  beginExitFocus: () =>
    set((s) => (s.mode === 'focus' ? { focusExiting: true } : s)),

  finishExitFocus: (targetMode) =>
    set({
      mode: targetMode,
      focusKind: null,
      focusExiting: false,
    }),
}));
