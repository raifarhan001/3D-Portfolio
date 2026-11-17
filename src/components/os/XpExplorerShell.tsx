'use client';

import { useState, type ReactNode } from 'react';
import { OS_CONFIG } from '@/config/osConfig';

export interface ExplorerTaskItem {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export interface ExplorerTaskGroup {
  id: string;
  title: string;
  items?: ExplorerTaskItem[];
  body?: ReactNode;
}

interface XpExplorerShellProps {
  addressPath: string;
  statusText: string;
  canBack?: boolean;
  canForward?: boolean;
  canUp?: boolean;
  onBack?: () => void;
  onForward?: () => void;
  onUp?: () => void;
  taskGroups: ExplorerTaskGroup[];
  children: ReactNode;
}

const MENU_LABELS = ['File', 'Edit', 'View', 'Favorites', 'Tools', 'Help'];

/**
 * Shared XP Explorer chrome reused for My Computer, Recycle Bin, and My Projects windows:
 * menu bar, Back/Forward/Up toolbar, address bar, collapsible left task panes, main pane, status bar.
 */
export default function XpExplorerShell({
  addressPath,
  statusText,
  canBack = false,
  canForward = false,
  canUp = false,
  onBack,
  onForward,
  onUp,
  taskGroups,
  children,
}: XpExplorerShellProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleGroup = (id: string) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div
      className="flex-1 min-h-0 flex flex-col"
      style={{ fontFamily: OS_CONFIG.fonts.ui, fontSize: 12 }}
    >
      {/* Menu Bar */}
      <div className="h-[22px] px-2 flex items-center gap-3 bg-[#ece9d8] border-b border-[#d4d0c8] text-[#1f2937] text-[12px] shrink-0">
        {MENU_LABELS.map((item) => (
          <span key={item} className="px-1 py-0.5 rounded-xs hover:bg-[#316ac5] hover:text-white cursor-default">
            {item}
          </span>
        ))}
      </div>

      {/* Navigation Toolbar */}
      <div className="h-[32px] px-2 flex items-center gap-1.5 bg-[#ece9d8] border-b border-[#d4d0c8] shrink-0">
        <button
          type="button"
          onClick={onBack}
          disabled={!canBack}
          className="px-2 py-0.5 flex items-center gap-1 rounded-[3px] text-[12px] border border-transparent hover:border-[#9ca3af] hover:bg-white/60 disabled:opacity-45 disabled:hover:border-transparent disabled:hover:bg-transparent"
        >
          <span className="inline-flex w-[18px] h-[18px] rounded-full bg-[#3d993d] text-white items-center justify-center text-[11px] font-bold">
            &larr;
          </span>
          <span>Back</span>
        </button>

        <button
          type="button"
          onClick={onForward}
          disabled={!canForward}
          aria-label="Forward"
          className="px-1.5 py-0.5 flex items-center gap-1 rounded-[3px] text-[12px] border border-transparent hover:border-[#9ca3af] hover:bg-white/60 disabled:opacity-45 disabled:hover:border-transparent disabled:hover:bg-transparent"
        >
          <span className="inline-flex w-[18px] h-[18px] rounded-full bg-[#3d993d] text-white items-center justify-center text-[11px] font-bold">
            &rarr;
          </span>
        </button>

        <div className="w-[1px] h-[18px] bg-[#c4bfb3] mx-0.5" />

        <button
          type="button"
          onClick={onUp}
          disabled={!canUp}
          className="px-2 py-0.5 flex items-center gap-1 rounded-[3px] text-[12px] border border-transparent hover:border-[#9ca3af] hover:bg-white/60 disabled:opacity-45 disabled:hover:border-transparent disabled:hover:bg-transparent"
        >
          <span className="inline-flex w-[18px] h-[18px] rounded-xs bg-[#facc15] border border-[#a16207] text-[#111827] items-center justify-center text-[11px] font-bold">
            &uarr;
          </span>
          <span>Up</span>
        </button>
      </div>

      {/* Address Bar */}
      <div className="h-[26px] px-2 flex items-center gap-2 bg-[#ece9d8] border-b border-[#aca899] shrink-0">
        <span className="text-[#4b5563] text-[12px] shrink-0">Address</span>
        <div className="flex-1 h-[20px] px-2 bg-white border border-[#7f9db9] flex items-center text-[12px] text-[#111827] truncate">
          {addressPath}
        </div>
      </div>

      {/* Body Split: Blue Task Pane + White Content View */}
      <div className="flex-1 min-h-0 flex">
        <aside
          className="w-[194px] shrink-0 p-2 overflow-y-auto flex flex-col gap-2.5 select-none"
          style={{
            background: `linear-gradient(180deg, ${OS_CONFIG.colors.taskPaneBgTop} 0%, ${OS_CONFIG.colors.taskPaneBgBottom} 100%)`,
          }}
        >
          {taskGroups.map((group) => {
            const isClosed = !!collapsed[group.id];
            return (
              <div key={group.id} className="rounded-t-[4px] overflow-hidden border border-white/40 shadow-xs">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  style={{
                    background: `linear-gradient(90deg, ${OS_CONFIG.colors.taskHeaderBgStart} 0%, ${OS_CONFIG.colors.taskHeaderBgEnd} 100%)`,
                  }}
                  className="w-full px-2.5 py-1 flex items-center justify-between text-left text-[12px] font-bold text-[#215dc6] hover:brightness-98"
                >
                  <span className="truncate">{group.title}</span>
                  <span className="text-[11px] text-[#215dc6] shrink-0 ml-1">
                    {isClosed ? 'v' : '^'}
                  </span>
                </button>
                {!isClosed && (
                  <div
                    className="p-2 flex flex-col gap-1.5 text-[12px] text-[#1e3a8a]"
                    style={{ backgroundColor: OS_CONFIG.colors.taskCardBg }}
                  >
                    {group.items &&
                      group.items.map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={item.onClick}
                          disabled={item.disabled}
                          className="text-left text-[12px] text-[#215dc6] hover:underline disabled:opacity-45 disabled:no-underline leading-snug"
                        >
                          {item.label}
                        </button>
                      ))}
                    {group.body}
                  </div>
                )}
              </div>
            );
          })}
        </aside>

        <main className="flex-1 min-w-0 min-h-0 bg-white overflow-y-auto p-3 text-[#111827]">
          {children}
        </main>
      </div>

      {/* Status Bar */}
      <div className="h-[22px] px-2.5 flex items-center justify-between bg-[#ece9d8] border-t border-[#aca899] text-[12px] text-[#374151] shrink-0">
        <span className="truncate">{statusText}</span>
        <span className="pl-3 border-l border-[#aca899] text-[12px] text-[#4b5563] shrink-0">
          My Computer
        </span>
      </div>
    </div>
  );
}
