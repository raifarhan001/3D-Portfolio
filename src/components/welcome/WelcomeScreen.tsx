'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { WELCOME_CONFIG, type QualityPreference } from '@/config/welcomeConfig';
import { WELCOME_SCENE_PLACEHOLDERS } from '@/config/welcomePlaceholders';
import type { WelcomeGitHubSummary } from '@/utils/githubProjects';

export interface WelcomeScreenProps {
  githubSummary: WelcomeGitHubSummary;
  percent: number;
  stageLabel: string;
  ready: boolean;
  canEnter3D: boolean;
  capabilitiesChecked: boolean;
  qualityMode?: QualityPreference;
  onSelectQuality?: (mode: QualityPreference) => void;
  onEnterRoom: () => void;
  fadingOut: boolean;
}

function splitDisplayName(fullName: string): { first: string; rest: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { first: fullName.trim(), rest: '' };
  }
  return {
    first: parts[0],
    rest: parts.slice(1).join(' '),
  };
}

export default function WelcomeScreen({
  githubSummary,
  percent,
  stageLabel,
  ready,
  canEnter3D,
  capabilitiesChecked,
  qualityMode,
  onSelectQuality,
  onEnterRoom,
  fadingOut,
}: WelcomeScreenProps) {
  const { cinema } = WELCOME_CONFIG;
  const displayName = githubSummary.displayName || WELCOME_CONFIG.fallbackName;
  const { first: firstName, rest: restName } = splitDisplayName(displayName);
  const tagline = WELCOME_CONFIG.tagline;
  const isUnsupported = capabilitiesChecked && !canEnter3D;

  const [activeSceneIdx, setActiveSceneIdx] = useState(0);
  const [secondaryLoaded, setSecondaryLoaded] = useState(false);
  const [enterHovered, setEnterHovered] = useState(false);
  const [pulseReady, setPulseReady] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);

  const sceneParallaxRef = useRef<HTMLDivElement>(null);
  const textParallaxRef = useRef<HTMLDivElement>(null);
  const ringTextWrapRef = useRef<SVGSVGElement>(null);
  const ringAnimRef = useRef<Animation | null>(null);
  const enterHoveredRef = useRef(false);
  const hasHoveredOnceRef = useRef(false);
  const wasReadyRef = useRef(ready);

  useEffect(() => {
    enterHoveredRef.current = enterHovered;
    if (enterHovered) {
      hasHoveredOnceRef.current = true;
    }
  }, [enterHovered]);

  // Track active breakpoint so only the visible Enter/Quick View controls own automation data attributes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(min-width: 768px)');
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  // Respect prefers-reduced-motion live
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Trigger one soft pulse when room finishes warming up
  useEffect(() => {
    if (!wasReadyRef.current && ready) {
      wasReadyRef.current = true;
      const frame = requestAnimationFrame(() => setPulseReady(true));
      return () => cancelAnimationFrame(frame);
    }
    wasReadyRef.current = ready;
  }, [ready]);

  // Preload scenes 2 and 3 strictly after FCP/LCP settle (well before 7s crossfade)
  useEffect(() => {
    if (reducedMotion) return;
    let timerId: ReturnType<typeof setTimeout> | undefined;
    const rafId = requestAnimationFrame(() => {
      timerId = setTimeout(() => setSecondaryLoaded(true), 2200);
    });
    return () => {
      cancelAnimationFrame(rafId);
      if (timerId !== undefined) clearTimeout(timerId);
    };
  }, [reducedMotion]);

  // Rotate scenes every 7s when visible and motion is enabled
  useEffect(() => {
    if (reducedMotion || !secondaryLoaded || fadingOut) return;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const startRotation = () => {
      if (intervalId !== null || document.hidden) return;
      intervalId = setInterval(() => {
        setActiveSceneIdx((prev) => (prev + 1) % cinema.scenes.length);
      }, cinema.timings.sceneIntervalMs);
    };

    const stopRotation = () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibility = () => {
      if (document.hidden) {
        stopRotation();
      } else {
        startRotation();
      }
    };

    startRotation();
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      stopRotation();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [cinema.scenes.length, cinema.timings.sceneIntervalMs, fadingOut, reducedMotion, secondaryLoaded]);

  // Smooth Web Animations API rotation for the circular SVG text (slows gently to a stop on hover)
  useEffect(() => {
    const el = ringTextWrapRef.current;
    if (!el || reducedMotion || isUnsupported || typeof el.animate !== 'function') return;

    const anim = el.animate(
      [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
      {
        duration: 24000,
        iterations: Infinity,
        easing: 'linear',
      }
    );
    ringAnimRef.current = anim;

    return () => {
      anim.cancel();
      ringAnimRef.current = null;
    };
  }, [isUnsupported, reducedMotion]);

  useEffect(() => {
    const anim = ringAnimRef.current;
    if (!anim || reducedMotion || !hasHoveredOnceRef.current) return;

    const targetRate = enterHovered ? 0 : 1;
    let currentRate = anim.playbackRate;
    let rafId = 0;

    const stepRate = () => {
      currentRate += (targetRate - currentRate) * 0.14;
      if (Math.abs(targetRate - currentRate) < 0.015) {
        anim.playbackRate = targetRate;
        return;
      }
      anim.playbackRate = Math.max(0, currentRate);
      rafId = requestAnimationFrame(stepRate);
    };

    rafId = requestAnimationFrame(stepRate);
    return () => cancelAnimationFrame(rafId);
  }, [enterHovered, reducedMotion]);

  // Pointer parallax (desktop non-touch only; stops rAF loop cleanly after 2s idle)
  useEffect(() => {
    if (reducedMotion || typeof window === 'undefined') return;
    const isCoarsePointer =
      window.matchMedia?.('(pointer: coarse)')?.matches ||
      window.matchMedia?.('(hover: none)')?.matches;
    if (isCoarsePointer) return;

    let targetX = 0;
    let targetY = 0;
    let curSceneX = 0;
    let curSceneY = 0;
    let curTextX = 0;
    let curTextY = 0;
    let rafId: number | null = null;
    let lastMoveTs = performance.now();

    const tick = () => {
      const now = performance.now();
      curSceneX += (-targetX * 14 - curSceneX) * 0.08;
      curSceneY += (-targetY * 14 - curSceneY) * 0.08;
      curTextX += (-targetX * 4 - curTextX) * 0.08;
      curTextY += (-targetY * 4 - curTextY) * 0.08;

      if (sceneParallaxRef.current) {
        sceneParallaxRef.current.style.transform = `translate3d(${curSceneX.toFixed(2)}px, ${curSceneY.toFixed(2)}px, 0)`;
      }
      if (textParallaxRef.current) {
        textParallaxRef.current.style.transform = `translate3d(${curTextX.toFixed(2)}px, ${curTextY.toFixed(2)}px, 0)`;
      }

      const settled =
        Math.abs(-targetX * 14 - curSceneX) < 0.08 &&
        Math.abs(-targetY * 14 - curSceneY) < 0.08;
      if (now - lastMoveTs >= cinema.timings.parallaxIdleStopMs && settled) {
        rafId = null;
        return;
      }
      rafId = requestAnimationFrame(tick);
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const nx = (e.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
      const ny = (e.clientY / Math.max(1, window.innerHeight)) * 2 - 1;
      targetX = Math.max(-1, Math.min(1, nx));
      targetY = Math.max(-1, Math.min(1, ny));
      lastMoveTs = performance.now();
      if (rafId === null) {
        rafId = requestAnimationFrame(tick);
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [cinema.timings.parallaxIdleStopMs, reducedMotion]);

  // Enter key triggers room entry when ready
  useEffect(() => {
    if (!ready || !canEnter3D || fadingOut) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'A') return;
        if (tag === 'BUTTON' && target.dataset.enterRoomButton !== 'true') return;
      }
      e.preventDefault();
      onEnterRoom();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canEnter3D, fadingOut, onEnterRoom, ready]);

  // SVG Circle math for 132px button (r = 52 -> circumference ≈ 326.73)
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - Math.max(0, Math.min(100, percent)) / 100);

  const visibleScenes = secondaryLoaded ? cinema.scenes : [cinema.scenes[0]];
  const enterAriaLabel = isUnsupported
    ? WELCOME_CONFIG.cta.unsupportedNote
    : ready
      ? WELCOME_CONFIG.cta.enterRoom
      : `${WELCOME_CONFIG.cta.loadingPrefix} ${percent}%`;

  return (
    <div
      data-welcome-screen="true"
      data-welcome-ready={ready ? 'true' : 'false'}
      data-welcome-can-enter={canEnter3D ? 'true' : 'false'}
      data-active-scene={cinema.scenes[activeSceneIdx]?.id ?? 'scene-1'}
      style={{
        backgroundColor: cinema.palette.ink,
        color: cinema.palette.warmWhite,
      }}
      className={`fixed inset-0 z-[80] flex h-dvh w-screen flex-col overflow-hidden select-none ${
        fadingOut ? 'pointer-events-none' : ''
      }`}
    >
      {/* DESKTOP TOP LETTERBOX BAR (~7vh) */}
      <header
        style={{ backgroundColor: cinema.palette.ink }}
        className="relative z-20 hidden h-[7vh] min-h-[46px] max-h-[68px] w-full shrink-0 items-center justify-between px-[7vw] md:flex"
      >
        <span
          className="welcome-chrome-in font-serif italic text-[20px] leading-none"
          style={{ color: cinema.palette.warmWhite }}
        >
          {cinema.monogram}
        </span>

        <Link
          href="/quick"
          data-quick-view-link={isDesktop ? 'true' : undefined}
          className="welcome-chrome-in font-mono text-[11px] uppercase tracking-[0.2em] underline underline-offset-4 transition-colors hover:text-[#FFB36B] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#FFB36B] rounded-sm"
          style={{
            color: cinema.palette.warmWhite,
            textDecorationColor: 'rgba(242, 237, 228, 0.45)',
          }}
        >
          {WELCOME_CONFIG.cta.quickView}
        </Link>
      </header>

      {/* MAIN CINEMA STAGE (full height on mobile, bounded by 7vh letterbox bars on desktop) */}
      <main className="relative flex-1 min-h-0 w-full overflow-hidden">
        {/* Scene Photography Background (GPU transforms & opacity only) */}
        <div
          ref={sceneParallaxRef}
          aria-hidden="true"
          className="pointer-events-none absolute -inset-[20px] will-change-transform"
        >
          <div
            className="h-full w-full will-change-transform"
            style={
              fadingOut
                ? {
                    transform: reducedMotion ? 'scale(1)' : 'scale(1.6)',
                    opacity: 0,
                    transition: `transform ${cinema.timings.enterDollyMs}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${cinema.timings.enterDollyMs}ms ease`,
                  }
                : {
                    transform: enterHovered && ready && !reducedMotion ? 'scale(1.04)' : 'scale(1)',
                    opacity: 1,
                    transition: 'transform 700ms cubic-bezier(0.22, 1, 0.36, 1)',
                  }
            }
          >
            <div className="relative h-full w-full">
              <div className="welcome-intro-dolly relative h-full w-full">
                {visibleScenes.map((scene, idx) => {
                  const isActive = idx === activeSceneIdx;
                  const placeholderUri = WELCOME_SCENE_PLACEHOLDERS[scene.id];
                  return (
                    <div
                      key={scene.id}
                      data-scene-layer={scene.id}
                      data-scene-active={isActive ? 'true' : 'false'}
                      className="absolute inset-0 will-change-transform"
                      style={{
                        opacity: isActive ? 1 : 0,
                        transition: `opacity ${cinema.timings.sceneFadeMs}ms ease-in-out`,
                        backgroundImage: placeholderUri ? `url("${placeholderUri}")` : undefined,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={scene.src}
                        alt={scene.alt}
                        width={1920}
                        height={1080}
                        fetchPriority={idx === 0 ? 'high' : 'low'}
                        loading="eager"
                        decoding="async"
                        className={`h-full w-full object-cover ${
                          idx === 0 ? 'object-center' : 'object-[64%_center] md:object-center'
                        } ${scene.driftClass}`}
                      />
                    </div>
                  );
                })}
              </div>
              <div
                aria-hidden="true"
                className="welcome-veil-reveal pointer-events-none absolute inset-0"
                style={{ backgroundColor: cinema.palette.ink }}
              />
            </div>
          </div>
        </div>

        {/* One slow drifting light leak (amber + magenta @ ~8% opacity) */}
        <div
          aria-hidden="true"
          className="welcome-light-leak pointer-events-none absolute -inset-[12%]"
          style={{
            opacity: 0.08,
            background:
              'radial-gradient(circle at 76% 28%, #FFB36B 0%, rgba(255, 179, 107, 0) 42%), radial-gradient(circle at 64% 72%, #E11D89 0%, rgba(225, 29, 137, 0) 46%)',
          }}
        />

        {/* One tiled film grain overlay layer (@ opacity 0.06) */}
        <div
          aria-hidden="true"
          className="welcome-film-grain pointer-events-none absolute inset-0"
          style={{ opacity: 0.06 }}
        />

        {/* MOBILE TOP MONOGRAM (no letterbox bar on mobile) */}
        <div className="welcome-chrome-in pointer-events-none absolute top-6 left-[7vw] z-20 md:hidden">
          <span
            className="font-serif italic text-[20px] leading-none"
            style={{ color: cinema.palette.warmWhite }}
          >
            {cinema.monogram}
          </span>
        </div>

        {/* HERO TITLE BLOCK — Bottom Left of Image Area */}
        <div
          ref={textParallaxRef}
          style={
            fadingOut
              ? {
                  opacity: 0,
                  transition: `opacity ${cinema.timings.enterTextFadeMs}ms ease`,
                }
              : undefined
          }
          className="pointer-events-auto absolute right-[7vw] bottom-7 left-[7vw] z-20 flex flex-col items-start will-change-transform md:right-auto md:bottom-[clamp(24px,5.2vh,52px)]"
        >
          <section aria-labelledby="welcome-hero-name" className="w-full max-w-[78vw] md:max-w-[58vw]">
            <h1
              id="welcome-hero-name"
              className="font-serif font-normal leading-[0.86] tracking-[-0.025em] text-[22vw] md:text-[clamp(64px,min(14.8vw,26.5vh),276px)]"
              style={{
                color: cinema.palette.warmWhite,
                mixBlendMode: 'normal',
                textShadow: '0 2px 24px rgba(7, 8, 11, 0.45)',
              }}
            >
              <span className="block overflow-hidden pb-[0.06em]">
                <span className="welcome-reveal-line-1">{firstName}</span>
              </span>
              {restName && (
                <span className="block overflow-hidden pt-[0.02em] pb-[0.08em]">
                  <span className="welcome-reveal-line-2 italic">{restName}</span>
                </span>
              )}
            </h1>

            <div
              aria-hidden="true"
              className="welcome-rule-draw my-4 h-px w-[60px] md:my-[clamp(14px,2vh,22px)]"
              style={{ backgroundColor: cinema.palette.amber }}
            />

            <p
              className="welcome-tagline-in font-sans text-[20px] font-normal leading-[1.32] tracking-[-0.01em] max-w-[28ch]"
              style={{ color: cinema.palette.tagline }}
            >
              {tagline}
            </p>

            <p
              className="welcome-roles-in mt-3 font-mono text-[11px] uppercase tracking-[0.28em]"
              style={{ color: cinema.palette.muted }}
            >
              {WELCOME_CONFIG.roles.map((role, idx) => (
                <span key={role}>
                  {idx > 0 && <span aria-hidden="true"> · </span>}
                  <span>{role}</span>
                </span>
              ))}
            </p>
          </section>

          {/* MOBILE ACTIONS (< md) */}
          <div className="welcome-chrome-in mt-6 flex w-full flex-col gap-3 md:hidden">
            <Link
              href="/quick"
              data-quick-view-link={!isDesktop ? 'true' : undefined}
              className="flex h-12 w-full items-center justify-center border font-mono text-[11px] uppercase tracking-[0.2em] transition-colors hover:border-[#FFB36B] hover:text-[#FFB36B] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#FFB36B]"
              style={{
                borderColor: 'rgba(242, 237, 228, 0.72)',
                color: cinema.palette.warmWhite,
                backgroundColor: 'rgba(7, 8, 11, 0.45)',
              }}
            >
              {WELCOME_CONFIG.cta.quickView}
            </Link>

            {canEnter3D ? (
              <button
                type="button"
                data-enter-room-button={!isDesktop ? 'true' : undefined}
                disabled={!ready}
                onClick={onEnterRoom}
                aria-label={enterAriaLabel}
                className="flex h-9 w-full items-center justify-center font-mono text-[11px] uppercase tracking-[0.2em] transition-colors disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#FFB36B]"
                style={{ color: cinema.palette.muted }}
              >
                {ready
                  ? WELCOME_CONFIG.cta.enterRoom
                  : `${WELCOME_CONFIG.cta.loadingPrefix} · ${percent}%`}
              </button>
            ) : (
              capabilitiesChecked && (
                <p
                  className="text-center font-mono text-[11px]"
                  style={{ color: cinema.palette.muted }}
                >
                  {cinema.unsupportedNote}
                </p>
              )
            )}
          </div>
        </div>

        {/* DESKTOP ENTER CONTROL — Bottom Right of Image Area */}
        <div
          style={
            fadingOut
              ? {
                  opacity: 0,
                  transition: `opacity ${cinema.timings.enterTextFadeMs}ms ease`,
                }
              : undefined
          }
          className="welcome-chrome-in absolute right-[7vw] bottom-[clamp(24px,5.2vh,52px)] z-20 hidden flex-col items-center md:flex"
        >
          {isUnsupported ? (
            <div className="flex flex-col items-end gap-2 text-right">
              <Link
                href="/quick"
                data-quick-view-link={isDesktop ? 'true' : undefined}
                className="font-serif italic text-[36px] leading-none underline underline-offset-8 transition-colors hover:text-[#FFB36B] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#FFB36B]"
                style={{
                  color: cinema.palette.warmWhite,
                  textDecorationColor: cinema.palette.amber,
                }}
              >
                {WELCOME_CONFIG.cta.quickView}
              </Link>
              <span
                className="font-mono text-[11px]"
                style={{ color: cinema.palette.muted }}
              >
                {cinema.unsupportedNote}
              </span>
            </div>
          ) : (
            <>
              <div className="relative flex h-[160px] w-[160px] items-center justify-center">
                {/* Rotating circular SVG text ring (aria-hidden; slows smoothly to stop on hover) */}
                <svg
                  ref={ringTextWrapRef}
                  aria-hidden="true"
                  viewBox="0 0 160 160"
                  className="pointer-events-none absolute inset-0 h-full w-full will-change-transform"
                >
                  <defs>
                    <path
                      id="welcome-enter-text-circle"
                      d="M 80, 80 m -66, 0 a 66,66 0 1,1 132,0 a 66,66 0 1,1 -132,0"
                    />
                  </defs>
                  <text
                    className="font-mono text-[9px] uppercase"
                    style={{ letterSpacing: '7.45px' }}
                    fill="rgba(242, 237, 228, 0.74)"
                  >
                    <textPath href="#welcome-enter-text-circle" startOffset="0%">
                      {cinema.ringText}
                    </textPath>
                  </text>
                </svg>

                {/* Ready soft pulse halo */}
                {pulseReady && (
                  <span
                    aria-hidden="true"
                    className="welcome-ready-pulse-ring pointer-events-none absolute h-[132px] w-[132px] rounded-full border"
                    style={{ borderColor: cinema.palette.amber }}
                  />
                )}

                {/* 132px circular enter trigger */}
                <button
                  type="button"
                  data-enter-room-button={isDesktop ? 'true' : undefined}
                  disabled={!ready}
                  onClick={onEnterRoom}
                  onMouseEnter={() => setEnterHovered(true)}
                  onMouseLeave={() => setEnterHovered(false)}
                  onFocus={() => setEnterHovered(true)}
                  onBlur={() => setEnterHovered(false)}
                  aria-label={enterAriaLabel}
                  className={`relative flex h-[132px] w-[132px] items-center justify-center rounded-full font-mono text-[11px] focus-visible:outline-2 focus-visible:outline-offset-6 focus-visible:outline-[#FFB36B] ${
                    ready ? 'cursor-pointer' : 'cursor-wait'
                  }`}
                  style={{ backgroundColor: 'rgba(7, 8, 11, 0.28)' }}
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 132 132"
                    className="pointer-events-none absolute inset-0 h-full w-full -rotate-90"
                  >
                    <circle
                      cx="66"
                      cy="66"
                      r={radius}
                      fill="none"
                      stroke="rgba(242, 237, 228, 0.22)"
                      strokeWidth={1.25}
                    />
                    <circle
                      cx="66"
                      cy="66"
                      r={radius}
                      fill="none"
                      stroke={cinema.palette.amber}
                      strokeLinecap="round"
                      strokeWidth={enterHovered && ready ? 2.6 : 1.5}
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      style={{
                        transition: 'stroke-dashoffset 220ms ease-out, stroke-width 250ms ease',
                      }}
                    />
                  </svg>

                  {ready ? (
                    <svg
                      aria-hidden="true"
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="transition-transform duration-300 ease-out"
                      style={{
                        color: enterHovered ? cinema.palette.amber : cinema.palette.warmWhite,
                        transform: enterHovered ? 'translate3d(4px, 0, 0)' : 'translate3d(0, 0, 0)',
                      }}
                    >
                      <path d="M5 12h14" />
                      <path d="m13 6 6 6-6 6" />
                    </svg>
                  ) : (
                    <span
                      className="font-mono text-[11px] tabular-nums tracking-[0.06em]"
                      style={{ color: cinema.palette.warmWhite }}
                    >
                      {percent}%
                    </span>
                  )}
                </button>
              </div>

              {/* Tiny mono stage caption under the button */}
              <p
                aria-live="polite"
                data-loading-stage-caption="true"
                className="mt-1 h-4 text-center font-mono text-[11px] lowercase tracking-[0.04em]"
                style={{ color: cinema.palette.muted }}
              >
                {stageLabel}
              </p>
            </>
          )}
        </div>
      </main>

      {/* DESKTOP BOTTOM LETTERBOX BAR (~7vh) */}
      <footer
        style={{ backgroundColor: cinema.palette.ink }}
        className="relative z-20 hidden h-[7vh] min-h-[54px] max-h-[72px] w-full shrink-0 items-center justify-between px-[7vw] md:flex"
      >
        {/* Left: controls strip in accent/muted without boxes */}
        <div className="welcome-chrome-in flex items-center gap-4 font-mono text-[11px]">
          {cinema.shortcuts.map((item) => (
            <span key={item.keys} className="whitespace-nowrap">
              <span style={{ color: cinema.palette.amber }}>{item.keys}</span>{' '}
              <span style={{ color: cinema.palette.muted }}>{item.action}</span>
            </span>
          ))}
        </div>

        {/* Center: Sound recommendation */}
        <div
          className="welcome-chrome-in font-mono text-[11px]"
          style={{ color: cinema.palette.muted }}
        >
          {cinema.soundHint}
        </div>

        {/* Right: Quality indicator locked to High + optional availability dot */}
        <div className="welcome-chrome-in flex flex-col items-end justify-center gap-1">
          <div
            role="group"
            aria-label={WELCOME_CONFIG.qualityLabel}
            className="flex items-center gap-1.5 font-mono text-[11px]"
          >
            <button
              type="button"
              aria-pressed={true}
              data-welcome-quality="high"
              onClick={() => onSelectQuality?.('high')}
              className="cursor-default font-mono text-[11px] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#FFB36B] rounded-sm"
              style={{
                color: cinema.palette.warmWhite,
                textDecorationColor: cinema.palette.amber,
              }}
            >
              High
            </button>
          </div>

          {WELCOME_CONFIG.availability.trim().length > 0 && (
            <div className="flex items-center gap-1.5 font-mono text-[11px]">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: cinema.palette.amber }}
              />
              <span style={{ color: cinema.palette.muted }}>
                {WELCOME_CONFIG.availability}
              </span>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
