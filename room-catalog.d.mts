export type RoomId = 'cozy-night' | 'midnight-den' | 'walnut-den' | 'violet-den';
export const rooms: { id: RoomId; name: string; description: string }[];
export const props: { id: string; name: string; category: 'furniture'; support?: { corners: number[][]; material: 'wood' | 'matte' | 'glass' } }[];
export const roomIds: Set<string>;
export const legacyRoomIds: Set<string>;
export const propIds: Set<string>;
export function builtinUrl(id: string): string;
export function visibleInRoom(item?: unknown, presentation?: unknown): boolean;
