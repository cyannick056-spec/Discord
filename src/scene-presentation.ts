import { freeRoom, type Presentation } from './presentation-model';
import { gradeFilter, type Mood } from './studio-model';
let current: Presentation | undefined;
export function getPresentation() { return current; }
export function applyPresentation(p: Presentation | undefined, mood?: Mood) {
  current = p;
  const stage = document.querySelector<HTMLElement>('#stage')!, room = document.querySelector<HTMLElement>('.room-scene')!;
  const home = stage.classList.contains('home-mode'), face = document.querySelector<HTMLElement>('.tv-face')!;
  const art = document.querySelector<HTMLElement>(home ? '#tvScene' : '#arcadeScene')!;
  const backdrop = document.querySelector<HTMLElement>('#roomBackdrop')!;
  const tiny = innerWidth <= 520 && innerHeight <= 360;
  stage.classList.toggle('free-room', freeRoom(p));
  stage.classList.toggle('classic-room', p?.style === 'classic' && !tiny);
  // Reset to the responsive CSS baseline before measuring its transform.
  art.style.removeProperty('transform');
  if (p) {
    const base = getComputedStyle(art).transform;
    const b = room.getBoundingClientRect(), camera = p.camera, tv = p.tv, zoom = camera?.zoom ?? 1;
    const dx = b.width * ((camera?.x ?? 0) + (tv?.x ?? 0) * zoom) / 100;
    const dy = b.height * ((camera?.y ?? 0) + (tv?.y ?? 0) * zoom) / 100;
    art.style.transform = `translate(${dx}px,${dy}px) ${base === 'none' ? '' : base} scale(${zoom * (tv?.zoom ?? 1)})`;
    backdrop.style.transform = `translate(${b.width * (camera?.x ?? 0) / 100}px,${b.height * (camera?.y ?? 0) / 100}px) scale(${zoom})`;
  } else backdrop.style.transform = '';
  if (home && freeRoom(p) && !tiny) {
    const s = getComputedStyle(face), n = (key: string) => parseFloat(s.getPropertyValue('--' + key)) * 10;
    const body = `<rect x="${n('tv-body-x')}" y="${n('tv-body-y')}" width="${n('tv-body-w')}" height="${n('tv-body-h')}" rx="8" fill="white"/>`;
    const feet = `<rect x="${n('tv-feet-x')}" y="${n('tv-feet-y')}" width="${n('tv-feet-w')}" height="${n('tv-feet-h')}" fill="white"/>`;
    const glass = `<rect x="${n('glass-x')}" y="${n('glass-y')}" width="${n('glass-w')}" height="${n('glass-h')}" rx="12" fill="black"/>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" preserveAspectRatio="none"><defs><mask id="shape">${body}${feet}${glass}</mask></defs><rect width="1000" height="1000" fill="white" mask="url(#shape)"/></svg>`;
    face.style.setProperty('--detached-mask', `url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
  }
  const wall = backdrop.querySelector<HTMLElement>('.studio-wall')!, cabinet = backdrop.querySelector<HTMLElement>('.studio-cabinet')!, floor = backdrop.querySelector<HTMLElement>('.studio-floor')!;
  backdrop.dataset.texture = p?.style ?? 'original';
  const cabinetY = p?.cabinetY ?? (innerHeight > innerWidth ? 44 : 86), height = p?.cabinetHeight ?? 22;
  backdrop.style.setProperty('--cabinet-y', `${cabinetY}%`); backdrop.style.setProperty('--floor-y', `${Math.min(98, cabinetY + height)}%`);
  backdrop.style.setProperty('--wall-color', p?.wall ?? '#33404e'); backdrop.style.setProperty('--cabinet-color', p?.cabinet ?? '#4b352a'); backdrop.style.setProperty('--floor-color', p?.floor ?? '#262c35');
  cabinet.hidden = Boolean(p?.hideCabinet) || p?.style === 'custom'; floor.hidden = p?.style === 'custom';
  wall.style.filter = gradeFilter(mood, 'wall'); cabinet.style.filter = gradeFilter(mood, 'cabinet'); floor.style.filter = gradeFilter(mood, 'floor');
  const image = backdrop.querySelector<HTMLImageElement>('img')!;
  image.hidden = p?.style !== 'custom' || !p.background;
  if (p?.background && !image.hidden) {
    const ticket = new URLSearchParams(location.search).get('ticket');
    const url = new URL(`/api/decorations/assets/${encodeURIComponent(p.background)}`, location.origin);
    if (ticket) url.searchParams.set('ticket', ticket);
    if (image.getAttribute('src') !== url.pathname + url.search) image.src = url.pathname + url.search;
    image.style.filter = gradeFilter(mood, 'wall');
  }
  applyVideoFraming();
  window.dispatchEvent(new Event('shis-presentation-change'));
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
