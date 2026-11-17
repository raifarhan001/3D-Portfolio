import { create } from 'zustand';

export type GymStation = 'treadmill' | 'bench' | 'dumbbells';

export const BENCH_WEIGHT_OPTIONS = [60, 80, 100, 120] as const;
export const DUMBBELL_WEIGHT_OPTIONS = [10, 15, 20, 25] as const;

export interface GymState {
  gymMode: boolean;
  gymExiting: boolean;
  activeStation: GymStation;

  // Treadmill state
  treadmillRunning: boolean;
  treadmillSpeed: number; // km/h (1.0 .. 16.0)
  treadmillIncline: number; // % (0 .. 12)
  beltOffset: number;
  distanceKm: number;
  calories: number;
  heartRate: number;
  elapsedSec: number;

  // Bench press state
  benchWeightKg: number;
  benchReps: number;
  benchPressing: boolean;
  benchAutoSet: boolean;
  benchPhase: number; // 0..1 cycle: 0 = racked/lockout, 0.5 = bottom chest touch, 1 = lockout

  // Dumbbell curl state
  dumbbellWeightKg: number;
  curlReps: number;
  curlActive: boolean;
  curlAutoSet: boolean;
  curlPhase: number; // 0..1 cycle: 0 = rest, 0.5 = peak curl, 1 = rest

  // Actions
  setGymMode: (val: boolean) => void;
  setGymExiting: (val: boolean) => void;
  setActiveStation: (station: GymStation) => void;
  toggleTreadmill: () => void;
  setTreadmillPreset: (running: boolean, speed?: number, incline?: number) => void;
  setTreadmillSpeed: (speed: number) => void;
  setTreadmillIncline: (incline: number) => void;
  triggerBenchRep: () => void;
  toggleBenchAuto: () => void;
  setBenchWeight: (kg: number) => void;
  triggerCurlRep: () => void;
  toggleCurlAuto: () => void;
  setDumbbellWeight: (kg: number) => void;
  resetWorkout: () => void;
  tickWorkout: (
    dt: number,
    onRepComplete?: (kind: 'bench' | 'curl') => void
  ) => void;
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export const useGymStore = create<GymState>((set) => ({
  gymMode: false,
  gymExiting: false,
  activeStation: 'treadmill',

  treadmillRunning: false,
  treadmillSpeed: 8.5,
  treadmillIncline: 2,
  beltOffset: 0,
  distanceKm: 0,
  calories: 0,
  heartRate: 76,
  elapsedSec: 0,

  benchWeightKg: 100,
  benchReps: 0,
  benchPressing: false,
  benchAutoSet: false,
  benchPhase: 0,

  dumbbellWeightKg: 15,
  curlReps: 0,
  curlActive: false,
  curlAutoSet: false,
  curlPhase: 0,

  setGymMode: (val) =>
    set({
      gymMode: val,
      ...(val ? { gymExiting: false } : { benchAutoSet: false, curlAutoSet: false }),
    }),
  setGymExiting: (val) => set({ gymExiting: val }),
  setActiveStation: (station) => set({ activeStation: station }),

  toggleTreadmill: () =>
    set((s) => ({ treadmillRunning: !s.treadmillRunning })),

  setTreadmillPreset: (running, speed, incline) =>
    set((s) => ({
      treadmillRunning: running,
      treadmillSpeed:
        typeof speed === 'number' ? clamp(Math.round(speed * 2) / 2, 1, 16) : s.treadmillSpeed,
      treadmillIncline:
        typeof incline === 'number' ? clamp(Math.round(incline), 0, 12) : s.treadmillIncline,
    })),

  setTreadmillSpeed: (speed) =>
    set({ treadmillSpeed: clamp(Math.round(speed * 2) / 2, 1, 16) }),

  setTreadmillIncline: (incline) =>
    set({ treadmillIncline: clamp(Math.round(incline), 0, 12) }),

  triggerBenchRep: () =>
    set((s) => (s.benchPressing ? s : { benchPressing: true, benchPhase: 0 })),

  toggleBenchAuto: () =>
    set((s) => {
      const next = !s.benchAutoSet;
      return {
        benchAutoSet: next,
        benchPressing: next ? true : s.benchPressing,
      };
    }),

  setBenchWeight: (kg) => set({ benchWeightKg: kg }),

  triggerCurlRep: () =>
    set((s) => (s.curlActive ? s : { curlActive: true, curlPhase: 0 })),

  toggleCurlAuto: () =>
    set((s) => {
      const next = !s.curlAutoSet;
      return {
        curlAutoSet: next,
        curlActive: next ? true : s.curlActive,
      };
    }),

  setDumbbellWeight: (kg) => set({ dumbbellWeightKg: kg }),

  resetWorkout: () =>
    set({
      treadmillRunning: false,
      beltOffset: 0,
      distanceKm: 0,
      calories: 0,
      heartRate: 76,
      elapsedSec: 0,
      benchReps: 0,
      benchPressing: false,
      benchAutoSet: false,
      benchPhase: 0,
      curlReps: 0,
      curlActive: false,
      curlAutoSet: false,
      curlPhase: 0,
    }),

  tickWorkout: (dt, onRepComplete) => {
    const safeDt = clamp(dt, 0, 0.1);
    if (safeDt <= 0) return;

    let completedBench = false;
    let completedCurl = false;

    set((s) => {
      const patch: Partial<GymState> = {};

      // 1. Treadmill simulation
      if (s.treadmillRunning) {
        const kmPerSec = s.treadmillSpeed / 3600;
        const speedNorm = s.treadmillSpeed / 8.5;
        const inclineFactor = 1 + s.treadmillIncline * 0.06;
        patch.beltOffset = (s.beltOffset + safeDt * speedNorm * 1.45) % 1;
        patch.distanceKm = s.distanceKm + kmPerSec * safeDt;
        patch.elapsedSec = s.elapsedSec + safeDt;
        patch.calories = s.calories + (0.08 + s.treadmillSpeed * 0.032) * inclineFactor * safeDt;
        const targetHr = clamp(76 + s.treadmillSpeed * 6.8 + s.treadmillIncline * 2.1, 74, 188);
        patch.heartRate = s.heartRate + (targetHr - s.heartRate) * Math.min(1, safeDt * 1.4);
      } else if (s.heartRate > 76.2 || s.benchPressing || s.curlActive) {
        const restingOrLift = s.benchPressing || s.curlActive ? 112 : 76;
        patch.heartRate = s.heartRate + (restingOrLift - s.heartRate) * Math.min(1, safeDt * 0.65);
      }

      // 2. Bench press cycle (~0.95s per rep, heavier slightly slower)
      if (s.benchPressing) {
        const repSpeed = clamp(1.15 - (s.benchWeightKg - 60) * 0.003, 0.92, 1.18);
        const nextPhase = s.benchPhase + safeDt * repSpeed;
        if (nextPhase >= 1) {
          completedBench = true;
          patch.benchReps = s.benchReps + 1;
          patch.calories = (patch.calories ?? s.calories) + 0.45 + s.benchWeightKg * 0.006;
          if (s.benchAutoSet) {
            patch.benchPhase = nextPhase % 1;
            patch.benchPressing = true;
          } else {
            patch.benchPhase = 0;
            patch.benchPressing = false;
          }
        } else {
          patch.benchPhase = nextPhase;
        }
      }

      // 3. Dumbbell curl cycle (~0.9s per rep)
      if (s.curlActive) {
        const curlSpeed = clamp(1.22 - (s.dumbbellWeightKg - 10) * 0.015, 0.96, 1.25);
        const nextPhase = s.curlPhase + safeDt * curlSpeed;
        if (nextPhase >= 1) {
          completedCurl = true;
          patch.curlReps = s.curlReps + 1;
          patch.calories = (patch.calories ?? s.calories) + 0.25 + s.dumbbellWeightKg * 0.012;
          if (s.curlAutoSet) {
            patch.curlPhase = nextPhase % 1;
            patch.curlActive = true;
          } else {
            patch.curlPhase = 0;
            patch.curlActive = false;
          }
        } else {
          patch.curlPhase = nextPhase;
        }
      }

      return Object.keys(patch).length > 0 ? patch : s;
    });

    if (completedBench) onRepComplete?.('bench');
    if (completedCurl) onRepComplete?.('curl');
  },
}));
