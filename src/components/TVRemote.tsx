'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useTvStore } from '@/stores/tvStore';
import { TV_CONFIG } from '@/config/roomConfig';

/**
 * TVRemote — Sleek basic handheld TV remote docked on the right side during TV mode
 * or while seated on the sofa watching TV.
 */
export default function TVRemote() {
  const powered = useTvStore((s) => s.powered);
  const source = useTvStore((s) => s.source);
  const tvMode = useTvStore((s) => s.tvMode);
  const isSeated = useTvStore((s) => s.isSeated);
  const tvExiting = useTvStore((s) => s.tvExiting);
  const tvFullscreen = useTvStore((s) => s.tvFullscreen);
  const nightcastBlocked = useTvStore((s) => s.nightcastBlocked);

  const [irFlash, setIrFlash] = useState(false);
  const irTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isActive = (tvMode || isSeated) && !tvExiting;

  const pulseIr = useCallback(() => {
    setIrFlash(true);
    if (irTimerRef.current) clearTimeout(irTimerRef.current);
    irTimerRef.current = setTimeout(() => setIrFlash(false), 160);
  }, []);

  const handleDpadOk = useCallback(() => {
    pulseIr();
    const store = useTvStore.getState();
    if (!store.powered) {
      store.togglePower();
      return;
    }
    if (store.source === 'standby') {
      store.openNightcast();
    }
  }, [pulseIr]);

  const handleExitClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const win = window as unknown as {
        __exitTvMode?: (lockPointer?: boolean) => void;
        __exitSeatMode?: (lockPointer?: boolean) => void;
      };
      if (isSeated) {
        win.__exitSeatMode?.(true);
      } else {
        win.__exitTvMode?.(true);
      }
    },
    [isSeated]
  );

  // Remote OK shortcut while in TV/Sofa focus; Esc/Q/F are handled centrally in TVInteraction
  useEffect(() => {
    if (!isActive || tvFullscreen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const el = (e.target instanceof HTMLElement ? e.target : document.activeElement) as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) {
        return;
      }
      if (e.code === 'Enter') {
        e.preventDefault();
        handleDpadOk();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isActive, tvFullscreen, handleDpadOk]);

  if (!isActive || tvFullscreen) return null;

  const isNightcast = powered && source === 'nightcast';
  const isMusic = powered && source === 'music';

  return (
    <>
      {/* Top-left Exit / Stand Up pill */}
      <div
        style={{
          position: 'fixed',
          top: '18px',
          left: '24px',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <button
          type="button"
          data-exit-focus-button="true"
          onClick={handleExitClick}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 14px',
            borderRadius: '999px',
            background: 'rgba(14, 15, 19, 0.88)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: '#e5e7eb',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
            boxShadow: '0 6px 20px rgba(0,0,0,0.45)',
          }}
        >
          <span>{isSeated ? '↑ Stand Up' : '✕ Exit TV'}</span>
          <span style={{ color: '#6b7280', fontSize: '11px' }}>
            {isSeated ? 'F / Q' : 'Q'}
          </span>
        </button>

        <button
          type="button"
          data-tv-fullscreen-pill="true"
          onClick={(e) => {
            e.stopPropagation();
            pulseIr();
            useTvStore.getState().toggleTvFullscreen();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            borderRadius: '999px',
            background: 'rgba(14, 15, 19, 0.88)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.16)',
            color: '#f3f4f6',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
            boxShadow: '0 6px 20px rgba(0,0,0,0.45)',
          }}
        >
          <span>⛶ Fullscreen</span>
          {!isSeated && <span style={{ color: '#6b7280', fontSize: '11px' }}>F</span>}
        </button>

        {isSeated && (
          <div
            style={{
              padding: '7px 12px',
              borderRadius: '999px',
              background: 'rgba(14, 15, 19, 0.72)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: '#9ca3af',
              fontSize: '11px',
              pointerEvents: 'none',
            }}
          >
            Drag around to look
          </div>
        )}
      </div>

      {/* Handheld Basic TV Remote (right side, keeps TV screen unobstructed) */}
      <div
        data-tv-remote-panel="true"
        onClickCapture={() => window.focus()}
        onPointerDownCapture={() => window.focus()}
        onClick={(e) => {
          e.stopPropagation();
          window.focus();
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          window.focus();
        }}
        style={{
          position: 'fixed',
          right: '24px',
          bottom: '24px',
          zIndex: 100,
          width: '214px',
          background: 'linear-gradient(175deg, #1b1c22 0%, #0f1014 100%)',
          borderRadius: '28px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow:
            '0 24px 50px rgba(0, 0, 0, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
          padding: '16px 15px 15px',
          color: '#e5e7eb',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          userSelect: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        {/* 1. Top Bar: Power + IR LED + Home */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            type="button"
            onClick={() => {
              pulseIr();
              useTvStore.getState().togglePower();
            }}
            title="Power On / Off"
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              border: powered
                ? '1.5px solid rgba(239, 68, 68, 0.85)'
                : '1.5px solid rgba(179, 18, 42, 0.7)',
              background: powered
                ? 'radial-gradient(circle, rgba(220,38,38,0.3) 0%, rgba(30,14,18,0.9) 100%)'
                : 'rgba(255, 255, 255, 0.05)',
              color: powered ? '#f87171' : '#b3122a',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: powered ? '0 0 12px rgba(220,38,38,0.35)' : 'none',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M12 3v8" />
              <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
            </svg>
          </button>

          {/* IR LED + Status */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: irFlash ? '#f87171' : powered ? '#22c55e' : '#3f3f46',
                boxShadow: irFlash
                  ? '0 0 10px #f87171'
                  : powered
                    ? '0 0 6px rgba(34, 197, 94, 0.7)'
                    : 'none',
                transition: 'all 0.1s',
              }}
            />
            <span style={{ fontSize: '9px', letterSpacing: '0.14em', color: '#71717a', fontWeight: 600 }}>
              {!powered ? 'OFF' : source === 'standby' ? 'HOME' : source === 'music' ? 'MUSIC' : 'CAST'}
            </span>
          </div>

          {/* Home Button */}
          <button
            type="button"
            onClick={() => {
              pulseIr();
              useTvStore.getState().goHome();
            }}
            title="TV Home"
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              background:
                powered && source === 'standby'
                  ? 'rgba(255, 255, 255, 0.14)'
                  : 'rgba(255, 255, 255, 0.05)',
              color: '#d4d4d8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 10.5L12 3l9 7.5" />
              <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
            </svg>
          </button>
        </div>

        {/* 2. Classic Circular D-Pad Navigation Wheel + OK */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '2px 0' }}>
          <div
            style={{
              position: 'relative',
              width: '128px',
              height: '128px',
              borderRadius: '50%',
              background: 'linear-gradient(145deg, #16171d, #23252e)',
              border: '1px solid rgba(255, 255, 255, 0.09)',
              boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.6), 0 4px 12px rgba(0,0,0,0.4)',
            }}
          >
            <button type="button" onClick={pulseIr} title="Up" style={{ ...dpadDirBtn, top: '6px', left: '50%', transform: 'translateX(-50%)' }}>
              ▲
            </button>
            <button type="button" onClick={pulseIr} title="Down" style={{ ...dpadDirBtn, bottom: '6px', left: '50%', transform: 'translateX(-50%)' }}>
              ▼
            </button>
            <button type="button" onClick={pulseIr} title="Left" style={{ ...dpadDirBtn, left: '6px', top: '50%', transform: 'translateY(-50%)' }}>
              ◀
            </button>
            <button type="button" onClick={pulseIr} title="Right" style={{ ...dpadDirBtn, right: '6px', top: '50%', transform: 'translateY(-50%)' }}>
              ▶
            </button>

            <button
              type="button"
              onClick={handleDpadOk}
              title="OK / Select"
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                border: '1px solid rgba(255, 255, 255, 0.14)',
                background: 'linear-gradient(145deg, #272933, #181920)',
                color: '#f4f4f5',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.6)',
              }}
            >
              OK
            </button>
          </div>
        </div>

        {/* 3. Dedicated NightCast, YouTube Music & Fullscreen Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            type="button"
            onClick={() => {
              pulseIr();
              useTvStore.getState().openNightcast();
            }}
            style={{
              padding: '10px 12px',
              borderRadius: '12px',
              border: isNightcast ? '1px solid #e11d48' : '1px solid rgba(255,255,255,0.1)',
              background: isNightcast
                ? 'linear-gradient(135deg, rgba(179, 18, 42, 0.35), rgba(179, 18, 42, 0.15))'
                : 'rgba(255,255,255,0.05)',
              color: isNightcast ? '#fda4af' : '#e4e4e7',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#b3122a',
                boxShadow: '0 0 8px #b3122a',
              }}
            />
            NightCast
          </button>

          <button
            type="button"
            data-tv-remote-music="true"
            onClick={() => {
              pulseIr();
              useTvStore.getState().openMusic();
            }}
            style={{
              padding: '10px 12px',
              borderRadius: '12px',
              border: isMusic ? '1px solid #ff0033' : '1px solid rgba(255,255,255,0.1)',
              background: isMusic
                ? 'linear-gradient(135deg, rgba(255, 0, 51, 0.32), rgba(255, 0, 51, 0.12))'
                : 'rgba(255,255,255,0.05)',
              color: isMusic ? '#fecdd3' : '#e4e4e7',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <span style={{ color: '#ff0033', fontSize: '11px' }}>▶</span>
            YouTube Music
          </button>

          <button
            type="button"
            data-tv-remote-fullscreen="true"
            onClick={() => {
              pulseIr();
              useTvStore.getState().toggleTvFullscreen();
            }}
            style={{
              padding: '8px 12px',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.06)',
              color: '#f4f4f5',
              fontSize: '11.5px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ⛶ Fullscreen TV
          </button>
        </div>

        {/* 4. Remote Footer Context */}
        {!powered && (
          <div
            style={{
              textAlign: 'center',
              fontSize: '11px',
              color: '#71717a',
              paddingTop: '6px',
              borderTop: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            Press Power to turn on TV
          </div>
        )}

        {powered && source === 'standby' && (
          <div
            style={{
              textAlign: 'center',
              fontSize: '11px',
              color: '#9ca3af',
              paddingTop: '6px',
              borderTop: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            Choose NightCast or YouTube Music
          </div>
        )}

        {isMusic && (
          <div
            style={{
              borderTop: '1px solid rgba(255,255,255,0.08)',
              paddingTop: '10px',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '6px',
            }}
          >
            <button
              type="button"
              onClick={() => {
                pulseIr();
                useTvStore.getState().prevMusicTrack();
              }}
              style={{
                padding: '7px 8px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)',
                color: '#d4d4d8',
                fontSize: '11px',
                cursor: 'pointer',
              }}
            >
              ⏮ Prev
            </button>
            <button
              type="button"
              onClick={() => {
                pulseIr();
                useTvStore.getState().nextMusicTrack();
              }}
              style={{
                padding: '7px 8px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)',
                color: '#d4d4d8',
                fontSize: '11px',
                cursor: 'pointer',
              }}
            >
              Next ⏭
            </button>
          </div>
        )}

        {isNightcast && (
          <div
            style={{
              borderTop: '1px solid rgba(255,255,255,0.08)',
              paddingTop: '10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '7px',
            }}
          >
            {nightcastBlocked && (
              <div
                style={{
                  fontSize: '11px',
                  color: '#fca5a5',
                  background: 'rgba(179, 18, 42, 0.16)',
                  border: '1px solid rgba(179, 18, 42, 0.35)',
                  borderRadius: '8px',
                  padding: '6px 8px',
                  lineHeight: 1.35,
                }}
              >
                NightCast is taking longer than expected — reload or open in new tab
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <button
                type="button"
                onClick={() => {
                  pulseIr();
                  useTvStore.getState().triggerReload();
                }}
                style={{
                  padding: '7px 8px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.05)',
                  color: '#d4d4d8',
                  fontSize: '11px',
                  cursor: 'pointer',
                }}
              >
                ↻ Reload
              </button>
              <button
                type="button"
                onClick={() => {
                  pulseIr();
                  window.open(TV_CONFIG.nightcastUrl, '_blank', 'noopener,noreferrer');
                }}
                style={{
                  padding: '7px 8px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.05)',
                  color: '#d4d4d8',
                  fontSize: '11px',
                  cursor: 'pointer',
                }}
              >
                ↗ Open tab
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

const dpadDirBtn: React.CSSProperties = {
  position: 'absolute',
  width: '32px',
  height: '32px',
  borderRadius: '50%',
  border: 'none',
  background: 'transparent',
  color: '#a1a1aa',
  fontSize: '11px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};
