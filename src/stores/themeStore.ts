'use client';

import { create } from 'zustand';
import {
  GAMING_ROOM_CONFIG,
  LIGHT_SWITCH_CONFIG,
  THEME_STORAGE_KEY,
  type RoomTheme,
} from '@/config/themeConfig';

function loadPersistedTheme(): RoomTheme {
  if (typeof window === 'undefined') return GAMING_ROOM_CONFIG.defaultTheme;
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === 'day' || raw === 'night') return raw;
  } catch {
    // ignore storage errors
  }
  return GAMING_ROOM_CONFIG.defaultTheme;
}

function savePersistedTheme(theme: RoomTheme): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // ignore storage errors
  }
}

let toastTimeoutId: ReturnType<typeof setTimeout> | undefined;

interface ThemeState {
  theme: RoomTheme;
  themeT: number; // 0 = day, 1 = night (final settled state for UI readers; smoothed live in ThemeRegistry)
  hydrated: boolean;
  toastText: string | null;

  hydrate: () => void;
  setTheme: (theme: RoomTheme, showToast?: boolean) => void;
  toggleTheme: (showToast?: boolean) => RoomTheme;
  clearToast: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: GAMING_ROOM_CONFIG.defaultTheme,
  themeT: GAMING_ROOM_CONFIG.defaultTheme === 'night' ? 1 : 0,
  hydrated: false,
  toastText: null,

  hydrate: () => {
    if (get().hydrated) return;
    const saved = loadPersistedTheme();
    set({
      theme: saved,
      themeT: saved === 'night' ? 1 : 0,
      hydrated: true,
    });
  },

  setTheme: (theme, showToast = false) => {
    savePersistedTheme(theme);
    const toastText = showToast ? (theme === 'night' ? 'Night mode' : 'Day mode') : null;

    if (showToast && typeof window !== 'undefined') {
      if (toastTimeoutId !== undefined) clearTimeout(toastTimeoutId);
      toastTimeoutId = setTimeout(() => {
        useThemeStore.setState({ toastText: null });
      }, LIGHT_SWITCH_CONFIG.toastDurationMs);
    }

    set({
      theme,
      toastText: showToast ? toastText : get().toastText,
    });
  },

  toggleTheme: (showToast = true) => {
    const next: RoomTheme = get().theme === 'day' ? 'night' : 'day';
    get().setTheme(next, showToast);
    return next;
  },

  clearToast: () => {
    if (toastTimeoutId !== undefined) clearTimeout(toastTimeoutId);
    set({ toastText: null });
  },
}));

export function syncSettledThemeT(t: number): void {
  // Only invoked when ThemeController has already finished its transition; never inside active frames.
  useThemeStore.setState({ themeT: t });
}
