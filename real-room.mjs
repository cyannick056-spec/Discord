import { roomIds, props } from './room-catalog.mjs';
import { MAX_SCENE_ITEMS } from './material-catalog.mjs';
export const homeKeys = ['home-landscape-16x9', 'home-landscape-4x3', 'home-portrait-16x9', 'home-portrait-4x3', 'home-window-16x9', 'home-window-4x3'];
export function realRoomPlacement(asset, portrait) {
  const main = asset === 'cabinet';
  return { x: main ? 57 : portrait ? 16 : 13, y: main ? portrait ? 68 : 76 : portrait ? 77 : 81, width: main ? portrait ? 82 : 67 : portrait ? 28 : 22,
    z: main ? 3 : 4, rotation: 0, opacity: 1, hidden: false, anchor: 'scene', behindTv: true, brightness: 100, saturation: 100, shadow: 35 };
}
export function defaultRealPresentation(key, environment = 'morning') {
  return { environment, style: 'classic', camera: { zoom: 1 }, tv: { zoom: key.includes('portrait') ? .76 : .50 }, tvModel: 'flat-modern', tvSupport: 'cabinet', video: { fit: 'contain' }, rain: { enabled: false, intensity: 55, speed: 1 } };
}
export function prepareRealRoom(room, id) {
  if (!roomIds.has(id)) return false;
  const missing = ['cabinet','side-table'].filter(asset => !room.items.some(i => roomIds.has(i.roomKit) && i.asset === asset));
  if (room.items.filter(i => i.kind !== 'viewer-slot').length + missing.length > MAX_SCENE_ITEMS) return false;
  for (const asset of missing) {
    const info = props.find(p => p.id === asset);
    room.items.push({ id: crypto.randomUUID(), kind: 'builtin', roomKit: 'morning', asset, name: info.name, category: info.category,
      placements: Object.fromEntries(homeKeys.map(key => [key, realRoomPlacement(asset, key.includes('portrait'))])) });
  }
  for (const key of homeKeys) {
    const old = (room.presentations ??= {})[key];
    const p = roomIds.has(old?.environment) ? old : defaultRealPresentation(key, id);
    p.environment = id; delete p.background; room.presentations[key] = p;
  }
  room.ambient = 100;
  room.mood = { daytime: id, preset: 'neutral', intensity: 0, tvGlow: room.mood?.tvGlow ?? 100,
    rim: room.mood?.rim ?? 80, cabinet: room.mood?.cabinet ?? 100, floor: room.mood?.floor ?? 100, zones: { tv: { influence: 0 } } };
  return true;
}
// One-time replacement. Personal uploads and their edits stay available in
// Objects, initially hidden so an old collection does not populate a new room.
export function rebuildRealRooms(manifest) {
  const rebuild = room => {
    room.items = room.items.filter(i => !i.roomKit || roomIds.has(i.roomKit));
    for (const item of room.items) for (const [key,p] of Object.entries(item.placements)) if (key.startsWith('home-') && !item.roomKit) p.hidden = true;
    for (const key of homeKeys) (room.presentations ??= {})[key] = defaultRealPresentation(key, 'morning');
    if (prepareRealRoom(room,'morning') === false) {
      // A full personal scene still loads; never discard an upload to make
      // space for starter furniture. The user can free slots in Objects.
      room.ambient=100;room.mood={daytime:'morning',preset:'neutral',intensity:0,tvGlow:100};
      for(const key of homeKeys) room.presentations[key].tvSupport='free';
    }
  };
  rebuild(manifest);
  for (const entries of [manifest.profiles,manifest.versions]) for (const entry of entries ?? []) rebuild(entry.room);
  for (const item of manifest.library ?? []) delete item.roomKit;
  return manifest;
}
