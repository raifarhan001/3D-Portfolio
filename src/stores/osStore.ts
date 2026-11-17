'use client';

import { create } from 'zustand';
import { OS_CONFIG } from '@/config/osConfig';

export type OSWindowKind =
  | 'my-computer'
  | 'recycle-bin'
  | 'about-me'
  | 'contact'
  | 'resume'
  | 'project'
  | 'guestbook';

export interface OSWindow {
  id: string;
  kind: OSWindowKind;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  minimized: boolean;
  maximized: boolean;
  projectId?: string;
}

export interface OSDialogState {
  id: string;
  title: string;
  message: string;
  kind: 'error' | 'confirm';
  okLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
}

export interface OpenWindowInput {
  id: string;
  kind: OSWindowKind;
  title: string;
  width?: number;
  height?: number;
  projectId?: string;
}

const TASKBAR_HEIGHT = 30;
const MIN_WIN_W = 300;
const MIN_WIN_H = 210;

function clampWindowRect(
  x: number,
  y: number,
  width: number,
  height: number,
  deskW: number,
  deskH: number
): { x: number; y: number; width: number; height: number } {
  const usableH = Math.max(240, deskH - TASKBAR_HEIGHT);
  const w = Math.min(Math.max(MIN_WIN_W, width), Math.max(MIN_WIN_W, deskW - 12));
  const h = Math.min(Math.max(MIN_WIN_H, height), Math.max(MIN_WIN_H, usableH - 8));
  const maxX = Math.max(0, deskW - w);
  const maxY = Math.max(0, usableH - h);
  return {
    x: Math.max(0, Math.min(maxX, Math.round(x))),
    y: Math.max(0, Math.min(maxY, Math.round(y))),
    width: Math.round(w),
    height: Math.round(h),
  };
}

interface OSState {
  windows: OSWindow[];
  activeWindowId: string | null;
  nextZIndex: number;
  startMenuOpen: boolean;
  turnOffDialogOpen: boolean;
  contextMenu: { x: number; y: number } | null;
  selectedIcons: string[];
  recycleBinEmptied: boolean;
  activeDialog: OSDialogState | null;
  desktopBounds: { width: number; height: number };
  desktopRefreshKey: number;

  setDesktopBounds: (width: number, height: number) => void;
  openWindow: (spec: OpenWindowInput) => void;
  closeWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  toggleMaximizeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  toggleTaskbarWindow: (id: string) => void;
  moveWindow: (id: string, x: number, y: number) => void;
  resizeWindow: (id: string, width: number, height: number) => void;
  setStartMenuOpen: (open: boolean) => void;
  setTurnOffDialogOpen: (open: boolean) => void;
  setContextMenu: (pos: { x: number; y: number } | null) => void;
  setSelectedIcons: (ids: string[]) => void;
  triggerDesktopRefresh: () => void;
  emptyRecycleBin: () => void;
  openDialog: (dialog: Omit<OSDialogState, 'id'>) => void;
  closeDialog: () => void;
  logOff: () => void;
}

export const useOsStore = create<OSState>((set) => ({
  windows: [],
  activeWindowId: null,
  nextZIndex: 10,
  startMenuOpen: false,
  turnOffDialogOpen: false,
  contextMenu: null,
  selectedIcons: [],
  recycleBinEmptied: false,
  activeDialog: null,
  desktopBounds: { ...OS_CONFIG.desktopVirtualSize },
  desktopRefreshKey: 0,

  setDesktopBounds: (width, height) =>
    set((s) => {
      const clamped = s.windows.map((w) => {
        const rect = clampWindowRect(w.x, w.y, w.width, w.height, width, height);
        return { ...w, ...rect };
      });
      return { desktopBounds: { width, height }, windows: clamped };
    }),

  openWindow: (spec) =>
    set((s) => {
      const existing = s.windows.find((w) => w.id === spec.id);
      const z = s.nextZIndex;
      if (existing) {
        return {
          windows: s.windows.map((w) =>
            w.id === spec.id ? { ...w, minimized: false, zIndex: z } : w
          ),
          activeWindowId: spec.id,
          nextZIndex: z + 1,
          startMenuOpen: false,
          contextMenu: null,
        };
      }

      const count = s.windows.length;
      const defaultW = spec.width ?? (spec.kind === 'project' ? 840 : spec.kind === 'resume' ? 760 : 700);
      const defaultH = spec.height ?? (spec.kind === 'project' ? 430 : spec.kind === 'resume' ? 440 : 400);
      const step = (count % 6) * 26;
      const startX = 95 + step;
      const startY = 24 + step;
      const rect = clampWindowRect(
        startX,
        startY,
        defaultW,
        defaultH,
        s.desktopBounds.width,
        s.desktopBounds.height
      );

      const newWin: OSWindow = {
        id: spec.id,
        kind: spec.kind,
        title: spec.title,
        ...rect,
        zIndex: z,
        minimized: false,
        maximized: false,
        projectId: spec.projectId,
      };

      return {
        windows: [...s.windows, newWin],
        activeWindowId: spec.id,
        nextZIndex: z + 1,
        startMenuOpen: false,
        contextMenu: null,
      };
    }),

  closeWindow: (id) =>
    set((s) => {
      const remaining = s.windows.filter((w) => w.id !== id);
      const visible = remaining.filter((w) => !w.minimized).sort((a, b) => b.zIndex - a.zIndex);
      return {
        windows: remaining,
        activeWindowId: s.activeWindowId === id ? visible[0]?.id ?? null : s.activeWindowId,
      };
    }),

  minimizeWindow: (id) =>
    set((s) => {
      const updated = s.windows.map((w) => (w.id === id ? { ...w, minimized: true } : w));
      const visible = updated.filter((w) => !w.minimized).sort((a, b) => b.zIndex - a.zIndex);
      return {
        windows: updated,
        activeWindowId: s.activeWindowId === id ? visible[0]?.id ?? null : s.activeWindowId,
      };
    }),

  toggleMaximizeWindow: (id) =>
    set((s) => {
      const z = s.nextZIndex;
      return {
        windows: s.windows.map((w) =>
          w.id === id ? { ...w, maximized: !w.maximized, minimized: false, zIndex: z } : w
        ),
        activeWindowId: id,
        nextZIndex: z + 1,
      };
    }),

  focusWindow: (id) =>
    set((s) => {
      const target = s.windows.find((w) => w.id === id);
      if (!target) return s;
      const z = s.nextZIndex;
      return {
        windows: s.windows.map((w) =>
          w.id === id ? { ...w, minimized: false, zIndex: z } : w
        ),
        activeWindowId: id,
        nextZIndex: z + 1,
        startMenuOpen: false,
        contextMenu: null,
      };
    }),

  toggleTaskbarWindow: (id) =>
    set((s) => {
      const win = s.windows.find((w) => w.id === id);
      if (!win) return s;
      if (!win.minimized && s.activeWindowId === id) {
        const updated = s.windows.map((w) => (w.id === id ? { ...w, minimized: true } : w));
        const visible = updated.filter((w) => !w.minimized).sort((a, b) => b.zIndex - a.zIndex);
        return {
          windows: updated,
          activeWindowId: visible[0]?.id ?? null,
          startMenuOpen: false,
        };
      }
      const z = s.nextZIndex;
      return {
        windows: s.windows.map((w) =>
          w.id === id ? { ...w, minimized: false, zIndex: z } : w
        ),
        activeWindowId: id,
        nextZIndex: z + 1,
        startMenuOpen: false,
      };
    }),

  moveWindow: (id, x, y) =>
    set((s) => ({
      windows: s.windows.map((w) => {
        if (w.id !== id || w.maximized) return w;
        const rect = clampWindowRect(x, y, w.width, w.height, s.desktopBounds.width, s.desktopBounds.height);
        return { ...w, x: rect.x, y: rect.y };
      }),
    })),

  resizeWindow: (id, width, height) =>
    set((s) => ({
      windows: s.windows.map((w) => {
        if (w.id !== id || w.maximized) return w;
        const maxW = Math.max(MIN_WIN_W, s.desktopBounds.width - w.x - 4);
        const maxH = Math.max(MIN_WIN_H, s.desktopBounds.height - TASKBAR_HEIGHT - w.y - 2);
        return {
          ...w,
          width: Math.max(MIN_WIN_W, Math.min(maxW, Math.round(width))),
          height: Math.max(MIN_WIN_H, Math.min(maxH, Math.round(height))),
        };
      }),
    })),

  setStartMenuOpen: (startMenuOpen) =>
    set((s) => ({
      startMenuOpen,
      contextMenu: startMenuOpen ? null : s.contextMenu,
    })),

  setTurnOffDialogOpen: (turnOffDialogOpen) =>
    set({
      turnOffDialogOpen,
      startMenuOpen: false,
      contextMenu: null,
    }),

  setContextMenu: (contextMenu) =>
    set({
      contextMenu,
      startMenuOpen: false,
    }),

  setSelectedIcons: (selectedIcons) => set({ selectedIcons }),

  triggerDesktopRefresh: () =>
    set((s) => ({
      desktopRefreshKey: s.desktopRefreshKey + 1,
      contextMenu: null,
      selectedIcons: [],
    })),

  emptyRecycleBin: () => set({ recycleBinEmptied: true }),

  openDialog: (dialog) =>
    set({
      activeDialog: {
        ...dialog,
        id: `dlg-${Date.now()}`,
      },
      contextMenu: null,
    }),

  closeDialog: () => set({ activeDialog: null }),

  logOff: () =>
    set({
      windows: [],
      activeWindowId: null,
      startMenuOpen: false,
      turnOffDialogOpen: false,
      contextMenu: null,
      activeDialog: null,
      selectedIcons: [],
    }),
}));
