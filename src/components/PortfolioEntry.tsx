'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { WELCOME_CONFIG } from '@/config/welcomeConfig';
import { useInputStore } from '@/stores/inputStore';
import { usePortfolioStore } from '@/stores/portfolioStore';
import { useRoomLoadStore } from '@/stores/loadingStore';
import type { WelcomeGitHubSummary } from '@/utils/githubProjects';
import {
  detectClientRenderCapabilities,
  detectMobileDevice,
} from '@/utils/webglSupport';
import { unlockSfxAudio } from '@/utils/sound';
import { prefetchMonaSpeech, warmUpMonaSpeech } from '@/utils/monaVoice';
import { ENTRY_WELCOME_LINE } from '@/stores/robotStore';
import WelcomeScreen from '@/components/welcome/WelcomeScreen';

const DynamicScene = dynamic(
  () => {
    useRoomLoadStore.getState().setProgress(18, 'bundle');
    return import('@/components/Scene').then((mod) => {
      useRoomLoadStore.getState().setProgress(32, 'textures');
      return mod;
    });
  },
  {
    ssr: false,
    loading: () => null,
  }
);

export default function PortfolioEntry({
  githubSummary,
}: {
  githubSummary: WelcomeGitHubSummary;
}) {
  const inputMode = useInputStore((s) => s.mode);
  const qualityMode = usePortfolioStore((s) => s.qualityMode);
  const setQualityMode = usePortfolioStore((s) => s.setQualityMode);
  const setDetectedTier = usePortfolioStore((s) => s.setDetectedTier);

  const loadStarted = useRoomLoadStore((s) => s.started);
  const percent = useRoomLoadStore((s) => s.percent);
  const stageKey = useRoomLoadStore((s) => s.stageKey);
  const ready = useRoomLoadStore((s) => s.ready);
  const capabilitiesChecked = useRoomLoadStore((s) => s.capabilitiesChecked);
  const webglSupported = useRoomLoadStore((s) => s.webglSupported);
  const isMobile = useRoomLoadStore((s) => s.isMobile);
  const gpuTier = useRoomLoadStore((s) => s.gpuTier);
  const setCapabilities = useRoomLoadStore((s) => s.setCapabilities);

  const [isFadingOut, setIsFadingOut] = useState(false);

  const canEnter3D = !capabilitiesChecked || (webglSupported && !isMobile && gpuTier !== 'unsupported');
  const welcomeMounted = inputMode === 'menu' || isFadingOut;

  // Suppress Chrome extension noise in client unhandled rejections
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reasonStr = String(event.reason?.stack || event.reason?.message || event.reason || '');
      if (
        reasonStr.includes('chrome-extension://') ||
        reasonStr.includes('chrome: call method') ||
        reasonStr.includes('crxemulator')
      ) {
        event.preventDefault();
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => window.removeEventListener('unhandledrejection', handleUnhandledRejection);
  }, []);

  // Defer WebGL probing & 3D Scene chunk loading until AFTER first paint so FCP stays fast
  useEffect(() => {
    const skip = new URLSearchParams(window.location.search).get('skip') === '1';
    if (skip) {
      useInputStore.getState().enterPaused();
      const caps = detectClientRenderCapabilities();
      setCapabilities({
        webglSupported: caps.webglSupported,
        isMobile: caps.isMobile,
        gpuTier: caps.gpuTier,
      });
      setDetectedTier(caps.recommendedQuality);
      useRoomLoadStore.getState().startLoading();
      return;
    }

    // Fast mobile check does not touch WebGL/GPU at all
    if (detectMobileDevice()) {
      setCapabilities({
        webglSupported: true,
        isMobile: true,
        gpuTier: 'low',
      });
      setDetectedTier('low');
      return;
    }

    let cancelled = false;
    let startedProbe = false;
    let timerId: ReturnType<typeof setTimeout> | undefined;
    let idleId: number | undefined;
    const win = window as Window & {
      requestIdleCallback?: (cb: IdleRequestCallback, opts?: IdleRequestOptions) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    const probeAndLoad = () => {
      if (cancelled || startedProbe) return;
      startedProbe = true;
      detachIntentListeners();
      if (timerId !== undefined) clearTimeout(timerId);
      const caps = detectClientRenderCapabilities();
      setCapabilities({
        webglSupported: caps.webglSupported,
        isMobile: caps.isMobile,
        gpuTier: caps.gpuTier,
      });
      setDetectedTier(caps.recommendedQuality);
      if (caps.canEnter3D) {
        useRoomLoadStore.getState().startLoading();
      }
    };

    const scheduleIdleProbe = () => {
      if (cancelled || startedProbe) return;
      if (typeof win.requestIdleCallback === 'function') {
        idleId = win.requestIdleCallback(probeAndLoad, { timeout: 600 });
      } else {
        probeAndLoad();
      }
    };

    const onIntentMove = (e: PointerEvent) => {
      if (!e.isTrusted) return;
      if (Math.abs(e.movementX) + Math.abs(e.movementY) > 0) {
        scheduleIdleProbe();
      }
    };

    const detachIntentListeners = () => {
      window.removeEventListener('pointermove', onIntentMove);
      window.removeEventListener('pointerdown', scheduleIdleProbe);
      window.removeEventListener('keydown', scheduleIdleProbe);
    };

    const rafId = requestAnimationFrame(() => {
      if (cancelled) return;
      // Trigger prewarm on real user interaction, or cleanly after initial FCP/LCP paint settles
      window.addEventListener('pointermove', onIntentMove, { passive: true });
      window.addEventListener('pointerdown', scheduleIdleProbe, { once: true, passive: true });
      window.addEventListener('keydown', scheduleIdleProbe, { once: true });
      timerId = setTimeout(scheduleIdleProbe, 5800);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      detachIntentListeners();
      if (timerId !== undefined) clearTimeout(timerId);
      if (idleId !== undefined && typeof win.cancelIdleCallback === 'function') {
        win.cancelIdleCallback(idleId);
      }
    };
  }, [setCapabilities, setDetectedTier]);

  // Preload ELSA's neural welcome audio as soon as the 3D scene is ready on the menu screen
  useEffect(() => {
    if (ready && inputMode === 'menu') {
      prefetchMonaSpeech(ENTRY_WELCOME_LINE);
    }
  }, [ready, inputMode]);

  const handleEnterRoom = useCallback(() => {
    if (!ready || !canEnter3D) return;
    unlockSfxAudio();
    warmUpMonaSpeech();
    setIsFadingOut(true);

    const lockFn = useRoomLoadStore.getState().requestEnterLock;
    if (lockFn) {
      lockFn();
    } else {
      useInputStore.getState().enterPaused();
    }

    // If browser denies pointer lock silently, transition to 'paused' so "Click to resume" appears
    setTimeout(() => {
      if (useInputStore.getState().mode === 'menu' && document.pointerLockElement === null) {
        useInputStore.getState().enterPaused();
      }
    }, 180);

    setTimeout(() => {
      setIsFadingOut(false);
    }, WELCOME_CONFIG.cinema.timings.enterDollyMs);
  }, [ready, canEnter3D]);

  const stageLabel = WELCOME_CONFIG.loadingStages[stageKey];

  return (
    <div
      className={
        welcomeMounted
          ? 'relative h-full w-full overflow-hidden bg-[#07080B]'
          : 'fixed inset-0 w-full h-full overflow-hidden bg-[#07080B] select-none'
      }
    >
      {/* Deferred 3D Scene (ssr: false; hidden until Welcome dolly-to-black completes) */}
      {loadStarted && canEnter3D && (
        <div
          aria-hidden={welcomeMounted ? true : undefined}
          className={
            welcomeMounted
              ? 'pointer-events-none fixed inset-0 opacity-0 overflow-hidden'
              : 'fixed inset-0 w-full h-full overflow-hidden'
          }
        >
          <DynamicScene />
        </div>
      )}

      {/* Welcome Page Overlay (server-rendered into initial HTML for instant FCP & SEO) */}
      {welcomeMounted && (
        <WelcomeScreen
          githubSummary={githubSummary}
          percent={percent}
          stageLabel={stageLabel}
          ready={ready}
          canEnter3D={canEnter3D}
          capabilitiesChecked={capabilitiesChecked}
          qualityMode={qualityMode}
          onSelectQuality={setQualityMode}
          onEnterRoom={handleEnterRoom}
          fadingOut={isFadingOut}
        />
      )}
    </div>
  );
}
