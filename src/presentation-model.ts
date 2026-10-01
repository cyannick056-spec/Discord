import type { RoomId } from '../room-catalog.mjs';
export type Framing = { x?: number; y?: number; zoom?: number };
export type ScreenAdjustment = { x?: number; y?: number; width?: number; height?: number };
export type TvPaint = { enabled?: boolean; body?: string; bezel?: string; panel?: string; strength?: number; hue?: number; saturation?: number; exposure?: number; contrast?: number; finish?: 'matte' | 'satin' | 'gloss' };
export type Reflection = { enabled?: boolean; intensity?: number; table?: number; floor?: number; blur?: number; reach?: number; spread?: number; offset?: number; texture?: number };
export type Presentation = {
  environment?: RoomId; tvModel?: 'original' | 'silver' | 'charcoal';
  style?: 'original' | 'classic' | 'minimal' | 'wood' | 'brick' | 'custom'; background?: string;
  wall?: string; cabinet?: string; floor?: string; cabinetY?: number; cabinetHeight?: number; hideCabinet?: boolean;
  camera?: Framing; tv?: Framing; video?: Framing;
  screen?: ScreenAdjustment; tvPaint?: TvPaint; reflection?: Reflection;
};
export function screenRect(r: { x: number; y: number; width: number; height: number }, p?: ScreenAdjustment) {
  return { x: r.x + r.width * (p?.x ?? 0) / 100, y: r.y + r.height * (p?.y ?? 0) / 100,
    width: r.width * (p?.width ?? 100) / 100, height: r.height * (p?.height ?? 100) / 100 };
}
export function cameraRect(r: { x: number; y: number; width: number; height: number }, p?: Presentation) {
  const z = p?.camera?.zoom ?? 1;
  return { x: r.x + r.width * ((1 - z) / 2 + (p?.camera?.x ?? 0) / 100),
    y: r.y + r.height * ((1 - z) / 2 + (p?.camera?.y ?? 0) / 100), width: r.width * z, height: r.height * z };
}
// Source crop reflects object-fit:cover and the extra video framing. Sampling
// this crop makes the room light follow the part of the video actually shown.
export function videoCrop(vw: number, vh: number, sw: number, sh: number, framing?: Framing, fit = 'cover') {
  const z = framing?.zoom ?? 1.035;
  const base = (fit === 'contain' ? Math.min(sw / vw, sh / vh) : Math.max(sw / vw, sh / vh)) * z;
  const width = Math.min(vw, sw / base), height = Math.min(vh, sh / base);
  return { x: (vw - width) / 2 - (vw - width) * (framing?.x ?? 0) / 100,
    y: (vh - height) / 2 - (vh - height) * (framing?.y ?? 0) / 100, width, height };
}
