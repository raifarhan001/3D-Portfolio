import * as THREE from 'three';

export interface ElsaRigHandles {
  skinnedMesh: THREE.SkinnedMesh;
  rootBone: THREE.Bone;
  pelvisBone: THREE.Bone;
  skirtBone: THREE.Bone;
  torsoBone: THREE.Bone;
  headBone: THREE.Bone;
  frontLegBone: THREE.Bone;
  backLegBone: THREE.Bone;
  modelScale: number;
  dispose: () => void;
}

const TARGET_ELSA_HEIGHT = 1.66;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Finds the primary mesh inside the loaded ELSA GLB and builds a smooth
 * 7-bone SkinnedMesh rig grounded at y = 0, scaled to human room proportions.
 */
export function buildElsaSkinnedRig(sourceScene: THREE.Object3D): ElsaRigHandles | null {
  let sourceMesh: THREE.Mesh | null = null;
  sourceScene.traverse((obj) => {
    if (!sourceMesh && (obj as THREE.Mesh).isMesh) {
      sourceMesh = obj as THREE.Mesh;
    }
  });

  if (!sourceMesh) return null;
  const mesh = sourceMesh as THREE.Mesh;

  const geo = mesh.geometry.clone();
  geo.computeBoundingBox();
  const box = geo.boundingBox;
  if (!box) {
    geo.dispose();
    return null;
  }

  const height = Math.max(0.01, box.max.y - box.min.y);
  const offsetX = -(box.min.x + box.max.x) * 0.5;
  const offsetY = -box.min.y;
  const offsetZ = -0.04; // Center torso/hips slightly around Z=0 while preserving stride

  // Shift geometry once so feet rest cleanly at y = 0
  geo.translate(offsetX, offsetY, offsetZ);
  geo.computeBoundingBox();

  const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
  const vertCount = posAttr.count;

  // Bone indices:
  // 0: rootBone (0, 0, 0)
  // 1: pelvisBone (0, 0.96, 0)
  // 2: skirtBone (0, 0.92, 0) -> local (0, -0.04, 0) under pelvis
  // 3: torsoBone (0, 1.08, 0) -> local (0, 0.12, 0) under pelvis
  // 4: headBone (0, 1.58, 0.01) -> local (0, 0.50, 0.01) under torso
  // 5: frontLegBone (0, 0.72, 0.04) -> under root
  // 6: backLegBone (0, 0.72, 0.04) -> under root
  const skinIndices = new Uint16Array(vertCount * 4);
  const skinWeights = new Float32Array(vertCount * 4);

  for (let i = 0; i < vertCount; i++) {
    const vx = posAttr.getX(i);
    const vy = posAttr.getY(i);
    const vz = posAttr.getZ(i);

    // Raw (unshifted) Z check for leg separation below skirt
    const rawZ = vz - offsetZ;
    const rawX = vx - offsetX;

    let w0 = 0; // root
    let w1 = 0; // pelvis
    let w2 = 0; // skirt
    let w3 = 0; // torso
    let w4 = 0; // head
    let w5 = 0; // frontLeg
    let w6 = 0; // backLeg

    const isFrontLegZone = vy < 0.325 && rawZ > 0.022 && rawX > -0.125 && rawX < 0.045;
    const isBackLegZone = vy < 0.37 && rawZ <= 0.022 && rawX > -0.07 && rawX < 0.06;

    if (isFrontLegZone) {
      const legW = 1 - smoothstep(0.22, 0.325, vy);
      w5 = legW;
      w2 = (1 - legW) * smoothstep(0.26, 0.325, vy);
      w0 = Math.max(0, 1 - w5 - w2);
    } else if (isBackLegZone) {
      const legW = 1 - smoothstep(0.26, 0.37, vy);
      w6 = legW;
      w2 = (1 - legW) * smoothstep(0.30, 0.37, vy);
      w0 = Math.max(0, 1 - w6 - w2);
    } else if (vy < 0.96) {
      // Skirt & lower dress transitioning smoothly into pelvis at waist
      const pelvisBlend = smoothstep(0.82, 0.98, vy);
      w1 = pelvisBlend;
      w2 = 1 - pelvisBlend;
    } else if (vy < 1.53) {
      // Waist to shoulders/neck base
      const torsoBlend = smoothstep(0.95, 1.14, vy);
      w3 = torsoBlend;
      w1 = 1 - torsoBlend;
    } else {
      // Neck & head + bob hair
      const headBlend = smoothstep(1.53, 1.62, vy);
      w4 = headBlend;
      w3 = 1 - headBlend;
    }

    // Pick top 4 non-zero weights and normalize
    const pairs: Array<[number, number]> = [
      [0, w0],
      [1, w1],
      [2, w2],
      [3, w3],
      [4, w4],
      [5, w5],
      [6, w6],
    ];
    pairs.sort((a, b) => b[1] - a[1]);

    const top = pairs.slice(0, 4);
    const sum = top[0][1] + top[1][1] + top[2][1] + top[3][1] || 1;
    const base = i * 4;
    for (let k = 0; k < 4; k++) {
      skinIndices[base + k] = top[k][0];
      skinWeights[base + k] = top[k][1] / sum;
    }
  }

  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));

  // Clone material so skinning and lighting adjustments stay isolated
  const srcMat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
  const mat = srcMat.clone();
  mat.envMapIntensity = 1.15;
  mat.needsUpdate = true;

  const rootBone = new THREE.Bone();
  rootBone.position.set(0, 0, 0);

  const pelvisBone = new THREE.Bone();
  pelvisBone.position.set(0, 0.96, 0);
  rootBone.add(pelvisBone);

  const skirtBone = new THREE.Bone();
  skirtBone.position.set(0, -0.04, 0);
  pelvisBone.add(skirtBone);

  const torsoBone = new THREE.Bone();
  torsoBone.position.set(0, 0.12, 0);
  pelvisBone.add(torsoBone);

  const headBone = new THREE.Bone();
  headBone.position.set(0, 0.50, 0.01);
  torsoBone.add(headBone);

  const frontLegBone = new THREE.Bone();
  frontLegBone.position.set(0, 0.72, 0.04);
  rootBone.add(frontLegBone);

  const backLegBone = new THREE.Bone();
  backLegBone.position.set(0, 0.72, 0.04);
  rootBone.add(backLegBone);

  const bones = [
    rootBone,
    pelvisBone,
    skirtBone,
    torsoBone,
    headBone,
    frontLegBone,
    backLegBone,
  ];
  const skeleton = new THREE.Skeleton(bones);

  const skinnedMesh = new THREE.SkinnedMesh(geo, mat);
  skinnedMesh.castShadow = true;
  skinnedMesh.receiveShadow = true;
  skinnedMesh.frustumCulled = false;
  skinnedMesh.raycast = () => {};
  skinnedMesh.add(rootBone);
  skinnedMesh.bind(skeleton);

  const modelScale = TARGET_ELSA_HEIGHT / height;

  return {
    skinnedMesh,
    rootBone,
    pelvisBone,
    skirtBone,
    torsoBone,
    headBone,
    frontLegBone,
    backLegBone,
    modelScale,
    dispose: () => {
      skeleton.dispose();
      geo.dispose();
      mat.dispose();
    },
  };
}
