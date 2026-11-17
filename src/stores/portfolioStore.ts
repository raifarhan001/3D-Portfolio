'use client';

import { create } from 'zustand';
import { ROOM_CONTENT_CONFIG, type GraphicsQuality } from '@/config/roomContent';
import type { QualityPreference } from '@/config/welcomeConfig';

export type PortfolioFocusKind = 'certificate' | 'achievements' | 'phone' | 'resume';
export type PhoneScreen = 'lock' | 'home' | 'compose';

export interface PortfolioFocusMode {
  kind: PortfolioFocusKind;
  certificateIndex: number;
}

interface PortfolioState {
  focusMode: PortfolioFocusMode | null;
  focusArrived: boolean;
  focusExiting: boolean;
  phoneScreen: PhoneScreen;
  qualityMode: QualityPreference;
  detectedTier: GraphicsQuality;
  graphicsQuality: GraphicsQuality;

  enterFocus: (kind: PortfolioFocusKind, certificateIndex?: number) => void;
  setCertificateIndex: (index: number) => void;
  stepCertificate: (delta: -1 | 1) => void;
  setFocusArrived: (arrived: boolean) => void;
  setFocusExiting: (exiting: boolean) => void;
  setPhoneScreen: (screen: PhoneScreen) => void;
  clearFocus: () => void;
  setDetectedTier: (tier: GraphicsQuality) => void;
  setQualityMode: (mode: QualityPreference) => void;
  setGraphicsQuality: (quality: GraphicsQuality) => void;
  toggleGraphicsQuality: () => void;
}

export const usePortfolioStore = create<PortfolioState>((set) => ({
  focusMode: null,
  focusArrived: false,
  focusExiting: false,
  phoneScreen: 'lock',
  qualityMode: 'high',
  detectedTier: 'high',
  graphicsQuality: 'high',

  enterFocus: (kind, certificateIndex = 0) =>
    set({
      focusMode: { kind, certificateIndex },
      focusArrived: false,
      focusExiting: false,
      phoneScreen: 'lock',
    }),

  setCertificateIndex: (index) =>
    set((s) => {
      if (!s.focusMode || s.focusMode.kind !== 'certificate') return s;
      const total = ROOM_CONTENT_CONFIG.certificates.length;
      const wrapped = ((index % total) + total) % total;
      return {
        focusMode: { ...s.focusMode, certificateIndex: wrapped },
      };
    }),

  stepCertificate: (delta) =>
    set((s) => {
      if (!s.focusMode || s.focusMode.kind !== 'certificate') return s;
      const total = ROOM_CONTENT_CONFIG.certificates.length;
      const wrapped = ((s.focusMode.certificateIndex + delta) % total + total) % total;
      return {
        focusMode: { ...s.focusMode, certificateIndex: wrapped },
      };
    }),

  setFocusArrived: (focusArrived) => set({ focusArrived }),
  setFocusExiting: (focusExiting) => set({ focusExiting }),
  setPhoneScreen: (phoneScreen) => set({ phoneScreen }),
  clearFocus: () =>
    set({ focusMode: null, focusArrived: false, focusExiting: false, phoneScreen: 'lock' }),

  setDetectedTier: (tier) =>
    set({
      detectedTier: tier,
      graphicsQuality: 'high',
    }),

  setQualityMode: (mode) =>
    set({
      qualityMode: mode,
      graphicsQuality: 'high',
    }),

  setGraphicsQuality: (_quality) =>
    set({ graphicsQuality: 'high' }),

  toggleGraphicsQuality: () =>
    set({ graphicsQuality: 'high' }),
}));
