type Rect = { x: number; y: number; width: number; height: number };

// The body and feet belong to the photograph, not to its video aperture.
// Project them through the actual image framing so zoom/phone/aspect changes
// leave the saved decoration positions untouched.
export function projectRect(percent: Rect, art: Rect, scene: Rect): Rect {
  return { x: art.x - scene.x + art.width * percent.x / 100,
    y: art.y - scene.y + art.height * percent.y / 100,
    width: art.width * percent.width / 100, height: art.height * percent.height / 100 };
}

export function maskBehindTv(behind: HTMLElement, layer: HTMLElement, face: HTMLElement) {
  protectPlayer(layer);
  if (innerWidth <= 520 && innerHeight <= 360) {
    // In a call tile the TV fills the scene; everything behind it is hidden.
    behind.hidden = true;
    return;
  }
  const scene = layer.getBoundingClientRect(), art = face.getBoundingClientRect();
  if (!scene.width || !scene.height || !art.width || !art.height) return;
  const style = getComputedStyle(face);
  const source = (prefix: string): Rect => ({
    x: parseFloat(style.getPropertyValue(`--${prefix}-x`)), y: parseFloat(style.getPropertyValue(`--${prefix}-y`)),
    width: parseFloat(style.getPropertyValue(`--${prefix}-w`)), height: parseFloat(style.getPropertyValue(`--${prefix}-h`)),
  });
  const rects = ['tv-body', 'tv-feet'].map(prefix => projectRect(source(prefix), art, scene));
  if (rects.some(rect => !Object.values(rect).every(Number.isFinite))) return;
  const holes = rects.map((rect, index) => `<rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" rx="${index ? 0 : Math.min(rect.width, rect.height) * .012}" fill="black"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${scene.width}" height="${scene.height}" viewBox="0 0 ${scene.width} ${scene.height}"><defs><mask id="tv" maskUnits="userSpaceOnUse" x="0" y="0" width="${scene.width}" height="${scene.height}"><rect width="100%" height="100%" fill="white"/>${holes}</mask></defs><rect width="100%" height="100%" fill="white" mask="url(#tv)"/></svg>`;
  behind.style.maskImage = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  behind.style.maskSize = '100% 100%';
}
export function protectPlayer(layer:HTMLElement){
  if(!document.querySelector('#stage')?.classList.contains('youtube-source')){layer.style.removeProperty('mask-image');return;}
  const scene=layer.getBoundingClientRect(),glass=document.querySelector('#player')!.getBoundingClientRect();
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${scene.width}" height="${scene.height}"><defs><mask id="glass"><rect width="100%" height="100%" fill="white"/><rect x="${glass.x-scene.x}" y="${glass.y-scene.y}" width="${glass.width}" height="${glass.height}" fill="black"/></mask></defs><rect width="100%" height="100%" fill="white" mask="url(#glass)"/></svg>`;
  layer.style.maskImage=`url("data:image/svg+xml,${encodeURIComponent(svg)}")`;layer.style.maskSize='100% 100%';
}
