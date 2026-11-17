'use client';

import { useRef, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useTvStore } from '@/stores/tvStore';
import { usePcStore } from '@/stores/pcStore';
import { usePortfolioStore, type PortfolioFocusKind } from '@/stores/portfolioStore';
import { useInputStore, setExpectedUnlock, type ActiveFocusKind } from '@/stores/inputStore';
import { useOsStore } from '@/stores/osStore';
import { useThemeStore } from '@/stores/themeStore';
import { useSfxStore } from '@/stores/sfxStore';
import { useArcadeStore } from '@/stores/arcadeStore';
import { useGymStore, type GymStation } from '@/stores/gymStore';
import { monaLivePose, useRobotStore } from '@/stores/robotStore';
import { ROBOT_CONFIG } from '@/config/robotConfig';
import { isWalkableWorld } from '@/utils/robotNav';
import { warmUpMonaSpeech } from '@/utils/monaVoice';
import type { QuadPoints } from '@/utils/homography';
import {
  TV_CONFIG,
  MEDIA_WALL_CONFIG,
  SOFA_CONFIG,
  GRAMOPHONE_CONFIG,
  GAMING_CORNER_CONFIG,
  gamingCornerLocalToWorld,
} from '@/config/roomConfig';
import { ROOM_CONTENT_CONFIG } from '@/config/roomContent';
import {
  ARCADE_CONFIG,
  GAMING_ROOM_CONFIG,
  LIGHT_SWITCH_CONFIG,
  STEP5_HOTKEYS,
} from '@/config/themeConfig';
import { getCertificateWorldPose, getAchievementsWorldPose } from '@/components/CertificatesShelf';
import { getPhoneWorldPose } from '@/components/DeskPhone';
import { getControllerWorldPose } from '@/components/GamingCorner';
import { getArcadeWorldPose } from '@/components/ArcadeCabinet';
import { playGymBeepSound, playSwitchClickSound, unlockSfxAudio } from '@/utils/sound';

// Module-level pre-allocated objects (zero GC allocations per frame)
const _raycaster = new THREE.Raycaster();
const _screenCenter = new THREE.Vector2(0, 0);
const _intersects: THREE.Intersection[] = [];
const _seatEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const _focusTmpCam = new THREE.PerspectiveCamera();
const _summonCamDir = new THREE.Vector3();

// TV screen center in world space (MediaWall at [-5, 0, 0] rotated +90deg around Y)
const TV_SCREEN_WORLD_X = MEDIA_WALL_CONFIG.groupPosition[0] + MEDIA_WALL_CONFIG.screenLocalZ;
const TV_SCREEN_WORLD_Y = MEDIA_WALL_CONFIG.tvCenterY;
const TV_SCREEN_WORLD_Z = 0;

// Camera target position when in close-up TV mode
const TV_CAM_WORLD_X = TV_SCREEN_WORLD_X + TV_CONFIG.tvCamDistance;
const TV_CAM_WORLD_Y = TV_SCREEN_WORLD_Y;
const TV_CAM_WORLD_Z = TV_SCREEN_WORLD_Z;

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

type FocusTarget = 'tv' | 'gramophone' | 'pc' | 'portfolio' | 'arcade' | 'robot' | 'gym';
type SeatTarget = 'sofa' | 'gaming-chair' | 'beanbag';
type HoverTarget =
  | FocusTarget
  | SeatTarget
  | 'pc-tower'
  | 'certificate'
  | 'achievement'
  | 'phone'
  | 'resume'
  | 'switch'
  | null;

const PC_MONITOR_WORLD = gamingCornerLocalToWorld(...GAMING_CORNER_CONFIG.mainMonitorPos);
const CHAIR_SEAT_WORLD = gamingCornerLocalToWorld(...GAMING_CORNER_CONFIG.chairSeatCameraPos);

const GYM_STATION_POSES: Record<
  GymStation,
  { pos: [number, number, number]; lookAt: [number, number, number] }
> = {
  treadmill: { pos: [2.25, 1.54, 2.25], lookAt: [4.02, 0.92, 2.42] },
  bench: { pos: [2.35, 1.52, 3.72], lookAt: [4.16, 0.78, 4.18] },
  dumbbells: { pos: [1.62, 1.38, 3.05], lookAt: [2.5, 0.45, 4.15] },
};
const GYM_INTERACT_DISTANCE = 4.25;

interface TVInteractionProps {
  isLocked: boolean;
  promptRef: React.RefObject<HTMLDivElement | null>;
  controlsRef: React.RefObject<{ lock: () => void; unlock: () => void; domElement?: HTMLElement } | null>;
  movementEnabledRef: React.MutableRefObject<boolean>;
}

/**
 * TVInteraction — handles zero-allocation raycasting for TV, Sofa, and Gramophone interaction,
 * E-key mode entry, seated mouse-drag head look, and smooth 0.8s ease-in-out camera transitions.
 */
export default function TVInteraction({
  isLocked,
  promptRef,
  controlsRef,
  movementEnabledRef,
}: TVInteractionProps) {
  const { scene, camera, gl } = useThree();

  const animating = useRef(false);
  const exitShouldWalkRef = useRef(false);
  const animKind = useRef<'enter-focus' | 'exit-focus' | 'enter-seat' | 'exit-seat' | 'slide-focus'>('enter-focus');
  const activeFocusTarget = useRef<FocusTarget | null>(null);
  const activeSeatTarget = useRef<SeatTarget | null>(null);
  const hoverCertIndexRef = useRef(0);
  const hoverGymStationRef = useRef<GymStation>('treadmill');
  const lastGymStationRef = useRef<GymStation | null>(null);
  const animProgress = useRef(0);
  const animDuration = useRef<number>(TV_CONFIG.tvCamMoveTime);
  const animStartPos = useRef(new THREE.Vector3());
  const animStartQuat = useRef(new THREE.Quaternion());
  const animTargetPos = useRef(new THREE.Vector3());
  const animTargetQuat = useRef(new THREE.Quaternion());
  const savedPos = useRef(new THREE.Vector3());
  const savedQuat = useRef(new THREE.Quaternion());

  const focusConfigs = useRef<Record<FocusTarget, { pos: THREE.Vector3; quat: THREE.Quaternion; duration: number }>>({
    tv: { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), duration: TV_CONFIG.tvCamMoveTime },
    gramophone: { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), duration: GRAMOPHONE_CONFIG.camMoveTime },
    pc: { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), duration: GAMING_CORNER_CONFIG.pcCamMoveTime },
    portfolio: { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), duration: 0.7 },
    arcade: { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), duration: ARCADE_CONFIG.camMoveTime },
    robot: { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), duration: ROBOT_CONFIG.camMoveTime },
    gym: { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), duration: 0.65 },
  });
  const seatConfigs = useRef<
    Record<SeatTarget, { pos: THREE.Vector3; quat: THREE.Quaternion; basePitch: number; baseYaw: number }>
  >({
    sofa: { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), basePitch: 0, baseYaw: 0 },
    'gaming-chair': { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), basePitch: 0, baseYaw: 0 },
    beanbag: { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), basePitch: 0, baseYaw: 0 },
  });
  const seatBasePitch = useRef(0);
  const seatBaseYaw = useRef(0);
  const seatPitchOffset = useRef(0);
  const seatYawOffset = useRef(0);
  const isDraggingLook = useRef(false);
  const lastDragPos = useRef({ x: 0, y: 0 });

  const interactiveTargetsRef = useRef<THREE.Object3D[]>([]);
  const lastInteractiveScanRef = useRef(-10);
  const hoverTarget = useRef<HoverTarget>(null);

  // Hydrate persisted TV state (source) safely on client mount
  useEffect(() => {
    useTvStore.getState().hydrate();
  }, []);

  // Precompute focus & seat target poses once
  useEffect(() => {
    const tmpCam = new THREE.PerspectiveCamera();

    tmpCam.position.set(TV_CAM_WORLD_X, TV_CAM_WORLD_Y, TV_CAM_WORLD_Z);
    tmpCam.lookAt(TV_SCREEN_WORLD_X, TV_SCREEN_WORLD_Y, TV_SCREEN_WORLD_Z);
    focusConfigs.current.tv.pos.copy(tmpCam.position);
    focusConfigs.current.tv.quat.copy(tmpCam.quaternion);

    tmpCam.position.set(...GRAMOPHONE_CONFIG.camPosition);
    tmpCam.lookAt(...GRAMOPHONE_CONFIG.camLookAt);
    focusConfigs.current.gramophone.pos.copy(tmpCam.position);
    focusConfigs.current.gramophone.quat.copy(tmpCam.quaternion);

    const arcadePose = getArcadeWorldPose();
    tmpCam.position.copy(arcadePose.cameraPos);
    tmpCam.lookAt(arcadePose.target);
    focusConfigs.current.arcade.pos.copy(tmpCam.position);
    focusConfigs.current.arcade.quat.copy(tmpCam.quaternion);

    // PC target is dynamically updated from FOV/aspect in enterFocusMode('pc')
    focusConfigs.current.pc.pos.set(...PC_MONITOR_WORLD);
    focusConfigs.current.pc.quat.identity();

    tmpCam.position.set(...SOFA_CONFIG.seatPosition);
    tmpCam.lookAt(TV_SCREEN_WORLD_X, TV_SCREEN_WORLD_Y, TV_SCREEN_WORLD_Z);
    _seatEuler.setFromQuaternion(tmpCam.quaternion, 'YXZ');
    seatConfigs.current.sofa.pos.copy(tmpCam.position);
    seatConfigs.current.sofa.quat.copy(tmpCam.quaternion);
    seatConfigs.current.sofa.basePitch = _seatEuler.x;
    seatConfigs.current.sofa.baseYaw = _seatEuler.y;

    tmpCam.position.set(...CHAIR_SEAT_WORLD);
    tmpCam.lookAt(...PC_MONITOR_WORLD);
    _seatEuler.setFromQuaternion(tmpCam.quaternion, 'YXZ');
    seatConfigs.current['gaming-chair'].pos.copy(tmpCam.position);
    seatConfigs.current['gaming-chair'].quat.copy(tmpCam.quaternion);
    seatConfigs.current['gaming-chair'].basePitch = _seatEuler.x;
    seatConfigs.current['gaming-chair'].baseYaw = _seatEuler.y;

    tmpCam.position.set(...GAMING_ROOM_CONFIG.beanBag.camPosition);
    tmpCam.lookAt(...GAMING_ROOM_CONFIG.beanBag.camLookAt);
    _seatEuler.setFromQuaternion(tmpCam.quaternion, 'YXZ');
    seatConfigs.current.beanbag.pos.copy(tmpCam.position);
    seatConfigs.current.beanbag.quat.copy(tmpCam.quaternion);
    seatConfigs.current.beanbag.basePitch = _seatEuler.x;
    seatConfigs.current.beanbag.baseYaw = _seatEuler.y;
  }, []);

  const lastSwitchThemeRef = useRef<string | null>(null);

  const updatePrompt = useCallback(
    (target: HoverTarget) => {
      const theme = useThemeStore.getState().theme;
      const curGymStation = hoverGymStationRef.current;
      if (
        hoverTarget.current === target &&
        (target !== 'switch' || lastSwitchThemeRef.current === theme) &&
        (target !== 'gym' || lastGymStationRef.current === curGymStation)
      ) {
        return;
      }
      hoverTarget.current = target;
      lastSwitchThemeRef.current = target === 'switch' ? theme : null;
      lastGymStationRef.current = target === 'gym' ? curGymStation : null;
      const el = promptRef.current;
      if (!el) return;

      if (target === 'tv') {
        el.innerHTML = 'Press <strong style="color:#e0e0e0">E</strong> to use TV';
        el.style.display = 'block';
      } else if (target === 'sofa') {
        el.innerHTML = 'Press <strong style="color:#e0e0e0">E</strong> to sit on Sofa';
        el.style.display = 'block';
      } else if (target === 'gramophone') {
        el.innerHTML = 'Press <strong style="color:#e0e0e0">E</strong> to use Gramophone';
        el.style.display = 'block';
      } else if (target === 'pc') {
        el.innerHTML = 'Press <strong style="color:#e0e0e0">E</strong> to use PC';
        el.style.display = 'block';
      } else if (target === 'pc-tower') {
        el.innerHTML = 'Press <strong style="color:#e0e0e0">E</strong> to power PC';
        el.style.display = 'block';
      } else if (target === 'gaming-chair') {
        el.innerHTML = 'Press <strong style="color:#e0e0e0">E</strong> to sit on Gaming Chair';
        el.style.display = 'block';
      } else if (target === 'certificate') {
        el.innerHTML = 'Press <strong style="color:#e0e0e0">E</strong> to view';
        el.style.display = 'block';
      } else if (target === 'achievement') {
        el.innerHTML = 'Press <strong style="color:#e0e0e0">E</strong> to view achievements';
        el.style.display = 'block';
      } else if (target === 'phone') {
        el.innerHTML = 'Press <strong style="color:#e0e0e0">E</strong> to use phone';
        el.style.display = 'block';
      } else if (target === 'resume') {
        el.innerHTML = 'Press <strong style="color:#e0e0e0">E</strong> to open resume';
        el.style.display = 'block';
      } else if (target === 'switch') {
        const nextMode = theme === 'day' ? 'Night' : 'Day';
        el.innerHTML = `Press <strong style="color:#e0e0e0">E</strong>: switch to ${nextMode}`;
        el.style.display = 'block';
      } else if (target === 'arcade') {
        el.innerHTML = 'Press <strong style="color:#e0e0e0">E</strong> to play Snake';
        el.style.display = 'block';
      } else if (target === 'beanbag') {
        el.innerHTML = 'Press <strong style="color:#e0e0e0">E</strong> to sit on Bean Bag';
        el.style.display = 'block';
      } else if (target === 'robot') {
        el.innerHTML = 'Press <strong style="color:#e0e0e0">E</strong> to talk to ELSA';
        el.style.display = 'block';
      } else if (target === 'gym') {
        const stationLabel =
          curGymStation === 'bench'
            ? 'Bench Press'
            : curGymStation === 'dumbbells'
              ? 'Dumbbells'
              : 'Treadmill';
        el.innerHTML = `Press <strong style="color:#e0e0e0">E</strong> to use ${stationLabel}`;
        el.style.display = 'block';
      } else {
        el.style.display = 'none';
      }
    },
    [promptRef]
  );

  const isAnyInteractiveActive = useCallback(() => {
    const tv = useTvStore.getState();
    const pc = usePcStore.getState();
    const portfolio = usePortfolioStore.getState();
    const gym = useGymStore.getState();
    const input = useInputStore.getState();
    return (
      tv.tvMode ||
      tv.isSeated ||
      tv.gramophoneMode ||
      pc.pcMode ||
      pc.chairSeated ||
      gym.gymMode ||
      Boolean(portfolio.focusMode) ||
      (input.mode === 'focus' &&
        (input.focusKind === 'arcade' ||
          input.focusKind === 'beanbag' ||
          input.focusKind === 'robot' ||
          input.focusKind === 'gym'))
    );
  }, []);

  const computeRobotFocusPose = useCallback(
    (targetPos: THREE.Vector3, targetQuat: THREE.Quaternion) => {
      const mx = monaLivePose.x;
      const mz = monaLivePose.z;
      let baseDx = camera.position.x - mx;
      let baseDz = camera.position.z - mz;
      const len = Math.hypot(baseDx, baseDz);
      if (len < 0.05) {
        baseDx = Math.sin(monaLivePose.yaw);
        baseDz = Math.cos(monaLivePose.yaw);
      } else {
        baseDx /= len;
        baseDz /= len;
      }

      const baseAngle = Math.atan2(baseDx, baseDz);
      const offsets = [0, 0.45, -0.45, 0.9, -0.9, Math.PI * 0.5, -Math.PI * 0.5, Math.PI];
      let chosenX = THREE.MathUtils.clamp(mx + baseDx * ROBOT_CONFIG.camDistance, -4.45, 4.45);
      let chosenZ = THREE.MathUtils.clamp(mz + baseDz * ROBOT_CONFIG.camDistance, -4.45, 4.45);
      for (const off of offsets) {
        const a = baseAngle + off;
        const cx = mx + Math.sin(a) * ROBOT_CONFIG.camDistance;
        const cz = mz + Math.cos(a) * ROBOT_CONFIG.camDistance;
        if (isWalkableWorld(cx, cz)) {
          chosenX = cx;
          chosenZ = cz;
          break;
        }
      }

      const dirLen = Math.max(0.01, Math.hypot(chosenX - mx, chosenZ - mz));
      const dx = (chosenX - mx) / dirLen;
      const dz = (chosenZ - mz) / dirLen;
      // Offset look target slightly right so ELSA appears in open left frame beside right-side chat UI
      const rightX = dz;
      const rightZ = -dx;

      _focusTmpCam.position.set(chosenX, ROBOT_CONFIG.camEyeHeight, chosenZ);
      _focusTmpCam.lookAt(
        mx + rightX * 0.28,
        ROBOT_CONFIG.camTargetHeight,
        mz + rightZ * 0.28
      );
      targetPos.copy(_focusTmpCam.position);
      targetQuat.copy(_focusTmpCam.quaternion);
    },
    [camera]
  );

  const enterFocusMode = useCallback(
    (
      target: FocusTarget,
      portfolioSpec?: { kind: PortfolioFocusKind; certIndex: number },
      allowFromPaused = false
    ) => {
      const curMode = useInputStore.getState().mode;
      const validEntryMode = curMode === 'walking' || (allowFromPaused && curMode === 'paused');
      if (!validEntryMode || isAnyInteractiveActive() || animating.current) return;

      const tvStore = useTvStore.getState();
      const pcStore = usePcStore.getState();
      const portfolioStore = usePortfolioStore.getState();

      savedPos.current.copy(camera.position);
      savedQuat.current.copy(camera.quaternion);

      const focusKind: ActiveFocusKind =
        target === 'portfolio' ? (portfolioSpec?.kind ?? 'certificate') : target;
      useInputStore.getState().beginFocus(focusKind);

      movementEnabledRef.current = false;
      if (document.pointerLockElement) {
        setExpectedUnlock(true);
        document.exitPointerLock();
      }

      updatePrompt(null);

      const cfg = focusConfigs.current[target];
      if (target === 'pc') {
        const persp = camera as THREE.PerspectiveCamera;
        const vFovRad = THREE.MathUtils.degToRad(persp.fov || 70);
        const aspect =
          gl.domElement.clientHeight > 0
            ? gl.domElement.clientWidth / gl.domElement.clientHeight
            : persp.aspect || 16 / 9;
        const tanHalfHFov = Math.tan(vFovRad / 2) * aspect;
        const rawDist =
          GAMING_CORNER_CONFIG.screenArcWidth /
          (GAMING_CORNER_CONFIG.pcCamDistanceFill * 2 * tanHalfHFov);
        const dist = Math.max(
          GAMING_CORNER_CONFIG.pcCamMinDist,
          Math.min(GAMING_CORNER_CONFIG.pcCamMaxDist, rawDist)
        );
        const tilt = Math.abs(GAMING_CORNER_CONFIG.monitorTiltX);
        const camLocal = gamingCornerLocalToWorld(
          GAMING_CORNER_CONFIG.mainMonitorPos[0],
          GAMING_CORNER_CONFIG.mainMonitorPos[1] + dist * Math.sin(tilt),
          GAMING_CORNER_CONFIG.mainMonitorPos[2] + 0.002 + dist * Math.cos(tilt)
        );
        _focusTmpCam.position.set(...camLocal);
        _focusTmpCam.lookAt(...PC_MONITOR_WORLD);
        cfg.pos.copy(_focusTmpCam.position);
        cfg.quat.copy(_focusTmpCam.quaternion);
      } else if (target === 'robot') {
        computeRobotFocusPose(cfg.pos, cfg.quat);
      } else if (target === 'gym') {
        const station = hoverGymStationRef.current || 'treadmill';
        useGymStore.getState().setActiveStation(station);
        const pose = GYM_STATION_POSES[station];
        _focusTmpCam.position.set(...pose.pos);
        _focusTmpCam.lookAt(...pose.lookAt);
        cfg.pos.copy(_focusTmpCam.position);
        cfg.quat.copy(_focusTmpCam.quaternion);
      } else if (target === 'portfolio' && portfolioSpec) {
        const pose =
          portfolioSpec.kind === 'certificate'
            ? getCertificateWorldPose(portfolioSpec.certIndex)
            : portfolioSpec.kind === 'achievements'
              ? getAchievementsWorldPose()
              : portfolioSpec.kind === 'phone'
                ? getPhoneWorldPose()
                : getControllerWorldPose();
        _focusTmpCam.position.copy(pose.cameraPos);
        _focusTmpCam.lookAt(pose.target);
        cfg.pos.copy(_focusTmpCam.position);
        cfg.quat.copy(_focusTmpCam.quaternion);
        cfg.duration =
          portfolioSpec.kind === 'phone'
            ? ROOM_CONTENT_CONFIG.phone.camMoveTime
            : portfolioSpec.kind === 'resume'
              ? ROOM_CONTENT_CONFIG.controllerResume.camMoveTime
              : ROOM_CONTENT_CONFIG.placements.certificatesShelf.camMoveTime;
      }

      animStartPos.current.copy(camera.position);
      animStartQuat.current.copy(camera.quaternion);
      animTargetPos.current.copy(cfg.pos);
      animTargetQuat.current.copy(cfg.quat);

      activeFocusTarget.current = target;
      animKind.current = 'enter-focus';
      animDuration.current = cfg.duration;
      animProgress.current = 0;
      animating.current = true;

      if (target === 'tv') {
        tvStore.setTvExiting(false);
        tvStore.setTvMode(true);
      } else if (target === 'gramophone') {
        tvStore.setTvExiting(false);
        tvStore.setGramophoneMode(true);
      } else if (target === 'pc') {
        pcStore.setPcArrived(false);
        pcStore.setScreenCorners(null);
        pcStore.setPcExiting(false);
        pcStore.setPcMode(true);
      } else if (target === 'gym') {
        useGymStore.getState().setGymExiting(false);
        useGymStore.getState().setGymMode(true);
      } else if (target === 'portfolio' && portfolioSpec) {
        portfolioStore.enterFocus(portfolioSpec.kind, portfolioSpec.certIndex);
      }
    },
    [camera, computeRobotFocusPose, gl, isAnyInteractiveActive, movementEnabledRef, updatePrompt]
  );

  const computePcFocusPose = useCallback(
    (targetPos: THREE.Vector3, targetQuat: THREE.Quaternion) => {
      const persp = camera as THREE.PerspectiveCamera;
      const vFovRad = THREE.MathUtils.degToRad(persp.fov || 70);
      const aspect =
        gl.domElement.clientHeight > 0
          ? gl.domElement.clientWidth / gl.domElement.clientHeight
          : persp.aspect || 16 / 9;
      const tanHalfHFov = Math.tan(vFovRad / 2) * aspect;
      const rawDist =
        GAMING_CORNER_CONFIG.screenArcWidth /
        (GAMING_CORNER_CONFIG.pcCamDistanceFill * 2 * tanHalfHFov);
      const dist = Math.max(
        GAMING_CORNER_CONFIG.pcCamMinDist,
        Math.min(GAMING_CORNER_CONFIG.pcCamMaxDist, rawDist)
      );
      const tilt = Math.abs(GAMING_CORNER_CONFIG.monitorTiltX);
      const camLocal = gamingCornerLocalToWorld(
        GAMING_CORNER_CONFIG.mainMonitorPos[0],
        GAMING_CORNER_CONFIG.mainMonitorPos[1] + dist * Math.sin(tilt),
        GAMING_CORNER_CONFIG.mainMonitorPos[2] + 0.002 + dist * Math.cos(tilt)
      );
      _focusTmpCam.position.set(...camLocal);
      _focusTmpCam.lookAt(...PC_MONITOR_WORLD);
      targetPos.copy(_focusTmpCam.position);
      targetQuat.copy(_focusTmpCam.quaternion);
    },
    [camera, gl]
  );

  const computePcScreenCorners = useCallback((): QuadPoints | null => {
    const { screenArcWidth, screenHeight, monitorTiltX, mainMonitorPos } =
      GAMING_CORNER_CONFIG;
    const inset = 0.004;
    const hx = screenArcWidth / 2 - inset;
    const hy = screenHeight / 2 - inset;
    const cosT = Math.cos(monitorTiltX);
    const sinT = Math.sin(monitorTiltX);

    const domRect = gl.domElement.getBoundingClientRect();
    if (domRect.width <= 0 || domRect.height <= 0) return null;

    const persp = camera as THREE.PerspectiveCamera;
    _focusTmpCam.fov = persp.fov || 70;
    _focusTmpCam.near = persp.near || 0.1;
    _focusTmpCam.far = persp.far || 1000;
    _focusTmpCam.aspect = domRect.width / domRect.height;
    _focusTmpCam.position.copy(camera.position);
    _focusTmpCam.quaternion.copy(camera.quaternion);
    _focusTmpCam.updateProjectionMatrix();
    _focusTmpCam.updateMatrixWorld(true);

    // Order strictly: Top-Left, Top-Right, Bottom-Right, Bottom-Left of the flat glass
    const corners: ReadonlyArray<readonly [number, number]> = [
      [-hx, hy],
      [hx, hy],
      [hx, -hy],
      [-hx, -hy],
    ];

    const v = new THREE.Vector3();
    const out: [number, number][] = [];
    for (const [cx, cy] of corners) {
      const ty = cy * cosT;
      const tz = cy * sinT;
      const [wx, wy, wz] = gamingCornerLocalToWorld(
        mainMonitorPos[0] + cx,
        mainMonitorPos[1] + ty,
        mainMonitorPos[2] + 0.002 + tz
      );
      v.set(wx, wy, wz).project(_focusTmpCam);
      out.push([
        domRect.left + (v.x * 0.5 + 0.5) * domRect.width,
        domRect.top + (-v.y * 0.5 + 0.5) * domRect.height,
      ]);
    }

    return out as unknown as QuadPoints;
  }, [camera, gl]);

  // Recompute PC pose & projected 4 screen corners on window resize while PC mode has arrived
  useEffect(() => {
    const onResize = () => {
      const pcStore = usePcStore.getState();
      if (!pcStore.pcMode || !pcStore.pcArrived || pcStore.pcExiting) return;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const latest = usePcStore.getState();
          if (!latest.pcMode || !latest.pcArrived || latest.pcExiting) return;
          computePcFocusPose(camera.position, camera.quaternion);
          const corners = computePcScreenCorners();
          if (corners) latest.setScreenCorners(corners);
        });
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [camera, computePcFocusPose, computePcScreenCorners]);

  const enterSeatMode = useCallback(
    (target: SeatTarget) => {
      if (useInputStore.getState().mode !== 'walking' || isAnyInteractiveActive() || animating.current) return;

      const tvStore = useTvStore.getState();
      const pcStore = usePcStore.getState();

      savedPos.current.copy(camera.position);
      savedQuat.current.copy(camera.quaternion);

      useInputStore.getState().beginFocus(target);

      movementEnabledRef.current = false;
      if (document.pointerLockElement) {
        setExpectedUnlock(true);
        document.exitPointerLock();
      }

      updatePrompt(null);

      const cfg = seatConfigs.current[target];
      seatBasePitch.current = cfg.basePitch;
      seatBaseYaw.current = cfg.baseYaw;
      seatPitchOffset.current = 0;
      seatYawOffset.current = 0;

      animStartPos.current.copy(camera.position);
      animStartQuat.current.copy(camera.quaternion);
      animTargetPos.current.copy(cfg.pos);
      animTargetQuat.current.copy(cfg.quat);

      activeSeatTarget.current = target;
      animKind.current = 'enter-seat';
      animDuration.current = SOFA_CONFIG.camMoveTime;
      animProgress.current = 0;
      animating.current = true;

      if (target === 'sofa') {
        tvStore.setTvExiting(false);
        tvStore.setIsSeated(true);
      } else if (target === 'gaming-chair') {
        pcStore.setPcExiting(false);
        pcStore.setChairSeated(true);
      }
    },
    [camera, isAnyInteractiveActive, movementEnabledRef, updatePrompt]
  );

  const requestWalkingLock = useCallback(() => {
    try {
      if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body) {
        document.activeElement.blur();
      }
      window.focus();
      const target = controlsRef.current?.domElement;
      if (target && typeof target.requestPointerLock === 'function') {
        const res = target.requestPointerLock() as unknown as Promise<void> | undefined;
        if (res && typeof res.catch === 'function') {
          res.catch(() => {});
        }
      } else {
        controlsRef.current?.lock();
      }
    } catch {
      // Ignore if browser rejects pointer lock
    }
  }, [controlsRef]);

  const exitFocusMode = useCallback(
    (target: FocusTarget, shouldLockPointer = false) => {
      const tvStore = useTvStore.getState();
      const pcStore = usePcStore.getState();
      const portfolioStore = usePortfolioStore.getState();

      if (target === 'tv' && (!tvStore.tvMode || tvStore.tvExiting)) return;
      if (target === 'gramophone' && (!tvStore.gramophoneMode || tvStore.tvExiting)) return;
      if (target === 'pc' && (!pcStore.pcMode || pcStore.pcExiting)) return;
      if (target === 'portfolio' && (!portfolioStore.focusMode || portfolioStore.focusExiting)) return;
      if (
        target === 'arcade' &&
        (useInputStore.getState().mode !== 'focus' ||
          useInputStore.getState().focusKind !== 'arcade' ||
          useInputStore.getState().focusExiting)
      ) {
        return;
      }
      if (
        target === 'robot' &&
        (useInputStore.getState().mode !== 'focus' ||
          useInputStore.getState().focusKind !== 'robot' ||
          useInputStore.getState().focusExiting)
      ) {
        return;
      }
      if (
        target === 'gym' &&
        (!useGymStore.getState().gymMode || useGymStore.getState().gymExiting)
      ) {
        return;
      }

      exitShouldWalkRef.current = Boolean(shouldLockPointer);
      useInputStore.getState().beginExitFocus();

      if (shouldLockPointer) {
        requestWalkingLock();
      }

      if (target === 'pc') {
        pcStore.setPcArrived(false);
        pcStore.setScreenCorners(null);
        pcStore.setPcExiting(true);
      } else if (target === 'gym') {
        useGymStore.getState().setGymExiting(true);
      } else if (target === 'portfolio') {
        portfolioStore.setFocusExiting(true);
      } else if (target !== 'arcade' && target !== 'robot') {
        if (target === 'tv') tvStore.setTvFullscreen(false);
        tvStore.setTvExiting(true);
      }

      activeFocusTarget.current = target;
      animStartPos.current.copy(camera.position);
      animStartQuat.current.copy(camera.quaternion);
      animTargetPos.current.copy(savedPos.current);
      animTargetQuat.current.copy(savedQuat.current);

      animKind.current = 'exit-focus';
      animDuration.current = focusConfigs.current[target].duration;
      animProgress.current = 0;
      animating.current = true;
    },
    [camera, requestWalkingLock]
  );

  const exitSeatMode = useCallback(
    (target: SeatTarget, shouldLockPointer = false) => {
      const tvStore = useTvStore.getState();
      const pcStore = usePcStore.getState();

      if (target === 'sofa' && (!tvStore.isSeated || tvStore.tvExiting)) return;
      if (target === 'gaming-chair' && (!pcStore.chairSeated || pcStore.pcExiting)) return;
      if (
        target === 'beanbag' &&
        (useInputStore.getState().mode !== 'focus' ||
          useInputStore.getState().focusKind !== 'beanbag' ||
          useInputStore.getState().focusExiting)
      ) {
        return;
      }

      isDraggingLook.current = false;
      exitShouldWalkRef.current = Boolean(shouldLockPointer);
      useInputStore.getState().beginExitFocus();

      if (shouldLockPointer) {
        requestWalkingLock();
      }

      if (target === 'sofa') {
        tvStore.setTvFullscreen(false);
        tvStore.setTvExiting(true);
      } else if (target === 'gaming-chair') {
        pcStore.setPcExiting(true);
      }

      activeSeatTarget.current = target;
      animStartPos.current.copy(camera.position);
      animStartQuat.current.copy(camera.quaternion);
      animTargetPos.current.copy(savedPos.current);
      animTargetQuat.current.copy(savedQuat.current);

      animKind.current = 'exit-seat';
      animDuration.current = SOFA_CONFIG.camMoveTime;
      animProgress.current = 0;
      animating.current = true;
    },
    [camera, requestWalkingLock]
  );

  // Central capture-phase keyboard state-machine handler:
  // - Focus mode: Esc and Q close topmost inner modal/menu/compose first, else exit into 'paused' without lock().
  //   Q is ignored while focus is inside an input, textarea, select or contenteditable.
  // - Seated focus (sofa / gaming-chair): F stands up and attempts pointer re-lock.
  // - Walking mode: E enters the hovered interactive target.
  useEffect(() => {
    const isEditableElement = (el: EventTarget | null): boolean => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      return (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        el.isContentEditable
      );
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const inputState = useInputStore.getState();

      if (
        e.code === STEP5_HOTKEYS.sfxMuteKey &&
        !isEditableElement(e.target) &&
        !isEditableElement(document.activeElement) &&
        (inputState.mode === 'walking' ||
          inputState.mode === 'paused' ||
          (inputState.mode === 'focus' && inputState.focusKind === 'arcade'))
      ) {
        e.preventDefault();
        useSfxStore.getState().toggleMute();
        return;
      }

      if (inputState.mode === 'focus' && !inputState.focusExiting) {
        if (inputState.focusKind === 'arcade') {
          const arcadeHandlers = useArcadeStore.getState().handlers;
          if (e.code === 'KeyQ') {
            e.preventDefault();
            e.stopPropagation();
            exitFocusMode('arcade', true);
            return;
          }
          if (e.code === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            document.exitPointerLock?.();
            useInputStore.getState().enterMenu();
            return;
          }
          if (e.code === 'Space') {
            e.preventDefault();
            e.stopPropagation();
            const status = useArcadeStore.getState().status;
            if (status === 'idle' || status === 'gameover') {
              arcadeHandlers?.startOrRestart();
            }
            return;
          }
          if (e.code === 'ArrowUp' || e.code === 'KeyW') {
            e.preventDefault();
            e.stopPropagation();
            arcadeHandlers?.enqueueDirection('up');
            return;
          }
          if (e.code === 'ArrowDown' || e.code === 'KeyS') {
            e.preventDefault();
            e.stopPropagation();
            arcadeHandlers?.enqueueDirection('down');
            return;
          }
          if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
            e.preventDefault();
            e.stopPropagation();
            arcadeHandlers?.enqueueDirection('left');
            return;
          }
          if (e.code === 'ArrowRight' || e.code === 'KeyD') {
            e.preventDefault();
            e.stopPropagation();
            arcadeHandlers?.enqueueDirection('right');
            return;
          }
          return;
        }

        // Q key exclusively returns from current interaction back to walking in the room
        if (e.code === 'KeyQ') {
          if (
            isEditableElement(e.target) || isEditableElement(document.activeElement)
          ) {
            return;
          }

          e.preventDefault();
          e.stopPropagation();

          const pc = usePcStore.getState();
          const tv = useTvStore.getState();
          const portfolio = usePortfolioStore.getState();

          if (pc.pcMode && !pc.pcExiting) {
            const os = useOsStore.getState();
            if (os.turnOffDialogOpen) {
              os.setTurnOffDialogOpen(false);
              return;
            }
            if (os.activeDialog) {
              os.closeDialog();
              return;
            }
            if (os.contextMenu) {
              os.setContextMenu(null);
              return;
            }
            if (os.startMenuOpen) {
              os.setStartMenuOpen(false);
              return;
            }
            exitFocusMode('pc', true);
            return;
          }

          if (portfolio.focusMode && !portfolio.focusExiting) {
            if (portfolio.focusMode.kind === 'phone' && portfolio.phoneScreen === 'compose') {
              portfolio.setPhoneScreen('home');
              return;
            }
            exitFocusMode('portfolio', true);
            return;
          }

          if (tv.tvMode && !tv.tvExiting) {
            if (tv.tvFullscreen) {
              tv.setTvFullscreen(false);
              return;
            }
            exitFocusMode('tv', true);
            return;
          }
          if (tv.gramophoneMode && !tv.tvExiting) {
            exitFocusMode('gramophone', true);
            return;
          }
          if (tv.isSeated && !tv.tvExiting) {
            if (tv.tvFullscreen) {
              tv.setTvFullscreen(false);
              return;
            }
            exitSeatMode('sofa', true);
            return;
          }
          if (pc.chairSeated && !pc.pcExiting) {
            exitSeatMode('gaming-chair', true);
            return;
          }
          if (inputState.focusKind === 'beanbag') {
            exitSeatMode('beanbag', true);
            return;
          }
          if (inputState.focusKind === 'robot') {
            exitFocusMode('robot', true);
            return;
          }
          if (inputState.focusKind === 'gym' || useGymStore.getState().gymMode) {
            exitFocusMode('gym', true);
            return;
          }
          if (
            inputState.focusKind === 'certificate' ||
            inputState.focusKind === 'achievements' ||
            inputState.focusKind === 'phone' ||
            inputState.focusKind === 'resume'
          ) {
            exitFocusMode('portfolio', true);
            return;
          }
          return;
        }

        // Escape key exits the 3D room completely back to Welcome Screen
        if (e.code === 'Escape') {
          const os = useOsStore.getState();
          if (os.turnOffDialogOpen) {
            os.setTurnOffDialogOpen(false);
            return;
          }
          if (os.activeDialog) {
            os.closeDialog();
            return;
          }
          if (os.contextMenu) {
            os.setContextMenu(null);
            return;
          }
          if (os.startMenuOpen) {
            os.setStartMenuOpen(false);
            return;
          }

          e.preventDefault();
          e.stopPropagation();
          document.exitPointerLock?.();
          useInputStore.getState().enterMenu();
          return;
        }

        if (
          inputState.focusKind === 'gym' &&
          e.code === 'Space' &&
          !e.repeat &&
          !(isEditableElement(e.target) || isEditableElement(document.activeElement))
        ) {
          e.preventDefault();
          e.stopPropagation();
          unlockSfxAudio();
          const gym = useGymStore.getState();
          if (gym.activeStation === 'treadmill') {
            gym.toggleTreadmill();
            playGymBeepSound(gym.treadmillRunning ? 520 : 780);
          } else if (gym.activeStation === 'bench') {
            gym.triggerBenchRep();
            playGymBeepSound(640);
          } else {
            gym.triggerCurlRep();
            playGymBeepSound(680);
          }
          return;
        }

        if (
          e.code === 'KeyF' &&
          !(isEditableElement(e.target) || isEditableElement(document.activeElement))
        ) {
          const tv = useTvStore.getState();
          const pc = usePcStore.getState();
          if (tv.tvMode && !tv.isSeated && !tv.tvExiting) {
            e.preventDefault();
            e.stopPropagation();
            tv.toggleTvFullscreen();
            return;
          }
          if (tv.isSeated && !tv.tvExiting) {
            e.preventDefault();
            e.stopPropagation();
            exitSeatMode('sofa', true);
            return;
          }
          if (pc.chairSeated && !pc.pcExiting) {
            e.preventDefault();
            e.stopPropagation();
            exitSeatMode('gaming-chair', true);
            return;
          }
          if (inputState.focusKind === 'beanbag') {
            e.preventDefault();
            e.stopPropagation();
            exitSeatMode('beanbag', true);
            return;
          }
        }
        return;
      }

      // Escape key in walking or paused mode exits the room back to Welcome Screen
      if (
        e.code === 'Escape' &&
        !isEditableElement(e.target) &&
        !isEditableElement(document.activeElement) &&
        (inputState.mode === 'walking' || inputState.mode === 'paused')
      ) {
        e.preventDefault();
        e.stopPropagation();
        document.exitPointerLock?.();
        useInputStore.getState().enterMenu();
        return;
      }

      if (
        e.code === 'KeyR' &&
        !e.repeat &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !isEditableElement(e.target) &&
        !isEditableElement(document.activeElement) &&
        (inputState.mode === 'walking' || inputState.mode === 'paused') &&
        !isAnyInteractiveActive() &&
        !animating.current
      ) {
        e.preventDefault();
        unlockSfxAudio();
        warmUpMonaSpeech();
        camera.getWorldDirection(_summonCamDir);
        useRobotStore
          .getState()
          .comeToPlayer(camera.position.x, camera.position.z, _summonCamDir.x, _summonCamDir.z);
        return;
      }

      if (inputState.mode !== 'walking') return;
      if (isEditableElement(e.target) || isEditableElement(document.activeElement)) return;

      if (e.code === STEP5_HOTKEYS.themeToggleKey && !isAnyInteractiveActive() && !animating.current) {
        e.preventDefault();
        unlockSfxAudio();
        const nextTheme = useThemeStore.getState().toggleTheme(true);
        playSwitchClickSound(nextTheme === 'night');
        updatePrompt(hoverTarget.current);
        return;
      }

      if (e.code === 'KeyE' && !isAnyInteractiveActive() && !animating.current) {
        if (hoverTarget.current === 'tv') {
          e.preventDefault();
          enterFocusMode('tv');
        } else if (hoverTarget.current === 'sofa') {
          e.preventDefault();
          enterSeatMode('sofa');
        } else if (hoverTarget.current === 'gramophone') {
          e.preventDefault();
          enterFocusMode('gramophone');
        } else if (hoverTarget.current === 'pc') {
          e.preventDefault();
          const pcStore = usePcStore.getState();
          if (!pcStore.poweredPC) {
            pcStore.powerOnPC();
          } else {
            enterFocusMode('pc');
          }
        } else if (hoverTarget.current === 'pc-tower') {
          e.preventDefault();
          usePcStore.getState().togglePCPower();
        } else if (hoverTarget.current === 'gaming-chair') {
          e.preventDefault();
          enterSeatMode('gaming-chair');
        } else if (hoverTarget.current === 'certificate') {
          e.preventDefault();
          enterFocusMode('portfolio', { kind: 'certificate', certIndex: hoverCertIndexRef.current });
        } else if (hoverTarget.current === 'achievement') {
          e.preventDefault();
          enterFocusMode('portfolio', { kind: 'achievements', certIndex: 0 });
        } else if (hoverTarget.current === 'phone') {
          e.preventDefault();
          enterFocusMode('portfolio', { kind: 'phone', certIndex: 0 });
        } else if (hoverTarget.current === 'resume') {
          e.preventDefault();
          enterFocusMode('portfolio', { kind: 'resume', certIndex: 0 });
        } else if (hoverTarget.current === 'switch') {
          e.preventDefault();
          unlockSfxAudio();
          const nextTheme = useThemeStore.getState().toggleTheme(true);
          playSwitchClickSound(nextTheme === 'night');
          updatePrompt('switch');
        } else if (hoverTarget.current === 'arcade') {
          e.preventDefault();
          unlockSfxAudio();
          enterFocusMode('arcade');
        } else if (hoverTarget.current === 'beanbag') {
          e.preventDefault();
          enterSeatMode('beanbag');
        } else if (hoverTarget.current === 'robot') {
          e.preventDefault();
          unlockSfxAudio();
          warmUpMonaSpeech();
          enterFocusMode('robot');
        } else if (hoverTarget.current === 'gym') {
          e.preventDefault();
          unlockSfxAudio();
          playGymBeepSound(760);
          enterFocusMode('gym');
        }
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [camera, enterFocusMode, enterSeatMode, exitFocusMode, exitSeatMode, isAnyInteractiveActive, updatePrompt]);

  // Seated head-look via dragging on the canvas (shared for Sofa, Gaming Chair & Bean Bag)
  useEffect(() => {
    const dom = gl.domElement;

    const onPointerDown = (e: PointerEvent) => {
      const tvStore = useTvStore.getState();
      const pcStore = usePcStore.getState();
      const inputStore = useInputStore.getState();
      const beanSeated = inputStore.mode === 'focus' && inputStore.focusKind === 'beanbag' && !inputStore.focusExiting;
      const seated = (tvStore.isSeated && !tvStore.tvExiting) || (pcStore.chairSeated && !pcStore.pcExiting) || beanSeated;
      if (!seated || animating.current) return;
      isDraggingLook.current = true;
      lastDragPos.current.x = e.clientX;
      lastDragPos.current.y = e.clientY;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDraggingLook.current) return;
      const tvStore = useTvStore.getState();
      const pcStore = usePcStore.getState();
      const inputStore = useInputStore.getState();
      const beanSeated = inputStore.mode === 'focus' && inputStore.focusKind === 'beanbag' && !inputStore.focusExiting;
      const seated = (tvStore.isSeated && !tvStore.tvExiting) || (pcStore.chairSeated && !pcStore.pcExiting) || beanSeated;
      if (!seated || animating.current) {
        isDraggingLook.current = false;
        return;
      }

      const dx = e.clientX - lastDragPos.current.x;
      const dy = e.clientY - lastDragPos.current.y;
      lastDragPos.current.x = e.clientX;
      lastDragPos.current.y = e.clientY;

      seatYawOffset.current = Math.max(-1.25, Math.min(1.25, seatYawOffset.current - dx * 0.0035));
      seatPitchOffset.current = Math.max(-0.55, Math.min(0.55, seatPitchOffset.current - dy * 0.0035));

      _seatEuler.set(
        seatBasePitch.current + seatPitchOffset.current,
        seatBaseYaw.current + seatYawOffset.current,
        0,
        'YXZ'
      );
      camera.quaternion.setFromEuler(_seatEuler);
    };

    const onPointerUp = () => {
      isDraggingLook.current = false;
    };

    dom.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('blur', onPointerUp);

    return () => {
      dom.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('blur', onPointerUp);
    };
  }, [gl, camera]);

  // Smoothly slide camera between certificate frames when index changes in certificate focus mode
  useEffect(() => {
    let prevIndex = usePortfolioStore.getState().focusMode?.certificateIndex ?? -1;
    return usePortfolioStore.subscribe((state) => {
      const fm = state.focusMode;
      if (!fm || fm.kind !== 'certificate' || state.focusExiting || !state.focusArrived) {
        prevIndex = fm?.certificateIndex ?? -1;
        return;
      }
      if (fm.certificateIndex === prevIndex) return;
      prevIndex = fm.certificateIndex;

      const pose = getCertificateWorldPose(fm.certificateIndex);
      _focusTmpCam.position.copy(pose.cameraPos);
      _focusTmpCam.lookAt(pose.target);

      animStartPos.current.copy(camera.position);
      animStartQuat.current.copy(camera.quaternion);
      animTargetPos.current.copy(_focusTmpCam.position);
      animTargetQuat.current.copy(_focusTmpCam.quaternion);
      animKind.current = 'slide-focus';
      animDuration.current = 0.35;
      animProgress.current = 0;
      animating.current = true;
    });
  }, [camera]);

  // Smoothly slide camera between gym stations when user switches station in gym focus mode
  useEffect(() => {
    let prevStation = useGymStore.getState().activeStation;
    return useGymStore.subscribe((state) => {
      if (!state.gymMode || state.gymExiting) {
        prevStation = state.activeStation;
        return;
      }
      if (state.activeStation === prevStation) return;
      prevStation = state.activeStation;

      const pose = GYM_STATION_POSES[state.activeStation];
      _focusTmpCam.position.set(...pose.pos);
      _focusTmpCam.lookAt(...pose.lookAt);

      animStartPos.current.copy(camera.position);
      animStartQuat.current.copy(camera.quaternion);
      animTargetPos.current.copy(_focusTmpCam.position);
      animTargetQuat.current.copy(_focusTmpCam.quaternion);
      animKind.current = 'slide-focus';
      animDuration.current = 0.45;
      animProgress.current = 0;
      animating.current = true;
    });
  }, [camera]);

  // Expose exit & read-only input-state inspection handlers globally for UI overlays and verification
  useEffect(() => {
    const win = window as unknown as {
      __exitTvMode?: (lockPointer?: boolean) => void;
      __exitSeatMode?: (lockPointer?: boolean) => void;
      __exitGramophoneMode?: (lockPointer?: boolean) => void;
      __exitPcMode?: (lockPointer?: boolean) => void;
      __exitChairSeatMode?: (lockPointer?: boolean) => void;
      __exitPortfolioFocus?: (lockPointer?: boolean) => void;
      __exitGymMode?: (lockPointer?: boolean) => void;
      __exitCurrentFocus?: (lockPointer?: boolean) => void;
      __enterRobotFocus?: () => void;
      __monaOpenTarget?: (
        kind: 'tv' | 'pc' | 'certificate' | 'achievements' | 'phone',
        certIndex?: number
      ) => void;
      __getInputDebugState?: () => Record<string, unknown>;
    };
    win.__exitTvMode = (lockPointer) => exitFocusMode('tv', lockPointer);
    win.__exitSeatMode = (lockPointer) => exitSeatMode('sofa', lockPointer);
    win.__exitGramophoneMode = (lockPointer) => exitFocusMode('gramophone', lockPointer);
    win.__exitPcMode = (lockPointer) => exitFocusMode('pc', lockPointer);
    win.__exitChairSeatMode = (lockPointer) => exitSeatMode('gaming-chair', lockPointer);
    win.__exitPortfolioFocus = (lockPointer) => exitFocusMode('portfolio', lockPointer);
    win.__exitGymMode = (lockPointer) => exitFocusMode('gym', lockPointer);
    win.__enterRobotFocus = () => {
      unlockSfxAudio();
      warmUpMonaSpeech();
      enterFocusMode('robot', undefined, true);
    };
    win.__monaOpenTarget = (kind, certIndex = 0) => {
      const input = useInputStore.getState();
      const tvStore = useTvStore.getState();
      const pcStore = usePcStore.getState();
      const portfolioStore = usePortfolioStore.getState();
      if (input.mode === 'focus' && input.focusKind === 'robot' && !animating.current) {
        if (kind === 'tv') {
          useInputStore.getState().beginFocus('tv');
          tvStore.setTvExiting(false);
          tvStore.setTvMode(true);
          activeFocusTarget.current = 'tv';
          animTargetPos.current.copy(focusConfigs.current.tv.pos);
          animTargetQuat.current.copy(focusConfigs.current.tv.quat);
          animDuration.current = focusConfigs.current.tv.duration;
        } else if (kind === 'pc') {
          computePcFocusPose(focusConfigs.current.pc.pos, focusConfigs.current.pc.quat);
          useInputStore.getState().beginFocus('pc');
          pcStore.setPcArrived(false);
          pcStore.setScreenCorners(null);
          pcStore.setPcExiting(false);
          pcStore.setPcMode(true);
          activeFocusTarget.current = 'pc';
          animTargetPos.current.copy(focusConfigs.current.pc.pos);
          animTargetQuat.current.copy(focusConfigs.current.pc.quat);
          animDuration.current = focusConfigs.current.pc.duration;
        } else {
          const pose =
            kind === 'certificate'
              ? getCertificateWorldPose(certIndex)
              : kind === 'achievements'
                ? getAchievementsWorldPose()
                : getPhoneWorldPose();
          _focusTmpCam.position.copy(pose.cameraPos);
          _focusTmpCam.lookAt(pose.target);
          useInputStore.getState().beginFocus(kind);
          portfolioStore.enterFocus(kind, certIndex);
          activeFocusTarget.current = 'portfolio';
          animTargetPos.current.copy(_focusTmpCam.position);
          animTargetQuat.current.copy(_focusTmpCam.quaternion);
          animDuration.current =
            kind === 'phone'
              ? ROOM_CONTENT_CONFIG.phone.camMoveTime
              : ROOM_CONTENT_CONFIG.placements.certificatesShelf.camMoveTime;
        }
        animStartPos.current.copy(camera.position);
        animStartQuat.current.copy(camera.quaternion);
        animKind.current = 'enter-focus';
        animProgress.current = 0;
        animating.current = true;
      }
    };
    win.__exitCurrentFocus = (lockPointer = true) => {
      const tv = useTvStore.getState();
      const pc = usePcStore.getState();
      const portfolio = usePortfolioStore.getState();
      const gym = useGymStore.getState();
      const input = useInputStore.getState();
      if (input.mode === 'focus' && input.focusKind === 'arcade') exitFocusMode('arcade', lockPointer);
      else if (input.mode === 'focus' && input.focusKind === 'beanbag') exitSeatMode('beanbag', lockPointer);
      else if (input.mode === 'focus' && input.focusKind === 'robot') exitFocusMode('robot', lockPointer);
      else if (gym.gymMode) exitFocusMode('gym', lockPointer);
      else if (tv.tvMode) exitFocusMode('tv', lockPointer);
      else if (tv.gramophoneMode) exitFocusMode('gramophone', lockPointer);
      else if (pc.pcMode) exitFocusMode('pc', lockPointer);
      else if (portfolio.focusMode) exitFocusMode('portfolio', lockPointer);
      else if (tv.isSeated) exitSeatMode('sofa', lockPointer);
      else if (pc.chairSeated) exitSeatMode('gaming-chair', lockPointer);
    };
    win.__getInputDebugState = () => {
      const input = useInputStore.getState();
      const tv = useTvStore.getState();
      const pc = usePcStore.getState();
      const portfolio = usePortfolioStore.getState();
      const gym = useGymStore.getState();
      const os = useOsStore.getState();
      return {
        mode: input.mode,
        focusKind: input.focusKind,
        focusExiting: input.focusExiting,
        animating: animating.current,
        isLockedProp: isLocked,
        movementEnabled: movementEnabledRef.current,
        pointerLocked: document.pointerLockElement !== null,
        cameraPos: [camera.position.x, camera.position.y, camera.position.z],
        cameraQuat: camera.quaternion.toArray(),
        tvMode: tv.tvMode,
        isSeated: tv.isSeated,
        gramophoneMode: tv.gramophoneMode,
        pcMode: pc.pcMode,
        pcArrived: pc.pcArrived,
        chairSeated: pc.chairSeated,
        gymMode: gym.gymMode,
        gymStation: gym.activeStation,
        portfolioKind: portfolio.focusMode?.kind ?? null,
        phoneScreen: portfolio.phoneScreen,
        osDialog: Boolean(os.activeDialog),
        osTurnOff: os.turnOffDialogOpen,
        osStartMenu: os.startMenuOpen,
        hoverTarget: hoverTarget.current,
        monaPos: [monaLivePose.x, monaLivePose.z],
      };
    };
    return () => {
      delete win.__exitTvMode;
      delete win.__exitSeatMode;
      delete win.__exitGramophoneMode;
      delete win.__exitPcMode;
      delete win.__exitChairSeatMode;
      delete win.__exitPortfolioFocus;
      delete win.__exitGymMode;
      delete win.__exitCurrentFocus;
      delete win.__enterRobotFocus;
      delete win.__monaOpenTarget;
      delete win.__getInputDebugState;
    };
  }, [camera, computePcFocusPose, enterFocusMode, exitFocusMode, exitSeatMode, isLocked, movementEnabledRef]);

  useFrame((state, delta) => {
    const tvStore = useTvStore.getState();
    const pcStore = usePcStore.getState();
    const portfolioStore = usePortfolioStore.getState();

    // 1. Camera glide animation
    if (animating.current) {
      const dt = Math.min(delta, 0.1);
      animProgress.current += dt / animDuration.current;

      if (animProgress.current >= 1) {
        animProgress.current = 1;
        animating.current = false;

        camera.position.copy(animTargetPos.current);
        camera.quaternion.copy(animTargetQuat.current);

        if (animKind.current === 'enter-focus') {
          if (activeFocusTarget.current === 'pc') {
            const corners = computePcScreenCorners();
            if (corners) pcStore.setScreenCorners(corners);
            pcStore.setPcArrived(true);
          } else if (activeFocusTarget.current === 'portfolio') {
            portfolioStore.setFocusArrived(true);
          }
        } else if (animKind.current === 'exit-focus') {
          movementEnabledRef.current = true;
          const target = activeFocusTarget.current;
          activeFocusTarget.current = null;
          if (target === 'tv') {
            tvStore.setTvExiting(false);
            tvStore.setTvMode(false);
          } else if (target === 'gramophone') {
            tvStore.setTvExiting(false);
            tvStore.setGramophoneMode(false);
          } else if (target === 'pc') {
            pcStore.setPcExiting(false);
            pcStore.setPcArrived(false);
            pcStore.setScreenCorners(null);
            pcStore.setPcMode(false);
          } else if (target === 'gym') {
            useGymStore.getState().setGymExiting(false);
            useGymStore.getState().setGymMode(false);
          } else if (target === 'portfolio') {
            portfolioStore.clearFocus();
          }
          const shouldWalk = exitShouldWalkRef.current;
          exitShouldWalkRef.current = false;
          const nextMode = shouldWalk ? 'walking' : 'paused';
          useInputStore.getState().finishExitFocus(nextMode);
          if (shouldWalk) {
            requestWalkingLock();
          }
        } else if (animKind.current === 'exit-seat') {
          movementEnabledRef.current = true;
          const target = activeSeatTarget.current;
          activeSeatTarget.current = null;
          if (target === 'sofa') {
            tvStore.setTvExiting(false);
            tvStore.setIsSeated(false);
          } else if (target === 'gaming-chair') {
            pcStore.setPcExiting(false);
            pcStore.setChairSeated(false);
          }
          const shouldWalk = exitShouldWalkRef.current;
          exitShouldWalkRef.current = false;
          const nextMode = shouldWalk ? 'walking' : 'paused';
          useInputStore.getState().finishExitFocus(nextMode);
          if (shouldWalk) {
            requestWalkingLock();
          }
        }
      } else {
        const t = easeInOut(animProgress.current);
        camera.position.lerpVectors(animStartPos.current, animTargetPos.current, t);
        camera.quaternion.slerpQuaternions(animStartQuat.current, animTargetQuat.current, t);
      }
      return;
    }

    // 2. Raycast only while walking with pointer locked and not in an interactive view
    if (useInputStore.getState().mode !== 'walking' || !isLocked || isAnyInteractiveActive()) {
      updatePrompt(null);
      return;
    }

    // Refresh interactive meshes once per second (handles Suspense mounts cleanly)
    const elapsed = state.clock.elapsedTime;
    if (
      interactiveTargetsRef.current.length === 0 ||
      elapsed - lastInteractiveScanRef.current > 1.0 ||
      interactiveTargetsRef.current.some((o) => !o.parent)
    ) {
      lastInteractiveScanRef.current = elapsed;
      const found = interactiveTargetsRef.current;
      found.length = 0;
      scene.traverse((obj) => {
        const kind = obj.userData?.interactive;
        if (
          kind === 'tv' ||
          kind === 'sofa' ||
          kind === 'gramophone' ||
          kind === 'pc' ||
          kind === 'pc-tower' ||
          kind === 'gaming-chair' ||
          kind === 'certificate' ||
          kind === 'certificate-or-achievement' ||
          kind === 'achievement' ||
          kind === 'phone' ||
          kind === 'resume' ||
          kind === 'switch' ||
          kind === 'arcade' ||
          kind === 'beanbag' ||
          kind === 'robot' ||
          kind === 'gym'
        ) {
          found.push(obj);
        }
      });
    }

    let nextTarget: HoverTarget = null;
    if (interactiveTargetsRef.current.length > 0) {
      _intersects.length = 0;
      _raycaster.setFromCamera(_screenCenter, camera);
      _raycaster.intersectObjects(interactiveTargetsRef.current, false, _intersects);

      if (_intersects.length > 0) {
        const hit = _intersects[0];
        const kind = hit.object.userData?.interactive;
        if (
          kind === 'tv' &&
          camera.position.x > TV_SCREEN_WORLD_X &&
          hit.distance < TV_CONFIG.tvInteractDistance
        ) {
          nextTarget = 'tv';
        } else if (kind === 'sofa' && hit.distance < SOFA_CONFIG.interactDistance) {
          nextTarget = 'sofa';
        } else if (kind === 'gramophone' && hit.distance < GRAMOPHONE_CONFIG.interactDistance) {
          nextTarget = 'gramophone';
        } else if (kind === 'pc' && hit.distance < GAMING_CORNER_CONFIG.pcInteractDistance) {
          nextTarget = 'pc';
        } else if (kind === 'pc-tower' && hit.distance < GAMING_CORNER_CONFIG.pcInteractDistance) {
          nextTarget = 'pc-tower';
        } else if (kind === 'gaming-chair' && hit.distance < GAMING_CORNER_CONFIG.chairInteractDistance) {
          nextTarget = 'gaming-chair';
        } else if (
          kind === 'certificate' &&
          hit.distance <= ROOM_CONTENT_CONFIG.placements.certificatesShelf.interactDistance
        ) {
          hoverCertIndexRef.current = typeof hit.instanceId === 'number' ? hit.instanceId : 0;
          nextTarget = 'certificate';
        } else if (
          kind === 'certificate-or-achievement' &&
          hit.distance <= ROOM_CONTENT_CONFIG.placements.certificatesShelf.interactDistance
        ) {
          const fi = hit.faceIndex ?? 0;
          if (fi >= ROOM_CONTENT_CONFIG.shelfFrameTotal * 2) {
            nextTarget = 'achievement';
          } else {
            hoverCertIndexRef.current = Math.floor(fi / 2);
            nextTarget = 'certificate';
          }
        } else if (
          kind === 'achievement' &&
          hit.distance <= ROOM_CONTENT_CONFIG.placements.certificatesShelf.interactDistance
        ) {
          nextTarget = 'achievement';
        } else if (kind === 'phone' && hit.distance <= ROOM_CONTENT_CONFIG.phone.interactDistance) {
          nextTarget = 'phone';
        } else if (
          kind === 'resume' &&
          hit.distance <= ROOM_CONTENT_CONFIG.controllerResume.interactDistance
        ) {
          nextTarget = 'resume';
        } else if (
          kind === 'switch' &&
          hit.distance <= LIGHT_SWITCH_CONFIG.interactDistance
        ) {
          nextTarget = 'switch';
        } else if (
          kind === 'arcade' &&
          hit.distance <= ARCADE_CONFIG.interactDistance
        ) {
          nextTarget = 'arcade';
        } else if (
          kind === 'beanbag' &&
          hit.distance <= GAMING_ROOM_CONFIG.beanBag.interactDistance
        ) {
          nextTarget = 'beanbag';
        } else if (
          kind === 'robot' &&
          hit.distance <= ROBOT_CONFIG.interactDistance
        ) {
          nextTarget = 'robot';
        } else if (
          kind === 'gym' &&
          hit.distance <= GYM_INTERACT_DISTANCE
        ) {
          const st = hit.object.userData?.gymStation;
          hoverGymStationRef.current =
            st === 'bench' || st === 'dumbbells' ? st : 'treadmill';
          nextTarget = 'gym';
        }
      }
    }

    updatePrompt(nextTarget);
  });

  return null;
}
