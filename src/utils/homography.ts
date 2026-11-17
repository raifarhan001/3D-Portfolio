export type Point2D = readonly [number, number];
export type QuadPoints = readonly [Point2D, Point2D, Point2D, Point2D];

/**
 * Solves the 3x3 planar homography matrix H mapping 4 source 2D points to 4 destination 2D points
 * via 8x8 Gaussian elimination with partial pivoting (dependency-free).
 * Returns row-major 9-element matrix [h0..h7, 1], or null if degenerate.
 */
export function solveHomography(src: QuadPoints, dst: QuadPoints): number[] | null {
  const A: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i];
    const [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }

  const n = 8;
  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    let maxAbs = Math.abs(A[col][col]);
    for (let r = col + 1; r < n; r++) {
      const val = Math.abs(A[r][col]);
      if (val > maxAbs) {
        maxAbs = val;
        pivotRow = r;
      }
    }
    if (maxAbs < 1e-10) return null;

    if (pivotRow !== col) {
      [A[col], A[pivotRow]] = [A[pivotRow], A[col]];
      [b[col], b[pivotRow]] = [b[pivotRow], b[col]];
    }

    const pivot = A[col][col];
    for (let j = col; j < n; j++) A[col][j] /= pivot;
    b[col] /= pivot;

    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = A[r][col];
      if (Math.abs(factor) < 1e-12) continue;
      for (let j = col; j < n; j++) {
        A[r][j] -= factor * A[col][j];
      }
      b[r] -= factor * b[col];
    }
  }

  return [b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7], 1];
}

/**
 * Formats a row-major 3x3 planar homography matrix into CSS matrix3d(...) (column-major).
 */
export function homographyToCssMatrix3d(H: readonly number[]): string {
  const [h0, h1, h2, h3, h4, h5, h6, h7] = H;
  return `matrix3d(${h0}, ${h3}, 0, ${h6}, ${h1}, ${h4}, 0, ${h7}, 0, 0, 1, 0, ${h2}, ${h5}, 0, 1)`;
}

/**
 * Inverts a 3x3 row-major matrix cleanly (used to map client pointer coords back to virtual desktop coords).
 */
export function invert3x3(m: readonly number[]): number[] | null {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const D = -(b * i - c * h);
  const E = a * i - c * g;
  const F = -(a * h - b * g);
  const G = b * f - c * e;
  const H = -(a * f - c * d);
  const I = a * e - b * d;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-12) return null;
  const invDet = 1 / det;
  return [
    A * invDet,
    D * invDet,
    G * invDet,
    B * invDet,
    E * invDet,
    H * invDet,
    C * invDet,
    F * invDet,
    I * invDet,
  ];
}

/**
 * Projects a 2D coordinate through a row-major 3x3 homography matrix.
 */
export function applyHomography(H: readonly number[], x: number, y: number): [number, number] {
  const w = H[6] * x + H[7] * y + H[8];
  if (Math.abs(w) < 1e-9) return [0, 0];
  return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w];
}
