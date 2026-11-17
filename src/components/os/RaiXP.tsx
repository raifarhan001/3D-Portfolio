'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { OS_CONFIG } from '@/config/osConfig';
import { getOSProjects } from '@/utils/githubProjects';
import { openAppById } from '@/utils/osActions';
import {
  applyHomography,
  homographyToCssMatrix3d,
  invert3x3,
  solveHomography,
} from '@/utils/homography';
import { useOsStore } from '@/stores/osStore';
import { usePcStore } from '@/stores/pcStore';
import XpDesktopWallpaper from '@/components/os/XpDesktopWallpaper';
import XpWindow from '@/components/os/XpWindow';
import XpDialog from '@/components/os/XpDialog';
import Taskbar from '@/components/os/Taskbar';
import StartMenu from '@/components/os/StartMenu';
import TurnOffDialog from '@/components/os/TurnOffDialog';
import MyComputerApp from '@/components/os/apps/MyComputerApp';
import RecycleBinApp from '@/components/os/apps/RecycleBinApp';
import AboutMeApp from '@/components/os/apps/AboutMeApp';
import ContactApp from '@/components/os/apps/ContactApp';
import ProjectFolderApp from '@/components/os/apps/ProjectFolderApp';
import ResumeApp from '@/components/os/apps/ResumeApp';
import GuestbookApp from '@/components/os/apps/GuestbookApp';
import { playKeyClickSound } from '@/utils/sound';
import {
  ComputerIcon,
  FolderIcon,
  MailIcon,
  NotepadIcon,
  PdfDocIcon,
  RecycleBinIcon,
} from '@/components/os/xpIcons';

interface DesktopIconItem {
  id: string;
  label: string;
  kind: 'computer' | 'recycle' | 'about' | 'contact' | 'resume' | 'project' | 'guestbook';
}

const CELL_W = 75;
const CELL_H = 75;
const PAD_LEFT = 8;
const PAD_TOP = 8;
const TASKBAR_H = 30;

function DesktopSvgIcon({
  kind,
  emptied,
}: {
  kind: DesktopIconItem['kind'];
  emptied: boolean;
}) {
  switch (kind) {
    case 'computer':
      return <ComputerIcon size={32} />;
    case 'recycle':
      return <RecycleBinIcon size={32} full={!emptied} />;
    case 'about':
      return <NotepadIcon size={32} />;
    case 'guestbook':
      return <NotepadIcon size={32} />;
    case 'contact':
      return <MailIcon size={32} />;
    case 'resume':
      return <PdfDocIcon size={32} />;
    case 'project':
    default:
      return <FolderIcon size={32} />;
  }
}

export default function RaiXP() {
  const pcMode = usePcStore((s) => s.pcMode);
  const pcArrived = usePcStore((s) => s.pcArrived);
  const pcExiting = usePcStore((s) => s.pcExiting);
  const poweredPC = usePcStore((s) => s.poweredPC);
  const bootState = usePcStore((s) => s.bootState);
  const screenCorners = usePcStore((s) => s.screenCorners);

  const windows = useOsStore((s) => s.windows);
  const selectedIcons = useOsStore((s) => s.selectedIcons);
  const recycleBinEmptied = useOsStore((s) => s.recycleBinEmptied);
  const contextMenu = useOsStore((s) => s.contextMenu);
  const desktopRefreshKey = useOsStore((s) => s.desktopRefreshKey);
  const setDesktopBounds = useOsStore((s) => s.setDesktopBounds);
  const setSelectedIcons = useOsStore((s) => s.setSelectedIcons);
  const setStartMenuOpen = useOsStore((s) => s.setStartMenuOpen);
  const setContextMenu = useOsStore((s) => s.setContextMenu);
  const triggerDesktopRefresh = useOsStore((s) => s.triggerDesktopRefresh);
  const openDialog = useOsStore((s) => s.openDialog);

  const [fillScreen, setFillScreen] = useState(false);
  const [viewport, setViewport] = useState<{ w: number; h: number }>(() =>
    typeof window !== 'undefined'
      ? { w: window.innerWidth, h: window.innerHeight }
      : { w: 1280, h: 720 }
  );
  const [marquee, setMarquee] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);
  const marqueeRef = useRef<{ startX: number; startY: number } | null>(null);

  const projects = useMemo(() => getOSProjects(), []);
  const desktopIcons: DesktopIconItem[] = useMemo(
    () => [
      { id: 'my-computer', label: 'My Computer', kind: 'computer' },
      { id: 'recycle-bin', label: 'Recycle Bin', kind: 'recycle' },
      { id: 'about-me', label: 'About Me', kind: 'about' },
      { id: 'guestbook', label: 'Guestbook', kind: 'guestbook' },
      { id: 'contact', label: 'Contact', kind: 'contact' },
      { id: 'resume', label: 'My Resume', kind: 'resume' },
      ...projects.map((p) => ({
        id: `project:${p.id}`,
        label: p.name,
        kind: 'project' as const,
      })),
    ],
    [projects]
  );

  // Track viewport size when toggled into Fill Screen
  useEffect(() => {
    const onResize = () => {
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const virtualW = fillScreen ? Math.max(640, viewport.w) : OS_CONFIG.desktopVirtualSize.width;
  const virtualH = fillScreen ? Math.max(400, viewport.h) : OS_CONFIG.desktopVirtualSize.height;

  useEffect(() => {
    setDesktopBounds(virtualW, virtualH);
  }, [virtualW, virtualH, setDesktopBounds]);

  const isOverlayInteractive = pcMode && pcArrived && !pcExiting;
  const showXpDesktop = isOverlayInteractive && poweredPC && bootState === 'desktop';

  const matrixInfo = useMemo(() => {
    if (fillScreen || !screenCorners) {
      return { cssTransform: undefined as string | undefined, invH: null as number[] | null };
    }
    const H = solveHomography(
      [
        [0, 0],
        [virtualW, 0],
        [virtualW, virtualH],
        [0, virtualH],
      ],
      screenCorners
    );
    if (!H) {
      return { cssTransform: undefined as string | undefined, invH: null as number[] | null };
    }
    return {
      cssTransform: homographyToCssMatrix3d(H),
      invH: invert3x3(H),
    };
  }, [fillScreen, screenCorners, virtualW, virtualH]);

  const toDesktop = useCallback(
    (clientX: number, clientY: number): [number, number] => {
      if (fillScreen || !matrixInfo.invH) {
        return [clientX, clientY];
      }
      return applyHomography(matrixInfo.invH, clientX, clientY);
    },
    [fillScreen, matrixInfo.invH]
  );

  // Keyboard event isolation: Esc and Q are handled centrally by TVInteraction's input state machine,
  // except Q inside inputs/textareas/selects/contenteditable passes through for typing.
  useEffect(() => {
    if (!isOverlayInteractive) return;

    const stopRoomShortcuts = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'KeyQ') return;
      // Prevent typing or desktop navigation from firing room shortcuts
      e.stopPropagation();
    };

    window.addEventListener('keydown', stopRoomShortcuts, true);
    window.addEventListener('keyup', stopRoomShortcuts, true);
    window.addEventListener('keypress', stopRoomShortcuts, true);
    return () => {
      window.removeEventListener('keydown', stopRoomShortcuts, true);
      window.removeEventListener('keyup', stopRoomShortcuts, true);
      window.removeEventListener('keypress', stopRoomShortcuts, true);
    };
  }, [isOverlayInteractive]);

  if (!isOverlayInteractive) return null;

  const rowsPerCol = Math.max(1, Math.floor((virtualH - TASKBAR_H - PAD_TOP - 6) / CELL_H));
  const iconRects = desktopIcons.map((item, idx) => {
    const col = Math.floor(idx / rowsPerCol);
    const row = idx % rowsPerCol;
    return {
      ...item,
      x: PAD_LEFT + col * CELL_W,
      y: PAD_TOP + row * CELL_H,
    };
  });

  const handleDesktopPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setStartMenuOpen(false);
    setContextMenu(null);
    if (e.button !== 0) return;
    const targetEl = e.target as HTMLElement;
    if (
      targetEl.closest(
        '[data-xp-icon], [data-xp-window], [data-xp-dialog], [data-xp-taskbar], [data-start-menu], [data-xp-context]'
      )
    ) {
      return;
    }

    const [sx, sy] = toDesktop(e.clientX, e.clientY);
    e.currentTarget.setPointerCapture(e.pointerId);
    marqueeRef.current = { startX: sx, startY: sy };
    setSelectedIcons([]);
    setMarquee({ x1: sx, y1: sy, x2: sx, y2: sy });
  };

  const handleDesktopPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!marqueeRef.current) return;
    const [rawX, rawY] = toDesktop(e.clientX, e.clientY);
    const cx = Math.max(0, Math.min(virtualW, rawX));
    const cy = Math.max(0, Math.min(virtualH - TASKBAR_H, rawY));
    const m = {
      x1: marqueeRef.current.startX,
      y1: marqueeRef.current.startY,
      x2: cx,
      y2: cy,
    };
    setMarquee(m);

    const minX = Math.min(m.x1, m.x2);
    const maxX = Math.max(m.x1, m.x2);
    const minY = Math.min(m.y1, m.y2);
    const maxY = Math.max(m.y1, m.y2);
    if (maxX - minX > 4 || maxY - minY > 4) {
      const hits = iconRects
        .filter(
          (ic) =>
            ic.x < maxX &&
            ic.x + CELL_W - 6 > minX &&
            ic.y < maxY &&
            ic.y + CELL_H - 4 > minY
        )
        .map((ic) => ic.id);
      setSelectedIcons(hits);
    }
  };

  const handleDesktopPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!marqueeRef.current) return;
    marqueeRef.current = null;
    setMarquee(null);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore release errors
    }
  };

  const handleDesktopContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const [dx, dy] = toDesktop(e.clientX, e.clientY);
    const x = Math.min(virtualW - 135, Math.max(4, dx));
    const y = Math.min(virtualH - TASKBAR_H - 64, Math.max(4, dy));
    setStartMenuOpen(false);
    setContextMenu({ x, y });
  };

  const renderWindowBody = (win: (typeof windows)[number]) => {
    switch (win.kind) {
      case 'my-computer':
        return <MyComputerApp />;
      case 'recycle-bin':
        return <RecycleBinApp />;
      case 'about-me':
        return <AboutMeApp />;
      case 'guestbook':
        return <GuestbookApp />;
      case 'contact':
        return <ContactApp />;
      case 'resume':
        return <ResumeApp />;
      case 'project':
        return <ProjectFolderApp projectId={win.projectId || ''} />;
      default:
        return null;
    }
  };

  const marqueeRect = marquee
    ? {
        left: Math.min(marquee.x1, marquee.x2),
        top: Math.min(marquee.y1, marquee.y2),
        width: Math.abs(marquee.x2 - marquee.x1),
        height: Math.abs(marquee.y2 - marquee.y1),
      }
    : null;

  return (
    <>
      {/* Outside Controls at Top Right (Fill Screen + Exit), offset left of FPS Stats box */}
      <div className="fixed top-4 right-28 z-[9995] flex items-center gap-2 select-none">
        {showXpDesktop && (
          <button
            type="button"
            onClick={() => setFillScreen((v) => !v)}
            style={{
              background: 'rgba(14, 16, 22, 0.92)',
              border: '1px solid rgba(255, 255, 255, 0.22)',
            }}
            className="px-3 py-1.5 rounded-full text-[12px] font-medium text-neutral-100 hover:bg-neutral-800 cursor-pointer shadow-lg"
          >
            {fillScreen ? 'Fit monitor' : 'Fill screen'}
          </button>
        )}
        <button
          type="button"
          data-exit-focus-button="true"
          onClick={() => {
            const win = window as unknown as { __exitPcMode?: (lockPointer?: boolean) => void };
            win.__exitPcMode?.(true);
          }}
          style={{
            background: 'rgba(14, 16, 22, 0.92)',
            border: '1px solid rgba(255, 255, 255, 0.22)',
          }}
          className="px-3.5 py-1.5 rounded-full text-[12px] font-medium text-neutral-100 hover:bg-neutral-800 cursor-pointer shadow-lg"
        >
          Exit (Q)
        </button>
      </div>

      {/* Virtual Rai XP Desktop Overlay fitted with planar CSS matrix3d homography over the flat monitor glass */}
      {showXpDesktop && (
        <div
          data-raixp-overlay="true"
          style={{
            position: 'fixed',
            left: 0,
            top: 0,
            width: virtualW,
            height: virtualH,
            zIndex: 9000,
            overflow: 'hidden',
            transformOrigin: '0 0',
            transform: fillScreen ? undefined : matrixInfo.cssTransform,
            fontFamily: OS_CONFIG.fonts.ui,
            fontSize: 12,
          }}
          className="relative flex flex-col"
        >
            {/* Desktop Area */}
            <div
              key={desktopRefreshKey}
              onPointerDown={handleDesktopPointerDown}
              onPointerMove={handleDesktopPointerMove}
              onPointerUp={handleDesktopPointerUp}
              onPointerCancel={handleDesktopPointerUp}
              onContextMenu={handleDesktopContextMenu}
              className="relative flex-1 min-h-0 overflow-hidden select-none"
            >
              <XpDesktopWallpaper />

              {/* Desktop Icon Grid (75px cells, multi-column overflow for >8 projects) */}
              {iconRects.map((icon) => {
                const isSelected = selectedIcons.includes(icon.id);
                return (
                  <button
                    key={icon.id}
                    type="button"
                    data-xp-icon={icon.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      playKeyClickSound();
                      setStartMenuOpen(false);
                      setContextMenu(null);
                      setSelectedIcons([icon.id]);
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      playKeyClickSound();
                      openAppById(icon.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openAppById(icon.id);
                      }
                    }}
                    style={{
                      position: 'absolute',
                      left: icon.x,
                      top: icon.y,
                      width: CELL_W - 6,
                      height: CELL_H - 4,
                    }}
                    className={`p-1 rounded-[2px] flex flex-col items-center justify-start gap-1 text-center cursor-pointer focus:outline-none ${
                      isSelected
                        ? 'bg-[#316ac5]/80 ring-1 ring-white/75'
                        : 'hover:bg-white/15 focus-visible:ring-1 focus-visible:ring-white/80'
                    }`}
                  >
                    <DesktopSvgIcon kind={icon.kind} emptied={recycleBinEmptied} />
                    <span
                      className="w-full text-[12px] leading-[1.15] text-white line-clamp-2 break-words"
                      style={{
                        textShadow: '1px 1px 2px rgba(0, 0, 0, 0.95)',
                      }}
                    >
                      {icon.label}
                    </span>
                  </button>
                );
              })}

              {/* Marquee Selection Box */}
              {marqueeRect && (
                <div
                  style={{
                    position: 'absolute',
                    left: marqueeRect.left,
                    top: marqueeRect.top,
                    width: marqueeRect.width,
                    height: marqueeRect.height,
                    backgroundColor: 'rgba(49, 106, 197, 0.28)',
                    border: '1px solid #1d4ed8',
                    pointerEvents: 'none',
                  }}
                />
              )}

              {/* Open XP Windows */}
              {windows.map((win) => (
                <XpWindow key={win.id} win={win} toDesktop={toDesktop}>
                  {renderWindowBody(win)}
                </XpWindow>
              ))}

              {/* Desktop Right-Click Context Menu */}
              {contextMenu && (
                <div
                  data-xp-context="true"
                  onPointerDown={(e) => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    left: contextMenu.x,
                    top: contextMenu.y,
                    zIndex: 9750,
                    fontFamily: OS_CONFIG.fonts.ui,
                    fontSize: 12,
                  }}
                  className="w-[130px] bg-white border border-[#808080] py-1 shadow-md text-[#111827]"
                >
                  <button
                    type="button"
                    onClick={triggerDesktopRefresh}
                    className="w-full px-3 py-1 text-left text-[12px] hover:bg-[#316ac5] hover:text-white cursor-pointer"
                  >
                    Refresh
                  </button>
                  <div className="my-0.5 border-t border-[#e5e7eb]" />
                  <button
                    type="button"
                    onClick={() => {
                      setContextMenu(null);
                      openDialog({
                        kind: 'confirm',
                        title: 'Display Properties',
                        message: `${OS_CONFIG.versionLabel} — ${OS_CONFIG.userDisplayName} Workstation (${virtualW}x${virtualH}).`,
                        okLabel: 'OK',
                        cancelLabel: 'Close',
                      });
                    }}
                    className="w-full px-3 py-1 text-left text-[12px] hover:bg-[#316ac5] hover:text-white cursor-pointer"
                  >
                    Properties
                  </button>
                </div>
              )}

              <XpDialog toDesktop={toDesktop} />
              <TurnOffDialog />
            </div>

            <StartMenu />
            <Taskbar />
        </div>
      )}
    </>
  );
}
