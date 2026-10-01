export type RoomId = 'bedroom' | 'retro' | 'rain' | 'japanese' | 'cabin' | 'city';
export const rooms: { id: RoomId; name: string; description: string; furniture: string }[];
export const props: { id: string; name: string; category: string; bounds?: number[] }[];
export const roomIds: Set<string>;
export const propIds: Set<string>;
export function builtinUrl(id: string): string;
export function visibleInRoom(item: { roomKit?: string }, presentation?: { environment?: RoomId }): boolean;
