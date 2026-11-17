'use client';

import { useEffect, useRef, useState } from 'react';
import { ROBOT_CONFIG } from '@/config/robotConfig';
import { useInputStore } from '@/stores/inputStore';
import { useRobotStore } from '@/stores/robotStore';
import { useSfxStore } from '@/stores/sfxStore';
import { useAchievementStore } from '@/stores/achievementStore';
import { warmUpMonaSpeech, type MonaVoiceMode } from '@/utils/monaVoice';

export default function RobotChatUI() {
  const inputMode = useInputStore((s) => s.mode);
  const focusKind = useInputStore((s) => s.focusKind);
  const focusExiting = useInputStore((s) => s.focusExiting);

  const messages = useRobotStore((s) => s.messages);
  const isThinking = useRobotStore((s) => s.isThinking);
  const isSpeaking = useRobotStore((s) => s.isSpeaking);
  const mode = useRobotStore((s) => s.mode);
  const station = useRobotStore((s) => s.station);
  const voiceMode = useRobotStore((s) => s.voiceMode);
  const bubbleText = useRobotStore((s) => s.bubbleText);
  const bubbleUntil = useRobotStore((s) => s.bubbleUntil);
  const sendMessage = useRobotStore((s) => s.sendMessage);
  const setVoiceMode = useRobotStore((s) => s.setVoiceMode);
  const setMode = useRobotStore((s) => s.setMode);
  const speak = useRobotStore((s) => s.speak);
  const stopAllVoice = useRobotStore((s) => s.stopAllVoice);

  const sfxMuted = useSfxStore((s) => s.muted);
  const setSfxMuted = useSfxStore((s) => s.setMuted);

  const [draft, setDraft] = useState('');
  const [nowMs, setNowMs] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [micNotice, setMicNotice] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasGreetedRef = useRef(false);
  const recognitionRef = useRef<any>(null);

  const isChatOpen = inputMode === 'focus' && focusKind === 'robot' && !focusExiting;

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 400);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!isChatOpen) return;
    const t = setTimeout(() => inputRef.current?.focus(), 120);
    if (!hasGreetedRef.current) {
      hasGreetedRef.current = true;
      const current = useRobotStore.getState();
      const mutedNow = useSfxStore.getState().muted;
      if (
        !current.hasWelcomedEntry &&
        current.messages.length === 1 &&
        !mutedNow &&
        current.voiceMode !== 'off'
      ) {
        current.speak(current.messages[0].text);
      }
    }
    return () => clearTimeout(t);
  }, [isChatOpen]);

  useEffect(() => {
    if (sfxMuted) stopAllVoice();
  }, [sfxMuted, stopAllVoice]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isThinking, isChatOpen]);

  const handleExit = (lockPointer: boolean) => {
    const win = window as unknown as { __exitCurrentFocus?: (lock?: boolean) => void };
    win.__exitCurrentFocus?.(lockPointer);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || isThinking) return;
    warmUpMonaSpeech();
    useAchievementStore.getState().unlock('ai_chat');
    const msg = draft;
    setDraft('');
    void sendMessage(msg);
  };

  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      setIsListening(false);
      return;
    }

    if (typeof window === 'undefined') return;
    const win = window as unknown as {
      SpeechRecognition?: any;
      webkitSpeechRecognition?: any;
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRec) {
      setMicNotice('Voice input supported in Chrome / Edge.');
      setTimeout(() => setMicNotice(null), 3500);
      return;
    }

    try {
      warmUpMonaSpeech();
      const rec = new SpeechRec();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = 'en-US';
      recognitionRef.current = rec;

      rec.onstart = () => {
        setIsListening(true);
        setMicNotice('Listening... Speak now');
      };

      rec.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript) {
          setDraft(transcript);
        }
      };

      rec.onerror = () => {
        setIsListening(false);
        setMicNotice(null);
      };

      rec.onend = () => {
        setIsListening(false);
        setMicNotice(null);
        setTimeout(() => {
          const currentText = inputRef.current?.value || '';
          if (currentText.trim()) {
            warmUpMonaSpeech();
            useAchievementStore.getState().unlock('ai_chat');
            const toSend = currentText.trim();
            setDraft('');
            void sendMessage(toSend);
          }
        }, 220);
      };

      rec.start();
    } catch {
      setIsListening(false);
      setMicNotice(null);
    }
  };

  const showAmbientBubble =
    (inputMode === 'walking' || inputMode === 'paused') &&
    Boolean(bubbleText) &&
    (nowMs < bubbleUntil || isSpeaking);

  const cycleVoice = () => {
    if (sfxMuted) {
      setSfxMuted(false);
      if (voiceMode === 'off') {
        setVoiceMode('auto');
      }
      warmUpMonaSpeech();
      return;
    }
    warmUpMonaSpeech();
    const order: MonaVoiceMode[] = ['auto', 'browser', 'off'];
    const next = order[(order.indexOf(voiceMode) + 1) % order.length];
    setVoiceMode(next);
  };

  return (
    <>
      {/* Ambient floating speech caption while ELSA speaks or gives a room tour in walking mode */}
      {showAmbientBubble && (
        <div
          data-mona-ambient-bubble="true"
          style={{
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 62,
            maxWidth: 'min(520px, calc(100vw - 32px))',
            pointerEvents: 'none',
          }}
          className="rounded-2xl border border-sky-400/30 bg-[#0b101b]/88 px-4 py-2.5 text-center shadow-[0_12px_36px_rgba(0,0,0,0.45)] backdrop-blur-md"
        >
          <div className="flex items-center justify-center gap-2 text-[11px] font-medium uppercase tracking-wider text-sky-300">
            <span className="inline-block h-2 w-2 rounded-full bg-sky-400" />
            ELSA {isSpeaking ? '· Speaking' : ''}
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-neutral-100">{bubbleText}</p>
        </div>
      )}

      {/* Quick Talk button in paused mode so visitors can talk to ELSA even without finding her first */}
      {inputMode === 'paused' && (
        <div
          style={{
            position: 'fixed',
            right: '16px',
            bottom: '16px',
            zIndex: 60,
          }}
        >
          <button
            type="button"
            data-talk-mona-btn="true"
            onClick={(e) => {
              e.stopPropagation();
              warmUpMonaSpeech();
              const win = window as unknown as { __enterRobotFocus?: () => void };
              win.__enterRobotFocus?.();
            }}
            className="rounded-full border border-sky-400/35 bg-[#0c1220]/90 px-4 py-2 text-xs font-medium text-sky-200 shadow-lg backdrop-blur-md hover:bg-[#131d33] cursor-pointer"
          >
            Ask ELSA (AI Companion)
          </button>
        </div>
      )}

      {/* Conversation Overlay while focused on ELSA */}
      {isChatOpen && (
        <div
          data-mona-chat-ui="true"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 72,
            pointerEvents: 'none',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            padding: '20px',
          }}
        >
          {/* Top-left Exit button matching all other focus modes */}
          <div
            style={{
              position: 'fixed',
              top: '16px',
              left: '16px',
              pointerEvents: 'auto',
            }}
          >
            <button
              type="button"
              data-mona-exit="true"
              onClick={() => handleExit(true)}
              className="flex items-center gap-2 rounded-lg border border-white/15 bg-[#0e1017]/90 px-3.5 py-2 text-xs font-medium text-neutral-100 hover:bg-[#191d28] cursor-pointer"
            >
              <span>✕ Exit ELSA</span>
              <span className="text-white/45 text-[11px]">Q</span>
            </button>
          </div>

          {/* Right-side sleek companion panel leaving ELSA visible in left 3D viewport */}
          <div
            style={{
              pointerEvents: 'auto',
              width: 'min(420px, calc(100vw - 32px))',
              maxHeight: 'calc(100vh - 72px)',
            }}
            className="flex flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#0a0f1c]/90 text-neutral-100 shadow-[0_24px_70px_rgba(0,0,0,0.75)] backdrop-blur-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      isThinking
                        ? 'bg-amber-400 animate-pulse'
                        : isSpeaking
                          ? 'bg-pink-400 animate-pulse'
                          : 'bg-sky-400'
                    }`}
                  />
                  <h2 className="text-sm font-semibold tracking-wide text-white">
                    ELSA — Room Companion
                  </h2>
                </div>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Roman Urdu + English · Mode: {mode} · Zone: {station}
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                {isSpeaking && (
                  <button
                    type="button"
                    onClick={stopAllVoice}
                    className="rounded-md border border-pink-400/35 bg-pink-500/15 px-2 py-1 text-[11px] text-pink-200 hover:bg-pink-500/25 cursor-pointer"
                  >
                    Stop Voice
                  </button>
                )}
                <button
                  type="button"
                  data-mona-voice-toggle="true"
                  onClick={cycleVoice}
                  title={sfxMuted ? 'Click to unmute ELSA & room audio (M)' : 'Switch ELSA voice mode'}
                  className={`rounded-md border px-2 py-1 text-[11px] cursor-pointer ${
                    sfxMuted
                      ? 'border-amber-400/40 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25'
                      : 'border-white/15 bg-white/5 text-slate-200 hover:bg-white/10'
                  }`}
                >
                  {sfxMuted ? 'Muted (M)' : `Voice: ${voiceMode}`}
                </button>
              </div>
            </div>

            {/* Behavior Quick Switches */}
            <div className="flex items-center gap-1.5 border-b border-white/10 bg-white/[0.02] px-3 py-2 text-[11px]">
              {(['patrol', 'follow', 'idle'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    warmUpMonaSpeech();
                    setMode(m);
                  }}
                  className={`rounded-full px-2.5 py-0.5 capitalize transition cursor-pointer ${
                    mode === m
                      ? 'bg-sky-500/25 text-sky-200 border border-sky-400/40'
                      : 'border border-white/10 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {m}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  warmUpMonaSpeech();
                  void sendMessage('Give me a room tour');
                }}
                disabled={isThinking}
                className="ml-auto rounded-full border border-emerald-400/35 bg-emerald-500/15 px-2.5 py-0.5 text-emerald-200 hover:bg-emerald-500/25 cursor-pointer disabled:opacity-50"
              >
                Tour Room
              </button>
            </div>

            {/* Conversation History */}
            <div
              ref={scrollRef}
              data-mona-messages="true"
              className="flex-1 space-y-2.5 overflow-y-auto px-3.5 py-3 text-[13px]"
            >
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.role === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-3.5 py-2 leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-sky-600/85 text-white'
                        : 'border border-white/10 bg-white/[0.06] text-slate-100'
                    }`}
                  >
                    {msg.text}
                  </div>
                  {msg.role === 'assistant' && (
                    <div className="mt-1 flex flex-wrap items-center gap-1 px-1">
                      <button
                        type="button"
                        data-mona-speak-btn="true"
                        title={sfxMuted ? 'Room audio muted - press M or click Muted above' : 'Speak aloud'}
                        onClick={() => {
                          warmUpMonaSpeech();
                          if (voiceMode === 'off') {
                            setVoiceMode('auto');
                            useRobotStore.getState().speak(msg.text);
                            return;
                          }
                          speak(msg.text);
                        }}
                        className="rounded border border-white/15 bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-slate-300 hover:border-pink-400/40 hover:text-pink-200 cursor-pointer"
                      >
                        Speak
                      </button>
                      {msg.sources &&
                        msg.sources.slice(0, 3).map((src) => (
                          <span
                            key={src}
                            className="rounded border border-sky-400/20 bg-sky-500/10 px-1.5 py-0.5 text-[10px] text-sky-300"
                          >
                            {src}
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              ))}
              {isThinking && (
                <div className="flex items-start">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-3.5 py-2 text-xs text-slate-300">
                    ELSA is thinking...
                  </div>
                </div>
              )}
            </div>

            {/* Quick Prompt Chips */}
            <div className="flex flex-wrap gap-1.5 border-t border-white/10 bg-white/[0.02] px-3 py-2">
              {ROBOT_CONFIG.quickPrompts.map((qp) => (
                <button
                  key={qp.label}
                  type="button"
                  disabled={isThinking}
                  onClick={() => {
                    warmUpMonaSpeech();
                    void sendMessage(qp.prompt);
                  }}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-slate-300 hover:border-sky-400/40 hover:text-white cursor-pointer disabled:opacity-50"
                >
                  {qp.label}
                </button>
              ))}
            </div>

            {/* Mic Notice if active */}
            {micNotice && (
              <div className="border-t border-white/10 bg-pink-500/10 px-3 py-1.5 text-center text-[11px] font-medium text-pink-300">
                {micNotice}
              </div>
            )}

            {/* Input Form with Mic Button */}
            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-2 border-t border-white/10 bg-[#080c16] p-3"
            >
              <input
                ref={inputRef}
                data-mona-input="true"
                type="text"
                value={draft}
                maxLength={400}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={isListening ? 'Listening to voice...' : 'Ask in English or Roman Urdu...'}
                className={`flex-1 rounded-xl border bg-white/[0.06] px-3 py-2 text-xs text-white placeholder-slate-400 outline-none transition ${
                  isListening
                    ? 'border-pink-500 shadow-[0_0_12px_rgba(236,72,153,0.35)]'
                    : 'border-white/15 focus:border-sky-400'
                }`}
              />
              <button
                type="button"
                onClick={toggleListening}
                title={isListening ? 'Stop voice recording' : 'Speak via microphone'}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border text-sm transition cursor-pointer ${
                  isListening
                    ? 'border-pink-400 bg-pink-500/30 text-pink-200 animate-pulse'
                    : 'border-white/15 bg-white/5 text-slate-300 hover:border-pink-400/50 hover:text-pink-300'
                }`}
              >
                🎙️
              </button>
              <button
                type="submit"
                data-mona-send="true"
                disabled={!draft.trim() || isThinking}
                className="rounded-xl bg-sky-500 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-45 cursor-pointer"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
