'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { SIDE_TABLE_CONFIG } from '@/config/themeConfig';
import { usePortfolioStore } from '@/stores/portfolioStore';
import { usePcStore } from '@/stores/pcStore';
import {
  buildMergedColoredGeometry,
  buildMergedGeometry,
  freezeStaticMatrices,
  type ColoredGeometryPart,
  type GeometryPart,
} from '@/utils/mergeHelpers';
import { createSteamTexture } from '@/utils/step5Textures';

const _mugWorld = new THREE.Vector3(
  SIDE_TABLE_CONFIG.position[0] + 0.1,
  SIDE_TABLE_CONFIG.height + 0.09,
  SIDE_TABLE_CONFIG.position[2] + 0.09
);
const _camDir = new THREE.Vector3();
const _toMug = new THREE.Vector3();
const _dummy = new THREE.Object3D();

/**
 * SideTableCoffee — Walnut side table beside the Arcade with a 4-book stack,
 * an open book, ceramic coffee mug, espresso surface, and 3 rising steam wisps
 * in one InstancedMesh (culled >6m or off-view at 4Hz, hidden in low quality).
 * Strictly <= 6 draw calls (5 in low quality).
 */
export default function SideTableCoffee() {
  const { camera } = useThree();
  const quality = usePortfolioStore((s) => s.graphicsQuality);
  const showSteam = quality !== 'low';

  const rootRef = useRef<THREE.Group>(null);
  const steamInstRef = useRef<THREE.InstancedMesh>(null);
  const steamOpacitiesRef = useRef<THREE.InstancedBufferAttribute | null>(null);
  const visibilityCheckTimerRef = useRef(0);
  const steamActiveRef = useRef(true);
  const steamElapsedRef = useRef(0);

  const steamTex = useMemo(() => createSteamTexture(), []);

  const {
    tableGeo,
    bookCoversGeo,
    bookPagesGeo,
    mugGeo,
    coffeeGeo,
    steamPlaneGeo,
    steamOpacitiesAttr,
    materials,
  } = useMemo(() => {
    const { topRadius, height, walnutColor, bookSpines, pageColor, mugColor, coffeeColor } =
      SIDE_TABLE_CONFIG;

    // 1. Round dark walnut table top (height 0.55, top radius 0.28) + 3 slim tapered legs + lower ring brace
    const topThick = 0.026;
    const legH = height - topThick;
    const tableParts: GeometryPart[] = [
      {
        geometry: new THREE.CylinderGeometry(topRadius, topRadius - 0.008, topThick, 28),
        position: [0, height - topThick / 2, 0],
      },
      {
        geometry: new THREE.TorusGeometry(0.14, 0.009, 8, 24),
        position: [0, 0.16, 0],
        rotation: [Math.PI / 2, 0, 0],
      },
    ];
    for (let i = 0; i < 3; i++) {
      const ang = (i / 3) * Math.PI * 2 + 0.35;
      const lx = Math.cos(ang) * 0.165;
      const lz = Math.sin(ang) * 0.165;
      tableParts.push({
        geometry: new THREE.CylinderGeometry(0.017, 0.011, legH, 10),
        position: [lx, legH / 2, lz],
        rotation: [-Math.sin(ang) * 0.08, 0, Math.cos(ang) * 0.08],
      });
    }

    // 2. Stack of 4 books (left-back side of tabletop) + 1 open book (front-right)
    const coverParts: ColoredGeometryPart[] = [];
    const pageParts: ColoredGeometryPart[] = [];

    const stackX = -0.075;
    const stackZ = -0.055;
    const books = [
      { w: 0.155, d: 0.205, t: 0.026, rotY: 0.12, color: bookSpines[0] },
      { w: 0.148, d: 0.195, t: 0.022, rotY: -0.05, color: bookSpines[1] },
      { w: 0.142, d: 0.186, t: 0.024, rotY: 0.08, color: bookSpines[2] },
      { w: 0.132, d: 0.175, t: 0.019, rotY: -0.14, color: bookSpines[3] },
    ];

    let curY = height;
    const mBook = new THREE.Matrix4();
    const mPage = new THREE.Matrix4();
    const tmpPos = new THREE.Vector3();
    const tmpQuat = new THREE.Quaternion();
    const tmpScale = new THREE.Vector3();
    const tmpEuler = new THREE.Euler(0, 0, 0, 'XYZ');

    for (const b of books) {
      const cy = curY + b.t / 2;
      // Outer cover slightly wider along spine (-X), offset slightly so +X/Z edges expose cream pages
      coverParts.push({
        geometry: new RoundedBoxGeometry(b.w, b.t, b.d, 2, 0.004),
        position: [stackX, cy, stackZ],
        rotation: [0, b.rotY, 0],
        color: b.color,
      });

      // Thin lighter page block inset between top & bottom boards, shifted toward open side (+X)
      mBook.compose(
        new THREE.Vector3(stackX, cy, stackZ),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, b.rotY, 0)),
        new THREE.Vector3(1, 1, 1)
      );
      mPage.makeTranslation(0.006, 0, 0);
      mBook.multiply(mPage);
      mBook.decompose(tmpPos, tmpQuat, tmpScale);
      tmpEuler.setFromQuaternion(tmpQuat, 'XYZ');

      pageParts.push({
        geometry: new THREE.BoxGeometry(b.w - 0.008, b.t - 0.006, b.d - 0.012),
        position: [tmpPos.x, tmpPos.y, tmpPos.z],
        rotation: [tmpEuler.x, tmpEuler.y, tmpEuler.z],
        color: pageColor,
      });

      curY += b.t;
    }

    // Open book resting neatly beside the stack at [0.055, height, -0.115]
    const openX = 0.06;
    const openZ = -0.115;
    const openRotY = -0.35;
    const mOpen = new THREE.Matrix4().compose(
      new THREE.Vector3(openX, height, openZ),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, openRotY, 0)),
      new THREE.Vector3(1, 1, 1)
    );
    const bakeOpenPart = (
      geo: THREE.BufferGeometry,
      lx: number,
      ly: number,
      lz: number,
      rz: number,
      col: string,
      target: ColoredGeometryPart[]
    ) => {
      const mLocal = new THREE.Matrix4().compose(
        new THREE.Vector3(lx, ly, lz),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, rz)),
        new THREE.Vector3(1, 1, 1)
      );
      mLocal.premultiply(mOpen);
      mLocal.decompose(tmpPos, tmpQuat, tmpScale);
      tmpEuler.setFromQuaternion(tmpQuat, 'XYZ');
      target.push({
        geometry: geo,
        position: [tmpPos.x, tmpPos.y, tmpPos.z],
        rotation: [tmpEuler.x, tmpEuler.y, tmpEuler.z],
        color: col,
      });
    };

    bakeOpenPart(new THREE.BoxGeometry(0.165, 0.005, 0.125), 0, 0.0025, 0, 0, '#1e293b', coverParts);
    bakeOpenPart(new THREE.BoxGeometry(0.075, 0.009, 0.116), -0.04, 0.011, 0, 0.09, '#ebe5d7', pageParts);
    bakeOpenPart(new THREE.BoxGeometry(0.075, 0.009, 0.116), 0.04, 0.011, 0, -0.09, '#e2dac8', pageParts);

    // 3. Ceramic coffee mug at [0.10, height, 0.09] + torus handle + espresso coffee disc
    const mugX = 0.1;
    const mugZ = 0.09;
    const mugR = 0.041;
    const mugH = 0.09;
    // Open cylinder rim with bottom base + inner wall + curved handle
    const outerWall = new THREE.CylinderGeometry(mugR, mugR * 0.94, mugH, 20, 1, true);
    const innerWall = new THREE.CylinderGeometry(mugR - 0.005, mugR - 0.006, mugH - 0.01, 20, 1, true);
    // Flip normals on inner cavity cleanly by scaling Y or winding flip
    innerWall.scale(-1, 1, 1);
    const bottomCap = new THREE.CylinderGeometry(mugR * 0.94, mugR * 0.94, 0.012, 20);
    const rimRing = new THREE.TorusGeometry(mugR - 0.0025, 0.0028, 8, 20);
    const handle = new THREE.TorusGeometry(0.025, 0.0055, 8, 16, Math.PI * 1.15);

    const mGeo = buildMergedGeometry([
      { geometry: outerWall, position: [mugX, height + mugH / 2, mugZ] },
      { geometry: innerWall, position: [mugX, height + mugH / 2 + 0.005, mugZ] },
      { geometry: bottomCap, position: [mugX, height + 0.006, mugZ] },
      { geometry: rimRing, position: [mugX, height + mugH, mugZ], rotation: [Math.PI / 2, 0, 0] },
      { geometry: handle, position: [mugX - (mugR - 0.002) * 0.72, height + mugH * 0.52, mugZ + (mugR - 0.002) * 0.72], rotation: [0, 0.78, Math.PI * 0.42] },
    ]);

    const cGeo = new THREE.CircleGeometry(mugR - 0.0055, 18);
    cGeo.rotateX(-Math.PI / 2);
    cGeo.translate(mugX, height + mugH - 0.014, mugZ);

    // 4. Steam quad geometry + InstancedBufferAttribute aOpacity (3 quads in ONE InstancedMesh)
    const sPlaneGeo = new THREE.PlaneGeometry(0.055, 0.055);
    const opacities = new Float32Array(3);
    const sAttr = new THREE.InstancedBufferAttribute(opacities, 1);
    sAttr.setUsage(THREE.DynamicDrawUsage);
    sPlaneGeo.setAttribute('aOpacity', sAttr);

    const tableMat = new THREE.MeshStandardMaterial({
      color: walnutColor,
      roughness: 0.62,
      metalness: 0.06,
    });
    const bookCoverMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.68,
      metalness: 0.04,
    });
    const bookPageMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.85,
      metalness: 0.01,
    });
    const mugMat = new THREE.MeshStandardMaterial({
      color: mugColor,
      roughness: 0.25,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });
    const coffeeMat = new THREE.MeshStandardMaterial({
      color: coffeeColor,
      roughness: 0.14,
      metalness: 0.08,
    });
    const steamMat = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: steamTex },
      },
      vertexShader: `
        attribute float aOpacity;
        varying vec2 vUv;
        varying float vOpacity;
        void main() {
          vUv = uv;
          vOpacity = aOpacity;
          vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform sampler2D uMap;
        varying vec2 vUv;
        varying float vOpacity;
        void main() {
          vec4 tex = texture2D(uMap, vUv);
          gl_FragColor = vec4(tex.rgb, tex.a * vOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
    });

    return {
      tableGeo: buildMergedGeometry(tableParts),
      bookCoversGeo: buildMergedColoredGeometry(coverParts),
      bookPagesGeo: buildMergedColoredGeometry(pageParts),
      mugGeo: mGeo,
      coffeeGeo: cGeo,
      steamPlaneGeo: sPlaneGeo,
      steamOpacitiesAttr: sAttr,
      materials: {
        tableMat,
        bookCoverMat,
        bookPageMat,
        mugMat,
        coffeeMat,
        steamMat,
      },
    };
  }, [steamTex]);

  useLayoutEffect(() => {
    steamOpacitiesRef.current = steamOpacitiesAttr;
    freezeStaticMatrices(rootRef.current);
  }, [steamOpacitiesAttr]);

  useEffect(() => {
    return () => {
      tableGeo.dispose();
      bookCoversGeo.dispose();
      bookPagesGeo.dispose();
      mugGeo.dispose();
      coffeeGeo.dispose();
      steamPlaneGeo.dispose();
      Object.values(materials).forEach((m) => m.dispose());
      steamTex?.dispose();
    };
  }, [tableGeo, bookCoversGeo, bookPagesGeo, mugGeo, coffeeGeo, steamPlaneGeo, materials, steamTex]);

  useFrame((_, delta) => {
    if (!showSteam || !steamInstRef.current) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    const pc = usePcStore.getState();
    if (pc.pcMode && pc.pcArrived && !pc.pcExiting && pc.poweredPC && pc.bootState === 'desktop') {
      return;
    }

    const dt = Math.min(delta, 0.1);
    visibilityCheckTimerRef.current += dt;
    if (visibilityCheckTimerRef.current >= 1 / SIDE_TABLE_CONFIG.steamCheckHz) {
      visibilityCheckTimerRef.current = 0;
      const distSq = camera.position.distanceToSquared(_mugWorld);
      if (distSq > SIDE_TABLE_CONFIG.steamCullDistSq) {
        steamActiveRef.current = false;
      } else {
        camera.getWorldDirection(_camDir);
        _toMug.subVectors(_mugWorld, camera.position).normalize();
        steamActiveRef.current = _camDir.dot(_toMug) > 0.1 || distSq < 2.25;
      }
      steamInstRef.current.visible = steamActiveRef.current;
    }

    if (!steamActiveRef.current) return;

    steamElapsedRef.current += dt;
    const baseTime = steamElapsedRef.current;
    const inst = steamInstRef.current;

    for (let i = 0; i < 3; i++) {
      const phase = ((baseTime * 0.42 + i / 3) % 1 + 1) % 1;
      const y = SIDE_TABLE_CONFIG.height + 0.1 + phase * 0.18;
      const swayX = Math.sin(baseTime * 2.1 + i * 2.1) * (0.008 + phase * 0.012);
      const swayZ = Math.cos(baseTime * 1.7 + i * 1.9) * 0.008;
      const scale = 0.65 + phase * 0.85;
      const alpha = Math.sin(phase * Math.PI) * 0.34;

      _dummy.position.set(0.1 + swayX, y, 0.09 + swayZ);
      _dummy.quaternion.copy(camera.quaternion);
      _dummy.scale.set(scale, scale, 1);
      _dummy.updateMatrix();
      inst.setMatrixAt(i, _dummy.matrix);
      if (steamOpacitiesRef.current) {
        (steamOpacitiesRef.current.array as Float32Array)[i] = alpha;
      }
    }
    inst.instanceMatrix.needsUpdate = true;
    if (steamOpacitiesRef.current) {
      steamOpacitiesRef.current.needsUpdate = true;
    }
  });

  return (
    <group ref={rootRef} name="side-table-coffee" position={SIDE_TABLE_CONFIG.position}>
      {/* Draw call 1: Walnut round side table */}
      <mesh geometry={tableGeo} material={materials.tableMat} />
      {/* Draw call 2: Stack of 4 muted books + open book cover */}
      <mesh geometry={bookCoversGeo} material={materials.bookCoverMat} />
      {/* Draw call 3: Book page blocks + open book pages */}
      <mesh geometry={bookPagesGeo} material={materials.bookPageMat} />
      {/* Draw call 4: Ceramic coffee mug */}
      <mesh geometry={mugGeo} material={materials.mugMat} />
      {/* Draw call 5: Dark coffee surface disc */}
      <mesh geometry={coffeeGeo} material={materials.coffeeMat} />
      {/* Draw call 6: 3 camera-facing steam quads in ONE InstancedMesh (hidden in low quality) */}
      <instancedMesh
        ref={steamInstRef}
        args={[steamPlaneGeo, materials.steamMat, 3]}
        visible={showSteam}
        frustumCulled={false}
        userData={{ dynamicTransform: true }}
      />
    </group>
  );
}
