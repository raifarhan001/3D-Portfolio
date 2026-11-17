'use client';

import { create } from 'zustand';
import { loadSnakeHighScore } from '@/games/snake';
import type { SnakeDirection, SnakeGameStatus } from '@/games/snake';

interface ArcadeRuntimeHandlers {
  startOrRestart: () => void;
  enqueueDirection: (dir: SnakeDirection) => void;
}

interface ArcadeState {
  status: SnakeGameStatus;
  score: number;
  highScore: number;
  hydrated: boolean;
  handlers: ArcadeRuntimeHandlers | null;

  hydrate: () => void;
  setSnapshot: (status: SnakeGameStatus, score: number, highScore: number) => void;
  registerHandlers: (handlers: ArcadeRuntimeHandlers | null) => void;
}

export const useArcadeStore = create<ArcadeState>((set, get) => ({
  status: 'idle',
  score: 0,
  highScore: 0,
  hydrated: false,
  handlers: null,

  hydrate: () => {
    if (get().hydrated) return;
    set({
      highScore: loadSnakeHighScore(),
      hydrated: true,
    });
  },

  setSnapshot: (status, score, highScore) =>
    set((s) =>
      s.status === status && s.score === score && s.highScore === highScore
        ? s
        : { status, score, highScore }
    ),

  registerHandlers: (handlers) => set({ handlers }),
}));
