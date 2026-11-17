'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { buildMergedGeometry, freezeStaticMatrices, type GeometryPart } from '@/utils/mergeHelpers';
import { GAMING_ROOM_CONFIG } from '@/config/themeConfig';
import { usePortfolioStore } from '@/stores/portfolioStore';
import { SMALL_PROPS_UV, createSmallPropsAtlasTexture } from '@/utils/step6Textures';

interface CanPlacement {
  pos: [number, number, number];
  rot: [number, number, number];
  uv: { u0: number; v0: number; u1: number; v1: number };
}

function mapGeometryToAtlasRect(
  geo: THREE.BufferGeometry,
  uv: { u0: number; v0: number; u1: number; v1: number }
): THREE.BufferGeometry {
  const attr = geo.getAttribute('uv');
  if (!attr) return geo;
  const du = uv.u1 - uv.u0;
  const dv = uv.v1 - uv.v0;
  for (let i = 0; i < attr.count; i++) {
    attr.setXY(i, uv.u0 + attr.getX(i) * du, uv.v0 + attr.getY(i) * dv);
  }
  attr.needsUpdate = true;
  return geo;
}

/**
 * Generates an organic slumped teardrop bean bag LatheGeometry flattened slightly at floor & seat pocket.
 */
function createBeanBagGeometry(radius: number, height: number): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  const steps = 16;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps; // 0 = bottom, 1 = top peak
    const y = t * height;
    // Bulge near lower belly (t ~ 0.35), taper smoothly toward backrest crown
    let r = Math.sin(t * Math.PI * 0.92 + 0.08) * radius;
    if (t < 0.06) r *= t / 0.06;
    if (t > 0.96) r *= (1 - t) / 0.04;
    pts.push(new THREE.Vector2(Math.max(r, 0.002), y));
  }
  const geo = new THREE.LatheGeometry(pts, 28);
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const py = pos.getY(i);
    const pz = pos.getZ(i);
    // Flatten bottom to rest solidly on y=0 and push back slightly higher than scooped front pocket
    const frontScoop = pz > 0 ? Math.max(0, 1 - Math.abs(py - height * 0.55) / (height * 0.5)) * 0.07 : 0;
    const backRise = pz < 0 ? Math.max(0, (py / height) * (-pz / radius)) * 0.14 : 0;
    pos.setXYZ(i, px * 1.04, Math.max(0, py - frontScoop + backRise), pz);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return mapGeometryToAtlasRect(geo, SMALL_PROPS_UV.beanBagFabric);
}

/**
 * Transforms an array of GeometryParts from MiniFridge local top space into world space.
 */
function transformFridgeTopCans(
  localCans: CanPlacement[],
  fridgePos: [number, number, number],
  fridgeRotY: number
): CanPlacement[] {
  const mParent = new THREE.Matrix4().compose(
    new THREE.Vector3(...fridgePos),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, fridgeRotY, 0)),
    new THREE.Vector3(1, 1, 1)
  );
  const mChild = new THREE.Matrix4();
  const wPos = new THREE.Vector3();
  const wQuat = new THREE.Quaternion();
  const wScale = new THREE.Vector3();
  const wEuler = new THREE.Euler();

  return localCans.map((c) => {
    mChild.compose(
      new THREE.Vector3(...c.pos),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...c.rot)),
      new THREE.Vector3(1, 1, 1)
    );
    mChild.premultiply(mParent);
    mChild.decompose(wPos, wQuat, wScale);
    wEuler.setFromQuaternion(wQuat, 'XYZ');
    return {
      pos: [wPos.x, wPos.y, wPos.z],
      rot: [wEuler.x, wEuler.y, wEuler.z],
      uv: c.uv,
    };
  });
}

/**
 * LoungeSnacks — Original energy drink cans (3 Coffee Table + 4 Mini-Fridge pyramid),
 * open pizza box with 7 slices + missing wedge, and interactive stitched Bean Bag Chair (1-3 draws).
 * Does NOT duplicate the existing SofaLounge coffee table gamepad.
 */
export default function LoungeSnacks() {
  const groupRef = useRef<THREE.Group>(null);
  const isLow = usePortfolioStore((s) => s.graphicsQuality === 'low');
  const beanCfg = GAMING_ROOM_CONFIG.beanBag;

  const smallPropsAtlas = useMemo(() => createSmallPropsAtlasTexture(), []);

  const merged = useMemo(() => {
    const canR = 0.031;
    const canH = 0.118;
    const glassTopY = 0.3825;

    // 1. 3 Energy Drink Cans on free spots of Coffee Table (clear of Book z in [-0.41,-0.09] and Gamepad z in [+0.145,+0.295])
    const coffeeCans: CanPlacement[] = [
      { pos: [-1.86, glassTopY + canH / 2, -0.5], rot: [0, 0.4, 0], uv: SMALL_PROPS_UV.canVolt },
      { pos: [-1.77, glassTopY + canH / 2, -0.57], rot: [0, -0.8, 0], uv: SMALL_PROPS_UV.canByte },
      // 1 knocked-over lying can resting flush on smoked glass beside book
      { pos: [-1.9, glassTopY + canR, -0.02], rot: [0, 0.55, Math.PI / 2], uv: SMALL_PROPS_UV.canHyper },
    ];

    // 4-can pyramid atop MiniFridge (world origin transformed from MediaWall [-4.56, 0, 0.42], rotY=0.35, topY=1.065)
    const fridgeTopCans = transformFridgeTopCans(
      [
        { pos: [-0.042, canH / 2, -0.03], rot: [0, 0.2, 0], uv: SMALL_PROPS_UV.canVolt },
        { pos: [0.042, canH / 2, -0.03], rot: [0, -0.5, 0], uv: SMALL_PROPS_UV.canHyper },
        { pos: [0.0, canH / 2, 0.042], rot: [0, 1.1, 0], uv: SMALL_PROPS_UV.canByte },
        { pos: [0.0, canH + canH / 2, -0.004], rot: [0, -0.15, 0], uv: SMALL_PROPS_UV.canVolt },
      ],
      [-4.58, 1.065, 4.56],
      Math.PI / 2 + 0.35
    );

    const allCans = [...coffeeCans, ...fridgeTopCans];
    const atlasParts: GeometryPart[] = [];
    const chromeParts: GeometryPart[] = [];

    for (const c of allCans) {
      atlasParts.push({
        geometry: mapGeometryToAtlasRect(new THREE.CylinderGeometry(canR, canR, canH, 16, 1, true), c.uv),
        position: c.pos,
        rotation: c.rot,
      });
      // Aluminum top rim, pull-tab & bottom tapered base merged into metallic mesh
      const mCan = new THREE.Matrix4().compose(
        new THREE.Vector3(...c.pos),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(...c.rot)),
        new THREE.Vector3(1, 1, 1)
      );
      const localChrome: Array<[THREE.BufferGeometry, number]> = [
        [new THREE.CylinderGeometry(canR * 0.9, canR, 0.008, 14), canH / 2 + 0.003],
        [new THREE.CylinderGeometry(canR, canR * 0.88, 0.007, 14), -canH / 2 + 0.003],
        [new THREE.BoxGeometry(0.012, 0.003, 0.018), canH / 2 + 0.008],
      ];
      for (const [subGeo, ly] of localChrome) {
        const p = new THREE.Vector3(0, ly, 0).applyMatrix4(mCan);
        chromeParts.push({
          geometry: subGeo,
          position: [p.x, p.y, p.z],
          rotation: c.rot,
        });
      }
    }

    // 2. Open Pizza Box + 7-Slice Pie (1 missing slice) on free South half of Coffee Table [-1.66, glassTopY, +0.47]
    const px = -1.66;
    const pz = 0.47;
    const boxOuter = mapGeometryToAtlasRect(new THREE.BoxGeometry(0.29, 0.024, 0.29), SMALL_PROPS_UV.pizzaLid);
    const pieTop = mapGeometryToAtlasRect(new THREE.PlaneGeometry(0.265, 0.265), SMALL_PROPS_UV.pizzaPie);
    pieTop.rotateX(-Math.PI / 2);
    pieTop.rotateY(0.14);

    // Open hinged cardboard lid hinged along South edge, tilted open toward entrance/sofa (-Z)
    const lidBoard = mapGeometryToAtlasRect(new RoundedBoxGeometry(0.29, 0.008, 0.29, 1, 0.002), SMALL_PROPS_UV.pizzaLid);
    lidBoard.rotateY(Math.PI);
    lidBoard.rotateX(-1.72);
    lidBoard.rotateY(0.14);

    atlasParts.push(
      { geometry: boxOuter, position: [px, glassTopY + 0.012, pz], rotation: [0, 0.14, 0] },
      { geometry: pieTop, position: [px, glassTopY + 0.025, pz] },
      {
        geometry: lidBoard,
        position: [px + Math.sin(0.14) * 0.145, glassTopY + 0.16, pz + Math.cos(0.14) * 0.145],
      }
    );

    // 3. Tactile Bean Bag Chair
    const beanBagGeo = createBeanBagGeometry(beanCfg.radius, beanCfg.height);

    return {
      snacksAtlasGeo: buildMergedGeometry(atlasParts),
      chromeGeo: buildMergedGeometry(chromeParts),
      beanBagGeo,
    };
  }, [beanCfg.radius, beanCfg.height]);

  const materials = useMemo(() => {
    return {
      snacksAtlas: new THREE.MeshStandardMaterial({
        map: smallPropsAtlas ?? undefined,
        roughness: 0.46,
        metalness: 0.15,
      }),
      aluminum: new THREE.MeshStandardMaterial({
        color: '#cbd5e1',
        roughness: 0.24,
        metalness: 0.86,
      }),
      beanBagFabric: new THREE.MeshStandardMaterial({
        map: smallPropsAtlas ?? undefined,
        roughness: 0.9,
        metalness: 0.02,
      }),
    };
  }, [smallPropsAtlas]);

  useLayoutEffect(() => {
    freezeStaticMatrices(groupRef.current);
  }, [isLow]);

  useEffect(() => {
    return () => {
      merged.snacksAtlasGeo.dispose();
      merged.chromeGeo.dispose();
      merged.beanBagGeo.dispose();
      Object.values(materials).forEach((m) => m.dispose());
      smallPropsAtlas?.dispose();
    };
  }, [merged, materials, smallPropsAtlas]);

  return (
    <group ref={groupRef} name="lounge-snacks-and-beanbag">
      {!isLow && (
        <>
          <mesh geometry={merged.snacksAtlasGeo} material={materials.snacksAtlas} />
          <mesh geometry={merged.chromeGeo} material={materials.aluminum} />
        </>
      )}
      <mesh
        position={beanCfg.position}
        rotation={[0, beanCfg.rotationY, 0]}
        geometry={merged.beanBagGeo}
        material={materials.beanBagFabric}
        userData={{ interactive: 'beanbag' }}
      />
    </group>
  );
}
