export const straightCorners = () => [[0, 0], [100, 0], [100, 100], [0, 100]];
export function validCorners(points: number[][]) {
  if (!Array.isArray(points) || points.length !== 4 || points.some(p => !Array.isArray(p) || p.length !== 2 || p.some(v => !Number.isFinite(v) || v < -60 || v > 160))) return false;
  const crosses = points.map((p, i) => { const q = points[(i + 1) % 4], r = points[(i + 2) % 4]; return (q[0] - p[0]) * (r[1] - q[1]) - (q[1] - p[1]) * (r[0] - q[0]); });
  return crosses.every(v => v > 25) || crosses.every(v => v < -25);
}
export function cornerMatrix(points: number[][], width = 100, height = 100) {
  if (!validCorners(points) || width <= 0 || height <= 0) return '';
  const rows: number[][] = [];
  straightCorners().forEach((p, i) => {
    const x = p[0] / 100 - .5, y = p[1] / 100 - .5, u = points[i][0] / 100 - .5, v = points[i][1] / 100 - .5;
    rows.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u], [0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  });
  for (let k = 0; k < 8; k++) {
    let pivot = k; for (let i = k + 1; i < 8; i++) if (Math.abs(rows[i][k]) > Math.abs(rows[pivot][k])) pivot = i;
    [rows[k], rows[pivot]] = [rows[pivot], rows[k]]; const divisor = rows[k][k]; if (Math.abs(divisor) < 1e-9) return '';
    rows[k] = rows[k].map(v => v / divisor);
    for (let i = 0; i < 8; i++) if (i !== k) { const factor = rows[i][k]; rows[i] = rows[i].map((v, j) => v - factor * rows[k][j]); }
  }
  const h = rows.map(r => r[8]);
  return `matrix3d(${[h[0], h[3] * height / width, 0, h[6] / width, h[1] * width / height, h[4], 0, h[7] / height, 0, 0, 1, 0, h[2] * width, h[5] * height, 0, 1].map(v => Math.abs(v) < 1e-10 ? 0 : v).join(',')})`;
}
