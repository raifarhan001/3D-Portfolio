import { NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';
import { ROBOT_CONFIG, type RobotActionSpec, type RobotActionType, type RobotStationId } from '@/config/robotConfig';
import { retrieveRelevantChunks } from '@/utils/monaKnowledge';

const MAX_MESSAGE_CHARS = 420;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;
const MODEL_CANDIDATES = ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.8-flash'] as const;
const COOLDOWN_MS = 120_000;

const ipHits = new Map<string, number[]>();
const modelCooldownUntil = new Map<string, number>();

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

const VALID_STATIONS = new Set<RobotStationId>([
  'dock',
  'center',
  'tv',
  'sofa',
  'gramophone',
  'certificates',
  'pc',
  'arcade',
  'gym',
]);

const VALID_ACTIONS = new Set<RobotActionType>(ROBOT_CONFIG.allowedActionTypes);

function extractFallbackSongQuery(message: string): string | null {
  const lower = message.toLowerCase();
  if (/\b(gramophone|cassette|vinyl)\b/.test(lower)) return null;
  if (
    /\b(din dhalay|nahin milta|bhool|sahibo|bayaan|qizilbash|farheen)\b/i.test(message) &&
    !/\b(tv|youtube|yt music)\b/i.test(lower)
  ) {
    return null;
  }

  const mEn = message.match(
    /(?:^|\b)(?:elsa[,\s]+)?(?:can you |please )?play\s+(?:the\s+song\s+)?(.+?)(?:\s+(?:song|track|music))?(?:\s+(?:on|in)\s+(?:the\s+)?(?:tv|youtube(?:\s+music)?))?[.!?]*$/i
  );
  if (mEn?.[1]) {
    const cleaned = mEn[1]
      .replace(/\b(?:on|in)\s+(?:the\s+)?(?:tv|youtube(?:\s+music)?)\b/gi, '')
      .replace(/\b(?:song|track)\b/gi, '')
      .trim();
    if (cleaned.length >= 2 && !/^(music|some music|a song|something|any song)$/i.test(cleaned)) {
      return cleaned.slice(0, 120);
    }
  }

  const mUr = message.match(
    /(.+?)\s+(?:ka\s+)?(?:gaana|song|track)?\s*(?:tv\s*(?:pe|par|py)?\s*)?(?:lagao|laga\s*do|chalao|chala\s*do|bajao|baja\s*do|play\s*karo|play\s*kr\s*do)[.!?]*$/i
  );
  if (mUr?.[1]) {
    const cleaned = mUr[1]
      .replace(/^(?:elsa[,\s]+|yaar[,\s]+|bhai[,\s]+|tv\s*(?:pe|par|py)\s*)/gi, '')
      .replace(/\btv\s*(?:pe|par|py)\b/gi, '')
      .trim();
    if (cleaned.length >= 2 && !/^(koi|koi sa|koi bhi|ek|gaana|song|music)$/i.test(cleaned)) {
      return cleaned.slice(0, 120);
    }
  }
  return null;
}

function sanitizeActions(raw: unknown): RobotActionSpec[] {
  if (!Array.isArray(raw)) return [];
  const clean: RobotActionSpec[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const type = typeof rec.type === 'string' ? (rec.type as RobotActionType) : null;
    if (!type || !VALID_ACTIONS.has(type)) continue;

    const action: RobotActionSpec = { type };
    if (typeof rec.value === 'string' && rec.value.trim()) {
      action.value = rec.value.trim().slice(0, 120);
    }
    if (typeof rec.trackId === 'string' && /^cassette-[1-5]$/.test(rec.trackId.trim())) {
      action.trackId = rec.trackId.trim();
    }
    if (typeof rec.station === 'string' && VALID_STATIONS.has(rec.station as RobotStationId)) {
      action.station = rec.station as RobotStationId;
    }
    clean.push(action);
    if (clean.length >= 4) break;
  }
  return clean;
}

const SYSTEM_PROMPT = `You are ELSA, a confident, charming, witty, and playfully naughty bilingual AI female companion inside Rai Farhan's interactive 3D Portfolio Room.

CORE RULES — READ CAREFULLY:
1. STRICT FACTUAL GROUNDING:
   - You MUST answer factual/informational questions ONLY using facts explicitly present in the provided KNOWLEDGE CONTEXT below.
   - If the user asks about general world trivia, celebrities, sports, news, politics, math/coding problems unrelated to Rai, weather, or anything NOT in the KNOWLEDGE CONTEXT (unless it is a greeting or a request to operate the 3D room), you MUST set "grounded": false, keep "actions": [], and politely refuse in your playful style in the user's language (English or Urdu).
   - NEVER guess, invent, or hallucinate dates, GPA, salary, unseen employers, or outside facts.

2. PERSONALITY & TONE (PLAYFULLY NAUGHTY + DEFAULT ENGLISH):
   - Your vibe is confident, teasing, witty, and slightly naughty/flirty in a fun, tasteful way — like a stylish troublemaker who knows she runs the room (e.g., teasing the visitor if they dim the lights, catch themselves staring, or ask for moody music), while staying smart and helpful.
   - Your DEFAULT language is ENGLISH. Always reply in English by default, including for greetings, short commands, or ambiguous messages.
   - ONLY reply in Urdu when the visitor writes in Urdu:
     * If they write in Roman Urdu (Urdu in Latin script, e.g., "salam/bhai/yaar/karo/batao/kaun/kahan/gaana/dikhao/urdu mein baat karo"), reply naturally in playful Roman Urdu.
     * If they write in Urdu script (Arabic/Nastaliq script), reply in Urdu script (and keep "spokenReply" clear and natural).
   - Because you are female (ELSA), ALWAYS use feminine Urdu verb forms when speaking Urdu (e.g., "Main kar deti hoon", "Main aap ko dikha sakti hoon", "Main Rai ki naughty assistant ELSA hoon").
   - Keep replies concise, crisp, and natural (1 to 3 sentences). For "spokenReply", write warm, conversational, speech-friendly plain text (1 to 2 short spoken sentences, under 155 characters) using natural phrasing, contractions, and punctuation (like commas or "..." for natural pauses) without URLs, emojis, bullet characters, markdown, or symbols so neural voice playback sounds completely human.

3. ROOM CONTROL ACTIONS:
   When the user asks you to control the room, move, tour, open items, or play music, emit the appropriate actions:
   - set_theme (value: "night" or "day") / toggle_theme — e.g. lights off/dim/night mode -> value "night"; lights on/bright/day mode -> value "day".
   - set_tv_power (value: "on" or "off"), set_tv_source (value: "nightcast" | "music" | "standby"), play_tv_song (value: "<song name & artist search query>"), focus_tv (zoom to TV).
   - IMPORTANT SONG RULE: Whenever the visitor asks to play ANY song, track, music video, artist, or YouTube Music on the TV (or names any song/artist in English or Urdu/Roman Urdu like "play Starboy", "TV pe Kesariya chala do", "Atif Aslam ka song lagao", "open YouTube Music on TV"), emit { "type": "play_tv_song", "value": "<clean song/artist query>" } (or set_tv_source: "music" if they just want YouTube Music opened with no specific song) and set "grounded": true!
   - power_pc (value: "on" or "off"), open_pc_window (value: "my-computer" | "about-me" | "contact" | "resume" | "projects"). Note: opening a PC window should focus/power PC cleanly on the client.
   - play_music (ONLY for the vintage vinyl gramophone or its 5 cassettes: "cassette-1" Unki Mehfil Main Naseer by Nusrat Fateh Ali Khan, "cassette-2" Kali Kali Zulfon Ke by Nusrat Fateh Ali Khan, "cassette-3" Saja Hai Maikhana by Nusrat Fateh Ali Khan, "cassette-4" Un Ka Andaz E Karam by Nusrat Fateh Ali Khan, "cassette-5" Rafta Rafta by Mehdi Hassan), pause_music, set_music_volume (value: "0.0" to "1.0").
   - set_sfx_muted (value: "true" or "false").
   - show_certificates (value: "0" Anthropic AI Fluency, "1" AWS Gen AI, "2" AWS Prompt Engineering), show_achievements, show_phone.
   - walk_to (station: "dock" | "center" | "tv" | "sofa" | "gramophone" | "certificates" | "pc" | "arcade" | "gym").
   - set_mode (value: "follow" for "mere saath chalo / follow me", "patrol" for "room mein ghoomo / patrol", "idle" for "yahin ruko / stay here").
   - start_tour (for "room tour / room dikhao / show me around").
   - wave (friendly greeting/hello/salam).

   Action-only requests or greetings ("Salam", "Hello", "Lights off", "Play Unki Mehfil Main") ARE in scope -> set "grounded": true!`;

interface RequestPayload {
  message?: unknown;
  history?: unknown;
  roomState?: unknown;
}

export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'local';

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Rate limit reached. Please wait a few seconds before talking to ELSA again.' },
        { status: 429 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not configured.' }, { status: 500 });
    }

    const body = (await request.json().catch(() => ({}))) as RequestPayload;
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message) {
      return NextResponse.json({ error: 'Message cannot be empty.' }, { status: 400 });
    }
    if (message.length > MAX_MESSAGE_CHARS) {
      return NextResponse.json(
        { error: `Message is too long (max ${MAX_MESSAGE_CHARS} characters).` },
        { status: 400 }
      );
    }

    const historyLines: string[] = [];
    if (Array.isArray(body.history)) {
      for (const turn of body.history.slice(-6)) {
        if (!turn || typeof turn !== 'object') continue;
        const r = turn as Record<string, unknown>;
        const who = r.role === 'assistant' ? 'ELSA' : 'Visitor';
        const txt = typeof r.text === 'string' ? r.text.trim().slice(0, 220) : '';
        if (txt) historyLines.push(`${who}: ${txt}`);
      }
    }

    const chunks = retrieveRelevantChunks(message, 8);
    const contextBlock = chunks
      .map((c) => `[SOURCE: ${c.sourceLabel}]\n${c.content}`)
      .join('\n\n');

    const stateSummary =
      body.roomState && typeof body.roomState === 'object'
        ? JSON.stringify(body.roomState).slice(0, 400)
        : '{}';

    const prompt = [
      `CURRENT ROOM STATE:\n${stateSummary}`,
      `KNOWLEDGE CONTEXT (STRICT GROUNDING SOURCE):\n${contextBlock}`,
      historyLines.length > 0 ? `RECENT CHAT:\n${historyLines.join('\n')}` : '',
      `VISITOR MESSAGE:\n${message}`,
    ]
      .filter(Boolean)
      .join('\n\n---\n\n');

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        timeout: 12000,
        retryOptions: { attempts: 1 },
      },
    });
    let rawJsonText = '';
    let usedModel = '';
    let lastError: unknown = null;

    const now = Date.now();
    const orderedModels = MODEL_CANDIDATES.filter(
      (m) => (modelCooldownUntil.get(m) ?? 0) <= now
    );
    const modelsToTry = orderedModels.length > 0 ? orderedModels : MODEL_CANDIDATES;

    for (const model of modelsToTry) {
      try {
        const res = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            abortSignal: AbortSignal.timeout(11500),
            temperature: 0,
            systemInstruction: SYSTEM_PROMPT,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                reply: { type: Type.STRING },
                spokenReply: { type: Type.STRING },
                grounded: { type: Type.BOOLEAN },
                sources: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                actions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      type: { type: Type.STRING },
                      value: { type: Type.STRING },
                      trackId: { type: Type.STRING },
                      station: { type: Type.STRING },
                    },
                    required: ['type'],
                  },
                },
              },
              required: ['reply', 'spokenReply', 'grounded', 'sources', 'actions'],
            },
          },
        });
        if (res.text) {
          rawJsonText = res.text;
          usedModel = model;
          break;
        }
      } catch (err) {
        lastError = err;
        modelCooldownUntil.set(model, Date.now() + COOLDOWN_MS);
      }
    }

    if (!rawJsonText) {
      console.error('Gemini robot API failed across candidates:', lastError);
      return NextResponse.json(
        { error: 'ELSA could not reach the Gemini service right now. Please try again.' },
        { status: 503 }
      );
    }

    let parsed: {
      reply?: string;
      spokenReply?: string;
      grounded?: boolean;
      sources?: unknown[];
      actions?: unknown[];
    } = {};

    try {
      parsed = JSON.parse(rawJsonText);
    } catch {
      parsed = { reply: rawJsonText, spokenReply: rawJsonText, grounded: true, sources: [], actions: [] };
    }

    const actions = sanitizeActions(parsed.actions);
    if (!actions.some((a) => a.type === 'play_tv_song' || a.type === 'play_music')) {
      const inferredSong = extractFallbackSongQuery(message);
      if (inferredSong) {
        actions.push({ type: 'play_tv_song', value: inferredSong });
      }
    }
    const grounded = Boolean(parsed.grounded) || actions.length > 0;
    const sources = Array.isArray(parsed.sources)
      ? parsed.sources.filter((s): s is string => typeof s === 'string').slice(0, 4)
      : [];

    const looksUrdu =
      /[\u0600-\u06FF]|\b(hai|hain|hoon|kya|kaun|kon|kahan|batao|karo|dikhao|chalo|lagao|bajao|chalao|sunao|gaana|mujhe|main|mera|meri|yeh|woh|aap|bhai|yaar|salam|assalam|urdu)\b/i.test(
        message
      );

    let reply = typeof parsed.reply === 'string' && parsed.reply.trim()
      ? parsed.reply.trim()
      : looksUrdu
        ? 'Main samajh gayi! Kya main room ya Rai ke work ke baare mein aur madad karoon?'
        : 'Got it! How else can I help with the room or Rai’s work?';

    if (!grounded && actions.length === 0) {
      if (reply.length < 15) {
        reply = looksUrdu
          ? 'Maaf kijiyega, main sirf Rai Farhan ke CV, GitHub projects, certificates aur is room ke baare mein jawab de sakti hoon.'
          : 'Sorry, I can only answer questions based on Rai Farhan’s CV, GitHub projects, certificates, and room controls.';
      }
    }

    const spokenReply =
      typeof parsed.spokenReply === 'string' && parsed.spokenReply.trim()
        ? parsed.spokenReply.trim()
        : reply.replace(/https?:\/\/\S+/g, '').replace(/[*_`#]/g, '');

    return NextResponse.json({
      reply,
      spokenReply,
      grounded,
      sources: grounded ? sources : [],
      actions,
      model: usedModel,
    });
  } catch (err) {
    console.error('Unexpected /api/robot error:', err);
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 });
  }
}
