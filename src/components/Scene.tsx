'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stats, useProgress } from '@react-three/drei';
import { Perf } from 'r3f-perf';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import type { BloomEffect as BloomEffectImpl } from 'postprocessing';
import * as THREE from 'three';
import type { PointerLockControls as PointerLockControlsImpl } from 'three-stdlib';
import Room from '@/components/Room';
import Player from '@/components/Player';
import TVInteraction from '@/components/TVInteraction';
import TVContent from '@/components/TVContent';
import TVRemote from '@/components/TVRemote';
import TVFullscreenOverlay from '@/components/TVFullscreenOverlay';
import GramophoneAudio from '@/components/GramophoneAudio';
import GramophoneUI from '@/components/GramophoneUI';
import PCUI from '@/components/PCUI';
import PortfolioFocusUI from '@/components/PortfolioFocusUI';
import RobotChatUI from '@/components/RobotChatUI';
import GymUI from '@/components/GymUI';
import AchievementToast from '@/components/AchievementToast';

const RaiXP = dynamic(() => import('@/components/os/RaiXP'), { ssr: false });
import { useTvStore } from '@/stores/tvStore';
import { usePcStore } from '@/stores/pcStore';
import { usePortfolioStore } from '@/stores/portfolioStore';
import { useInputStore } from '@/stores/inputStore';
import { useRoomLoadStore } from '@/stores/loadingStore';
import { useThemeStore } from '@/stores/themeStore';
import { useSfxStore } from '@/stores/sfxStore';
import { useArcadeStore } from '@/stores/arcadeStore';
import { useWeatherStore } from '@/stores/weatherStore';
import {
  LIGHTING_CONFIG,
  PLAYER_CONFIG,
  BLOOM_CONFIG,
  RENDERER_CONFIG,
  PERFORMANCE_CONFIG,
} from '@/config/roomConfig';
import { THEMES_CONFIG } from '@/config/themeConfig';
import {
  getThemeT,
  isThemeAnimating,
  snapThemeToStoreImmediate,
  stepThemeRegistry,
  useThemed,
} from '@/utils/themeRegistry';
import { unlockSfxAudio } from '@/utils/sound';

type ControlsHandle = PointerLockControlsImpl & { domElement?: HTMLElement };

function ThemeController({
  ambientLightRef,
  hemisphereLightRef,
  bloomRef,
}: {
  ambientLightRef: React.RefObject<THREE.AmbientLight | null>;
  hemisphereLightRef: React.RefObject<THREE.HemisphereLight | null>;
  bloomRef: React.RefObject<BloomEffectImpl | null>;
}) {
  const { gl, invalidate } = useThree();
  const glRef = useRef<THREE.WebGLRenderer | null>(null);

  useEffect(() => {
    glRef.current = gl;
  }, [gl]);

  useThemed(
    ambientLightRef,
    {
      day: { color: THEMES_CONFIG.day.ambientColor, intensity: THEMES_CONFIG.day.ambientIntensity },
      night: { color: THEMES_CONFIG.night.ambientColor, intensity: THEMES_CONFIG.night.ambientIntensity },
    },
    []
  );

  useThemed(
    hemisphereLightRef,
    {
      day: {
        color: THEMES_CONFIG.day.hemisphereSkyColor,
        groundColor: THEMES_CONFIG.day.hemisphereGroundColor,
        intensity: THEMES_CONFIG.day.hemisphereIntensity,
      },
      night: {
        color: THEMES_CONFIG.night.hemisphereSkyColor,
        groundColor: THEMES_CONFIG.night.hemisphereGroundColor,
        intensity: THEMES_CONFIG.night.hemisphereIntensity,
      },
    },
    []
  );

  useThemed(
    null,
    {
      day: {},
      night: {},
      onUpdate: (t) => {
        if (glRef.current) {
          glRef.current.toneMappingExposure = THREE.MathUtils.lerp(
            THEMES_CONFIG.day.exposure,
            THEMES_CONFIG.night.exposure,
            t
          );
        }
        const bloom = bloomRef.current;
        if (bloom) {
          const threshold = THREE.MathUtils.lerp(
            THEMES_CONFIG.day.bloomThreshold,
            THEMES_CONFIG.night.bloomThreshold,
            t
          );
          const intensity = THREE.MathUtils.lerp(
            THEMES_CONFIG.day.bloomIntensity,
            THEMES_CONFIG.night.bloomIntensity,
            t
          );
          if (bloom.luminanceMaterial) {
            bloom.luminanceMaterial.threshold = threshold;
          }
          bloom.intensity = intensity;
        }
      },
    },
    []
  );

  const weather = useWeatherStore((s) => s.weather);

  useEffect(() => {
    if (weather === 'sunset') {
      if (ambientLightRef.current) ambientLightRef.current.color.set('#ffa670');
      if (hemisphereLightRef.current) {
        hemisphereLightRef.current.color.set('#ff8c42');
        hemisphereLightRef.current.groundColor.set('#592d1d');
      }
    } else if (weather === 'rain') {
      if (ambientLightRef.current) ambientLightRef.current.color.set('#8aa0b5');
      if (hemisphereLightRef.current) {
        hemisphereLightRef.current.color.set('#748b9d');
        hemisphereLightRef.current.groundColor.set('#2f3842');
      }
    }
  }, [weather, ambientLightRef, hemisphereLightRef]);

  useEffect(() => {
    const win = window as unknown as {
      __getThemeDebugState?: () => Record<string, unknown>;
    };
    win.__getThemeDebugState = () => ({
      theme: useThemeStore.getState().theme,
      themeT: Number(getThemeT().toFixed(4)),
      animating: isThemeAnimating(),
      exposure: Number(gl.toneMappingExposure.toFixed(3)),
      sfxMuted: useSfxStore.getState().muted,
    });
    return () => {
      delete win.__getThemeDebugState;
    };
  }, [gl]);

  useFrame((_, delta) => {
    stepThemeRegistry(delta, invalidate);
  });

  return null;
}

function RoomPrewarm({
  controlsRef,
}: {
  controlsRef: React.RefObject<ControlsHandle | null>;
}) {
  const { gl, scene, camera } = useThree();
  const { active, progress } = useProgress();
  const warmedRef = useRef(false);
  const compilingRef = useRef(false);
  const unmountedRef = useRef(false);

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
    };
  }, []);

  useEffect(() => {
    useRoomLoadStore.getState().registerEnterLock(() => {
      const target = controlsRef.current?.domElement;
      if (target && typeof target.requestPointerLock === 'function') {
        try {
          const res = target.requestPointerLock() as unknown as Promise<void> | undefined;
          if (res && typeof res.catch === 'function') {
            res.catch(() => {
              useInputStore.getState().enterPaused();
            });
          }
        } catch {
          useInputStore.getState().enterPaused();
        }
        return;
      }
      try {
        controlsRef.current?.lock();
      } catch {
        useInputStore.getState().enterPaused();
      }
    });
    return () => useRoomLoadStore.getState().registerEnterLock(null);
  }, [controlsRef]);

  useEffect(() => {
    if (warmedRef.current || compilingRef.current) return;
    if (active) {
      useRoomLoadStore.getState().setProgress(35 + progress * 0.45, 'textures');
      return;
    }

    compilingRef.current = true;
    useRoomLoadStore.getState().setProgress(86, 'shaders');

    const raf1 = requestAnimationFrame(() => {
      if (unmountedRef.current || warmedRef.current) return;
      useRoomLoadStore.getState().setProgress(93, 'shaders');
      requestAnimationFrame(() => {
        if (unmountedRef.current || warmedRef.current) return;
        const initializedTextures = new Set<THREE.Texture>();
        const textureKeys = [
          'map',
          'emissiveMap',
          'roughnessMap',
          'metalnessMap',
          'alphaMap',
          'normalMap',
        ] as const;

        try {
          scene.traverse((obj) => {
            const mesh = obj as THREE.Mesh;
            if (!mesh.material) return;
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            for (const mat of mats) {
              for (const k of textureKeys) {
                const tex = (mat as unknown as Record<string, THREE.Texture | undefined>)[k];
                if (tex && tex.isTexture && !initializedTextures.has(tex)) {
                  initializedTextures.add(tex);
                  gl.initTexture(tex);
                }
              }
              const uniforms = (mat as THREE.ShaderMaterial).uniforms;
              if (uniforms) {
                for (const u of Object.values(uniforms)) {
                  const tex = u?.value as THREE.Texture | undefined;
                  if (tex && tex.isTexture && !initializedTextures.has(tex)) {
                    initializedTextures.add(tex);
                    gl.initTexture(tex);
                  }
                }
              }
            }
          });
        } catch {
          // Ignore texture pre-init errors
        }

        const finishReady = () => {
          if (unmountedRef.current || warmedRef.current) return;
          try {
            gl.render(scene, camera);
          } catch {
            // Safe fallback if context lost
          }
          warmedRef.current = true;
          compilingRef.current = false;
          useRoomLoadStore.getState().markReady();
        };

        const glWithAsync = gl as THREE.WebGLRenderer & {
          compileAsync?: (sc: THREE.Object3D, cam: THREE.Camera) => Promise<void>;
        };
        if (typeof glWithAsync.compileAsync === 'function') {
          let timedOut = false;
          const timeoutId = setTimeout(() => {
            timedOut = true;
            try {
              gl.compile(scene, camera);
            } catch {
              // ignore compile error
            }
            finishReady();
          }, 1500);

          glWithAsync
            .compileAsync(scene, camera)
            .catch(() => {
              if (!timedOut) {
                try {
                  gl.compile(scene, camera);
                } catch {
                  // ignore compile error
                }
              }
            })
            .finally(() => {
              clearTimeout(timeoutId);
              if (!timedOut) finishReady();
            });
        } else {
          try {
            gl.compile(scene, camera);
          } catch {
            // Safe fallback if context lost
          }
          finishReady();
        }
      });
    });

    return () => {
      cancelAnimationFrame(raf1);
      if (!warmedRef.current) {
        compilingRef.current = false;
      }
    };
  }, [active, progress, gl, scene, camera]);

  return null;
}

/**
 * Scene Component - Luminous Stretch Ceiling
 * Features:
 * - High performance Canvas with dpr [1, 1.25], antialias off (postprocessing active),
 *   powerPreference "high-performance", shadows disabled, demand frameloop when unlocked.
 * - ACESFilmic tonemapping with 1.0 exposure.
 * - Base lighting: HemisphereLight (sky #ffffff, ground #c9a27a, intensity 0.9) + AmbientLight 0.35.
 * - Main diffuse ceiling light: ONE RectAreaLight (9x9, warm white #fff6ea, intensity 3) in Room.tsx.
 * - Very subtle Bloom: luminanceThreshold 1.35 high enough so the large stretch panel does not blow out.
 * - Tiny FPS counter (Stats) toggled by config flag.
 */
export default function Scene() {
  const [isLocked, setIsLocked] = useState(false);
  const controlsRef = useRef<ControlsHandle | null>(null);
  const promptRef = useRef<HTMLDivElement>(null);
  const movementEnabledRef = useRef(true);
  const tvMode = useTvStore((s) => s.tvMode);
  const isSeated = useTvStore((s) => s.isSeated);
  const gramophoneMode = useTvStore((s) => s.gramophoneMode);
  const pcMode = usePcStore((s) => s.pcMode);
  const pcArrived = usePcStore((s) => s.pcArrived);
  const pcExiting = usePcStore((s) => s.pcExiting);
  const poweredPC = usePcStore((s) => s.poweredPC);
  const bootState = usePcStore((s) => s.bootState);
  const hasPoweredOnce = usePcStore((s) => s.hasPoweredOnce);
  const chairSeated = usePcStore((s) => s.chairSeated);
  const portfolioFocusActive = usePortfolioStore((s) => Boolean(s.focusMode));
  const pcOverlayOpen = pcMode && pcArrived && !pcExiting && poweredPC && bootState === 'desktop';
  const inputMode = useInputStore((s) => s.mode);
  const focusKind = useInputStore((s) => s.focusKind);
  const focusExiting = useInputStore((s) => s.focusExiting);
  const theme = useThemeStore((s) => s.theme);
  const toastText = useThemeStore((s) => s.toastText);
  const sfxMuted = useSfxStore((s) => s.muted);
  const toggleMute = useSfxStore((s) => s.toggleMute);
  const arcadeScore = useArcadeStore((s) => s.score);
  const arcadeHighScore = useArcadeStore((s) => s.highScore);
  const awaySinceRef = useRef<number | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const hemisphereLightRef = useRef<THREE.HemisphereLight | null>(null);
  const bloomRef = useRef<BloomEffectImpl | null>(null);

  const weather = useWeatherStore((s) => s.weather);
  const cycleWeather = useWeatherStore((s) => s.cycleWeather);

  // Hydrate persisted theme & SFX mute on mount, and snap initial theme cleanly before first frame
  useEffect(() => {
    useThemeStore.getState().hydrate();
    snapThemeToStoreImmediate();
    useSfxStore.getState().hydrate();

    const unlockOnce = () => unlockSfxAudio();
    window.addEventListener('pointerdown', unlockOnce, { once: true, passive: true });
    return () => window.removeEventListener('pointerdown', unlockOnce);
  }, []);

  // Avoid unused lint warnings while keeping store subscriptions explicit
  void tvMode;
  void isSeated;
  void gramophoneMode;
  void chairSeated;
  void portfolioFocusActive;
  void theme;

  // Sync central input state machine with native browser pointer lock events
  useEffect(() => {
    const handlePointerLockChange = () => {
      const locked = document.pointerLockElement !== null;
      setIsLocked(locked);
      if (locked) {
        awaySinceRef.current = null;
        useInputStore.getState().onPointerLocked();
      } else {
        useInputStore.getState().onPointerUnlocked();
      }
    };

    document.addEventListener('pointerlockchange', handlePointerLockChange);
    return () => {
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
    };
  }, []);

  // Return to initial menu only after prolonged focus loss while paused
  useEffect(() => {
    const LONG_BLUR_MS = 60_000;
    const markAway = () => {
      if (useInputStore.getState().mode === 'paused' && awaySinceRef.current === null) {
        awaySinceRef.current = Date.now();
      }
    };
    const checkReturn = () => {
      if (document.hidden || !document.hasFocus()) return;
      const since = awaySinceRef.current;
      awaySinceRef.current = null;
      if (
        since !== null &&
        Date.now() - since >= LONG_BLUR_MS &&
        useInputStore.getState().mode === 'paused'
      ) {
        useInputStore.getState().enterMenu();
      }
    };
    const onVisibilityChange = () => {
      if (document.hidden) markAway();
      else checkReturn();
    };
    window.addEventListener('blur', markAway);
    window.addEventListener('focus', checkReturn);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('blur', markAway);
      window.removeEventListener('focus', checkReturn);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  return (
    <div
      data-input-mode={inputMode}
      data-focus-kind={focusKind ?? ''}
      className="fixed inset-0 w-full h-full overflow-hidden bg-[#08090D] select-none"
    >
      {/* TV interaction prompt: "Press E to use TV" */}
      <div
        ref={promptRef}
        style={{
          display: 'none',
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 40,
          background: 'rgba(12, 12, 14, 0.85)',
          backdropFilter: 'blur(6px)',
          borderRadius: '10px',
          border: '1px solid rgba(255,255,255,0.08)',
          padding: '8px 18px',
          color: '#bbb',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontSize: '13px',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        Press <strong style={{ color: '#e0e0e0' }}>E</strong> to use TV
      </div>

      {/* TV Remote UI (React DOM overlay, only renders in TV/seated mode) */}
      <TVRemote />
      <TVFullscreenOverlay />

      {/* Gramophone Audio Engine & Cassette Selector UI */}
      <GramophoneAudio />
      <GramophoneUI />

      {/* PC & Gaming Chair Interaction Overlay */}
      <PCUI />
      <PortfolioFocusUI />
      <RobotChatUI />
      <GymUI />
      {hasPoweredOnce && pcMode && pcArrived && <RaiXP />}

      {/* Non-blocking "Click to resume" pill when paused (browser Esc / Q / Esc exit) */}
      {inputMode === 'paused' && (
        <div
          data-resume-pill="true"
          style={{
            position: 'fixed',
            bottom: '22px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 55,
            pointerEvents: 'none',
            userSelect: 'none',
            padding: '8px 18px',
            borderRadius: '999px',
            background: 'rgba(12, 14, 18, 0.84)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.14)',
            color: '#f3f4f6',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '13px',
            fontWeight: 500,
            letterSpacing: '0.01em',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
          }}
        >
          Click to resume · Esc to exit room
        </div>
      )}

      {/* One-line bottom-left exit hint in every focus mode */}
      {inputMode === 'focus' && !focusExiting && (
        <div
          data-focus-hint="true"
          style={{
            position: 'fixed',
            left: '16px',
            bottom: '16px',
            zIndex: 75,
            pointerEvents: 'none',
            userSelect: 'none',
            padding: '6px 12px',
            borderRadius: '999px',
            background: 'rgba(12, 14, 18, 0.82)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.14)',
            color: '#d1d5db',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '12px',
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
          }}
        >
          Press Q to return to room · Esc to exit room
        </div>
      )}

      {/* Arcade Snake Focus Overlay Controls + Bottom-Center Hint */}
      {inputMode === 'focus' && focusKind === 'arcade' && !focusExiting && (
        <>
          <div
            data-arcade-focus-ui="true"
            style={{
              position: 'fixed',
              top: '16px',
              left: '16px',
              zIndex: 75,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <button
              type="button"
              data-arcade-exit="true"
              onClick={(e) => {
                e.stopPropagation();
                (window as unknown as { __exitCurrentFocus?: (lock?: boolean) => void }).__exitCurrentFocus?.(
                  true
                );
              }}
              className="flex items-center gap-2 rounded-lg border border-white/15 bg-[#0e1017]/90 px-3.5 py-2 text-xs font-medium text-neutral-100 hover:bg-[#191d28] cursor-pointer"
            >
              <span>✕ Exit Arcade</span>
              <span className="text-white/45 text-[11px]">Q</span>
            </button>
            <div className="rounded-lg border border-white/10 bg-[#0e1017]/85 px-3 py-1.5 font-mono text-xs text-neutral-300">
              Score: <strong className="text-emerald-400">{arcadeScore}</strong> · Best:{' '}
              <strong className="text-cyan-300">{arcadeHighScore}</strong>
            </div>
          </div>
          <div
            data-arcade-hint="true"
            style={{
              position: 'fixed',
              bottom: '22px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 75,
              pointerEvents: 'none',
              userSelect: 'none',
              padding: '7px 16px',
              borderRadius: '999px',
              background: 'rgba(10, 12, 18, 0.88)',
              border: '1px solid rgba(255, 255, 255, 0.14)',
              color: '#e5e7eb',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              fontSize: '12px',
              whiteSpace: 'nowrap',
            }}
          >
            Arrows or WASD to move, Space to start or restart, Q to return to room, Esc to exit room, M mute
          </div>
        </>
      )}

      {/* Bean Bag Seat Exit Button (shares global focus hint & head-look) */}
      {inputMode === 'focus' && focusKind === 'beanbag' && !focusExiting && (
        <div
          data-beanbag-focus-ui="true"
          style={{
            position: 'fixed',
            top: '16px',
            left: '16px',
            zIndex: 75,
          }}
        >
          <button
            type="button"
            data-beanbag-exit="true"
            onClick={(e) => {
              e.stopPropagation();
              (window as unknown as { __exitCurrentFocus?: (lock?: boolean) => void }).__exitCurrentFocus?.(
                true
              );
            }}
            className="flex items-center gap-2 rounded-lg border border-white/15 bg-[#0e1017]/90 px-3.5 py-2 text-xs font-medium text-neutral-100 hover:bg-[#191d28] cursor-pointer"
          >
            <span>✕ Stand Up</span>
            <span className="text-white/45 text-[11px]">Q</span>
          </button>
        </div>
      )}

      {/* Theme Toggle Toast ("Night mode" / "Day mode" for 1.5s) */}
      {toastText && (
        <div
          data-theme-toast="true"
          style={{
            position: 'fixed',
            bottom: inputMode === 'paused' ? '64px' : '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 76,
            pointerEvents: 'none',
            userSelect: 'none',
            padding: '7px 16px',
            borderRadius: '999px',
            background: 'rgba(12, 14, 20, 0.9)',
            border: '1px solid rgba(255, 255, 255, 0.16)',
            color: '#f4f5f7',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          {toastText}
        </div>
      )}

      {/* Subtle Controls Hint Row (M mute sfx, Quality, Weather, Esc exit) */}
      {(inputMode === 'walking' || inputMode === 'paused') && !pcOverlayOpen && (
        <div
          style={{
            position: 'fixed',
            left: '16px',
            bottom: '16px',
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <button
            type="button"
            data-weather-toggle="true"
            onClick={(e) => {
              e.stopPropagation();
              unlockSfxAudio();
              cycleWeather();
            }}
            style={{
              padding: '6px 12px',
              borderRadius: '999px',
              background: 'rgba(14, 15, 19, 0.84)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.14)',
              color: '#d1d5db',
              fontSize: '11px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {weather === 'rain' ? '🌧️ Rain' : weather === 'sunset' ? '🌅 Sunset' : '☀️ Clear'}
          </button>
          <button
            type="button"
            data-sfx-toggle="true"
            onClick={(e) => {
              e.stopPropagation();
              unlockSfxAudio();
              toggleMute();
            }}
            style={{
              padding: '6px 12px',
              borderRadius: '999px',
              background: 'rgba(14, 15, 19, 0.84)',
              backdropFilter: 'blur(8px)',
              border: sfxMuted
                ? '1px solid rgba(248, 113, 113, 0.35)'
                : '1px solid rgba(255, 255, 255, 0.14)',
              color: sfxMuted ? '#fca5a5' : '#d1d5db',
              fontSize: '11px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {sfxMuted ? 'M unmute sfx' : 'M mute sfx'}
          </button>
          <button
            type="button"
            data-exit-room="true"
            onClick={(e) => {
              e.stopPropagation();
              document.exitPointerLock?.();
              useInputStore.getState().enterMenu();
            }}
            style={{
              padding: '6px 12px',
              borderRadius: '999px',
              background: 'rgba(14, 15, 19, 0.84)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.14)',
              color: '#9ca3af',
              fontSize: '11px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Esc Exit Room
          </button>
        </div>
      )}

      {/* Steam-style Achievement Toast */}
      <AchievementToast />

      {/* Fullscreen High-Performance 3D Canvas */}
      <div
        data-canvas-wrapper="true"
        className="absolute inset-0 w-full h-full"
        onClick={() => {
          if (useInputStore.getState().mode === 'paused') {
            controlsRef.current?.lock();
          }
        }}
      >
        <Canvas
        camera={{
          position: PLAYER_CONFIG.spawnPosition,
          fov: PLAYER_CONFIG.fov,
        }}
        dpr={pcOverlayOpen ? 1 : PERFORMANCE_CONFIG.dpr}
        shadows={false}
        frameloop="always"
        gl={{
          antialias: false, // Antialias off since postprocessing EffectComposer is active
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: RENDERER_CONFIG.toneMappingExposure, // 1.0
        }}
        className="w-full h-full block"
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        {/* Tiny FPS Counter toggled by config flag */}
        {PERFORMANCE_CONFIG.showStats && inputMode !== 'menu' && (
          <Stats className="!left-auto !right-4 !top-4" />
        )}
        {/* Dev-only R3F performance profiler (draw calls, triangles, FPS) */}
        {process.env.NODE_ENV === 'development' && PERFORMANCE_CONFIG.showPerf && (
          <Perf position="top-left" />
        )}

        {/* 1. AmbientLight 0.35 */}
        <ambientLight
          ref={ambientLightRef}
          intensity={LIGHTING_CONFIG.ambientIntensity}
          color={LIGHTING_CONFIG.ambientColor}
        />

        {/* 2. HemisphereLight 0.9 (sky #ffffff, ground #c9a27a) */}
        <hemisphereLight
          ref={hemisphereLightRef}
          color={LIGHTING_CONFIG.hemisphereSkyColor}
          groundColor={LIGHTING_CONFIG.hemisphereGroundColor}
          intensity={LIGHTING_CONFIG.hemisphereIntensity}
        />

        <ThemeController
          ambientLightRef={ambientLightRef}
          hemisphereLightRef={hemisphereLightRef}
          bloomRef={bloomRef}
        />

        {/* 3D Room architecture with luminous stretch ceiling, RectAreaLight, linear slot & back wall panels */}
        <Suspense fallback={null}>
          <Room />
          <RoomPrewarm controlsRef={controlsRef} />
        </Suspense>

        {/* TV iframe content placed on screen plane */}
        <TVContent />

        {/* TV raycasting interaction & camera animation */}
        <TVInteraction
          isLocked={isLocked}
          promptRef={promptRef}
          controlsRef={controlsRef}
          movementEnabledRef={movementEnabledRef}
        />

        {/* First-person player movement & pointer lock controls (untouched) */}
        <Player
          isLocked={isLocked}
          onLock={() => setIsLocked(true)}
          onUnlock={() => setIsLocked(false)}
          controlsRef={controlsRef}
          movementEnabledRef={movementEnabledRef}
        />

        {/* Very subtle bloom: disabled while Rai XP DOM overlay is active to keep FPS high */}
        {!pcOverlayOpen && (
          <EffectComposer>
            <Bloom
              ref={bloomRef}
              mipmapBlur={BLOOM_CONFIG.mipmapBlur}
              luminanceThreshold={BLOOM_CONFIG.luminanceThreshold}
              luminanceSmoothing={BLOOM_CONFIG.luminanceSmoothing}
              intensity={BLOOM_CONFIG.intensity}
              resolutionScale={BLOOM_CONFIG.resolutionScale}
            />
          </EffectComposer>
        )}
        </Canvas>
      </div>
    </div>
  );
}
