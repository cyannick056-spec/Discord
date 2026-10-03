const params = new URLSearchParams(location.search);
const previewMode = params.has('editorPreview');
const activityTicket = params.get('ticket') || '';
const activityInstance = params.get('instance_id') || `local-${activityTicket.split('.').at(-1) || 'preview'}`;
const HOME_KEYS = [
  'home-landscape-16x9', 'home-landscape-4x3',
  'home-portrait-16x9', 'home-portrait-4x3',
  'home-window-16x9', 'home-window-4x3',
];
const SCENES = {
  'walnut-den': {
    id: 'walnut', name: 'Noche nogal', subtitle: 'Cálida · madera suave',
    furniture: '/rooms/props/tv-riser.webp',
  },
  'violet-den': {
    id: 'violet', name: 'Noche violeta', subtitle: 'Azul malva · tranquila',
    furniture: '/rooms/props/cabinet-black.webp',
  },
  'cozy-night': {
    id: 'morning', name: 'Mañana suave', subtitle: 'Clara · crema y cielo',
    furniture: '/rooms/props/gaming-desk.webp',
  },
};

let manifest = null;
let editorOpen = false;
let selectedId = '';
let currentEnvironment = 'walnut-den';
let currentTv = 'crt';
let dirty = false;
let dragging = null;
let furniture = null;
let fixedLight = null;
let panel = null;
let suppressBackdropObserver = false;

try { localStorage.setItem('shis-scene', 'home'); } catch {}
document.documentElement.classList.add('shis-simple-mode');

// La iluminación del escenario deja de ser un motor en tiempo real. Los fondos
// fijos ya llevan el ambiente visual; mantener el muestreo a 8 fps era trabajo
// desperdiciado, especialmente dentro del WebView de Discord en Android.
const nativeSetInterval = window.setInterval.bind(window);
window.setInterval = function(handler, timeout, ...args) {
  if (Number(timeout) === 125 && typeof handler === 'function' && handler.name === 'draw') {
    return nativeSetInterval(handler, previewMode ? 5000 : 1500, ...args);
  }
  return nativeSetInterval(handler, timeout, ...args);
};

const style = document.createElement('style');
style.id = 'shis-simple-mode-style';
style.textContent = `
html.shis-simple-mode #modeButton,
html.shis-simple-mode #arcadeScene { display:none !important; }
html.shis-simple-mode .room-lighting { display:none !important; }
html.shis-simple-mode .decoration-box[data-furniture="true"],
html.shis-simple-mode .decor-light-bulb { display:none !important; }
html.shis-simple-mode .room-scene { isolation:isolate; }
.shis-fixed-light,
.shis-fixed-furniture { position:absolute; pointer-events:none; user-select:none; }
.shis-fixed-light { inset:0; z-index:0; opacity:.72; }
.shis-fixed-furniture { z-index:1; left:50%; transform:translateX(-50%); object-fit:contain; max-width:none; }
html.shis-simple-mode .tv-scene { z-index:3 !important; }
html.shis-simple-mode #decorationLayer { z-index:6 !important; }
html.shis-simple-mode #roomBackdrop { z-index:-2 !important; }
html.shis-simple-mode [data-shis-scene="walnut"] .shis-fixed-light {
  background:radial-gradient(ellipse at 50% 49%, rgba(255,197,126,.10), transparent 34%), linear-gradient(180deg, rgba(21,17,20,.04), rgba(9,8,11,.12));
}
html.shis-simple-mode [data-shis-scene="violet"] .shis-fixed-light {
  background:radial-gradient(ellipse at 51% 46%, rgba(151,145,214,.12), transparent 35%), linear-gradient(180deg, rgba(31,29,51,.02), rgba(7,8,16,.13));
}
html.shis-simple-mode [data-shis-scene="morning"] .shis-fixed-light {
  background:radial-gradient(ellipse at 30% 18%, rgba(255,244,207,.24), transparent 40%), linear-gradient(180deg, rgba(255,238,206,.07), rgba(197,218,229,.02));
}
html.shis-simple-mode [data-shis-scene="morning"] #roomBackdrop img { filter:brightness(1.23) saturate(.84) contrast(.94) sepia(.06) !important; }
html.shis-simple-mode [data-shis-scene="walnut"] #roomBackdrop img { filter:brightness(.91) saturate(.90) contrast(1.02) !important; }
html.shis-simple-mode [data-shis-scene="violet"] #roomBackdrop img { filter:brightness(.90) saturate(.88) contrast(1.01) !important; }

@media (orientation:portrait) and (min-height:430px) {
  .shis-fixed-furniture { top:44.5%; width:86vw; max-height:31dvh; }
  [data-shis-scene="walnut"] .shis-fixed-furniture { width:67vw; top:45.5%; }
  [data-shis-scene="violet"] .shis-fixed-furniture { width:88vw; top:45%; }
  [data-shis-scene="morning"] .shis-fixed-furniture { width:91vw; top:44%; }
}
@media (orientation:landscape) and (min-height:361px) {
  .shis-fixed-furniture { top:67%; width:min(58vw,760px); max-height:30dvh; }
  [data-shis-scene="walnut"] .shis-fixed-furniture { width:min(43vw,620px); top:68%; }
  [data-shis-scene="violet"] .shis-fixed-furniture { width:min(55vw,760px); top:67%; }
  [data-shis-scene="morning"] .shis-fixed-furniture { width:min(60vw,820px); top:66%; }
}
@media (max-height:360px), (max-width:520px) and (max-height:400px) {
  .shis-fixed-furniture,.shis-fixed-light { display:none !important; }
}

/* Pantalla plana: no forma parte del mueble. Se mantiene flotando arriba de él. */
html.shis-simple-mode [data-shis-tv="flat"] .tv-face {
  grid-template-columns:minmax(0,1fr) !important;
  grid-template-rows:minmax(0,1fr) !important;
  padding:clamp(3px,.45vw,6px) !important;
  gap:0 !important;
  border-radius:4px !important;
  background:linear-gradient(145deg,#1d2228,#090b0e) !important;
  border:1px solid rgba(160,171,181,.42) !important;
  box-shadow:0 13px 30px rgba(0,0,0,.50), inset 0 0 0 1px rgba(255,255,255,.055) !important;
}
html.shis-simple-mode [data-shis-tv="flat"] .speaker-column,
html.shis-simple-mode [data-shis-tv="flat"] .bottom-bar,
html.shis-simple-mode [data-shis-tv="flat"] .tv-status-light { display:none !important; }
html.shis-simple-mode [data-shis-tv="flat"] .screen-wrap {
  grid-column:1 !important; grid-row:1 !important; padding:2px !important;
  border-radius:2px !important; background:#07090b !important;
}
html.shis-simple-mode [data-shis-tv="flat"] .player { border-radius:1px !important; }
@media (orientation:portrait) and (min-height:430px) {
  html.shis-simple-mode [data-shis-tv="flat"] .tv-scene,
  html.shis-simple-mode [data-shis-tv="flat"] .tv-scene.aspect-4x3 { width:min(86vw,575px) !important; top:10.5dvh !important; bottom:auto !important; }
}
@media (orientation:landscape) and (min-height:361px) {
  html.shis-simple-mode [data-shis-tv="flat"] .tv-scene,
  html.shis-simple-mode [data-shis-tv="flat"] .tv-scene.aspect-4x3 { width:min(68vw,980px) !important; }
}

/* El editor nuevo trabaja sobre la escena real: no hay iframe ni segundo render. */
#shisSimpleEditor { position:fixed; inset:0; z-index:1200; pointer-events:none; font:500 13px/1.25 system-ui,sans-serif; color:#edf4f7; }
#shisSimpleEditor[hidden] { display:none !important; }
#shisSimpleEditor .simple-card { pointer-events:auto; position:absolute; left:50%; bottom:max(9px,env(safe-area-inset-bottom)); transform:translateX(-50%); width:min(720px,calc(100vw - 14px)); max-height:min(42dvh,390px); overflow:auto; overscroll-behavior:contain; background:rgba(9,14,20,.965); border:1px solid rgba(133,158,172,.45); border-radius:16px; box-shadow:0 16px 50px rgba(0,0,0,.62); padding:10px; }
#shisSimpleEditor header { display:flex; align-items:center; gap:8px; position:sticky; top:-10px; z-index:3; margin:-10px -10px 8px; padding:9px 10px; background:rgba(9,14,20,.985); border-bottom:1px solid rgba(128,151,164,.20); }
#shisSimpleEditor header strong { font-size:14px; flex:1; }
#shisSimpleEditor header small { opacity:.65; white-space:nowrap; }
#shisSimpleEditor button,#shisSimpleEditor select,#shisSimpleEditor .simple-upload { min-height:40px; border:1px solid #435662; border-radius:10px; color:#eff7fa; background:#18242d; padding:7px 10px; font:inherit; }
#shisSimpleEditor button { cursor:pointer; }
#shisSimpleEditor button[aria-pressed="true"] { border-color:#86b4c6; background:#284653; box-shadow:inset 0 0 0 1px rgba(146,208,229,.16); }
#shisSimpleEditor .simple-row { display:flex; align-items:center; gap:7px; margin:7px 0; }
#shisSimpleEditor .simple-row.wrap { flex-wrap:wrap; }
#shisSimpleEditor .simple-row > label:first-child { opacity:.72; min-width:58px; }
#shisSimpleEditor .simple-scenes { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:6px; }
#shisSimpleEditor .simple-scenes button { min-width:0; padding:7px 5px; }
#shisSimpleEditor .simple-scenes strong,#shisSimpleEditor .simple-scenes small { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
#shisSimpleEditor .simple-scenes small { margin-top:2px; opacity:.62; font-size:10px; }
#shisSimpleEditor select { flex:1; min-width:0; }
#shisSimpleEditor input[type="range"] { flex:1; min-width:90px; accent-color:#8cbac7; }
#shisSimpleEditor output { width:44px; text-align:right; font-variant-numeric:tabular-nums; opacity:.8; }
#shisSimpleEditor .simple-upload { display:inline-flex; align-items:center; justify-content:center; position:relative; overflow:hidden; cursor:pointer; font-weight:700; }
#shisSimpleEditor .simple-upload input { position:absolute; inset:0; opacity:0; cursor:pointer; }
#shisSimpleEditor .simple-actions { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:6px; }
#shisSimpleEditor .simple-actions button { min-width:0; padding:6px 3px; }
#shisSimpleEditor .simple-save { width:100%; background:#234b5e; border-color:#578ca2; font-weight:750; }
#shisSimpleEditor .simple-status { min-height:16px; opacity:.78; font-size:11px; text-align:center; }
html.shis-simple-editing #decorationLayer { touch-action:none !important; }
html.shis-simple-editing .decoration-box[data-simple-edit="true"] { cursor:grab; }
html.shis-simple-editing .decoration-box[data-simple-selected="true"]::after { content:""; position:absolute; inset:-5px; border:2px solid rgba(151,220,243,.9); border-radius:8px; pointer-events:none; box-shadow:0 0 0 1px rgba(0,0,0,.4); }
html.shis-simple-editing .decoration-box[data-simple-selected="true"] { z-index:210 !important; }

@media (orientation:landscape) and (min-width:740px) and (min-height:361px) {
  #shisSimpleEditor .simple-card { left:auto; right:max(9px,env(safe-area-inset-right)); top:50%; bottom:auto; transform:translateY(-50%); width:min(330px,36vw); max-height:calc(100dvh - 18px); }
}
@media (max-width:420px) {
  #shisSimpleEditor .simple-card { max-height:44dvh; padding:8px; }
  #shisSimpleEditor header { margin:-8px -8px 6px; padding:8px; }
  #shisSimpleEditor .simple-scenes small { display:none; }
  #shisSimpleEditor .simple-row { margin:5px 0; gap:5px; }
  #shisSimpleEditor button,#shisSimpleEditor select,#shisSimpleEditor .simple-upload { min-height:38px; padding:6px 8px; }
}
`;
document.head.append(style);

function withTicket(path) {
  const url = new URL(path, location.origin);
  if (activityTicket) url.searchParams.set('ticket', activityTicket);
  return `${url.pathname}${url.search}`;
}
function hostHeaders(extra = {}) {
  let token = '';
  try { token = localStorage.getItem(`shis-host-${activityInstance}`) || ''; } catch {}
  return {
    ...extra,
    'X-Host-Token': token,
    'X-Activity-Instance': activityInstance,
    'X-Activity-Ticket': activityTicket,
  };
}
function isCompactView() {
  return innerHeight <= 360 || (innerWidth <= 520 && innerHeight <= 400) || (innerWidth <= 360 && innerHeight <= 520);
}
function currentView() {
  if (isCompactView()) return 'window';
  return innerHeight > innerWidth ? 'portrait' : 'landscape';
}
function currentAspect() {
  return document.querySelector('#tvScene')?.classList.contains('aspect-4x3') ? '4:3' : '16:9';
}
function currentKey() {
  return `home-${currentView()}-${currentAspect() === '4:3' ? '4x3' : '16x9'}`;
}
function personalItem(item) {
  return item && item.kind !== 'viewer-slot' && item.kind !== 'builtin' && item.kind !== 'light';
}
function defaultPlacement(view = currentView()) {
  return {
    x: 50, y: view === 'portrait' ? 61 : view === 'window' ? 50 : 66,
    width: view === 'portrait' ? 17 : view === 'window' ? 13 : 11,
    rotation: 0, opacity: 1, z: 10, hidden: false, anchor: 'scene', locked: false,
    brightness: 100, saturation: 100, hue: 0, shadow: 22,
  };
}
function nearestPlacement(item) {
  const preferred = item?.placements?.[currentKey()];
  if (preferred) return preferred;
  return Object.values(item?.placements || {}).find(Boolean) || null;
}
function ensurePlacement(item, key = currentKey()) {
  item.placements ||= {};
  if (!item.placements[key]) {
    const from = nearestPlacement(item);
    item.placements[key] = from ? structuredClone(from) : defaultPlacement(key.includes('portrait') ? 'portrait' : key.includes('window') ? 'window' : 'landscape');
  }
  const p = item.placements[key];
  p.brightness ??= 100; p.saturation ??= 100; p.hue ??= 0; p.shadow ??= 22;
  delete p.light; delete p.material; delete p.contactShadow; delete p.crop;
  return p;
}
function fixedPresentation(key, environment = currentEnvironment, tv = currentTv) {
  const portrait = key.includes('portrait');
  const flat = tv === 'flat';
  return {
    environment,
    style: 'classic',
    camera: { x: 0, y: 0, zoom: 1 },
    tv: { x: 0, y: flat ? (portrait ? -3 : -2) : 0, zoom: flat ? (portrait ? .68 : .62) : (portrait ? .72 : .58) },
    tvModel: flat ? 'flat-modern' : 'original',
    tvSupport: 'free',
    video: { fit: 'contain', auto: true },
    screen: { rounded: !flat },
    ambient: 100,
    mood: {
      daytime: environment === 'cozy-night' ? 'morning' : 'night', preset: 'neutral', intensity: 0,
      tvGlow: 0, rim: 0, cabinet: 0, floor: 0, practicalLights: false,
      zones: { tv: { influence: 0 }, figures: { influence: 0 } },
    },
    reflection: { enabled: false, intensity: 0, table: 0, floor: 0, blur: 0, texture: 0 },
  };
}
function normalizeFixedScenes() {
  if (!manifest) return;
  manifest.presentations ||= {};
  for (const key of HOME_KEYS) {
    const old = manifest.presentations[key] || {};
    manifest.presentations[key] = {
      ...old,
      ...fixedPresentation(key),
    };
    delete manifest.presentations[key].background;
    delete manifest.presentations[key].rain;
    delete manifest.presentations[key].supportId;
  }
  manifest.items = (manifest.items || []).filter(item => item?.kind !== 'builtin' && item?.kind !== 'light');
  for (const item of manifest.items.filter(personalItem)) {
    for (const p of Object.values(item.placements || {})) {
      if (!p) continue;
      delete p.light; delete p.material; delete p.contactShadow; delete p.crop;
      p.brightness = 100; p.saturation = 100; p.hue = 0; p.shadow = 22;
    }
  }
}

function ensureFixedLayers() {
  const room = document.querySelector('.room-scene');
  const tv = document.querySelector('#tvScene');
  if (!room || !tv) return false;
  if (!fixedLight) {
    fixedLight = document.createElement('div');
    fixedLight.className = 'shis-fixed-light';
    fixedLight.setAttribute('aria-hidden', 'true');
    room.insertBefore(fixedLight, tv);
  }
  if (!furniture) {
    furniture = document.createElement('img');
    furniture.className = 'shis-fixed-furniture';
    furniture.alt = '';
    furniture.draggable = false;
    furniture.setAttribute('aria-hidden', 'true');
    room.insertBefore(furniture, tv);
  }
  return true;
}
function enforceHome() {
  const stage = document.querySelector('#stage');
  const player = document.querySelector('#player');
  const home = document.querySelector('#homeScreenMount');
  const arcade = document.querySelector('#arcadeScene');
  const mode = document.querySelector('#modeButton');
  if (stage) { stage.classList.remove('arcade-mode'); stage.classList.add('home-mode'); }
  if (arcade) arcade.hidden = true;
  if (mode) mode.hidden = true;
  if (player && home && player.parentElement !== home) home.append(player);
}
function visualEnvironmentFromManifest() {
  const p = manifest?.presentations?.[currentKey()];
  return SCENES[p?.environment] ? p.environment : currentEnvironment;
}
function visualTvFromManifest() {
  return manifest?.presentations?.[currentKey()]?.tvModel === 'flat-modern' ? 'flat' : currentTv;
}
function applyVisualScene(environment = currentEnvironment, tv = currentTv) {
  currentEnvironment = SCENES[environment] ? environment : 'walnut-den';
  currentTv = tv === 'flat' ? 'flat' : 'crt';
  enforceHome();
  if (!ensureFixedLayers()) return;
  const stage = document.querySelector('#stage');
  const info = SCENES[currentEnvironment];
  if (stage) {
    stage.dataset.shisScene = info.id;
    stage.dataset.shisTv = currentTv;
  }
  furniture.src = info.furniture;
  furniture.dataset.scene = info.id;
  const backdrop = document.querySelector('#roomBackdrop img');
  if (backdrop) {
    const variant = currentView() === 'portrait' ? 'portrait' : 'wide';
    const src = `/rooms/${currentEnvironment}-${variant}.webp`;
    if (!backdrop.src.endsWith(src)) {
      suppressBackdropObserver = true;
      backdrop.src = src;
      backdrop.hidden = false;
      queueMicrotask(() => { suppressBackdropObserver = false; });
    }
  }
  syncPanel();
}

async function loadManifest() {
  const response = await fetch(withTicket('/api/decorations'), { cache: 'no-store' });
  if (!response.ok) throw new Error('No se pudo cargar la decoración');
  manifest = await response.json();
  currentEnvironment = visualEnvironmentFromManifest();
  currentTv = visualTvFromManifest();
  applyVisualScene();
  return manifest;
}

function createPanel() {
  if (panel) return panel;
  panel = document.createElement('section');
  panel.id = 'shisSimpleEditor';
  panel.hidden = true;
  panel.innerHTML = `
    <div class="simple-card">
      <header><strong>Editar figuritas</strong><small id="shisSimpleView"></small><button type="button" data-simple-action="close" aria-label="Cerrar">×</button></header>
      <div class="simple-scenes">
        ${Object.entries(SCENES).map(([id, scene]) => `<button type="button" data-simple-scene="${id}"><strong>${scene.name}</strong><small>${scene.subtitle}</small></button>`).join('')}
      </div>
      <div class="simple-row"><label>Pantalla</label><button type="button" data-simple-tv="crt">TV CRT</button><button type="button" data-simple-tv="flat">Plana</button></div>
      <div class="simple-row"><label>Figurita</label><select id="shisSimpleItem" aria-label="Figurita"></select><label class="simple-upload">＋ PNG/GIF<input id="shisSimpleUpload" type="file" accept="image/png,image/gif" /></label></div>
      <div class="simple-row"><label>Tamaño</label><input id="shisSimpleSize" type="range" min="2" max="80" step=".2"/><output id="shisSimpleSizeOut"></output></div>
      <div class="simple-row"><label>Giro</label><input id="shisSimpleRotation" type="range" min="-180" max="180" step="1"/><output id="shisSimpleRotationOut"></output></div>
      <div class="simple-actions">
        <button type="button" data-simple-action="back">Capa −</button>
        <button type="button" data-simple-action="front">Capa +</button>
        <button type="button" data-simple-action="lock">Bloquear</button>
        <button type="button" data-simple-action="hide">Ocultar</button>
        <button type="button" data-simple-action="delete">Borrar</button>
      </div>
      <p class="simple-status" id="shisSimpleStatus">Arrastra una figurita directamente sobre la escena.</p>
      <button type="button" class="simple-save" data-simple-action="save">Guardar</button>
    </div>`;
  document.body.append(panel);

  panel.addEventListener('click', event => {
    const target = event.target.closest('button');
    if (!target) return;
    const scene = target.dataset.simpleScene;
    const tv = target.dataset.simpleTv;
    const action = target.dataset.simpleAction;
    if (scene) {
      currentEnvironment = scene;
      normalizeFixedScenes(); dirty = true; applyVisualScene(); setStatus(`${SCENES[scene].name} preparada.`); return;
    }
    if (tv) {
      currentTv = tv; normalizeFixedScenes(); dirty = true; applyVisualScene(); setStatus(tv === 'flat' ? 'Pantalla plana separada del mueble.' : 'TV CRT restaurada.'); return;
    }
    if (action === 'close') return closeEditor();
    if (action === 'save') return void saveManifest();
    const item = selectedItem();
    if (!item) return;
    const p = ensurePlacement(item);
    if (action === 'back') p.z = Math.max(0, (p.z || 0) - 1);
    if (action === 'front') p.z = Math.min(99, (p.z || 0) + 1);
    if (action === 'lock') p.locked = !p.locked;
    if (action === 'hide') p.hidden = !p.hidden;
    if (action === 'delete') {
      manifest.items = manifest.items.filter(entry => entry.id !== item.id);
      document.querySelectorAll(`.decoration-box[data-id="${CSS.escape(item.id)}"]`).forEach(node => node.remove());
      selectedId = ''; dirty = true; refreshItems(); syncPanel(); setStatus('Figurita borrada.'); return;
    }
    dirty = true; applyPlacement(item.id, p); syncPanel();
  });

  panel.querySelector('#shisSimpleItem').addEventListener('change', event => selectItem(event.target.value));
  panel.querySelector('#shisSimpleSize').addEventListener('input', event => {
    const item = selectedItem(); if (!item) return; const p = ensurePlacement(item);
    p.width = Number(event.target.value); dirty = true; applyPlacement(item.id, p); syncPanel(false);
  });
  panel.querySelector('#shisSimpleRotation').addEventListener('input', event => {
    const item = selectedItem(); if (!item) return; const p = ensurePlacement(item);
    p.rotation = Number(event.target.value); dirty = true; applyPlacement(item.id, p); syncPanel(false);
  });
  panel.querySelector('#shisSimpleUpload').addEventListener('change', event => void uploadFigure(event.target));
  return panel;
}
function setStatus(text) {
  const el = panel?.querySelector('#shisSimpleStatus');
  if (el) el.textContent = text;
}
function selectedItem() {
  return manifest?.items?.find(item => item.id === selectedId && personalItem(item));
}
function refreshItems() {
  if (!panel || !manifest) return;
  const select = panel.querySelector('#shisSimpleItem');
  const items = manifest.items.filter(personalItem);
  const previous = selectedId;
  select.replaceChildren(...items.map(item => new Option(item.name || 'Figurita', item.id)));
  if (items.some(item => item.id === previous)) selectedId = previous;
  else selectedId = items[0]?.id || '';
  select.value = selectedId;
  markEditableBoxes();
}
function syncPanel(refresh = true) {
  if (!panel) return;
  panel.querySelector('#shisSimpleView').textContent = `${currentView() === 'portrait' ? 'Vertical' : currentView() === 'window' ? 'Ventana' : 'Horizontal'} · ${currentAspect()}`;
  panel.querySelectorAll('[data-simple-scene]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.simpleScene === currentEnvironment)));
  panel.querySelectorAll('[data-simple-tv]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.simpleTv === currentTv)));
  if (refresh) refreshItems();
  const item = selectedItem();
  const size = panel.querySelector('#shisSimpleSize');
  const rotation = panel.querySelector('#shisSimpleRotation');
  const sizeOut = panel.querySelector('#shisSimpleSizeOut');
  const rotationOut = panel.querySelector('#shisSimpleRotationOut');
  const p = item ? ensurePlacement(item) : null;
  size.disabled = rotation.disabled = !p;
  if (p) {
    size.value = String(p.width); rotation.value = String(p.rotation);
    sizeOut.value = `${Math.round(p.width * 10) / 10}%`; rotationOut.value = `${Math.round(p.rotation)}°`;
  } else { sizeOut.value = rotationOut.value = '—'; }
  panel.querySelector('[data-simple-action="lock"]').setAttribute('aria-pressed', String(Boolean(p?.locked)));
  panel.querySelector('[data-simple-action="hide"]').setAttribute('aria-pressed', String(Boolean(p?.hidden)));
  document.querySelectorAll('.decoration-box[data-simple-selected="true"]').forEach(box => box.dataset.simpleSelected = 'false');
  if (selectedId) document.querySelectorAll(`.decoration-box[data-id="${CSS.escape(selectedId)}"]`).forEach(box => box.dataset.simpleSelected = 'true');
}
function markEditableBoxes() {
  if (!manifest) return;
  const ids = new Set(manifest.items.filter(personalItem).map(item => item.id));
  document.querySelectorAll('.decoration-box[data-id]').forEach(box => {
    box.dataset.simpleEdit = String(ids.has(box.dataset.id));
  });
}
function placementBasis(p) {
  const layer = document.querySelector('#decorationLayer');
  const frame = document.querySelector('.screen-wrap');
  const target = p.anchor === 'frame' && frame?.getBoundingClientRect().width ? frame : layer;
  return target?.getBoundingClientRect();
}
function applyPlacement(id, p) {
  const layer = document.querySelector('#decorationLayer');
  const room = layer?.getBoundingClientRect();
  const basis = placementBasis(p);
  if (!layer || !room || !basis) return;
  document.querySelectorAll(`.decoration-box[data-id="${CSS.escape(id)}"]`).forEach(box => {
    box.style.left = `${basis.left - room.left + basis.width * p.x / 100}px`;
    box.style.top = `${basis.top - room.top + basis.height * p.y / 100}px`;
    box.style.width = `${basis.width * p.width / 100}px`;
    box.style.opacity = String(p.opacity ?? 1);
    box.style.zIndex = String((p.z ?? 10) + (p.foreground ? 100 : 0));
    box.style.transform = `translate(-50%, -50%) rotate(${p.rotation || 0}deg)`;
    box.style.display = p.hidden ? 'none' : '';
    box.dataset.simpleEdit = 'true';
    box.dataset.simpleSelected = String(id === selectedId);
  });
}
function selectItem(id) {
  if (!manifest?.items?.some(item => item.id === id && personalItem(item))) return;
  selectedId = id;
  ensurePlacement(selectedItem());
  syncPanel();
  setStatus('Arrástrala con un dedo. Tamaño y giro están abajo.');
}

async function uploadFigure(input) {
  const file = input.files?.[0]; input.value = '';
  if (!file || !manifest) return;
  const realSize = Object.getOwnPropertyDescriptor(Blob.prototype, 'size')?.get?.call(file) ?? file.size;
  if (!['image/png', 'image/gif'].includes(file.type)) return setStatus('Usa PNG o GIF.');
  if (realSize > 8 * 1024 * 1024) return setStatus('Máximo 8 MB.');
  try {
    setStatus('Subiendo figurita…');
    const response = await fetch('/api/decorations/assets', {
      method: 'POST', headers: hostHeaders({ 'Content-Type': file.type }), body: file,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
    const item = { id: crypto.randomUUID(), asset: body.asset, name: file.name.slice(0, 70), placements: {} };
    for (const key of HOME_KEYS) item.placements[key] = defaultPlacement(key.includes('portrait') ? 'portrait' : key.includes('window') ? 'window' : 'landscape');
    manifest.items.push(item); selectedId = item.id; dirty = true;
    refreshItems(); syncPanel();
    setStatus('Añadida. Se guardará al pulsar Guardar.');
  } catch (error) { setStatus(error instanceof Error ? error.message : 'No se pudo subir'); }
}

async function saveManifest() {
  if (!manifest) return;
  try {
    normalizeFixedScenes();
    setStatus('Guardando…');
    const response = await fetch('/api/decorations', {
      method: 'PUT', headers: hostHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(manifest),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
    dirty = false; applyVisualScene(); setStatus('Guardado ✓');
    // El editor clásico refresca cada 30 s; aquí mantenemos la escena ya actualizada
    // y el siguiente refresco natural sincroniza su copia interna sin abrir iframe.
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo guardar';
    setStatus(message.includes('401') || /clave|host|autoriz/i.test(message) ? 'Abre Ajustes como host y vuelve a intentar.' : message);
  }
}

function openEditor() {
  if (previewMode) return;
  createPanel();
  void (manifest ? Promise.resolve() : loadManifest()).then(() => {
    normalizeFixedScenes();
    editorOpen = true; panel.hidden = false;
    document.documentElement.classList.add('shis-simple-editing');
    document.querySelector('#settingsPanel')?.setAttribute('hidden', '');
    applyVisualScene(); refreshItems(); syncPanel(); markEditableBoxes();
    setStatus('Arrastra tus figuritas directamente. No hay segundo render.');
  }).catch(error => setStatus(error instanceof Error ? error.message : 'No se pudo abrir'));
}
function closeEditor() {
  if (dirty && !confirm('Hay cambios sin guardar. ¿Cerrar de todos modos?')) return;
  editorOpen = false; panel.hidden = true; document.documentElement.classList.remove('shis-simple-editing');
  dragging = null;
  document.querySelectorAll('.decoration-box[data-simple-selected="true"]').forEach(box => box.dataset.simpleSelected = 'false');
}

function installDragLayer() {
  const layer = document.querySelector('#decorationLayer');
  if (!layer || layer.dataset.simpleDragInstalled) return;
  layer.dataset.simpleDragInstalled = 'true';
  layer.addEventListener('pointerdown', event => {
    if (!editorOpen || event.button !== 0) return;
    const box = event.target.closest('.decoration-box[data-id]');
    if (!box || box.dataset.simpleEdit !== 'true') return;
    const item = manifest?.items?.find(entry => entry.id === box.dataset.id && personalItem(entry));
    if (!item) return;
    selectItem(item.id);
    const p = ensurePlacement(item);
    event.preventDefault(); event.stopImmediatePropagation();
    if (p.locked) return setStatus('Está bloqueada. Toca Bloquear para liberarla.');
    const basis = placementBasis(p); if (!basis?.width || !basis.height) return;
    dragging = { pointerId: event.pointerId, item, p, startX: event.clientX, startY: event.clientY, x: p.x, y: p.y, basis };
    box.setPointerCapture?.(event.pointerId);
  }, true);
  layer.addEventListener('pointermove', event => {
    if (!dragging || event.pointerId !== dragging.pointerId) return;
    event.preventDefault(); event.stopImmediatePropagation();
    dragging.p.x = Math.max(-30, Math.min(130, dragging.x + (event.clientX - dragging.startX) / dragging.basis.width * 100));
    dragging.p.y = Math.max(-35, Math.min(145, dragging.y + (event.clientY - dragging.startY) / dragging.basis.height * 100));
    dirty = true; applyPlacement(dragging.item.id, dragging.p);
  }, true);
  const end = event => {
    if (!dragging || event.pointerId !== dragging.pointerId) return;
    event.preventDefault(); event.stopImmediatePropagation();
    dragging = null; syncPanel(false);
  };
  layer.addEventListener('pointerup', end, true);
  layer.addEventListener('pointercancel', end, true);
}

function install() {
  enforceHome(); ensureFixedLayers(); createPanel(); installDragLayer();
  document.addEventListener('click', event => {
    const button = event.target.closest?.('#editorButton');
    if (!button) return;
    event.preventDefault(); event.stopImmediatePropagation(); openEditor();
  }, true);

  const stage = document.querySelector('#stage');
  if (stage) new MutationObserver(() => {
    if (stage.classList.contains('arcade-mode')) enforceHome();
    markEditableBoxes();
  }).observe(stage, { attributes: true, attributeFilter: ['class'] });
  const layer = document.querySelector('#decorationLayer');
  if (layer) new MutationObserver(() => { markEditableBoxes(); if (editorOpen) syncPanel(false); }).observe(layer, { childList: true, subtree: true });
  const backdrop = document.querySelector('#roomBackdrop img');
  if (backdrop) new MutationObserver(() => { if (!suppressBackdropObserver) applyVisualScene(); }).observe(backdrop, { attributes: true, attributeFilter: ['src', 'hidden'] });

  window.addEventListener('resize', () => { applyVisualScene(); if (editorOpen) syncPanel(); }, { passive: true });
  window.addEventListener('shis-aspect-change', () => { if (manifest) { applyVisualScene(); if (editorOpen) syncPanel(); } });
  void loadManifest().catch(() => { applyVisualScene(); });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
else install();
