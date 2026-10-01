import type { Presentation } from './presentation-model';

// Glass polygons in photograph coordinates. Frames and wall never receive rain.
const panes = {
  wide: [[[0, 0], [.073, .006], [.073, .69], [0, .732]], [[.096, .033], [.134, .088], [.134, .661], [.096, .682]]],
  portrait: [[[0, .023], [.037, .047], [.037, .552], [0, .569]], [[.064, .076], [.099, .104], [.099, .532], [.064, .547]]],
};
let canvas: HTMLCanvasElement | undefined, image: HTMLImageElement, config: Presentation['rain'];
let orientation: 'wide' | 'portrait' = 'wide', active = false, animation = 0, last = 0, elapsed = 0;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

export function configureWindowRain(backdrop: HTMLElement, photo: HTMLImageElement, p?: Presentation, portrait = false) {
  if (!canvas) {
    canvas = document.createElement('canvas'); canvas.id = 'windowRain'; canvas.className = 'window-rain';
    canvas.setAttribute('aria-hidden', 'true'); backdrop.append(canvas);
  }
  image = photo; config = p?.rain; orientation = portrait ? 'portrait' : 'wide';
  active = p?.environment === 'rain' && config?.enabled !== false && (config?.intensity ?? 55) > 0 && !photo.hidden;
  canvas.hidden = !active;
  if (!active) { cancelAnimationFrame(animation); animation = 0; last = 0; canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height); return; }
  if (!animation && !document.hidden) animation = requestAnimationFrame(draw);
}
function noise(n: number) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
function draw(time: number) {
  animation = 0;
  if (!active || !canvas || document.hidden) { last = 0; return; }
  if (time - last < 40) { animation = requestAnimationFrame(draw); return; }
  const dt = last ? Math.min(.08, (time - last) / 1000) : 0; last = time;
  if (!reduced.matches) elapsed += dt * (config?.speed ?? 1);
  const c = canvas.getContext('2d'), rect = canvas.getBoundingClientRect();
  if (!c || !image.complete || !image.naturalWidth || !rect.width || !rect.height) { animation = requestAnimationFrame(draw); return; }
  const scale = Math.min(1.5, devicePixelRatio || 1), w = Math.min(1600, Math.round(rect.width * scale)), h = Math.min(2000, Math.round(rect.height * scale));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  c.clearRect(0, 0, w, h);
  const cover = Math.max(w / image.naturalWidth, h / image.naturalHeight), iw = image.naturalWidth * cover, ih = image.naturalHeight * cover;
  const ox = (w - iw) / 2, oy = (h - ih) / 2;
  c.save(); c.beginPath();
  for (const pane of panes[orientation]) { pane.forEach(([x,y], i) => i ? c.lineTo(ox + x * iw, oy + y * ih) : c.moveTo(ox + x * iw, oy + y * ih)); c.closePath(); } c.clip();
  const strength = (config?.intensity ?? 55) / 100;
  // Distant rain falls faster than the larger beads on the glass.
  c.lineWidth = Math.max(.5, w / 1600);
  c.strokeStyle = `rgba(195,220,240,${.14 + strength * .16})`;
  for (let i = 0; i < Math.round(130 * strength); i++) {
    const x = ox + noise(i + 1) * iw * .14, y = oy + ((noise(i + 700) + elapsed * (.35 + noise(i + 900) * .2)) % 1) * ih * .75;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x - iw * .002, y + ih * .018); c.stroke();
  }
  for (let i = 0; i < Math.round(75 * strength); i++) {
    const x = ox + noise(i + 2100) * iw * .14, y = oy + ((noise(i + 3300) + elapsed * (.012 + noise(i + 3900) * .025)) % 1) * ih * .74;
    const r = Math.max(1, iw * (.0007 + noise(i + 4400) * .0012));
    c.save(); c.beginPath(); c.ellipse(x, y, r, r * 1.7, 0, 0, Math.PI * 2); c.clip();
    // Refract the same photograph through the bead instead of painting white dots.
    c.globalAlpha = .55; c.drawImage(image, (x - ox - r * 2) / cover, (y - oy - r * 3.4) / cover, r * 4 / cover, r * 6.8 / cover, x - r, y - r * 1.7, r * 2, r * 3.4); c.restore();
    c.lineWidth = Math.max(.6, r * .25); c.strokeStyle = 'rgba(224,243,255,.48)';
    c.beginPath(); c.ellipse(x, y, r, r * 1.7, 0, Math.PI * 1.05, Math.PI * 1.7); c.stroke();
    c.strokeStyle = 'rgba(151,193,216,.2)'; c.beginPath(); c.moveTo(x, y - r * 1.5); c.lineTo(x + r * .2, y - r * 8); c.stroke();
  }
  c.restore(); if (!reduced.matches) animation = requestAnimationFrame(draw);
}
document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(animation); animation = 0; last = 0; } else if (active && !animation) animation = requestAnimationFrame(draw); });

reduced.addEventListener('change', () => { if (active && !document.hidden && !animation) animation = requestAnimationFrame(draw); });
