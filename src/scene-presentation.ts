import { screenRect, type Presentation } from './presentation-model';
import type { Mood } from './studio-model';
let current: Presentation | undefined;
let screenBase = { x: 0, y: 0, width: 1, height: 1 };
export function getPresentation() { return current; }
export function applyPresentation(p: Presentation | undefined, mood?: Mood) {
  current = p;
  const stage = document.querySelector<HTMLElement>('#stage')!, room = document.querySelector<HTMLElement>('.room-scene')!;
  const home = stage.classList.contains('home-mode'), face = document.querySelector<HTMLElement>('.tv-face')!;
  const art = document.querySelector<HTMLElement>(home ? '#tvScene' : '#arcadeScene')!;
  const backdrop = document.querySelector<HTMLElement>('#roomBackdrop')!;
  const tiny = innerWidth <= 520 && innerHeight <= 360;
  configureTvModel(face, p, tiny);
  stage.classList.toggle('modular-room', home && Boolean(p?.environment));
  // All built-in choices use the original photographed room. Legacy CSS-room
  // manifests retain their saved geometry but never recreate synthetic furniture.
  stage.classList.toggle('free-room', home && !tiny || p?.style === 'custom');
  stage.classList.toggle('classic-room', home && !tiny && (!p?.tvModel || p.tvModel === 'original'));
  art.style.removeProperty('transform');
  const base = getComputedStyle(art).transform, b = room.getBoundingClientRect(), a = art.getBoundingClientRect();
  const camera = p?.camera, tv = p?.tv, zoom = camera?.zoom ?? 1;
  const dx = b.width * ((camera?.x ?? 0) + (tv?.x ?? 0) * zoom) / 100;
  const dy = b.height * ((camera?.y ?? 0) + (tv?.y ?? 0) * zoom) / 100;
  if (p) art.style.transform = `translate(${dx}px,${dy}px) ${base === 'none' ? '' : base} scale(${zoom * (tv?.zoom ?? 1)})`;
  const custom = p?.style === 'custom' && Boolean(p.background), image = backdrop.querySelector<HTMLImageElement>('img')!;
  const original = home && !custom && !p?.environment;
  Object.assign(backdrop.style, { left: `${original ? a.left - b.left : 0}px`, top: `${original ? a.top - b.top : 0}px`,
    width: `${original ? a.width : b.width}px`, height: `${original ? a.height : b.height}px`,
    transform: `translate(${b.width * (camera?.x ?? 0) / 100}px,${b.height * (camera?.y ?? 0) / 100}px) scale(${zoom})` });
  image.hidden = !home && !custom; image.style.filter = '';
  const orientation = innerHeight > innerWidth && innerHeight >= 430 ? 'portrait' : 'wide';
  const daytime = mood?.daytime ?? 'night';
  let src = daytime === 'night' ? `/crt-room-plate-${orientation}.webp` : `/crt-room-${daytime}-${orientation}.webp`;
  if (p?.environment) src = `/rooms/${p.environment}-${orientation}.webp`;
  if (custom) {
    const ticket = new URLSearchParams(location.search).get('ticket');
    const url = new URL(`/api/decorations/assets/${encodeURIComponent(p!.background!)}`, location.origin);
    if (ticket) url.searchParams.set('ticket', ticket); src = url.pathname + url.search;
  }
  if (!image.hidden && image.getAttribute('src') !== src) image.src = src;
  image.style.objectFit = custom || p?.environment ? 'cover' : 'fill';
  applyScreenFraming();
  if (home && !tiny) {
    const s = getComputedStyle(face), n = (key: string) => parseFloat(s.getPropertyValue('--' + key)) * 10;
    const glass = document.querySelector<HTMLElement>('#homeScreenMount')!;
    const body = `<rect x="${n('tv-body-x')}" y="${n('tv-body-y')}" width="${n('tv-body-w')}" height="${n('tv-body-h')}" rx="8" fill="white"/>`;
    const feet = `<rect x="${n('tv-feet-x')}" y="${n('tv-feet-y')}" width="${n('tv-feet-w')}" height="${n('tv-feet-h')}" fill="white"/>`;
    const aperture = `<rect x="${glass.offsetLeft / face.offsetWidth * 1000}" y="${glass.offsetTop / face.offsetHeight * 1000}" width="${glass.offsetWidth / face.offsetWidth * 1000}" height="${glass.offsetHeight / face.offsetHeight * 1000}" rx="12" fill="black"/>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" preserveAspectRatio="none"><defs><mask id="shape">${body}${feet}${aperture}</mask></defs><rect width="1000" height="1000" fill="white" mask="url(#shape)"/></svg>`;
    face.style.setProperty('--detached-mask', `url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
  }
  applyVideoFraming();
  window.dispatchEvent(new Event('shis-presentation-change'));
}
function configureTvModel(face: HTMLElement, p: Presentation | undefined, tiny: boolean) {
  for (const key of ['room-art', 'glass-x', 'glass-y', 'glass-w', 'glass-h', 'model-left', 'model-top']) face.style.removeProperty('--' + key);
  const model = tiny ? 'original' : p?.tvModel ?? 'original';
  face.dataset.tvModel = model;
  if (model === 'original') return;
  const style = getComputedStyle(face), n = (key: string) => parseFloat(style.getPropertyValue('--tv-body-' + key));
  const four = document.querySelector('#tvScene')!.classList.contains('aspect-4x3');
  const file = model === 'silver' ? four ? 'tv-slate-4x3.webp' : 'tv-slate-room.webp' : four ? 'tv-charcoal-4x3.webp' : 'tv-charcoal-wide.webp';
  const glass = four ? { x: 11.3, y: 7, w: 78, h: 76 } : { x: 8.5, y: 6, w: 83, h: 78 };
  face.style.setProperty('--room-art', `url('/${file}')`);
  face.style.setProperty('--model-left', `${face.offsetWidth * n('x') / 100}px`);
  face.style.setProperty('--model-top', `${face.offsetHeight * n('y') / 100}px`);
  face.style.setProperty('--glass-x', `${n('x') + n('w') * glass.x / 100}%`);
  face.style.setProperty('--glass-y', `${n('y') + n('h') * glass.y / 100}%`);
  face.style.setProperty('--glass-w', `${n('w') * glass.w / 100}%`);
  face.style.setProperty('--glass-h', `${n('h') * glass.h / 100}%`);
}
function applyScreenFraming() {
  const stage = document.querySelector('#stage')!, screen = document.querySelector<HTMLElement>(stage.classList.contains('home-mode') ? '#homeScreenMount' : '#arcadeScreen')!;
  for (const key of ['left', 'top', 'width', 'height', 'transform']) screen.style.removeProperty(key);
  const s = getComputedStyle(screen), transform = new DOMMatrix(s.transform === 'none' ? undefined : s.transform);
  screenBase = { x: parseFloat(s.left) + transform.e, y: parseFloat(s.top) + transform.f, width: parseFloat(s.width), height: parseFloat(s.height) };
  if (!current?.screen) return;
  const r = screenRect(screenBase, current.screen);
  Object.assign(screen.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.width}px`, height: `${r.height}px`, transform: 'none' });
}
export function applyVideoFraming() {
  const container = document.querySelector<HTMLElement>('#videoMount')!;
  const glass = container.closest<HTMLElement>('.screen-wrap, .arcade-screen')!;
  const video = container.querySelector<HTMLVideoElement>('video'); if (!video) return;
  if (!current?.video) { video.style.removeProperty('transform'); video.style.removeProperty('object-position'); return; }
  const z = current.video.zoom ?? 1.035;
  const style = getComputedStyle(glass), sw = parseFloat(style.width), sh = parseFloat(style.height);
  const contain = getComputedStyle(video).objectFit === 'contain';
  const nativeScale = video.videoWidth ? (contain ? Math.min : Math.max)(sw / video.videoWidth, sh / video.videoHeight) : 1;
  const overflowX = contain ? Math.max(0, video.videoWidth * nativeScale * z - sw) : sw * (z - 1), overflowY = contain ? Math.max(0, video.videoHeight * nativeScale * z - sh) : sh * (z - 1);
  video.style.objectPosition = contain ? '50% 50%' : `${50 - (current.video.x ?? 0)}% ${50 - (current.video.y ?? 0)}%`;
  video.style.transform = `translate(${overflowX * (current.video.x ?? 0) / 100}px,${overflowY * (current.video.y ?? 0) / 100}px) scale(${z})`;
}
export function initVideoFraming() {
  const mount = document.querySelector('#videoMount')!;
  new MutationObserver(applyVideoFraming).observe(mount, { childList: true });
  mount.addEventListener('loadedmetadata', applyVideoFraming, true);
}
