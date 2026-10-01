import type { Decoration, Manifest, Placement, RoomSnapshot } from './decorations';
import { perspectiveAngles, type Grade, type Mood, type Transform, type Zone } from './studio-model';

type Host = {
  draft(): Manifest; saved(): Manifest; item(): Decoration | undefined; key(): string; selected(): string[];
  select(id: string, additive?: boolean): void; change(group?: string): void; convert(p: Placement): boolean;
  command(command: string): void; status(message: string): void; create(item: Decoration): void;
  compare(value: boolean): void; test(value: string): void; asset(path: string): string; resize(): void;
  restore(room: RoomSnapshot): void;
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
  const input = $<HTMLInputElement>(id); if (!input || document.activeElement === input) return;
  if (input.type === 'checkbox') input.checked = Boolean(value); else input.value = String(value);
  const output = $<HTMLOutputElement>(`${id}Value`); if (output) output.value = String(value);
}
function room(): RoomSnapshot { const d = host!.draft(); return structuredClone({ items: d.items, ambient: d.ambient, mood: d.mood }); }
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
  objects.insertAdjacentHTML('beforeend', '<div class="studio-search"><input id="studioSearch" type="search" placeholder="Buscar decoración…" aria-label="Buscar decoración"/><select id="studioCategory" aria-label="Categoría"><option value="all">Todo</option><option value="favorite">Favoritos</option><option value="figurine">Figuras</option><option value="sticker">Estampas</option><option value="poster">Pósters</option><option value="frame">Marcos</option><option value="lamp">Lámparas</option></select></div><div id="studioObjectList" class="studio-list"></div>');
  old.forEach(node => objects.append(node));
  const native = $('editorItem').closest('label')!; native.classList.add('studio-native-select'); $<HTMLSelectElement>('editorItem').size = 1;
  objects.prepend($('editorUpload').closest('label')!);
  const props = $('editorProperties');
  props.insertAdjacentHTML('afterbegin', '<label class="editor-wide">Tipo<select id="studioObjectCategory"><option value="figurine">Figurita</option><option value="sticker">Estampa</option><option value="poster">Póster</option><option value="frame">Marco</option><option value="lamp">Lámpara</option></select></label>');
  // Keep everyday adjustments in view and gather the rest into small disclosures.
  objects.insertAdjacentHTML('beforeend', panel('studioPerspective', 'Perspectiva y transformación',
    '<label>Superficie<select id="studioSurface"><option value="free">Libre</option><option value="wall">Pared</option><option value="cabinet">Mueble</option><option value="floor">Suelo</option></select></label><label class="studio-check"><input id="studioAuto" type="checkbox"/> Ajustar automáticamente</label><p class="studio-note">Aproximación según superficie y posición. Desactiva para afinar a mano.</p>' +
    range('studioTiltX', 'Inclinación vertical', -75, 75) + range('studioTiltY', 'Inclinación lateral', -75, 75) +
    range('studioSkewX', 'Deformación horizontal', -45, 45) + range('studioSkewY', 'Deformación vertical', -45, 45) +
    range('studioScaleX', 'Estirar ancho', .25, 2.5, .05) + range('studioScaleY', 'Estirar alto', .25, 2.5, .05) +
    '<div class="studio-buttons">' + buttons([['flipX', 'Voltear ↔'], ['flipY', 'Voltear ↕'], ['resetTransform', 'Restablecer']]) + '</div>') +
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
    panel('studioBounce', 'Luz de la pantalla · avanzado', range('studioRim', 'Carcasa', 0, 200) + range('studioCabinet', 'Mueble', 0, 200) + range('studioFloor', 'Suelo', 0, 200) + range('studioReach', 'Alcance', 30, 180) + range('studioTransition', 'Transición (ms)', 150, 2000, 50) + '<label>Prueba de iluminación<select id="studioTest"><option value="live">Vídeo actual</option><option value="red">Rojo</option><option value="blue">Azul</option><option value="white">Blanco</option><option value="dark">Pantalla apagada</option></select></label><p class="studio-note">La prueba cambia solo la luz de esta vista previa.</p>') +
    panel('studioNeon', 'Colores de neón', '<label>Color izquierdo<input id="studioAccent" type="color"/></label><label>Color derecho<input id="studioAccent2" type="color"/></label><p class="studio-note">Activa el ambiente Neón para ver estos colores.</p>') +
    panel('studioRooms', 'Mis ambientes y versiones', '<label>Nombre<input id="studioRoomName" maxlength="70" placeholder="Mi noche favorita"/></label><div class="studio-buttons">' + buttons([['saveRoom', 'Guardar ambiente'], ['loadRoom', 'Aplicar'], ['deleteRoom', 'Eliminar']]) + '</div><select id="studioProfile" aria-label="Ambientes guardados"></select><label>Versiones anteriores<select id="studioVersion"></select></label><div class="studio-buttons">' + buttons([['loadVersion', 'Restaurar versión']]) + '</div><p class="studio-note">Guarda para todos para conservar tus ambientes y las tres versiones anteriores.</p>'));
  // Remove obsolete section headings after relocating their controls.
  props.querySelectorAll('strong').forEach(node => node.remove());
  document.querySelector('.editor-tools')!.insertAdjacentHTML('beforeend', '<button id="studioCompare" type="button" aria-pressed="false">Antes / después</button><button id="studioImmersive" type="button" aria-pressed="false">Solo escena</button>');
  for (const id of ['Objects', 'Lights', 'Mood']) {
    const tab = $(`studio${id}Tab`);
    tab.addEventListener('click', () => {
      for (const other of ['Objects', 'Lights', 'Mood']) { $(`studio${other}`).hidden = other !== id; $(`studio${other}Tab`).setAttribute('aria-selected', String(other === id)); }
      sidebar.classList.remove('is-collapsed'); $('studioCollapse').setAttribute('aria-expanded', 'true'); h.resize();
    });
    tab.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault(); const tabs = ['Objects', 'Lights', 'Mood'];
      const next = $(`studio${tabs[(tabs.indexOf(id) + (event.key === 'ArrowRight' ? 1 : 2)) % 3]}Tab`); next.click(); next.focus();
    });
  }
  $('studioCollapse').addEventListener('click', () => { sidebar.classList.toggle('is-collapsed'); $('studioCollapse').setAttribute('aria-expanded', String(!sidebar.classList.contains('is-collapsed'))); h.resize(); });
  $('studioImmersive').addEventListener('click', () => { const body = document.querySelector('.editor-body')!; body.classList.toggle('studio-immersive'); $('studioImmersive').setAttribute('aria-pressed', String(body.classList.contains('studio-immersive'))); h.resize(); });
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
  const transformFields = { TiltX: 'tiltX', TiltY: 'tiltY', SkewX: 'skewX', SkewY: 'skewY', ScaleX: 'scaleX', ScaleY: 'scaleY' } as const;
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
  if (cmd.startsWith('flip')) { ps.filter(p => !p.locked).forEach(p => { const t = p.transform ??= {}, key = cmd as 'flipX' | 'flipY'; t[key] = !t[key]; }); }
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
  const angles = perspectiveAngles(t, p?.x);
  field('studioSurface', t.surface ?? 'free'); field('studioAuto', t.auto ?? false);
  field('studioTiltX', Math.round(angles.x)); field('studioTiltY', Math.round(angles.y));
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
