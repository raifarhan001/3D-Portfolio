'use client';

import { useEffect, useCallback } from 'react';
import { GRAMOPHONE_CONFIG } from '@/config/roomConfig';
import { useTvStore } from '@/stores/tvStore';

/**
 * GramophoneUI — Sleek overlay shown while inspecting the Gramophone & Cassette Box.
 * Lets the user either click the 3D cassettes directly or pick/control songs here.
 */
export default function GramophoneUI() {
  const gramophoneMode = useTvStore((s) => s.gramophoneMode);
  const tvExiting = useTvStore((s) => s.tvExiting);
  const gramophonePlaying = useTvStore((s) => s.gramophonePlaying);
  const gramophoneTrackId = useTvStore((s) => s.gramophoneTrackId);
  const gramophoneVolume = useTvStore((s) => s.gramophoneVolume);
  const gramophoneFallbackActive = useTvStore((s) => s.gramophoneFallbackActive);

  const isActive = gramophoneMode && !tvExiting;

  const handleExitClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const win = window as unknown as { __exitGramophoneMode?: (lockPointer?: boolean) => void };
    win.__exitGramophoneMode?.(true);
  }, []);

  useEffect(() => {
    if (!isActive) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        useTvStore.getState().toggleGramophonePlay();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isActive]);

  if (!isActive) return null;

  const activeTrack = GRAMOPHONE_CONFIG.tracks.find((t) => t.id === gramophoneTrackId) || null;

  return (
    <>
      {/* Top-left Exit pill + Top-center hint */}
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
          <span>✕ Exit Gramophone</span>
          <span style={{ color: '#6b7280', fontSize: '11px' }}>Q</span>
        </button>

        <div
          style={{
            padding: '7px 14px',
            borderRadius: '999px',
            background: 'rgba(14, 15, 19, 0.75)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            color: '#d4d4d8',
            fontSize: '12px',
            pointerEvents: 'none',
          }}
        >
          Click any 3D cassette in the box to play
        </div>
      </div>

      {/* Bottom-center Compact Gramophone Control Dock */}
      <div
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          bottom: '22px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 100,
          background: 'rgba(14, 15, 19, 0.92)',
          backdropFilter: 'blur(12px)',
          borderRadius: '18px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '14px 18px',
          minWidth: '580px',
          maxWidth: '94vw',
          color: '#e5e7eb',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.65)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          userSelect: 'none',
        }}
      >
        {/* Top Row: Now Playing + Play/Pause + Stop + Volume */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: gramophonePlaying ? '#22c55e' : '#71717a',
                boxShadow: gramophonePlaying ? '0 0 10px #22c55e' : 'none',
              }}
            />
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#f4f4f5' }}>
                {activeTrack ? `${activeTrack.title} — ${activeTrack.subtitle}` : 'Select a Cassette to Play'}
              </div>
              <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                {activeTrack
                  ? gramophoneFallbackActive
                    ? `Audio fallback active for ${activeTrack.src}`
                    : gramophonePlaying
                      ? 'Playing on Gramophone'
                      : 'Paused'
                  : 'Click any cassette inside the wooden box or below'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => useTvStore.getState().toggleGramophonePlay()}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.08)',
                color: '#f4f4f5',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {gramophonePlaying ? '⏸ Pause' : '▶ Play'}
            </button>

            <button
              type="button"
              onClick={() => useTvStore.getState().stopGramophone()}
              style={{
                padding: '6px 10px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.04)',
                color: '#a1a1aa',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              ⏹
            </button>

            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={gramophoneVolume}
              onChange={(e) => useTvStore.getState().setGramophoneVolume(parseFloat(e.target.value))}
              title="Gramophone Volume"
              style={{ width: '74px', accentColor: '#c7a254', cursor: 'pointer' }}
            />
          </div>
        </div>

        {/* Cassette Quick Selector Chips */}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${GRAMOPHONE_CONFIG.tracks.length}, minmax(0, 1fr))`, gap: '8px' }}>
          {GRAMOPHONE_CONFIG.tracks.map((track, idx) => {
            const selected = gramophoneTrackId === track.id;
            return (
              <button
                key={track.id}
                type="button"
                onClick={() => useTvStore.getState().playCassette(track.id)}
                style={{
                  padding: '8px 10px',
                  borderRadius: '10px',
                  border: selected
                    ? `1.5px solid ${track.color}`
                    : '1px solid rgba(255,255,255,0.08)',
                  background: selected
                    ? 'rgba(255,255,255,0.09)'
                    : 'rgba(255,255,255,0.03)',
                  color: '#f4f4f5',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: '#9ca3af', fontWeight: 700 }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: track.color }} />
                  0{idx + 1}
                </div>
                <div style={{ fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {track.title}
                </div>
                <div style={{ fontSize: '10px', color: '#9ca3af', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {track.subtitle}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
