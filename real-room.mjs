import { roomIds } from './room-catalog.mjs';

export const homeKeys = ['home-landscape-16x9', 'home-landscape-4x3', 'home-portrait-16x9', 'home-portrait-4x3', 'home-window-16x9', 'home-window-4x3'];

export function defaultRealPresentation(key, environment = 'cozy-night') {
  return {
    environment,
    style: 'classic',
    camera: { zoom: 1 },
    tv: { zoom: key.includes('portrait') ? .72 : .58 },
    tvModel: 'flat-modern',
    tvSupport: 'free',
    video: { fit: 'contain' },
    screen: { rounded: false },
    ambient: 100,
    mood: { daytime: 'night', preset: 'neutral', intensity: 0, tvGlow: 110, rim: 75, cabinet: 90, floor: 70, zones: { tv: { influence: 0 } } },
    reflection: { enabled: true, intensity: 60, table: 55, floor: 35, blur: 14, texture: 60 },
  };
}

// Cambiar de fondo modifica únicamente el entorno de la vista elegida.
// TV, muebles, figuritas, filtros, luces, cámara y vídeo permanecen intactos.
export function prepareRealRoom(room, id, viewKey) {
  if (!roomIds.has(id)) return false;
  const keys = viewKey ? [viewKey] : homeKeys;
  for (const key of keys) {
    const presentations = room.presentations ??= {};
    const current = presentations[key] ?? defaultRealPresentation(key, id);
    current.environment = id;
    if (!current.style || current.style === 'custom') current.style = 'classic';
    delete current.background;
    delete current.rain;
    presentations[key] = current;
  }
  return true;
}

// Elimina únicamente decoración integrada retirada. Nunca toca imágenes personales,
// figuras subidas por el usuario ni luces creadas manualmente por el usuario.
export function cleanupBuiltinDecorations(manifest) {
  const generatedLight = item => item?.kind === 'light' && item?.name === 'Luz lavanda detrás de la TV';
  const keep = item => !generatedLight(item) && (item?.kind !== 'builtin' || item?.category === 'furniture');
  const cleanRoom = room => {
    if (!room || !Array.isArray(room.items)) return;
    room.items = room.items.filter(keep);
    for (const item of room.items) if (item.kind === 'builtin' && item.category === 'furniture') delete item.roomKit;
  };
  cleanRoom(manifest);
  for (const entries of [manifest.profiles, manifest.versions]) for (const entry of entries ?? []) cleanRoom(entry.room);
  if (Array.isArray(manifest.library)) {
    manifest.library = manifest.library.filter(keep);
    for (const item of manifest.library) if (item.kind === 'builtin' && item.category === 'furniture') delete item.roomKit;
  }
  return manifest;
}

// Migración conservadora para instalaciones antiguas: mantiene el contenido del usuario,
// quita decoración integrada retirada y convierte fondos antiguos al fondo actual básico.
export function rebuildRealRooms(manifest) {
  cleanupBuiltinDecorations(manifest);
  const normalize = room => {
    if (!room) return;
    for (const key of homeKeys) {
      const presentations = room.presentations ??= {};
      const p = presentations[key] ??= defaultRealPresentation(key);
      if (p.style === 'custom' && p.background) continue;
      if (!roomIds.has(p.environment)) p.environment = 'cozy-night';
      p.style ??= 'classic';
      delete p.rain;
    }
  };
  normalize(manifest);
  for (const entries of [manifest.profiles, manifest.versions]) for (const entry of entries ?? []) normalize(entry.room);
  return manifest;
}
