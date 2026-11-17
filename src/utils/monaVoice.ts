'use client';

import { useSfxStore } from '@/stores/sfxStore';
import { getUnlockedAudioContext, unlockSfxAudio } from '@/utils/sound';

export type MonaVoiceMode = 'auto' | 'browser' | 'off';

let activeSource: AudioBufferSourceNode | null = null;
let activeHtmlAudio: HTMLAudioElement | null = null;
let activeHtmlUrl: string | null = null;
let activeUtterance: SpeechSynthesisUtterance | null = null;
let activeFetchController: AbortController | null = null;
let activePlayId = 0;
let browserDelayTimer: ReturnType<typeof setTimeout> | null = null;
let browserStartWatchdog: ReturnType<typeof setTimeout> | null = null;
let browserEndWatchdog: ReturnType<typeof setTimeout> | null = null;
let cachedVoices: SpeechSynthesisVoice[] = [];
let voicesListenerBound = false;

interface CachedTtsAudio {
  bytes: ArrayBuffer;
  mimeType: string;
}

const decodedBufferCache = new Map<string, CachedTtsAudio>();

const MALE_VOICE_PATTERNS = [
  'david',
  'mark',
  'george',
  'richard',
  'james',
  'guy',
  'stefan',
  'ravi',
  'pawan',
  'male',
  'google us english', // Note: Google US English Female is explicitly excluded from male check
];

const FEMALE_VOICE_PRIORITY = [
  // Google Chrome female voices
  'google uk english female',
  'google us english female',
  // Windows / Edge female voices
  'zira',
  'aria',
  'jenny',
  'hazel',
  'catherine',
  'susan',
  'ava',
  'sonia',
  'libby',
  // Apple / iOS / Android female voices
  'samantha',
  'victoria',
  'karen',
  'moira',
  'tessa',
  'veena',
  'neerja',
  'allison',
  // Generic tags
  'female',
  'woman',
];

export function isMaleVoice(voice: SpeechSynthesisVoice): boolean {
  const name = voice.name.toLowerCase();
  if (name.includes('female') || name.includes('woman')) return false;
  return MALE_VOICE_PATTERNS.some((m) => name.includes(m));
}

export function selectFemaleVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices.length) return null;

  // 1. High priority: known female names from prioritized list, filtering out any male voice
  for (const hint of FEMALE_VOICE_PRIORITY) {
    const found = voices.find(
      (v) => v.name.toLowerCase().includes(hint) && !isMaleVoice(v)
    );
    if (found) return found;
  }

  // 2. Any voice explicitly declaring female/woman in its name or lang
  const femaleExplicit = voices.find(
    (v) =>
      !isMaleVoice(v) &&
      (v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('woman'))
  );
  if (femaleExplicit) return femaleExplicit;

  // 3. Any non-male English voice
  const nonMaleEn = voices.find(
    (v) => !isMaleVoice(v) && v.lang.toLowerCase().startsWith('en')
  );
  if (nonMaleEn) return nonMaleEn;

  // 4. Any non-male voice of any language
  const nonMaleAny = voices.find((v) => !isMaleVoice(v));
  if (nonMaleAny) return nonMaleAny;

  // Under NO circumstance return a male voice (e.g. David / Mark).
  // Return null so the speech engine shifts pitch upward into a feminine register.
  return null;
}

function sanitizeForSpeech(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[*_`#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 360);
}

function refreshVoicesCache(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return cachedVoices;
  const synth = window.speechSynthesis;
  if (!voicesListenerBound && typeof synth.addEventListener === 'function') {
    voicesListenerBound = true;
    synth.addEventListener('voiceschanged', () => {
      const list = synth.getVoices();
      if (list.length > 0) cachedVoices = list;
    });
  }
  const current = synth.getVoices();
  if (current.length > 0) {
    cachedVoices = current;
  }
  return cachedVoices;
}

async function waitForVoices(maxWaitMs = 350): Promise<SpeechSynthesisVoice[]> {
  const immediate = refreshVoicesCache();
  if (immediate.length > 0) return immediate;
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];

  const synth = window.speechSynthesis;
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (typeof synth.removeEventListener === 'function') {
        synth.removeEventListener('voiceschanged', onChanged);
      }
      resolve(refreshVoicesCache());
    };
    const onChanged = () => {
      if (synth.getVoices().length > 0) finish();
    };
    const timer = setTimeout(finish, maxWaitMs);
    if (typeof synth.addEventListener === 'function') {
      synth.addEventListener('voiceschanged', onChanged);
    }
  });
}

function splitSpeechChunks(text: string): string[] {
  const normalized = text.replace(/\s*[\u2014\u2013]\s*/g, ', ').replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  if (normalized.length <= 140) return [normalized];

  const sentences = normalized.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current = '';

  const pushPart = (part: string) => {
    if (!part) return;
    if (!current) {
      current = part;
    } else if (current.length + 1 + part.length <= 140) {
      current = `${current} ${part}`;
    } else {
      chunks.push(current);
      current = part;
    }
  };

  for (const sentence of sentences) {
    if (sentence.length <= 140) {
      pushPart(sentence);
      continue;
    }
    const clauses = sentence.split(/(?<=[,;:])\s+/);
    for (const clause of clauses) {
      if (clause.length <= 140) {
        pushPart(clause);
      } else {
        const words = clause.split(/\s+/);
        for (const w of words) pushPart(w);
      }
    }
  }
  if (current) chunks.push(current);
  return chunks.length > 0 ? chunks : [normalized.slice(0, 140)];
}

function clearBrowserTimers(): void {
  if (browserDelayTimer) {
    clearTimeout(browserDelayTimer);
    browserDelayTimer = null;
  }
  if (browserStartWatchdog) {
    clearTimeout(browserStartWatchdog);
    browserStartWatchdog = null;
  }
  if (browserEndWatchdog) {
    clearTimeout(browserEndWatchdog);
    browserEndWatchdog = null;
  }
}

function releaseActiveHtmlAudio(): void {
  if (activeHtmlAudio) {
    try {
      activeHtmlAudio.onplay = null;
      activeHtmlAudio.onended = null;
      activeHtmlAudio.onerror = null;
      activeHtmlAudio.pause();
      activeHtmlAudio.currentTime = 0;
      activeHtmlAudio.src = '';
    } catch {
      // Ignore audio cleanup errors
    }
    activeHtmlAudio = null;
  }
  if (activeHtmlUrl) {
    try {
      URL.revokeObjectURL(activeHtmlUrl);
    } catch {
      // Ignore URL cleanup errors
    }
    activeHtmlUrl = null;
  }
}

/**
 * Call synchronously inside user click / keypress handlers so Chrome keeps
 * Web Audio & SpeechSynthesis unlocked across async /api/robot + /api/robot/tts fetches.
 */
export function warmUpMonaSpeech(): void {
  unlockSfxAudio();
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      refreshVoicesCache();
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    } catch {
      // ignore warmup issues
    }
  }
}

export function stopMonaSpeech(onEnd?: () => void) {
  activePlayId += 1;
  clearBrowserTimers();
  if (activeFetchController) {
    try {
      activeFetchController.abort();
    } catch {
      // Ignore abort errors
    }
    activeFetchController = null;
  }
  if (activeSource) {
    try {
      activeSource.onended = null;
      activeSource.stop();
      activeSource.disconnect();
    } catch {
      // Ignore already-stopped source
    }
    activeSource = null;
  }
  releaseActiveHtmlAudio();
  if (activeUtterance) {
    activeUtterance.onstart = null;
    activeUtterance.onend = null;
    activeUtterance.onerror = null;
    activeUtterance = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      const synth = window.speechSynthesis;
      // Only cancel when actually speaking/queued/paused; calling cancel() when idle
      // can wedge Chrome's Windows SAPI speech queue on the subsequent speak().
      if (synth.speaking || synth.pending || synth.paused) {
        synth.cancel();
      }
    } catch {
      // Ignore synthesis cancel errors
    }
  }
  onEnd?.();
}

async function speakWithBrowserFallback(
  cleanText: string,
  playId: number,
  callbacks: { onStart?: () => void; onEnd?: () => void }
): Promise<void> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    if (activePlayId === playId) callbacks.onEnd?.();
    return;
  }

  try {
    const synth = window.speechSynthesis;
    const voices = await waitForVoices(350);
    if (activePlayId !== playId || useSfxStore.getState().muted) {
      if (activePlayId === playId) callbacks.onEnd?.();
      return;
    }

    const needCancel = synth.speaking || synth.pending || synth.paused;
    if (needCancel) {
      synth.cancel();
    }

    const chunks = splitSpeechChunks(cleanText);
    if (chunks.length === 0) {
      callbacks.onEnd?.();
      return;
    }

    let startedAny = false;
    let finishedAll = false;
    const finishAll = () => {
      if (finishedAll) return;
      finishedAll = true;
      clearBrowserTimers();
      if (activeUtterance) {
        activeUtterance.onstart = null;
        activeUtterance.onend = null;
        activeUtterance.onerror = null;
        activeUtterance = null;
      }
      if (activePlayId === playId) callbacks.onEnd?.();
    };

    const speakChunk = (idx: number, isRetry = false) => {
      if (finishedAll || activePlayId !== playId || useSfxStore.getState().muted) {
        finishAll();
        return;
      }
      if (idx >= chunks.length) {
        finishAll();
        return;
      }

      const chunkText = chunks[idx];
      const utter = new SpeechSynthesisUtterance(chunkText);
      activeUtterance = utter;

      const voicePool = voices.length > 0 ? voices : refreshVoicesCache();
      const picked = selectFemaleVoice(voicePool);

      if (picked) {
        utter.voice = picked;
        // Natural feminine timbre
        utter.pitch = 1.15;
      } else {
        // Guarantee female tone even if the host platform lacks labeled female voices
        utter.pitch = 1.35;
      }
      utter.rate = 0.98;
      utter.volume = 0.95;

      let chunkStarted = false;
      let chunkSettled = false;

      const advance = () => {
        if (chunkSettled) return;
        chunkSettled = true;
        clearBrowserTimers();
        if (activeUtterance === utter) activeUtterance = null;
        if (activePlayId !== playId || useSfxStore.getState().muted) {
          finishAll();
          return;
        }
        browserDelayTimer = setTimeout(() => {
          browserDelayTimer = null;
          speakChunk(idx + 1, false);
        }, 35);
      };

      utter.onstart = () => {
        chunkStarted = true;
        if (browserStartWatchdog) {
          clearTimeout(browserStartWatchdog);
          browserStartWatchdog = null;
        }
        if (activePlayId === playId && !startedAny) {
          startedAny = true;
          callbacks.onStart?.();
        }
        const maxChunkMs = Math.max(9000, chunkText.length * 160);
        browserEndWatchdog = setTimeout(() => {
          browserEndWatchdog = null;
          if (!chunkSettled && activePlayId === playId) {
            if (synth.speaking || synth.pending) synth.cancel();
            advance();
          }
        }, maxChunkMs);
      };

      utter.onend = () => {
        advance();
      };

      utter.onerror = () => {
        if (chunkSettled) return;
        if (activePlayId !== playId) return;
        if (!chunkStarted && !isRetry) {
          chunkSettled = true;
          clearBrowserTimers();
          if (synth.speaking || synth.pending || synth.paused) synth.cancel();
          browserDelayTimer = setTimeout(() => {
            browserDelayTimer = null;
            speakChunk(idx, true);
          }, 120);
          return;
        }
        advance();
      };

      // Guard against Chrome SAPI wedging silently with zero start/end/error events
      browserStartWatchdog = setTimeout(() => {
        browserStartWatchdog = null;
        if (chunkStarted || chunkSettled || activePlayId !== playId) return;
        chunkSettled = true;
        if (synth.speaking || synth.pending || synth.paused) synth.cancel();
        if (!isRetry) {
          browserDelayTimer = setTimeout(() => {
            browserDelayTimer = null;
            speakChunk(idx, true);
          }, 150);
        } else {
          finishAll();
        }
      }, 4200);

      synth.speak(utter);
      if (synth.paused) synth.resume();
    };

    const initialDelayMs = needCancel ? 75 : 0;
    if (initialDelayMs > 0) {
      browserDelayTimer = setTimeout(() => {
        browserDelayTimer = null;
        speakChunk(0, false);
      }, initialDelayMs);
    } else {
      speakChunk(0, false);
    }
  } catch {
    if (activePlayId === playId) callbacks.onEnd?.();
  }
}

async function playViaWebAudioOrElement(
  rawBytes: ArrayBuffer,
  mimeType: string,
  playId: number,
  callbacks: { onStart?: () => void; onEnd?: () => void }
): Promise<boolean> {
  const ctx = getUnlockedAudioContext();
  if (ctx) {
    try {
      if (ctx.state === 'suspended') {
        await Promise.race([
          ctx.resume(),
          new Promise<void>((resolve) => setTimeout(resolve, 450)),
        ]);
      }
      if (activePlayId !== playId) return true;
      if (useSfxStore.getState().muted) {
        callbacks.onEnd?.();
        return true;
      }

      if (ctx.state === 'running') {
        const decoded = await ctx.decodeAudioData(rawBytes.slice(0));
        if (activePlayId !== playId) return true;
        if (useSfxStore.getState().muted) {
          callbacks.onEnd?.();
          return true;
        }

        const src = ctx.createBufferSource();
        const gain = ctx.createGain();
        gain.gain.value = 0.95;
        src.buffer = decoded;
        src.connect(gain);
        gain.connect(ctx.destination);
        activeSource = src;

        callbacks.onStart?.();
        src.onended = () => {
          if (activeSource === src) activeSource = null;
          try {
            src.disconnect();
            gain.disconnect();
          } catch {
            // Ignore disconnect errors
          }
          if (activePlayId === playId) callbacks.onEnd?.();
        };
        src.start(0);
        return true;
      }
    } catch {
      // Fall through to HTMLAudioElement attempt below
    }
  }

  try {
    releaseActiveHtmlAudio();
    const blob = new Blob([rawBytes], { type: mimeType || 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.volume = 0.92;
    activeHtmlAudio = audio;
    activeHtmlUrl = url;

    let started = false;
    await new Promise<void>((resolve, reject) => {
      audio.onplay = () => {
        if (!started) {
          started = true;
          if (activePlayId === playId) callbacks.onStart?.();
          resolve();
        }
      };
      audio.onended = () => {
        if (activeHtmlAudio === audio) releaseActiveHtmlAudio();
        if (activePlayId === playId) callbacks.onEnd?.();
      };
      audio.onerror = () => {
        if (activeHtmlAudio === audio) releaseActiveHtmlAudio();
        if (!started) {
          reject(new Error('HTMLAudio playback error'));
        } else if (activePlayId === playId) {
          callbacks.onEnd?.();
        }
      };
      audio.play().then(
        () => {
          if (!started) {
            started = true;
            if (activePlayId === playId) callbacks.onStart?.();
            resolve();
          }
        },
        (err) => {
          if (activeHtmlAudio === audio) releaseActiveHtmlAudio();
          reject(err);
        }
      );
    });

    if (activePlayId !== playId) {
      if (activeHtmlAudio === audio) releaseActiveHtmlAudio();
      return true;
    }
    if (useSfxStore.getState().muted) {
      if (activeHtmlAudio === audio) releaseActiveHtmlAudio();
      callbacks.onEnd?.();
      return true;
    }
    return true;
  } catch {
    releaseActiveHtmlAudio();
    return false;
  }
}

const inflightPrefetches = new Set<string>();

/**
 * Silently preloads neural TTS audio into decodedBufferCache so entry greetings play immediately.
 */
export function prefetchMonaSpeech(rawText: string): void {
  if (typeof window === 'undefined') return;
  const cleanText = sanitizeForSpeech(rawText);
  if (!cleanText || decodedBufferCache.has(cleanText) || inflightPrefetches.has(cleanText)) return;
  inflightPrefetches.add(cleanText);
  void fetch('/api/robot/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: cleanText }),
  })
    .then(async (res) => {
      if (!res.ok) return;
      const mimeType = res.headers.get('content-type') || 'audio/wav';
      const bytes = await res.arrayBuffer();
      if (bytes.byteLength > 0) {
        decodedBufferCache.set(cleanText, { bytes, mimeType });
      }
    })
    .catch(() => {
      // Ignore prefetch errors; normal fallback handles live calls
    })
    .finally(() => {
      inflightPrefetches.delete(cleanText);
    });
}

export async function speakMonaText(
  rawText: string,
  voiceMode: MonaVoiceMode,
  callbacks: { onStart?: () => void; onEnd?: () => void } = {}
): Promise<void> {
  stopMonaSpeech();
  if (voiceMode === 'off' || useSfxStore.getState().muted) {
    callbacks.onEnd?.();
    return;
  }

  const cleanText = sanitizeForSpeech(rawText);
  if (!cleanText) {
    callbacks.onEnd?.();
    return;
  }

  const playId = ++activePlayId;

  if (voiceMode === 'browser') {
    await speakWithBrowserFallback(cleanText, playId, callbacks);
    return;
  }

  try {
    let cached = decodedBufferCache.get(cleanText);
    if (!cached) {
      const controller = new AbortController();
      activeFetchController = controller;
      const fetchTimer = setTimeout(() => controller.abort(), 16000);
      let res: Response;
      try {
        res = await fetch('/api/robot/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: cleanText }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(fetchTimer);
        if (activeFetchController === controller) {
          activeFetchController = null;
        }
      }

      if (activePlayId !== playId) return;
      if (!res.ok) throw new Error(`TTS HTTP ${res.status}`);

      const mimeType = res.headers.get('content-type') || 'audio/wav';
      const bytes = await res.arrayBuffer();
      if (activePlayId !== playId) return;

      cached = { bytes, mimeType };
      decodedBufferCache.set(cleanText, cached);
      if (decodedBufferCache.size > 25) {
        const oldestKey = decodedBufferCache.keys().next().value;
        if (oldestKey) decodedBufferCache.delete(oldestKey);
      }
    }

    if (activePlayId !== playId) return;
    if (useSfxStore.getState().muted) {
      callbacks.onEnd?.();
      return;
    }

    const played = await playViaWebAudioOrElement(cached.bytes, cached.mimeType, playId, callbacks);
    if (!played && activePlayId === playId && !useSfxStore.getState().muted) {
      await speakWithBrowserFallback(cleanText, playId, callbacks);
    }
  } catch {
    if (activePlayId === playId && !useSfxStore.getState().muted) {
      await speakWithBrowserFallback(cleanText, playId, callbacks);
    } else if (activePlayId === playId) {
      callbacks.onEnd?.();
    }
  }
}
