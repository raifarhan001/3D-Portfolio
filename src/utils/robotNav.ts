import { ALL_COLLIDERS, ROOM_CONFIG } from '@/config/roomConfig';
import { ROBOT_CONFIG, ROBOT_STATIONS, type RobotStationId } from '@/config/robotConfig';

const HALF_W = ROOM_CONFIG.width / 2;
const HALF_D = ROOM_CONFIG.depth / 2;
const GRID_N = ROBOT_CONFIG.navGridSize; // 40 -> 0.25m cells
const CELL_SIZE = ROOM_CONFIG.width / GRID_N;
const MARGIN = ROBOT_CONFIG.navColliderMargin;

let gridCache: Uint8Array | null = null;

function isPointBlocked(x: number, z: number): boolean {
  const wallMargin = ROBOT_CONFIG.collisionRadius + 0.08;
  if (
    x < -HALF_W + wallMargin ||
    x > HALF_W - wallMargin ||
    z < -HALF_D + wallMargin ||
    z > HALF_D - wallMargin
  ) {
    return true;
  }

  for (const col of ALL_COLLIDERS) {
    if (col.max[1] < 0.08) continue;
    if (
      x >= col.min[0] - MARGIN &&
      x <= col.max[0] + MARGIN &&
      z >= col.min[2] - MARGIN &&
      z <= col.max[2] + MARGIN
    ) {
      return true;
    }
  }
  return false;
}

function getWalkGrid(): Uint8Array {
  if (gridCache) return gridCache;
  const grid = new Uint8Array(GRID_N * GRID_N);
  for (let gz = 0; gz < GRID_N; gz++) {
    for (let gx = 0; gx < GRID_N; gx++) {
      const [wx, wz] = cellToWorld(gx, gz);
      grid[gz * GRID_N + gx] = isPointBlocked(wx, wz) ? 0 : 1;
    }
  }
  gridCache = grid;
  return grid;
}

export function worldToCell(x: number, z: number): [number, number] {
  const gx = Math.max(0, Math.min(GRID_N - 1, Math.floor((x + HALF_W) / CELL_SIZE)));
  const gz = Math.max(0, Math.min(GRID_N - 1, Math.floor((z + HALF_D) / CELL_SIZE)));
  return [gx, gz];
}

export function cellToWorld(gx: number, gz: number): [number, number] {
  const wx = -HALF_W + (gx + 0.5) * CELL_SIZE;
  const wz = -HALF_D + (gz + 0.5) * CELL_SIZE;
  return [wx, wz];
}

export function isWalkableWorld(x: number, z: number): boolean {
  if (isPointBlocked(x, z)) return false;
  const [gx, gz] = worldToCell(x, z);
  return getWalkGrid()[gz * GRID_N + gx] === 1;
}

export function findNearestWalkableCell(gx: number, gz: number): [number, number] {
  const grid = getWalkGrid();
  if (grid[gz * GRID_N + gx] === 1) return [gx, gz];

  let bestGx = gx;
  let bestGz = gz;
  let bestDistSq = Infinity;
  for (let r = 1; r <= 12; r++) {
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        const nx = gx + dx;
        const nz = gz + dz;
        if (nx < 0 || nx >= GRID_N || nz < 0 || nz >= GRID_N) continue;
        if (grid[nz * GRID_N + nx] === 1) {
          const d2 = dx * dx + dz * dz;
          if (d2 < bestDistSq) {
            bestDistSq = d2;
            bestGx = nx;
            bestGz = nz;
          }
        }
      }
    }
    if (bestDistSq < Infinity) break;
  }
  return [bestGx, bestGz];
}

export function findNearestWalkableWorld(x: number, z: number): [number, number] {
  if (!isPointBlocked(x, z)) return [x, z];
  const [gx, gz] = worldToCell(x, z);
  const [nx, nz] = findNearestWalkableCell(gx, gz);
  return cellToWorld(nx, nz);
}

function hasLineOfSight(ax: number, az: number, bx: number, bz: number): boolean {
  const dx = bx - ax;
  const dz = bz - az;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.05) return true;
  const steps = Math.ceil(dist / 0.12);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (isPointBlocked(ax + dx * t, az + dz * t)) {
      return false;
    }
  }
  return !isPointBlocked(bx, bz);
}

const DIRS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];

export function findPath(
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number
): Array<[number, number]> {
  const grid = getWalkGrid();
  const [rawSx, rawSz] = worldToCell(fromX, fromZ);
  const [rawGx, rawGz] = worldToCell(toX, toZ);
  const [sx, sz] = findNearestWalkableCell(rawSx, rawSz);
  const [gx, gz] = findNearestWalkableCell(rawGx, rawGz);

  const safeTarget = findNearestWalkableWorld(toX, toZ);

  if (sx === gx && sz === gz) {
    return [safeTarget];
  }

  if (hasLineOfSight(fromX, fromZ, safeTarget[0], safeTarget[1])) {
    return [safeTarget];
  }

  const total = GRID_N * GRID_N;
  const gScore = new Float32Array(total);
  const fScore = new Float32Array(total);
  const cameFrom = new Int32Array(total);
  const closed = new Uint8Array(total);
  const inOpen = new Uint8Array(total);

  gScore.fill(Infinity);
  fScore.fill(Infinity);
  cameFrom.fill(-1);

  const startIdx = sz * GRID_N + sx;
  const goalIdx = gz * GRID_N + gx;
  gScore[startIdx] = 0;
  fScore[startIdx] = Math.hypot(gx - sx, gz - sz);

  const open: number[] = [startIdx];
  inOpen[startIdx] = 1;

  while (open.length > 0) {
    let bestPos = 0;
    for (let i = 1; i < open.length; i++) {
      if (fScore[open[i]] < fScore[open[bestPos]]) {
        bestPos = i;
      }
    }

    const current = open[bestPos];
    open.splice(bestPos, 1);
    inOpen[current] = 0;

    if (current === goalIdx) {
      const rawWorld: Array<[number, number]> = [];
      let cur = current;
      while (cur !== -1 && cur !== startIdx) {
        const cx = cur % GRID_N;
        const cz = Math.floor(cur / GRID_N);
        rawWorld.push(cellToWorld(cx, cz));
        cur = cameFrom[cur];
      }
      rawWorld.reverse();
      if (rawWorld.length > 0) {
        rawWorld[rawWorld.length - 1] = safeTarget;
      } else {
        rawWorld.push(safeTarget);
      }

      // Smooth waypoints with line-of-sight string-pulling
      const smoothed: Array<[number, number]> = [];
      let anchorX = fromX;
      let anchorZ = fromZ;
      let idx = 0;
      while (idx < rawWorld.length) {
        let furthest = idx;
        for (let probe = rawWorld.length - 1; probe > idx; probe--) {
          if (hasLineOfSight(anchorX, anchorZ, rawWorld[probe][0], rawWorld[probe][1])) {
            furthest = probe;
            break;
          }
        }
        const pt = rawWorld[furthest];
        smoothed.push(pt);
        anchorX = pt[0];
        anchorZ = pt[1];
        idx = furthest + 1;
      }
      return smoothed;
    }

    closed[current] = 1;
    const cx = current % GRID_N;
    const cz = Math.floor(current / GRID_N);

    for (const [dx, dz, stepCost] of DIRS) {
      const nx = cx + dx;
      const nz = cz + dz;
      if (nx < 0 || nx >= GRID_N || nz < 0 || nz >= GRID_N) continue;
      const nIdx = nz * GRID_N + nx;
      if (closed[nIdx] || grid[nIdx] === 0) continue;

      if (dx !== 0 && dz !== 0) {
        if (grid[cz * GRID_N + (cx + dx)] === 0 || grid[(cz + dz) * GRID_N + cx] === 0) {
          continue;
        }
      }

      const tentativeG = gScore[current] + stepCost;
      if (tentativeG < gScore[nIdx]) {
        cameFrom[nIdx] = current;
        gScore[nIdx] = tentativeG;
        fScore[nIdx] = tentativeG + Math.hypot(gx - nx, gz - nz);
        if (!inOpen[nIdx]) {
          open.push(nIdx);
          inOpen[nIdx] = 1;
        }
      }
    }
  }

  return [safeTarget];
}

export function getSafeStationPosition(id: RobotStationId): [number, number] {
  const [x, z] = ROBOT_STATIONS[id].position;
  return findNearestWalkableWorld(x, z);
}
