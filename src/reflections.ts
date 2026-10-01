import type { Reflection } from './presentation-model';
import type { SurfacePlane } from './support-surfaces';
type Rect = { x: number; y: number; width: number; height: number };
export function reflectionPlanes(room: Rect, portrait: boolean) {
  return {
    table: { x: room.x, y: room.y + room.height * (portrait ? .42 : .805), width: room.width, height: room.height * (portrait ? .059 : .1) },
    floor: { x: room.x, y: room.y + room.height * (portrait ? .625 : 1.12), width: room.width, height: room.height * (portrait ? .255 : .18) },
  };
}
// Reused low-resolution buffers project the visible video across textured wood.
// Each horizontal strip widens toward the viewer, with a blurred vertical flip.
const buffers = new Map<string, HTMLCanvasElement>();
export function paintReflections(ctx: CanvasRenderingContext2D, frame: HTMLCanvasElement, room: Rect, glass: Rect,
  portrait: boolean, strength: number, settings?: Reflection, tv?: Rect, surfaces?: { table: SurfacePlane; floor: SurfacePlane }) {
  if (settings?.enabled === false || strength <= .001 || (settings?.intensity ?? 65) <= 0) return;
  const planes = surfaces ?? reflectionPlanes(room, portrait);
  for (const name of ['table', 'floor'] as const) {
    const plane: SurfacePlane = planes[name], gain = (settings?.[name] ?? (name === 'table' ? 60 : 45)) / 100;
    if (gain === 0 || plane.y > ctx.canvas.height || plane.y + plane.height < 0) continue;
    let buffer = buffers.get(name); if (!buffer) { buffer = document.createElement('canvas'); buffers.set(name, buffer); }
    const width = Math.min(600, Math.max(32, Math.round(glass.width * (settings?.spread ?? 110) / 100)));
    const height = Math.min(300, Math.max(12, Math.round(plane.height * (settings?.reach ?? 100) / 100)));
    if (buffer.width !== width || buffer.height !== height) { buffer.width = width; buffer.height = height; }
    const b = buffer.getContext('2d'); if (!b) continue; b.clearRect(0, 0, width, height);
    const strips = 36;
    for (let i = 0; i < strips; i++) {
      const t = i / strips, spread = name === 'table' ? .78 + t * .22 : .6 + t * .4;
      const lineHeight = Math.ceil(height / strips) + 1;
      b.drawImage(frame, 0, Math.min(frame.height - 1, Math.floor((1 - t) * (frame.height - 1))), frame.width, 1,
        width * (1 - spread) / 2, i * height / strips, width * spread, lineHeight);
    }
    b.globalCompositeOperation = 'destination-in';
    const fade = b.createLinearGradient(0, 0, 0, height); fade.addColorStop(0, name === 'table' ? 'rgba(0,0,0,.9)' : 'rgba(0,0,0,.48)'); fade.addColorStop(.25, 'rgba(0,0,0,.5)'); fade.addColorStop(1, 'rgba(0,0,0,0)');
    // Color stops above are alpha masks, never a painted scene reflection.
    b.fillStyle = fade; b.fillRect(0, 0, width, height);
    const texture = (settings?.texture ?? 40) / 100;
    b.globalCompositeOperation = 'destination-out';
    b.fillStyle = `rgba(0,0,0,${texture * .3})`;
    for (let y = 0; y < height; y += 5) b.fillRect(0, y, width, 1);
    b.globalCompositeOperation = 'source-over';
    const targetWidth = glass.width * (settings?.spread ?? 110) / 100;
    const targetHeight = plane.height * (settings?.reach ?? 100) / 100;
    const cx = glass.x + glass.width / 2, top = plane.y + plane.height * (settings?.offset ?? 0) / 100;
    ctx.save(); ctx.beginPath();
    if (plane.quad) plane.quad.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    else { ctx.moveTo(plane.x + plane.width * .06, plane.y); ctx.lineTo(plane.x + plane.width * .94, plane.y); ctx.lineTo(plane.x + plane.width, plane.y + plane.height); ctx.lineTo(plane.x, plane.y + plane.height); }
    ctx.closePath(); ctx.clip();
    ctx.beginPath(); ctx.rect(0, 0, ctx.canvas.width, ctx.canvas.height); if (tv) ctx.roundRect(tv.x, tv.y, tv.width, tv.height, Math.min(tv.width, tv.height) * .012); ctx.clip('evenodd');
    const materialGain = plane.material === 'glass' ? 1.4 : plane.material === 'matte' ? .45 : 1;
    // Wood scatters light; a white frame must not turn the whole floor white.
    ctx.globalAlpha = Math.min(.4, strength * (settings?.intensity ?? 65) / 100 * gain * materialGain * (name === 'table' ? .32 : .16));
    ctx.filter = `blur(${settings?.blur ?? 12}px)`; ctx.drawImage(buffer, cx - targetWidth / 2, top, targetWidth, targetHeight); ctx.restore();
  }
}
