type Scene = 'home' | 'arcade';
type View = 'landscape' | 'portrait' | 'window';
type Aspect = '16:9' | '4:3';
type PlacementKey = `${Scene}-${View}` | `home-${View}-16x9` | `home-${View}-4x3`;
type SlotColor = 'red' | 'blue' | 'green' | 'yellow' | 'black';
type Viewer = { id: string; name: string; avatar: string };
const slotColors: { id: SlotColor; name: string; css: string }[] = [
  { id: 'red', name: 'Rojo', css: '#b73532' },
  { id: 'blue', name: 'Azul', css: '#246fa8' },
  { id: 'green', name: 'Verde', css: '#399055' },
  { id: 'yellow', name: 'Amarillo', css: '#d1a532' },
  { id: 'black', name: 'Negro', css: '#272b31' },
];
type Placement = {
  x: number; y: number; width: number; rotation: number; opacity: number; z: number; hidden: boolean;
  anchor?: 'scene' | 'frame'; brightness?: number; saturation?: number; hue?: number; shadow?: number;
};
type Decoration = {
  id: string; asset: string; name: string; kind?: 'viewer-slot';
  placements: Partial<Record<PlacementKey, Placement>>;
};
type Manifest = { items: Decoration[] };

const previewMode = new URLSearchParams(location.search).has('editorPreview');
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

let saved: Manifest = { items: [] };
let draft: Manifest = { items: [] };
let selected: string | null = null;
let editKey = '';
let previewReady = false;
let lastRender: { manifest: Manifest; sceneName: Scene; view: View; editable: boolean } | null = null;
let viewers: Viewer[] = [];

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
      item.placements[placementKey] ??= slotPlacement(sceneName, view, index);
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
    frame : layer.getBoundingClientRect();
}

function position(box: HTMLDivElement, placement: Placement, sceneName: Scene, view: View) {
  const room = layer.getBoundingClientRect();
  const bounds = basis(placement, sceneName, view);
  box.style.left = `${bounds.left - room.left + bounds.width * placement.x / 100}px`;
  box.style.top = `${bounds.top - room.top + bounds.height * placement.y / 100}px`;
  box.style.width = `${bounds.width * placement.width / 100}px`;
  box.style.opacity = String(placement.opacity);
  box.style.zIndex = String(placement.z);
  box.style.transform = `translate(-50%, -50%) rotate(${placement.rotation}deg)`;
}

function ambientFilter(placement: Placement): string {
  const shadow = (placement.shadow ?? 80) / 100;
  return `brightness(${placement.brightness ?? 83}%) saturate(${placement.saturation ?? 82}%) ` +
    `hue-rotate(${placement.hue ?? 0}deg) ` +
    `drop-shadow(0 2px 3px rgba(0,0,0,${(.9 * shadow).toFixed(2)}))`;
}

function render(manifest: Manifest, sceneName: Scene, view: View, editable: boolean) {
  lastRender = { manifest, sceneName, view, editable };
  layer.replaceChildren();
  for (const item of manifest.items) {
    const placement = placementFor(item, sceneName, view, currentAspect());
    if (!placement || placement.hidden) continue;
    const slotIndex = item.kind === 'viewer-slot' ? slotColors.findIndex((color) => item.id === `viewer-slot-${color.id}`) : -1;
    const viewer = slotIndex >= 0 ? viewers[slotIndex] : undefined;
    if (slotIndex >= 0 && !editable && !viewer) continue;
    const box = document.createElement('div');
    box.className = 'decoration-box';
    box.dataset.id = item.id;
    position(box, placement, sceneName, view);
    if (editable && item.id === selected) box.classList.add('is-selected');
    if (slotIndex >= 0) {
      const figure = document.createElement('div');
      figure.className = 'viewer-figure';
      figure.style.setProperty('--base-color', slotColors[slotIndex].css);
      figure.style.filter = ambientFilter(placement);
      const neck = document.createElement('div');
      neck.className = 'viewer-neck';
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
      const base = document.createElement('div');
      base.className = 'viewer-base';
      figure.append(neck, disc, base);
      box.append(figure);
    } else {
      const image = document.createElement('img');
      image.className = 'decoration';
      image.src = `/api/decorations/assets/${encodeURIComponent(item.asset)}`;
      image.alt = '';
      image.draggable = false;
      image.style.filter = ambientFilter(placement);
      box.append(image);
    }
    if (editable) {
      for (const [className, label] of [['decor-resize', 'Cambiar tamaño'], ['decor-rotate', 'Girar']] as const) {
        const handle = document.createElement('span');
        handle.className = `decor-handle ${className}`;
        handle.setAttribute('role', 'presentation');
        handle.title = label;
        box.append(handle);
      }
      attachDrag(box, placement, sceneName, view);
    }
    layer.append(box);
  }
}

function attachDrag(box: HTMLDivElement, placement: Placement, sceneName: Scene, view: View) {
  box.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    const target = event.target as HTMLElement;
    const action = target.closest('.decor-resize') ? 'resize' :
      target.closest('.decor-rotate') ? 'rotate' : 'move';
    const bounds = basis(placement, sceneName, view);
    const center = box.getBoundingClientRect();
    const cx = center.left + center.width / 2;
    const cy = center.top + center.height / 2;
    const startAngle = Math.atan2(event.clientY - cy, event.clientX - cx);
    const origin = { x: event.clientX, y: event.clientY, left: placement.x,
      top: placement.y, width: placement.width, rotation: placement.rotation };
    layer.querySelectorAll('.is-selected').forEach((element) => element.classList.remove('is-selected'));
    box.classList.add('is-selected');
    box.setPointerCapture(event.pointerId);
    parent.postMessage({ type: 'decor-select', id: box.dataset.id }, location.origin);
    const move = (e: PointerEvent) => {
      const dx = e.clientX - origin.x;
      const dy = e.clientY - origin.y;
      const fine = e.shiftKey ? .2 : 1;
      if (action === 'move') {
        placement.x = Math.round(clamp(origin.left + dx / bounds.width * 100 * fine, -30, 130) * 10) / 10;
        placement.y = Math.round(clamp(origin.top + dy / bounds.height * 100 * fine, -35, 145) * 10) / 10;
      } else if (action === 'resize') {
        const angle = origin.rotation * Math.PI / 180;
        const localDx = dx * Math.cos(angle) + dy * Math.sin(angle);
        placement.width = Math.round(clamp(origin.width + localDx / bounds.width * 100 * fine, 1, 80) * 10) / 10;
      } else {
        const angle = Math.atan2(e.clientY - cy, e.clientX - cx);
        const delta = (angle - startAngle) * 180 / Math.PI;
        placement.rotation = Math.round(clamp(origin.rotation + delta * fine, -180, 180));
      }
      position(box, placement, sceneName, view);
      parent.postMessage({ type: 'decor-change', id: box.dataset.id,
        x: placement.x, y: placement.y, width: placement.width, rotation: placement.rotation }, location.origin);
    };
    const end = () => {
      box.removeEventListener('pointermove', move);
      box.removeEventListener('pointerup', end);
      box.removeEventListener('pointercancel', end);
      box.removeEventListener('lostpointercapture', end);
    };
    box.addEventListener('pointermove', move);
    box.addEventListener('pointerup', end);
    box.addEventListener('pointercancel', end);
    box.addEventListener('lostpointercapture', end);
  });
}

function sendPreview() {
  if (previewReady) preview.contentWindow?.postMessage({ type: 'decor-preview', manifest: draft, selected }, location.origin);
}

function convertAnchor(placement: Placement, next: 'frame' | 'scene') {
  const doc = preview.contentDocument;
  const sceneName = editorScene.value as Scene;
  const view = editorView.value as View;
  const sceneBounds = doc?.querySelector('#decorationLayer')?.getBoundingClientRect();
  const selector = sceneName === 'home' ? '.screen-wrap' :
    view === 'portrait' ? '.arcade-scene' : '.arcade-screen';
  const frameBounds = doc?.querySelector(selector)?.getBoundingClientRect();
  if (!sceneBounds?.width || !sceneBounds.height || !frameBounds?.width || !frameBounds.height) return false;
  const before = placement.anchor === 'frame' ? frameBounds : sceneBounds;
  const after = next === 'frame' ? frameBounds : sceneBounds;
  const x = (before.left + before.width * placement.x / 100 - after.left) / after.width * 100;
  const y = (before.top + before.height * placement.y / 100 - after.top) / after.height * 100;
  const width = before.width * placement.width / after.width;
  placement.x = Math.round(clamp(x, -30, 130) * 10) / 10;
  placement.y = Math.round(clamp(y, -35, 145) * 10) / 10;
  placement.width = Math.round(clamp(width, 1, 80) * 10) / 10;
  placement.anchor = next;
  return true;
}

function migrateLegacyInView() {
  let count = 0;
  for (const item of draft.items) {
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

function sizePreview() {
  const view = editorView.value as View;
  const [width, height] = view === 'portrait' ? [360, 640] : view === 'window' ? [480, 270] : [800, 450];
  const scale = Math.min(previewFrame.clientWidth / width, previewFrame.clientHeight / height, 1);
  preview.style.width = `${width}px`;
  preview.style.height = `${height}px`;
  preview.style.transform = `scale(${scale})`;
  preview.style.left = `${(previewFrame.clientWidth - width * scale) / 2}px`;
  preview.style.top = `${(previewFrame.clientHeight - height * scale) / 2}px`;
}

function reloadPreview() {
  previewReady = false;
  sizePreview();
  const params = new URLSearchParams({ editorPreview: '1', scene: editorScene.value, aspect: editorAspect.value });
  preview.src = `/?${params}`;
}

function refreshItemList() {
  editorItem.replaceChildren();
  for (const item of draft.items) {
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
  const placement = item?.placements[activeKey()];
  editorProperties.hidden = !placement;
  if (!placement) return;
  decorRemove.hidden = item?.kind === 'viewer-slot';
  [placement.x, placement.y, placement.width, placement.rotation, placement.opacity * 100, placement.z]
    .forEach((value, index) => { inputs[index].value = String(Math.round(value * 10) / 10); });
  decorAnchor.value = placement.anchor || 'scene';
  [placement.brightness ?? 83, placement.saturation ?? 82, placement.hue ?? 0, placement.shadow ?? 80]
    .forEach((value, index) => { filters[index].value = String(value); filterOutputs[index].value = `${value}${index === 2 ? '°' : '%'}`; });
  decorHidden.checked = placement.hidden;
}

function selectItem(id: string) {
  selected = id;
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
  const response = await fetch(url, { ...options, headers: { ...options.headers, 'X-Decoration-Key': editKey } });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${response.status}`);
  }
  return response;
}

async function loadDecorations() {
  try {
    const response = await fetch('/api/decorations', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    saved = await response.json() as Manifest;
    ensureViewerSlots(saved);
    if (editor.hidden) render(saved, scene(), currentView(), false);
  } catch (error) { console.error('No se pudo cargar la decoración:', error); }
}

export function initDecorations() {
  if (previewMode) {
    stage.classList.add('preview-mode');
    window.addEventListener('message', (event) => {
      if (event.origin !== location.origin || event.source !== parent || event.data?.type !== 'decor-preview') return;
      selected = typeof event.data.selected === 'string' ? event.data.selected : null;
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
  setInterval(() => { if (editor.hidden && !document.hidden) loadDecorations(); }, 30000);
  window.addEventListener('resize', () => {
    render(saved, scene(), currentView(), false);
    if (!editor.hidden) sizePreview();
  });
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
  editorClose.addEventListener('click', () => {
    if (editKey && JSON.stringify(draft) !== JSON.stringify(saved) &&
        !confirm('Hay cambios sin guardar. ¿Cerrar el editor?')) return;
    editor.hidden = true;
    stage.classList.remove('editing-decoration');
    preview.src = 'about:blank';
    previewReady = false;
    render(saved, scene(), currentView(), false);
  });
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
    if (previewReady) migrateLegacyInView();
    sendPreview();
  });
  new ResizeObserver(sizePreview).observe(previewFrame);
  editorScene.addEventListener('change', () => {
    selected = null; updateAspectControls(); refreshItemList(); reloadPreview();
  });
  editorView.addEventListener('change', () => { selected = null; refreshItemList(); reloadPreview(); });
  editorAspect.addEventListener('change', () => { selected = null; refreshItemList(); reloadPreview(); });
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
    if (draft.items.filter((item) => item.kind !== 'viewer-slot').length >= 60)
      return status('Máximo 60 decoraciones. Quita alguna antes de añadir otra.');
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
      refreshItemList();
      sendPreview();
      status('Imagen añadida. Arrástrala en la vista previa y guarda.');
    } catch (error) { status(error instanceof Error ? error.message : 'No se pudo subir'); }
  });

  [...inputs, ...filters, decorHidden].forEach((input) => input.addEventListener('input', () => {
    const placement = selectedItem()?.placements[activeKey()];
    if (!placement) return;
    const values = inputs.map((field) => Number(field.value));
    if (values.some((value) => !Number.isFinite(value))) return;
    placement.x = clamp(values[0], -30, 130);
    placement.y = clamp(values[1], -35, 145);
    placement.width = clamp(values[2], 1, 80);
    placement.rotation = clamp(values[3], -180, 180);
    placement.opacity = clamp(values[4] / 100, 0, 1);
    placement.z = clamp(values[5], 0, 99);
    placement.hidden = decorHidden.checked;
    placement.brightness = Number(filters[0].value);
    placement.saturation = Number(filters[1].value);
    placement.hue = Number(filters[2].value);
    placement.shadow = Number(filters[3].value);
    filters.forEach((field, index) => { filterOutputs[index].value = `${field.value}${index === 2 ? '°' : '%'}`; });
    sendPreview();
  }));
  decorCopy.addEventListener('click', () => {
    const item = selectedItem();
    const placement = item?.placements[activeKey()];
    if (!item || !placement) return;
    for (const view of ['landscape', 'portrait', 'window'] as const) {
      item.placements[key(editorScene.value as Scene, view, editorAspect.value as Aspect)] = { ...placement };
    }
    status('Posición copiada. Revisa y ajusta cada vista antes de guardar.');
  });
  decorCopyAspect.addEventListener('click', () => {
    const item = selectedItem();
    const placement = item?.placements[activeKey()];
    if (!item || !placement || editorScene.value !== 'home') return;
    const other: Aspect = editorAspect.value === '4:3' ? '16:9' : '4:3';
    item.placements[key('home', editorView.value as View, other)] = { ...placement };
    status(`Copiada a TV ${other}. Cambia el selector de tamaño para ajustarla antes de guardar.`);
  });
  decorRemove.addEventListener('click', () => {
    if (selectedItem()?.kind === 'viewer-slot') return;
    draft.items = draft.items.filter((item) => item.id !== selected);
    selected = null;
    refreshItemList();
    sendPreview();
    status('Decoración quitada. Guarda para aplicar el cambio.');
  });
  editorSave.addEventListener('click', async () => {
    try {
      status('Guardando…');
      await editorRequest('/api/decorations', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft),
      });
      saved = copyManifest(draft);
      render(saved, scene(), currentView(), false);
      status('Guardado. Todos verán esta decoración.');
    } catch (error) { status(error instanceof Error ? error.message : 'No se pudo guardar'); }
  });
  window.addEventListener('message', (event) => {
    if (event.origin !== location.origin || event.source !== preview.contentWindow) return;
    if (event.data?.type === 'decor-select') {
      selected = String(event.data.id);
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
      if (!placement) return;
      placement.x = clamp(Number(event.data.x), -30, 130);
      placement.y = clamp(Number(event.data.y), -35, 145);
      placement.width = clamp(Number(event.data.width), 1, 80);
      placement.rotation = clamp(Number(event.data.rotation), -180, 180);
      selected = item!.id;
      editorItem.value = selected;
      refreshFields();
    }
  });
}

function openWorkspace() {
  editorAuth.hidden = true;
  editorWorkspace.hidden = false;
  draft = copyManifest(saved);
  selected = null;
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
