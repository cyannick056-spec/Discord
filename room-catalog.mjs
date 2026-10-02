// Fondos disponibles. Cambiar de fondo no crea, borra ni mueve objetos.
export const rooms = [
  { id: 'cozy-night', name: 'Rincón nocturno', description: 'Azul petróleo, lavanda y luz suave' },
  { id: 'midnight-den', name: 'Madrugada clásica', description: 'Pared azul oscura y profundidad nocturna' },
  { id: 'walnut-den', name: 'Noche de nogal', description: 'Paneles de madera y ambiente cálido' },
  { id: 'violet-den', name: 'Rincón violeta', description: 'Nicho malva y ambiente suave' },
  { id: 'rain-window', name: 'Ventana nocturna', description: 'Ventanal urbano preparado para lluvia', rainReady: true, rainDefault: true },
  { id: 'rainy-balcony', name: 'Balcón nocturno', description: 'Terraza abierta con ciudad al fondo', rainReady: true, rainDefault: true },
  { id: 'alley-trash', name: 'Callejón · basurero', description: 'Ladrillo, contenedores y suelo urbano', rainReady: true },
  { id: 'blue-room', name: 'Cuarto azul frío', description: 'Habitación limpia en azul profundo' },
  { id: 'rose-room', name: 'Cuarto rosa violeta', description: 'Habitación suave en rosa y malva' },
  { id: 'industrial-loft', name: 'Loft industrial', description: 'Ladrillo, ventanales y piso oscuro' },
  { id: 'forest-open', name: 'Bosque abierto', description: 'Naturaleza amplia para niebla o lluvia', rainReady: true },
  { id: 'morning-room', name: 'Sala de mañana', description: 'Luz cálida y ventana hacia el bosque' },
];

// Catálogo integrado actual: únicamente muebles y superficies de apoyo.
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
export const legacyRoomIds = new Set(['morning', 'night', 'bedroom', 'retro', 'rain', 'rain-close', 'japanese', 'cabin', 'city']);
export const propIds = new Set(props.map(p => p.id));
export function builtinUrl(id) { return propIds.has(id) ? `/rooms/props/${id}.webp` : ''; }
export function visibleInRoom() { return true; }

const HOME_KEYS = ['home-landscape-16x9','home-landscape-4x3','home-portrait-16x9','home-portrait-4x3','home-window-16x9','home-window-4x3'];
const visualKeys = ['environment','style','background','ambient','mood','rain'];
let cachedStartup = null;
let baselineRaw = '';
let startupSession = true;
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
function applyStartup(manifest, startup) {
  const copy = structuredClone(manifest);
  copy.presentations ??= {};
  for (const key of HOME_KEYS) {
    const p = copy.presentations[key] ??= {};
    for (const field of ['environment','style','background']) delete p[field];
    Object.assign(p, structuredClone(startup));
  }
  return copy;
}
function runtimeKey(win = window) {
  const doc = win.document;
  const stage = doc.getElementById('stage');
  const home = !stage?.classList.contains('arcade-mode');
  const compact = win.innerHeight <= 360 || (win.innerWidth <= 520 && win.innerHeight <= 400) || (win.innerWidth <= 360 && win.innerHeight <= 520);
  const view = compact ? 'window' : win.innerHeight > win.innerWidth ? 'portrait' : 'landscape';
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
function updateDefaultLabel() {
  const label = document.getElementById('studioDefaultSceneLabel');
  if (!label) return;
  const room = rooms.find(r => r.id === cachedStartup?.environment);
  label.textContent = cachedStartup ? `Predeterminada: ${room?.name || 'fondo personalizado'}` : 'Sin escena predeterminada';
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
        if (pendingClearDefault) body.startup = null;
        else if (pendingDefault) body.startup = visualOnly(body.presentations[currentStudioKey()] || {});
        else if (cachedStartup) body.startup = structuredClone(cachedStartup);
        init = { ...init, body: JSON.stringify(body) };
        const response = await nativeFetch(input, init);
        if (response.ok) {
          if (pendingClearDefault) cachedStartup = null;
          else if (pendingDefault) cachedStartup = structuredClone(body.startup);
          pendingDefault = pendingClearDefault = false;
          startupSession = false;
          baselineRaw = '';
          latestManifest = body;
          updateDefaultLabel(); syncRain(document, latestManifest);
        }
        return response;
      } catch { /* petición original */ }
    }
    const response = await nativeFetch(input, init);
    if (decorations && method === 'GET' && response.ok) {
      try {
        const data = await response.clone().json();
        cachedStartup = data.startup ?? null;
        for (const [key,p] of Object.entries(data.presentations || {})) if (p?.rain) rainByKey.set(key, structuredClone(p.rain));
        const raw = JSON.stringify(data);
        if (!baselineRaw) baselineRaw = raw;
        else if (raw !== baselineRaw) startupSession = false;
        const exposed = startupSession && cachedStartup ? applyStartup(data, cachedStartup) : data;
        latestManifest = exposed;
        queueMicrotask(() => { updateDefaultLabel(); syncRain(document, exposed); syncRainCheckbox(); });
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
    if (scene) {
      const summary = scene.querySelector('summary'); if (summary) summary.textContent = 'Fondos / escenarios';
      const notes = scene.querySelectorAll('.studio-note');
      if (notes[0]) notes[0].textContent = 'Cambiar el fondo conserva la TV, los muebles, tus figuritas, el filtro, las luces y el encuadre de esta vista.';
      if (notes[1]) notes[1].textContent = 'Los fondos solo cambian la imagen del entorno. Todo lo demás se edita por separado.';
      const fields = scene.querySelector('.studio-fields');
      if (fields && !document.getElementById('studioDefaultScene')) {
        fields.insertAdjacentHTML('beforeend', `<div id="studioDefaultScene"><p id="studioDefaultSceneLabel" class="studio-note">Sin escena predeterminada</p><label class="studio-check"><input id="studioRainEnabled" type="checkbox"/> Lluvia animada sobre el fondo</label><div class="studio-buttons"><button id="studioSetDefaultScene" type="button">★ Usar como predeterminada</button><button id="studioClearDefaultScene" type="button">Quitar predeterminada</button></div><p class="studio-note">La predeterminada guarda el fondo, el filtro/ambiente y la lluvia. No cambia tus muebles, figuritas, TV ni posiciones.</p></div>`);
        document.getElementById('studioSetDefaultScene').addEventListener('click', () => { pendingDefault = true; pendingClearDefault = false; setStatus('Guardando esta escena como predeterminada…'); document.getElementById('editorSave')?.click(); });
        document.getElementById('studioClearDefaultScene').addEventListener('click', () => { pendingClearDefault = true; pendingDefault = false; setStatus('Quitando escena predeterminada…'); document.getElementById('editorSave')?.click(); });
        document.getElementById('studioRainEnabled').addEventListener('change', event => {
          const checked = event.target.checked, key = currentStudioKey();
          const current = rainByKey.get(key) || { intensity: 68, speed: 1 };
          rainByKey.set(key, { ...current, enabled: checked, intensity: current.intensity ?? 68, speed: current.speed ?? 1 });
          const preview = document.getElementById('editorPreview')?.contentDocument;
          if (preview) syncRain(preview, latestManifest, rainByKey.get(key));
          syncRain(document, latestManifest, rainByKey.get(key));
          setStatus(checked ? 'Lluvia animada activada. Guardando esta vista…' : 'Lluvia desactivada. Guardando esta vista…');
          document.getElementById('editorSave')?.click();
        });
        updateDefaultLabel(); syncRainCheckbox();
      }
    }
    if (catalog) {
      const summary = catalog.querySelector('summary'); if (summary) summary.textContent = 'Catálogo · muebles';
      const note = catalog.querySelector('.studio-note'); if (note) note.textContent = 'Añade muebles y superficies de apoyo. Tus imágenes y figuritas personales se conservan aparte.';
    }
    const lamps = document.getElementById('studioLampTypes'); if (lamps) lamps.hidden = true;
    return Boolean(scene && catalog);
  };
  document.addEventListener('click', event => {
    const roomButton = event.target.closest?.('[data-studio-room]');
    if (roomButton) {
      const info = rooms.find(r => r.id === roomButton.dataset.studioRoom), key = currentStudioKey();
      if (info?.rainDefault) rainByKey.set(key, { enabled: true, intensity: 72, speed: 1.05 });
      syncRainCheckbox();
    }
  }, true);
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
