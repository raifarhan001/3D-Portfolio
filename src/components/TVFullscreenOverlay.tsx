'use client';

import { useEffect, useRef, useState } from 'react';
import { TV_CONFIG } from '@/config/roomConfig';
import { useTvStore } from '@/stores/tvStore';
import TVScreenContent from '@/components/TVScreenContent';

export default function TVFullscreenOverlay() {
  const powered = useTvStore((s) => s.powered);
  const source = useTvStore((s) => s.source);
  const tvMode = useTvStore((s) => s.tvMode);
  const isSeated = useTvStore((s) => s.isSeated);
  const tvExiting = useTvStore((s) => s.tvExiting);
  const tvFullscreen = useTvStore((s) => s.tvFullscreen);

  const containerRef = useRef<HTMLDivElement>(null);
  const [nativeFs, setNativeFs] = useState(false);

  const active = tvFullscreen && powered && (tvMode || isSeated) && !tvExiting;

  useEffect(() => {
    const onFsChange = () => {
      setNativeFs(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  useEffect(() => {
    if (!active && document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
  }, [active]);

  if (!active) return null;

  const toggleBrowserFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    } else {
      containerRef.current?.requestFullscreen?.().catch(() => {});
    }
  };

  const exitTvFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
    useTvStore.getState().setTvFullscreen(false);
    window.focus();
  };

  return (
    <div
      ref={containerRef}
      data-tv-fullscreen-overlay="true"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 150,
        backgroundColor: '#050508',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Top Fullscreen Control Bar */}
      <div
        style={{
          height: '52px',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          background: 'rgba(12, 13, 18, 0.96)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              width: '9px',
              height: '9px',
              borderRadius: '50%',
              backgroundColor: source === 'music' ? '#ff0033' : '#e11d48',
              boxShadow: '0 0 8px rgba(225, 29, 72, 0.7)',
            }}
          />
          <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.12em', color: '#f3f4f6' }}>
            TV FULLSCREEN
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '12px' }}>
            <button
              type="button"
              onClick={() => useTvStore.getState().goHome()}
              style={tabBtnStyle(source === 'standby')}
            >
              Home
            </button>
            <button
              type="button"
              onClick={() => useTvStore.getState().openNightcast()}
              style={tabBtnStyle(source === 'nightcast')}
            >
              NightCast
            </button>
            <button
              type="button"
              onClick={() => useTvStore.getState().openMusic()}
              style={tabBtnStyle(source === 'music', '#ff0033')}
            >
              ▶ YouTube Music
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {source !== 'standby' && (
            <button
              type="button"
              onClick={() => useTvStore.getState().triggerReload()}
              style={actionBtnStyle}
            >
              ↻ Reload
            </button>
          )}
          {source === 'nightcast' && (
            <button
              type="button"
              onClick={() => window.open(TV_CONFIG.nightcastUrl, '_blank', 'noopener,noreferrer')}
              style={actionBtnStyle}
            >
              ↗ Open Tab
            </button>
          )}
          <button
            type="button"
            onClick={toggleBrowserFullscreen}
            title="Toggle Browser Native Fullscreen"
            style={actionBtnStyle}
          >
            {nativeFs ? 'Windowed' : '⛶ Monitor Full'}
          </button>
          <button
            type="button"
            data-tv-fullscreen-exit="true"
            onClick={exitTvFullscreen}
            style={{
              ...actionBtnStyle,
              background: 'rgba(225, 29, 72, 0.24)',
              borderColor: 'rgba(225, 29, 72, 0.55)',
              color: '#fecdd3',
            }}
          >
            ⤢ Exit Fullscreen (Q)
          </button>
        </div>
      </div>

      {/* Full-Viewport TV Display */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <TVScreenContent mode="fullscreen" canInteract={true} />
      </div>
    </div>
  );
}

function tabBtnStyle(active: boolean, accent = '#e11d48'): React.CSSProperties {
  return {
    padding: '6px 12px',
    borderRadius: '999px',
    border: active ? `1px solid ${accent}` : '1px solid rgba(255, 255, 255, 0.12)',
    background: active ? 'rgba(225, 29, 72, 0.2)' : 'rgba(255, 255, 255, 0.05)',
    color: active ? '#ffffff' : '#d4d4d8',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  };
}

const actionBtnStyle: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: '8px',
  border: '1px solid rgba(255, 255, 255, 0.14)',
  background: 'rgba(255, 255, 255, 0.06)',
  color: '#e5e7eb',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
};
