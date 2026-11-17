'use client';

import { useRef, useState } from 'react';
import { OS_CONFIG } from '@/config/osConfig';
import { useOsStore } from '@/stores/osStore';
import { ErrorXIcon, QuestionConfirmIcon } from '@/components/os/xpIcons';

interface XpDialogProps {
  toDesktop: (cx: number, cy: number) => [number, number];
}

/**
 * Reusable modal XP error & confirmation dialog, draggable by its title bar via CSS transforms.
 */
export default function XpDialog({ toDesktop }: XpDialogProps) {
  const activeDialog = useOsStore((s) => s.activeDialog);
  const closeDialog = useOsStore((s) => s.closeDialog);
  const desktopBounds = useOsStore((s) => s.desktopBounds);

  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(
    null
  );

  if (!activeDialog) return null;

  const baseX = Math.max(20, Math.round((desktopBounds.width - 370) / 2));
  const baseY = Math.max(20, Math.round((desktopBounds.height - 170) / 2));

  const onTitlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const [dx0, dy0] = toDesktop(e.clientX, e.clientY);
    dragRef.current = {
      startX: dx0,
      startY: dy0,
      origX: offset.x,
      origY: offset.y,
    };
  };

  const onTitlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const [dxNow, dyNow] = toDesktop(e.clientX, e.clientY);
    const dx = dxNow - dragRef.current.startX;
    const dy = dyNow - dragRef.current.startY;
    const maxDx = desktopBounds.width - 380 - baseX;
    const maxDy = desktopBounds.height - 180 - baseY;
    setOffset({
      x: Math.max(-baseX + 8, Math.min(maxDx, dragRef.current.origX + dx)),
      y: Math.max(-baseY + 8, Math.min(maxDy, dragRef.current.origY + dy)),
    });
  };

  const onTitlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer already released
    }
  };

  const handleConfirm = () => {
    const cb = activeDialog.onConfirm;
    closeDialog();
    cb?.();
  };

  return (
    <div
      data-xp-dialog="true"
      className="absolute inset-0 z-[9990] bg-black/15"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="xp-dialog-title"
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          left: baseX,
          top: baseY,
          width: 370,
          transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`,
          fontFamily: OS_CONFIG.fonts.ui,
          fontSize: 12,
          border: `3px solid ${OS_CONFIG.colors.windowBorder}`,
          borderRadius: '8px 8px 4px 4px',
          backgroundColor: OS_CONFIG.colors.windowBody,
          boxShadow: '3px 4px 14px rgba(0, 0, 0, 0.48)',
        }}
      >
        <div
          onPointerDown={onTitlePointerDown}
          onPointerMove={onTitlePointerMove}
          onPointerUp={onTitlePointerUp}
          onPointerCancel={onTitlePointerUp}
          style={{
            background: `linear-gradient(180deg, ${OS_CONFIG.colors.titleActiveStart} 0%, ${OS_CONFIG.colors.titleActiveEnd} 18%, ${OS_CONFIG.colors.titleActiveStart} 100%)`,
            fontFamily: OS_CONFIG.fonts.title,
          }}
          className="h-[28px] px-2 flex items-center justify-between text-white font-bold select-none cursor-move rounded-t-[4px]"
        >
          <span id="xp-dialog-title" className="text-[12px] drop-shadow-[1px_1px_0_rgba(0,0,0,0.45)] truncate">
            {activeDialog.title}
          </span>
          <button
            type="button"
            data-dialog-btn="close"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              closeDialog();
            }}
            aria-label="Close dialog"
            className="w-[20px] h-[20px] rounded-[3px] border border-white/80 bg-gradient-to-b from-[#e87c6a] to-[#c42a16] flex items-center justify-center hover:brightness-110 active:brightness-90 cursor-pointer"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <path d="M2 2 L8 8 M8 2 L2 8" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="p-4 text-[#111827]">
          <div className="flex items-start gap-3">
            <div className="shrink-0 mt-0.5">
              {activeDialog.kind === 'confirm' ? (
                <QuestionConfirmIcon size={32} />
              ) : (
                <ErrorXIcon size={32} />
              )}
            </div>
            <p className="text-[12px] leading-relaxed text-[#1f2937] break-words">
              {activeDialog.message}
            </p>
          </div>

          <div className="mt-4 flex items-center justify-center gap-2.5">
            {activeDialog.kind === 'confirm' ? (
              <>
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={handleConfirm}
                  className="min-w-[76px] px-4 py-1 text-[12px] font-semibold bg-gradient-to-b from-[#ffffff] to-[#d9d6c8] text-[#111827] border border-[#003c74] rounded-[3px] shadow-xs hover:brightness-105 active:translate-y-[1px] cursor-pointer"
                >
                  {activeDialog.okLabel ?? 'Yes'}
                </button>
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={closeDialog}
                  className="min-w-[76px] px-4 py-1 text-[12px] bg-gradient-to-b from-[#ffffff] to-[#d9d6c8] text-[#111827] border border-[#6b7280] rounded-[3px] shadow-xs hover:brightness-105 active:translate-y-[1px] cursor-pointer"
                >
                  {activeDialog.cancelLabel ?? 'No'}
                </button>
              </>
            ) : (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={closeDialog}
                className="min-w-[80px] px-5 py-1 text-[12px] font-semibold bg-gradient-to-b from-[#ffffff] to-[#d9d6c8] text-[#111827] border border-[#003c74] rounded-[3px] shadow-xs hover:brightness-105 active:translate-y-[1px] cursor-pointer"
              >
                {activeDialog.okLabel ?? 'OK'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
