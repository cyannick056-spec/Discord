import type { Presentation } from './presentation-model';
import { gradeFilter, type Mood } from './studio-model';

// Glass polygons in photograph coordinates. Frames and wall never receive rain.
const panes = {
  wide: [[[0, 0], [.073, .006], [.073, .69], [0, .732]], [[.096, .033], [.134, .088], [.134, .661], [.096, .682]]],
  portrait: [[[0, .023], [.037, .047], [.037, .552], [0, .569]], [[.064, .076], [.099, .104], [.099, .532], [.064, .547]]],
};
const closePanes = {
  wide: [[[.041,.071],[.267,.071],[.267,.681],[.041,.681]], [[.281,.071],[.493,.071],[.493,.681],[.281,.681]]],
  portrait: [[[.045,.087],[.294,.087],[.294,.563],[.045,.563]], [[.314,.087],[.581,.087],[.581,.563],[.314,.563]]],
};
let closeRoom = false;
let canvas: HTMLCanvasElement | undefined, image: HTMLImageElement, config: Presentation['rain'];
let layer: HTMLDivElement;
let orientation: 'wide' | 'portrait' = 'wide', active = false, animation = 0, last = 0, elapsed = 0;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
function motionPaused() { return reduced.matches && !config?.forceMotion; }

export function configureWindowRain(backdrop: HTMLElement, photo: HTMLImageElement, p?: Presentation, portrait = false, mood?: Mood) {
  if (!canvas) {
    canvas = document.createElement('canvas'); canvas.id = 'windowRain'; canvas.className = 'window-rain';
    canvas.setAttribute('aria-hidden', 'true');
    // The room grade redraws the photograph; rain must sit above that texture
    // while remaining below movable furniture and the live lighting layers.
    layer = document.createElement('div'); layer.className = 'window-rain-layer';
    backdrop.parentElement!.append(layer); layer.append(canvas);
  }
  layer.style.cssText = backdrop.style.cssText;
  canvas.style.filter = mood ? gradeFilter(mood, 'wall') : '';
  image = photo; config = p?.rain; orientation = portrait ? 'portrait' : 'wide';
  closeRoom = p?.environment === 'rain-close';
  active = (p?.environment === 'rain' || closeRoom) && config?.enabled !== false && (config?.intensity ?? 55) > 0 && !photo.hidden;
  canvas.hidden = !active;
  layer.hidden = !active;
  canvas.dataset.motion = motionPaused() ? 'reduced' : 'running';
  if (!active) { cancelAnimationFrame(animation); animation = 0; last = 0; canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height); return; }
  if (!animation && !document.hidden) animation = requestAnimationFrame(draw);
}
function noise(n: number) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
function draw(time: number) {
  animation = 0;
  if (!active || !canvas || document.hidden) { last = 0; return; }
  if (time - last < 40) { animation = requestAnimationFrame(draw); return; }
  const dt = last ? Math.min(.08, (time - last) / 1000) : 0; last = time;
  if (!motionPaused()) elapsed += dt * (config?.speed ?? 1);
  canvas.dataset.motion = motionPaused() ? 'reduced' : 'running';
  const c = canvas.getContext('2d'), rect = canvas.getBoundingClientRect();
  if (!c || !image.complete || !image.naturalWidth || !rect.width || !rect.height) { animation = requestAnimationFrame(draw); return; }
  const scale = Math.min(1.5, devicePixelRatio || 1), w = Math.min(1600, Math.round(rect.width * scale)), h = Math.min(2000, Math.round(rect.height * scale));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  c.clearRect(0, 0, w, h);
  const cover = Math.max(w / image.naturalWidth, h / image.naturalHeight), iw = image.naturalWidth * cover, ih = image.naturalHeight * cover;
  const ox = image.style.objectPosition === 'left center' ? 0 : (w - iw) / 2, oy = (h - ih) / 2;
  const glassPanes = (closeRoom ? closePanes : panes)[orientation];
  c.save(); c.beginPath();
  for (const pane of glassPanes) { pane.forEach(([x,y], i) => i ? c.lineTo(ox + x * iw, oy + y * ih) : c.moveTo(ox + x * iw, oy + y * ih)); c.closePath(); } c.clip();
  // A TV moved in front of the window still occludes its rain, including its bezel.
  const face = document.querySelector<HTMLElement>('.tv-face');
  if (face) {
    const bounds = face.getBoundingClientRect(), style = getComputedStyle(face), n = (key: string) => parseFloat(style.getPropertyValue('--tv-body-' + key)) / 100;
    const tx = (bounds.x - rect.x + bounds.width * n('x')) * w / rect.width, ty = (bounds.y - rect.y + bounds.height * n('y')) * h / rect.height;
    const tw = bounds.width * n('w') * w / rect.width, th = bounds.height * n('h') * h / rect.height;
    if ([tx, ty, tw, th].every(Number.isFinite)) { c.beginPath(); c.rect(0, 0, w, h); c.rect(tx, ty, tw, th); c.clip('evenodd'); }
  }
  const strength = (config?.intensity ?? 55) / 100;
  // Allocate particles inside each pane, including the narrow portrait window.
  for (const [index, pane] of glassPanes.entries()) {
    const point = (u: number, v: number) => {
      const topX = pane[0][0] + (pane[1][0] - pane[0][0]) * u, topY = pane[0][1] + (pane[1][1] - pane[0][1]) * u;
      const bottomX = pane[3][0] + (pane[2][0] - pane[3][0]) * u, bottomY = pane[3][1] + (pane[2][1] - pane[3][1]) * u;
      return [ox + (topX + (bottomX - topX) * v) * iw, oy + (topY + (bottomY - topY) * v) * ih];
    };
    c.lineWidth = Math.max(.8, iw * .0008); c.lineCap = 'round';
    c.strokeStyle = `rgba(208,232,249,${.25 + strength * .22})`;
    for (let i = 0; i < Math.round(65 * strength); i++) {
      const seed = index * 10000 + i, [x, y] = point(noise(seed + 1), (noise(seed + 700) + elapsed * (.55 + noise(seed + 900) * .35)) % 1);
      c.beginPath(); c.moveTo(x, y); c.lineTo(x - iw * .0015, y + ih * .025); c.stroke();
    }
    for (let i = 0; i < Math.round(38 * strength); i++) {
      const seed = index * 10000 + i, v = (noise(seed + 3300) + elapsed * (.07 + noise(seed + 3900) * .13)) % 1;
      const [x, y] = point(.06 + noise(seed + 2100) * .88, v);
      const r = Math.max(2, iw * (.0014 + noise(seed + 4400) * .002));
      const length = r * (9 + noise(seed + 4700) * 12), trail = c.createLinearGradient(x, y - length, x, y);
      trail.addColorStop(0, 'rgba(219,241,255,0)'); trail.addColorStop(1, 'rgba(219,241,255,.45)');
      c.strokeStyle = trail; c.lineWidth = r * .6; c.beginPath(); c.moveTo(x + r * .3, y - length); c.quadraticCurveTo(x - r * .3, y - length / 2, x, y); c.stroke();
      c.save(); c.beginPath(); c.ellipse(x, y, r, r * 1.8, 0, 0, Math.PI * 2); c.clip();
      // Refract a small crop of the photograph through the moving bead.
      c.globalAlpha = .8; c.drawImage(image, (x - ox - r * 2) / cover, (y - oy - r * 3.6) / cover, r * 4 / cover, r * 7.2 / cover, x - r, y - r * 1.8, r * 2, r * 3.6); c.restore();
      c.lineWidth = Math.max(.8, r * .28); c.strokeStyle = 'rgba(17,41,54,.5)';
      c.beginPath(); c.ellipse(x, y, r, r * 1.8, 0, 0, Math.PI); c.stroke();
      c.strokeStyle = 'rgba(236,249,255,.8)'; c.beginPath(); c.ellipse(x, y, r * .8, r * 1.5, 0, Math.PI * 1.05, Math.PI * 1.75); c.stroke();
    }
  }
  c.restore(); if (!motionPaused()) animation = requestAnimationFrame(draw);
}
document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(animation); animation = 0; last = 0; } else if (active && !animation) animation = requestAnimationFrame(draw); });

reduced.addEventListener('change', () => { if (active && !document.hidden && !animation) animation = requestAnimationFrame(draw); });
