export type Surface = 'free' | 'wall' | 'cabinet' | 'floor';
export type Transform = { surface?: Surface; auto?: boolean; tiltX?: number; tiltY?: number; skewX?: number; skewY?: number; scaleX?: number; scaleY?: number; flipX?: boolean; flipY?: boolean };
export type ContactShadow = { opacity: number; blur: number; width: number; x: number; y: number };
export type Grade = { exposure?: number; contrast?: number; saturation?: number; temperature?: number; shadows?: number; influence?: number };
export type Zone = 'wall' | 'cabinet' | 'floor' | 'tv' | 'figures';
export type Mood = { preset: 'neutral' | 'blue-night' | 'warm' | 'classic-night' | 'tv-only' | 'moonlight' | 'soft-night' | 'neon'; intensity: number; tvGlow: number;
  grade?: Grade; zones?: Partial<Record<Zone, Grade>>; rim?: number; cabinet?: number; floor?: number; reach?: number; transition?: number; accent?: string; accent2?: string };
export function perspectiveAngles(t: Transform = {}, x = 50) {
  if (!t.auto) return { x: t.tiltX ?? 0, y: t.tiltY ?? 0 };
  const side = Math.max(-1, Math.min(1, (x - 50) / 50));
  return { x: t.surface === 'floor' ? 55 : t.surface === 'cabinet' ? 12 : 0,
    y: t.surface === 'wall' ? side * -12 : t.surface === 'cabinet' ? side * -6 : 0 };
}
export function objectTransform(rotation: number, t: Transform = {}, x = 50) {
  const angles = perspectiveAngles(t, x);
  return `translate(-50%, -50%) rotate(${rotation}deg) perspective(800px) rotateX(${angles.x}deg) rotateY(${angles.y}deg) skew(${t.skewX ?? 0}deg,${t.skewY ?? 0}deg) scale(${(t.scaleX ?? 1) * (t.flipX ? -1 : 1)},${(t.scaleY ?? 1) * (t.flipY ? -1 : 1)})`;
}
export function gradeFilter(mood: Mood | undefined, zone: Zone) {
  const g = { ...mood?.grade, ...mood?.zones?.[zone] };
  const power = (mood?.intensity ?? 65) / 100;
  const night = ['blue-night', 'classic-night', 'tv-only', 'moonlight', 'soft-night'].includes(mood?.preset ?? '');
  const influence = (g.influence ?? (zone === 'tv' ? 30 : 100)) / 100;
  const brightness = Math.pow(2, (g.exposure ?? 0) / 100) * (1 - (night ? .22 : 0) * power * influence);
  const contrast = (g.contrast ?? 100) / 100 * (1 + (night ? .1 : 0) * power * influence);
  const saturation = (g.saturation ?? 100) / 100 * (1 - (night ? .15 : 0) * power * influence);
  const temperature = (g.temperature ?? 0) / 100;
  return `brightness(${brightness}) contrast(${contrast}) saturate(${saturation}) sepia(${Math.abs(temperature) * .12}) hue-rotate(${-temperature * 12}deg)`;
}
