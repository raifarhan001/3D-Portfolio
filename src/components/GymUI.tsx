'use client';

import {
  BENCH_WEIGHT_OPTIONS,
  DUMBBELL_WEIGHT_OPTIONS,
  type GymStation,
  useGymStore,
} from '@/stores/gymStore';
import { playGymBeepSound, unlockSfxAudio } from '@/utils/sound';

function formatElapsed(sec: number): string {
  const total = Math.max(0, Math.floor(sec));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function GymUI() {
  const gymMode = useGymStore((s) => s.gymMode);
  const gymExiting = useGymStore((s) => s.gymExiting);
  const activeStation = useGymStore((s) => s.activeStation);

  const treadmillRunning = useGymStore((s) => s.treadmillRunning);
  const treadmillSpeed = useGymStore((s) => s.treadmillSpeed);
  const treadmillIncline = useGymStore((s) => s.treadmillIncline);
  const distanceKm = useGymStore((s) => s.distanceKm);
  const calories = useGymStore((s) => s.calories);
  const heartRate = useGymStore((s) => s.heartRate);
  const elapsedSec = useGymStore((s) => s.elapsedSec);

  const benchWeightKg = useGymStore((s) => s.benchWeightKg);
  const benchReps = useGymStore((s) => s.benchReps);
  const benchPressing = useGymStore((s) => s.benchPressing);
  const benchAutoSet = useGymStore((s) => s.benchAutoSet);

  const dumbbellWeightKg = useGymStore((s) => s.dumbbellWeightKg);
  const curlReps = useGymStore((s) => s.curlReps);
  const curlActive = useGymStore((s) => s.curlActive);
  const curlAutoSet = useGymStore((s) => s.curlAutoSet);

  const setActiveStation = useGymStore((s) => s.setActiveStation);
  const toggleTreadmill = useGymStore((s) => s.toggleTreadmill);
  const setTreadmillPreset = useGymStore((s) => s.setTreadmillPreset);
  const setTreadmillSpeed = useGymStore((s) => s.setTreadmillSpeed);
  const setTreadmillIncline = useGymStore((s) => s.setTreadmillIncline);
  const triggerBenchRep = useGymStore((s) => s.triggerBenchRep);
  const toggleBenchAuto = useGymStore((s) => s.toggleBenchAuto);
  const setBenchWeight = useGymStore((s) => s.setBenchWeight);
  const triggerCurlRep = useGymStore((s) => s.triggerCurlRep);
  const toggleCurlAuto = useGymStore((s) => s.toggleCurlAuto);
  const setDumbbellWeight = useGymStore((s) => s.setDumbbellWeight);
  const resetWorkout = useGymStore((s) => s.resetWorkout);

  if (!gymMode || gymExiting) return null;

  const switchStation = (station: GymStation) => {
    unlockSfxAudio();
    playGymBeepSound(780);
    setActiveStation(station);
  };

  return (
    <>
      {/* Top-Left Exit Gym Button */}
      <div
        className="fixed top-4 left-4 z-50 flex items-center gap-2 select-none"
        data-gym-top-bar="true"
      >
        <button
          type="button"
          data-gym-exit="true"
          onClick={(e) => {
            e.stopPropagation();
            (window as unknown as { __exitGymMode?: (lock?: boolean) => void }).__exitGymMode?.(true);
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#0e1017]/90 backdrop-blur-md border border-white/15 text-neutral-100 text-xs font-medium hover:bg-[#191d28] transition-colors cursor-pointer shadow-lg"
        >
          <span>✕ Exit Gym</span>
          <span className="text-white/45 text-[11px]">Q</span>
        </button>
      </div>

      {/* Right-Side Interactive Gym Console */}
      <div
        data-gym-ui="true"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className="fixed right-5 top-1/2 -translate-y-1/2 z-50 w-[340px] max-w-[calc(100vw-2rem)] rounded-2xl border border-white/12 bg-[#0b0d13]/92 backdrop-blur-md text-neutral-100 shadow-[0_24px_60px_rgba(0,0,0,0.65)] select-none overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/[0.03]">
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                treadmillRunning || benchPressing || curlActive
                  ? 'bg-emerald-400 shadow-[0_0_10px_#34d399]'
                  : 'bg-sky-400'
              }`}
            />
            <span className="text-[11px] font-semibold tracking-wider uppercase text-neutral-200">
              Home Gym Studio
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-neutral-400">
              {formatElapsed(elapsedSec)}
            </span>
            <button
              type="button"
              data-gym-reset="true"
              onClick={() => {
                unlockSfxAudio();
                playGymBeepSound(520);
                resetWorkout();
              }}
              className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-neutral-300 hover:bg-white/10 cursor-pointer"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Live Telemetry Cards */}
        <div className="grid grid-cols-4 gap-1.5 px-3.5 pt-3">
          <div className="rounded-lg border border-white/8 bg-white/[0.03] px-2 py-1.5 text-center">
            <div className="text-[9px] uppercase tracking-wider text-neutral-400">Speed</div>
            <div data-gym-stat-speed="true" className="font-mono text-xs font-bold text-sky-300">
              {(treadmillRunning ? treadmillSpeed : 0).toFixed(1)}
            </div>
            <div className="text-[9px] text-neutral-500">km/h</div>
          </div>
          <div className="rounded-lg border border-white/8 bg-white/[0.03] px-2 py-1.5 text-center">
            <div className="text-[9px] uppercase tracking-wider text-neutral-400">Dist</div>
            <div data-gym-stat-distance="true" className="font-mono text-xs font-bold text-emerald-300">
              {distanceKm.toFixed(2)}
            </div>
            <div className="text-[9px] text-neutral-500">km</div>
          </div>
          <div className="rounded-lg border border-white/8 bg-white/[0.03] px-2 py-1.5 text-center">
            <div className="text-[9px] uppercase tracking-wider text-neutral-400">Heart</div>
            <div data-gym-stat-hr="true" className="font-mono text-xs font-bold text-rose-300">
              {Math.round(heartRate)}
            </div>
            <div className="text-[9px] text-neutral-500">BPM</div>
          </div>
          <div className="rounded-lg border border-white/8 bg-white/[0.03] px-2 py-1.5 text-center">
            <div className="text-[9px] uppercase tracking-wider text-neutral-400">Burn</div>
            <div data-gym-stat-kcal="true" className="font-mono text-xs font-bold text-amber-300">
              {Math.round(calories)}
            </div>
            <div className="text-[9px] text-neutral-500">kcal</div>
          </div>
        </div>

        {/* Station Selector Tabs */}
        <div className="grid grid-cols-3 gap-1.5 px-3.5 pt-3">
          {(
            [
              { id: 'treadmill', label: 'Treadmill' },
              { id: 'bench', label: 'Bench Press' },
              { id: 'dumbbells', label: 'Dumbbells' },
            ] as const
          ).map((tab) => {
            const active = activeStation === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                data-gym-tab={tab.id}
                onClick={() => switchStation(tab.id)}
                className={`rounded-lg py-1.5 text-[11px] font-medium border transition-all cursor-pointer ${
                  active
                    ? 'bg-sky-500/20 border-sky-400/50 text-sky-200 shadow-[0_0_16px_rgba(56,189,248,0.18)]'
                    : 'bg-white/[0.03] border-white/10 text-neutral-400 hover:bg-white/[0.07] hover:text-neutral-200'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Active Station Controls */}
        <div className="p-3.5 space-y-3">
          {activeStation === 'treadmill' && (
            <div className="space-y-3">
              <button
                type="button"
                data-gym-treadmill-toggle="true"
                onClick={() => {
                  unlockSfxAudio();
                  playGymBeepSound(treadmillRunning ? 520 : 820);
                  toggleTreadmill();
                }}
                className={`w-full py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  treadmillRunning
                    ? 'bg-rose-500/20 border-rose-400/50 text-rose-200 hover:bg-rose-500/30'
                    : 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200 hover:bg-emerald-500/30'
                }`}
              >
                {treadmillRunning ? '⏸ Pause Treadmill (Space)' : '▶ Start Treadmill (Space)'}
              </button>

              {/* Quick Speed Presets */}
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'walk', label: 'Walk 4.5', speed: 4.5, incline: 1 },
                  { id: 'jog', label: 'Jog 8.5', speed: 8.5, incline: 2 },
                  { id: 'sprint', label: 'Sprint 13.5', speed: 13.5, incline: 4 },
                ].map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    data-gym-preset={preset.id}
                    onClick={() => {
                      unlockSfxAudio();
                      playGymBeepSound(760);
                      setTreadmillPreset(true, preset.speed, preset.incline);
                    }}
                    className={`rounded-lg py-1.5 text-[11px] font-medium border cursor-pointer transition-colors ${
                      treadmillRunning && Math.abs(treadmillSpeed - preset.speed) < 0.3
                        ? 'bg-sky-500/20 border-sky-400/45 text-sky-200'
                        : 'bg-white/[0.04] border-white/10 text-neutral-300 hover:bg-white/[0.08]'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Speed Control */}
              <div className="rounded-xl border border-white/8 bg-white/[0.02] p-2.5 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-neutral-300">Belt Speed</span>
                  <span className="font-mono text-sky-300 font-semibold">
                    {treadmillSpeed.toFixed(1)} km/h
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    data-gym-speed-down="true"
                    onClick={() => setTreadmillSpeed(treadmillSpeed - 0.5)}
                    className="h-6 w-7 rounded bg-white/8 hover:bg-white/15 text-xs font-bold cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="range"
                    data-gym-speed-range="true"
                    min={1}
                    max={16}
                    step={0.5}
                    value={treadmillSpeed}
                    onChange={(e) => setTreadmillSpeed(Number(e.target.value))}
                    className="flex-1 accent-sky-400 cursor-pointer"
                  />
                  <button
                    type="button"
                    data-gym-speed-up="true"
                    onClick={() => setTreadmillSpeed(treadmillSpeed + 0.5)}
                    className="h-6 w-7 rounded bg-white/8 hover:bg-white/15 text-xs font-bold cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Incline Control */}
              <div className="rounded-xl border border-white/8 bg-white/[0.02] p-2.5 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-neutral-300">Deck Incline</span>
                  <span className="font-mono text-amber-300 font-semibold">{treadmillIncline}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    data-gym-incline-down="true"
                    onClick={() => setTreadmillIncline(treadmillIncline - 1)}
                    className="h-6 w-7 rounded bg-white/8 hover:bg-white/15 text-xs font-bold cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="range"
                    data-gym-incline-range="true"
                    min={0}
                    max={12}
                    step={1}
                    value={treadmillIncline}
                    onChange={(e) => setTreadmillIncline(Number(e.target.value))}
                    className="flex-1 accent-amber-400 cursor-pointer"
                  />
                  <button
                    type="button"
                    data-gym-incline-up="true"
                    onClick={() => setTreadmillIncline(treadmillIncline + 1)}
                    className="h-6 w-7 rounded bg-white/8 hover:bg-white/15 text-xs font-bold cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeStation === 'bench' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-neutral-400">
                    Olympic Bench Press
                  </div>
                  <div className="text-sm font-semibold text-neutral-100">
                    {benchWeightKg} kg Loaded
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-neutral-400">Reps</div>
                  <div data-gym-bench-reps="true" className="font-mono text-xl font-bold text-emerald-300">
                    {benchReps}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-wider text-neutral-400 mb-1.5">
                  Barbell Plates
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {BENCH_WEIGHT_OPTIONS.map((kg) => (
                    <button
                      key={kg}
                      type="button"
                      data-gym-bench-weight={kg}
                      onClick={() => {
                        unlockSfxAudio();
                        playGymBeepSound(660);
                        setBenchWeight(kg);
                      }}
                      className={`rounded-lg py-1.5 text-[11px] font-semibold border cursor-pointer transition-colors ${
                        benchWeightKg === kg
                          ? 'bg-sky-500/25 border-sky-400/55 text-sky-200'
                          : 'bg-white/[0.04] border-white/10 text-neutral-300 hover:bg-white/[0.08]'
                      }`}
                    >
                      {kg}kg
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  data-gym-bench-rep="true"
                  onClick={() => {
                    unlockSfxAudio();
                    playGymBeepSound(720);
                    triggerBenchRep();
                  }}
                  className="py-2.5 rounded-xl text-xs font-semibold border border-emerald-400/50 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30 cursor-pointer"
                >
                  {benchPressing && !benchAutoSet ? 'Pressing...' : 'Press 1 Rep (Space)'}
                </button>
                <button
                  type="button"
                  data-gym-bench-auto="true"
                  onClick={() => {
                    unlockSfxAudio();
                    playGymBeepSound(benchAutoSet ? 500 : 800);
                    toggleBenchAuto();
                  }}
                  className={`py-2.5 rounded-xl text-xs font-semibold border cursor-pointer transition-colors ${
                    benchAutoSet
                      ? 'border-amber-400/55 bg-amber-500/25 text-amber-200'
                      : 'border-white/12 bg-white/[0.05] text-neutral-200 hover:bg-white/[0.1]'
                  }`}
                >
                  {benchAutoSet ? 'Stop Auto Set' : 'Auto Set'}
                </button>
              </div>
            </div>
          )}

          {activeStation === 'dumbbells' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-neutral-400">
                    Hex Dumbbell Curls
                  </div>
                  <div className="text-sm font-semibold text-neutral-100">
                    {dumbbellWeightKg} kg × 2
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-neutral-400">Curls</div>
                  <div data-gym-curl-reps="true" className="font-mono text-xl font-bold text-emerald-300">
                    {curlReps}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-wider text-neutral-400 mb-1.5">
                  Dumbbell Weight
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {DUMBBELL_WEIGHT_OPTIONS.map((kg) => (
                    <button
                      key={kg}
                      type="button"
                      data-gym-db-weight={kg}
                      onClick={() => {
                        unlockSfxAudio();
                        playGymBeepSound(660);
                        setDumbbellWeight(kg);
                      }}
                      className={`rounded-lg py-1.5 text-[11px] font-semibold border cursor-pointer transition-colors ${
                        dumbbellWeightKg === kg
                          ? 'bg-sky-500/25 border-sky-400/55 text-sky-200'
                          : 'bg-white/[0.04] border-white/10 text-neutral-300 hover:bg-white/[0.08]'
                      }`}
                    >
                      {kg}kg
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  data-gym-curl-rep="true"
                  onClick={() => {
                    unlockSfxAudio();
                    playGymBeepSound(720);
                    triggerCurlRep();
                  }}
                  className="py-2.5 rounded-xl text-xs font-semibold border border-emerald-400/50 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30 cursor-pointer"
                >
                  {curlActive && !curlAutoSet ? 'Curling...' : 'Curl 1 Rep (Space)'}
                </button>
                <button
                  type="button"
                  data-gym-curl-auto="true"
                  onClick={() => {
                    unlockSfxAudio();
                    playGymBeepSound(curlAutoSet ? 500 : 800);
                    toggleCurlAuto();
                  }}
                  className={`py-2.5 rounded-xl text-xs font-semibold border cursor-pointer transition-colors ${
                    curlAutoSet
                      ? 'border-amber-400/55 bg-amber-500/25 text-amber-200'
                      : 'border-white/12 bg-white/[0.05] text-neutral-200 hover:bg-white/[0.1]'
                  }`}
                >
                  {curlAutoSet ? 'Stop Auto Set' : 'Auto Set'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
