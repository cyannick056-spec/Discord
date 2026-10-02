import { cornerMatrix } from './perspective.ts';
export type Surface = 'free' | 'wall' | 'cabinet' | 'floor' | 'ceiling' | 'left-wall' | 'right-wall' | 'shelf';
export type Transform = { surface?: Surface; auto?: boolean; tiltX?: number; tiltY?: number; skewX?: number; skewY?: number; scaleX?: number; scaleY?: number; flipX?: boolean; flipY?: boolean; depth?: number; corners?: number[][] };
export type ContactShadow = { opacity: number; blur: number; width: number; x: number; y: number };
export type Grade = { exposure?: number; contrast?: number; saturation?: number; temperature?: number; shadows?: number; influence?: number };
export type Zone = 'wall' | 'cabinet' | 'floor' | 'tv' | 'figures';
export type Daytime = 'morning' | 'day' | 'evening' | 'night';
export type Mood = { daytime?: Daytime; preset: 'neutral' | 'blue-night' | 'warm' | 'classic-night' | 'tv-only' | 'moonlight' | 'soft-night' | 'neon'; intensity: number; tvGlow: number;
  grade?: Grade; zones?: Partial<Record<Zone, Grade>>; rim?: number; cabinet?: number; floor?: number; reach?: number; transition?: number; accent?: string; accent2?: string;
  backlight?: { color: string; intensity: number; reach: number }; depth?: number; practicalLights?: boolean; tvDetail?:number; tvSoftness?:number };
export function perspectiveAngles(t: Transform = {}, x = 50) {
  if (!t.auto) return { x: t.tiltX ?? 0, y: t.tiltY ?? 0 };
  const side = Math.max(-1, Math.min(1, (x - 50) / 50));
  return { x: t.surface === 'floor' ? 55 : t.surface === 'ceiling' ? -55 : t.surface === 'cabinet' ? 12 : t.surface === 'shelf' ? 20 : 0,
    y: t.surface === 'left-wall' ? 45 : t.surface === 'right-wall' ? -45 : t.surface === 'wall' ? side * -12 : t.surface === 'cabinet' ? side * -6 : 0 };
}
export function objectTransform(rotation: number, t: Transform = {}, x = 50, width = 100, height = 100) {
  const angles = perspectiveAngles(t, x);
  return `translate(-50%, -50%) rotate(${rotation}deg) perspective(${t.depth ?? 800}px) rotateX(${angles.x}deg) rotateY(${angles.y}deg) skew(${t.skewX ?? 0}deg,${t.skewY ?? 0}deg) scale(${(t.scaleX ?? 1) * (t.flipX ? -1 : 1)},${(t.scaleY ?? 1) * (t.flipY ? -1 : 1)}) ${t.corners ? cornerMatrix(t.corners, width, height) : ''}`.trim();
}
export function gradeFilter(mood: Mood | undefined, zone: Zone,response=100) {
  const g = { ...mood?.grade, ...mood?.zones?.[zone] };
  const power = (mood?.intensity ?? 65) / 100;
  const night = ['blue-night', 'classic-night', 'tv-only', 'moonlight', 'soft-night'].includes(mood?.preset ?? '');
  const amount=Math.max(0,Math.min(100,response))/100;
  const influence = (g.influence ?? (zone === 'tv' ? 30 : 100)) / 100*amount;
  const brightness = Math.pow(2, (g.exposure ?? 0) / 100*amount) * (1 - (night ? .22 : 0) * power * influence);
  const contrast = (1+((g.contrast ?? 100)/100-1)*amount) * (1 + (night ? .1 : 0) * power * influence);
  const saturation = (1+((g.saturation ?? 100)/100-1)*amount) * (1 - (night ? .15 : 0) * power * influence);
  const temperature = (g.temperature ?? 0) / 100*amount;
  return `brightness(${brightness}) contrast(${contrast}) saturate(${saturation}) sepia(${Math.abs(temperature) * .12}) hue-rotate(${-temperature * 12}deg)`;
}
