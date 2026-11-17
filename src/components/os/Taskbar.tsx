'use client';

import { useEffect, useState } from 'react';
import { OS_CONFIG } from '@/config/osConfig';
import { useOsStore, type OSWindowKind } from '@/stores/osStore';
import {
  ComputerIcon,
  FolderIcon,
  MailIcon,
  NotepadIcon,
  PdfDocIcon,
  RecycleBinIcon,
  TrayIconsRow,
  XpEmblemIcon,
} from '@/components/os/xpIcons';

function formatClock(): string {
  return new Date().toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function WindowPillIcon({
  kind,
  emptied,
}: {
  kind: OSWindowKind;
  emptied: boolean;
}) {
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

export default function Taskbar() {
  const windows = useOsStore((s) => s.windows);
  const activeWindowId = useOsStore((s) => s.activeWindowId);
  const startMenuOpen = useOsStore((s) => s.startMenuOpen);
  const recycleBinEmptied = useOsStore((s) => s.recycleBinEmptied);
  const setStartMenuOpen = useOsStore((s) => s.setStartMenuOpen);
  const toggleTaskbarWindow = useOsStore((s) => s.toggleTaskbarWindow);

  const [clockText, setClockText] = useState<string>(() => formatClock());

  useEffect(() => {
    const id = window.setInterval(() => {
      setClockText(formatClock());
    }, 30000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      data-xp-taskbar="true"
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        height: 30,
        background: `linear-gradient(180deg, ${OS_CONFIG.colors.taskbarEnd} 0%, ${OS_CONFIG.colors.taskbarStart} 22%, #1941a5 100%)`,
        borderTop: `2px solid ${OS_CONFIG.colors.taskbarTopEdge}`,
        fontFamily: OS_CONFIG.fonts.ui,
        fontSize: 12,
      }}
      className="relative z-[9500] shrink-0 w-full flex items-center justify-between select-none"
    >
      {/* Green Luna Start Button */}
      <button
        type="button"
        data-start-button="true"
        onClick={() => setStartMenuOpen(!startMenuOpen)}
        style={{
          background: startMenuOpen
            ? 'linear-gradient(180deg, #2b7b2b 0%, #3d9d3d 100%)'
            : `linear-gradient(180deg, #54b74d 0%, ${OS_CONFIG.colors.startBtnStart} 45%, ${OS_CONFIG.colors.startBtnEnd} 100%)`,
          borderTopRightRadius: 10,
          borderBottomRightRadius: 10,
          fontFamily: OS_CONFIG.fonts.title,
          boxShadow: startMenuOpen
            ? 'inset 1px 2px 4px rgba(0,0,0,0.4)'
            : 'inset 0 1px 1px rgba(255,255,255,0.45), 1px 0 3px rgba(0,0,0,0.35)',
        }}
        className="h-full pl-2.5 pr-4 flex items-center gap-1.5 text-white font-bold italic text-[14px] shrink-0 hover:brightness-105 cursor-pointer"
      >
        <XpEmblemIcon size={17} />
        <span style={{ textShadow: '1px 1px 1px rgba(0,0,0,0.55)' }}>start</span>
      </button>

      {/* Open Window Taskbar Buttons */}
      <div className="flex-1 min-w-0 px-2 flex items-center gap-1 overflow-x-auto">
        {windows.map((win) => {
          const isPressed = activeWindowId === win.id && !win.minimized;
          return (
            <button
              key={win.id}
              type="button"
              data-xp-taskbar-win={win.id}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => toggleTaskbarWindow(win.id)}
              style={{
                background: isPressed
                  ? 'linear-gradient(180deg, #1b4aa8 0%, #245cd4 100%)'
                  : 'linear-gradient(180deg, #4b8ff7 0%, #2865dc 100%)',
                boxShadow: isPressed
                  ? 'inset 1px 1px 3px rgba(0,0,0,0.55)'
                  : 'inset 0 1px 0 rgba(255,255,255,0.35), 1px 1px 2px rgba(0,0,0,0.25)',
              }}
              className={`h-[22px] max-w-[168px] min-w-[96px] px-2 rounded-[3px] border border-[#133b96] flex items-center gap-1.5 text-white text-[12px] text-left shrink-0 cursor-pointer ${
                isPressed ? 'font-bold' : 'font-medium hover:brightness-110'
              }`}
            >
              <span className="shrink-0">
                <WindowPillIcon kind={win.kind} emptied={recycleBinEmptied} />
              </span>
              <span className="truncate">{win.title}</span>
            </button>
          );
        })}
      </div>

      {/* System Tray + Clock */}
      <div
        style={{
          background: 'linear-gradient(180deg, #1290e8 0%, #0d6fc4 100%)',
          borderLeft: '1px solid #08488a',
        }}
        className="h-full px-2.5 flex items-center gap-2.5 text-white shrink-0"
      >
        <TrayIconsRow />
        <span className="text-[12px] font-medium whitespace-nowrap">{clockText}</span>
      </div>
    </div>
  );
}
