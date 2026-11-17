import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { ROBOT_CONFIG } from '@/config/robotConfig';

const MAX_TTS_CHARS = 360;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 25;
const TTS_MODELS = [
  'gemini-3.8-flash-tts',
  'gemini-2.5-flash-preview-tts',
  'gemini-3.1-flash-tts-preview',
  'gemini-3.8-flash-lite-tts',
] as const;
const COOLDOWN_TRANSIENT_MS = 15_000;
const COOLDOWN_DAILY_QUOTA_MS = 15 * 60_000;

const ipHits = new Map<string, number[]>();
const modelCooldownUntil = new Map<string, number>();
const audioCache = new Map<string, { buf: Buffer; mimeType: string }>();

function wrapPcm16LeAsWav(pcm: Buffer, sampleRate: number, channels: number): Buffer {
  const bitsPerSample = 16;
  const blockAlign = channels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16); // PCM fmt chunk size
  header.writeUInt16LE(1, 20); // PCM linear quantization
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(pcm.length, 40);

  return Buffer.concat([header, pcm]);
}

function ensurePlayableAudio(rawBuf: Buffer, rawMimeType?: string): { buf: Buffer; mimeType: string } {
  const mime = (rawMimeType || 'audio/wav').trim();
  const isRiff = rawBuf.length >= 4 && rawBuf.subarray(0, 4).toString('ascii') === 'RIFF';
  if (isRiff) {
    return { buf: rawBuf, mimeType: 'audio/wav' };
  }

  if (/audio\/(l16|pcm)/i.test(mime)) {
    const rateMatch = mime.match(/rate=(\d+)/i);
    const chMatch = mime.match(/channels=(\d+)/i);
    const sampleRate = Math.min(96000, Math.max(8000, rateMatch ? Number(rateMatch[1]) : 24000));
    const channels = Math.min(2, Math.max(1, chMatch ? Number(chMatch[1]) : 1));
    return {
      buf: wrapPcm16LeAsWav(rawBuf, sampleRate, channels),
      mimeType: 'audio/wav',
    };
  }

  return { buf: rawBuf, mimeType: mime };
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (ipHits.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) {
    ipHits.set(ip, recent);
    return true;
  }
  recent.push(now);
  ipHits.set(ip, recent);
  if (ipHits.size > 500) {
    const oldestKey = ipHits.keys().next().value;
    if (oldestKey) ipHits.delete(oldestKey);
  }
  return false;
}

export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'local';

    if (isRateLimited(ip)) {
      return NextResponse.json({ error: 'TTS rate limited' }, { status: 429 });
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing GEMINI_API_KEY' }, { status: 500 });
    }

    const body = (await request.json().catch(() => ({}))) as { text?: unknown };
    const cleanText =
      typeof body.text === 'string'
        ? body.text
            .replace(/https?:\/\/\S+/g, '')
            .replace(/[*_`#>]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, MAX_TTS_CHARS)
        : '';

    if (!cleanText) {
      return NextResponse.json({ error: 'Text required' }, { status: 400 });
    }

    const cacheKey = `${ROBOT_CONFIG.ttsVoiceName}:${cleanText}`;
    const cached = audioCache.get(cacheKey);
    if (cached) {
      return new Response(new Uint8Array(cached.buf), {
        status: 200,
        headers: {
          'Content-Type': cached.mimeType,
          'X-Mona-Tts-Cache': 'HIT',
          'Cache-Control': 'private, max-age=3600',
        },
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        apiVersion: 'v1beta',
        timeout: 15000,
        retryOptions: { attempts: 1 },
      },
    });

    const now = Date.now();
    const availableModels = TTS_MODELS.filter((m) => (modelCooldownUntil.get(m) ?? 0) <= now);
    const modelsToTry = availableModels.length > 0 ? availableModels : TTS_MODELS;
    let lastError: unknown = null;

    for (const model of modelsToTry) {
      try {
        const res = await ai.models.generateContent({
          model,
          contents: cleanText,
          config: {
            abortSignal: AbortSignal.timeout(14500),
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: ROBOT_CONFIG.ttsVoiceName },
              },
            },
          },
        });

        const parts = res.candidates?.[0]?.content?.parts ?? [];
        const inline = parts.find((p) => p.inlineData?.data)?.inlineData;
        if (!inline?.data) continue;

        const rawBuf = Buffer.from(inline.data, 'base64');
        if (rawBuf.length === 0) continue;

        const { buf, mimeType } = ensurePlayableAudio(rawBuf, inline.mimeType);

        audioCache.set(cacheKey, { buf, mimeType });
        if (audioCache.size > 30) {
          const oldest = audioCache.keys().next().value;
          if (oldest) audioCache.delete(oldest);
        }

        return new Response(new Uint8Array(buf), {
          status: 200,
          headers: {
            'Content-Type': mimeType,
            'X-Mona-Tts-Model': model,
            'X-Mona-Tts-Cache': 'MISS',
            'Cache-Control': 'private, max-age=3600',
          },
        });
      } catch (err) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        const cooldown = /PerDay|QuotaFailure|GenerateRequestsPerDay/i.test(msg)
          ? COOLDOWN_DAILY_QUOTA_MS
          : COOLDOWN_TRANSIENT_MS;
        modelCooldownUntil.set(model, Date.now() + cooldown);
      }
    }

    console.warn(
      'Gemini TTS unavailable across candidates:',
      lastError instanceof Error ? lastError.message.slice(0, 220) : String(lastError).slice(0, 220)
    );
    return NextResponse.json({ error: 'Gemini TTS unavailable, use browser fallback' }, { status: 503 });
  } catch {
    return NextResponse.json({ error: 'TTS failed' }, { status: 500 });
  }
}
