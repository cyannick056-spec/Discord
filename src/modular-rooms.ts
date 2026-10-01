import { rooms, props, type RoomId } from '../room-catalog.mjs';
import type { Manifest, Decoration, Placement } from './decorations';
import type { Presentation } from './presentation-model';

export const homeKeys = ['home-landscape-16x9', 'home-landscape-4x3', 'home-portrait-16x9', 'home-portrait-4x3', 'home-window-16x9', 'home-window-4x3'] as const;
export function prepareRoom(manifest: Manifest, id: RoomId) {
  const room = rooms.find(r => r.id === id); if (!room) return;
  const kit = ['rug', 'cabinet', room.furniture, 'console', 'controller', 'games', 'poster', 'lamp'];
  const missing = kit.filter(prop => !manifest.items.some(i => i.kind === 'builtin' && i.roomKit === id && i.asset === prop));
  if (manifest.items.filter(i => i.kind === 'builtin').length + missing.length > 72) return false;
  for (const key of homeKeys) {
    const p: Presentation = (manifest.presentations ??= {})[key] ??= {};
    if (!p.environment) p.tv = { zoom: key.includes('portrait') ? .95 : .55, y: key.includes('portrait') ? key.endsWith('4x3') ? 1.8 : 2.8 : -8.5 };
    p.environment = id; p.style = 'classic'; delete p.background;
  }
  // Each kit owns its own objects. Returning to a room reuses edited placements.
  for (const prop of kit) {
    let item = manifest.items.find(i => i.kind === 'builtin' && i.roomKit === id && i.asset === prop);
    if (item) continue;
    const info = props.find(p => p.id === prop)!;
    item = { id: crypto.randomUUID(), kind: 'builtin', asset: prop, name: info.name, category: info.category, roomKit: id, placements: {} };
    for (const key of homeKeys) item.placements[key] = roomPlacement(prop, key.includes('portrait'));
    manifest.items.push(item);
  }
  return true;
}
export function roomPlacement(prop: string, portrait = false): Placement {
  const coords: Record<string, number[]> = portrait ? {
    cabinet: [50, 51, 90, 3], rug: [50, 79, 95, 0], sofa: [78, 62, 36, 2], bed: [82, 65, 34, 2], shelf: [82, 57, 30, 2],
    console: [31, 45, 16, 14], controller: [50, 44.5, 10, 15], games: [69, 44.5, 12, 14], poster: [85, 16, 18, 1], lamp: [15, 42, 12, 12],
  } : {
    cabinet: [50, 78, 60, 3], rug: [50, 92, 68, 0], sofa: [84, 76, 28, 2], bed: [85, 78, 26, 2], shelf: [85, 73, 22, 2],
    console: [33, 63.5, 10, 14], controller: [50, 63.5, 7, 15], games: [67, 63.5, 8, 14], poster: [84, 24, 11, 1], lamp: [17, 63, 8, 12],
  };
  const [x, y, width, z] = coords[prop] ?? [50, 50, 15, 10];
  return { x, y, width, z, rotation: 0, opacity: 1, hidden: false, anchor: 'scene', behindTv: ['rug', 'cabinet', 'sofa', 'bed', 'shelf', 'poster'].includes(prop),
    brightness: 100, saturation: 100, shadow: 25,
    ...(prop === 'lamp' ? { light: { color: '#ffca90', intensity: 55, radius: 5, x: 50, y: 24 } } : {}) };
}
export function builtinDecoration(prop: string): Decoration {
  const info = props.find(p => p.id === prop)!;
  return { id: crypto.randomUUID(), kind: 'builtin', asset: prop, name: info.name, category: info.category, placements: {} };
}
