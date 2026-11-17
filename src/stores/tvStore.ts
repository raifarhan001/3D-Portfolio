'use client';

import { create } from 'zustand';
import { GRAMOPHONE_CONFIG } from '@/config/roomConfig';

export type TVSource = 'standby' | 'nightcast' | 'music';

export interface TVMusicTrack {
  videoId: string;
  title: string;
  channel: string;
  duration: string;
  thumbnail: string;
}

const STORAGE_KEY = 'tv-state';

const DEFAULT_MUSIC_QUERY = 'trending hits chill music mix';

let latestSearchNonce = 0;

function loadPersisted(): { source: TVSource } {
  if (typeof window === 'undefined') {
    return { source: 'standby' };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const validSource: TVSource =
        parsed.source === 'nightcast' || parsed.source === 'music' || parsed.source === 'standby'
          ? parsed.source
          : 'standby';
      return { source: validSource };
    }
  } catch {
    // ignore storage errors
  }
  return { source: 'standby' };
}

function savePersisted(source: TVSource) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ source }));
  } catch {
    // ignore storage errors
  }
}

interface TVState {
  powered: boolean;
  source: TVSource;
  tvMode: boolean;
  isSeated: boolean;
  gramophoneMode: boolean;
  tvExiting: boolean;
  tvFullscreen: boolean;
  nightcastBlocked: boolean;
  reloadNonce: number;

  // YouTube Music on TV
  musicQuery: string;
  musicLoading: boolean;
  musicError: string | null;
  musicResults: TVMusicTrack[];
  musicTrackIndex: number;
  musicCurrentTrack: TVMusicTrack | null;

  // Gramophone & Cassette Box state
  gramophonePlaying: boolean;
  gramophoneTrackId: string | null;
  gramophoneVolume: number;
  gramophoneFallbackActive: boolean;

  hydrate: () => void;
  setPowered: (v: boolean) => void;
  setSource: (s: TVSource) => void;
  setTvMode: (v: boolean) => void;
  setIsSeated: (v: boolean) => void;
  setGramophoneMode: (v: boolean) => void;
  setTvExiting: (v: boolean) => void;
  setTvFullscreen: (v: boolean) => void;
  toggleTvFullscreen: () => void;
  setNightcastBlocked: (blocked: boolean) => void;
  triggerReload: () => void;
  togglePower: () => void;
  goHome: () => void;
  openNightcast: () => void;
  openMusic: () => void;
  searchAndPlayMusic: (query: string, autoPlayFirst?: boolean) => Promise<TVMusicTrack | null>;
  playMusicTrackAt: (index: number) => void;
  nextMusicTrack: () => void;
  prevMusicTrack: () => void;

  playCassette: (trackId: string) => void;
  toggleGramophonePlay: () => void;
  stopGramophone: () => void;
  setGramophoneVolume: (v: number) => void;
  setGramophoneFallbackActive: (v: boolean) => void;
}

export const useTvStore = create<TVState>((set, get) => ({
  powered: false,
  source: 'standby',
  tvMode: false,
  isSeated: false,
  gramophoneMode: false,
  tvExiting: false,
  tvFullscreen: false,
  nightcastBlocked: false,
  reloadNonce: 0,

  musicQuery: '',
  musicLoading: false,
  musicError: null,
  musicResults: [],
  musicTrackIndex: 0,
  musicCurrentTrack: null,

  gramophonePlaying: false,
  gramophoneTrackId: null,
  gramophoneVolume: GRAMOPHONE_CONFIG.defaultVolume,
  gramophoneFallbackActive: false,

  hydrate: () => {
    const { source } = loadPersisted();
    set({ source });
  },

  setPowered: (v) => set(v ? { powered: true } : { powered: false, tvFullscreen: false }),

  setSource: (s) => {
    set({ source: s, nightcastBlocked: false });
    savePersisted(s);
  },

  setTvMode: (v) => set({ tvMode: v }),
  setIsSeated: (v) => set({ isSeated: v }),
  setGramophoneMode: (v) => set({ gramophoneMode: v }),
  setTvExiting: (v) => set({ tvExiting: v }),
  setTvFullscreen: (v) => set({ tvFullscreen: v }),
  toggleTvFullscreen: () => {
    const { powered, tvFullscreen } = get();
    if (!powered) {
      set({ powered: true, tvFullscreen: !tvFullscreen });
    } else {
      set({ tvFullscreen: !tvFullscreen });
    }
  },
  setNightcastBlocked: (blocked) => set({ nightcastBlocked: blocked }),
  triggerReload: () => set((s) => ({ reloadNonce: s.reloadNonce + 1, nightcastBlocked: false })),

  togglePower: () => {
    const { powered } = get();
    if (powered) {
      savePersisted('standby');
      set({ powered: false, source: 'standby', nightcastBlocked: false, tvFullscreen: false });
    } else {
      set({ powered: true, nightcastBlocked: false });
    }
  },

  goHome: () => {
    savePersisted('standby');
    set({ powered: true, source: 'standby', nightcastBlocked: false });
  },

  openNightcast: () => {
    savePersisted('nightcast');
    set({ powered: true, source: 'nightcast', nightcastBlocked: false });
  },

  openMusic: () => {
    savePersisted('music');
    const hasTracks = get().musicResults.length > 0;
    set({ powered: true, source: 'music', nightcastBlocked: false });
    if (!hasTracks && !get().musicLoading) {
      void get().searchAndPlayMusic(DEFAULT_MUSIC_QUERY, get().musicCurrentTrack === null);
    }
  },

  searchAndPlayMusic: async (rawQuery, autoPlayFirst = true) => {
    const query = rawQuery.trim() || DEFAULT_MUSIC_QUERY;
    const myNonce = ++latestSearchNonce;
    savePersisted('music');
    set({
      powered: true,
      source: 'music',
      nightcastBlocked: false,
      musicQuery: rawQuery.trim(),
      musicLoading: true,
      musicError: null,
    });

    try {
      const res = await fetch(`/api/tv/music?q=${encodeURIComponent(query)}`);
      const data = (await res.json()) as { tracks?: TVMusicTrack[] };
      if (myNonce !== latestSearchNonce) return null;

      const tracks = Array.isArray(data.tracks) ? data.tracks : [];
      const firstTrack = tracks[0] ?? null;

      set((s) => ({
        musicResults: tracks,
        musicLoading: false,
        musicError: tracks.length === 0 ? 'No matching songs found on YouTube.' : null,
        musicTrackIndex: autoPlayFirst ? 0 : s.musicTrackIndex,
        musicCurrentTrack: autoPlayFirst ? firstTrack : (s.musicCurrentTrack ?? firstTrack),
      }));

      return firstTrack;
    } catch {
      if (myNonce !== latestSearchNonce) return null;
      set({
        musicLoading: false,
        musicError: 'Could not reach YouTube Music search right now.',
      });
      return null;
    }
  },

  playMusicTrackAt: (index) => {
    const { musicResults } = get();
    if (musicResults.length === 0) return;
    const bounded = ((index % musicResults.length) + musicResults.length) % musicResults.length;
    const track = musicResults[bounded];
    savePersisted('music');
    set((s) => ({
      powered: true,
      source: 'music',
      musicTrackIndex: bounded,
      musicCurrentTrack: track,
      reloadNonce: s.reloadNonce + 1,
    }));
  },

  nextMusicTrack: () => {
    const { musicTrackIndex, musicResults } = get();
    if (musicResults.length === 0) return;
    get().playMusicTrackAt(musicTrackIndex + 1);
  },

  prevMusicTrack: () => {
    const { musicTrackIndex, musicResults } = get();
    if (musicResults.length === 0) return;
    get().playMusicTrackAt(musicTrackIndex - 1);
  },

  playCassette: (trackId) => {
    set({
      gramophoneTrackId: trackId,
      gramophonePlaying: true,
      gramophoneFallbackActive: false,
    });
  },

  toggleGramophonePlay: () => {
    const { gramophonePlaying, gramophoneTrackId } = get();
    if (!gramophoneTrackId) {
      const first = GRAMOPHONE_CONFIG.tracks[0];
      if (first) {
        set({ gramophoneTrackId: first.id, gramophonePlaying: true, gramophoneFallbackActive: false });
      }
      return;
    }
    set({ gramophonePlaying: !gramophonePlaying });
  },

  stopGramophone: () => set({ gramophonePlaying: false }),

  setGramophoneVolume: (v) => set({ gramophoneVolume: Math.max(0, Math.min(1, v)) }),

  setGramophoneFallbackActive: (v) => set({ gramophoneFallbackActive: v }),
}));
