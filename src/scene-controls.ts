import { applyPresentation } from './scene-presentation';
import type { Presentation } from './presentation-model';
export function sceneControls(layer: HTMLElement, presentation: Presentation, kind: 'tv' | 'camera' | 'screen', update: () => void, suspended: () => boolean) {
  const element = document.createElement('div'); element.className = 'scene-edit-outline'; element.dataset.camera = String(kind === 'camera'); element.dataset.screen = String(kind === 'screen');
  const handle = document.createElement('span'); handle.className = 'scene-edit-resize'; handle.title = 'Cambiar tamaño'; element.append(handle); layer.append(element);
  const place = () => {
    const room = layer.getBoundingClientRect();
    if (kind === 'camera') { Object.assign(element.style, { left: '12px', top: '12px', width: `${room.width - 24}px`, height: `${room.height - 24}px` }); return; }
    if (kind === 'screen') { const glass = document.querySelector<HTMLElement>(document.querySelector('#stage')!.classList.contains('home-mode') ? '#homeScreenMount' : '#arcadeScreen')!.getBoundingClientRect(); Object.assign(element.style, { left: `${glass.left - room.left}px`, top: `${glass.top - room.top}px`, width: `${glass.width}px`, height: `${glass.height}px` }); return; }
    const home = document.querySelector('#stage')!.classList.contains('home-mode');
    const face = document.querySelector<HTMLElement>(home ? '.tv-face' : '#arcadeScene')!, art = face.getBoundingClientRect(), style = getComputedStyle(face);
    const value = (key: string, fallback: number) => parseFloat(style.getPropertyValue('--tv-body-' + key)) / 100 || fallback;
    Object.assign(element.style, { left: `${art.left - room.left + (home ? art.width * value('x', 0) : 0)}px`, top: `${art.top - room.top + (home ? art.height * value('y', 0) : 0)}px`,
      width: `${art.width * (home ? value('w', 1) : 1)}px`, height: `${art.height * (home ? value('h', 1) : 1)}px` });
  };
  const emit = () => parent.postMessage({ type: 'presentation-change', kind, framing: presentation[kind], support: presentation.tvSupport }, location.origin);
  element.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !event.isPrimary || suspended()) return; event.preventDefault(); event.stopPropagation(); element.setPointerCapture(event.pointerId);
    parent.postMessage({ type: 'decor-gesture-start' }, location.origin);
    const origin = { ...(kind === 'screen' ? undefined : presentation[kind]) }, start = { x: event.clientX, y: event.clientY }, resize = event.target === handle;
    const room = layer.getBoundingClientRect(), camera = kind === 'tv' ? presentation.camera?.zoom ?? 1 : 1;
    const screen = document.querySelector<HTMLElement>(document.querySelector('#stage')!.classList.contains('home-mode') ? '#homeScreenMount' : '#arcadeScreen')!.getBoundingClientRect();
    const originScreen = { ...presentation.screen }, baseWidth = screen.width / ((originScreen.width ?? 100) / 100), baseHeight = screen.height / ((originScreen.height ?? 100) / 100);
    const move = (e: PointerEvent) => {
      if (suspended()) return;
      if (kind === 'tv') presentation.tvSupport = 'free';
      if (kind === 'screen') { const p = presentation.screen ??= {}; if (resize) { p.width = Math.min(150, Math.max(50, (originScreen.width ?? 100) + (e.clientX - start.x) / baseWidth * 100)); p.height = Math.min(150, Math.max(50, (originScreen.height ?? 100) + (e.clientY - start.y) / baseHeight * 100)); } else { p.x = Math.min(50, Math.max(-50, (originScreen.x ?? 0) + (e.clientX - start.x) / baseWidth * 100)); p.y = Math.min(50, Math.max(-50, (originScreen.y ?? 0) + (e.clientY - start.y) / baseHeight * 100)); } }
      else { const p = presentation[kind] ??= {};
      if (resize) p.zoom = Math.min(2.5, Math.max(kind === 'tv' ? .3 : .5, (origin.zoom ?? 1) * Math.exp((e.clientX - start.x + e.clientY - start.y) / 300)));
      else { const limit = kind === 'tv' ? 80 : 50;
        p.x = Math.min(limit, Math.max(-limit, (origin.x ?? 0) + (e.clientX - start.x) / (room.width * camera) * 100));
        p.y = Math.min(limit, Math.max(-limit, (origin.y ?? 0) + (e.clientY - start.y) / (room.height * camera) * 100)); } }
      void applyPresentation(presentation); update(); place(); emit();
    };
    const end = () => { element.removeEventListener('pointermove', move); element.removeEventListener('pointerup', end); element.removeEventListener('pointercancel', end); element.removeEventListener('lostpointercapture', end); parent.postMessage({ type: 'decor-gesture-end' }, location.origin); };
    element.addEventListener('pointermove', move); element.addEventListener('pointerup', end); element.addEventListener('pointercancel', end); element.addEventListener('lostpointercapture', end);
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  element.addEventListener('wheel', event => {
    if (event.ctrlKey || event.metaKey) return; event.preventDefault(); event.stopPropagation();
    if (kind === 'screen') { const p = presentation.screen ??= {}, factor = Math.exp(-event.deltaY * .002); p.width = Math.min(150, Math.max(50, (p.width ?? 100) * factor)); p.height = Math.min(150, Math.max(50, (p.height ?? 100) * factor)); }
    else { const p = presentation[kind] ??= {}; p.zoom = Math.min(2.5, Math.max(kind === 'tv' ? .3 : .5, (p.zoom ?? 1) * Math.exp(-event.deltaY * .002))); }
    void applyPresentation(presentation); update(); place(); emit(); clearTimeout(timer); timer = setTimeout(() => parent.postMessage({ type: 'decor-gesture-end' }, location.origin), 220);
  }, { passive: false }); place();
}
