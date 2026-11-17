'use client';

import { create } from 'zustand';
import {
  PATROL_ROUTE,
  ROBOT_STATIONS,
  TOUR_ROUTE,
  type RobotActionSpec,
  type RobotStationId,
} from '@/config/robotConfig';
import { GRAMOPHONE_CONFIG } from '@/config/roomConfig';
import { useThemeStore } from '@/stores/themeStore';
import { useTvStore } from '@/stores/tvStore';
import { usePcStore } from '@/stores/pcStore';
import { useOsStore } from '@/stores/osStore';
import { useSfxStore } from '@/stores/sfxStore';
import { findNearestWalkableWorld, findPath, getSafeStationPosition } from '@/utils/robotNav';
import { speakMonaText, stopMonaSpeech, type MonaVoiceMode } from '@/utils/monaVoice';
import { playSwitchClickSound, unlockSfxAudio } from '@/utils/sound';

export type RobotBehaviorMode = 'patrol' | 'follow' | 'idle' | 'tour';

export interface MonaChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  sources?: string[];
  grounded?: boolean;
  actions?: RobotActionSpec[];
  createdAt: number;
}

/**
 * Shared mutable live pose updated in R3F useFrame at 60Hz with zero React re-renders.
 */
const INITIAL_DOCK = getSafeStationPosition('dock');

export const monaLivePose = {
  x: INITIAL_DOCK[0],
  z: INITIAL_DOCK[1],
  yaw: 0.45,
  walking: false,
  waveWeight: 0,
  talkLevel: 0,
};

const INITIAL_MESSAGE: MonaChatMessage = {
  id: 'elsa-welcome',
  role: 'assistant',
  text: 'Hey there, trouble! I’m ELSA — Rai Farhan’s charmingly naughty AI companion. Want me to dim the lights, play something moody, or spill the tea on Rai’s AI projects? Ask in English or Urdu.',
  sources: ['Profile & Companion Intro'],
  grounded: true,
  createdAt: 0,
};

export const ENTRY_WELCOME_LINE =
  'Well hello there... welcome to Rai Farhan’s 3D room! I’m ELSA, and yes, I know I look good. I control the lights, TV, and music here, so press E if you dare to talk to me.';

let tourTimer: ReturnType<typeof setTimeout> | null = null;
let tourRunId = 0;

function clearTourTimer() {
  tourRunId += 1;
  if (tourTimer) {
    clearTimeout(tourTimer);
    tourTimer = null;
  }
}

interface RobotState {
  mode: RobotBehaviorMode;
  station: RobotStationId;
  targetStation: RobotStationId | null;
  waypoints: Array<[number, number]>;
  facingTarget: [number, number] | null;
  patrolIndex: number;
  tourIndex: number;

  isThinking: boolean;
  isSpeaking: boolean;
  hasWelcomedEntry: boolean;
  voiceMode: MonaVoiceMode;
  waveUntil: number;
  bubbleText: string | null;
  bubbleUntil: number;
  messages: MonaChatMessage[];
  lastError: string | null;

  setMode: (mode: RobotBehaviorMode) => void;
  setVoiceMode: (mode: MonaVoiceMode) => void;
  setSpeaking: (speaking: boolean) => void;
  triggerWave: (durationMs?: number) => void;
  showBubble: (text: string, durationMs?: number) => void;
  welcomeVisitor: () => void;
  clearPath: () => void;
  consumeWaypoint: () => void;
  walkToStation: (station: RobotStationId) => void;
  walkToPoint: (x: number, z: number, faceAt?: [number, number] | null) => void;
  comeToPlayer: (playerX: number, playerZ: number, dirX?: number, dirZ?: number) => void;
  advancePatrol: () => void;
  startTour: (speakLanguageUr?: boolean) => void;
  stopTour: () => void;
  stopAllVoice: () => void;
  speak: (text: string) => void;
  executeActions: (actions: RobotActionSpec[]) => void;
  sendMessage: (rawText: string) => Promise<void>;
}

export const useRobotStore = create<RobotState>((set, get) => ({
  mode: 'patrol',
  station: 'dock',
  targetStation: null,
  waypoints: [],
  facingTarget: [...ROBOT_STATIONS.dock.faceAt],
  patrolIndex: 0,
  tourIndex: 0,

  isThinking: false,
  isSpeaking: false,
  hasWelcomedEntry: false,
  voiceMode: 'auto',
  waveUntil: 0,
  bubbleText: 'Hi! Press E to talk to ELSA',
  bubbleUntil: 0,
  messages: [INITIAL_MESSAGE],
  lastError: null,

  setMode: (mode) => {
    if (mode !== 'tour') clearTourTimer();
    set({
      mode,
      ...(mode === 'idle' ? { waypoints: [], targetStation: null } : {}),
    });
  },

  setVoiceMode: (voiceMode) => {
    if (voiceMode === 'off') {
      stopMonaSpeech(() => set({ isSpeaking: false }));
    }
    set({ voiceMode });
  },

  setSpeaking: (isSpeaking) => set({ isSpeaking }),

  triggerWave: (durationMs = 2400) => {
    set({ waveUntil: Date.now() + durationMs });
  },

  showBubble: (text, durationMs = 4800) => {
    set({
      bubbleText: text.slice(0, 240),
      bubbleUntil: Date.now() + durationMs,
    });
  },

  welcomeVisitor: () => {
    const { voiceMode } = get();
    const muted = useSfxStore.getState().muted;
    get().triggerWave(5500);
    get().showBubble(ENTRY_WELCOME_LINE, 14000);
    if (!muted && voiceMode !== 'off') {
      set({ hasWelcomedEntry: true });
      get().speak(ENTRY_WELCOME_LINE);
    }
  },

  clearPath: () => set({ waypoints: [], targetStation: null }),

  consumeWaypoint: () =>
    set((s) => {
      if (s.waypoints.length <= 1) {
        const nextStation = s.targetStation ?? s.station;
        return { waypoints: [], station: nextStation, targetStation: null };
      }
      return { waypoints: s.waypoints.slice(1) };
    }),

  walkToStation: (stationId) => {
    const spec = ROBOT_STATIONS[stationId];
    const [tx, tz] = getSafeStationPosition(stationId);
    const path = findPath(monaLivePose.x, monaLivePose.z, tx, tz);
    set({
      targetStation: stationId,
      waypoints: path,
      facingTarget: [...spec.faceAt],
    });
  },

  walkToPoint: (x, z, faceAt = null) => {
    const path = findPath(monaLivePose.x, monaLivePose.z, x, z);
    set({
      targetStation: null,
      waypoints: path,
      facingTarget: faceAt,
    });
  },

  comeToPlayer: (playerX, playerZ, dirX = 0, dirZ = 0) => {
    clearTourTimer();
    const curDist = Math.hypot(monaLivePose.x - playerX, monaLivePose.z - playerZ);
    let fx = dirX;
    let fz = dirZ;
    let fLen = Math.hypot(fx, fz);
    if (fLen < 0.05) {
      fx = monaLivePose.x - playerX;
      fz = monaLivePose.z - playerZ;
      fLen = Math.hypot(fx, fz);
    }
    if (fLen > 0.01) {
      fx /= fLen;
      fz /= fLen;
    } else {
      fx = 0;
      fz = 1;
    }

    const standDist = 1.45;
    let [safeX, safeZ] = findNearestWalkableWorld(
      playerX + fx * standDist,
      playerZ + fz * standDist
    );
    if (Math.hypot(safeX - playerX, safeZ - playerZ) < 1.05) {
      [safeX, safeZ] = findNearestWalkableWorld(
        playerX - fz * standDist,
        playerZ + fx * standDist
      );
    }

    const distToSpot = Math.hypot(monaLivePose.x - safeX, monaLivePose.z - safeZ);
    const alreadyNear = curDist <= 1.45 && distToSpot <= 0.65;
    const path = alreadyNear ? [] : findPath(monaLivePose.x, monaLivePose.z, safeX, safeZ);
    const bubbleLine = alreadyNear
      ? "Already right beside you... couldn't wait?"
      : 'Coming right over... miss me already?';

    set({
      mode: 'idle',
      targetStation: null,
      waypoints: path,
      facingTarget: [playerX, playerZ],
    });
    get().triggerWave(2200);
    get().showBubble(bubbleLine, 4200);

    const { voiceMode, isSpeaking } = get();
    const muted = useSfxStore.getState().muted;
    if (!muted && voiceMode !== 'off' && !isSpeaking) {
      get().speak(bubbleLine);
    }
  },

  advancePatrol: () => {
    const { patrolIndex, mode } = get();
    if (mode !== 'patrol') return;
    const nextIdx = (patrolIndex + 1) % PATROL_ROUTE.length;
    const nextStation = PATROL_ROUTE[nextIdx];
    const spec = ROBOT_STATIONS[nextStation];
    const [tx, tz] = getSafeStationPosition(nextStation);
    const path = findPath(monaLivePose.x, monaLivePose.z, tx, tz);
    set({
      patrolIndex: nextIdx,
      targetStation: nextStation,
      waypoints: path,
      facingTarget: [...spec.faceAt],
    });
  },

  startTour: (speakLanguageUr = false) => {
    clearTourTimer();
    const myRunId = tourRunId;
    const runStep = (idx: number) => {
      if (tourRunId !== myRunId) return;
      if (idx >= TOUR_ROUTE.length) {
        set({ mode: 'patrol', tourIndex: 0 });
        return;
      }
      const stationId = TOUR_ROUTE[idx];
      const spec = ROBOT_STATIONS[stationId];
      get().walkToStation(stationId);
      set({ mode: 'tour', tourIndex: idx });

      const line = speakLanguageUr ? spec.tourLineUr : spec.tourLineEn;
      const mode = get().voiceMode;
      const voiceEnabled = mode !== 'off' && !useSfxStore.getState().muted;

      get().showBubble(line, voiceEnabled ? 14000 : 5200);

      let stepAdvanced = false;
      const scheduleAdvance = (delayMs: number) => {
        if (stepAdvanced || tourRunId !== myRunId) return;
        stepAdvanced = true;
        if (tourTimer) {
          clearTimeout(tourTimer);
          tourTimer = null;
        }
        tourTimer = setTimeout(() => {
          tourTimer = null;
          if (tourRunId === myRunId && get().mode === 'tour') {
            runStep(idx + 1);
          }
        }, delayMs);
      };

      // Safety watchdog in case audio playback stalls or voice is muted/off
      tourTimer = setTimeout(() => {
        tourTimer = null;
        if (!stepAdvanced && tourRunId === myRunId && get().mode === 'tour') {
          stepAdvanced = true;
          runStep(idx + 1);
        }
      }, voiceEnabled ? 22000 : 5400);

      void speakMonaText(line, mode, {
        onStart: () => {
          if (tourRunId === myRunId) set({ isSpeaking: true });
        },
        onEnd: () => {
          set({ isSpeaking: false });
          if (tourRunId === myRunId && get().mode === 'tour') {
            scheduleAdvance(voiceEnabled ? 900 : 5200);
          }
        },
      });
    };

    runStep(0);
  },

  stopTour: () => {
    clearTourTimer();
    if (get().mode === 'tour') {
      set({ mode: 'idle', waypoints: [] });
    }
  },

  stopAllVoice: () => {
    stopMonaSpeech(() => set({ isSpeaking: false }));
  },

  speak: (text) => {
    const mode = get().voiceMode;
    void speakMonaText(text, mode, {
      onStart: () => set({ isSpeaking: true }),
      onEnd: () => set({ isSpeaking: false }),
    });
  },

  executeActions: (actions) => {
    const win = window as unknown as {
      __monaOpenTarget?: (kind: 'tv' | 'pc' | 'certificate' | 'achievements' | 'phone', certIndex?: number) => void;
    };

    for (const act of actions) {
      switch (act.type) {
        case 'set_theme': {
          const target = act.value === 'day' ? 'day' : 'night';
          unlockSfxAudio();
          useThemeStore.getState().setTheme(target, true);
          playSwitchClickSound(target === 'night');
          break;
        }
        case 'toggle_theme': {
          unlockSfxAudio();
          const next = useThemeStore.getState().toggleTheme(true);
          playSwitchClickSound(next === 'night');
          break;
        }
        case 'set_tv_power': {
          const on = act.value !== 'off';
          const tv = useTvStore.getState();
          tv.setPowered(on);
          if (!on) tv.setSource('standby');
          get().walkToStation('tv');
          break;
        }
        case 'set_tv_source': {
          const tv = useTvStore.getState();
          if (act.value === 'nightcast') {
            tv.openNightcast();
          } else if (act.value === 'music') {
            tv.openMusic();
          } else {
            tv.setPowered(true);
            tv.setSource('standby');
          }
          get().walkToStation('tv');
          break;
        }
        case 'play_tv_song': {
          const songQuery = (act.value ?? '').trim() || 'trending chill music mix';
          void useTvStore.getState().searchAndPlayMusic(songQuery, true);
          get().walkToStation('tv');
          get().triggerWave(1800);
          break;
        }
        case 'focus_tv': {
          useTvStore.getState().setPowered(true);
          win.__monaOpenTarget?.('tv');
          break;
        }
        case 'power_pc': {
          if (act.value === 'off') usePcStore.getState().powerOffPC();
          else usePcStore.getState().powerOnPC();
          get().walkToStation('pc');
          break;
        }
        case 'open_pc_window': {
          usePcStore.getState().powerOnPC();
          const kind = act.value ?? 'resume';
          const os = useOsStore.getState();
          if (kind === 'resume') {
            os.openWindow({ id: 'resume', kind: 'resume', title: 'Resume / CV — Rai Farhan' });
          } else if (kind === 'about-me') {
            os.openWindow({ id: 'about-me', kind: 'about-me', title: 'About Me' });
          } else if (kind === 'contact') {
            os.openWindow({ id: 'contact', kind: 'contact', title: 'Contact' });
          } else {
            os.openWindow({ id: 'my-computer', kind: 'my-computer', title: 'My Computer' });
          }
          get().walkToStation('pc');
          break;
        }
        case 'play_music': {
          unlockSfxAudio();
          const tv = useTvStore.getState();
          const track =
            (act.trackId && GRAMOPHONE_CONFIG.tracks.find((t) => t.id === act.trackId)?.id) ||
            tv.gramophoneTrackId ||
            GRAMOPHONE_CONFIG.tracks[0]?.id;
          if (track) tv.playCassette(track);
          get().walkToStation('gramophone');
          break;
        }
        case 'pause_music': {
          useTvStore.getState().stopGramophone();
          break;
        }
        case 'set_music_volume': {
          const parsed = Number.parseFloat(act.value ?? '0.7');
          if (!Number.isNaN(parsed)) {
            useTvStore.getState().setGramophoneVolume(Math.max(0, Math.min(1, parsed)));
          }
          break;
        }
        case 'set_sfx_muted': {
          const muted = act.value === 'true';
          useSfxStore.getState().setMuted(muted);
          if (muted) stopMonaSpeech(() => set({ isSpeaking: false }));
          break;
        }
        case 'show_certificates': {
          const idx = Number.parseInt(act.value ?? '0', 10);
          get().walkToStation('certificates');
          win.__monaOpenTarget?.('certificate', Number.isNaN(idx) ? 0 : idx);
          break;
        }
        case 'show_achievements': {
          get().walkToStation('certificates');
          win.__monaOpenTarget?.('achievements', 0);
          break;
        }
        case 'show_phone': {
          get().walkToStation('pc');
          win.__monaOpenTarget?.('phone', 0);
          break;
        }
        case 'walk_to': {
          if (act.station && ROBOT_STATIONS[act.station]) {
            clearTourTimer();
            set({ mode: 'idle' });
            get().walkToStation(act.station);
          }
          break;
        }
        case 'set_mode': {
          clearTourTimer();
          if (act.value === 'follow') {
            set({ mode: 'follow', waypoints: [], targetStation: null });
          } else if (act.value === 'patrol') {
            set({ mode: 'patrol' });
            get().advancePatrol();
          } else {
            set({ mode: 'idle', waypoints: [], targetStation: null });
          }
          break;
        }
        case 'start_tour': {
          const looksUrdu =
            /[\u0600-\u06FF]|\b(hai|hain|karo|dikhao|batao|chalo|urdu|dikha|chal|saath)\b/i.test(
              act.value || ''
            );
          get().startTour(looksUrdu);
          break;
        }
        case 'wave': {
          get().triggerWave(2600);
          break;
        }
      }
    }
  },

  sendMessage: async (rawText) => {
    const message = rawText.trim();
    if (!message || get().isThinking) return;

    unlockSfxAudio();
    const userMsg: MonaChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: message,
      createdAt: Date.now(),
    };

    const history = get()
      .messages.slice(-6)
      .map((m) => ({ role: m.role, text: m.text }));

    set((s) => ({
      messages: [...s.messages.slice(-24), userMsg],
      isThinking: true,
      lastError: null,
    }));

    const themeState = useThemeStore.getState();
    const tvState = useTvStore.getState();
    const pcState = usePcStore.getState();
    const sfxState = useSfxStore.getState();
    const currentTrack = GRAMOPHONE_CONFIG.tracks.find((t) => t.id === tvState.gramophoneTrackId);

    try {
      const res = await fetch('/api/robot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          history,
          roomState: {
            theme: themeState.theme,
            tvPowered: tvState.powered,
            tvSource: tvState.source,
            pcPowered: pcState.poweredPC,
            pcBootState: pcState.bootState,
            gramophonePlaying: tvState.gramophonePlaying,
            gramophoneTrackTitle: currentTrack?.title ?? null,
            gramophoneVolume: tvState.gramophoneVolume,
            sfxMuted: sfxState.muted,
            robotMode: get().mode,
            robotStation: get().station,
          },
        }),
      });

      const data = (await res.json()) as {
        reply?: string;
        spokenReply?: string;
        grounded?: boolean;
        sources?: string[];
        actions?: RobotActionSpec[];
        error?: string;
      };

      if (!res.ok || !data.reply) {
        const errMsg = data.error || 'ELSA could not answer right now.';
        set((s) => ({
          isThinking: false,
          lastError: errMsg,
          messages: [
            ...s.messages,
            {
              id: `err-${Date.now()}`,
              role: 'assistant',
              text: errMsg,
              grounded: false,
              createdAt: Date.now(),
            },
          ],
        }));
        return;
      }

      const actions = Array.isArray(data.actions) ? data.actions : [];
      const assistantMsg: MonaChatMessage = {
        id: `elsa-${Date.now()}`,
        role: 'assistant',
        text: data.reply,
        sources: Array.isArray(data.sources) ? data.sources : [],
        grounded: data.grounded,
        actions,
        createdAt: Date.now(),
      };

      set((s) => ({
        isThinking: false,
        messages: [...s.messages.slice(-24), assistantMsg],
      }));

      get().showBubble(data.reply, 5500);
      const startsTour = actions.some((a) => a.type === 'start_tour');
      if (actions.length > 0) {
        // Tag start_tour with user language heuristic if emitted
        const normalized = actions.map((a) =>
          a.type === 'start_tour' && !a.value ? { ...a, value: message } : a
        );
        get().executeActions(normalized);
      } else {
        get().triggerWave(1800);
      }
      if (!startsTour) {
        get().speak(data.spokenReply || data.reply);
      }
    } catch {
      set((s) => ({
        isThinking: false,
        lastError: 'Network error while reaching ELSA.',
        messages: [
          ...s.messages,
          {
            id: `err-${Date.now()}`,
            role: 'assistant',
            text: 'Network error — please try again in a moment.',
            grounded: false,
            createdAt: Date.now(),
          },
        ],
      }));
    }
  },
}));
