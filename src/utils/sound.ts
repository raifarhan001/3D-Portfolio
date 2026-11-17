import { useSfxStore } from '@/stores/sfxStore';

let sharedAudioCtx: AudioContext | null = null;

function ensureAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!sharedAudioCtx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      sharedAudioCtx = new Ctor();
    } catch {
      return null;
    }
  }
  if (sharedAudioCtx.state === 'suspended') {
    try {
      void sharedAudioCtx.resume().catch(() => {});
    } catch {
      // ignore resume failure prior to user gesture
    }
  }
  return sharedAudioCtx;
}

let silentPrimed = false;

function primeSilentAudioBuffer(ctx: AudioContext): void {
  if (silentPrimed || ctx.state !== 'running') return;
  silentPrimed = true;
  try {
    const buf = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
  } catch {
    // ignore unlock buffer failure
  }
}

export function unlockSfxAudio(): void {
  const ctx = ensureAudioContext();
  if (!ctx || silentPrimed) return;
  if (ctx.state === 'running') {
    primeSilentAudioBuffer(ctx);
    return;
  }
  try {
    void ctx
      .resume()
      .then(() => {
        primeSilentAudioBuffer(ctx);
      })
      .catch(() => {});
  } catch {
    // ignore resume failure prior to user gesture
  }
}

export function getUnlockedAudioContext(): AudioContext | null {
  return ensureAudioContext();
}

export interface PlayToneOptions {
  freq: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  slideTo?: number;
}

export function playTone({
  freq,
  duration,
  type = 'sine',
  gain = 0.08,
  slideTo,
}: PlayToneOptions): void {
  if (useSfxStore.getState().muted) return;
  const ctx = ensureAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const dur = Math.max(0.015, duration);
    const osc = ctx.createOscillator();
    const gNode = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), now);
    if (typeof slideTo === 'number' && slideTo > 0) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + dur);
    }

    const peak = Math.max(0.001, Math.min(0.4, gain));
    gNode.gain.setValueAtTime(0.0001, now);
    gNode.gain.linearRampToValueAtTime(peak, now + Math.min(0.01, dur * 0.25));
    gNode.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.connect(gNode);
    gNode.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + dur + 0.02);
    osc.onended = () => {
      try {
        osc.disconnect();
        gNode.disconnect();
      } catch {
        // ignore disconnect errors
      }
    };
  } catch {
    // ignore WebAudio runtime issues
  }
}

export function playSwitchClickSound(isNightNext: boolean): void {
  playTone({
    freq: isNightNext ? 480 : 620,
    slideTo: isNightNext ? 260 : 410,
    duration: 0.045,
    type: 'triangle',
    gain: 0.1,
  });
}

export function playSnakeStartSound(): void {
  playTone({
    freq: 360,
    slideTo: 720,
    duration: 0.11,
    type: 'square',
    gain: 0.055,
  });
}

export function playSnakeEatSound(): void {
  playTone({
    freq: 520,
    slideTo: 920,
    duration: 0.075,
    type: 'triangle',
    gain: 0.08,
  });
}

export function playSnakeGameOverSound(): void {
  playTone({
    freq: 390,
    slideTo: 110,
    duration: 0.28,
    type: 'sawtooth',
    gain: 0.07,
  });
}

export function playGymBeepSound(freq = 740): void {
  playTone({
    freq,
    slideTo: freq * 1.12,
    duration: 0.055,
    type: 'sine',
    gain: 0.055,
  });
}

export function playGymPlateClinkSound(): void {
  playTone({
    freq: 980,
    slideTo: 620,
    duration: 0.075,
    type: 'triangle',
    gain: 0.065,
  });
}

export function playKeyClickSound(): void {
  playTone({
    freq: 720 + Math.random() * 160,
    slideTo: 320,
    duration: 0.032,
    type: 'triangle',
    gain: 0.045,
  });
}

export function playAchievementChime(): void {
  playTone({
    freq: 587.33, // D5
    slideTo: 880, // A5
    duration: 0.18,
    type: 'sine',
    gain: 0.11,
  });
  setTimeout(() => {
    playTone({
      freq: 880,
      slideTo: 1174.66, // D6
      duration: 0.32,
      type: 'sine',
      gain: 0.13,
    });
  }, 110);
}
