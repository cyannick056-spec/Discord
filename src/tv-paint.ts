import type { TvPaint } from './presentation-model';
type Rect = { x: number; y: number; width: number; height: number };
let cached: { key: string; canvas: HTMLCanvasElement } | undefined;
export function paintTv(ctx: CanvasRenderingContext2D, image: HTMLImageElement, art: Rect, tv: Rect, aperture: Rect, paint?: TvPaint) {
  if (!paint?.enabled || (paint.strength ?? 85) === 0) return;
  const source = { x: (tv.x - art.x) / art.width * image.naturalWidth, y: (tv.y - art.y) / art.height * image.naturalHeight,
    width: tv.width / art.width * image.naturalWidth, height: tv.height / art.height * image.naturalHeight };
  const glass = { x: (aperture.x - tv.x) / tv.width, y: (aperture.y - tv.y) / tv.height, width: aperture.width / tv.width, height: aperture.height / tv.height };
  const key = JSON.stringify([image.src, Object.values(source).map(n => Math.round(n * 10)), glass, paint.body, paint.bezel, paint.panel]);
  let layer = cached?.key === key ? cached.canvas : undefined;
  if (!layer) {
    layer = document.createElement('canvas'); layer.width = Math.min(1024, Math.round(source.width)); layer.height = Math.max(1, Math.round(source.height * layer.width / source.width));
    const p = layer.getContext('2d', { willReadFrequently: true }); if (!p) return;
    p.drawImage(image, source.x, source.y, source.width, source.height, 0, 0, layer.width, layer.height);
    const pixels = p.getImageData(0, 0, layer.width, layer.height), data = pixels.data;
    const color = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
    const colors = { body: color(paint.body ?? '#596675'), bezel: color(paint.bezel ?? paint.body ?? '#364455'), panel: color(paint.panel ?? paint.body ?? '#596675') };
    const mx = Math.min(tv.width, tv.height) * .036 / tv.width, my = Math.min(tv.width, tv.height) * .036 / tv.height;
    for (let y = 0; y < layer.height; y++) for (let x = 0; x < layer.width; x++) {
      const index = (y * layer.width + x) * 4, u = x / layer.width, v = y / layer.height;
      const part = v > glass.y + glass.height + my ? 'panel' : u >= glass.x - mx && u <= glass.x + glass.width + mx && v >= glass.y - my && v <= glass.y + glass.height + my ? 'bezel' : 'body';
      // Luminance carries the photograph's texture and shaded plastic edges.
      const luma = Math.min(255, (data[index] * .2126 + data[index + 1] * .7152 + data[index + 2] * .0722) * 1.55);
      for (let channel = 0; channel < 3; channel++) data[index + channel] = luma * colors[part][channel];
    }
    p.putImageData(pixels, 0, 0); cached = { key, canvas: layer };
  }
  const finish = paint.finish === 'gloss' ? 1.12 : paint.finish === 'satin' ? 1.04 : 1;
  ctx.save(); ctx.beginPath(); ctx.roundRect(tv.x, tv.y, tv.width, tv.height, Math.min(tv.width, tv.height) * .012); ctx.clip();
  ctx.globalAlpha = (paint.strength ?? 85) / 100;
  ctx.filter = `brightness(${Math.pow(2, (paint.exposure ?? 0) / 100)}) contrast(${(paint.contrast ?? 100) / 100 * finish}) saturate(${(paint.saturation ?? 100) / 100}) hue-rotate(${paint.hue ?? 0}deg)`;
  ctx.drawImage(layer, tv.x, tv.y, tv.width, tv.height); ctx.restore();
}
