'use client';

import { create } from 'zustand';
import { useAchievementStore } from '@/stores/achievementStore';
import { useSfxStore } from '@/stores/sfxStore';

export type RoomWeather = 'clear' | 'sunset' | 'rain';

interface WeatherState {
  weather: RoomWeather;
  rainVolume: number;
  setWeather: (weather: RoomWeather) => void;
  cycleWeather: () => RoomWeather;
}

let rainAudioNode: {
  ctx: AudioContext;
  gain: GainNode;
  source: AudioBufferSourceNode;
  lfo: OscillatorNode;
} | null = null;

function startRainSynthesizer(volume = 0.22): void {
  if (rainAudioNode) return;
  if (typeof window === 'undefined') return;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;

  try {
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }

    // Generate 4 seconds of smooth pink/rain noise buffer
    const bufferSize = ctx.sampleRate * 4;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      data[i] = (b0 + b1 + b2 + white * 0.04) * 0.28;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    // Filter to warm rain frequency band
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, ctx.currentTime);

    // LFO for natural gusting swell
    const lfo = ctx.createOscillator();
    lfo.frequency.setValueAtTime(0.2, ctx.currentTime);
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(0.04, ctx.currentTime);
    lfo.connect(lfoGain.gain);

    const gain = ctx.createGain();
    const isMuted = useSfxStore.getState().muted;
    gain.gain.setValueAtTime(isMuted ? 0 : volume, ctx.currentTime);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    source.start(0);
    lfo.start(0);

    rainAudioNode = { ctx, gain, source, lfo };
  } catch {
    // Ignore audio initialization errors
  }
}

function stopRainSynthesizer(): void {
  if (!rainAudioNode) return;
  try {
    rainAudioNode.gain.gain.linearRampToValueAtTime(0.001, rainAudioNode.ctx.currentTime + 0.3);
    setTimeout(() => {
      try {
        rainAudioNode?.source.stop();
        rainAudioNode?.lfo.stop();
        rainAudioNode?.source.disconnect();
        rainAudioNode?.gain.disconnect();
      } catch {
        // ignore
      }
      rainAudioNode = null;
    }, 350);
  } catch {
    rainAudioNode = null;
  }
}

export const useWeatherStore = create<WeatherState>((set, get) => ({
  weather: 'clear',
  rainVolume: 0.24,

  setWeather: (weather) => {
    set({ weather });
    if (weather === 'rain') {
      useAchievementStore.getState().unlock('night');
      startRainSynthesizer(get().rainVolume);
    } else {
      stopRainSynthesizer();
    }
  },

  cycleWeather: () => {
    const list: RoomWeather[] = ['clear', 'sunset', 'rain'];
    const next = list[(list.indexOf(get().weather) + 1) % list.length];
    get().setWeather(next);
    return next;
  },
}));
