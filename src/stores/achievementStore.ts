'use client';

import { create } from 'zustand';
import { playAchievementChime } from '@/utils/sound';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt?: number;
}

export const ACHIEVEMENTS_LIST: Record<string, Omit<Achievement, 'unlockedAt'>> = {
  welcome: {
    id: 'welcome',
    title: 'Welcome to the Studio',
    description: 'Explored Rai Farhan’s 3D AI portfolio room.',
    icon: '🚪',
  },
  vinyl: {
    id: 'vinyl',
    title: 'Vintage Soul',
    description: 'Played a classic cassette on the vinyl gramophone.',
    icon: '📻',
  },
  night: {
    id: 'night',
    title: 'Atmospheric Mood',
    description: 'Toggled room lighting & sunset/night atmosphere.',
    icon: '🌙',
  },
  arcade: {
    id: 'arcade',
    title: 'Arcade Gamer',
    description: 'Stepped up to play the retro Snake machine.',
    icon: '🕹️',
  },
  ai_chat: {
    id: 'ai_chat',
    title: 'AI Collaborator',
    description: 'Interacted with ELSA, the bilingual AI companion.',
    icon: '🤖',
  },
  guestbook: {
    id: 'guestbook',
    title: 'Signed the Guestbook',
    description: 'Left a note in the retro desktop guestbook.',
    icon: '✍️',
  },
};

const STORAGE_KEY = 'rai_portfolio_achievements_v1';

function loadStoredAchievements(): Set<string> {
  if (typeof window === 'undefined') return new Set(['welcome']);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch {
    // Ignore storage parse errors
  }
  return new Set();
}

function saveStoredAchievements(set: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // Ignore storage write errors
  }
}

interface AchievementState {
  unlockedIds: Set<string>;
  activeToast: Achievement | null;
  unlock: (id: keyof typeof ACHIEVEMENTS_LIST) => void;
  clearToast: () => void;
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const useAchievementStore = create<AchievementState>((set, get) => ({
  unlockedIds: new Set<string>(),
  activeToast: null,

  unlock: (id) => {
    const spec = ACHIEVEMENTS_LIST[id];
    if (!spec) return;

    let current = get().unlockedIds;
    if (current.size === 0 && typeof window !== 'undefined') {
      current = loadStoredAchievements();
    }

    if (current.has(id)) return;

    const next = new Set(current);
    next.add(id);
    saveStoredAchievements(next);

    try {
      playAchievementChime();
    } catch {
      // ignore
    }

    if (toastTimer) clearTimeout(toastTimer);

    const toastItem: Achievement = { ...spec, unlockedAt: Date.now() };
    set({ unlockedIds: next, activeToast: toastItem });

    toastTimer = setTimeout(() => {
      set({ activeToast: null });
      toastTimer = null;
    }, 4500);
  },

  clearToast: () => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ activeToast: null });
  },
}));
