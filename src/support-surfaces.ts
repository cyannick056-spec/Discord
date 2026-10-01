import { props } from '../room-catalog.mjs';
import type { Presentation } from './presentation-model';
export type Point = [number, number];
export type SurfacePlane = { x: number; y: number; width: number; height: number; quad?: Point[]; material?: 'wood' | 'matte' | 'glass' };

export function supportElement(p?: Presentation) {
  const boxes = [...document.querySelectorAll<HTMLElement>('.decoration-box[data-support=true]:not(.decor-depth-outline)')].filter(el => el.offsetHeight > 0);
  if (p?.supportId) return boxes.find(el => el.dataset.id === p.supportId);
  return boxes.find(el => el.dataset.prop === 'cabinet') ?? boxes[0];
}
// Match the editor's actual matrix, including manual four-corner perspective.
export function supportPlane(p?: Presentation): SurfacePlane | undefined {
  const box = supportElement(p); if (!box) return;
  const meta = props.find(prop => prop.id === box.dataset.prop)?.support;
  const corners = meta?.corners ?? [[3, 0], [97, 0], [100, 10], [0, 10]];
  const parent = box.parentElement!.getBoundingClientRect(), style = getComputedStyle(box), matrix = new DOMMatrix(style.transform);
  const width = box.offsetWidth, height = box.offsetHeight;
  const quad = corners.map(([u, v]) => {
    const q = new DOMPoint((u / 100 - .5) * width, (v / 100 - .5) * height).matrixTransform(matrix);
    return [parent.x + parseFloat(box.style.left) + width / 2 + q.x / q.w, parent.y + parseFloat(box.style.top) + height / 2 + q.y / q.w] as Point;
  });
  if (quad.some(q => q.some(v => !Number.isFinite(v)))) return;
  const xs = quad.map(q => q[0]), ys = quad.map(q => q[1]);
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys), quad, material: meta?.material ?? 'wood' };
}
export function supportContact(plane: SurfacePlane) {
  if (!plane.quad) return { x: plane.x + plane.width / 2, y: plane.y + plane.height * .5 };
  const [a, b, c, d] = plane.quad;
  return { x: (a[0] + b[0]) * .175 + (c[0] + d[0]) * .325, y: (a[1] + b[1]) * .175 + (c[1] + d[1]) * .325 };
}
