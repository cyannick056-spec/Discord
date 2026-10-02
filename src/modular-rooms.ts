import { props, type RoomId } from '../room-catalog.mjs';
import type { Manifest, Decoration, Placement, PlacementKey } from './decorations';
import { prepareRealRoom } from '../real-room.mjs';
export { homeKeys } from '../real-room.mjs';

export function prepareRoom(manifest: Manifest, id: RoomId, key?: PlacementKey) {
  return prepareRealRoom(manifest, id, key);
}

// Posiciones iniciales únicamente para los muebles integrados que siguen disponibles.
export function roomPlacement(prop: string, portrait = false): Placement {
  const wide: Record<string, number[]> = {
    cabinet: [50,78,60,3], 'cabinet-black': [50,78,60,3], 'gaming-desk': [50,78,60,3],
    'tv-cart': [50,78,46,3], 'floating-shelf': [50,71,60,3], 'tv-riser': [50,78,42,3],
    sofa: [84,76,28,2], bed: [85,78,26,2], shelf: [85,73,22,2], rug: [50,92,68,0],
    beanbag: [84,79,24,2], 'side-table': [79,77,26,3],
  };
  const tall: Record<string, number[]> = {
    cabinet: [50,51,90,3], 'cabinet-black': [50,51,90,3], 'gaming-desk': [50,51,90,3],
    'tv-cart': [50,51,72,3], 'floating-shelf': [50,48,90,3], 'tv-riser': [50,51,65,3],
    sofa: [78,62,36,2], bed: [82,65,34,2], shelf: [82,57,30,2], rug: [50,79,95,0],
    beanbag: [83,66,35,2], 'side-table': [76,59,40,3],
  };
  const [x, y, width, z] = (portrait ? tall : wide)[prop] ?? [50, 70, 40, 3];
  return { x, y, width, z, rotation: 0, opacity: 1, hidden: false, anchor: 'scene', behindTv: true, brightness: 100, saturation: 100, shadow: 25 };
}

export function builtinDecoration(prop: string): Decoration {
  const info = props.find(p => p.id === prop)!;
  return { id: crypto.randomUUID(), kind: 'builtin', asset: prop, name: info.name, category: 'furniture', placements: {} };
}
