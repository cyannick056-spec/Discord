export type TvModel = 'original' | 'silver' | 'charcoal' | 'projection' | 'crt-silver2000' | 'crt-champagne' | 'crt-black2000' | 'lcd2005' | 'flat-modern';
export const tvModels: { id: TvModel; name: string; asset: string; ratio?: number; bounds?: number[]; glass?: number[]; floor?: boolean }[];
export const tvIds: Set<string>;
