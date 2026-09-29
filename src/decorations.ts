type Scene = 'home' | 'arcade';
type View = 'landscape' | 'portrait' | 'window';
type Placement = { x: number; y: number; width: number; rotation: number; opacity: number; z: number; hidden: boolean };
type Decoration = { id: string; asset: string; name: string; placements: Partial<Record<`${Scene}-${View}`, Placement>> };
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
const editorUpload = document.querySelector<HTMLInputElement>('#editorUpload')!;
const editorItem = document.querySelector<HTMLSelectElement>('#editorItem')!;
const editorProperties = document.querySelector<HTMLDivElement>('#editorProperties')!;
const previewFrame = document.querySelector<HTMLDivElement>('#previewFrame')!;
const preview = document.querySelector<HTMLIFrameElement>('#editorPreview')!;
const editorStatus = document.querySelector<HTMLSpanElement>('#editorStatus')!;
const editorSave = document.querySelector<HTMLButtonElement>('#editorSave')!;
const decorCopy = document.querySelector<HTMLButtonElement>('#decorCopy')!;
const decorRemove = document.querySelector<HTMLButtonElement>('#decorRemove')!;
const inputIds = ['decorX', 'decorY', 'decorWidth', 'decorRotation', 'decorOpacity', 'decorZ'] as const;
const inputs = inputIds.map((id) => document.querySelector<HTMLInputElement>(`#${id}`)!);
const decorHidden = document.querySelector<HTMLInputElement>('#decorHidden')!;

let saved: Manifest = { items: [] };
let draft: Manifest = { items: [] };
let selected: string | null = null;
let editKey = '';
let previewReady = false;

function currentView(): View {
  if (innerWidth <= 520 && innerHeight <= 360) return 'window';
  return innerHeight > innerWidth ? 'portrait' : 'landscape';
}

function scene(): Scene { return stage.classList.contains('arcade-mode') ? 'arcade' : 'home'; }
function key(sceneName: Scene, view: View): `${Scene}-${View}` { return `${sceneName}-${view}`; }
function activeKey() { return key(editorScene.value as Scene, editorView.value as View); }
function clamp(value: number, low: number, high: number) { return Math.min(high, Math.max(low, value)); }
function status(message: string) { editorStatus.textContent = message; }
function selectedItem() { return draft.items.find((item) => item.id === selected); }
function defaultPlacement(): Placement { return { x: 50, y: 30, width: 10, rotation: 0, opacity: 1, z: 10, hidden: false }; }
function copyManifest(source: Manifest): Manifest { return structuredClone(source); }

function render(manifest: Manifest, sceneName: Scene, view: View, editable: boolean) {
  layer.replaceChildren();
  for (const item of manifest.items) {
    const placement = item.placements[key(sceneName, view)];
    if (!placement || placement.hidden) continue;
    const image = document.createElement('img');
    image.className = 'decoration';
    image.src = `/api/decorations/assets/${encodeURIComponent(item.asset)}`;
    image.alt = '';
    image.draggable = false;
    image.dataset.id = item.id;
    image.style.left = `${placement.x}%`;
    image.style.top = `${placement.y}%`;
    image.style.width = `${placement.width}%`;
    image.style.opacity = String(placement.opacity);
    image.style.zIndex = String(placement.z);
    image.style.transform = `translate(-50%, -50%) rotate(${placement.rotation}deg)`;
    if (editable) attachDrag(image, placement);
    layer.append(image);
  }
}

function attachDrag(image: HTMLImageElement, placement: Placement) {
  image.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    const bounds = layer.getBoundingClientRect();
    const origin = { x: event.clientX, y: event.clientY, left: placement.x, top: placement.y };
    image.setPointerCapture(event.pointerId);
    parent.postMessage({ type: 'decor-select', id: image.dataset.id }, location.origin);
    const move = (e: PointerEvent) => {
      placement.x = Math.round(clamp(origin.left + (e.clientX - origin.x) / bounds.width * 100, 0, 100) * 10) / 10;
      placement.y = Math.round(clamp(origin.top + (e.clientY - origin.y) / bounds.height * 100, 0, 100) * 10) / 10;
      image.style.left = `${placement.x}%`;
      image.style.top = `${placement.y}%`;
      parent.postMessage({ type: 'decor-move', id: image.dataset.id, x: placement.x, y: placement.y }, location.origin);
    };
    const end = () => {
      image.removeEventListener('pointermove', move);
      image.removeEventListener('pointerup', end);
      image.removeEventListener('pointercancel', end);
    };
    image.addEventListener('pointermove', move);
    image.addEventListener('pointerup', end);
    image.addEventListener('pointercancel', end);
  });
}

function sendPreview() {
  if (previewReady) preview.contentWindow?.postMessage({ type: 'decor-preview', manifest: draft }, location.origin);
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
  const params = new URLSearchParams({ editorPreview: '1', scene: editorScene.value });
  preview.src = `/?${params}`;
}

function refreshItemList() {
  editorItem.replaceChildren();
  for (const item of draft.items) {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = `${item.name}${item.placements[activeKey()] ? '' : ' · sin colocar'}`;
    editorItem.append(option);
  }
  if (selected && draft.items.some((item) => item.id === selected)) editorItem.value = selected;
  editorProperties.hidden = !selectedItem();
  refreshFields();
}

function refreshFields() {
  const placement = selectedItem()?.placements[activeKey()];
  editorProperties.hidden = !placement;
  if (!placement) return;
  [placement.x, placement.y, placement.width, placement.rotation, placement.opacity * 100, placement.z]
    .forEach((value, index) => { inputs[index].value = String(Math.round(value * 10) / 10); });
  decorHidden.checked = placement.hidden;
}

function selectItem(id: string) {
  selected = id;
  const item = selectedItem();
  if (item && !item.placements[activeKey()]) {
    item.placements[activeKey()] = { ...(Object.values(item.placements)[0] || defaultPlacement()) };
    status('Colocada en esta vista. Arrástrala o ajusta los números.');
    sendPreview();
  }
  refreshItemList();
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
    if (editor.hidden) render(saved, scene(), currentView(), false);
  } catch (error) { console.error('No se pudo cargar la decoración:', error); }
}

export function initDecorations() {
  if (previewMode) {
    stage.classList.add('preview-mode');
    window.addEventListener('message', (event) => {
      if (event.origin !== location.origin || event.source !== parent || event.data?.type !== 'decor-preview') return;
      render(event.data.manifest as Manifest, scene(), currentView(), true);
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
  preview.addEventListener('load', () => { previewReady = preview.src !== 'about:blank'; sendPreview(); });
  new ResizeObserver(sizePreview).observe(previewFrame);
  editorScene.addEventListener('change', () => { selected = null; refreshItemList(); reloadPreview(); });
  editorView.addEventListener('change', () => { selected = null; refreshItemList(); reloadPreview(); });
  editorItem.addEventListener('change', () => selectItem(editorItem.value));

  editorUpload.addEventListener('change', async () => {
    const file = editorUpload.files?.[0];
    editorUpload.value = '';
    if (!file) return;
    if (draft.items.length >= 60) return status('Máximo 60 decoraciones. Quita alguna antes de añadir otra.');
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

  [...inputs, decorHidden].forEach((input) => input.addEventListener('input', () => {
    const placement = selectedItem()?.placements[activeKey()];
    if (!placement) return;
    const values = inputs.map((field) => Number(field.value));
    if (values.some((value) => !Number.isFinite(value))) return;
    placement.x = clamp(values[0], 0, 100);
    placement.y = clamp(values[1], 0, 100);
    placement.width = clamp(values[2], 1, 80);
    placement.rotation = clamp(values[3], -180, 180);
    placement.opacity = clamp(values[4] / 100, 0, 1);
    placement.z = clamp(values[5], 0, 99);
    placement.hidden = decorHidden.checked;
    sendPreview();
  }));
  decorCopy.addEventListener('click', () => {
    const item = selectedItem();
    const placement = item?.placements[activeKey()];
    if (!item || !placement) return;
    for (const view of ['landscape', 'portrait', 'window'] as const) {
      item.placements[key(editorScene.value as Scene, view)] = { ...placement };
    }
    status('Posición copiada. Revisa y ajusta cada vista antes de guardar.');
  });
  decorRemove.addEventListener('click', () => {
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
    if (event.data?.type === 'decor-select') selectItem(String(event.data.id));
    if (event.data?.type === 'decor-move') {
      const item = draft.items.find((entry) => entry.id === event.data.id);
      const placement = item?.placements[activeKey()];
      if (!placement) return;
      placement.x = clamp(Number(event.data.x), 0, 100);
      placement.y = clamp(Number(event.data.y), 0, 100);
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
  status('Sube una imagen o selecciona una decoración.');
  refreshItemList();
  reloadPreview();
}
