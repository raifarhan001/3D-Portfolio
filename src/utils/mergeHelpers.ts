import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface GeometryPart {
  geometry: THREE.BufferGeometry;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
}

export interface ColoredGeometryPart extends GeometryPart {
  color: string;
}

const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _scale = new THREE.Vector3();
const _mat = new THREE.Matrix4();
const _col = new THREE.Color();

function normalizePart(part: GeometryPart): THREE.BufferGeometry {
  const g = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();
  part.geometry.dispose();

  for (const key of Object.keys(g.attributes)) {
    if (key !== 'position' && key !== 'normal' && key !== 'uv') {
      g.deleteAttribute(key);
    }
  }

  if (!g.attributes.normal) {
    g.computeVertexNormals();
  }
  if (!g.attributes.uv && g.attributes.position) {
    const count = g.attributes.position.count;
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  }

  const px = part.position ? part.position[0] : 0;
  const py = part.position ? part.position[1] : 0;
  const pz = part.position ? part.position[2] : 0;

  const rx = part.rotation ? part.rotation[0] : 0;
  const ry = part.rotation ? part.rotation[1] : 0;
  const rz = part.rotation ? part.rotation[2] : 0;

  const sx = part.scale ? part.scale[0] : 1;
  const sy = part.scale ? part.scale[1] : 1;
  const sz = part.scale ? part.scale[2] : 1;

  _pos.set(px, py, pz);
  _euler.set(rx, ry, rz, 'XYZ');
  _quat.setFromEuler(_euler);
  _scale.set(sx, sy, sz);
  _mat.compose(_pos, _quat, _scale);

  g.applyMatrix4(_mat);
  return g;
}

/**
 * Normalizes and merges an array of BufferGeometries (with transforms) into a single BufferGeometry
 * so static meshes sharing a material render in 1 draw call. Disposes source part geometries.
 */
export function buildMergedGeometry(parts: GeometryPart[]): THREE.BufferGeometry {
  const prepared: THREE.BufferGeometry[] = [];
  for (let i = 0; i < parts.length; i++) {
    prepared.push(normalizePart(parts[i]));
  }

  const merged = mergeGeometries(prepared, false);
  for (let i = 0; i < prepared.length; i++) {
    prepared[i].dispose();
  }

  if (!merged) {
    return new THREE.BufferGeometry();
  }
  merged.computeBoundingSphere();
  return merged;
}

/**
 * Merges static meshes with distinct flat colors into ONE vertex-colored BufferGeometry (1 draw call).
 */
export function buildMergedColoredGeometry(parts: ColoredGeometryPart[]): THREE.BufferGeometry {
  const prepared: THREE.BufferGeometry[] = [];
  for (let i = 0; i < parts.length; i++) {
    const g = normalizePart(parts[i]);
    _col.set(parts[i].color);
    const count = g.attributes.position.count;
    const colors = new Float32Array(count * 3);
    for (let v = 0; v < count; v++) {
      colors[v * 3] = _col.r;
      colors[v * 3 + 1] = _col.g;
      colors[v * 3 + 2] = _col.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    prepared.push(g);
  }

  const merged = mergeGeometries(prepared, false);
  for (let i = 0; i < prepared.length; i++) {
    prepared[i].dispose();
  }

  if (!merged) {
    return new THREE.BufferGeometry();
  }
  merged.computeBoundingSphere();
  return merged;
}

/**
 * Helper to freeze static matrix updates on an Object3D subtree after initial world matrix sync.
 */
export function freezeStaticMatrices(root: THREE.Object3D | null): void {
  if (!root) return;
  root.updateMatrixWorld(true);
  root.traverse((obj) => {
    if (!obj.userData?.dynamicTransform) {
      obj.matrixAutoUpdate = false;
    }
  });
}
