'use client';

import { useCallback } from 'react';
import { usePcStore } from '@/stores/pcStore';

/**
 * PCUI — Exit overlay for PC focus mode and Stand-Up controls while seated in the Gaming Chair.
 */
export default function PCUI() {
  const pcMode = usePcStore((s) => s.pcMode);
  const pcArrived = usePcStore((s) => s.pcArrived);
  const hasPoweredOnce = usePcStore((s) => s.hasPoweredOnce);
  const chairSeated = usePcStore((s) => s.chairSeated);
  const pcExiting = usePcStore((s) => s.pcExiting);

  const raiXpOwnsPcUi = pcMode && pcArrived && hasPoweredOnce && !pcExiting;
  const activePc = pcMode && !pcExiting && !raiXpOwnsPcUi;
  const activeSeat = chairSeated && !pcExiting;

  const handleExitPc = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const win = window as unknown as { __exitPcMode?: (lockPointer?: boolean) => void };
    win.__exitPcMode?.(true);
  }, []);

  const handleStandUp = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const win = window as unknown as { __exitChairSeatMode?: (lockPointer?: boolean) => void };
    win.__exitChairSeatMode?.(true);
  }, []);

  if ((!activePc && !activeSeat) || raiXpOwnsPcUi) return null;

  return (
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
      {activePc ? (
        <>
          <button
            type="button"
            onClick={handleExitPc}
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
            <span>✕ Exit PC</span>
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
            RAI.OS Desktop
          </div>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={handleStandUp}
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
            <span>↑ Stand Up</span>
            <span style={{ color: '#6b7280', fontSize: '11px' }}>Q / F / WASD</span>
          </button>
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
        </>
      )}
    </div>
  );
}
