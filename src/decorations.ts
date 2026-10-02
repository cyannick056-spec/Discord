import { viewPresentation, viewMood, removeFromView, duplicateInView, saveView } from './view-state';
import { MAX_SCENE_ITEMS, MAX_LIBRARY_ITEMS, type FurnitureMaterial } from '../material-catalog.mjs';
import { applyFurnitureMaterial } from './furniture-material';
import { setDecorationLights, setRoomAmbient, setRoomMood, setTestLight, type DecorationLight, type RoomMood } from './lighting';
import { objectTransform, gradeFilter, type Transform, type ContactShadow } from './studio-model';
import { initStudio, refreshStudio, shapeAsset, rememberAssets } from './studio';
import { clearLampAnimation, addLampAnimation } from './lamp-animation';
import { applyTvSupport } from './scene-presentation';
import { applyPresentation, initVideoFraming } from './scene-presentation';
import { cameraRect, type Presentation } from './presentation-model';
import { sceneControls } from './scene-controls';
import { straightCorners, validCorners } from './perspective';
import { maskBehindTv } from './occlusion';
import { EditorHistory } from './editor-history';
import { builtinUrl, visibleInRoom, props } from '../room-catalog.mjs';
import { restOnSurface } from './resting-placement';
import { applyPhotoLight } from './room-geometry';

type Scene = 'home' | 'arcade';
type View = 'landscape' | 'portrait' | 'window';
type Aspect = '16:9' | '4:3';
export type PlacementKey = `${Scene}-${View}` | `home-${View}-16x9` | `home-${View}-4x3`;
type SlotColor = 'red' | 'blue' | 'green' | 'yellow' | 'black';
type Viewer = { id: string; name: string; avatar: string };
const slotColors: { id: SlotColor; name: string }[] = [
  { id: 'red', name: 'Rojo' },
  { id: 'blue', name: 'Azul' },
  { id: 'green', name: 'Verde' },
  { id: 'yellow', name: 'Amarillo' },
  { id: 'black', name: 'Negro' },
];
export type Placement = {
  x: number; y: number; width: number; rotation: number; opacity: number; z: number; hidden: boolean;
  foreground?: boolean; anchor?: 'scene' | 'frame';
  behindTv?: boolean; locked?: boolean;
  brightness?: number; saturation?: number; hue?: number; shadow?: number;
  transform?: Transform; contactShadow?: ContactShadow; crop?: number[];
  light?: Omit<DecorationLight, 'id'>;
  lava?: { motion?: boolean; speed?: number };
  material?: FurnitureMaterial;
};
export type Decoration = {
  id: string; asset: string; name: string; kind?: 'viewer-slot' | 'light' | 'shape' | 'builtin';
  roomKit?: string;
  shape?: string; category?: string; favorite?: boolean; group?: string;
  placements: Partial<Record<PlacementKey, Placement>>;
};
export type RoomSnapshot = { items: Decoration[]; ambient?: number; mood?: RoomMood; presentations?: Partial<Record<PlacementKey, Presentation>> };
export type Manifest = RoomSnapshot & { library?: Omit<Decoration, 'placements'>[];
  profiles?: { id: string; name: string; room: RoomSnapshot }[];
  versions?: { id: string; name: string; room: RoomSnapshot }[] };

const previewMode = new URLSearchParams(location.search).has('editorPreview');
const activityTicket = new URLSearchParams(location.search).get('ticket') || '';
function authorizedUrl(path: string) {
  const url = new URL(path, location.origin);
  if (activityTicket) url.searchParams.set('ticket', activityTicket);
  return `${url.pathname}${url.search}`;
}
const layer = document.querySelector<HTMLDivElement>('#decorationLayer')!;
const stage = document.querySelector<HTMLElement>('#stage')!;
const editor = document.querySelector<HTMLElement>('#decorEditor')!;
const editorButton = document.querySelector<HTMLButtonElement>('#editorButton')!;
const editorClose = document.querySelector<HTMLButtonElement>('#editorClose')!;
const editorAuth = document.querySelector<HTMLDivElement>('#editorAuth')!;
const editorWorkspace = document.querySelector<HTMLDivElement>('#editorWorkspace')!;
const editorKey = document.querySelector<HTMLInputElement>('#editorKey')!;
const editorUnlock = document.querySelector<HTMLButtonElement>('#editorUnlock')!;
const editorScene = document.querySelector<HTMLSelectElement>('#editorScene')!;
const editorView = document.querySelector<HTMLSelectElement>('#editorView')!;
const editorAspect = document.querySelector<HTMLSelectElement>('#editorAspect')!;
const editorAspectLabel = document.querySelector<HTMLLabelElement>('#editorAspectLabel')!;
const editorUpload = document.querySelector<HTMLInputElement>('#editorUpload')!;
const editorItem = document.querySelector<HTMLSelectElement>('#editorItem')!;
const editorProperties = document.querySelector<HTMLDivElement>('#editorProperties')!;
const previewFrame = document.querySelector<HTMLDivElement>('#previewFrame')!;
const preview = document.querySelector<HTMLIFrameElement>('#editorPreview')!;
const zoomOut = document.querySelector<HTMLButtonElement>('#previewZoomOut')!;
const zoomReset = document.querySelector<HTMLButtonElement>('#previewZoomReset')!;
const zoomIn = document.querySelector<HTMLButtonElement>('#previewZoomIn')!;
const editorNudge = document.querySelector<HTMLDivElement>('#editorNudge')!;
const editorStatus = document.querySelector<HTMLSpanElement>('#editorStatus')!;
const editorSave = document.querySelector<HTMLButtonElement>('#editorSave')!;
const decorCopy = document.querySelector<HTMLButtonElement>('#decorCopy')!;
const decorCopyAspect = document.querySelector<HTMLButtonElement>('#decorCopyAspect')!;
const decorRemove = document.querySelector<HTMLButtonElement>('#decorRemove')!;
const inputIds = ['decorX', 'decorY', 'decorWidth', 'decorRotation', 'decorOpacity', 'decorZ'] as const;
const inputs = inputIds.map((id) => document.querySelector<HTMLInputElement>(`#${id}`)!);
const decorAnchor = document.querySelector<HTMLSelectElement>('#decorAnchor')!;
const filterIds = ['decorBrightness', 'decorSaturation', 'decorHue', 'decorShadow'] as const;
const filters = filterIds.map((id) => document.querySelector<HTMLInputElement>(`#${id}`)!);
const filterOutputs = filterIds.map((id) => document.querySelector<HTMLOutputElement>(`#${id}Value`)!);
const decorHidden = document.querySelector<HTMLInputElement>('#decorHidden')!;
const decorForeground = document.querySelector<HTMLInputElement>('#decorForeground')!;
const decorBehindTv = document.querySelector<HTMLInputElement>('#decorBehindTv')!;
const decorBehindTvLabel = document.querySelector<HTMLLabelElement>('#decorBehindTvLabel')!;
const editorAddLight = document.querySelector<HTMLButtonElement>('#editorAddLight')!;
const editorAmbient = document.querySelector<HTMLInputElement>('#editorAmbient')!;
const editorAmbientValue = document.querySelector<HTMLOutputElement>('#editorAmbientValue')!;
const decorEmitLight = document.querySelector<HTMLInputElement>('#decorEmitLight')!;
const decorLightColor = document.querySelector<HTMLInputElement>('#decorLightColor')!;
const decorLightIntensity = document.querySelector<HTMLInputElement>('#decorLightIntensity')!;
const decorLightRadius = document.querySelector<HTMLInputElement>('#decorLightRadius')!;
const decorLightIntensityValue = document.querySelector<HTMLOutputElement>('#decorLightIntensityValue')!;
const decorLightRadiusValue = document.querySelector<HTMLOutputElement>('#decorLightRadiusValue')!;
const decorLightX = document.querySelector<HTMLInputElement>('#decorLightX')!;
const decorLightY = document.querySelector<HTMLInputElement>('#decorLightY')!;
const decorName = document.querySelector<HTMLInputElement>('#decorName')!;
const decorLocked = document.querySelector<HTMLInputElement>('#decorLocked')!;
const editorUndo = document.querySelector<HTMLButtonElement>('#editorUndo')!;
const editorRedo = document.querySelector<HTMLButtonElement>('#editorRedo')!;
const editorDirty = document.querySelector<HTMLElement>('#editorDirty')!;
const editorMenu = document.querySelector<HTMLDivElement>('#editorMenu')!;
const editorMood = document.querySelector<HTMLSelectElement>('#editorMood')!;
const editorMoodIntensity = document.querySelector<HTMLInputElement>('#editorMoodIntensity')!;
const editorTvGlow = document.querySelector<HTMLInputElement>('#editorTvGlow')!;
const editorGrid = document.querySelector<HTMLInputElement>('#editorGrid')!;
const editorSnap = document.querySelector<HTMLInputElement>('#editorSnap')!;
const editorSelectTool = document.querySelector<HTMLButtonElement>('#editorSelectTool')!;
const editorPanTool = document.querySelector<HTMLButtonElement>('#editorPanTool')!;
const editorEnvironment = document.querySelector<HTMLDetailsElement>('#editorEnvironment')!;
const history = new EditorHistory<Manifest>();
type EditorTool = 'select' | 'pan' | 'tv' | 'camera' | 'screen' | 'warp';
let editorTool: EditorTool = 'select';
let previewTool: EditorTool = 'select';
let previewSnap = false;
let previewGrid = false;
let spaceHeld = false;
let previewPanning = false;
let previewLastClick: { id: string; time: number; x: number; y: number } | null = null;
let panStart: { x: number; y: number } | null = null;

let saved: Manifest = { items: [] };
let draft: Manifest = { items: [] };
let selected: string | null = null;
let selection = new Set<string>();
let compareSaved = false;
let previewTest = 'live';
let batchCommand = false;
let editKey = '';
let previewReady = false;
let previewVideoSource: HTMLVideoElement | null = null;
let previewFeed: MediaStream | null = null;
let lastRender: { manifest: Manifest; sceneName: Scene; view: View; editable: boolean } | null = null;
let viewers: Viewer[] = [];
let previewZoom = 1;
let previewPanX = 0;
let previewPanY = 0;
let gestureStart: { zoom: number; targetX: number; targetY: number; x: number; y: number } | null = null;

function currentView(): View {
  if (innerWidth <= 520 && innerHeight <= 360) return 'window';
  return innerHeight > innerWidth ? 'portrait' : 'landscape';
}

function scene(): Scene { return stage.classList.contains('arcade-mode') ? 'arcade' : 'home'; }
function legacyKey(sceneName: Scene, view: View): `${Scene}-${View}` { return `${sceneName}-${view}`; }
function key(sceneName: Scene, view: View, aspect: Aspect): PlacementKey {
  return sceneName === 'home' ? `home-${view}-${aspect === '4:3' ? '4x3' : '16x9'}` : legacyKey(sceneName, view);
}
function currentAspect(): Aspect {
  return document.querySelector('#tvScene')!.classList.contains('aspect-4x3') ? '4:3' : '16:9';
}
function activeKey() { return key(editorScene.value as Scene, editorView.value as View, editorAspect.value as Aspect); }
function placementFor(item: Decoration, sceneName: Scene, view: View, aspect: Aspect): Placement | undefined {
  return item.placements[key(sceneName, view, aspect)] ?? item.placements[legacyKey(sceneName, view)];
}
function clamp(value: number, low: number, high: number) { return Math.min(high, Math.max(low, value)); }
function status(message: string) { editorStatus.textContent = message; }
function selectedItem() { return draft.items.find((item) => item.id === selected); }
function defaultPlacement(): Placement {
  return { x: 50, y: 30, width: 10, rotation: 0, opacity: 1, z: 10, hidden: false,
    anchor: 'frame', brightness: 83, saturation: 82, hue: 0, shadow: 80 };
}
function copyManifest(source: Manifest): Manifest { return structuredClone(source); }

function slotPlacement(sceneName: Scene, view: View, index: number): Placement {
  const positions = [10, 30, 50, 70, 90];
  const portrait = view === 'portrait';
  const arcade = sceneName === 'arcade';
  return { ...defaultPlacement(), x: positions[index],
    y: arcade ? (portrait ? 47 : 88) : (portrait ? 130 : view === 'window' ? 87 : 115),
    width: portrait ? (arcade ? 12 : 13) : view === 'window' ? 9 : 6,
    z: 18 };
}

function ensureViewerSlots(manifest: Manifest) {
  const keys: [Scene, View, Aspect][] = [];
  for (const view of ['landscape', 'portrait', 'window'] as const) {
    keys.push(['home', view, '16:9'], ['home', view, '4:3'], ['arcade', view, '16:9']);
  }
  const slots = slotColors.map((color, index) => {
    const id = `viewer-slot-${color.id}`;
    let item = manifest.items.find((entry) => entry.id === id);
    if (!item) {
      item = { id, asset: '', kind: 'viewer-slot', name: `Espectador ${index + 1} · ${color.name}`, placements: {} };
    }
    for (const [sceneName, view, aspect] of keys) {
      const placementKey = key(sceneName, view, aspect);
      item.placements[placementKey] ??= { ...slotPlacement(sceneName, view, index), ...(sceneName === 'home' && manifest.presentations?.[placementKey]?.environment ? { hidden: true } : {}) };
    }
    return item;
  });
  manifest.items = [...slots, ...manifest.items.filter((item) => item.kind !== 'viewer-slot')];
}

function frameElement(sceneName: Scene, view: View): HTMLElement {
  const selector = sceneName === 'home' ? '.screen-wrap' :
    view === 'portrait' ? '.arcade-scene' : '.arcade-screen';
  return document.querySelector<HTMLElement>(selector)!;
}

function basis(placement: Placement, sceneName: Scene, view: View): DOMRect {
  const frame = frameElement(sceneName, view).getBoundingClientRect();
  return placement.anchor === 'frame' && frame.width && frame.height ?
    frame : sceneBounds(layer, lastRender?.manifest, key(sceneName, view, currentAspect()));
}

function sceneBounds(element: HTMLElement, manifest: RoomSnapshot | undefined, viewKey: PlacementKey) {
  const b = cameraRect(element.getBoundingClientRect(), manifest?.presentations?.[viewKey]);
  return new DOMRect(b.x, b.y, b.width, b.height);
}

function position(box: HTMLDivElement, placement: Placement, sceneName: Scene, view: View) {
  const room = layer.getBoundingClientRect();
  const bounds = basis(placement, sceneName, view);
  box.style.left = `${bounds.left - room.left + bounds.width * placement.x / 100}px`;
  box.style.top = `${bounds.top - room.top + bounds.height * placement.y / 100}px`;
  box.style.width = `${bounds.width * placement.width / 100}px`;
  box.style.opacity = String(placement.opacity);
  box.style.zIndex = String(placement.z + (placement.foreground ? 100 : 0));
  box.style.transform = objectTransform(placement.rotation, placement.transform, placement.x, parseFloat(box.style.width), box.offsetHeight || parseFloat(box.style.width));
}

function ambientFilter(placement: Placement): string {
  const shadow = (placement.shadow ?? 80) / 100;
  return `brightness(${placement.brightness ?? 83}%) saturate(${placement.saturation ?? 82}%) ` +
    `hue-rotate(${placement.hue ?? 0}deg) ` +
    `drop-shadow(0 2px 3px rgba(0,0,0,${(.9 * shadow).toFixed(2)}))`;
}

function render(manifest: Manifest, sceneName: Scene, view: View, editable: boolean) {
  lastRender = { manifest, sceneName, view, editable };
  const presentation = manifest.presentations?.[key(sceneName, view, currentAspect())];
  const roomMood = presentation?.mood ?? manifest.mood;
  applyPresentation(presentation, roomMood);
  clearLampAnimation();
  layer.replaceChildren();
  const behind = document.createElement('div');
  behind.className = 'decorations-behind-tv';
  layer.append(behind);
  if (sceneName === 'home') maskBehindTv(behind, layer, document.querySelector<HTMLElement>('.tv-face')!);
  const lights: DecorationLight[] = [];
  setRoomAmbient(presentation?.ambient ?? manifest.ambient ?? 62);
  setRoomMood(roomMood);
  for (const item of manifest.items) {
    if (!visibleInRoom(item, manifest.presentations?.[key(sceneName, view, currentAspect())])) continue;
    const placement = placementFor(item, sceneName, view, currentAspect());
    if (!placement || placement.hidden) continue;
    const slotIndex = item.kind === 'viewer-slot' ? slotColors.findIndex((color) => item.id === `viewer-slot-${color.id}`) : -1;
    const viewer = slotIndex >= 0 ? viewers[slotIndex] : undefined;
    if (slotIndex >= 0 && !editable && !viewer) continue;
    const box = document.createElement('div');
    box.className = 'decoration-box';
    box.dataset.id = item.id;
    if (item.kind === 'builtin') box.dataset.prop = item.asset;
    if (item.category === 'furniture' && (item.kind !== 'builtin' || props.find(p => p.id === item.asset)?.support)) box.dataset.support = 'true';
    box.classList.toggle('is-locked', placement.locked === true);
    position(box, placement, sceneName, view);
    if (editable && item.id === selected) box.classList.add('is-selected');
    if (slotIndex >= 0) {
      const figure = document.createElement('div');
      figure.className = 'viewer-figure';
      figure.style.filter = `${ambientFilter(placement)} ${gradeFilter(roomMood, 'figures')}`;
      const disc = document.createElement('div');
      disc.className = 'viewer-disc';
      disc.title = viewer?.name ?? `Espacio ${slotIndex + 1} · ${slotColors[slotIndex].name}`;
      if (viewer) {
        const avatar = document.createElement('img');
        avatar.src = viewer.avatar;
        avatar.alt = viewer.name;
        avatar.draggable = false;
        avatar.referrerPolicy = 'no-referrer';
        disc.append(avatar);
      } else disc.textContent = String(slotIndex + 1);
      figure.append(disc);
      box.append(figure);
    } else if (item.kind === 'light') {
      const bulb = document.createElement('div');
      bulb.className = 'decor-light-bulb';
      bulb.style.setProperty('--bulb-color', placement.light?.color ?? '#555555');
      bulb.classList.toggle('is-off', !placement.light || placement.light.intensity === 0 || roomMood?.practicalLights === false);
      bulb.hidden = placement.behindTv === true && !(editable && selection.has(item.id));
      box.append(bulb);
    } else {
      const image = document.createElement('img');
      image.className = 'decoration';
      image.src = item.kind === 'shape' ? shapeAsset(item.shape) : item.kind === 'builtin' ? builtinUrl(item.asset) : authorizedUrl(`/api/decorations/assets/${encodeURIComponent(item.asset)}`);
      image.alt = '';
      image.draggable = false;
      image.style.filter = `${ambientFilter(placement)} ${gradeFilter(roomMood, item.kind === 'builtin' ? item.asset === 'rug' ? 'floor' : item.category === 'furniture' ? 'cabinet' : 'figures' : 'figures')}`;
      image.addEventListener('load', () => { position(box, placement, sceneName, view); syncSupport(); if (sceneName === 'home') void applyPhotoLight(box,image); }, { once: true });
      if (placement.crop) image.style.clipPath = `inset(${placement.crop.map(v => `${v}%`).join(' ')})`;
      box.append(image);
      if (item.category === 'furniture') { if (placement.material) { box.dataset.material = placement.material.preset; box.dataset.roughness = String(placement.material.roughness ?? 65); } void applyFurnitureMaterial(box, image, item.asset, placement.material); }
      if (item.kind === 'builtin' && item.category === 'lamp') addLampAnimation(box, image, placement, item.asset === 'lava-lamp');
    }
    if (placement.contactShadow?.opacity) {
      const shadow = document.createElement('span'); shadow.className = 'decor-contact-shadow';
      const s = placement.contactShadow;
      Object.assign(shadow.style, { opacity: String(s.opacity / 100), width: `${s.width}%`, left: `${50 + s.x}%`,
        top: `${100 + s.y}%`, filter: `blur(${s.blur}px)` }); box.prepend(shadow);
    }
    if (editable && selection.has(item.id)) box.classList.add('is-selected');
    if (editable) {
      for (const [className, label] of [['decor-resize decor-resize-se', 'Cambiar tamaño'], ['decor-resize decor-resize-nw', 'Cambiar tamaño'], ['decor-resize decor-resize-ne', 'Cambiar tamaño'], ['decor-resize decor-resize-sw', 'Cambiar tamaño'], ['decor-rotate', 'Girar']] as const) {
        const handle = document.createElement('span');
        handle.className = `decor-handle ${className}`;
        handle.setAttribute('role', 'presentation');
        handle.title = label;
        box.append(handle);
      }
      attachDrag(box, placement, sceneName, view);
    }
    (sceneName === 'home' && placement.behindTv ? behind : layer).append(box);
    if (editable && item.id === selected) {
      // Keep handles usable even when the TV or another figure hides artwork.
      // Only an outline is drawn in front; the artwork still obeys occlusion.
      const outline = document.createElement('div');
      outline.className = 'decoration-box decor-depth-outline is-selected';
      outline.dataset.id = item.id;
      outline.classList.toggle('is-locked', placement.locked === true);
      position(outline, placement, sceneName, view);
      outline.style.zIndex = '210';
      const sizeOutline = () => { outline.style.height = `${box.offsetHeight}px`; position(outline, placement, sceneName, view); outline.style.zIndex = '210'; };
      box.querySelector('img')?.addEventListener('load', sizeOutline, { once: true });
      for (const className of ['decor-resize decor-resize-se', 'decor-resize decor-resize-nw', 'decor-resize decor-resize-ne', 'decor-resize decor-resize-sw', 'decor-rotate', 'decor-depth-move']) {
        const handle = document.createElement('span');
        handle.className = `decor-handle ${className}`;
        handle.title = className === 'decor-depth-move' ? 'Mover decoración' : className.startsWith('decor-resize') ? 'Cambiar tamaño' : 'Girar';
        outline.append(handle);
      }
      if (previewTool === 'warp') {
        outline.classList.add('warp-active');
        for (let i = 0; i < 4; i++) { const handle = document.createElement('span'); handle.className = 'decor-warp-handle'; handle.dataset.corner = String(i);
          handle.title = `Perspectiva · esquina ${i + 1}`; handle.style.left = `${[0, 100, 100, 0][i]}%`; handle.style.top = `${[0, 0, 100, 100][i]}%`; outline.append(handle); }
      }
      layer.append(outline);
      sizeOutline();
      attachDrag(outline, placement, sceneName, view, box);
    }
    if (placement.light && placement.opacity > 0 && placement.light.intensity > 0) {
      lights.push({ id: item.id, ...placement.light, behindTv:placement.behindTv, intensity: placement.light.intensity * placement.opacity });
    }
  }
  if (editable && previewGrid) {
    const grid = document.createElement('div'); grid.className = 'decor-grid';
    const p = manifest.items.find(item => item.id === selected)?.placements[key(sceneName, view, currentAspect())];
    const bounds = p ? basis(p, sceneName, view) : layer.getBoundingClientRect(), room = layer.getBoundingClientRect();
    Object.assign(grid.style, { left: `${bounds.left - room.left}px`, top: `${bounds.top - room.top}px`, width: `${bounds.width}px`, height: `${bounds.height}px` });
    layer.append(grid);
  }
  const syncSupport = () => { if (sceneName === 'home') { applyTvSupport();
      for (const item of manifest.items) { const p = placementFor(item, sceneName, view, currentAspect()); if (!p || p.anchor !== 'frame') continue; for (const el of layer.querySelectorAll<HTMLDivElement>('.decoration-box')) if (el.dataset.id === item.id) position(el, p, sceneName, view); }
      maskBehindTv(behind, layer, document.querySelector<HTMLElement>('.tv-face')!); } };
  syncSupport();
  setDecorationLights(lights);
  if (editable && (previewTool === 'tv' || previewTool === 'camera' || previewTool === 'screen') && view !== 'window') {
    const p = (manifest.presentations ??= {})[key(sceneName, view, currentAspect())] ??= {};
    sceneControls(layer, p, roomMood, previewTool, () => {
      for (const item of manifest.items) { const placement = placementFor(item, sceneName, view, currentAspect()); if (!placement) continue;
        for (const el of layer.querySelectorAll<HTMLDivElement>('.decoration-box')) if (el.dataset.id === item.id) position(el, placement, sceneName, view); }
      syncSupport();
    }, () => previewPinching);
  }
}

function attachDrag(box: HTMLDivElement, placement: Placement, sceneName: Scene, view: View, linkedBox?: HTMLDivElement) {
  box.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || previewPanning || spaceHeld || !['select', 'warp'].includes(previewTool) || previewPinching) return;
    event.preventDefault();
    const click = { id: box.dataset.id!, time: performance.now(), x: event.clientX, y: event.clientY };
    if (event.pointerType === 'mouse' && previewLastClick && previewLastClick.id === click.id && click.time - previewLastClick.time < 350 &&
        Math.hypot(click.x - previewLastClick.x, click.y - previewLastClick.y) < 6) {
      previewLastClick = null; parent.postMessage({ type: 'decor-rename', id: click.id }, location.origin); return;
    }
    previewLastClick = click;
    const target = event.target as HTMLElement;
    const action = target.closest('.decor-warp-handle') ? 'warp' : target.closest('.decor-resize') ? 'resize' :
      target.closest('.decor-rotate') ? 'rotate' : 'move';
    const bounds = basis(placement, sceneName, view);
    const center = box.getBoundingClientRect();
    const cx = center.left + center.width / 2;
    const cy = center.top + center.height / 2;
    const startAngle = Math.atan2(event.clientY - cy, event.clientX - cx);
    const origin = { x: event.clientX, y: event.clientY, left: placement.x,
      top: placement.y, width: placement.width, rotation: placement.rotation };
    const cornerIndex = Number(target.closest<HTMLElement>('.decor-warp-handle')?.dataset.corner ?? 0), corners = structuredClone(placement.transform?.corners ?? straightCorners());
    let unproject = (_x: number, _y: number) => [0, 0];
    if (action === 'warp') {
      const existing = box.style.transform, w = box.offsetWidth, h = box.offsetHeight;
      box.style.transform = objectTransform(placement.rotation, { ...placement.transform, corners: undefined }, placement.x, w, h);
      const m = new DOMMatrix(getComputedStyle(box).transform); box.style.transform = existing;
      const room = layer.getBoundingClientRect(), ox = room.left + parseFloat(box.style.left) + w / 2, oy = room.top + parseFloat(box.style.top) + h / 2;
      unproject = (x, y) => { const u = x - ox, v = y - oy, a = m.m11 - u * m.m14, b = m.m21 - u * m.m24, c = m.m12 - v * m.m14, d = m.m22 - v * m.m24;
        const e = u * m.m44 - m.m41, f = v * m.m44 - m.m42, det = a * d - b * c;
        return Math.abs(det) < 1e-8 ? [NaN, NaN] : [((e * d - b * f) / det / w + .5) * 100, ((a * f - e * c) / det / h + .5) * 100]; };
    }
    const warpStart = unproject(event.clientX, event.clientY);
    const clickedItem = lastRender?.manifest.items.find(i => i.id === box.dataset.id);
    const peerIds = new Set(selection.has(box.dataset.id!) || event.shiftKey || event.ctrlKey || event.metaKey ? selection : []);
    if (clickedItem?.group && !event.altKey) lastRender?.manifest.items.filter(i => i.group === clickedItem.group).forEach(i => peerIds.add(i.id));
    const peers = (lastRender?.manifest.items ?? []).filter(i => i.id !== box.dataset.id && peerIds.has(i.id)).flatMap(i => {
      const p = placementFor(i, sceneName, view, currentAspect());
      if (!p || p.locked) return [];
      return [{ id: i.id, p, origin: structuredClone(p), bounds: basis(p, sceneName, view) }];
    });
    layer.querySelectorAll('.is-selected').forEach((element) => element.classList.remove('is-selected'));
    box.classList.add('is-selected');
    parent.postMessage({ type: 'decor-select', id: box.dataset.id, additive: event.shiftKey || event.ctrlKey || event.metaKey, individual: event.altKey }, location.origin);
    if (placement.locked) return;
    box.setPointerCapture(event.pointerId);
    parent.postMessage({ type: 'decor-gesture-start' }, location.origin);
    const move = (e: PointerEvent) => {
      if (previewPinching) return;
      const dx = e.clientX - origin.x;
      const dy = e.clientY - origin.y;
      if (Math.hypot(dx, dy) > 4) previewLastClick = null;
      const fine = e.shiftKey ? .2 : 1;
      if (action === 'warp') {
        const point = unproject(e.clientX, e.clientY), next = structuredClone(corners);
        next[cornerIndex] = point.map((v, i) => Math.round(clamp(corners[cornerIndex][i] + v - warpStart[i], -60, 160) * 10) / 10);
        if (!validCorners(next)) return; (placement.transform ??= {}).corners = next;
      } else if (action === 'move') {
        const step = previewSnap && !e.shiftKey ? 5 : .1;
        placement.x = clamp(Math.round((origin.left + dx / bounds.width * 100 * fine) / step) * step, -30, 130);
        placement.y = clamp(Math.round((origin.top + dy / bounds.height * 100 * fine) / step) * step, -35, 145);
      } else if (action === 'resize') {
        const angle = origin.rotation * Math.PI / 180;
        const localDx = dx * Math.cos(angle) + dy * Math.sin(angle);
        const localDy = -dx * Math.sin(angle) + dy * Math.cos(angle);
        const signX = target.closest('.decor-resize-nw, .decor-resize-sw') ? -1 : 1;
        const signY = target.closest('.decor-resize-nw, .decor-resize-ne') ? -1 : 1;
        const vertical = localDy * signY * box.offsetWidth / Math.max(box.offsetHeight, 1);
        const horizontal = localDx * signX;
        const delta = Math.abs(horizontal) >= Math.abs(vertical) ? horizontal : vertical;
        placement.width = Math.round(clamp(origin.width + delta / bounds.width * 100 * fine, 1, 130) * 10) / 10;
      } else {
        const angle = Math.atan2(e.clientY - cy, e.clientX - cx);
        const delta = (angle - startAngle) * 180 / Math.PI;
        placement.rotation = Math.round(clamp(e.shiftKey ? Math.round((origin.rotation + delta) / 15) * 15 : origin.rotation + delta, -180, 180));
      }
      position(box, placement, sceneName, view);
      if (linkedBox) {
        position(linkedBox, placement, sceneName, view);
        box.style.height = `${linkedBox.offsetHeight}px`;
      }
      for (const peer of peers) {
        peer.p.x = clamp(peer.origin.x + (placement.x - origin.left) * bounds.width / peer.bounds.width, -30, 130);
        peer.p.y = clamp(peer.origin.y + (placement.y - origin.top) * bounds.height / peer.bounds.height, -35, 145);
        peer.p.width = clamp(peer.origin.width * placement.width / origin.width, 1, 130);
        peer.p.rotation = clamp(peer.origin.rotation + placement.rotation - origin.rotation, -180, 180);
        for (const element of layer.querySelectorAll<HTMLDivElement>('.decoration-box')) if (element.dataset.id === peer.id) position(element, peer.p, sceneName, view);
      }
      parent.postMessage({ type: 'decor-change', id: box.dataset.id,
        x: placement.x, y: placement.y, width: placement.width, rotation: placement.rotation, corners: action === 'warp' ? placement.transform?.corners : undefined }, location.origin);
    };
    const end = () => {
      box.removeEventListener('pointermove', move);
      box.removeEventListener('pointerup', end);
      box.removeEventListener('pointercancel', end);
      box.removeEventListener('lostpointercapture', end);
      parent.postMessage({ type: 'decor-gesture-end' }, location.origin);
    };
    box.addEventListener('pointermove', move);
    box.addEventListener('pointerup', end);
    box.addEventListener('pointercancel', end);
    box.addEventListener('lostpointercapture', end);
  });
  box.addEventListener('dblclick', (event) => {
    if (previewTool === 'pan') return;
    event.preventDefault(); parent.postMessage({ type: 'decor-rename', id: box.dataset.id }, location.origin);
  });
  box.addEventListener('click', () => { if (placement.locked) parent.postMessage({ type: 'decor-gesture-end' }, location.origin); });
  box.addEventListener('contextmenu', (event) => {
    event.preventDefault(); event.stopPropagation();
    parent.postMessage({ type: 'decor-context', id: box.dataset.id, x: event.clientX, y: event.clientY }, location.origin);
  });
  let wheelEnd: ReturnType<typeof setTimeout> | undefined;
  box.addEventListener('wheel', (event) => {
    if (event.ctrlKey || event.metaKey || placement.locked || previewTool === 'pan') return;
    event.preventDefault(); event.stopPropagation();
    if (!wheelEnd) parent.postMessage({ type: 'decor-gesture-start' }, location.origin);
    if (event.altKey) placement.rotation = clamp(placement.rotation + Math.sign(event.deltaY) * (event.shiftKey ? 1 : 5), -180, 180);
    else placement.width = Math.round(clamp(placement.width * Math.exp(-event.deltaY * (event.shiftKey ? .0005 : .002)), 1, 130) * 10) / 10;
    position(box, placement, sceneName, view);
    if (linkedBox) { position(linkedBox, placement, sceneName, view); box.style.height = `${linkedBox.offsetHeight}px`; }
    parent.postMessage({ type: 'decor-change', id: box.dataset.id, x: placement.x, y: placement.y,
      width: placement.width, rotation: placement.rotation }, location.origin);
    clearTimeout(wheelEnd); wheelEnd = setTimeout(() => { wheelEnd = undefined;
      parent.postMessage({ type: 'decor-gesture-end' }, location.origin); }, 220);
  }, { passive: false });
}

let previewPinching = false;
function initPreviewGestures() {
  stage.tabIndex = 0;
  let panOrigin: { x: number; y: number } | null = null;
  let pointerOnDecoration = false, pointerMoved = false;
  let pointerOrigin = { x: 0, y: 0 };
  stage.addEventListener('pointerdown', event => {
    pointerOnDecoration = Boolean((event.target as HTMLElement).closest('.decoration-box'));
    pointerMoved = false; pointerOrigin = { x: event.clientX, y: event.clientY };
    stage.focus({ preventScroll: true });
    if (previewPinching || !(event.button === 1 || (event.button === 0 && (spaceHeld || previewTool === 'pan')))) return;
    event.preventDefault(); event.stopPropagation();
    previewPanning = true; panOrigin = { x: event.screenX, y: event.screenY };
    stage.classList.add('is-panning'); stage.setPointerCapture(event.pointerId);
    parent.postMessage({ type: 'decor-pan-start' }, location.origin);
  }, true);
  stage.addEventListener('pointermove', event => {
    if (Math.hypot(event.clientX - pointerOrigin.x, event.clientY - pointerOrigin.y) > 4) pointerMoved = true;
    if (!previewPanning || !panOrigin) return;
    event.preventDefault(); parent.postMessage({ type: 'decor-pan-move', dx: event.screenX - panOrigin.x, dy: event.screenY - panOrigin.y }, location.origin);
  }, true);
  const finishPan = () => { previewPanning = false; panOrigin = null; stage.classList.remove('is-panning'); };
  stage.addEventListener('pointerup', finishPan);
  stage.addEventListener('pointercancel', finishPan);
  stage.addEventListener('lostpointercapture', finishPan);
  stage.addEventListener('click', event => {
    if (previewTool !== 'select' || spaceHeld || pointerOnDecoration || pointerMoved || (event.target as HTMLElement).closest('.decoration-box')) return;
    parent.postMessage({ type: 'decor-select', id: null }, location.origin);
    parent.postMessage({ type: 'decor-gesture-end' }, location.origin);
  });
  window.addEventListener('keydown', event => {
    if (event.code === 'Space') { event.preventDefault(); spaceHeld = true; stage.classList.add('pan-tool'); return; }
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Delete', 'Backspace', 'Escape', '[', ']'].includes(event.key) ||
        ((event.ctrlKey || event.metaKey) && ['z', 'y', 'd', 's'].includes(event.key.toLowerCase())) || ['l', 'h'].includes(event.key.toLowerCase())) {
      event.preventDefault(); parent.postMessage({ type: 'decor-shortcut', key: event.key, ctrlKey: event.ctrlKey || event.metaKey,
        shiftKey: event.shiftKey, altKey: event.altKey }, location.origin);
    }
  });
  window.addEventListener('keyup', event => { if (event.code === 'Space') { spaceHeld = false; stage.classList.toggle('pan-tool', previewTool === 'pan'); }
    if (event.key.startsWith('Arrow')) parent.postMessage({ type: 'decor-key-end' }, location.origin); });
  window.addEventListener('blur', () => { spaceHeld = false; finishPan(); stage.classList.toggle('pan-tool', previewTool === 'pan'); });
  let start: { distance: number; midX: number; midY: number } | null = null;
  const midpoint = (touches: TouchList) => ({
    x: (touches[0].screenX + touches[1].screenX) / 2,
    y: (touches[0].screenY + touches[1].screenY) / 2,
    distance: Math.hypot(touches[0].screenX - touches[1].screenX, touches[0].screenY - touches[1].screenY),
  });
  stage.addEventListener('touchstart', (event) => {
    if (event.touches.length < 2 || start) return;
    event.preventDefault();
    previewPinching = true;
    const point = midpoint(event.touches);
    start = { distance: Math.max(point.distance, 1), midX: point.x, midY: point.y };
    parent.postMessage({ type: 'decor-zoom-start', x: (event.touches[0].clientX + event.touches[1].clientX) / 2,
      y: (event.touches[0].clientY + event.touches[1].clientY) / 2 }, location.origin);
  }, { passive: false, capture: true });
  stage.addEventListener('touchmove', (event) => {
    if (!start || event.touches.length < 2) return;
    event.preventDefault();
    const point = midpoint(event.touches);
    parent.postMessage({ type: 'decor-zoom-move', ratio: point.distance / start.distance,
      dx: point.x - start.midX, dy: point.y - start.midY }, location.origin);
  }, { passive: false, capture: true });
  const end = (event: TouchEvent) => {
    if (event.touches.length > 0) return;
    start = null;
    previewPinching = false;
  };
  stage.addEventListener('touchend', end, true);
  stage.addEventListener('touchcancel', end, true);
  stage.addEventListener('contextmenu', event => event.preventDefault());
  stage.addEventListener('wheel', (event) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    parent.postMessage({ type: 'decor-wheel-zoom', x: event.clientX, y: event.clientY,
      deltaY: event.deltaY }, location.origin);
  }, { passive: false });
}

function updateHistoryButtons() {
  editorUndo.disabled = !history.canUndo; editorRedo.disabled = !history.canRedo;
  editorDirty.textContent = JSON.stringify(draft) === JSON.stringify(saved) ? 'Sin cambios' : 'Cambios sin guardar';
}
function sendPreview(group?: string, record = true) {
  if (record && !batchCommand) history.record(draft, group);
  updateHistoryButtons();
  refreshStudio();
  if (previewReady) preview.contentWindow?.postMessage({ type: 'decor-preview', manifest: compareSaved ? saved : draft, selected: compareSaved ? null : selected,
    selectedIds: compareSaved ? [] : [...selection], testLight: previewTest,
    tool: compareSaved ? 'pan' : editorTool, grid: editorGrid.checked, snap: editorSnap.checked }, location.origin);
}

function setEditorTool(tool: EditorTool) {
  editorTool = tool;
  for (const [id, value] of [['editorSelectTool', 'select'], ['editorPanTool', 'pan'], ['studioTvTool', 'tv'], ['studioCameraTool', 'camera'], ['studioScreenTool', 'screen'], ['studioWarpTool', 'warp']]) document.getElementById(id)?.setAttribute('aria-pressed', String(tool === value));
  sendPreview(undefined, false);
}

function refreshMoodFields() {
  const mood = viewMood(draft, activeKey());
  editorMood.value = mood.preset; editorMoodIntensity.value = String(mood.intensity); editorTvGlow.value = String(mood.tvGlow);
  document.querySelector<HTMLOutputElement>('#editorMoodIntensityValue')!.value = `${mood.intensity}%`;
  document.querySelector<HTMLOutputElement>('#editorTvGlowValue')!.value = `${mood.tvGlow}%`;
  editorMoodIntensity.disabled = mood.preset === 'neutral';
  editorAmbient.value = String(viewPresentation(draft,activeKey()).ambient ?? draft.ambient ?? 62); editorAmbientValue.value = `${editorAmbient.value}%`;
}

function editorCommand(command: string) {
  editorMenu.hidden = true; if (!batchCommand) history.endGroup();
  if (!batchCommand && selection.size > 1 && ['duplicate', 'remove', 'lock', 'hide', 'depth', 'forward', 'backward'].includes(command)) {
    const ids = [...selection], copies: string[] = []; batchCommand = true;
    for (const id of ids) { selected = id; editorCommand(command); if (command === 'duplicate' && selected !== id && selected) copies.push(selected); }
    batchCommand = false; selection = new Set(command === 'duplicate' ? copies : ids.filter(id => draft.items.some(i => i.id === id)));
    selected = [...selection].at(-1) ?? null; refreshItemList(); sendPreview(); return;
  }
  if (command === 'save') { editorSave.click(); return; }
  if (command === 'undo' || command === 'redo') {
    const restored = command === 'undo' ? history.undo() : history.redo();
    if (!restored) return;
    draft = restored; if (!selectedItem()) selected = null;
    selection = new Set([...selection].filter(id => draft.items.some(i => i.id === id)));
    refreshMoodFields(); refreshItemList(); sendPreview(undefined, false);
    status(command === 'undo' ? 'Cambio deshecho.' : 'Cambio rehecho.'); return;
  }
  if (command === 'deselect') { selected = null; selection.clear(); refreshItemList(); sendPreview(); return; }
  const item = selectedItem(), p = item?.placements[activeKey()];
  if (!item || !p) return;
  if (command === 'duplicate') {
    if (item.kind === 'viewer-slot') return status('Los espacios de espectadores son únicos.');
    if (draft.items.filter(i => i.kind !== 'viewer-slot').length >= MAX_SCENE_ITEMS) return status(`Máximo ${MAX_SCENE_ITEMS} piezas; combina muebles e imágenes libremente.`);
    const copy = duplicateInView(item,activeKey()); copy.name = `${item.name.slice(0, 62)} · copia`;
    const placement = copy.placements[activeKey()]!; placement.x = clamp(placement.x + 2, -30, 130); placement.y = clamp(placement.y + 2, -35, 145); placement.locked = false;
    delete copy.group;
    draft.items.push(copy); selected = copy.id; if (!batchCommand) selection = new Set([copy.id]); status('Copia creada. Guarda para compartirla.');
  } else if (command === 'remove') {
    if (item.kind === 'viewer-slot') return;
    rememberAssets();
    removeFromView(item,activeKey()); selection.delete(selected!); selected = null; status('Quitada solo de esta vista. Las demás la conservan; puedes deshacer.');
  } else if (command === 'lock') p.locked = !p.locked;
  else if (command === 'hide') p.hidden = !p.hidden;
  else if (command === 'depth' && editorScene.value === 'home') p.behindTv = !p.behindTv;
  else if (command === 'forward') p.z = clamp(p.z + 1, 0, 99);
  else if (command === 'backward') p.z = clamp(p.z - 1, 0, 99);
  else if (command === 'center') { if (p.locked) return status('Desbloquea la posición antes de moverla.');
    const dx = 50 - p.x, dy = 50 - p.y; p.x = 50; p.y = 50; shiftPeers(p, item.id, dx, dy); }
  else return;
  refreshItemList(); sendPreview();
}

function editorShortcut(event: { key: string; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }) {
  const key = event.key.toLowerCase();
  if (event.ctrlKey) {
    const command = key === 'z' ? (event.shiftKey ? 'redo' : 'undo') : ({ y: 'redo', d: 'duplicate', s: 'save' } as Record<string, string>)[key];
    if (command) editorCommand(command);
    return;
  }
  const command = ({ delete: 'remove', backspace: 'remove', escape: 'deselect', l: 'lock', h: 'hide', '[': 'backward', ']': 'forward' } as Record<string, string>)[key];
  if (command) return editorCommand(command);
  const placement = selectedItem()?.placements[activeKey()];
  if (!placement || placement.locked) return;
  const delta = event.altKey ? .1 : event.shiftKey ? 5 : .5;
  const before = { x: placement.x, y: placement.y };
  if (key === 'arrowleft') placement.x = clamp(placement.x - delta, -30, 130);
  else if (key === 'arrowright') placement.x = clamp(placement.x + delta, -30, 130);
  else if (key === 'arrowup') placement.y = clamp(placement.y - delta, -35, 145);
  else if (key === 'arrowdown') placement.y = clamp(placement.y + delta, -35, 145);
  else return;
  shiftPeers(placement, selected!, placement.x - before.x, placement.y - before.y);
  refreshFields(); sendPreview('nudge');
}

function shiftPeers(source: Placement, id: string, dx: number, dy: number, scale = 1, turn = 0) {
  const doc = preview.contentDocument;
  const nativeBounds = (p: Placement) => doc?.querySelector(p.anchor === 'frame' ? editorScene.value === 'home' ? '.screen-wrap' : editorView.value === 'portrait' ? '.arcade-scene' : '.arcade-screen' : '#decorationLayer')?.getBoundingClientRect();
  const bounds = (p: Placement) => { const b = nativeBounds(p); return b && p.anchor !== 'frame' ? cameraRect(b, draft.presentations?.[activeKey()]) : b; };
  const a = bounds(source);
  for (const item of draft.items.filter(i => selection.has(i.id) && i.id !== id)) {
    const p = item.placements[activeKey()]; if (!p || p.locked) continue;
    const b = bounds(p);
    p.x = clamp(p.x + dx * (a?.width ?? 1) / (b?.width ?? 1), -30, 130);
    p.y = clamp(p.y + dy * (a?.height ?? 1) / (b?.height ?? 1), -35, 145);
    p.width = clamp(p.width * scale, 1, 130); p.rotation = clamp(p.rotation + turn, -180, 180);
  }
}

function convertAnchor(placement: Placement, next: 'frame' | 'scene') {
  const doc = preview.contentDocument;
  const sceneName = editorScene.value as Scene;
  const view = editorView.value as View;
  const sceneElement = doc?.querySelector<HTMLElement>('#decorationLayer');
  const sceneBounds = sceneElement ? cameraRect(sceneElement.getBoundingClientRect(), draft.presentations?.[activeKey()]) : undefined;
  const selector = sceneName === 'home' ? '.screen-wrap' :
    view === 'portrait' ? '.arcade-scene' : '.arcade-screen';
  const frameBounds = doc?.querySelector(selector)?.getBoundingClientRect();
  if (!sceneBounds?.width || !sceneBounds.height || !frameBounds?.width || !frameBounds.height) return false;
  const before = placement.anchor === 'frame' ? frameBounds : sceneBounds;
  const after = next === 'frame' ? frameBounds : sceneBounds;
  const bx = before.x, by = before.y, ax = after.x, ay = after.y;
  const x = (bx + before.width * placement.x / 100 - ax) / after.width * 100;
  const y = (by + before.height * placement.y / 100 - ay) / after.height * 100;
  const width = before.width * placement.width / after.width;
  placement.x = Math.round(clamp(x, -30, 130) * 10) / 10;
  placement.y = Math.round(clamp(y, -35, 145) * 10) / 10;
  placement.width = Math.round(clamp(width, 1, 130) * 10) / 10;
  placement.anchor = next;
  return true;
}

function migrateLegacyInView() {
  let count = 0;
  for (const item of draft.items) {
    if (!visibleInRoom(item, draft.presentations?.[activeKey()])) continue;
    if (!item.placements[activeKey()]) {
      const legacy = item.placements[legacyKey(editorScene.value as Scene, editorView.value as View)];
      if (legacy) {
        item.placements[activeKey()] = { ...legacy };
        count++;
      }
    }
    const placement = item.placements[activeKey()];
    if (placement && !placement.anchor && convertAnchor(placement, 'frame')) count++;
  }
  if (count) {
    refreshItemList();
    refreshFields();
    status('Posiciones antiguas copiadas a este tamaño y ancladas cuando corresponde. Revisa y guarda para conservarlas.');
  }
}

// Match the actual activity viewport, including mobile aspect ratios and
// viewport media queries. Other orientations use the same device dimensions.
function previewDimensions(): [number, number] {
  const view = editorView.value as View;
  if (view === 'window') return innerWidth <= 520 && innerHeight <= 360 ? [innerWidth, innerHeight] : [480, 270];
  const portrait = innerHeight > innerWidth;
  return (view === 'portrait') === portrait ? [innerWidth, innerHeight] : [innerHeight, innerWidth];
}

function sizePreview() {
  const [width, height] = previewDimensions();
  const baseScale = Math.min(previewFrame.clientWidth / width, previewFrame.clientHeight / height, 1);
  const scale = baseScale * previewZoom;
  previewPanX = clamp(previewPanX, -Math.max(0, (width * scale - previewFrame.clientWidth) / 2),
    Math.max(0, (width * scale - previewFrame.clientWidth) / 2));
  previewPanY = clamp(previewPanY, -Math.max(0, (height * scale - previewFrame.clientHeight) / 2),
    Math.max(0, (height * scale - previewFrame.clientHeight) / 2));
  preview.style.width = `${width}px`;
  preview.style.height = `${height}px`;
  preview.style.transform = `scale(${scale})`;
  preview.style.left = `${(previewFrame.clientWidth - width * scale) / 2 + previewPanX}px`;
  preview.style.top = `${(previewFrame.clientHeight - height * scale) / 2 + previewPanY}px`;
  zoomReset.textContent = `${Math.round(previewZoom * 100)}%`;
}

function changeZoom(next: number) {
  previewZoom = clamp(next, 1, 4);
  if (previewZoom === 1) { previewPanX = 0; previewPanY = 0; }
  sizePreview();
}

function zoomAt(next: number, x: number, y: number) {
  const [width, height] = previewDimensions();
  const baseScale = Math.min(previewFrame.clientWidth / width, previewFrame.clientHeight / height, 1);
  const before = baseScale * previewZoom;
  const sceneX = (x - (previewFrame.clientWidth - width * before) / 2 - previewPanX) / before;
  const sceneY = (y - (previewFrame.clientHeight - height * before) / 2 - previewPanY) / before;
  previewZoom = clamp(next, 1, 4);
  const after = baseScale * previewZoom;
  previewPanX = x - sceneX * after - (previewFrame.clientWidth - width * after) / 2;
  previewPanY = y - sceneY * after - (previewFrame.clientHeight - height * after) / 2;
  if (previewZoom === 1) { previewPanX = 0; previewPanY = 0; }
  sizePreview();
}

function reloadPreview() {
  refreshMoodFields();
  previewReady = false;
  gestureStart = null;
  changeZoom(1);
  sizePreview();
  const params = new URLSearchParams({ editorPreview: '1', scene: editorScene.value, aspect: editorAspect.value });
  if (activityTicket) params.set('ticket', activityTicket);
  preview.src = `/?${params}`;
}

function connectPreviewVideo() {
  if (!previewReady || editor.hidden) return;
  const doc = preview.contentDocument, mount = doc?.querySelector('#videoMount'); if (!doc || !mount) return;
  const source = document.querySelector<HTMLVideoElement>('#videoMount video');
  let video = mount.querySelector<HTMLVideoElement>('video');
  if (!source) { if (video?.dataset.editorFeed) { video.srcObject = null; video.remove(); }
    doc.querySelector('#stage')!.classList.remove('has-signal'); doc.querySelector<HTMLElement>('#emptyState')!.style.display = '';
    doc.querySelector('#liveBadge')!.textContent = 'STANDBY'; doc.querySelector('#statusText')!.textContent = 'ESPERANDO SEÑAL';
    previewVideoSource = null; previewFeed = null; return; }
  if (source !== previewVideoSource || (source.srcObject instanceof MediaStream && source.srcObject !== previewFeed)) {
    previewVideoSource = source;
    try { previewFeed = source.srcObject instanceof MediaStream ? source.srcObject :
      (source as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream?.() ?? null; }
    catch { previewFeed = null; }
  }
  if (!previewFeed) return;
  if (!video) { video = doc.createElement('video'); video.muted = true; video.autoplay = true; video.playsInline = true; mount.append(video); }
  video.dataset.editorFeed = 'true';
  if (video.srcObject !== previewFeed) { video.srcObject = previewFeed; void video.play().catch(() => {}); }
  const live = stage.classList.contains('has-signal') && source.readyState >= 2;
  doc.querySelector('#stage')!.classList.toggle('has-signal', live);
  doc.querySelector<HTMLElement>('#emptyState')!.style.display = live ? 'none' : '';
  doc.querySelector('#liveBadge')!.textContent = live ? 'VISTA PREVIA' : 'STANDBY';
  doc.querySelector('#statusText')!.textContent = live ? 'VÍDEO EN DIRECTO' : 'ESPERANDO SEÑAL';
}

function refreshItemList() {
  editorItem.replaceChildren();
  for (const item of draft.items) {
    if (!visibleInRoom(item, draft.presentations?.[activeKey()])) continue;
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = `${item.name}${placementFor(item, editorScene.value as Scene, editorView.value as View, editorAspect.value as Aspect) ? '' : ' · sin colocar'}`;
    editorItem.append(option);
  }
  if (selected && draft.items.some((item) => item.id === selected)) editorItem.value = selected;
  editorProperties.hidden = !selectedItem();
  refreshFields();
}

function refreshFields() {
  const item = selectedItem();
  inputs[2].max = '130';
  const placement = item?.placements[activeKey()];
  editorProperties.hidden = !placement;
  editorNudge.hidden = !placement;
  refreshStudio();
  if (!placement) return;
  decorName.value = item!.name;
  decorLocked.checked = placement.locked === true;
  [...inputs.slice(0, 4), decorAnchor].forEach(input => { input.disabled = placement.locked === true; });
  editorNudge.querySelectorAll<HTMLButtonElement>('button').forEach(button => { button.disabled = placement.locked === true; });
  editorProperties.querySelector<HTMLButtonElement>('[data-editor-command="center"]')!.disabled = placement.locked === true;
  editorProperties.querySelector<HTMLButtonElement>('[data-editor-command="duplicate"]')!.disabled = item?.kind === 'viewer-slot';
  decorRemove.hidden = item?.kind === 'viewer-slot';
  [placement.x, placement.y, placement.width, placement.rotation, placement.opacity * 100, placement.z]
    .forEach((value, index) => { inputs[index].value = String(Math.round(value * 10) / 10); });
  decorAnchor.value = placement.anchor || 'scene';
  [placement.brightness ?? 83, placement.saturation ?? 82, placement.hue ?? 0, placement.shadow ?? 80]
    .forEach((value, index) => { filters[index].value = String(value); filterOutputs[index].value = `${value}${index === 2 ? '°' : '%'}`; });
  decorHidden.checked = placement.hidden;
  decorForeground.checked = placement.foreground === true;
  decorBehindTv.checked = placement.behindTv === true;
  decorBehindTvLabel.hidden = editorScene.value !== 'home';
  decorEmitLight.checked = Boolean(placement.light);
  decorLightColor.value = placement.light?.color ?? '#ffc68a';
  decorLightIntensity.value = String(placement.light?.intensity ?? 80);
  decorLightRadius.value = String(placement.light?.radius ?? 6);
  decorLightX.value = String(placement.light?.x ?? 50);
  decorLightY.value = String(placement.light?.y ?? 50);
  decorLightIntensityValue.value = `${decorLightIntensity.value}%`;
  decorLightRadiusValue.value = `${decorLightRadius.value}× el ancho`;
}

function selectItem(id: string) {
  selected = id;
  selection = new Set([id]);
  const item = selectedItem();
  if (item && !item.placements[activeKey()]) {
    item.placements[activeKey()] = { ...(placementFor(item, editorScene.value as Scene,
      editorView.value as View, editorAspect.value as Aspect) || Object.values(item.placements)[0] || defaultPlacement()) };
    status('Colocada en esta vista. Arrástrala o ajusta los números.');
    if (!item.placements[activeKey()]!.anchor && previewReady) convertAnchor(item.placements[activeKey()]!, 'frame');
  }
  refreshItemList();
  sendPreview();
}

async function editorRequest(url: string, options: RequestInit) {
  const response = await fetch(url, { ...options, headers: {
    ...options.headers, 'X-Decoration-Key': editKey, 'X-Activity-Ticket': activityTicket,
  } });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${response.status}`);
  }
  return response;
}

async function loadDecorations() {
  try {
    const response = await fetch(authorizedUrl('/api/decorations'), { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    saved = await response.json() as Manifest;
    ensureViewerSlots(saved);
    if (editor.hidden) render(saved, scene(), currentView(), false);
  } catch (error) { console.error('No se pudo cargar la decoración:', error); }
}

const closeDialog = document.querySelector<HTMLDialogElement>('#closeDialog')!;
const closeSave = document.querySelector<HTMLButtonElement>('#closeSave')!;
const closeDiscard = document.querySelector<HTMLButtonElement>('#closeDiscard')!;
const closeCancel = document.querySelector<HTMLButtonElement>('#closeCancel')!;
const closeStatus = document.querySelector<HTMLElement>('#closeStatus')!;
let saving = false;
let closeAction: (() => void | Promise<void>) | undefined;
function hasUnsavedChanges() {
  return !editor.hidden && !!editKey && JSON.stringify(draft) !== JSON.stringify(saved);
}
function closeEditor() {
  draft = copyManifest(saved); history.reset(draft);
  editor.hidden = true; stage.classList.remove('editing-decoration');
  preview.src = 'about:blank'; previewReady = false;
  render(saved, scene(), currentView(), false);
}
async function saveChanges(allViews: boolean): Promise<boolean> {
  if (saving) return false;
  rememberAssets();
  const versions = [{ id: crypto.randomUUID(), name: new Date().toLocaleString('es'), room: {
    items: structuredClone(saved.items), ambient: saved.ambient, mood: structuredClone(saved.mood), presentations: structuredClone(saved.presentations)
  } }, ...(draft.versions ?? [])].slice(0, 3);
  const submitted = allViews ? copyManifest(draft) : saveView(saved, draft, activeKey());
  submitted.versions = versions;
  saving = true; editorSave.disabled = true;
  try {
    status(allViews ? 'Guardando los cambios pendientes…' : 'Guardando esta vista…');
    await editorRequest('/api/decorations', {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(submitted)});
    saved = submitted; draft.versions = structuredClone(versions);
    if(allViews) draft = copyManifest(saved);
    refreshStudio(); render(saved, scene(), currentView(), false); updateHistoryButtons();
    status(JSON.stringify(draft) === JSON.stringify(saved) ? 'Vista guardada. Las demás conservan su decoración.' : 'Vista guardada. Quedan cambios pendientes en el editor.');
    return true;
  } catch(error) {
    const message=error instanceof Error ? error.message : 'No se pudo guardar';
    status(message); closeStatus.textContent=message; return false;
  } finally { saving=false; editorSave.disabled=false; }
}
function requestClose(app: boolean, action?: () => void | Promise<void>) {
  if(saving || closeDialog.open) return;
  const dirty=hasUnsavedChanges();
  if(!app && !dirty) {closeEditor();return;}
  closeAction=action;
  document.querySelector('#closeTitle')!.textContent=app ? '¿Seguro que quieres cerrar la app?' : '¿Seguro que quieres cerrar el editor?';
  document.querySelector('#closeDescription')!.textContent=dirty
    ? 'Hay cambios sin guardar. Guardar y cerrar conserva los cambios pendientes de todas las vistas editadas. Descartar elimina solo esos cambios; conserva lo que ya guardaste.'
    : 'Puedes volver a entrar cuando quieras. Tus ajustes guardados se conservarán.';
  closeStatus.textContent='';closeSave.hidden=!dirty;closeDiscard.textContent=dirty?'Descartar y cerrar':'Cerrar';
  closeDialog.showModal();closeCancel.focus();
}
export function requestAppClose(action: () => void | Promise<void>) { requestClose(true,action); }

export function initDecorations() {
  closeCancel.addEventListener('click', () => { if(!saving) closeDialog.close(); });
  closeDialog.addEventListener('cancel', event => { if(saving) event.preventDefault(); });
  const finishClose=async () => {
    const action=closeAction;closeAction=undefined;
    closeDialog.close();closeEditor();
    try {await action?.();} catch(error) {status(error instanceof Error ? error.message : 'No se pudo cerrar la app');}
  };
  closeDiscard.addEventListener('click', () => {if(!saving) void finishClose();});
  closeSave.addEventListener('click', async () => {
    if(saving) return;
    closeSave.disabled=closeDiscard.disabled=closeCancel.disabled=true;closeStatus.textContent='Guardando…';
    const ok=await saveChanges(true);
    closeSave.disabled=closeDiscard.disabled=closeCancel.disabled=false;
    if(ok) await finishClose();
  });
  window.addEventListener('beforeunload', event => {
    if(hasUnsavedChanges()) {event.preventDefault();event.returnValue='';}
  });
  initVideoFraming();
  if (previewMode) {
    window.addEventListener('message', async event => {
      if (event.origin !== location.origin || event.source !== parent || event.data?.type !== 'decor-rest-on' || !lastRender) return;
      const ids = Array.isArray(event.data.ids) ? event.data.ids.filter((id: unknown) => typeof id === 'string') : [];
      if (typeof event.data.supportId !== 'string') return;
      const render = lastRender;
      const { manifest, sceneName, view } = render;
      const restKey = key(sceneName,view,currentAspect());
      const values = await restOnSurface(manifest, key(sceneName,view,currentAspect()), ids, event.data.supportId,
        manifest.presentations?.[key(sceneName,view,currentAspect())], p => basis(p,sceneName,view), (box,p) => position(box,p,sceneName,view), event.data.authored === true);
      if(lastRender !== render) return;
      parent.postMessage({ type:'decor-rested', values, key:restKey, authored:event.data.authored === true }, location.origin);
    });
    stage.classList.add('preview-mode');
    initPreviewGestures();
    window.addEventListener('message', (event) => {
      if (event.origin !== location.origin || event.source !== parent || event.data?.type !== 'decor-preview') return;
      selected = typeof event.data.selected === 'string' ? event.data.selected : null;
      selection = new Set(Array.isArray(event.data.selectedIds) ? event.data.selectedIds : selected ? [selected] : []);
      setTestLight(event.data.testLight ?? 'live');
      previewTool = ['select', 'pan', 'tv', 'camera', 'screen', 'warp'].includes(event.data.tool) ? event.data.tool : 'select';
      previewSnap = event.data.snap === true; previewGrid = event.data.grid === true;
      stage.classList.toggle('pan-tool', previewTool === 'pan' || spaceHeld);
      const manifest = event.data.manifest as Manifest;
      ensureViewerSlots(manifest);
      render(manifest, scene(), currentView(), true);
    });
    window.addEventListener('resize', () => {
      if (lastRender) render(lastRender.manifest, lastRender.sceneName, currentView(), true);
    });
    return;
  }

  const initialLoad = loadDecorations();
  new MutationObserver(connectPreviewVideo).observe(document.querySelector('#videoMount')!, { childList: true });
  new MutationObserver(connectPreviewVideo).observe(stage, { attributes: true, attributeFilter: ['class'] });
  document.querySelector('#videoMount')!.addEventListener('loadeddata', connectPreviewVideo, true);
  document.querySelector('#videoMount')!.addEventListener('loadedmetadata', connectPreviewVideo, true);
  initStudio({
    draft: () => draft, saved: () => saved, item: selectedItem, key: activeKey,
    selected: () => [...selection].filter(id => draft.items.some(i => i.id === id)),
    select: (id, additive = false) => {
      if (!additive) return selectItem(id);
      selection.has(id) ? selection.delete(id) : selection.add(id);
      selected = [...selection].at(-1) ?? null; refreshItemList(); sendPreview(undefined, false);
    },
    change: group => { refreshItemList(); refreshMoodFields(); sendPreview(group); },
    convert: p => convertAnchor(p, 'scene'), command: editorCommand, status,
    create: (item) => { if (draft.items.filter(i => i.kind !== 'viewer-slot').length >= MAX_SCENE_ITEMS) return status(`Máximo ${MAX_SCENE_ITEMS} piezas; combina muebles e imágenes libremente.`);
      item.placements[activeKey()] ??= defaultPlacement(); draft.items.push(item); selectItem(item.id); },
    rest: (ids, supportId, authored) => { if(!authored) sendPreview(); preview.contentWindow?.postMessage({ type:'decor-rest-on',ids,supportId,authored },location.origin); },
    compare: value => { compareSaved = value; sendPreview(undefined, false); },
    test: value => { previewTest = value; sendPreview(undefined, false); },
    asset: authorizedUrl, resize: sizePreview,
    tool: setEditorTool,
    restore: room => { const copy = structuredClone(room); draft.items = copy.items; draft.ambient = copy.ambient; draft.mood = copy.mood; draft.presentations = copy.presentations; selected = null; selection.clear(); refreshItemList(); refreshMoodFields(); sendPreview(); },
    background: async file => {
      if ((draft.library?.length ?? 0) >= MAX_LIBRARY_ITEMS) throw new Error(`La biblioteca está llena (${MAX_LIBRARY_ITEMS} imágenes).`);
      if (file.size > 2 * 1024 * 1024) throw new Error('La imagen debe pesar menos de 2 MB.');
      const response = await editorRequest('/api/decorations/assets', { method: 'POST', headers: { 'Content-Type': file.type }, body: file });
      const { asset } = await response.json();
      (draft.library ??= []).push({ id: crypto.randomUUID(), name: file.name.slice(0, 70), asset, category: 'poster' });
      return asset as string;
    }
  });
  setInterval(() => { if (editor.hidden && !document.hidden) loadDecorations(); }, 30000);
  window.addEventListener('resize', () => {
    render(saved, scene(), currentView(), false);
    editorEnvironment.open = true;
    if (!editor.hidden) sizePreview();
  });
  editorUndo.addEventListener('click', () => editorCommand('undo'));
  editorRedo.addEventListener('click', () => editorCommand('redo'));
  editor.addEventListener('click', event => {
    const action = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-editor-command]');
    if (action) editorCommand(action.dataset.editorCommand!);
  });
  document.addEventListener('pointerdown', event => {
    if (!(event.target as HTMLElement).closest('#editorMenu')) editorMenu.hidden = true;
    history.endGroup();
  });
  document.addEventListener('keydown', event => {
    if (editor.hidden || editorWorkspace.hidden || closeDialog.open) return;
    if (!editorMenu.hidden && (event.target as HTMLElement).closest('#editorMenu')) {
      if (event.key === 'Escape') { event.preventDefault(); editorMenu.hidden = true;
        preview.contentDocument?.querySelector<HTMLElement>('#stage')?.focus(); return; }
      if (['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const buttons = [...editorMenu.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')].filter(button => !button.hidden);
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
        buttons[next]?.focus(); return;
      }
    }
    const typing = (event.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"]');
    if (typing && !((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's')) return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Delete', 'Backspace', 'Escape', '[', ']'].includes(event.key) ||
        ((event.ctrlKey || event.metaKey) && ['z', 'y', 'd', 's'].includes(event.key.toLowerCase())) || ['l', 'h'].includes(event.key.toLowerCase())) {
      event.preventDefault(); editorShortcut({ key: event.key, ctrlKey: event.ctrlKey || event.metaKey, shiftKey: event.shiftKey, altKey: event.altKey });
    }
  });
  document.addEventListener('keyup', () => history.endGroup());
  editorSelectTool.addEventListener('click', () => setEditorTool('select'));
  editorPanTool.addEventListener('click', () => setEditorTool('pan'));
  for (const field of [editorGrid, editorSnap]) field.addEventListener('change', () => sendPreview());
  for (const field of [editorMood, editorMoodIntensity, editorTvGlow]) {
    field.addEventListener('input', () => {
      viewPresentation(draft,activeKey()).mood = { ...viewMood(draft,activeKey()), preset: editorMood.value as RoomMood['preset'], intensity: Number(editorMoodIntensity.value), tvGlow: Number(editorTvGlow.value) };
      refreshMoodFields(); sendPreview(`input:${field.id}`);
    });
    field.addEventListener('change', () => history.endGroup());
  }
  decorName.addEventListener('input', () => {
    const item = selectedItem(); if (!item) return;
    item.name = decorName.value.slice(0, 70);
    const option = [...editorItem.options].find(option => option.value === item.id); if (option) option.textContent = item.name;
    sendPreview('name');
  });
  decorName.addEventListener('change', () => history.endGroup());
  window.addEventListener('shis-scene-change', () => render(saved, scene(), currentView(), false));
  window.addEventListener('shis-aspect-change', () => render(saved, scene(), currentView(), false));

  editorButton.addEventListener('click', async () => {
    await initialLoad;
    document.querySelector<HTMLDivElement>('#settingsPanel')!.hidden = true;
    document.querySelector<HTMLButtonElement>('#settingsButton')!.setAttribute('aria-expanded', 'false');
    editor.hidden = false;
    stage.classList.add('editing-decoration');
    if (editKey) openWorkspace();
    else editorKey.focus();
  });
  editorClose.addEventListener('click', () => requestClose(false));
  editorUnlock.addEventListener('click', async () => {
    editKey = editorKey.value;
    try {
      await editorRequest('/api/decorations/auth', { method: 'POST' });
      await initialLoad;
      editorKey.value = '';
      openWorkspace();
    } catch (error) {
      editKey = '';
      editorAuth.querySelector('p')!.textContent = error instanceof Error ? error.message : 'No se pudo entrar';
    }
  });
  editorKey.addEventListener('keydown', (event) => { if (event.key === 'Enter') editorUnlock.click(); });
  preview.addEventListener('load', () => {
    previewReady = preview.src !== 'about:blank';
    connectPreviewVideo();
    if (previewReady) migrateLegacyInView();
    sendPreview();
  });
  zoomOut.addEventListener('click', () => changeZoom(previewZoom / 1.4));
  zoomIn.addEventListener('click', () => changeZoom(previewZoom * 1.4));
  zoomReset.addEventListener('click', () => changeZoom(1));
  previewFrame.addEventListener('wheel', (event) => {
    if (!event.ctrlKey || (event.target as HTMLElement).closest('.preview-zoom')) return;
    event.preventDefault();
    const bounds = previewFrame.getBoundingClientRect();
    zoomAt(previewZoom * Math.exp(-event.deltaY * .002), event.clientX - bounds.left, event.clientY - bounds.top);
  }, { passive: false });
  editorNudge.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-dx], button[data-dy]');
    const placement = selectedItem()?.placements[activeKey()];
    if (!button || !placement || placement.locked) return;
    const before = { x: placement.x, y: placement.y };
    placement.x = Math.round(clamp(placement.x + Number(button.dataset.dx || 0), -30, 130) * 10) / 10;
    placement.y = Math.round(clamp(placement.y + Number(button.dataset.dy || 0), -35, 145) * 10) / 10;
    shiftPeers(placement, selected!, placement.x - before.x, placement.y - before.y);
    refreshFields();
    sendPreview();
  });
  new ResizeObserver(sizePreview).observe(previewFrame);
  editorScene.addEventListener('change', () => {
    selected = null; selection.clear(); updateAspectControls(); refreshItemList(); reloadPreview();
  });
  editorView.addEventListener('change', () => { selected = null; selection.clear(); refreshItemList(); reloadPreview(); });
  editorAspect.addEventListener('change', () => { selected = null; selection.clear(); refreshItemList(); reloadPreview(); });
  editorItem.addEventListener('change', () => selectItem(editorItem.value));
  decorAnchor.addEventListener('change', () => {
    const placement = selectedItem()?.placements[activeKey()];
    if (!placement) return;
    if (!convertAnchor(placement, decorAnchor.value as 'frame' | 'scene')) {
      decorAnchor.value = placement.anchor || 'scene';
      return status('Espera a que cargue la vista previa.');
    }
    refreshFields();
    sendPreview();
  });

  editorUpload.addEventListener('change', async () => {
    const file = editorUpload.files?.[0];
    editorUpload.value = '';
    if (!file) return;
    if (draft.items.filter((item) => item.kind !== 'viewer-slot').length >= MAX_SCENE_ITEMS)
      return status(`Máximo ${MAX_SCENE_ITEMS} piezas. Quita alguna antes de añadir otra.`);
    if (file.size > 2 * 1024 * 1024) return status('La imagen debe pesar menos de 2 MB.');
    try {
      status('Subiendo imagen…');
      const response = await editorRequest('/api/decorations/assets', {
        method: 'POST', headers: { 'Content-Type': file.type }, body: file,
      });
      const { asset } = await response.json() as { asset: string };
      const item: Decoration = {
        id: crypto.randomUUID(), asset, name: file.name.slice(0, 70),
        placements: { [activeKey()]: defaultPlacement() },
      };
      draft.items.push(item);
      selected = item.id;
      selection = new Set([item.id]);
      refreshItemList();
      sendPreview();
      status('Imagen añadida. Arrástrala en la vista previa y guarda.');
    } catch (error) { status(error instanceof Error ? error.message : 'No se pudo subir'); }
  });

  editorAmbient.addEventListener('input', () => {
    viewPresentation(draft,activeKey()).ambient = Number(editorAmbient.value);
    editorAmbientValue.value = `${editorAmbient.value}%`;
    sendPreview('ambient');
  });
  editorAmbient.addEventListener('change', () => history.endGroup());
  editorAddLight.addEventListener('click', () => {
    if (draft.items.filter((item) => item.kind !== 'viewer-slot').length >= MAX_SCENE_ITEMS)
      return status(`Máximo ${MAX_SCENE_ITEMS} piezas. Quita alguna antes de añadir otra.`);
    const item: Decoration = { id: crypto.randomUUID(), asset: '', kind: 'light', name: 'Luz nueva',
      placements: { [activeKey()]: { ...defaultPlacement(), anchor: 'scene', x: 20, y: 25, width: 4,
        light: { color: '#ffc68a', intensity: 80, radius: 6 } } } };
    draft.items.push(item);
    selected = item.id;
    selection = new Set([item.id]);
    refreshItemList();
    sendPreview();
    status('Luz añadida. Ajusta color, intensidad y alcance; guarda para todos.');
  });

  [...inputs, ...filters, decorHidden, decorForeground, decorBehindTv, decorLocked, decorEmitLight, decorLightColor,
    decorLightIntensity, decorLightRadius, decorLightX, decorLightY].forEach((input) => input.addEventListener('input', () => {
    const placement = selectedItem()?.placements[activeKey()];
    if (!placement) return;
    const values = inputs.map((field) => Number(field.value));
    if (values.some((value) => !Number.isFinite(value))) return;
    const before = { x: placement.x, y: placement.y, width: placement.width, rotation: placement.rotation };
    placement.x = clamp(values[0], -30, 130);
    placement.y = clamp(values[1], -35, 145);
    placement.width = clamp(values[2], 1, 130);
    placement.rotation = clamp(values[3], -180, 180);
    shiftPeers(placement, selected!, placement.x - before.x, placement.y - before.y, placement.width / before.width, placement.rotation - before.rotation);
    placement.opacity = clamp(values[4] / 100, 0, 1);
    placement.z = clamp(values[5], 0, 99);
    placement.hidden = decorHidden.checked;
    placement.foreground = decorForeground.checked;
    placement.behindTv = decorBehindTv.checked;
    placement.locked = decorLocked.checked;
    placement.brightness = Number(filters[0].value);
    placement.saturation = Number(filters[1].value);
    placement.hue = Number(filters[2].value);
    placement.shadow = Number(filters[3].value);
    if (decorEmitLight.checked) placement.light = { ...placement.light, color: decorLightColor.value,
      intensity: Number(decorLightIntensity.value), radius: Number(decorLightRadius.value),
      x: clamp(Number(decorLightX.value), 0, 100), y: clamp(Number(decorLightY.value), 0, 100) };
    else delete placement.light;
    decorLightIntensityValue.value = `${decorLightIntensity.value}%`;
    decorLightRadiusValue.value = `${decorLightRadius.value}× el ancho`;
    filters.forEach((field, index) => { filterOutputs[index].value = `${field.value}${index === 2 ? '°' : '%'}`; });
    if (input === decorLocked) refreshFields();
    sendPreview(`input:${input.id}`);
  }));
  [...inputs, ...filters, decorHidden, decorForeground, decorBehindTv, decorLocked, decorEmitLight, decorLightColor,
    decorLightIntensity, decorLightRadius, decorLightX, decorLightY].forEach(input => input.addEventListener('change', () => history.endGroup()));
  decorCopy.addEventListener('click', () => {
    const item = selectedItem();
    const placement = item?.placements[activeKey()];
    if (!item || !placement) return;
    for (const view of ['landscape', 'portrait', 'window'] as const) {
      item.placements[key(editorScene.value as Scene, view, editorAspect.value as Aspect)] = structuredClone(placement);
    }
    sendPreview();
    status('Posición copiada. Revisa y ajusta cada vista antes de guardar.');
  });
  decorCopyAspect.addEventListener('click', () => {
    const item = selectedItem();
    const placement = item?.placements[activeKey()];
    if (!item || !placement || editorScene.value !== 'home') return;
    const other: Aspect = editorAspect.value === '4:3' ? '16:9' : '4:3';
    item.placements[key('home', editorView.value as View, other)] = structuredClone(placement);
    sendPreview();
    status(`Copiada a TV ${other}. Cambia el selector de tamaño para ajustarla antes de guardar.`);
  });
  decorRemove.addEventListener('click', () => editorCommand('remove'));
  editorSave.addEventListener('click', () => { void saveChanges(false); });
  window.addEventListener('message', (event) => {
    if (event.origin !== location.origin || event.source !== preview.contentWindow) return;
    if (event.data?.type === 'decor-rested') {
      if (compareSaved || !Array.isArray(event.data.values) || event.data.key && event.data.key !== activeKey()) return;
      for (const value of event.data.values) {
        const p = draft.items.find(i=>i.id===value.id)?.placements[activeKey()];
        if (!p || p.locked || ![value.x,value.y].every(Number.isFinite)) continue;
        p.x=clamp(value.x,-30,130);p.y=clamp(value.y,-35,145);
      }
      history.record(draft,event.data.authored ? 'composition' : 'rest-on');if(!event.data.authored) history.endGroup();refreshFields();if(event.data.authored) updateHistoryButtons();else {sendPreview(undefined,false);status('Objeto apoyado. Puedes moverlo y ajustar su perspectiva.');}return;
    }
    if (event.data?.type === 'presentation-change') {
      if (compareSaved || !['tv', 'camera', 'screen'].includes(event.data.kind)) return;
      const f = event.data.framing; if (!f || !['x', 'y', 'zoom', 'width', 'height'].every(key => f[key] === undefined || Number.isFinite(f[key]))) return;
      const kind = event.data.kind as 'tv' | 'camera' | 'screen', limit = kind === 'tv' ? 80 : 50;
      const p = (draft.presentations ??= {})[activeKey()] ??= {};
      if (kind === 'tv') p.tvSupport = ['cabinet', 'floor'].includes(event.data.support) ? event.data.support : 'free';
      if (kind === 'screen') p.screen = { x: clamp(f.x ?? 0, -50, 50), y: clamp(f.y ?? 0, -50, 50), width: clamp(f.width ?? 100, 50, 150), height: clamp(f.height ?? 100, 50, 150) };
      else p[kind] = { x: clamp(f.x ?? 0, -limit, limit), y: clamp(f.y ?? 0, -limit, limit), zoom: clamp(f.zoom ?? 1, kind === 'tv' ? .3 : .5, 2.5) };
      refreshStudio(); history.record(draft, 'scene-drag'); updateHistoryButtons(); return;
    }
    if (event.data?.type === 'decor-key-end') { history.endGroup(); return; }
    if (event.data?.type === 'decor-shortcut') { editorShortcut(event.data); return; }
    if (event.data?.type === 'decor-gesture-start') { history.endGroup(); editorMenu.hidden = true; return; }
    if (event.data?.type === 'decor-gesture-end') { history.endGroup(); sendPreview(); return; }
    if (event.data?.type === 'decor-pan-start') { panStart = { x: previewPanX, y: previewPanY }; editorMenu.hidden = true; return; }
    if (event.data?.type === 'decor-pan-move' && panStart) {
      const dx = Number(event.data.dx), dy = Number(event.data.dy);
      if (![dx, dy].every(Number.isFinite)) return;
      previewPanX = panStart.x + dx; previewPanY = panStart.y + dy; sizePreview(); return;
    }
    if (event.data?.type === 'decor-rename') {
      selectItem(String(event.data.id)); decorName.focus(); decorName.select(); return;
    }
    if (event.data?.type === 'decor-context') {
      const x = Number(event.data.x), y = Number(event.data.y);
      if (![x, y].every(Number.isFinite)) return;
      selectItem(String(event.data.id)); editorMenu.hidden = false;
      const item = selectedItem(), p = item?.placements[activeKey()];
      for (const button of editorMenu.querySelectorAll<HTMLButtonElement>('button')) {
        const cmd = button.dataset.editorCommand;
        button.disabled = ((cmd === 'duplicate' || cmd === 'remove') && item?.kind === 'viewer-slot') || (cmd === 'center' && p?.locked === true);
        button.hidden = cmd === 'depth' && editorScene.value !== 'home';
      }
      const frame = preview.getBoundingClientRect();
      editorMenu.style.left = `${clamp(frame.left + x * frame.width / preview.clientWidth, 12, innerWidth - editorMenu.offsetWidth - 12)}px`;
      editorMenu.style.top = `${clamp(frame.top + y * frame.height / preview.clientHeight, 12, innerHeight - editorMenu.offsetHeight - 12)}px`;
      editorMenu.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus(); return;
    }
    if (event.data?.type === 'decor-wheel-zoom') {
      const x = Number(event.data.x), y = Number(event.data.y), deltaY = Number(event.data.deltaY);
      if (![x, y, deltaY].every(Number.isFinite)) return;
      const frame = previewFrame.getBoundingClientRect();
      const iframe = preview.getBoundingClientRect();
      zoomAt(previewZoom * Math.exp(-deltaY * .002), iframe.left - frame.left + x * iframe.width / preview.clientWidth,
        iframe.top - frame.top + y * iframe.height / preview.clientHeight);
      return;
    }
    if (event.data?.type === 'decor-zoom-start') {
      const [width, height] = previewDimensions();
      const scale = Math.min(previewFrame.clientWidth / width, previewFrame.clientHeight / height, 1) * previewZoom;
      const x = Number(event.data.x), y = Number(event.data.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      gestureStart = { zoom: previewZoom, x, y,
        targetX: (previewFrame.clientWidth - width * scale) / 2 + previewPanX + x * scale,
        targetY: (previewFrame.clientHeight - height * scale) / 2 + previewPanY + y * scale };
      return;
    }
    if (event.data?.type === 'decor-zoom-move' && gestureStart) {
      const ratio = Number(event.data.ratio), dx = Number(event.data.dx), dy = Number(event.data.dy);
      if (![ratio, dx, dy].every(Number.isFinite)) return;
      const [width, height] = previewDimensions();
      previewZoom = clamp(gestureStart.zoom * ratio, 1, 4);
      const scale = Math.min(previewFrame.clientWidth / width, previewFrame.clientHeight / height, 1) * previewZoom;
      previewPanX = gestureStart.targetX + dx - (previewFrame.clientWidth - width * scale) / 2 - gestureStart.x * scale;
      previewPanY = gestureStart.targetY + dy - (previewFrame.clientHeight - height * scale) / 2 - gestureStart.y * scale;
      sizePreview();
      return;
    }
    if (event.data?.type === 'decor-select') {
      editorMenu.hidden = true;
      selected = typeof event.data.id === 'string' ? event.data.id : null;
      if (!event.data.additive && !selection.has(selected ?? '')) selection.clear();
      if (selected) {
        if (event.data.additive && selection.has(selected)) selection.delete(selected); else selection.add(selected);
        const group = selectedItem()?.group;
        if (group && !event.data.individual) draft.items.filter(i => i.group === group).forEach(i => selection.add(i.id));
      } else selection.clear();
      if (selected && !selection.has(selected)) selected = [...selection].at(-1) ?? null;
      const item = selectedItem();
      if (item && !item.placements[activeKey()]) {
        const placement = placementFor(item, editorScene.value as Scene,
          editorView.value as View, editorAspect.value as Aspect);
        if (placement) item.placements[activeKey()] = { ...placement };
      }
      refreshItemList();
    }
    if (event.data?.type === 'decor-change') {
      const item = draft.items.find((entry) => entry.id === event.data.id);
      const placement = item?.placements[activeKey()];
      if (!placement || placement.locked) return;
      const values = [event.data.x, event.data.y, event.data.width, event.data.rotation].map(Number);
      if (!values.every(Number.isFinite)) return;
      if (event.data.corners && validCorners(event.data.corners)) (placement.transform ??= {}).corners = structuredClone(event.data.corners);
      const dx = values[0] - placement.x, dy = values[1] - placement.y;
      const scale = values[2] / placement.width, turn = values[3] - placement.rotation;
      shiftPeers(placement, item!.id, dx, dy, scale, turn);
      placement.x = clamp(values[0], -30, 130); placement.y = clamp(values[1], -35, 145);
      placement.width = clamp(values[2], 1, 130); placement.rotation = clamp(values[3], -180, 180);
      selected = item!.id;
      editorItem.value = selected;
      refreshFields();
      history.record(draft, 'drag'); updateHistoryButtons();
    }
  });
}

function openWorkspace() {
  editorAuth.hidden = true;
  editorWorkspace.hidden = false;
  draft = copyManifest(saved);
  history.reset(draft); refreshMoodFields(); updateHistoryButtons();
  editorEnvironment.open = true;
  editorMenu.hidden = true;
  selected = null;
  selection.clear(); compareSaved = false;
  document.querySelector('#studioCompare')?.setAttribute('aria-pressed', 'false');
  const compareButton = document.querySelector('#studioCompare'); if (compareButton) compareButton.textContent = 'Antes / después';
  editorScene.value = scene();
  editorView.value = currentView();
  editorAspect.value = currentAspect();
  updateAspectControls();
  status('Sube una imagen o selecciona una decoración.');
  refreshItemList();
  reloadPreview();
}

export function setDecorationViewers(connected: Viewer[]) {
  viewers = connected.slice(0, 5);
  if (!previewMode && editor.hidden) render(saved, scene(), currentView(), false);
}

function updateAspectControls() {
  const arcade = editorScene.value === 'arcade';
  editorAspectLabel.hidden = arcade;
  decorCopyAspect.hidden = arcade;
}
