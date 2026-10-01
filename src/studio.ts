import type { Decoration, Manifest, Placement, RoomSnapshot } from './decorations';
import { perspectiveAngles, type Grade, type Mood, type Daytime, type Transform, type Zone } from './studio-model';
import { type Presentation, type TvPaint, type Reflection } from './presentation-model';
import { straightCorners, validCorners } from './perspective';

type Host = {
  draft(): Manifest; saved(): Manifest; item(): Decoration | undefined; key(): string; selected(): string[];
  select(id: string, additive?: boolean): void; change(group?: string): void; convert(p: Placement): boolean;
  command(command: string): void; status(message: string): void; create(item: Decoration): void;
  compare(value: boolean): void; test(value: string): void; asset(path: string): string; resize(): void;
  restore(room: RoomSnapshot): void;
  background(file: File): Promise<string>;
  tool(tool: 'select' | 'pan' | 'tv' | 'camera' | 'screen' | 'warp'): void;
};
let host: Host | undefined;
let listSignature = '';
let appearance: Partial<Placement> | undefined;
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
function mood(): Mood { return host!.draft().mood ??= { preset: 'neutral', intensity: 65, tvGlow: 100 }; }
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
  $('studioScene').innerHTML = '<p class="studio-note">Cada vista y tamaño de TV conserva su composición. El zoom de la vista previa solo ayuda a editar; los controles de aquí cambian el escenario compartido.</p><div class="studio-template-grid"><button data-studio-template="morning" style="--swatch:#8c9da8">Mañana</button><button data-studio-template="day" style="--swatch:#789bbb">Día</button><button data-studio-template="evening" style="--swatch:#a26534">Tarde</button><button data-studio-template="classic" style="--swatch:#273348">Noche · 3 a. m.</button></div>' +
    panel('studioBackground', 'Fondo de la habitación', '<label>Escenario<select id="studioSceneStyle"><option value="classic">Habitación original</option><option value="custom">Mi imagen de fondo</option></select></label><label class="editor-upload">Subir fondo<input id="studioBackgroundUpload" type="file" accept="image/png,image/jpeg,image/webp,image/gif"/></label><label>Reutilizar imagen<select id="studioBackgroundAsset"></select></label><p class="studio-note">Los cuatro momentos usan imágenes de la misma habitación sin reflejos pintados. Mover la TV conserva el fondo.</p>', true) +
    panel('studioCamera', 'Encuadre del escenario', range('studioCameraX', 'Mover horizontalmente', -50, 50) + range('studioCameraY', 'Mover verticalmente', -50, 50) + range('studioCameraZoom', 'Zoom del escenario', .5, 2.5, .05) + '<div class="studio-buttons">' + buttons([['cameraTool', 'Encuadrar con el ratón'], ['resetCamera', 'Restablecer']]) + '</div>') +
    panel('studioTv', 'Posición y tamaño de la TV / arcade', range('studioTvX', 'Posición horizontal', -80, 80) + range('studioTvY', 'Posición vertical', -80, 80) + range('studioTvZoom', 'Tamaño de la TV', .3, 2.5, .05) + '<div class="studio-buttons">' + buttons([['tvTool', 'Mover TV en la escena'], ['resetTv', 'Restablecer']]) + '</div><p class="studio-note">Mueve la TV y su marco; la habitación conserva su posición.</p>') +
    panel('studioTvPaint', 'Color de la TV · avanzado', '<label class="studio-check"><input id="studioTvPaintEnabled" type="checkbox"/> Colorear la carcasa</label><div class="studio-buttons">' + ['gray', 'blue', 'pink', 'cream', 'black'].map((v, i) => `<button type="button" data-studio-tv-paint="${v}">${['Gris', 'Azul', 'Rosa', 'Crema', 'Negro'][i]}</button>`).join('') + '</div><label>Carcasa<input id="studioTvPaintBody" type="color"/></label><label>Marco de pantalla<input id="studioTvPaintBezel" type="color"/></label><label>Panel inferior y botones<input id="studioTvPaintPanel" type="color"/></label>' + range('studioTvPaintStrength', 'Mezcla de color', 0, 100) + range('studioTvPaintHue', 'Tono', -180, 180) + range('studioTvPaintSaturation', 'Saturación', 0, 200) + range('studioTvPaintExposure', 'Exposición', -60, 60) + range('studioTvPaintContrast', 'Contraste', 50, 150) + '<label>Acabado<select id="studioTvPaintFinish"><option value="matte">Mate</option><option value="satin">Satinado</option><option value="gloss">Brillante</option></select></label><div class="studio-buttons">' + buttons([['resetTvPaint', 'Color original de la TV']]) + '</div><p class="studio-note">Conserva la textura y las sombras. El acabado cambia la respuesta a la luz del vídeo. La pantalla mantiene sus colores.</p>') +
    panel('studioScreen', 'Pantalla · independiente de la TV', range('studioScreenX', 'Posición horizontal de pantalla', -50, 50, .5) + range('studioScreenY', 'Posición vertical de pantalla', -50, 50, .5) + range('studioScreenWidth', 'Ancho de pantalla', 50, 150, .5) + range('studioScreenHeight', 'Alto de pantalla', 50, 150, .5) + '<div class="studio-buttons">' + buttons([['screenTool', 'Ajustar pantalla con el ratón'], ['resetScreen', 'Restablecer pantalla']]) + '</div><p class="studio-note">Ajusta el área de reproducción dentro del marco. El zoom del vídeo se controla por separado abajo.</p>') +
    panel('studioVideo', 'Encuadre del vídeo', range('studioVideoZoom', 'Zoom dentro de la pantalla', 1, 3, .05) + range('studioVideoX', 'Encuadre horizontal', -50, 50) + range('studioVideoY', 'Encuadre vertical', -50, 50) + '<div class="studio-buttons">' + buttons([['resetVideo', 'Restablecer vídeo']]) + '</div><p class="studio-note">El vídeo queda recortado por el marco. Su luz sigue el área visible.</p>') +
    '<div class="studio-buttons">' + buttons([['copyPresentation', 'Copiar a otras vistas'], ['resetPresentation', 'Restablecer esta escena']]) + '</div>';
  objects.insertAdjacentHTML('beforeend', '<div class="studio-search"><input id="studioSearch" type="search" placeholder="Buscar decoración…" aria-label="Buscar decoración"/><select id="studioCategory" aria-label="Categoría"><option value="all">Todo</option><option value="favorite">Favoritos</option><option value="figurine">Figuras</option><option value="sticker">Estampas</option><option value="poster">Pósters</option><option value="frame">Marcos</option><option value="lamp">Lámparas</option></select></div><div id="studioObjectList" class="studio-list"></div>');
  old.forEach(node => objects.append(node));
  const native = $('editorItem').closest('label')!; native.classList.add('studio-native-select'); $<HTMLSelectElement>('editorItem').size = 1;
  objects.prepend($('editorUpload').closest('label')!);
  const props = $('editorProperties');
  props.insertAdjacentHTML('afterbegin', '<label class="editor-wide">Tipo<select id="studioObjectCategory"><option value="figurine">Figurita</option><option value="sticker">Estampa</option><option value="poster">Póster</option><option value="frame">Marco</option><option value="lamp">Lámpara</option></select></label>');
  // Keep everyday adjustments in view and gather the rest into small disclosures.
  objects.insertAdjacentHTML('beforeend', panel('studioPerspective', 'Perspectiva y transformación',
    '<label>Vista preparada<select id="studioPerspectivePreset"><option value="custom">Personalizada</option><option value="front">Frontal</option><option value="left">Desde la izquierda</option><option value="right">Desde la derecha</option><option value="above">Desde arriba</option><option value="below">Desde abajo</option><option value="iso-left">Isométrica izquierda</option><option value="iso-right">Isométrica derecha</option><option value="floor">Sobre el suelo</option><option value="ceiling">En el techo</option></select></label><label>Superficie<select id="studioSurface"><option value="free">Libre</option><option value="wall">Pared frontal</option><option value="left-wall">Pared izquierda</option><option value="right-wall">Pared derecha</option><option value="cabinet">Mueble</option><option value="shelf">Repisa</option><option value="floor">Suelo</option><option value="ceiling">Techo</option></select></label><label class="studio-check"><input id="studioAuto" type="checkbox"/> Ajustar automáticamente</label><p class="studio-note">Las vistas son proyecciones de tu imagen. Para otro lado de una figura necesitas una imagen de ese lado.</p>' +
    range('studioTiltX', 'Inclinación vertical', -85, 85) + range('studioTiltY', 'Inclinación lateral', -85, 85) + range('studioDepth', 'Profundidad de perspectiva', 150, 2000, 10) +
    range('studioSkewX', 'Deformación horizontal', -45, 45) + range('studioSkewY', 'Deformación vertical', -45, 45) +
    range('studioScaleX', 'Estirar ancho', .25, 2.5, .05) + range('studioScaleY', 'Estirar alto', .25, 2.5, .05) +
    '<div class="studio-buttons">' + buttons([['flipX', 'Voltear ↔'], ['flipY', 'Voltear ↕'], ['warpTool', 'Editar las 4 esquinas'], ['resetCorners', 'Restablecer esquinas'], ['resetTransform', 'Restablecer']]) + '</div><details><summary>Coordenadas de las esquinas</summary><div class="studio-corner-fields">' + [0, 1, 2, 3].map(i => `<label>${['Superior izquierda', 'Superior derecha', 'Inferior derecha', 'Inferior izquierda'][i]}<span><input id="studioCorner${i}X" type="number" min="-60" max="160" step="1" aria-label="Esquina ${i + 1} X"/><input id="studioCorner${i}Y" type="number" min="-60" max="160" step="1" aria-label="Esquina ${i + 1} Y"/></span></label>`).join('') + '</div></details>') +
    panel('studioAppearance', 'Acabado, recorte y sombra de apoyo',
      range('studioContactOpacity', 'Sombra de apoyo', 0, 100) + range('studioContactBlur', 'Suavidad de sombra', 0, 25) + range('studioContactWidth', 'Ancho de sombra', 20, 160) +
      range('studioContactX', 'Desplazar sombra X', -50, 50) + range('studioContactY', 'Desplazar sombra Y', -40, 40) +
      [0, 1, 2, 3].map((i) => range(`studioCrop${i}`, `Recorte ${['arriba', 'derecha', 'abajo', 'izquierda'][i]}`, 0, 45)).join('') +
      '<div class="studio-buttons">' + buttons([['copyStyle', 'Copiar acabado'], ['pasteStyle', 'Pegar acabado']]) + '</div>') +
    panel('studioGroups', 'Selección, grupos y alineación', '<p class="studio-note">Shift / Ctrl + clic suma objetos. En móvil usa la casilla junto a cada objeto. Alt + clic elige un miembro del grupo.</p><output id="studioSelectionCount"></output><div class="studio-buttons">' + buttons([['selectAll', 'Seleccionar todos'], ['group', 'Agrupar'], ['ungroup', 'Desagrupar'], ['alignX', 'Alinear X'], ['alignY', 'Alinear Y'], ['distributeX', 'Distribuir X'], ['distributeY', 'Distribuir Y']]) + '</div>') +
    panel('studioLibrary', 'Mi biblioteca', '<p class="studio-note">Reutiliza tus imágenes o empieza con estas piezas.</p><div id="studioLibraryList" class="studio-gallery"></div>'));
  const appearanceFields = ['decorBrightness', 'decorSaturation', 'decorHue', 'decorShadow'];
  appearanceFields.forEach(id => $('studioAppearance').querySelector('.studio-fields')!.prepend($(id).closest('label')!));
  // Move existing emission controls without replacing their listeners or IDs.
  lights.append($('editorAddLight'));
  lights.insertAdjacentHTML('beforeend', '<p class="studio-note">Selecciona una lámpara o una imagen en la escena para cambiar su luz.</p><div id="studioLightFields" class="studio-fields"></div>');
  const lightFields = $('studioLightFields');
  for (const id of ['decorEmitLight', 'decorLightColor', 'decorLightIntensity', 'decorLightRadius', 'decorLightX', 'decorLightY']) lightFields.append($(id).closest('label')!);
  lightFields.insertAdjacentHTML('beforeend', '<label>Forma<select id="studioLightShape"><option value="point">Puntual</option><option value="spot">Foco</option><option value="strip">Tira LED</option></select></label>' + range('studioLightAngle', 'Orientación', -180, 180) + range('studioLightSoftness', 'Suavidad', 0, 100) + range('studioKelvin', 'Temperatura (K)', 2000, 10000, 100) + '<div class="studio-buttons">' + buttons([['lightToggle', 'Encender / apagar']]) + '</div>');
  environment.append($('editorAmbient').closest('label')!, $('editorEnvironment'));
  const presets: [string, string][] = [['neutral', 'Original / neutro'], ['classic-night', 'Noche clásica'], ['tv-only', 'Solo la TV'], ['moonlight', 'Luz de luna'], ['warm', 'Noche acogedora'], ['soft-night', 'Noche suave'], ['blue-night', 'Noche azul sutil'], ['neon', 'Neón']];
  $<HTMLSelectElement>('editorMood').replaceChildren(...presets.map(([value, name]) => new Option(name, value)));
  environment.insertAdjacentHTML('beforeend', panel('studioGrade', 'Color por superficie · avanzado',
    '<label>Aplicar a<select id="studioZone"><option value="all">Todo el entorno</option><option value="wall">Pared</option><option value="cabinet">Mueble</option><option value="floor">Suelo</option><option value="tv">Carcasa de la TV</option><option value="figures">Figuras</option></select></label>' +
    range('studioExposure', 'Exposición', -60, 60) + range('studioContrast', 'Contraste', 50, 150) + range('studioSaturation', 'Saturación', 0, 150) + range('studioTemperature', 'Temperatura', -100, 100) + range('studioShadows', 'Profundidad de sombras', 0, 60) + range('studioInfluence', 'Influencia del ambiente', 0, 100) + '<div class="studio-buttons">' + buttons([['resetGrade', 'Restablecer superficie'], ['resetMood', 'Restablecer ambiente']]) + '</div>') +
    panel('studioReflections', 'Reflejos del vídeo · inmersivos', '<label class="studio-check"><input id="studioReflectionEnabled" type="checkbox"/> Reflejos en tiempo real</label>' + range('studioReflectionIntensity', 'Intensidad general', 0, 150) + range('studioReflectionTable', 'Reflejo en la mesa', 0, 200) + range('studioReflectionFloor', 'Reflejo en el suelo', 0, 200) + range('studioReflectionBlur', 'Desenfoque del reflejo', 0, 30) + range('studioReflectionReach', 'Largo del reflejo', 30, 180) + range('studioReflectionSpread', 'Ancho del reflejo', 50, 180) + range('studioReflectionOffset', 'Desplazamiento', -20, 30) + range('studioReflectionTexture', 'Textura de la madera', 0, 100) + '<div class="studio-buttons">' + buttons([['resetReflections', 'Restablecer reflejos']]) + '</div><p class="studio-note">Proyecta el vídeo visible sobre las superficies de la imagen. Solo aparece donde la mesa o el suelo están a la vista. Se guarda por vista.</p>') +
    panel('studioBounce', 'Luz de la pantalla · avanzado', range('studioRim', 'Carcasa', 0, 200) + range('studioCabinet', 'Mueble', 0, 200) + range('studioFloor', 'Suelo', 0, 200) + range('studioReach', 'Alcance', 30, 180) + range('studioTransition', 'Transición (ms)', 150, 2000, 50) + '<label>Prueba de iluminación<select id="studioTest"><option value="live">Vídeo actual</option><option value="red">Rojo</option><option value="blue">Azul</option><option value="white">Blanco</option><option value="dark">Pantalla apagada</option></select></label><p class="studio-note">La prueba cambia solo la luz de esta vista previa.</p>') +
    panel('studioNeon', 'Colores de neón', '<label>Color izquierdo<input id="studioAccent" type="color"/></label><label>Color derecho<input id="studioAccent2" type="color"/></label><p class="studio-note">Activa el ambiente Neón para ver estos colores.</p>') +
    panel('studioRooms', 'Mis ambientes y versiones', '<label>Nombre<input id="studioRoomName" maxlength="70" placeholder="Mi noche favorita"/></label><div class="studio-buttons">' + buttons([['saveRoom', 'Guardar ambiente'], ['loadRoom', 'Aplicar'], ['deleteRoom', 'Eliminar']]) + '</div><select id="studioProfile" aria-label="Ambientes guardados"></select><label>Versiones anteriores<select id="studioVersion"></select></label><div class="studio-buttons">' + buttons([['loadVersion', 'Restaurar versión']]) + '</div><p class="studio-note">Guarda para todos para conservar tus ambientes y las tres versiones anteriores.</p>'));
  // Remove obsolete section headings after relocating their controls.
  props.querySelectorAll('strong').forEach(node => node.remove());
  document.querySelector('.editor-tools')!.insertAdjacentHTML('beforeend', '<button id="studioTvTool" type="button" aria-pressed="false">Mover TV</button><button id="studioScreenTool" type="button" aria-pressed="false">Ajustar pantalla</button><button id="studioCameraTool" type="button" aria-pressed="false">Encuadrar</button><button id="studioWarpTool" type="button" aria-pressed="false">Perspectiva</button><button id="studioCompare" type="button" aria-pressed="false">Antes / después</button><button id="studioImmersive" type="button" aria-pressed="false">Solo escena</button>');
  for (const [id, cmd] of [['studioTvTool', 'tvTool'], ['studioCameraTool', 'cameraTool'], ['studioScreenTool', 'screenTool'], ['studioWarpTool', 'warpTool']]) $(id).addEventListener('click', () => command(cmd));
  for (const id of ['Objects', 'Lights', 'Mood', 'Scene']) {
    const tab = $(`studio${id}Tab`);
    tab.addEventListener('click', () => {
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
  for (const group of ['Camera', 'Tv', 'Video'] as const) for (const axis of ['X', 'Y', 'Zoom'] as const) $(`studio${group}${axis}`).addEventListener('input', () => {
    const p = presentation(), key = group.toLowerCase() as 'camera' | 'tv' | 'video';
    (p[key] ??= {})[axis.toLowerCase() as 'x' | 'y' | 'zoom'] = Number($<HTMLInputElement>(`studio${group}${axis}`).value); h.change('presentation');
  });
  for (const axis of ['X', 'Y', 'Width', 'Height'] as const) $(`studioScreen${axis}`).addEventListener('input', () => { const p = presentation(); (p.screen ??= {})[axis.toLowerCase() as 'x' | 'y' | 'width' | 'height'] = Number($<HTMLInputElement>(`studioScreen${axis}`).value); h.change('screen'); });
  $('studioSceneStyle').addEventListener('change', () => { presentation().style = $<HTMLSelectElement>('studioSceneStyle').value as Presentation['style']; h.change(); });
  $('studioBackgroundAsset').addEventListener('change', () => { const p = presentation(); p.background = $<HTMLSelectElement>('studioBackgroundAsset').value || undefined; p.style = 'custom'; h.change(); });
  $('studioBackgroundUpload').addEventListener('change', async () => {
    const input = $<HTMLInputElement>('studioBackgroundUpload'), file = input.files?.[0]; input.value = ''; if (!file) return;
    try { h.status('Subiendo fondo…'); const asset = await h.background(file); const p = presentation(); p.background = asset; p.style = 'custom'; h.change(); h.status('Fondo listo. Guarda para compartirlo.'); }
    catch (error) { h.status(error instanceof Error ? error.message : 'No se pudo subir el fondo.'); }
  });
  sidebar.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLElement>('[data-studio-template]'); if (!button) return;
    const kind = button.dataset.studioTemplate!, p = presentation();
    const daytime: Daytime = kind === 'classic' ? 'night' : kind as Daytime;
    delete p.background; p.style = 'classic';
    h.draft().mood = { ...h.draft().mood, daytime, preset: daytime === 'night' ? 'classic-night' : 'neutral', intensity: 65, tvGlow: h.draft().mood?.tvGlow ?? 100 };
    h.draft().ambient = daytime === 'night' ? 42 : daytime === 'morning' ? 82 : daytime === 'day' ? 100 : 72; h.change();
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
    h.draft().ambient = ambient[preset]; h.change();
  });
  refreshStudio();
}
function command(cmd: string) {
  if (!host) return;
  const d = host.draft(), ps = placements(), ids = host.selected();
  if (cmd === 'warpTool') { host.tool('warp'); return; }
  else if (cmd === 'resetCorners') ps.filter(p => !p.locked).forEach(p => { if (p.transform) delete p.transform.corners; });
  else if (cmd === 'cameraTool' || cmd === 'tvTool' || cmd === 'screenTool') { host.tool(cmd === 'tvTool' ? 'tv' : cmd === 'screenTool' ? 'screen' : 'camera'); return; }
  else if (['resetCamera', 'resetTv', 'resetVideo', 'resetScreen'].includes(cmd)) delete presentation()[cmd.slice(5).toLowerCase() as 'camera' | 'tv' | 'video' | 'screen'];
  else if (cmd === 'resetTvPaint') delete presentation().tvPaint;
  else if (cmd === 'resetReflections') delete presentation().reflection;
  else if (cmd === 'resetPresentation') { if (d.presentations) delete d.presentations[host.key() as keyof typeof d.presentations]; }
  else if (cmd === 'copyPresentation') { const p = structuredClone(presentation()), keys = host.key().startsWith('home') ? ['home-landscape-16x9', 'home-landscape-4x3', 'home-portrait-16x9', 'home-portrait-4x3', 'home-window-16x9', 'home-window-4x3'] : ['arcade-landscape', 'arcade-portrait', 'arcade-window']; keys.forEach(key => (d.presentations ??= {})[key as keyof typeof d.presentations] = structuredClone(p)); host.status('Composición copiada. Revisa el encuadre de cada vista.'); }
  else if (cmd.startsWith('flip')) { ps.filter(p => !p.locked).forEach(p => { const t = p.transform ??= {}, key = cmd as 'flipX' | 'flipY'; t[key] = !t[key]; }); }
  else if (cmd === 'resetTransform') ps.filter(p => !p.locked).forEach(p => { delete p.transform; });
  else if (cmd === 'copyStyle') { const p = ps.at(-1); if (p) { appearance = structuredClone({ brightness: p.brightness, saturation: p.saturation, hue: p.hue, shadow: p.shadow, opacity: p.opacity, contactShadow: p.contactShadow, crop: p.crop }); host.status('Acabado copiado. Selecciona otra decoración para pegarlo.'); } return; }
  else if (cmd === 'pasteStyle' && appearance) ps.forEach(p => Object.assign(p, structuredClone(appearance)));
  else if (cmd === 'selectAll') { d.items.filter(i => i.placements[host!.key() as keyof typeof i.placements]).forEach((i, n) => host!.select(i.id, n !== 0)); return; }
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
  else if (cmd === 'resetMood') { delete d.mood; d.ambient = 62; }
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
  field('studioSceneStyle', scene?.style === 'custom' ? 'custom' : 'classic');
  for (const group of ['Camera', 'Tv', 'Video'] as const) for (const axis of ['X', 'Y', 'Zoom'] as const) {
    const value = scene?.[group.toLowerCase() as 'camera' | 'tv' | 'video']?.[axis.toLowerCase() as 'x' | 'y' | 'zoom'];
    field(`studio${group}${axis}`, value ?? (axis === 'Zoom' ? group === 'Video' ? 1.035 : 1 : 0));
  }
  for (const axis of ['X', 'Y', 'Width', 'Height'] as const) field(`studioScreen${axis}`, scene?.screen?.[axis.toLowerCase() as 'x' | 'y' | 'width' | 'height'] ?? (axis === 'X' || axis === 'Y' ? 0 : 100));
  const paint = scene?.tvPaint, reflection = scene?.reflection;
  field('studioTvPaintEnabled', paint?.enabled ?? false); field('studioTvPaintBody', paint?.body ?? '#596675'); field('studioTvPaintBezel', paint?.bezel ?? '#364455'); field('studioTvPaintPanel', paint?.panel ?? '#596675'); field('studioTvPaintFinish', paint?.finish ?? 'matte');
  for (const [key, value] of Object.entries({ Strength: paint?.strength ?? 85, Hue: paint?.hue ?? 0, Saturation: paint?.saturation ?? 100, Exposure: paint?.exposure ?? 0, Contrast: paint?.contrast ?? 100 })) field('studioTvPaint' + key, value);
  field('studioReflectionEnabled', reflection?.enabled ?? true);
  for (const [key, value] of Object.entries({ Intensity: reflection?.intensity ?? 90, Table: reflection?.table ?? 100, Floor: reflection?.floor ?? 90, Blur: reflection?.blur ?? 8, Reach: reflection?.reach ?? 100, Spread: reflection?.spread ?? 110, Offset: reflection?.offset ?? 0, Texture: reflection?.texture ?? 40 })) field('studioReflection' + key, value);
  document.querySelectorAll<HTMLElement>('[data-studio-template]').forEach(button => button.setAttribute('aria-pressed', String((button.dataset.studioTemplate === 'classic' ? 'night' : button.dataset.studioTemplate) === (d.mood?.daytime ?? 'night'))));
  const backgrounds = [...(d.library ?? []), ...d.items].filter(i => i.asset); const bgSelect = $<HTMLSelectElement>('studioBackgroundAsset');
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
  $('studioLightFields').querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>('input,select,button').forEach(el => { el.disabled = !p; });
  field('studioObjectCategory', item?.category ?? (item?.kind === 'light' ? 'lamp' : 'figurine'));
  field('studioLightShape', p?.light?.shape ?? 'point'); field('studioLightAngle', p?.light?.angle ?? 0); field('studioLightSoftness', p?.light?.softness ?? 60);
  field('studioKelvin', p?.light?.kelvin ?? 4000);
  field('studioAccent', d.mood?.accent ?? '#b93cff'); field('studioAccent2', d.mood?.accent2 ?? '#1ec8e6');
  $('studioSelectionCount').textContent = `${host.selected().length} objetos seleccionados`;
  const m = d.mood, zone = $<HTMLSelectElement>('studioZone').value;
  const g = zone === 'all' ? m?.grade : m?.zones?.[zone as Zone];
  for (const [key, value] of Object.entries({ Exposure: g?.exposure ?? 0, Contrast: g?.contrast ?? 100, Saturation: g?.saturation ?? 100, Temperature: g?.temperature ?? 0, Shadows: g?.shadows ?? 0, Influence: g?.influence ?? (zone === 'tv' ? 30 : 100) })) field('studio' + key, value);
  for (const [key, value] of Object.entries({ Rim: m?.rim ?? 100, Cabinet: m?.cabinet ?? 100, Floor: m?.floor ?? 100, Reach: m?.reach ?? 100, Transition: m?.transition ?? 380 })) field('studio' + key, value);
  for (const [id, entries] of [['studioProfile', d.profiles], ['studioVersion', d.versions]] as const) {
    const select = $<HTMLSelectElement>(id), value = select.value;
    const signature = JSON.stringify(entries?.map(p => [p.id, p.name]) ?? []);
    if (select.dataset.signature !== signature) { select.dataset.signature = signature; select.replaceChildren(...(entries ?? []).map(p => new Option(p.name, p.id))); if (entries?.some(p => p.id === value)) select.value = value; }
  }
  const query = $<HTMLInputElement>('studioSearch').value.toLocaleLowerCase(), category = $<HTMLSelectElement>('studioCategory').value;
  const signature = JSON.stringify([d.items.map(i => [i.id, i.name, i.asset, i.kind, i.shape, i.category, i.favorite, i.group, i.placements[host!.key() as keyof typeof i.placements]?.hidden, i.placements[host!.key() as keyof typeof i.placements]?.locked]), d.library, host.selected(), query, category]);
  if (signature === listSignature) return; listSignature = signature;
  const list = $('studioObjectList'); list.replaceChildren();
  const visible = d.items.filter(i => (!query || i.name.toLocaleLowerCase().includes(query)) && (category === 'all' || category === 'favorite' ? category !== 'favorite' || i.favorite : (i.category ?? (i.kind === 'light' ? 'lamp' : 'figurine')) === category));
  visible.sort((a, b) => Number(host!.selected().includes(b.id)) - Number(host!.selected().includes(a.id)));
  for (const entry of visible) {
    const row = document.createElement('div'); row.className = 'studio-object-row'; row.classList.toggle('is-selected', host.selected().includes(entry.id));
    const check = document.createElement('input'); check.type = 'checkbox'; check.checked = host.selected().includes(entry.id); check.setAttribute('aria-label', `Añadir ${entry.name} a selección`); check.addEventListener('change', () => host!.select(entry.id, true));
    const button = document.createElement('button'); button.type = 'button'; button.className = 'studio-object-select';
    const image = document.createElement('img'); image.alt = ''; image.src = entry.kind === 'shape' ? shapeAsset(entry.shape) : entry.asset ? host.asset(`/api/decorations/assets/${encodeURIComponent(entry.asset)}`) : shapeAsset(entry.kind === 'light' ? 'star' : 'robot');
    const text = document.createElement('span'); text.textContent = entry.name; button.append(image, text); button.addEventListener('click', e => host!.select(entry.id, e.shiftKey || e.ctrlKey || e.metaKey)); row.append(check, button);
    const placement = entry.placements[host.key() as keyof typeof entry.placements];
    for (const [action, label, on] of [['favorite', 'Favorito', entry.favorite], ['hidden', 'Ocultar', placement?.hidden], ['locked', 'Bloquear', placement?.locked]] as const) {
      const actionButton = document.createElement('button'); actionButton.type = 'button'; actionButton.title = label; actionButton.setAttribute('aria-label', `${label}: ${entry.name}`); actionButton.setAttribute('aria-pressed', String(Boolean(on))); actionButton.textContent = action === 'favorite' ? on ? '★' : '☆' : action === 'hidden' ? on ? '◌' : '◉' : on ? '▣' : '□';
      actionButton.addEventListener('click', () => { if (action === 'favorite') entry.favorite = !entry.favorite; else if (placement) placement[action] = !placement[action]; host!.change(); }); row.append(actionButton);
    } list.append(row);
  }
  const gallery = $('studioLibraryList'); gallery.replaceChildren();
  const library = [...Object.keys(names).map(shape => ({ id: shape, name: names[shape], asset: '', kind: 'shape' as const, shape, category: shape === 'frame' || shape === 'poster' ? shape : 'figurine' })), ...(d.library ?? []), ...d.items.filter(i => i.kind !== 'light' && i.kind !== 'viewer-slot')];
  const seen = new Set<string>();
  for (const entry of library.filter(i => (!query || i.name.toLocaleLowerCase().includes(query)) && (category === 'all' || (category === 'favorite' ? Boolean((i as Decoration).favorite) : (i.category ?? 'figurine') === category)))) {
    const key = entry.asset || entry.shape || entry.id; if (seen.has(key)) continue; seen.add(key);
    const button = document.createElement('button'); button.type = 'button'; button.title = `Añadir ${entry.name}`;
    const image = document.createElement('img'); image.alt = ''; image.src = entry.kind === 'shape' ? shapeAsset(entry.shape) : host.asset(`/api/decorations/assets/${encodeURIComponent(entry.asset)}`);
    const label = document.createElement('span'); label.textContent = entry.name; button.append(image, label);
    button.addEventListener('click', () => { rememberAssets(); const copy = { ...structuredClone(entry), id: crypto.randomUUID(), placements: {} }; delete (copy as Decoration).group; host!.create(copy); }); gallery.append(button);
  }
}
