'use client';

import { useEffect, useRef, useCallback } from 'react';
import { GRAMOPHONE_CONFIG, type GramophoneTrack } from '@/config/roomConfig';
import { useTvStore } from '@/stores/tvStore';
import { useAchievementStore } from '@/stores/achievementStore';

/**
 * GramophoneAudio — Headless audio controller for the Gramophone & Cassette Box.
 * Plays real MP3/WAV files from /public/audio/ when present, and gracefully falls
 * back to a warm Web Audio chord loop preview if the user hasn't added files yet.
 */
export default function GramophoneAudio() {
  const gramophonePlaying = useTvStore((s) => s.gramophonePlaying);
  const gramophoneTrackId = useTvStore((s) => s.gramophoneTrackId);
  const gramophoneVolume = useTvStore((s) => s.gramophoneVolume);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const usingFallbackRef = useRef(false);

  const stopWebAudioPreview = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    usingFallbackRef.current = false;
  }, []);

  const stopHtmlAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.oncanplay = null;
      audioRef.current.onerror = null;
      audioRef.current.src = '';
      audioRef.current = null;
    }
  }, []);

  const startWebAudioPreview = useCallback(
    (track: GramophoneTrack, volume: number) => {
      stopWebAudioPreview();
      usingFallbackRef.current = true;
      useTvStore.getState().setGramophoneFallbackActive(true);

      if (typeof window === 'undefined') return;
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        void ctx.resume();
      }

      if (!masterGainRef.current) {
        masterGainRef.current = ctx.createGain();
        masterGainRef.current.connect(ctx.destination);
      }
      masterGainRef.current.gain.setValueAtTime(volume * 0.22, ctx.currentTime);

      let step = 0;
      const playNote = () => {
        if (!audioCtxRef.current || !masterGainRef.current) return;
        const now = ctx.currentTime;
        const freq = track.notes[step % track.notes.length];
        step += 1;

        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const env = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(950, now);

        env.gain.setValueAtTime(0.001, now);
        env.gain.linearRampToValueAtTime(0.45, now + 0.08);
        env.gain.exponentialRampToValueAtTime(0.001, now + 1.15);

        osc.connect(filter);
        filter.connect(env);
        env.connect(masterGainRef.current);

        osc.start(now);
        osc.stop(now + 1.2);
      };

      playNote();
      intervalRef.current = setInterval(playNote, 650);
    },
    [stopWebAudioPreview]
  );

  // Handle track & play/pause changes
  useEffect(() => {
    stopHtmlAudio();
    stopWebAudioPreview();

    if (!gramophonePlaying || !gramophoneTrackId) {
      useTvStore.getState().setGramophoneFallbackActive(false);
      return;
    }

    const track = GRAMOPHONE_CONFIG.tracks.find((t) => t.id === gramophoneTrackId);
    if (!track) return;

    let cancelled = false;
    const audio = new Audio();
    audio.src = track.src;
    audio.loop = true;
    audio.volume = useTvStore.getState().gramophoneVolume;
    audioRef.current = audio;

    audio.onerror = () => {
      if (cancelled) return;
      stopHtmlAudio();
      startWebAudioPreview(track, useTvStore.getState().gramophoneVolume);
    };

    audio.play().catch(() => {
      if (cancelled) return;
      stopHtmlAudio();
      startWebAudioPreview(track, useTvStore.getState().gramophoneVolume);
    });

    return () => {
      cancelled = true;
      stopHtmlAudio();
      stopWebAudioPreview();
    };
  }, [gramophonePlaying, gramophoneTrackId, stopHtmlAudio, stopWebAudioPreview, startWebAudioPreview]);

  // Spatial 3D Audio distance attenuation loop
  useEffect(() => {
    if (!gramophonePlaying) return;
    useAchievementStore.getState().unlock('vinyl');

    const updateSpatialVolume = () => {
      const pos = (window as unknown as { __cameraPos?: [number, number, number] }).__cameraPos;
      let factor = 1.0;
      if (pos) {
        const dx = pos[0] - (-4.38);
        const dz = pos[2] - (-4.38);
        const dist = Math.sqrt(dx * dx + dz * dz);
        // At gramophone table (< 2.0m) -> 1.0; at opposite corners (7-9m) -> smooth roll-off to 0.25
        factor = Math.max(0.25, Math.min(1.0, 1.0 - (dist - 1.8) * 0.12));
      }

      const effectiveVol = useTvStore.getState().gramophoneVolume * factor;
      if (audioRef.current) {
        audioRef.current.volume = Math.max(0, Math.min(1, effectiveVol));
      }
      if (masterGainRef.current && audioCtxRef.current) {
        masterGainRef.current.gain.setValueAtTime(
          effectiveVol * 0.22,
          audioCtxRef.current.currentTime
        );
      }
    };

    updateSpatialVolume();
    const interval = setInterval(updateSpatialVolume, 100);
    return () => clearInterval(interval);
  }, [gramophonePlaying, gramophoneVolume]);

  return null;
}
