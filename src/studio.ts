import { duplicateInView } from './view-state';
import { applyLightingPreset, lightingPresets } from './lighting-presets';
import type { PlacementKey } from './decorations';
import { materials, furnitureColors, MAX_SCENE_ITEMS, type FurnitureMaterial } from '../material-catalog.mjs';
import { isSolidFurniture } from './furniture-appearance';
import type { Decoration, Manifest, Placement, RoomSnapshot } from './decorations';
import { perspectiveAngles, type Grade, type Mood, type Daytime, type Transform, type Zone } from './studio-model';
import { type Presentation, type TvPaint, type Reflection } from './presentation-model';
import { straightCorners, validCorners } from './perspective';
import { defaultRealPresentation } from '../real-room.mjs';
import { rooms, props, builtinUrl, visibleInRoom, type RoomId } from '../room-catalog.mjs';
import { tvModels } from '../tv-catalog.mjs';
import { prepareRoom, builtinDecoration, roomPlacement } from './modular-rooms';
import { compositionRestGroups } from '../room-compositions.mjs';
import {defaultLightResponse} from './light-response';
import {isSolidObject} from './object-finish';
import {initObjectTabs,showObjectTab,syncObjectTabs} from './object-tabs';

type Host = {
  draft(): Manifest; saved(): Manifest; item(): Decoration | undefined; key(): string; selected(): string[];
  select(id: string, additive?: boolean): void; change(group?: string): void; convert(p: Placement): boolean;
  command(command: string): void; status(message: string): void; create(item: Decoration): void;
  rest(ids: string[], supportId: string, authored?: boolean): void;
  compare(value: boolean): void; test(value: string): void; asset(path: string): string; resize(): void;
  restore(room: RoomSnapshot): void;
  background(file: File): Promise<string>;
  tool(tool: 'select' | 'pan' | 'tv' | 'camera' | 'screen' | 'warp'): void;
};
let host: Host | undefined;
let listSignature = '';
let librarySignature = '';
let appearance: Partial<Placement> | undefined;
let objectBrowserScroll=0;
function objectPanel(inspect:boolean) {
  const browser=$('studioObjectBrowser'),inspector=$('studioObjectInspector');if(!browser || !inspector) return;
  if(inspect && !browser.hidden) objectBrowserScroll=$('studioObjectList').scrollTop;
  browser.hidden=inspect;inspector.hidden=!inspect;
  const sidebar=document.querySelector('.editor-sidebar')!,scroll=document.querySelector<HTMLElement>('.studio-scroll')!,header=$('studioInspectorHeader');
  sidebar.classList.toggle('has-object-inspector',inspect);header.hidden=!inspect;
  if(inspect) scroll.before(header);else inspector.prepend(header);
  if(!inspect) requestAnimationFrame(()=>{$('studioObjectList').scrollTop=objectBrowserScroll;});
  scroll.scrollTop=0;host?.resize();
}
export function focusStudioItem() {
  if(!host?.item()) return;
  $('studioObjectsTab').click();objectPanel(true);showObjectTab('Appearance');$('studioObjectTitle').focus({preventScroll:true});
}
const zoomViews = ['home-landscape-16x9', 'home-landscape-4x3', 'home-portrait-16x9', 'home-portrait-4x3', 'home-window-16x9', 'home-window-4x3', 'arcade-landscape', 'arcade-portrait', 'arcade-window'];
const zoomLabels = ['Horizontal · 16:9', 'Horizontal · 4:3', 'Vertical · 16:9', 'Vertical · 4:3', 'Ventana pequeña · 16:9', 'Ventana pequeña · 4:3', 'Arcade horizontal', 'Arcade vertical', 'Arcade en ventana'];
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const names: Record<string, string> = { star: 'Estrella', robot: 'Robot', frame: 'Marco', poster: 'Póster' };
export function shapeAsset(shape = 'star') {
  const contents: Record<string, string> = {
    star: '<path d="M50 4 63 34 96 36 71 58 80 92 50 74 20 92 29 58 4 36 37 34Z" fill="#ffd675" stroke="#ac7549" stroke-width="3"/>',
    robot: '<path d="M29 61h42v32H29zM18 69h10v20H18zm54 0h10v20H72z" fill="#849ba3"/><rect x="14" y="19" width="72" height="45" rx="9" fill="#b7c4ca"/><path d="M50 19V7" stroke="#aaa" stroke-width="5"/><circle cx="50" cy="7" r="5" fill="#e8989d"/><circle cx="32" cy="38" r="7" fill="#253e4c"/><circle cx="68" cy="38" r="7" fill="#253e4c"/><path d="M35 53h30" stroke="#455b67" stroke-width="3"/>',
    frame: '<rect x="3" y="3" width="94" height="94" rx="3" fill="#b18a62"/><rect x="11" y="11" width="78" height="78" fill="#1e2936"/><path d="m17 75 28-31 16 18 13-22 10 35" fill="#6c9b94"/><circle cx="67" cy="29" r="9" fill="#e0be80"/>',
    poster: '<rect x="7" y="2" width="86" height="96" fill="#dfd6c4"/><rect x="13" y="8" width="74" height="69" fill="#243945"/><circle cx="50" cy="37" r="21" fill="#ce937f"/><path d="m17 76 23-23 18 16 15-17 11 24" fill="#719496"/><path d="M25 86h50" stroke="#736e63" stroke-width="3"/>',
  };
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${contents[shape] ?? contents.star}</svg>`)}`;
}
function panel(id: string, title: string, html: string, open = false) {
  return `<details id="${id}" class="studio-section" ${open ? 'open' : ''}><summary>${title}</summary><div class="studio-fields">${html}</div></details>`;
}
function range(id: string, text: string, min: number, max: number, step = 1) {
  return `<label>${text}<span><input id="${id}" type="range" min="${min}" max="${max}" step="${step}"/><output id="${id}Value"></output></span></label>`;
}
function buttons(entries: [string, string][]) {
  return entries.map(([cmd, label]) => `<button type="button" data-studio-command="${cmd}">${label}</button>`).join('');
}
function field(id: string, value: string | number | boolean) {
  const input = $<HTMLInputElement>(id); if (!input) return;
  if (document.activeElement !== input) {
    if (input.type === 'checkbox') input.checked = Boolean(value); else input.value = String(value);
  }
  const output = $<HTMLOutputElement>(`${id}Value`); if (output) output.value = String(value);
}
function room(): RoomSnapshot { const d = host!.draft(); return structuredClone({ items: d.items, ambient: d.ambient, mood: d.mood, presentations: d.presentations }); }
function presentation(): Presentation { return (host!.draft().presentations ??= {})[host!.key() as keyof NonNullable<Manifest['presentations']>] ??= {}; }
function supportItem(): Decoration | undefined {
  const scene = host!.draft().presentations?.[host!.key() as keyof NonNullable<Manifest['presentations']>];
  const items = host!.draft().items.filter(i => i.category === 'furniture' && visibleInRoom(i, scene) && i.placements[host!.key() as keyof typeof i.placements] && !i.placements[host!.key() as keyof typeof i.placements]!.hidden);
  if (scene?.supportId) return items.find(i => i.id === scene.supportId);
  return items.find(i => i.asset === 'cabinet') ?? items.find(i => props.find(p => p.id === i.asset)?.support);
}
function mood(): Mood { return presentation().mood ??= structuredClone(host!.draft().mood ?? { preset: 'neutral', intensity: 0, tvGlow: 100 }); }
function placements(): Placement[] {
  const ids = host!.selected(); return host!.draft().items.filter(i => ids.includes(i.id)).flatMap(i => {
    const p = i.placements[host!.key() as keyof typeof i.placements]; return p ? [p] : [];
  });
}
function grade(): Grade { const m = mood(), zone = $<HTMLSelectElement>('studioZone').value;
  return zone === 'all' ? m.grade ??= {} : (m.zones ??= {})[zone as Zone] ??= {}; }
export function rememberAssets() {
  const d = host!.draft(); d.library ??= [];
  for (const item of d.items.filter(i => i.kind !== 'viewer-slot' && i.kind !== 'light')) {
    const { placements: _p, group: _g, ...entry } = item;
    const found = d.library.find(i => i.id === item.id);
    if (found) Object.assign(found, entry); else if (d.library.length < 120) d.library.push(entry);
  }
}
export function initStudio(h: Host) {
  host = h;
  const sidebar = document.querySelector<HTMLElement>('.editor-sidebar')!;
  const old = [...sidebar.children];
  sidebar.innerHTML = '<div class="studio-tabs" role="tablist" aria-label="Panel de edición"><button id="studioObjectsTab" role="tab" aria-selected="true" aria-controls="studioObjects">Objetos</button><button id="studioLightsTab" role="tab" aria-selected="false" aria-controls="studioLights">Luces</button><button id="studioMoodTab" role="tab" aria-selected="false" aria-controls="studioMood">Ambiente</button><button id="studioCollapse" aria-label="Plegar panel" aria-expanded="true">⌄</button></div><div class="studio-scroll"><section id="studioObjects" role="tabpanel" aria-labelledby="studioObjectsTab"></section><section id="studioLights" role="tabpanel" aria-labelledby="studioLightsTab" hidden></section><section id="studioMood" role="tabpanel" aria-labelledby="studioMoodTab" hidden></section></div>';
  const objects = $('studioObjects'), lights = $('studioLights'), environment = $('studioMood');
  $('studioCollapse').insertAdjacentHTML('beforebegin', '<button id="studioSceneTab" role="tab" aria-selected="false" aria-controls="studioScene">Escena</button>');
  document.querySelector('.studio-scroll')!.insertAdjacentHTML('beforeend', '<section id="studioScene" role="tabpanel" aria-labelledby="studioSceneTab" hidden></section>');
  $('studioScene').innerHTML = '<p class="studio-note">Cada vista guarda sus objetos, luces y encuadre por separado. Guardar esta vista no cambia las demás. El zoom de la vista previa solo ayuda a editar.</p>' +
    panel('studioBackground', 'Presets completos · profundidad nocturna', '<div id="studioRoomGallery" class="studio-room-gallery">' + rooms.filter(r => r.id !== 'cozy-night').map(r => `<button type="button" data-studio-room="${r.id}" aria-pressed="false"><img src="/rooms/${r.id}-wide.webp" alt="" loading="lazy"/><span>${r.name}</span><small>${r.description}</small></button>`).join('') + '</div><p class="studio-note">Cada preset prepara fondo, TV, muebles, lámparas y sombras en esta vista. Conserva tus decoraciones personales. Reaplicarlo restablece sus piezas y encuadre; puedes deshacerlo.</p><label>Escenario<select id="studioSceneStyle">' + rooms.map(r => `<option value="${r.id}">${r.name}</option>`).join('') + '<option value="custom">Mi imagen de fondo</option></select></label><label class="editor-upload">Subir fondo<input id="studioBackgroundUpload" type="file" accept="image/png,image/jpeg,image/webp,image/gif"/></label><label>Reutilizar imagen<select id="studioBackgroundAsset"></select></label><p class="studio-note">Después de aplicarlo, mueve o quita sus piezas en Objetos. La luz de las lámparas y los reflejos de la TV se calculan en tiempo real; el fondo no tiene reflejos de pantalla pintados.</p>', true) +
    panel('studioViewZoom', 'Zoom independiente por vista', '<p class="studio-note">Cada zoom pertenece a su vista. Cambia Vista y Tamaño TV arriba y guarda la vista que estés ajustando.</p>' + zoomViews.map((key, i) => range('studioViewZoom' + i, zoomLabels[i], .5, 2.5, .05)).join(''), true) +
    panel('studioCamera', 'Encuadre del escenario', range('studioCameraX', 'Mover horizontalmente', -50, 50) + range('studioCameraY', 'Mover verticalmente', -50, 50) + range('studioCameraZoom', 'Zoom del escenario', .5, 2.5, .05) + '<div class="studio-buttons">' + buttons([['cameraTool', 'Encuadrar con el ratón'], ['resetCamera', 'Restablecer']]) + '</div>') +
    panel('studioTv', 'Modelo, posición y tamaño de la TV', '<label>Televisión<select id="studioTvModel">' + tvModels.map(t => `<option value="${t.id}">${t.name}</option>`).join('') + '</select></label><label>Apoyo de la TV<select id="studioTvSupport"><option value="free">Libre · mover manualmente</option><option value="cabinet">Apoyada sobre el mueble</option><option value="floor">Apoyada sobre el suelo</option></select></label>' + '<label>Mueble o base<select id="studioSupportObject"></select></label><label>Modelo del mueble de apoyo<select id="studioSupportStyle">' + props.filter(p => p.support).map(p => `<option value="${p.id}">${p.name}</option>`).join('') + '</select></label>' + range('studioTvX', 'Posición horizontal', -80, 80) + range('studioTvY', 'Posición vertical', -80, 80) + range('studioTvZoom', 'Tamaño de la TV', .3, 2.5, .05) + '<div class="studio-buttons">' + buttons([['tvTool', 'Mover TV en la escena'], ['resetTv', 'Restablecer']]) + '</div><p class="studio-note">Apoyada sigue al mueble cuando lo mueves. Al arrastrar la TV vuelve a Libre. Los modelos nuevos conservan sus proporciones; también puedes afinar la pantalla por separado.</p>') +
    panel('studioTvPaint', 'Color de la TV · avanzado', '<label class="studio-check"><input id="studioTvPaintEnabled" type="checkbox"/> Colorear la carcasa</label><div class="studio-buttons">' + ['gray', 'blue', 'pink', 'cream', 'black'].map((v, i) => `<button type="button" data-studio-tv-paint="${v}">${['Gris', 'Azul', 'Rosa', 'Crema', 'Negro'][i]}</button>`).join('') + '</div><label>Carcasa<input id="studioTvPaintBody" type="color"/></label><label>Marco de pantalla<input id="studioTvPaintBezel" type="color"/></label><label>Panel inferior y botones<input id="studioTvPaintPanel" type="color"/></label>' + range('studioTvPaintStrength', 'Mezcla de color', 0, 100) + range('studioTvPaintHue', 'Tono', -180, 180) + range('studioTvPaintSaturation', 'Saturación', 0, 200) + range('studioTvPaintExposure', 'Exposición', -60, 60) + range('studioTvPaintContrast', 'Contraste', 50, 150) + '<label>Acabado<select id="studioTvPaintFinish"><option value="matte">Mate</option><option value="satin">Satinado</option><option value="gloss">Brillante</option></select></label><div class="studio-buttons">' + buttons([['resetTvPaint', 'Color original de la TV']]) + '</div><p class="studio-note">Conserva la textura y las sombras. El acabado cambia la respuesta a la luz del vídeo. La pantalla mantiene sus colores.</p>') +
    panel('studioScreen', 'Pantalla · independiente de la TV', '<label class="studio-check"><input id="studioScreenRounded" type="checkbox"/> Esquinas redondeadas</label>' + range('studioScreenX', 'Posición horizontal de pantalla', -50, 50, .5) + range('studioScreenY', 'Posición vertical de pantalla', -50, 50, .5) + range('studioScreenWidth', 'Ancho de pantalla', 50, 150, .5) + range('studioScreenHeight', 'Alto de pantalla', 50, 150, .5) + '<div class="studio-buttons">' + buttons([['screenTool', 'Ajustar pantalla con el ratón'], ['resetScreen', 'Restablecer pantalla']]) + '</div><p class="studio-note">Ajusta el área de reproducción dentro del marco. El zoom del vídeo se controla por separado abajo.</p>') +
    panel('studioVideo', 'Encuadre del vídeo', '<label>Contenido de Switch / vídeo<select id="studioVideoFit"><option value="auto">Automático · detectar bandas y llenar</option><option value="cover">Llenar pantalla · recorta bordes</option><option value="contain">Ajustar a pantalla · mostrar todo</option></select></label><p class="studio-note">Automático detecta bandas estables dentro del vídeo y llena la TV sin estirar. Si los formatos difieren, recorta los bordes. Mostrar todo conserva el contenido completo.</p>' + range('studioVideoZoom', 'Zoom dentro de la pantalla', 1, 3, .05) + range('studioVideoX', 'Encuadre horizontal', -50, 50) + range('studioVideoY', 'Encuadre vertical', -50, 50) + '<div class="studio-buttons">' + buttons([['resetVideo', 'Restablecer vídeo']]) + '</div><p class="studio-note">El vídeo queda recortado por el marco. Su luz sigue el área visible.</p>') +
    '<div class="studio-buttons">' + buttons([['copyPresentation', 'Copiar a otras vistas'], ['resetPresentation', 'Restablecer esta escena']]) + '</div>';
  objects.insertAdjacentHTML('beforeend', '<div class="studio-search"><input id="studioSearch" type="search" placeholder="Buscar decoración…" aria-label="Buscar decoración"/><select id="studioCategory" aria-label="Categoría"><option value="all">Todo</option><option value="favorite">Favoritos</option><option value="figurine">Figuras</option><option value="sticker">Estampas</option><option value="poster">Pósters</option><option value="frame">Marcos</option><option value="lamp">Lámparas</option><option value="furniture">Muebles</option><option value="game">Videojuegos</option></select></div><div id="studioObjectList" class="studio-list"></div>');
  objects.insertAdjacentHTML('beforeend', panel('studioFurnitureTypes', 'Catálogo · muebles, juegos y decoración', '<p class="studio-note">Todas las piezas se pueden añadir, duplicar, mover y transformar. Combínalas con tus imágenes.</p><div class="studio-lamp-gallery">' + props.map(p => `<button type="button" data-studio-prop="${p.id}" data-category="${p.category}"><img src="${builtinUrl(p.id)}" alt="" loading="lazy"/>${p.name}</button>`).join('') + '</div>', true));
  old.forEach(node => objects.append(node));
  objects.insertAdjacentHTML('beforeend', panel('studioResting', 'Apoyar una figura u objeto', '<label>Superficie<select id="studioRestingSurface"></select></label><button id="studioRestOn" type="button">Apoyar sobre esta mesa</button><p class="studio-note">Coloca sus pies sobre la tapa, respetando la transparencia de la imagen. Después puedes moverlo libremente.</p>', true));
  const native = $('editorItem').closest('label')!; native.classList.add('studio-native-select'); $<HTMLSelectElement>('editorItem').size = 1;
  objects.prepend($('editorUpload').closest('label')!);
  const properties = $('editorProperties');
  properties.insertAdjacentHTML('afterbegin', '<label class="editor-wide">Tipo<select id="studioObjectCategory"><option value="figurine">Figurita</option><option value="sticker">Estampa</option><option value="poster">Póster</option><option value="frame">Marco</option><option value="lamp">Lámpara</option><option value="furniture">Mueble</option><option value="game">Videojuego</option></select></label>');
  // Keep everyday adjustments in view and gather the rest into small disclosures.
  objects.insertAdjacentHTML('beforeend', panel('studioPerspective', 'Perspectiva y transformación',
    '<label>Vista preparada<select id="studioPerspectivePreset"><option value="custom">Personalizada</option><option value="front">Frontal</option><option value="left">Desde la izquierda</option><option value="right">Desde la derecha</option><option value="above">Desde arriba</option><option value="below">Desde abajo</option><option value="iso-left">Isométrica izquierda</option><option value="iso-right">Isométrica derecha</option><option value="floor">Sobre el suelo</option><option value="ceiling">En el techo</option></select></label><label>Superficie<select id="studioSurface"><option value="free">Libre</option><option value="wall">Pared frontal</option><option value="left-wall">Pared izquierda</option><option value="right-wall">Pared derecha</option><option value="cabinet">Mueble</option><option value="shelf">Repisa</option><option value="floor">Suelo</option><option value="ceiling">Techo</option></select></label><label class="studio-check"><input id="studioAuto" type="checkbox"/> Ajustar automáticamente</label><p class="studio-note">Las vistas son proyecciones de tu imagen. Para otro lado de una figura necesitas una imagen de ese lado.</p>' +
    range('studioTiltX', 'Inclinación vertical', -85, 85) + range('studioTiltY', 'Inclinación lateral', -85, 85) + range('studioDepth', 'Profundidad de perspectiva', 150, 2000, 10) +
    range('studioSkewX', 'Deformación horizontal', -45, 45) + range('studioSkewY', 'Deformación vertical', -45, 45) +
    range('studioScaleX', 'Estirar ancho', .25, 2.5, .05) + range('studioScaleY', 'Estirar alto', .25, 2.5, .05) +
    '<div class="studio-buttons">' + buttons([['flipX', 'Voltear ↔'], ['flipY', 'Voltear ↕'], ['warpTool', 'Editar las 4 esquinas'], ['resetCorners', 'Restablecer esquinas'], ['resetTransform', 'Restablecer']]) + '</div><details><summary>Coordenadas de las esquinas</summary><div class="studio-corner-fields">' + [0, 1, 2, 3].map(i => `<label>${['Superior izquierda', 'Superior derecha', 'Inferior derecha', 'Inferior izquierda'][i]}<span><input id="studioCorner${i}X" type="number" min="-60" max="160" step="1" aria-label="Esquina ${i + 1} X"/><input id="studioCorner${i}Y" type="number" min="-60" max="160" step="1" aria-label="Esquina ${i + 1} Y"/></span></label>`).join('') + '</div></details>') +
    panel('studioMaterial', 'Material del mueble', '<label>Material<select id="studioMaterialPreset">' + materials.map(m => `<option value="${m.id}">${m.name}</option>`).join('') + '</select></label><label>Aplicar a<select id="studioMaterialScope"><option value="top">Solo superficie de apoyo</option><option value="all">Mueble completo</option></select></label><label>Color del material<input id="studioMaterialColor" type="color"/></label><div id="studioFurnitureColors" class="studio-color-palette" aria-label="Colores de muebles">' + furnitureColors.map(c=>`<button type="button" data-furniture-color="${c.color}" aria-pressed="false"><span style="background:${c.color}" aria-hidden="true"></span>${c.name}</button>`).join('') + '</div>' + range('studioMaterialStrength', 'Intensidad del material', 0, 100) + range('studioMaterialScale', 'Tamaño de la textura', .25, 4, .05) + range('studioMaterialRoughness', 'Acabado mate / rugosidad', 0, 100) + '<p class="studio-note">Los muebles se muestran sólidos. El material conserva la silueta y los huecos entre las patas; rugosidad baja produce un reflejo más marcado.</p>') +
    panel('studioAppearance', 'Color, tono y sombra', '<details class="studio-section editor-wide"><summary>Sombra de apoyo y recorte</summary><div class="studio-fields">' +
      range('studioContactOpacity', 'Sombra de apoyo', 0, 100) + range('studioContactBlur', 'Suavidad de sombra', 0, 25) + range('studioContactWidth', 'Ancho de sombra', 20, 160) +
      range('studioContactX', 'Desplazar sombra X', -50, 50) + range('studioContactY', 'Desplazar sombra Y', -40, 40) +
      [0, 1, 2, 3].map((i) => range(`studioCrop${i}`, `Recorte ${['arriba', 'derecha', 'abajo', 'izquierda'][i]}`, 0, 45)).join('') +
      '<div class="studio-buttons">' + buttons([['copyStyle', 'Copiar acabado'], ['pasteStyle', 'Pegar acabado']]) + '</div></div></details>', true) +
    panel('studioGroups', 'Selección, grupos y alineación', '<p class="studio-note">Shift / Ctrl + clic suma objetos. En móvil usa la casilla junto a cada objeto. Alt + clic elige un miembro del grupo.</p><output id="studioSelectionCount"></output><div class="studio-buttons">' + buttons([['selectAll', 'Seleccionar todos'], ['group', 'Agrupar'], ['ungroup', 'Desagrupar'], ['alignX', 'Alinear X'], ['alignY', 'Alinear Y'], ['distributeX', 'Distribuir X'], ['distributeY', 'Distribuir Y']]) + '</div>') +
    panel('studioLibrary', 'Mi biblioteca', '<p class="studio-note">Reutiliza tus imágenes o empieza con estas piezas.</p><div id="studioLibraryList" class="studio-gallery"></div>'));
  const appearanceFields = ['decorBrightness', 'decorSaturation', 'decorHue', 'decorShadow'];
  for(const id of [...appearanceFields].reverse()) $('studioAppearance').querySelector('.studio-fields')!.prepend($(id).closest('label')!);
  properties.before($('studioAppearance'));
  objects.append($('studioFurnitureTypes'));
  $('studioFurnitureTypes').removeAttribute('open');
  // Keep nodes mounted so returning preserves list order and scroll.
  const browser=document.createElement('div');browser.id='studioObjectBrowser';
  const inspector=document.createElement('div');inspector.id='studioObjectInspector';inspector.hidden=true;
  inspector.innerHTML='<div id="studioInspectorHeader" class="studio-inspector-header"><button id="studioBackToObjects" type="button">← Ver objetos</button><h3 id="studioObjectTitle" tabindex="-1">Editar objeto</h3><p id="studioObjectHint" class="studio-note"></p></div><div id="studioObjectIdentity" class="studio-fields"></div>';
  const inspectorIds=['editorProperties','editorNudge','studioAppearance','studioMaterial','studioPerspective','studioResting'];
  for(const child of [...objects.children]) (inspectorIds.includes(child.id)?inspector:browser).append(child);
  objects.append(browser,inspector);
  browser.insertAdjacentHTML('afterbegin','<button id="studioEditSelection" type="button" hidden>Editar selección</button>');
  $('studioEditSelection').addEventListener('click',focusStudioItem);
  $('studioObjectIdentity').append($('decorName').closest('label')!,$('studioObjectCategory').closest('label')!);
  $('studioObjectIdentity').insertAdjacentHTML('beforeend','<div class="studio-buttons editor-wide"><button id="studioDuplicateObject" type="button">Duplicar</button><button id="studioRemoveObject" type="button">Quitar de esta vista</button><button id="studioEditObjectLight" type="button" hidden>Editar su luz</button></div>');
  const position=document.createElement('details');position.id='studioPosition';position.className='studio-section';position.innerHTML='<summary>Posición y tamaño</summary>';
  position.append(properties,$('editorNudge'));inspector.append(position,$('studioPerspective'),$('studioResting'));
  $('studioAppearance').querySelector('.studio-fields')!.insertAdjacentHTML('afterbegin',range('studioLightResponse','Cuánto afecta la luz del entorno',0,100)+'<p class="studio-note editor-wide">Baja este valor si se pierde detalle. El brillo, color y tono de abajo son ajustes propios del objeto.</p>');
  $('studioAppearance').querySelector('.studio-fields')!.insertAdjacentHTML('afterbegin','<label class="studio-check editor-wide"><input id="studioObjectSolid" type="checkbox"/> Objeto sólido · sin transparencia</label><label>Color del objeto<input id="studioObjectTint" type="color"/></label>'+range('studioObjectTintStrength','Mezcla de color',0,100)+'<button id="studioObjectColorReset" type="button">Quitar mezcla de color</button>');
  $('studioBackToObjects').addEventListener('click',()=>objectPanel(false));
  $('studioDuplicateObject').addEventListener('click',()=>h.command('duplicate'));
  $('studioRemoveObject').addEventListener('click',()=>$('decorRemove').click());
  $('studioEditObjectLight').addEventListener('click',()=>showObjectTab('Light'));
  $('studioResting').removeAttribute('open');
  $('studioLightResponse').addEventListener('input',()=>{for(const p of placements()) p.lightResponse=Number($<HTMLInputElement>('studioLightResponse').value);h.change('light-response');});
  $('studioObjectSolid').addEventListener('change',()=>{for(const p of placements()) {p.solid=$<HTMLInputElement>('studioObjectSolid').checked;if(p.solid) p.opacity=1;}h.change();});
  for(const [id,key] of [['studioObjectTint','tint'],['studioObjectTintStrength','tintStrength']] as const) $(id).addEventListener('input',()=>{for(const p of placements()) {if(key==='tint') {p.tint=$<HTMLInputElement>(id).value;if(!p.tintStrength) p.tintStrength=35;}else p.tintStrength=Number($<HTMLInputElement>(id).value);}h.change('object-color');});
  $('studioObjectColorReset').addEventListener('click',()=>{for(const p of placements()) {delete p.tint;delete p.tintStrength;}h.change();});
  // Move existing emission controls without replacing their listeners or IDs.
  lights.insertAdjacentHTML('beforeend', panel('studioLampTypes', 'Añadir lámpara', '<div class="studio-lamp-gallery">' + props.filter(p => p.category === 'lamp').map(p => `<button type="button" data-studio-lamp="${p.id}"><img src="${builtinUrl(p.id)}" alt=""/>${p.name}</button>`).join('') + '</div>', true));
  lights.append($('editorAddLight'));
  lights.insertAdjacentHTML('beforeend', '<p class="studio-note">Selecciona una lámpara o una imagen en la escena para cambiar su luz.</p><div id="studioLightFields" class="studio-fields"></div>');
  const lightFields = $('studioLightFields');
  $('studioLampTypes').removeAttribute('open');
  for (const id of ['decorEmitLight', 'decorLightColor', 'decorLightIntensity', 'decorLightRadius', 'decorLightX', 'decorLightY']) lightFields.append($(id).closest('label')!);
  lightFields.insertAdjacentHTML('beforeend', '<div class="studio-buttons" aria-label="Colores de lámpara">' + ['#ffca90','#fff2d2','#ff6aa3','#ff623c','#69b7ff','#ad7aff','#6aefc2'].map((c,i) => `<button type="button" data-studio-light-color="${c}">${['Ámbar','Blanco','Rosa','Rojo','Azul','Violeta','Verde'][i]}</button>`).join('') + '</div><label class="studio-check"><input type="checkbox" id="studioLavaMotion"/> Movimiento de lava</label>' + range('studioLavaSpeed','Velocidad de lava',.2,3,.1));
  lightFields.insertAdjacentHTML('beforeend', '<label>Forma<select id="studioLightShape"><option value="point">Puntual</option><option value="spot">Foco</option><option value="strip">Tira LED</option></select></label>' + range('studioLightAngle', 'Orientación', -180, 180) + range('studioLightSoftness', 'Suavidad', 0, 100) + range('studioKelvin', 'Temperatura (K)', 2000, 10000, 100) + '<div class="studio-buttons">' + buttons([['lightToggle', 'Encender / apagar']]) + '</div>');
  initObjectTabs();
  lights.insertAdjacentHTML('beforeend','<button id="studioSelectedLight" type="button">Editar luz del objeto seleccionado</button>');
  $('studioSelectedLight').addEventListener('click',()=>{focusStudioItem();showObjectTab('Light');});
  environment.insertAdjacentHTML('beforeend', panel('studioLightingPresets', 'Noches preparadas', '<div class="studio-preset-grid">' + lightingPresets.map(p => `<button type="button" data-lighting-preset="${p.id}"><strong>${p.name}</strong><small>${p.description}</small></button>`).join('') + '</div><p class="studio-note">Cambia las luces y la oscuridad de esta vista. Conserva la TV, el encuadre y la decoración existente; no añade piezas.</p>', true));
  environment.append($('editorAmbient').closest('label')!, $('editorEnvironment'));
  environment.insertAdjacentHTML('beforeend', panel('studioBacklight', 'Luz suave detrás de la TV', '<label>Color<input id="studioBacklightColor" type="color"/></label>' + range('studioBacklightIntensity', 'Intensidad', 0, 100) + range('studioBacklightReach', 'Extensión', 50, 180) + range('studioShadowDepth', 'Profundidad de sombras', 0, 100) + '<label class="studio-check"><input id="studioPracticalLights" type="checkbox"/> Luz de lámparas y objetos</label><p class="studio-note">La luz sigue el tamaño y la posición de la TV. Las sombras ayudan a separar la pared, la TV y el suelo.</p>', true));
  const presets: [string, string][] = [['neutral', 'Original / neutro'], ['classic-night', 'Noche clásica'], ['tv-only', 'Solo la TV'], ['moonlight', 'Luz de luna'], ['warm', 'Noche acogedora'], ['soft-night', 'Noche suave'], ['blue-night', 'Noche azul sutil'], ['neon', 'Neón']];
  $<HTMLSelectElement>('editorMood').replaceChildren(...presets.map(([value, name]) => new Option(name, value)));
  environment.insertAdjacentHTML('beforeend', panel('studioGrade', 'Color por superficie · avanzado',
    '<label>Aplicar a<select id="studioZone"><option value="all">Todo el entorno</option><option value="wall">Pared</option><option value="cabinet">Mueble</option><option value="floor">Suelo</option><option value="tv">Carcasa de la TV</option><option value="figures">Figuras</option></select></label>' +
    range('studioExposure', 'Exposición', -60, 60) + range('studioContrast', 'Contraste', 50, 150) + range('studioSaturation', 'Saturación', 0, 150) + range('studioTemperature', 'Temperatura', -100, 100) + range('studioShadows', 'Profundidad de sombras', 0, 60) + range('studioInfluence', 'Influencia del ambiente', 0, 100) + '<div class="studio-buttons">' + buttons([['resetGrade', 'Restablecer superficie'], ['resetMood', 'Restablecer ambiente']]) + '</div>') +
    panel('studioReflections', 'Reflejos del vídeo · inmersivos', '<label class="studio-check"><input id="studioReflectionEnabled" type="checkbox"/> Reflejos en tiempo real</label>' + range('studioReflectionIntensity', 'Intensidad general', 0, 150) + range('studioReflectionTable', 'Reflejo en la mesa', 0, 200) + range('studioReflectionFloor', 'Reflejo en el suelo', 0, 200) + range('studioReflectionBlur', 'Desenfoque del reflejo', 0, 30) + range('studioReflectionReach', 'Largo del reflejo', 30, 180) + range('studioReflectionSpread', 'Ancho del reflejo', 50, 180) + range('studioReflectionOffset', 'Desplazamiento', -20, 30) + range('studioReflectionTexture', 'Textura de la madera', 0, 100) + '<div class="studio-buttons">' + buttons([['resetReflections', 'Restablecer reflejos']]) + '</div><p class="studio-note">Proyecta el vídeo visible sobre las superficies de la imagen. Solo aparece donde la mesa o el suelo están a la vista. Se guarda por vista.</p>') +
    panel('studioBounce', 'Luz de la TV · acabado suave', range('studioTvDetail','Detalle de los colores del vídeo',0,100)+range('studioTvSoftness','Suavidad del brillo',0,100)+range('studioRim', 'Carcasa', 0, 200) + range('studioCabinet', 'Mueble', 0, 200) + range('studioFloor', 'Suelo', 0, 200) + range('studioReach', 'Alcance', 30, 180) + range('studioTransition', 'Transición (ms)', 150, 2000, 50) + '<label>Prueba de iluminación<select id="studioTest"><option value="live">Vídeo actual</option><option value="red">Rojo</option><option value="blue">Azul</option><option value="white">Blanco</option><option value="dark">Pantalla apagada</option></select></label><p class="studio-note">La luz sigue los colores de cada borde del vídeo, la carcasa y la mesa. La prueba cambia solo la luz de esta vista previa.</p>',true) +
    panel('studioNeon', 'Colores de neón', '<label>Color izquierdo<input id="studioAccent" type="color"/></label><label>Color derecho<input id="studioAccent2" type="color"/></label><p class="studio-note">Activa el ambiente Neón para ver estos colores.</p>') +
    panel('studioRooms', 'Mis ambientes y versiones', '<label>Nombre<input id="studioRoomName" maxlength="70" placeholder="Mi noche favorita"/></label><div class="studio-buttons">' + buttons([['saveRoom', 'Guardar ambiente'], ['loadRoom', 'Aplicar'], ['deleteRoom', 'Eliminar']]) + '</div><select id="studioProfile" aria-label="Ambientes guardados"></select><label>Versiones anteriores<select id="studioVersion"></select></label><div class="studio-buttons">' + buttons([['loadVersion', 'Restaurar versión']]) + '</div><p class="studio-note">Guarda esta vista para conservar tus ambientes y las tres versiones anteriores.</p>'));
  // Remove obsolete section headings after relocating their controls.
  properties.querySelectorAll('strong').forEach(node => node.remove());
  document.querySelector('.editor-tools')!.insertAdjacentHTML('beforeend', '<button id="studioTvTool" type="button" aria-pressed="false">Mover TV</button><button id="studioScreenTool" type="button" aria-pressed="false">Ajustar pantalla</button><button id="studioCameraTool" type="button" aria-pressed="false">Encuadrar</button><button id="studioWarpTool" type="button" aria-pressed="false">Perspectiva</button><button id="studioCompare" type="button" aria-pressed="false">Antes / después</button><button id="studioImmersive" type="button" aria-pressed="false">Solo escena</button>');
  for (const [id, cmd] of [['studioTvTool', 'tvTool'], ['studioCameraTool', 'cameraTool'], ['studioScreenTool', 'screenTool'], ['studioWarpTool', 'warpTool']]) $(id).addEventListener('click', () => command(cmd));
  const tools=document.querySelector('.editor-tools')!;
  tools.insertAdjacentHTML('beforeend','<button id="studioQuickVideo" type="button">Vídeo en la TV</button><details id="studioExtraTools" class="studio-extra-tools"><summary>Más herramientas</summary><div></div></details>');
  const extra=$('studioExtraTools').querySelector('div')!;
  for(const id of ['editorGrid','editorSnap']) extra.append($(id).closest('label')!);
  for(const id of ['studioCameraTool','studioScreenTool','studioWarpTool','studioCompare']) extra.append($(id));
  $('studioQuickVideo').addEventListener('click',()=>{$('studioSceneTab').click();$<HTMLDetailsElement>('studioVideo').open=true;$('studioVideo').scrollIntoView({block:'start'});});
  for (const id of ['Objects', 'Lights', 'Mood', 'Scene']) {
    const tab = $(`studio${id}Tab`);
    tab.addEventListener('click', () => {
      const inspecting=id==='Objects' && !$('studioObjectInspector').hidden;
      sidebar.classList.toggle('has-object-inspector',inspecting);$('studioInspectorHeader').hidden=!inspecting;
      for (const other of ['Objects', 'Lights', 'Mood', 'Scene']) { $(`studio${other}`).hidden = other !== id; $(`studio${other}Tab`).setAttribute('aria-selected', String(other === id)); $(`studio${other}Tab`).tabIndex = other === id ? 0 : -1; }
      sidebar.classList.remove('is-collapsed'); $('studioCollapse').setAttribute('aria-expanded', 'true'); h.resize();
    });
    tab.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault(); const tabs = ['Objects', 'Lights', 'Mood', 'Scene'];
      const next = $(`studio${tabs[(tabs.indexOf(id) + (event.key === 'ArrowRight' ? 1 : 3)) % 4]}Tab`); next.click(); next.focus();
    });
  }
  $('studioCollapse').addEventListener('click', () => { sidebar.classList.toggle('is-collapsed'); $('studioCollapse').setAttribute('aria-expanded', String(!sidebar.classList.contains('is-collapsed'))); h.resize(); });
  $('studioImmersive').addEventListener('click', () => { const body = document.querySelector('.editor-body')!; body.classList.toggle('studio-immersive'); document.querySelector('.decor-editor')!.classList.toggle('studio-focus', body.classList.contains('studio-immersive')); $('studioImmersive').setAttribute('aria-pressed', String(body.classList.contains('studio-immersive'))); h.resize(); });
  $('studioCompare').addEventListener('click', () => { const button = $('studioCompare'), value = button.getAttribute('aria-pressed') !== 'true'; button.setAttribute('aria-pressed', String(value)); button.textContent = value ? 'Viendo guardado' : 'Antes / después'; h.compare(value); });
  $('studioTest').addEventListener('change', () => h.test($<HTMLSelectElement>('studioTest').value));
  ['studioSearch', 'studioCategory'].forEach(id => $(id).addEventListener('input', () => { listSignature = ''; refreshStudio(); }));
  $('studioZone').addEventListener('change', refreshStudio);
  $('studioObjectCategory').addEventListener('change', () => { const item = h.item(); if (item) item.category = $<HTMLSelectElement>('studioObjectCategory').value; h.change(); });
  $('studioRestOn').addEventListener('click', () => {
    const supportId = $<HTMLSelectElement>('studioRestingSurface').value;
    const selected = h.draft().items.filter(i => h.selected().includes(i.id) && i.id !== supportId && i.category !== 'furniture' && i.kind !== 'viewer-slot' && i.kind !== 'light');
    for (const item of selected) { const p=item.placements[h.key() as keyof typeof item.placements]; if(!p || p.locked) continue;
      if(p.anchor === 'frame') h.convert(p); p.hidden=false;p.behindTv=false;p.z=15;
      p.contactShadow ??= {opacity:25,blur:3,width:65,x:0,y:-3};
    }
    h.change();h.rest(selected.map(i=>i.id),supportId);
  });
  $('studioSurface').addEventListener('change', () => { for (const p of placements().filter(p => !p.locked)) (p.transform ??= {}).surface = $<HTMLSelectElement>('studioSurface').value as Transform['surface']; h.change(); });
  $('studioAuto').addEventListener('change', () => {
    for (const p of placements().filter(p => !p.locked)) {
      const t = p.transform ??= {}; const angles = perspectiveAngles(t, p.x);
      if (!$<HTMLInputElement>('studioAuto').checked) { t.tiltX = angles.x; t.tiltY = angles.y; }
      t.auto = $<HTMLInputElement>('studioAuto').checked;
    } h.change();
  });
  $('studioPerspectivePreset').addEventListener('change', () => {
    const presets: Record<string, [number, number]> = { front: [0, 0], left: [0, 35], right: [0, -35], above: [35, 0], below: [-35, 0], 'iso-left': [25, 35], 'iso-right': [25, -35], floor: [55, 0], ceiling: [-55, 0] };
    const value = presets[$<HTMLSelectElement>('studioPerspectivePreset').value]; if (!value) return;
    for (const p of placements().filter(p => !p.locked)) { const t = p.transform ??= {}; t.auto = false; t.tiltX = value[0]; t.tiltY = value[1]; delete t.corners; t.skewX = t.skewY = 0; }
    h.change();
  });
  for (let i = 0; i < 4; i++) for (const [axis, index] of [['X', 0], ['Y', 1]] as const) $(`studioCorner${i}${axis}`).addEventListener('input', () => {
    const value = Number($<HTMLInputElement>(`studioCorner${i}${axis}`).value);
    for (const p of placements().filter(p => !p.locked)) { const corners = structuredClone(p.transform?.corners ?? straightCorners()); corners[i][index] = value;
      if (validCorners(corners)) (p.transform ??= {}).corners = corners; else h.status('Mantén las cuatro esquinas sin cruzarse.'); }
    h.change('corners');
  });
  const transformFields = { TiltX: 'tiltX', TiltY: 'tiltY', SkewX: 'skewX', SkewY: 'skewY', ScaleX: 'scaleX', ScaleY: 'scaleY', Depth: 'depth' } as const;
  Object.entries(transformFields).forEach(([id, key]) => $('studio' + id).addEventListener('input', () => {
    for (const p of placements().filter(p => !p.locked)) { (p.transform ??= {})[key] = Number($<HTMLInputElement>('studio' + id).value); }
    h.change('transform');
  }));
  const contactFields = { Opacity: 'opacity', Blur: 'blur', Width: 'width', X: 'x', Y: 'y' } as const;
  Object.entries(contactFields).forEach(([id, key]) => $('studioContact' + id).addEventListener('input', () => {
    for (const p of placements()) { (p.contactShadow ??= { opacity: 0, blur: 5, width: 75, x: 0, y: -2 })[key] = Number($<HTMLInputElement>('studioContact' + id).value); } h.change('contact');
  }));
  [0, 1, 2, 3].forEach(i => $('studioCrop' + i).addEventListener('input', () => { for (const p of placements()) (p.crop ??= [0, 0, 0, 0])[i] = Number($<HTMLInputElement>('studioCrop' + i).value); h.change('crop'); }));
  const gradeFields = { Exposure: 'exposure', Contrast: 'contrast', Saturation: 'saturation', Temperature: 'temperature', Shadows: 'shadows', Influence: 'influence' } as const;
  Object.entries(gradeFields).forEach(([id, key]) => $('studio' + id).addEventListener('input', () => { grade()[key] = Number($<HTMLInputElement>('studio' + id).value); h.change('grade'); }));
  const bounceFields = { Rim: 'rim', Cabinet: 'cabinet', Floor: 'floor', Reach: 'reach', Transition: 'transition' } as const;
  for (const button of sidebar.querySelectorAll<HTMLButtonElement>('[data-lighting-preset]')) button.addEventListener('click', () => {
    applyLightingPreset(h.draft(), h.key() as PlacementKey, button.dataset.lightingPreset!); h.change();
    h.status(`${button.querySelector('strong')!.textContent} aplicada a esta vista. Guarda para conservarla.`);
  });
  for (const [id, key] of [['studioBacklightColor', 'color'], ['studioBacklightIntensity', 'intensity'], ['studioBacklightReach', 'reach']] as const) $(id).addEventListener('input', () => {
    const light = mood().backlight ??= {color:'#9e86dd',intensity:0,reach:115};
    Object.assign(light, {[key]: key === 'color' ? $<HTMLInputElement>(id).value : Number($<HTMLInputElement>(id).value)}); h.change('backlight');
  });
  $('studioPracticalLights').addEventListener('change', () => {mood().practicalLights = $<HTMLInputElement>('studioPracticalLights').checked; h.change();});
  $('studioShadowDepth').addEventListener('input', () => {mood().depth = Number($<HTMLInputElement>('studioShadowDepth').value); h.change('depth');});
  for(const [id,key] of [['studioTvDetail','tvDetail'],['studioTvSoftness','tvSoftness']] as const) $(id).addEventListener('input',()=>{mood()[key]=Number($<HTMLInputElement>(id).value);h.change('tv-light-finish');});
  Object.entries(bounceFields).forEach(([id, key]) => $('studio' + id).addEventListener('input', () => { mood()[key] = Number($<HTMLInputElement>('studio' + id).value); h.change('bounce'); }));
  for (const [id, key] of [['studioLightShape', 'shape'], ['studioLightAngle', 'angle'], ['studioLightSoftness', 'softness']] as const) $(id).addEventListener('input', () => {
    for (const p of placements()) if (p.light) Object.assign(p.light, { [key]: key === 'shape' ? $<HTMLSelectElement>(id).value : Number($<HTMLInputElement>(id).value) }); h.change('light');
  });
  $('studioKelvin').addEventListener('input', () => {
    const t = Number($<HTMLInputElement>('studioKelvin').value) / 100;
    const r = t <= 66 ? 255 : 329.698 * (t - 60) ** -.1332;
    const g = t <= 66 ? 99.47 * Math.log(t) - 161.12 : 288.122 * (t - 60) ** -.0755;
    const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.517 * Math.log(t - 10) - 305.045;
    const color = '#' + [r, g, b].map(v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');
    for (const p of placements()) if (p.light) { p.light.color = color; p.light.kelvin = t * 100; } h.change('kelvin');
    $<HTMLOutputElement>('studioKelvinValue').value = `${t * 100} K`;
  });
  field('studioKelvin', 4000);
  $('studioLampTypes').addEventListener('click', e => { const id = (e.target as HTMLElement).closest<HTMLElement>('[data-studio-lamp]')?.dataset.studioLamp; if (!id) return; const item = builtinDecoration(id); item.placements[h.key() as keyof typeof item.placements] = roomPlacement(id, h.key().includes('portrait')); h.create(item); });
  lightFields.addEventListener('click', e => { const color = (e.target as HTMLElement).closest<HTMLElement>('[data-studio-light-color]')?.dataset.studioLightColor; if (!color) return; for (const p of placements()) { p.light ??= { color, intensity:80, radius:5, x:50, y:24 }; p.light.color = color; } h.change('light-color'); });
  $('studioLavaMotion').addEventListener('change', () => { for (const p of placements()) (p.lava ??= {}).motion = $<HTMLInputElement>('studioLavaMotion').checked; h.change(); });
  $('studioLavaSpeed').addEventListener('input', () => { for (const p of placements()) (p.lava ??= {}).speed = Number($<HTMLInputElement>('studioLavaSpeed').value); h.change('lava-speed'); });
  zoomViews.forEach((key, i) => $('studioViewZoom' + i).addEventListener('input', () => { const p = (h.draft().presentations ??= {})[key as keyof NonNullable<Manifest['presentations']>] ??= {}; (p.camera ??= {}).zoom = Number($<HTMLInputElement>('studioViewZoom' + i).value); h.change('view-zoom-' + key); }));
  for (const group of ['Camera', 'Tv', 'Video'] as const) for (const axis of ['X', 'Y', 'Zoom'] as const) $(`studio${group}${axis}`).addEventListener('input', () => {
    const p = presentation(); if (group === 'Tv') p.tvSupport = 'free'; const key = group.toLowerCase() as 'camera' | 'tv' | 'video';
    (p[key] ??= {})[axis.toLowerCase() as 'x' | 'y' | 'zoom'] = Number($<HTMLInputElement>(`studio${group}${axis}`).value); h.change('presentation');
  });
  for (const axis of ['X', 'Y', 'Width', 'Height'] as const) $(`studioScreen${axis}`).addEventListener('input', () => { const p = presentation(); (p.screen ??= {})[axis.toLowerCase() as 'x' | 'y' | 'width' | 'height'] = Number($<HTMLInputElement>(`studioScreen${axis}`).value); h.change('screen'); });
  const chooseRoom = (id: RoomId) => {
    if (!h.key().startsWith('home-')) return h.status('Elige Casa para aplicar una composición de TV.');
    h.command('deselect');
    if (prepareRoom(h.draft(), id, h.key() as PlacementKey) === false) return h.status(`La habitación necesita espacio para sus piezas (máximo ${MAX_SCENE_ITEMS}).`);
    h.change('composition');
    for(const group of compositionRestGroups(h.draft(),h.key())) h.rest(group.ids,group.supportId,true);
    h.status('Composición aplicada a esta vista. Ajusta sus piezas en Objetos y guarda esta vista.');
  };
  $('studioSceneStyle').addEventListener('change', () => { const value = $<HTMLSelectElement>('studioSceneStyle').value;
    if (rooms.some(r => r.id === value)) return chooseRoom(value as RoomId);
    const p = presentation(); delete p.environment; p.style = value as Presentation['style']; h.change(); });
  $('studioRoomGallery').addEventListener('click', e => { const button = (e.target as HTMLElement).closest<HTMLElement>('[data-studio-room]'); if (button) chooseRoom(button.dataset.studioRoom as RoomId); });
  $('studioTvModel').addEventListener('change', () => { const p = presentation(); p.tvModel = $<HTMLSelectElement>('studioTvModel').value as Presentation['tvModel']; delete p.screen; p.tvSupport = tvModels.find(t => t.id === p.tvModel)?.floor ? 'floor' : p.environment ? 'cabinet' : 'free'; h.change(); });
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => refreshStudio());
  const materialPlacements = () => h.draft().items.filter(i => h.selected().includes(i.id) && isSolidFurniture(i)).flatMap(i => { const p = i.placements[h.key() as keyof typeof i.placements]; return p && !p.locked ? [p] : []; });
  const paintFurniture=(color:string)=>{
    for(const p of materialPlacements()) p.material={preset:'white',scope:'all',...(p.material?.preset !== 'original' ? p.material : {}),color};
    h.change('material-color');
  };
  $('studioMaterialPreset').addEventListener('change', () => { const preset = $<HTMLSelectElement>('studioMaterialPreset').value as FurnitureMaterial['preset']; const info = materials.find(m => m.id === preset)!; for (const p of materialPlacements()) { if (preset === 'original') delete p.material; else p.material = { ...p.material, preset, color: info.tint, scope: p.material?.scope ?? 'all', roughness: info.finish === 'metal' ? 30 : info.finish === 'matte' ? 90 : 65 }; } h.change(); });
  $('studioFurnitureColors').addEventListener('click', event=>{
    const color=(event.target as HTMLElement).closest<HTMLElement>('[data-furniture-color]')?.dataset.furnitureColor;
    if(!color) return;
    paintFurniture(color);
  });
  $('studioMaterialScope').addEventListener('change', () => { for (const p of materialPlacements()) if (p.material) p.material.scope = $<HTMLSelectElement>('studioMaterialScope').value as 'top' | 'all'; h.change(); });
  $('studioMaterialColor').addEventListener('input', () => paintFurniture($<HTMLInputElement>('studioMaterialColor').value));
  for (const [id, key] of [['Strength','strength'],['Scale','scale'],['Roughness','roughness']] as const) $('studioMaterial' + id).addEventListener('input', () => { for (const p of materialPlacements()) if (p.material) p.material[key] = Number($<HTMLInputElement>('studioMaterial' + id).value); h.change('material-' + key); });
  $('studioFurnitureTypes').addEventListener('click', e => { const id = (e.target as HTMLElement).closest<HTMLElement>('[data-studio-prop]')?.dataset.studioProp; if (!id) return; const item = builtinDecoration(id); item.placements[h.key() as keyof typeof item.placements] = roomPlacement(id, h.key().includes('portrait')); h.create(item); });
  $('studioSupportStyle').addEventListener('change', () => { const asset = $<HTMLSelectElement>('studioSupportStyle').value, info = props.find(p => p.id === asset)!, found = supportItem(); if (found?.kind === 'builtin') { const replacement = duplicateInView(found, h.key() as import('./decorations').PlacementKey); replacement.asset = asset; replacement.name = info.name; replacement.category = 'furniture'; found.placements[h.key() as keyof typeof found.placements]!.hidden = true; const p = presentation(); p.tvSupport = 'cabinet'; p.supportId = replacement.id; h.create(replacement); } else { const item = builtinDecoration(asset); item.placements[h.key() as keyof typeof item.placements] = roomPlacement(asset, h.key().includes('portrait')); const p = presentation(); p.tvSupport = 'cabinet'; p.supportId = item.id; h.create(item); } });
  $('studioSupportObject').addEventListener('change', () => { const p = presentation(), value = $<HTMLSelectElement>('studioSupportObject').value; if (value) p.supportId = value; else delete p.supportId; p.tvSupport = 'cabinet'; h.change(); });
  $('studioScreenRounded').addEventListener('change', () => { (presentation().screen ??= {}).rounded = $<HTMLInputElement>('studioScreenRounded').checked; h.change(); });
  $('studioVideoFit').addEventListener('change', () => { const mode=$<HTMLSelectElement>('studioVideoFit').value,video=presentation().video ??= {};video.auto=mode==='auto';video.fit=mode==='contain'?'contain':'cover';h.change(); });
  $('studioTvSupport').addEventListener('change', () => { presentation().tvSupport = $<HTMLSelectElement>('studioTvSupport').value as Presentation['tvSupport']; h.change(); });
  $('studioBackgroundAsset').addEventListener('change', () => { const p = presentation(); delete p.environment; p.background = $<HTMLSelectElement>('studioBackgroundAsset').value || undefined; p.style = 'custom'; h.change(); });
  $('studioBackgroundUpload').addEventListener('change', async () => {
    const input = $<HTMLInputElement>('studioBackgroundUpload'), file = input.files?.[0]; input.value = ''; if (!file) return;
    try { h.status('Subiendo fondo…'); const asset = await h.background(file); const p = presentation(); delete p.environment; p.background = asset; p.style = 'custom'; h.change(); h.status('Fondo listo. Guarda para compartirlo.'); }
    catch (error) { h.status(error instanceof Error ? error.message : 'No se pudo subir el fondo.'); }
  });
  sidebar.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLElement>('[data-studio-template]'); if (!button) return;
    chooseRoom(button.dataset.studioTemplate as RoomId);
  });
  for (const [id, key] of [['Body', 'body'], ['Bezel', 'bezel'], ['Panel', 'panel']] as const) $('studioTvPaint' + id).addEventListener('input', () => { const p = presentation().tvPaint ??= {}; p.enabled = true; p[key] = $<HTMLInputElement>('studioTvPaint' + id).value; h.change('tv-paint'); });
  const paintFields = { Strength: 'strength', Hue: 'hue', Saturation: 'saturation', Exposure: 'exposure', Contrast: 'contrast' } as const;
  for (const [id, key] of Object.entries(paintFields)) $('studioTvPaint' + id).addEventListener('input', () => { const p = presentation().tvPaint ??= {}; p.enabled = true; p[key as keyof Pick<TvPaint, 'strength' | 'hue' | 'saturation' | 'exposure' | 'contrast'>] = Number($<HTMLInputElement>('studioTvPaint' + id).value); h.change('tv-paint'); });
  $('studioTvPaintEnabled').addEventListener('input', () => { (presentation().tvPaint ??= {}).enabled = $<HTMLInputElement>('studioTvPaintEnabled').checked; h.change(); });
  $('studioTvPaintFinish').addEventListener('input', () => { const p = presentation().tvPaint ??= {}; p.enabled = true; p.finish = $<HTMLSelectElement>('studioTvPaintFinish').value as TvPaint['finish']; h.change(); });
  sidebar.addEventListener('click', event => { const button = (event.target as HTMLElement).closest<HTMLElement>('[data-studio-tv-paint]'); if (!button) return;
    const colors: Record<string, string[]> = { gray: ['#aeb4bc','#454d58','#858d98'], blue: ['#526f9f','#283e60','#45618e'], pink: ['#eab8cc','#885b72','#d49bb2'], cream: ['#e8dfc5','#928777','#c4b89c'], black: ['#252b32','#10151b','#323940'] };
    const [body, bezel, panel] = colors[button.dataset.studioTvPaint!]!; const p = presentation(); p.tvPaint = { ...p.tvPaint, enabled: true, body, bezel, panel, strength: 100 }; h.change(); });
  $('studioReflectionEnabled').addEventListener('input', () => { (presentation().reflection ??= {}).enabled = $<HTMLInputElement>('studioReflectionEnabled').checked; h.change(); });
  const reflectionFields = { Intensity: 'intensity', Table: 'table', Floor: 'floor', Blur: 'blur', Reach: 'reach', Spread: 'spread', Offset: 'offset', Texture: 'texture' } as const;
  for (const [id, key] of Object.entries(reflectionFields)) $('studioReflection' + id).addEventListener('input', () => { (presentation().reflection ??= {})[key as keyof Omit<Reflection, 'enabled'>] = Number($<HTMLInputElement>('studioReflection' + id).value); h.change('reflection'); });
  for (const [id, key] of [['studioAccent', 'accent'], ['studioAccent2', 'accent2']] as const) $(id).addEventListener('input', () => { mood()[key] = $<HTMLInputElement>(id).value; h.change('accent'); });
  sidebar.addEventListener('click', event => { const target = (event.target as HTMLElement).closest<HTMLElement>('[data-studio-command]'); if (target) command(target.dataset.studioCommand!); });
  $<HTMLSelectElement>('editorMood').addEventListener('change', () => {
    const preset = mood().preset;
    const ambient: Record<string, number> = { neutral: 62, 'classic-night': 48, 'tv-only': 30, moonlight: 57, warm: 58, 'soft-night': 70, 'blue-night': 55, neon: 45 };
    presentation().ambient = ambient[preset]; h.change();
  });
  refreshStudio();
}
function command(cmd: string) {
  if (!host) return;
  const d = host.draft(), ps = placements(), ids = host.selected();
  if (cmd === 'warpTool') { host.tool('warp'); return; }
  else if (cmd === 'resetCorners') ps.filter(p => !p.locked).forEach(p => { if (p.transform) delete p.transform.corners; });
  else if (cmd === 'cameraTool' || cmd === 'tvTool' || cmd === 'screenTool') { host.tool(cmd === 'tvTool' ? 'tv' : cmd === 'screenTool' ? 'screen' : 'camera'); return; }
  else if (cmd === 'resetTv' && presentation().environment) { presentation().tv = defaultRealPresentation(host.key(), presentation().environment).tv; presentation().tvSupport = 'cabinet'; }
  else if (cmd === 'resetVideo' && presentation().environment) presentation().video = { fit: 'contain' };
  else if (['resetCamera', 'resetTv', 'resetVideo', 'resetScreen'].includes(cmd)) delete presentation()[cmd.slice(5).toLowerCase() as 'camera' | 'tv' | 'video' | 'screen'];
  else if (cmd === 'resetTvPaint') delete presentation().tvPaint;
  else if (cmd === 'resetReflections') delete presentation().reflection;
  else if (cmd === 'resetPresentation') { (d.presentations ??= {})[host.key() as keyof typeof d.presentations] = defaultRealPresentation(host.key(), presentation().environment ?? 'cozy-night'); }
  else if (cmd === 'copyPresentation') { const p = structuredClone(presentation()), keys = host.key().startsWith('home') ? ['home-landscape-16x9', 'home-landscape-4x3', 'home-portrait-16x9', 'home-portrait-4x3', 'home-window-16x9', 'home-window-4x3'] : ['arcade-landscape', 'arcade-portrait', 'arcade-window']; keys.forEach(key => (d.presentations ??= {})[key as keyof typeof d.presentations] = structuredClone(p)); host.status('Composición copiada. Revisa el encuadre de cada vista.'); }
  else if (cmd.startsWith('flip')) { ps.filter(p => !p.locked).forEach(p => { const t = p.transform ??= {}, key = cmd as 'flipX' | 'flipY'; t[key] = !t[key]; }); }
  else if (cmd === 'resetTransform') ps.filter(p => !p.locked).forEach(p => { delete p.transform; });
  else if (cmd === 'copyStyle') { const p = ps.at(-1); if (p) { appearance = structuredClone({ brightness: p.brightness, saturation: p.saturation, hue: p.hue, shadow: p.shadow, lightResponse:p.lightResponse, solid:p.solid,tint:p.tint,tintStrength:p.tintStrength,opacity: p.opacity, contactShadow: p.contactShadow, crop: p.crop, material: p.material }); host.status('Acabado copiado. Selecciona otra decoración para pegarlo.'); } return; }
  else if (cmd === 'pasteStyle' && appearance) ps.forEach(p => Object.assign(p, structuredClone(appearance)));
  else if (cmd === 'selectAll') { d.items.filter(i => visibleInRoom(i, presentation()) && i.placements[host!.key() as keyof typeof i.placements]).forEach((i, n) => host!.select(i.id, n !== 0)); return; }
  else if (cmd === 'group') { if (ids.length < 2) return host.status('Selecciona al menos dos objetos.'); const group = crypto.randomUUID(); d.items.filter(i => ids.includes(i.id)).forEach(i => i.group = group); }
  else if (cmd === 'ungroup') d.items.filter(i => ids.includes(i.id)).forEach(i => delete i.group);
  else if (/^(align|distribute)[XY]$/.test(cmd)) {
    const unlocked = ps.filter(p => !p.locked); if (unlocked.length < 2) return host.status('Selecciona al menos dos objetos desbloqueados.');
    if (!unlocked.every(p => host!.convert(p))) return host.status('Espera a que cargue la escena.');
    const axis = cmd.endsWith('X') ? 'x' : 'y';
    if (cmd.startsWith('align')) { const value = unlocked.reduce((sum, p) => sum + p[axis], 0) / unlocked.length; unlocked.forEach(p => p[axis] = value); }
    else { unlocked.sort((a, b) => a[axis] - b[axis]); const lo = unlocked[0][axis], hi = unlocked.at(-1)![axis]; unlocked.forEach((p, n) => p[axis] = lo + (hi - lo) * n / (unlocked.length - 1)); }
  } else if (cmd === 'lightToggle') ps.forEach(p => { if (p.light) p.light.intensity = p.light.intensity ? 0 : 80; });
  else if (cmd === 'resetGrade') { const zone = $<HTMLSelectElement>('studioZone').value; if (zone === 'all') delete mood().grade; else if (mood().zones) delete mood().zones![zone as Zone]; }
  else if (cmd === 'resetMood') { presentation().mood = structuredClone(defaultRealPresentation(host.key()).mood); presentation().ambient = 100; }
  else if (cmd === 'saveRoom') {
    const name = $<HTMLInputElement>('studioRoomName').value.trim() || 'Mi ambiente';
    const existing = d.profiles?.find(p => p.name === name); if (existing) existing.room = room();
    else { if ((d.profiles?.length ?? 0) >= 6) return host.status('Máximo seis ambientes. Elimina uno o usa su nombre para reemplazarlo.'); (d.profiles ??= []).push({ id: crypto.randomUUID(), name, room: room() }); }
    host.status('Ambiente añadido. Guarda para todos para conservarlo.');
  } else if (cmd === 'loadRoom' || cmd === 'loadVersion') {
    const value = $<HTMLSelectElement>(cmd === 'loadRoom' ? 'studioProfile' : 'studioVersion').value;
    const snapshot = (cmd === 'loadRoom' ? d.profiles : d.versions)?.find(p => p.id === value);
    if (snapshot) { host.restore(snapshot.room); host.status('Restaurado en el borrador. Puedes deshacer o guardar.'); } return;
  } else if (cmd === 'deleteRoom') d.profiles = d.profiles?.filter(p => p.id !== $<HTMLSelectElement>('studioProfile').value);
  else return;
  host.change();
}
export function refreshStudio() {
  if (!host) return;
  const d = host.draft(), item = host.item(), p = item?.placements[host.key() as keyof typeof item.placements], t = p?.transform ?? {};
  const scene = d.presentations?.[host.key() as keyof typeof d.presentations];
  field('studioSceneStyle', scene?.environment ?? (scene?.style === 'custom' ? 'custom' : 'cozy-night'));
  const resting=$<HTMLSelectElement>('studioRestingSurface'), restingValue=resting.value;
  const supports=d.items.filter(i => i.id !== item?.id && visibleInRoom(i,scene) && props.find(p=>p.id===i.asset)?.support && i.placements[host!.key() as keyof typeof i.placements] && !i.placements[host!.key() as keyof typeof i.placements]!.hidden);
  resting.replaceChildren(...supports.map(i=>new Option(i.name,i.id)));
  resting.value=supports.some(i=>i.id===restingValue)?restingValue:supports.find(i=>i.asset==='side-table')?.id??supports[0]?.id??'';
  $<HTMLButtonElement>('studioRestOn').disabled=!item || item.category==='furniture' || item.kind==='viewer-slot' || item.kind==='light' || !resting.value || Boolean(p?.locked);
  field('studioTvModel', scene?.tvModel ?? 'original');
  field('studioTvSupport', scene?.tvSupport ?? 'free');
  const supportSelect = $<HTMLSelectElement>('studioSupportObject'), options = [new Option('Automático · mueble de TV', '')];
  for (const i of d.items) if (i.category === 'furniture' && (i.kind !== 'builtin' || props.find(prop => prop.id === i.asset)?.support) && visibleInRoom(i, scene) && i.placements[host.key() as keyof typeof i.placements] && !i.placements[host.key() as keyof typeof i.placements]!.hidden) options.push(new Option(i.name, i.id));
  supportSelect.replaceChildren(...options); supportSelect.value = scene?.supportId ?? ''; supportSelect.disabled = scene?.tvSupport !== 'cabinet';
  field('studioSupportStyle', supportItem()?.asset ?? 'cabinet');
  $<HTMLSelectElement>('studioSupportStyle').disabled = supportItem()?.kind !== undefined && supportItem()?.kind !== 'builtin';
  field('studioScreenRounded', scene?.screen?.rounded ?? true); field('studioVideoFit', scene?.video?.auto!==false?'auto':scene.video.fit ?? 'cover');
  for (const id of ['Zoom', 'X', 'Y']) $<HTMLInputElement>('studioVideo' + id).disabled = scene?.video?.auto!==false || scene.video.fit === 'contain';
  zoomViews.forEach((key, i) => { field('studioViewZoom' + i, d.presentations?.[key as keyof NonNullable<Manifest['presentations']>]?.camera?.zoom ?? 1); $('studioViewZoom' + i).closest('label')!.hidden = key.startsWith('home') !== host!.key().startsWith('home'); });
  document.querySelectorAll<HTMLElement>('[data-studio-room]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.studioRoom === scene?.environment)));
  for (const group of ['Camera', 'Tv', 'Video'] as const) for (const axis of ['X', 'Y', 'Zoom'] as const) {
    const value = scene?.[group.toLowerCase() as 'camera' | 'tv' | 'video']?.[axis.toLowerCase() as 'x' | 'y' | 'zoom'];
    field(`studio${group}${axis}`, value ?? (axis === 'Zoom' ? group === 'Video' ? 1.035 : 1 : 0));
  }
  for (const axis of ['X', 'Y', 'Width', 'Height'] as const) field(`studioScreen${axis}`, scene?.screen?.[axis.toLowerCase() as 'x' | 'y' | 'width' | 'height'] ?? (axis === 'X' || axis === 'Y' ? 0 : 100));
  const paint = scene?.tvPaint, reflection = scene?.reflection;
  field('studioTvPaintEnabled', paint?.enabled ?? false); field('studioTvPaintBody', paint?.body ?? '#596675'); field('studioTvPaintBezel', paint?.bezel ?? '#364455'); field('studioTvPaintPanel', paint?.panel ?? '#596675'); field('studioTvPaintFinish', paint?.finish ?? 'matte');
  for (const [key, value] of Object.entries({ Strength: paint?.strength ?? 85, Hue: paint?.hue ?? 0, Saturation: paint?.saturation ?? 100, Exposure: paint?.exposure ?? 0, Contrast: paint?.contrast ?? 100 })) field('studioTvPaint' + key, value);
  field('studioReflectionEnabled', reflection?.enabled ?? true);
  for (const [key, value] of Object.entries({ Intensity: reflection?.intensity ?? 65, Table: reflection?.table ?? 60, Floor: reflection?.floor ?? 45, Blur: reflection?.blur ?? 12, Reach: reflection?.reach ?? 100, Spread: reflection?.spread ?? 110, Offset: reflection?.offset ?? 0, Texture: reflection?.texture ?? 40 })) field('studioReflection' + key, value);
  document.querySelectorAll<HTMLElement>('[data-studio-template]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.studioTemplate === scene?.environment)));
  const backgrounds = [...(d.library ?? []), ...d.items].filter(i => i.asset && i.kind !== 'builtin'); const bgSelect = $<HTMLSelectElement>('studioBackgroundAsset');
  const bgSignature = JSON.stringify(backgrounds.map(i => [i.asset, i.name]));
  if (bgSelect.dataset.signature !== bgSignature) { bgSelect.dataset.signature = bgSignature; const seen = new Set<string>(); bgSelect.replaceChildren(new Option('Seleccionar imagen…', ''), ...backgrounds.flatMap(i => seen.has(i.asset) ? [] : (seen.add(i.asset), [new Option(i.name, i.asset)]))); }
  field('studioBackgroundAsset', scene?.background ?? '');
  const angles = perspectiveAngles(t, p?.x);
  field('studioSurface', t.surface ?? 'free'); field('studioAuto', t.auto ?? false);
  field('studioTiltX', Math.round(angles.x)); field('studioTiltY', Math.round(angles.y));
  field('studioDepth', t.depth ?? 800);
  const corners = t.corners ?? straightCorners(); for (let i = 0; i < 4; i++) { field(`studioCorner${i}X`, corners[i][0]); field(`studioCorner${i}Y`, corners[i][1]); }
  field('studioSkewX', t.skewX ?? 0); field('studioSkewY', t.skewY ?? 0); field('studioScaleX', t.scaleX ?? 1); field('studioScaleY', t.scaleY ?? 1);
  $('studioPerspective').querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>('input,select,button').forEach(el => { el.disabled = !p || Boolean(p.locked) || (Boolean(t.auto) && ['studioTiltX', 'studioTiltY'].includes(el.id)); });
  const c = p?.contactShadow;
  for (const [key, value] of Object.entries({ Opacity: c?.opacity ?? 0, Blur: c?.blur ?? 5, Width: c?.width ?? 75, X: c?.x ?? 0, Y: c?.y ?? -2 })) field('studioContact' + key, value);
  [0, 1, 2, 3].forEach(i => field('studioCrop' + i, p?.crop?.[i] ?? 0));
  $('studioAppearance').querySelectorAll<HTMLInputElement | HTMLButtonElement>('input,button').forEach(el => { el.disabled = !p; });
  field('studioLightResponse',p?.lightResponse ?? defaultLightResponse);
  field('studioObjectSolid',Boolean(item && p && isSolidObject(item,p)));field('studioObjectTint',p?.tint ?? '#ffffff');field('studioObjectTintStrength',p?.tintStrength ?? 0);
  $('decorOpacity').closest<HTMLElement>('label')!.hidden=Boolean(item && p && isSolidObject(item,p));
  $<HTMLInputElement>('studioObjectSolid').disabled=!p || Boolean(item && isSolidFurniture(item));
  $<HTMLButtonElement>('studioSelectedLight').disabled=!p;
  field('studioTvDetail',scene?.mood?.tvDetail ?? 70);field('studioTvSoftness',scene?.mood?.tvSoftness ?? 85);
  syncObjectTabs(Boolean(item && isSolidFurniture(item)));
  $('studioObjectTitle').textContent=item?`Editar: ${item.name}`:'Editar objeto';
  $('studioObjectTitle').title=item?.name ?? '';
  $('studioObjectHint').textContent=host.selected().length>1?`${host.selected().length} objetos seleccionados · los ajustes de acabado se aplican a la selección.`:'Los cambios se guardan solo en esta vista.';
  $<HTMLButtonElement>('studioDuplicateObject').disabled=!item || item.kind==='viewer-slot';
  $<HTMLButtonElement>('studioRemoveObject').disabled=!item || item.kind==='viewer-slot';
  $('studioEditSelection').hidden=host.selected().length===0;
  $('studioEditSelection').textContent=`Editar selección (${host.selected().length})`;
  $('studioEditObjectLight').hidden=!p || !(p.light || item?.category==='lamp' || item?.kind==='light');
  $('studioMaterial').hidden=!item || !isSolidFurniture(item);
  $('studioResting').hidden=!item || isSolidFurniture(item) || item.kind==='viewer-slot' || item.kind==='light';
  if(!p && !$('studioObjectInspector').hidden) objectPanel(false);
  $('studioLightFields').querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>('input,select,button').forEach(el => { el.disabled = !p; });
  field('studioLavaMotion', p?.lava?.motion ?? true); field('studioLavaSpeed', p?.lava?.speed ?? 1);
  $<HTMLInputElement>('studioLavaMotion').disabled = item?.asset !== 'lava-lamp'; $<HTMLInputElement>('studioLavaSpeed').disabled = item?.asset !== 'lava-lamp';
  const material = p?.material;
  field('studioMaterialPreset', material?.preset ?? 'original'); field('studioMaterialScope', material?.scope ?? (material && props.find(prop=>prop.id===item?.asset)?.support ? 'top' : 'all'));
  field('studioMaterialColor', material?.color ?? materials.find(m => m.id === material?.preset)?.tint ?? '#ffffff');
  field('studioMaterialStrength', material?.strength ?? 85); field('studioMaterialScale', material?.scale ?? 1); field('studioMaterialRoughness', material?.roughness ?? 65);
  $('studioMaterial').querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>('input,select,button').forEach(el => el.disabled = !p || p.locked === true || !item || !isSolidFurniture(item) || (!el.dataset.furnitureColor && !['studioMaterialPreset','studioMaterialColor'].includes(el.id) && !material));
  $('studioFurnitureColors').querySelectorAll<HTMLButtonElement>('button').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.furnitureColor===material?.color)));
  field('studioObjectCategory', item?.category ?? (item?.kind === 'light' ? 'lamp' : 'figurine'));
  field('studioLightShape', p?.light?.shape ?? 'point'); field('studioLightAngle', p?.light?.angle ?? 0); field('studioLightSoftness', p?.light?.softness ?? 60);
  field('studioKelvin', p?.light?.kelvin ?? 4000);
  field('studioAccent', scene?.mood?.accent ?? d.mood?.accent ?? '#b93cff'); field('studioAccent2', scene?.mood?.accent2 ?? d.mood?.accent2 ?? '#1ec8e6');
  $('studioSelectionCount').textContent = `${host.selected().length} objetos seleccionados`;
  const m = scene?.mood ?? d.mood, zone = $<HTMLSelectElement>('studioZone').value;
  field('studioBacklightColor', m?.backlight?.color ?? '#9e86dd'); field('studioBacklightIntensity', m?.backlight?.intensity ?? 0);
  field('studioBacklightReach', m?.backlight?.reach ?? 115); field('studioShadowDepth', m?.depth ?? 0); field('studioPracticalLights', m?.practicalLights !== false);
  const g = zone === 'all' ? m?.grade : m?.zones?.[zone as Zone];
  for (const [key, value] of Object.entries({ Exposure: g?.exposure ?? 0, Contrast: g?.contrast ?? 100, Saturation: g?.saturation ?? 100, Temperature: g?.temperature ?? 0, Shadows: g?.shadows ?? 0, Influence: g?.influence ?? (zone === 'tv' ? 30 : 100) })) field('studio' + key, value);
  for (const [key, value] of Object.entries({ Rim: m?.rim ?? 100, Cabinet: m?.cabinet ?? 100, Floor: m?.floor ?? 100, Reach: m?.reach ?? 100, Transition: m?.transition ?? 380 })) field('studio' + key, value);
  for (const [id, entries] of [['studioProfile', d.profiles], ['studioVersion', d.versions]] as const) {
    const select = $<HTMLSelectElement>(id), value = select.value;
    const signature = JSON.stringify(entries?.map(p => [p.id, p.name]) ?? []);
    if (select.dataset.signature !== signature) { select.dataset.signature = signature; select.replaceChildren(...(entries ?? []).map(p => new Option(p.name, p.id))); if (entries?.some(p => p.id === value)) select.value = value; }
  }
  const query = $<HTMLInputElement>('studioSearch').value.toLocaleLowerCase(), category = $<HTMLSelectElement>('studioCategory').value;
  $('studioFurnitureTypes').querySelectorAll<HTMLButtonElement>('[data-studio-prop]').forEach(button => { button.hidden = (!button.textContent?.toLocaleLowerCase().includes(query)) || (category !== 'all' && category !== button.dataset.category); });
  const list = $('studioObjectList'), selectedIds=new Set(host.selected()), entries=new Map(d.items.map(i=>[i.id,i]));
  // Selection changes only the existing row state. Do not move selected rows
  // to the top or recreate thumbnails and lose the user's scroll position.
  for(const row of list.querySelectorAll<HTMLElement>('.studio-object-row')) {
    const selected=selectedIds.has(row.dataset.id!);row.classList.toggle('is-selected',selected);
    row.querySelector<HTMLInputElement>('input')!.checked=selected;
    const entry=entries.get(row.dataset.id!);if(!entry)continue;
    const p=entry.placements[host.key() as keyof typeof entry.placements];
    for(const button of row.querySelectorAll<HTMLButtonElement>('[data-row-action]')) {
      const action=button.dataset.rowAction!, on=Boolean(action==='favorite'?entry.favorite:action==='hidden'?p?.hidden:p?.locked);
      const pressed=String(on), icon=action==='favorite'?(on?'★':'☆'):action==='hidden'?(on?'◌':'◉'):(on?'▣':'□');
      if(button.getAttribute('aria-pressed')!==pressed) button.setAttribute('aria-pressed',pressed);
      if(button.textContent!==icon) button.textContent=icon;
    }
  }
  const visible = d.items.filter(i => visibleInRoom(i, scene) && (!query || i.name.toLocaleLowerCase().includes(query)) && (category === 'all' || category === 'favorite' ? category !== 'favorite' || i.favorite : (i.category ?? (i.kind === 'light' ? 'lamp' : 'figurine')) === category));
  const signature = JSON.stringify([host.key(), visible.map(i=>[i.id,i.name,i.asset,i.kind,i.shape,i.category]), query, category]);
  if(signature !== listSignature) {
    listSignature=signature;const scroll=list.scrollTop;list.replaceChildren();
    for (const entry of visible) {
      const row = document.createElement('div'); row.className = 'studio-object-row';row.dataset.id=entry.id; row.classList.toggle('is-selected', selectedIds.has(entry.id));
      const check = document.createElement('input'); check.type = 'checkbox'; check.checked = host.selected().includes(entry.id); check.setAttribute('aria-label', `Añadir ${entry.name} a selección`); check.addEventListener('change', () => host!.select(entry.id, true));
      const button = document.createElement('button'); button.type = 'button'; button.className = 'studio-object-select';
      const image = document.createElement('img'); image.alt = ''; image.src = entry.kind === 'shape' ? shapeAsset(entry.shape) : entry.kind === 'builtin' ? builtinUrl(entry.asset) : entry.asset ? host.asset(`/api/decorations/assets/${encodeURIComponent(entry.asset)}`) : shapeAsset(entry.kind === 'light' ? 'star' : 'robot');
      const text = document.createElement('span'); text.textContent = entry.name; button.append(image, text); button.addEventListener('click', e => host!.select(entry.id, e.shiftKey || e.ctrlKey || e.metaKey)); row.append(check, button);
      const placement = entry.placements[host.key() as keyof typeof entry.placements];
      for (const [action, label, on] of [['favorite', 'Favorito', entry.favorite], ['hidden', 'Ocultar', placement?.hidden], ['locked', 'Bloquear', placement?.locked]] as const) {
        const actionButton = document.createElement('button'); actionButton.type = 'button';actionButton.dataset.rowAction=action; actionButton.title = label; actionButton.setAttribute('aria-label', `${label}: ${entry.name}`); actionButton.setAttribute('aria-pressed', String(Boolean(on))); actionButton.textContent = action === 'favorite' ? on ? '★' : '☆' : action === 'hidden' ? on ? '◌' : '◉' : on ? '▣' : '□';
        actionButton.addEventListener('click', () => {
          const current=host!.draft().items.find(i=>i.id===entry.id);if(!current)return;
          const p=current.placements[host!.key() as keyof typeof current.placements];
          if(action==='favorite') current.favorite=!current.favorite;else if(p) p[action]=!p[action];host!.change();
        }); row.append(actionButton);
      } list.append(row);
    }
    list.scrollTop=scroll;
  }
  const nextLibrarySignature=JSON.stringify([d.library,d.items.map(i=>[i.id,i.asset,i.kind,i.shape,i.name,i.category,i.favorite]),query,category]);
  if(nextLibrarySignature===librarySignature)return;librarySignature=nextLibrarySignature;
  const gallery = $('studioLibraryList'); gallery.replaceChildren();
  const library: Omit<Decoration, 'placements'>[] = [...props.map(p => ({ id: p.id, asset: p.id, name: p.name, category: p.category, kind: 'builtin' as const })), ...Object.keys(names).map(shape => ({ id: shape, name: names[shape], asset: '', kind: 'shape' as const, shape, category: shape === 'frame' || shape === 'poster' ? shape : 'figurine' })), ...(d.library ?? []), ...d.items.filter(i => i.kind !== 'light' && i.kind !== 'viewer-slot')];
  const seen = new Set<string>();
  for (const entry of library.filter(i => (!query || i.name.toLocaleLowerCase().includes(query)) && (category === 'all' || (category === 'favorite' ? Boolean((i as Decoration).favorite) : (i.category ?? 'figurine') === category)))) {
    const key = entry.asset || entry.shape || entry.id; if (seen.has(key)) continue; seen.add(key);
    const button = document.createElement('button'); button.type = 'button'; button.title = `Añadir ${entry.name}`;
    const image = document.createElement('img'); image.alt = ''; image.src = entry.kind === 'shape' ? shapeAsset(entry.shape) : entry.kind === 'builtin' ? builtinUrl(entry.asset) : host.asset(`/api/decorations/assets/${encodeURIComponent(entry.asset)}`);
    const label = document.createElement('span'); label.textContent = entry.name; button.append(image, label);
    button.addEventListener('click', () => { rememberAssets(); const copy: Decoration = entry.kind === 'builtin' ? builtinDecoration(entry.asset) : { ...structuredClone(entry), id: crypto.randomUUID(), placements: {} }; delete copy.group; delete copy.roomKit;
      if (copy.kind === 'builtin') copy.placements[host!.key() as keyof typeof copy.placements] = roomPlacement(copy.asset, host!.key().includes('portrait'));
      host!.create(copy); }); gallery.append(button);
  }
}
