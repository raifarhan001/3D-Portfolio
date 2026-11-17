'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { OS_CONFIG } from '@/config/osConfig';
import { useOsStore, type OSWindow } from '@/stores/osStore';
import {
  ComputerIcon,
  FolderIcon,
  MailIcon,
  NotepadIcon,
  PdfDocIcon,
  RecycleBinIcon,
} from '@/components/os/xpIcons';

interface XpWindowProps {
  win: OSWindow;
  toDesktop: (cx: number, cy: number) => [number, number];
  children: ReactNode;
}

const TASKBAR_H = 30;

function WindowTitleIcon({ kind, emptied }: { kind: OSWindow['kind']; emptied: boolean }) {
  switch (kind) {
    case 'my-computer':
      return <ComputerIcon size={16} />;
    case 'recycle-bin':
      return <RecycleBinIcon size={16} full={!emptied} />;
    case 'about-me':
      return <NotepadIcon size={16} />;
    case 'contact':
      return <MailIcon size={16} />;
    case 'resume':
      return <PdfDocIcon size={16} />;
    case 'guestbook':
      return <span className="text-[13px] leading-none">📖</span>;
    case 'project':
    default:
      return <FolderIcon size={16} />;
  }
}

export default function XpWindow({ win, toDesktop, children }: XpWindowProps) {
  const activeWindowId = useOsStore((s) => s.activeWindowId);
  const recycleBinEmptied = useOsStore((s) => s.recycleBinEmptied);
  const desktopBounds = useOsStore((s) => s.desktopBounds);
  const focusWindow = useOsStore((s) => s.focusWindow);
  const closeWindow = useOsStore((s) => s.closeWindow);
  const minimizeWindow = useOsStore((s) => s.minimizeWindow);
  const toggleMaximizeWindow = useOsStore((s) => s.toggleMaximizeWindow);
  const moveWindow = useOsStore((s) => s.moveWindow);
  const resizeWindow = useOsStore((s) => s.resizeWindow);

  const isActive = activeWindowId === win.id && !win.minimized;
  const containerRef = useRef<HTMLDivElement>(null);
  const [entered, setEntered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [liveSize, setLiveSize] = useState<{ w: number; h: number } | null>(null);

  const dragState = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    curX: number;
    curY: number;
  } | null>(null);

  const resizeState = useRef<{
    startX: number;
    startY: number;
    origW: number;
    origH: number;
    curW: number;
    curH: number;
  } | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const targetX = win.maximized ? 0 : win.x;
  const targetY = win.maximized ? 0 : win.y;
  const targetW = win.maximized ? desktopBounds.width : liveSize?.w ?? win.width;
  const targetH = win.maximized
    ? Math.max(240, desktopBounds.height - TASKBAR_H)
    : liveSize?.h ?? win.height;

  const scaleFactor = win.minimized ? 0.92 : entered ? 1 : 0.94;
  const opacity = win.minimized ? 0 : entered ? 1 : 0;

  const handleTitlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.stopPropagation();
    if (!isActive) focusWindow(win.id);
    if (win.maximized) return;

    const [dx0, dy0] = toDesktop(e.clientX, e.clientY);
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    dragState.current = {
      startX: dx0,
      startY: dy0,
      origX: win.x,
      origY: win.y,
      curX: win.x,
      curY: win.y,
    };
  };

  const handleTitlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = dragState.current;
    if (!st || !containerRef.current) return;
    const [dxNow, dyNow] = toDesktop(e.clientX, e.clientY);
    const dx = dxNow - st.startX;
    const dy = dyNow - st.startY;
    const maxX = Math.max(0, desktopBounds.width - win.width);
    const maxY = Math.max(0, desktopBounds.height - TASKBAR_H - win.height);
    st.curX = Math.max(0, Math.min(maxX, Math.round(st.origX + dx)));
    st.curY = Math.max(0, Math.min(maxY, Math.round(st.origY + dy)));
    containerRef.current.style.transform = `translate3d(${st.curX}px, ${st.curY}px, 0) scale(1)`;
  };

  const handleTitlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = dragState.current;
    if (!st) return;
    dragState.current = null;
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore release errors
    }
    moveWindow(win.id, st.curX, st.curY);
  };

  const handleResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (win.maximized) return;
    e.stopPropagation();
    if (!isActive) focusWindow(win.id);
    const [dx0, dy0] = toDesktop(e.clientX, e.clientY);
    e.currentTarget.setPointerCapture(e.pointerId);
    resizeState.current = {
      startX: dx0,
      startY: dy0,
      origW: win.width,
      origH: win.height,
      curW: win.width,
      curH: win.height,
    };
    setLiveSize({ w: win.width, h: win.height });
  };

  const handleResizePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = resizeState.current;
    if (!st) return;
    const [dxNow, dyNow] = toDesktop(e.clientX, e.clientY);
    const dx = dxNow - st.startX;
    const dy = dyNow - st.startY;
    const maxW = Math.max(300, desktopBounds.width - win.x - 4);
    const maxH = Math.max(210, desktopBounds.height - TASKBAR_H - win.y - 2);
    st.curW = Math.max(300, Math.min(maxW, Math.round(st.origW + dx)));
    st.curH = Math.max(210, Math.min(maxH, Math.round(st.origH + dy)));
    setLiveSize({ w: st.curW, h: st.curH });
  };

  const handleResizePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = resizeState.current;
    if (!st) return;
    resizeState.current = null;
    setLiveSize(null);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore release errors
    }
    resizeWindow(win.id, st.curW, st.curH);
  };

  const titleBg = isActive
    ? `linear-gradient(180deg, ${OS_CONFIG.colors.titleActiveStart} 0%, ${OS_CONFIG.colors.titleActiveEnd} 18%, ${OS_CONFIG.colors.titleActiveStart} 90%, #0046c7 100%)`
    : `linear-gradient(180deg, ${OS_CONFIG.colors.titleInactive} 0%, #99b4ec 22%, ${OS_CONFIG.colors.titleInactive} 100%)`;

  return (
    <div
      ref={containerRef}
      data-xp-window={win.id}
      role="dialog"
      aria-label={win.title}
      aria-hidden={win.minimized}
      onPointerDown={(e) => {
        e.stopPropagation();
        if (!(e.target as HTMLElement).closest('button') && !isActive) {
          focusWindow(win.id);
        }
      }}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: targetW,
        height: targetH,
        zIndex: win.zIndex,
        transform: `translate3d(${targetX}px, ${targetY}px, 0) scale(${scaleFactor})`,
        transformOrigin: 'center center',
        opacity,
        visibility: win.minimized ? 'hidden' : 'visible',
        pointerEvents: win.minimized ? 'none' : 'auto',
        transition: isDragging
          ? 'none'
          : win.minimized
          ? 'opacity 120ms ease-out, transform 120ms ease-out, visibility 0ms linear 120ms'
          : 'opacity 120ms ease-out, transform 120ms ease-out, visibility 0ms',
        fontFamily: OS_CONFIG.fonts.ui,
        fontSize: 12,
        backgroundColor: OS_CONFIG.colors.windowBody,
        border: `3px solid ${isActive ? OS_CONFIG.colors.windowBorder : '#6b85c9'}`,
        borderRadius: win.maximized ? '0px' : '8px 8px 4px 4px',
        boxShadow: isActive ? '2px 5px 14px rgba(0,0,0,0.42)' : '1px 2px 8px rgba(0,0,0,0.25)',
      }}
      className="flex flex-col overflow-hidden select-none"
    >
      {/* Luna Title Bar */}
      <div
        data-xp-titlebar={win.id}
        onPointerDown={handleTitlePointerDown}
        onPointerMove={handleTitlePointerMove}
        onPointerUp={handleTitlePointerUp}
        onPointerCancel={handleTitlePointerUp}
        onDoubleClick={(e) => {
          if ((e.target as HTMLElement).closest('button')) return;
          toggleMaximizeWindow(win.id);
        }}
        style={{
          background: titleBg,
          fontFamily: OS_CONFIG.fonts.title,
        }}
        className="h-[28px] shrink-0 px-1.5 flex items-center justify-between gap-2 text-white cursor-move"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <WindowTitleIcon kind={win.kind} emptied={recycleBinEmptied} />
          <span
            className="text-[12px] font-bold truncate"
            style={{ textShadow: '1px 1px 0 rgba(0,0,0,0.45)' }}
          >
            {win.title}
          </span>
        </div>

        {/* Titlebar Buttons: Minimize, Maximize, Close */}
        <div className="flex items-center gap-[3px] shrink-0">
          <button
            type="button"
            data-win-btn="minimize"
            onPointerDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              minimizeWindow(win.id);
            }}
            aria-label={`Minimize ${win.title}`}
            className="w-[21px] h-[21px] rounded-[3px] border border-white/85 bg-gradient-to-b from-[#4993ff] to-[#1152c8] flex items-center justify-center hover:brightness-110 active:brightness-90 cursor-pointer"
          >
            <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true">
              <rect x="2" y="7.5" width="6.5" height="2" fill="#ffffff" />
            </svg>
          </button>

          <button
            type="button"
            data-win-btn="maximize"
            onPointerDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              toggleMaximizeWindow(win.id);
            }}
            aria-label={win.maximized ? `Restore ${win.title}` : `Maximize ${win.title}`}
            className="w-[21px] h-[21px] rounded-[3px] border border-white/85 bg-gradient-to-b from-[#4993ff] to-[#1152c8] flex items-center justify-center hover:brightness-110 active:brightness-90 cursor-pointer"
          >
            {win.maximized ? (
              <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true">
                <rect x="3.5" y="1.5" width="6" height="5.5" fill="none" stroke="#fff" strokeWidth="1.3" />
                <rect x="1.5" y="3.5" width="6" height="5.5" fill="#1d65dc" stroke="#fff" strokeWidth="1.3" />
              </svg>
            ) : (
              <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true">
                <rect x="1.5" y="1.5" width="8" height="8" fill="none" stroke="#fff" strokeWidth="1.5" />
                <line x1="1.5" y1="2.5" x2="9.5" y2="2.5" stroke="#fff" strokeWidth="2" />
              </svg>
            )}
          </button>

          <button
            type="button"
            data-win-btn="close"
            onPointerDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              closeWindow(win.id);
            }}
            aria-label={`Close ${win.title}`}
            className="w-[21px] h-[21px] rounded-[3px] border border-white/85 bg-gradient-to-b from-[#e97967] to-[#c42c16] flex items-center justify-center hover:brightness-110 active:brightness-90 cursor-pointer"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <path d="M2 2 L8 8 M8 2 L2 8" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Window Content */}
      <div className="flex-1 min-h-0 flex flex-col bg-[#ece9d8] text-[#111827] select-text overflow-hidden">
        {children}
      </div>

      {/* Bottom-right Resize Grip */}
      {!win.maximized && (
        <div
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
          onPointerCancel={handleResizePointerUp}
          aria-label="Resize window"
          className="absolute right-0 bottom-0 w-3.5 h-3.5 cursor-nwse-resize z-20 flex items-end justify-end p-0.5"
        >
          <svg width="9" height="9" viewBox="0 0 9 9" aria-hidden="true">
            <path d="M8 2 L2 8 M8 5 L5 8 M8 7.5 L7.5 8" stroke="#64748b" strokeWidth="1.2" />
          </svg>
        </div>
      )}
    </div>
  );
}
