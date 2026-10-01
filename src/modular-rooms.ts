import { props, type RoomId } from '../room-catalog.mjs';
import type { Manifest, Decoration, Placement } from './decorations';
import { prepareRealRoom } from '../real-room.mjs';
export { homeKeys } from '../real-room.mjs';
export function prepareRoom(manifest: Manifest, id: RoomId) { return prepareRealRoom(manifest, id); }
export function roomPlacement(prop: string, portrait = false): Placement {
  const coords: Record<string, number[]> = portrait ? {
    cabinet: [50, 51, 90, 3], rug: [50, 79, 95, 0], sofa: [78, 62, 36, 2], bed: [82, 65, 34, 2], shelf: [82, 57, 30, 2],
    console: [31, 45, 16, 14], controller: [50, 44.5, 10, 15], games: [69, 44.5, 12, 14], poster: [85, 16, 18, 1], lamp: [15, 42, 12, 12],
  } : {
    cabinet: [50, 78, 60, 3], rug: [50, 92, 68, 0], sofa: [84, 76, 28, 2], bed: [85, 78, 26, 2], shelf: [85, 73, 22, 2],
    console: [33, 63.5, 10, 14], controller: [50, 63.5, 7, 15], games: [67, 63.5, 8, 14], poster: [84, 24, 11, 1], lamp: [17, 63, 8, 12],
  };
  Object.assign(coords, portrait ? { 'floor-lamp': [10, 53, 38, 12], 'mushroom-lamp': [15, 42, 14, 12], 'desk-lamp': [15, 41, 14, 12], 'lava-lamp': [15, 41, 10, 12] } : { 'floor-lamp': [9, 61, 20, 12], 'mushroom-lamp': [17, 62, 10, 12], 'desk-lamp': [17, 62, 10, 12], 'lava-lamp': [17, 60, 7, 12] });
  for (const id of ['cabinet-black', 'gaming-desk', 'tv-cart', 'floating-shelf', 'tv-riser']) coords[id] = [...coords.cabinet];
  coords['tv-cart'][2] = portrait ? 72 : 46; coords['tv-riser'][2] = portrait ? 65 : 42;
  coords['floating-shelf'][1] = portrait ? 48 : 71;
  Object.assign(coords, portrait ? {
    'handheld-purple': [40,44,9,14], 'console-cube': [30,44,14,14], 'arcade-stick': [50,44,20,14], headphones: [72,42,12,14], 'keyboard-retro': [50,47,28,14],
    'plant-small': [84,42,17,14], succulent: [73,44,10,14], 'figure-knight': [37,43,8,14], 'figure-dragon': [61,43,10,14], 'wall-clock': [77,20,18,1], beanbag: [83,66,35,2], 'side-table': [76,59,40,3],
  } : {
    'handheld-purple': [40,62,6,14], 'console-cube': [30,62,9,14], 'arcade-stick': [50,64,13,14], headphones: [72,59,8,14], 'keyboard-retro': [50,66,19,14],
    'plant-small': [78,59,11,14], succulent: [69,63,6,14], 'figure-knight': [37,61,5,14], 'figure-dragon': [61,61,6,14], 'wall-clock': [77,25,11,1], beanbag: [84,79,24,2], 'side-table': [79,77,26,3],
  });
  const [x, y, width, z] = coords[prop] ?? [50, 50, 15, 10];
  return { x, y, width, z, rotation: 0, opacity: 1, hidden: false, anchor: 'scene', behindTv: Boolean(props.find(p => p.id === prop)?.support) || ['rug', 'cabinet', 'sofa', 'bed', 'shelf', 'poster'].includes(prop),
    brightness: 100, saturation: 100, shadow: 25,
    ...((props.find(p => p.id === prop)?.category === 'lamp') ? { light: { color: prop === 'lava-lamp' ? '#ff6aa3' : '#ffca90', intensity: 55, radius: 5, x: 50, y: 24 }, ...(prop === 'lava-lamp' ? { lava: { motion: true, speed: 1 } } : {}) } : {}) };
}
export function builtinDecoration(prop: string): Decoration {
  const info = props.find(p => p.id === prop)!;
  return { id: crypto.randomUUID(), kind: 'builtin', asset: prop, name: info.name, category: info.category, placements: {} };
}
