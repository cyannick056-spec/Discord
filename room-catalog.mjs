// Fondos fotográficos disponibles. Cambiar de fondo no crea, borra ni mueve objetos.
export const rooms = [
  { id: 'cozy-night', name: 'Rincón nocturno', description: 'Azul petróleo, lavanda y luz suave' },
  { id: 'midnight-den', name: 'Madrugada clásica', description: 'Pared azul oscura y profundidad nocturna' },
  { id: 'walnut-den', name: 'Noche de nogal', description: 'Paneles de madera y ambiente cálido' },
  { id: 'violet-den', name: 'Rincón violeta', description: 'Nicho malva y ambiente suave' },
];

// Catálogo integrado actual: únicamente muebles y superficies de apoyo.
// Las figuritas e imágenes personales se añaden mediante el editor y nunca se sustituyen al cambiar de fondo.
export const props = [
  { id: 'cabinet', name: 'Mueble de TV', category: 'furniture', support: { corners: [[6.6,18],[93.4,18],[98.4,28],[1.6,28]], material: 'wood' } },
  { id: 'cabinet-black', name: 'Mueble negro', category: 'furniture', support: { corners: [[5.1,26],[94.9,26],[99.2,37],[.8,37]], material: 'matte' } },
  { id: 'gaming-desk', name: 'Escritorio', category: 'furniture', support: { corners: [[9.6,16.6],[90.4,16.6],[98.9,34.4],[1.1,34.4]], material: 'wood' } },
  { id: 'tv-cart', name: 'Carrito para TV', category: 'furniture', support: { corners: [[8,10.7],[92,10.7],[97.9,22.7],[2.1,22.7]], material: 'wood' } },
  { id: 'floating-shelf', name: 'Repisa flotante', category: 'furniture', support: { corners: [[8.3,33.4],[91.7,33.4],[97.5,45.6],[2.5,45.6]], material: 'wood' } },
  { id: 'tv-riser', name: 'Base elevada', category: 'furniture', support: { corners: [[7,33.7],[93,33.7],[98.8,50.3],[1.2,50.3]], material: 'wood' } },
  { id: 'sofa', name: 'Sofá', category: 'furniture' },
  { id: 'bed', name: 'Cama', category: 'furniture' },
  { id: 'shelf', name: 'Repisa de juegos', category: 'furniture' },
  { id: 'rug', name: 'Alfombra', category: 'furniture' },
  { id: 'beanbag', name: 'Puff de tela', category: 'furniture' },
  { id: 'side-table', name: 'Mesa auxiliar', category: 'furniture', support: { corners: [[11.5,17],[88.5,17],[98.3,43.8],[1.7,43.8]], material: 'wood' } },
];

export const roomIds = new Set(rooms.map(r => r.id));
// Solo se aceptan para leer datos antiguos durante la migración; nunca se muestran como fondos actuales.
export const legacyRoomIds = new Set(['morning', 'night', 'bedroom', 'retro', 'rain', 'rain-close', 'japanese', 'cabin', 'city']);
export const propIds = new Set(props.map(p => p.id));
export function builtinUrl(id) { return propIds.has(id) ? `/rooms/props/${id}.webp` : ''; }

// Los objetos pertenecen a la vista, no al fondo. Cambiar de escenario debe conservarlos todos.
export function visibleInRoom() { return true; }

const HOME_KEYS = ['home-landscape-16x9','home-landscape-4x3','home-portrait-16x9','home-portrait-4x3','home-window-16x9','home-window-4x3'];
const visualKeys = ['environment','style','background','ambient','mood','rain'];
let cachedStartup = null;
let cachedStartupKey = null;
let startupApplied = false;
let pendingDefault = false;
let pendingClearDefault = false;
const rainByKey = new Map();
let latestManifest = null;

function currentStudioKey(doc = document) {
  const scene = doc.getElementById('editorScene')?.value || 'home';
  const view = doc.getElementById('editorView')?.value || 'landscape';
  const aspect = doc.getElementById('editorAspect')?.value || '16:9';
  return scene === 'home' ? `home-${view}-${aspect === '4:3' ? '4x3' : '16x9'}` : `arcade-${view}`;
}
function visualOnly(p = {}) {
  const value = {};
  for (const key of visualKeys) if (p[key] !== undefined) value[key] = structuredClone(p[key]);
  return value;
}
function viewName(key = '') {
  return /^home-(landscape|portrait|window)-/.exec(key)?.[1] || '';
}
function runtimeView(win = window) {
  const compact = win.innerHeight <= 360 || (win.innerWidth <= 520 && win.innerHeight <= 400) || (win.innerWidth <= 360 && win.innerHeight <= 520);
  return compact ? 'window' : win.innerHeight > win.innerWidth ? 'portrait' : 'landscape';
}
function savedAspect(key = '') {
  if (key.endsWith('-4x3')) return '4x3';
  if (key.endsWith('-16x9')) return '16x9';
  return null;
}
function runtimeTargetKey(startupKey, win = window) {
  const aspect = savedAspect(startupKey) || (win.document.getElementById('tvScene')?.classList.contains('aspect-4x3') ? '4x3' : '16x9');
  return `home-${runtimeView(win)}-${aspect}`;
}
function inferStartupKey(manifest, startup) {
  if (!startup) return null;
  let best = null, bestScore = -1;
  for (const key of HOME_KEYS) {
    const p = manifest?.presentations?.[key];
    if (!p) continue;
    let score = 0;
    if (startup.environment && p.environment === startup.environment) score += 20;
    if (startup.background && p.background === startup.background) score += 20;
    if (startup.style && p.style === startup.style) score += 5;
    score += (manifest.items || []).reduce((count, item) => count + (item?.placements?.[key] ? 1 : 0), 0);
    if (score > bestScore) { best = key; bestScore = score; }
  }
  return best;
}
function applyStartup(manifest, startup, sourceKey) {
  const copy = structuredClone(manifest);
  copy.presentations ??= {};
  const targetKey = runtimeTargetKey(sourceKey);
  const target = copy.presentations[targetKey] ??= {};
  for (const field of visualKeys) delete target[field];
  Object.assign(target, structuredClone(startup));

  // Si solo cambió 16:9 ↔ 4:3, usa durante este arranque exactamente las
  // posiciones que el host guardó como predeterminadas. No modifica el manifiesto real.
  if (sourceKey && sourceKey !== targetKey && viewName(sourceKey) === viewName(targetKey)) {
    for (const item of copy.items || []) {
      const source = item?.placements?.[sourceKey];
      if (source) item.placements[targetKey] = structuredClone(source);
    }
  }

  const tv = document.getElementById('tvScene');
  const aspect = savedAspect(sourceKey);
  if (tv && aspect) tv.classList.toggle('aspect-4x3', aspect === '4x3');
  return copy;
}
function runtimeKey(win = window) {
  const doc = win.document;
  const stage = doc.getElementById('stage');
  const home = !stage?.classList.contains('arcade-mode');
  const view = runtimeView(win);
  const aspect = doc.getElementById('tvScene')?.classList.contains('aspect-4x3') ? '4x3' : '16x9';
  return home ? `home-${view}-${aspect}` : `arcade-${view}`;
}
function rainSetting(manifest, key) { return manifest?.presentations?.[key]?.rain; }
function ensureRainLayer(doc = document) {
  const backdrop = doc.getElementById('roomBackdrop');
  if (!backdrop) return null;
  let layer = backdrop.querySelector('.shis-rain-layer');
  if (!layer) {
    layer = doc.createElement('div');
    layer.className = 'shis-rain-layer';
    layer.innerHTML = '<i></i><i></i>';
    backdrop.append(layer);
  }
  if (!doc.getElementById('shisRainStyle')) {
    const style = doc.createElement('style');
    style.id = 'shisRainStyle';
    style.textContent = `.shis-rain-layer{position:absolute;inset:-12%;overflow:hidden;pointer-events:none;z-index:6;display:none;opacity:var(--rain-opacity,.55);filter:blur(.15px)}.shis-rain-layer.is-active{display:block}.shis-rain-layer i{position:absolute;inset:-20%;background-image:repeating-linear-gradient(106deg,transparent 0 15px,rgba(190,220,255,.48) 16px 17px,transparent 18px 34px);background-size:190px 260px;animation:shisRainFall var(--rain-speed,.72s) linear infinite;transform:translate3d(0,-18%,0)}.shis-rain-layer i+i{opacity:.45;background-size:120px 180px;animation-duration:calc(var(--rain-speed,.72s)*1.35);animation-delay:-.31s}@keyframes shisRainFall{to{transform:translate3d(-8%,36%,0)}}@media(prefers-reduced-motion:reduce){.shis-rain-layer i{animation-play-state:paused}}`;
    doc.head.append(style);
  }
  return layer;
}
function syncRain(doc = document, manifest = latestManifest, forced) {
  const layer = ensureRainLayer(doc); if (!layer) return;
  const win = doc.defaultView || window;
  const key = doc.getElementById('editorPreview') ? currentStudioKey(doc) : runtimeKey(win);
  const setting = forced ?? rainSetting(manifest, key);
  const enabled = setting?.enabled === true;
  layer.classList.toggle('is-active', enabled);
  layer.style.setProperty('--rain-opacity', String(.18 + (setting?.intensity ?? 62) / 100 * .62));
  layer.style.setProperty('--rain-speed', `${Math.max(.28, 1.3 / (setting?.speed ?? 1))}s`);
}
function setStatus(text) { const el = document.getElementById('editorStatus'); if (el) el.textContent = text; }
function updateDefaultButtons() {
  const set = document.getElementById('studioSetDefaultScene');
  const clear = document.getElementById('studioClearDefaultScene');
  if (set) {
    const room = rooms.find(r => r.id === cachedStartup?.environment);
    set.textContent = cachedStartup ? '★ Actualizar predeterminada' : '★ Usar al abrir';
    set.title = cachedStartup ? `Predeterminada actual: ${room?.name || 'fondo personalizado'}` : 'Guardar esta vista como predeterminada';
  }
  if (clear) clear.hidden = !cachedStartup;
}
function syncRainCheckbox() {
  const input = document.getElementById('studioRainEnabled'); if (!input) return;
  const key = currentStudioKey();
  const p = rainByKey.get(key) ?? latestManifest?.presentations?.[key]?.rain;
  input.checked = p?.enabled === true;
}

function installBrowserFetchBridge() {
  if (typeof window === 'undefined' || window.__shisSceneBridge) return;
  window.__shisSceneBridge = true;
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const rawUrl = input instanceof Request ? input.url : String(input);
    const url = new URL(rawUrl, location.href);
    const method = String(init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const decorations = url.pathname === '/api/decorations';
    if (decorations && method === 'PUT' && typeof init.body === 'string') {
      try {
        const body = JSON.parse(init.body);
        body.presentations ??= {};
        for (const [key, rain] of rainByKey) {
          body.presentations[key] ??= {};
          body.presentations[key].rain = structuredClone(rain);
        }
        if (pendingClearDefault) {
          body.startup = null;
          body.startupKey = null;
        } else if (pendingDefault) {
          body.startupKey = currentStudioKey();
          body.startup = visualOnly(body.presentations[body.startupKey] || {});
        } else if (cachedStartup) {
          body.startup = structuredClone(cachedStartup);
          if (cachedStartupKey) body.startupKey = cachedStartupKey;
        }
        init = { ...init, body: JSON.stringify(body) };
        const response = await nativeFetch(input, init);
        if (response.ok) {
          if (pendingClearDefault) { cachedStartup = null; cachedStartupKey = null; }
          else if (pendingDefault) { cachedStartup = structuredClone(body.startup); cachedStartupKey = body.startupKey; }
          pendingDefault = pendingClearDefault = false;
          latestManifest = body;
          updateDefaultButtons(); syncRain(document, latestManifest);
        }
        return response;
      } catch { /* petición original */ }
    }
    const response = await nativeFetch(input, init);
    if (decorations && method === 'GET' && response.ok) {
      try {
        const data = await response.clone().json();
        cachedStartup = data.startup ?? null;
        cachedStartupKey = data.startupKey ?? inferStartupKey(data, cachedStartup);
        for (const [key,p] of Object.entries(data.presentations || {})) if (p?.rain) rainByKey.set(key, structuredClone(p.rain));
        const preview = new URLSearchParams(location.search).has('editorPreview');
        const exposed = !preview && !startupApplied && cachedStartup ? applyStartup(data, cachedStartup, cachedStartupKey) : data;
        if (!preview) startupApplied = true;
        latestManifest = exposed;
        queueMicrotask(() => { updateDefaultButtons(); syncRain(document, exposed); syncRainCheckbox(); });
        const headers = new Headers(response.headers); headers.set('content-type','application/json; charset=utf-8');
        return new Response(JSON.stringify(exposed), { status: response.status, statusText: response.statusText, headers });
      } catch { return response; }
    }
    return response;
  };
}

function installCurrentCatalogLabels() {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;
  installBrowserFetchBridge();
  const apply = () => {
    const scene = document.getElementById('studioBackground');
    const catalog = document.getElementById('studioFurnitureTypes');
    const toolbar = document.querySelector('.editor-toolbar');
    const aspect = document.getElementById('editorAspectLabel');

    if (toolbar && aspect && !document.getElementById('studioSetDefaultScene')) {
      aspect.insertAdjacentHTML('afterend', '<button id="studioSetDefaultScene" type="button" title="Guardar esta vista como predeterminada">★ Usar al abrir</button><button id="studioClearDefaultScene" type="button" title="Quitar escena predeterminada" hidden>Quitar default</button>');
      document.getElementById('studioSetDefaultScene').addEventListener('click', () => {
        pendingDefault = true; pendingClearDefault = false;
        setStatus('Guardando esta vista como predeterminada…');
        document.getElementById('editorSave')?.click();
      });
      document.getElementById('studioClearDefaultScene').addEventListener('click', () => {
        pendingClearDefault = true; pendingDefault = false;
        setStatus('Quitando escena predeterminada…');
        document.getElementById('editorSave')?.click();
      });
      updateDefaultButtons();
    }

    if (scene) {
      const summary = scene.querySelector('summary');
      if (summary) summary.textContent = 'Fondos de escena';
      const notes = scene.querySelectorAll('.studio-note');
      if (notes[0]) notes[0].textContent = 'Cambiar el fondo conserva la TV, los muebles, tus figuritas, el filtro, las luces y el encuadre de esta vista.';
      if (notes[1]) notes[1].textContent = 'Los fondos solo cambian la imagen del entorno. Todo lo demás se edita por separado.';
      const fields = scene.querySelector('.studio-fields');
      if (fields && !document.getElementById('studioRainControl')) {
        fields.insertAdjacentHTML('beforeend', '<div id="studioRainControl"><label class="studio-check"><input id="studioRainEnabled" type="checkbox"/> Lluvia animada sobre el fondo</label></div>');
        document.getElementById('studioRainEnabled').addEventListener('change', event => {
          const checked = event.target.checked, key = currentStudioKey();
          const current = rainByKey.get(key) || { intensity: 68, speed: 1 };
          rainByKey.set(key, { ...current, enabled: checked, intensity: current.intensity ?? 68, speed: current.speed ?? 1 });
          const previewDoc = document.getElementById('editorPreview')?.contentDocument;
          if (previewDoc) syncRain(previewDoc, latestManifest, rainByKey.get(key));
          syncRain(document, latestManifest, rainByKey.get(key));
          setStatus(checked ? 'Lluvia animada activada. Guardando esta vista…' : 'Lluvia desactivada. Guardando esta vista…');
          document.getElementById('editorSave')?.click();
        });
        syncRainCheckbox();
      }
    }
    if (catalog) {
      const summary = catalog.querySelector('summary'); if (summary) summary.textContent = 'Catálogo · muebles';
      const note = catalog.querySelector('.studio-note'); if (note) note.textContent = 'Añade muebles y superficies de apoyo. Tus imágenes y figuritas personales se conservan aparte.';
    }
    const lamps = document.getElementById('studioLampTypes'); if (lamps) lamps.hidden = true;
    return Boolean(scene && catalog && document.getElementById('studioSetDefaultScene'));
  };
  window.addEventListener('shis-presentation-change', () => syncRain(document, latestManifest));
  window.addEventListener('resize', () => syncRain(document, latestManifest));
  const start = () => {
    const observer = new MutationObserver(() => { if (apply()) observer.disconnect(); });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    if (apply()) observer.disconnect();
  };
  if (document.documentElement) start(); else addEventListener('DOMContentLoaded', start, { once: true });
}
installCurrentCatalogLabels();
