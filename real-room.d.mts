import type { Manifest, RoomSnapshot, Placement, PlacementKey } from './src/decorations';
import type { Presentation } from './src/presentation-model';
import type { RoomId } from './room-catalog.mjs';
export const homeKeys: PlacementKey[];
export function realRoomPlacement(asset: string, portrait: boolean): Placement;
export function defaultRealPresentation(key: string, environment?: RoomId): Presentation;
export function prepareRealRoom(room: RoomSnapshot, id: RoomId): boolean;
export function rebuildRealRooms(manifest: Manifest): Manifest;
