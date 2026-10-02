export type RoomId = 'cozy-night' | 'midnight-den' | 'walnut-den' | 'violet-den' | 'rain-window' | 'rainy-balcony' | 'alley-trash' | 'blue-room' | 'rose-room' | 'industrial-loft' | 'forest-open' | 'morning-room';
export const rooms: { id: RoomId; name: string; description: string; floorLine?: number; rainReady?: boolean; rainDefault?: boolean }[];
export const props: { id: string; name: string; category: string; support?: { corners: number[][]; material: 'wood' | 'matte' | 'glass' } }[];
export const roomIds: Set<string>;
export const legacyRoomIds: Set<string>;
export const propIds: Set<string>;
export function builtinUrl(id: string): string;
export function visibleInRoom(item?: unknown, presentation?: unknown): boolean;
