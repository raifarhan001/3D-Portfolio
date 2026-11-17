'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GAMING_ROOM_CONFIG, THEMES_CONFIG, type RoomTheme } from '@/config/themeConfig';
import { useThemeStore } from '@/stores/themeStore';

export interface ThemedValueSpec {
  color?: string;
  groundColor?: string;
  emissive?: string;
  intensity?: number;
  emissiveIntensity?: number;
  opacity?: number;
}

export interface ThemedRegistrationSpec {
  day: ThemedValueSpec;
  night: ThemedValueSpec;
  onUpdate?: (t: number) => void;
}

type ThemeTarget = THREE.Object3D | THREE.Material | { current: THREE.Object3D | THREE.Material | null };

interface InternalEntry {
  id: number;
  target: ThemeTarget | null;
  day: ThemedValueSpec;
  night: ThemedValueSpec;
  onUpdate?: (t: number) => void;
  // Preallocated colors (zero allocations per frame)
  dayColor?: THREE.Color;
  nightColor?: THREE.Color;
  dayGround?: THREE.Color;
  nightGround?: THREE.Color;
  dayEmissive?: THREE.Color;
  nightEmissive?: THREE.Color;
}

const _tmpColor = new THREE.Color();

let nextId = 1;
const entries = new Map<number, InternalEntry>();
let currentT = GAMING_ROOM_CONFIG.defaultTheme === 'night' ? 1 : 0;
let lastTargetTheme: RoomTheme = GAMING_ROOM_CONFIG.defaultTheme;
let animating = false;
let needsApplyAll = false;

function resolveTargetObject(target: ThemeTarget | null): THREE.Object3D | THREE.Material | null {
  if (!target) return null;
  if ('current' in target) return target.current;
  return target;
}

function applyEntry(entry: InternalEntry, t: number): void {
  const obj = resolveTargetObject(entry.target);
  const { day, night } = entry;

  if (obj) {
    const anyObj = obj as unknown as {
      isLight?: boolean;
      isHemisphereLight?: boolean;
      isMaterial?: boolean;
      color?: THREE.Color;
      groundColor?: THREE.Color;
      emissive?: THREE.Color;
      intensity?: number;
      emissiveIntensity?: number;
      opacity?: number;
      toneMapped?: boolean;
    };

    const intensityMult =
      typeof day.intensity === 'number' || typeof night.intensity === 'number'
        ? THREE.MathUtils.lerp(day.intensity ?? 1, night.intensity ?? 1, t)
        : null;

    if (anyObj.isLight) {
      if (anyObj.color && entry.dayColor && entry.nightColor) {
        anyObj.color.copy(entry.dayColor).lerp(entry.nightColor, t);
      }
      if (anyObj.isHemisphereLight && anyObj.groundColor && entry.dayGround && entry.nightGround) {
        anyObj.groundColor.copy(entry.dayGround).lerp(entry.nightGround, t);
      }
      if (intensityMult !== null && typeof anyObj.intensity === 'number') {
        anyObj.intensity = intensityMult;
      }
    } else if (anyObj.isMaterial) {
      if (anyObj.color && entry.dayColor && entry.nightColor) {
        _tmpColor.copy(entry.dayColor).lerp(entry.nightColor, t);
        // For unlit/HDR MeshBasicMaterial (toneMapped: false), scale color linearly by intensity
        if (anyObj.toneMapped === false && intensityMult !== null) {
          _tmpColor.multiplyScalar(intensityMult);
        }
        anyObj.color.copy(_tmpColor);
      }
      if (anyObj.emissive && entry.dayEmissive && entry.nightEmissive) {
        anyObj.emissive.copy(entry.dayEmissive).lerp(entry.nightEmissive, t);
      }
      if (
        typeof anyObj.emissiveIntensity === 'number' &&
        (typeof day.emissiveIntensity === 'number' || typeof night.emissiveIntensity === 'number')
      ) {
        anyObj.emissiveIntensity = THREE.MathUtils.lerp(
          day.emissiveIntensity ?? 1,
          night.emissiveIntensity ?? 1,
          t
        );
      }
      if (
        typeof anyObj.opacity === 'number' &&
        (typeof day.opacity === 'number' || typeof night.opacity === 'number')
      ) {
        anyObj.opacity = THREE.MathUtils.lerp(day.opacity ?? 1, night.opacity ?? 1, t);
      }
    }
  }

  if (entry.onUpdate) {
    entry.onUpdate(t);
  }
}

export function registerThemedEntry(
  target: ThemeTarget | null,
  spec: ThemedRegistrationSpec
): number {
  const id = nextId++;
  const entry: InternalEntry = {
    id,
    target,
    day: spec.day,
    night: spec.night,
    onUpdate: spec.onUpdate,
    dayColor: spec.day.color ? new THREE.Color(spec.day.color) : undefined,
    nightColor: spec.night.color ? new THREE.Color(spec.night.color) : undefined,
    dayGround: spec.day.groundColor ? new THREE.Color(spec.day.groundColor) : undefined,
    nightGround: spec.night.groundColor ? new THREE.Color(spec.night.groundColor) : undefined,
    dayEmissive: spec.day.emissive ? new THREE.Color(spec.day.emissive) : undefined,
    nightEmissive: spec.night.emissive ? new THREE.Color(spec.night.emissive) : undefined,
  };
  entries.set(id, entry);
  applyEntry(entry, currentT);
  needsApplyAll = true;
  return id;
}

export function unregisterThemedEntry(id: number): void {
  entries.delete(id);
}

export function snapThemeToStoreImmediate(): void {
  const targetTheme = useThemeStore.getState().theme;
  lastTargetTheme = targetTheme;
  currentT = targetTheme === 'night' ? 1 : 0;
  animating = false;
  needsApplyAll = false;
  entries.forEach((entry) => applyEntry(entry, currentT));
}

export function getThemeT(): number {
  return currentT;
}

export function isThemeAnimating(): boolean {
  return animating;
}

/**
 * Computes smoothly interpolated scalar values for dynamic useFrame subsystems
 * (MediaWall RGB, GamingCorner Hexagons/RGB) with zero allocations.
 */
export function getThemedTvRgbBrightness(): number {
  return THREE.MathUtils.lerp(
    THEMES_CONFIG.day.tvRgbBrightness,
    THEMES_CONFIG.night.tvRgbBrightness,
    currentT
  );
}

export function getThemedDeskRgbBrightness(): number {
  return THREE.MathUtils.lerp(
    THEMES_CONFIG.day.deskRgbBrightness,
    THEMES_CONFIG.night.deskRgbBrightness,
    currentT
  );
}

export function getThemedHexBrightness(): number {
  return THREE.MathUtils.lerp(
    THEMES_CONFIG.day.hexagonBrightness,
    THEMES_CONFIG.night.hexagonBrightness,
    currentT
  );
}

/**
 * Driven by ONE single useFrame in Scene ThemeController.
 * Smoothly lerps currentT toward store target (~0.8s critical damping) then stops completely until next toggle.
 */
export function stepThemeRegistry(delta: number, invalidate?: () => void): void {
  const targetTheme = useThemeStore.getState().theme;
  const targetT = targetTheme === 'night' ? 1 : 0;

  if (targetTheme !== lastTargetTheme) {
    lastTargetTheme = targetTheme;
    animating = true;
  }

  if (!animating && !needsApplyAll) {
    return;
  }

  needsApplyAll = false;

  if (animating) {
    const dt = Math.min(Math.max(delta, 0.001), 0.08);
    // ~0.8s critical damping settle, then stop running completely
    const alpha = 1 - Math.exp(-7.0 * dt);
    currentT += (targetT - currentT) * alpha;

    if (Math.abs(targetT - currentT) <= 0.0015) {
      currentT = targetT;
      animating = false;
      invalidate?.();
    }
  }

  entries.forEach((entry) => {
    applyEntry(entry, currentT);
  });
}

/**
 * Declarative hook to register an existing Material/Light ref (or custom updater) into the ThemeRegistry.
 */
export function useThemed(
  target: ThemeTarget | null,
  spec: ThemedRegistrationSpec,
  deps: ReadonlyArray<unknown> = []
): void {
  const specRef = useRef(spec);

  useEffect(() => {
    specRef.current = spec;
    const id = registerThemedEntry(target, specRef.current);
    return () => {
      unregisterThemedEntry(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, ...deps]);
}
