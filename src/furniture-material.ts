import { materials, type FurnitureMaterial } from '../material-catalog.mjs';
import { props } from '../room-catalog.mjs';

const textures = new Map<string, Promise<HTMLImageElement>>();
const renders = new Map<string, HTMLCanvasElement>();
function texture(name: string) {
  let pending = textures.get(name);
  if (!pending) { const image = new Image(); image.src = `/rooms/materials/${name}.webp`; pending = image.decode().then(() => image); textures.set(name, pending); }
  return pending;
}
// Render only when an object/material changes; moving the object reuses its bitmap.
// Preserve the source alpha, lighting and perspective instead of drawing a new mueble.
export async function applyFurnitureMaterial(box: HTMLElement, image: HTMLImageElement, asset: string, material?: FurnitureMaterial) {
  const preset = materials.find(m => m.id === material?.preset);
  if (!material || !preset || preset.id === 'original') return;
  try {
    await image.decode();
    const tile = preset.texture ? await texture(preset.texture) : undefined;
    if (!box.isConnected) return;
    const key = JSON.stringify([image.src, asset, material]);
    let result = renders.get(key);
    if (!result) {
      const ratio = Math.min(1, 800 / image.naturalWidth, 1000 / image.naturalHeight);
      const width = Math.max(1, Math.round(image.naturalWidth * ratio)), height = Math.max(1, Math.round(image.naturalHeight * ratio));
      result = document.createElement('canvas'); result.width = width; result.height = height;
      const ctx = result.getContext('2d', { willReadFrequently: true }); if (!ctx) return;
      ctx.drawImage(image, 0, 0, width, height);
      const original = ctx.getImageData(0, 0, width, height), pixels = new Uint8ClampedArray(original.data);
      const tex = document.createElement('canvas'); tex.width = width; tex.height = height;
      const t = tex.getContext('2d', { willReadFrequently: true })!;
      if (tile) {
        const pattern = t.createPattern(tile, 'repeat')!;
        const scale = width / tile.naturalWidth * (material.scale ?? 1);
        pattern.setTransform(new DOMMatrix().scale(scale)); t.fillStyle = pattern;
      } else t.fillStyle = '#ffffff';
      t.fillRect(0, 0, width, height); const grain = t.getImageData(0, 0, width, height).data;
      const tint = (material.color ?? preset.tint).match(/[a-f\d]{2}/gi)!.map(v => parseInt(v, 16));
      const mix = (material.strength ?? 85) / 100;
      for (let i = 0; i < pixels.length; i += 4) {
        if (!pixels[i + 3]) continue;
        const luminance = (pixels[i] * .2126 + pixels[i + 1] * .7152 + pixels[i + 2] * .0722) / 255;
        const shade = .5 + luminance * .5;
        for (let channel = 0; channel < 3; channel++) pixels[i + channel] = pixels[i + channel] * (1 - mix) + grain[i + channel] * tint[channel] / 255 * shade * mix;
      }
      const overlay = document.createElement('canvas'); overlay.width = width; overlay.height = height;
      overlay.getContext('2d')!.putImageData(new ImageData(pixels, width, height), 0, 0);
      const corners = props.find(p => p.id === asset)?.support?.corners;
      if ((material.scope ?? (corners ? 'top' : 'all')) === 'top' && corners) {
        ctx.save(); ctx.beginPath(); corners.forEach(([x, y], i) => i ? ctx.lineTo(x / 100 * width, y / 100 * height) : ctx.moveTo(x / 100 * width, y / 100 * height)); ctx.closePath(); ctx.clip();
        ctx.clearRect(0, 0, width, height); ctx.drawImage(overlay, 0, 0); ctx.restore();
      } else { ctx.clearRect(0, 0, width, height); ctx.drawImage(overlay, 0, 0); }
      renders.set(key, result); if (renders.size > 20) renders.delete(renders.keys().next().value!);
    }
    if (!box.isConnected) return;
    const canvas = document.createElement('canvas'); canvas.className = 'decoration-material'; canvas.width = result.width; canvas.height = result.height;
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
    canvas.style.filter = image.style.filter; canvas.style.clipPath = image.style.clipPath;
    canvas.getContext('2d')!.drawImage(result, 0, 0); box.append(canvas); image.style.opacity = '0';
    box.dataset.material = preset.id;
  } catch { /* Keep the original photographic sprite if a texture is unavailable. */ }
}
