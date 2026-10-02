import type { Manifest, RoomSnapshot, PlacementKey } from './src/decorations';
import type { Presentation } from './src/presentation-model';
import type { RoomId } from './room-catalog.mjs';
export const homeKeys: PlacementKey[];
export function defaultRealPresentation(key: string, environment?: RoomId): Presentation;
export function prepareRealRoom(room: RoomSnapshot, id: RoomId, viewKey?: PlacementKey): boolean;
export function cleanupBuiltinDecorations(manifest: Manifest): Manifest;
export function rebuildRealRooms(manifest: Manifest): Manifest;
