export type MaterialId = 'original' | 'oak' | 'walnut' | 'mahogany' | 'white' | 'black' | 'pink' | 'steel' | 'marble' | 'concrete';
export type FurnitureMaterial = { preset: MaterialId; scope?: 'top' | 'all'; strength?: number; scale?: number; roughness?: number; color?: string };
export const materials: { id: MaterialId; name: string; texture?: string; tint: string; finish: 'wood' | 'satin' | 'matte' | 'metal' | 'stone' }[];
export const materialIds: Set<string>;
export const MAX_SCENE_ITEMS: number;
export const MAX_LIBRARY_ITEMS: number;
