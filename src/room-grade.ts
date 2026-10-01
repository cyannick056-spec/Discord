import { gradeFilter, type Mood, type Zone } from './studio-model';
type Rect = { x: number; y: number; width: number; height: number };
const textures = new Map<string, HTMLImageElement>();

// Grade the photograph under the objects, preserving its black pixels. The
// video aperture is removed after compositing, just like the lighting layers.
export function paintRoomGrade(ctx: CanvasRenderingContext2D, face: HTMLElement, scene: Rect, glass: Rect, mood: Mood, scale: number) {
  const style = getComputedStyle(face);
  const url = /url\(["']?([^"')]+)["']?\)/.exec(style.getPropertyValue('--room-art'))?.[1];
  if (!url) return;
  let image = textures.get(url);
  if (!image) { image = new Image(); image.src = url; textures.set(url, image); }
  if (!image.complete || !image.naturalWidth) return;
  const art = face.getBoundingClientRect();
  const x = (art.x - scene.x) * scale, y = (art.y - scene.y) * scale, w = art.width * scale, h = art.height * scale;
  const value = (name: string) => parseFloat(style.getPropertyValue(`--${name}`)) / 100;
  const tv = { x: x + w * value('tv-body-x'), y: y + h * value('tv-body-y'), width: w * value('tv-body-w'), height: h * value('tv-body-h') };
  const cabinet = y + h * (value('tv-feet-y') + value('tv-feet-h'));
  const floor = cabinet + (ctx.canvas.height - cabinet) * (innerHeight > innerWidth ? .48 : .75);
  const power = mood.intensity / 100;
  for (const zone of ['wall', 'cabinet', 'floor', 'tv'] as Zone[]) {
    const grade = { ...mood.grade, ...mood.zones?.[zone] };
    const influence = (grade.influence ?? (zone === 'tv' ? 30 : 100)) / 100;
    ctx.save(); ctx.beginPath();
    if (zone === 'tv') ctx.roundRect(tv.x, tv.y, tv.width, tv.height, Math.min(tv.width, tv.height) * .012);
    else if (zone === 'cabinet') ctx.rect(0, cabinet, ctx.canvas.width, Math.max(0, floor - cabinet));
    else if (zone === 'floor') ctx.rect(0, floor, ctx.canvas.width, Math.max(0, ctx.canvas.height - floor));
    else { ctx.rect(0, 0, ctx.canvas.width, Math.max(0, cabinet)); ctx.rect(tv.x, tv.y, tv.width, tv.height); }
    ctx.clip('evenodd');
    ctx.globalAlpha = influence;
    ctx.filter = gradeFilter(mood, zone); ctx.drawImage(image, x, y, w, h); ctx.filter = 'none';
    ctx.globalCompositeOperation = 'multiply';
    const cool = ['blue-night', 'classic-night', 'moonlight', 'soft-night'].includes(mood.preset);
    const temperature = (grade.temperature ?? (mood.preset === 'warm' ? 28 : cool ? -18 * power : 0)) / 100;
    const rgb = temperature >= 0 ? `255,${255 - Math.round(temperature * 65)},${255 - Math.round(temperature * 120)}` :
      `${255 + Math.round(temperature * 110)},${255 + Math.round(temperature * 45)},255`;
    ctx.fillStyle = `rgb(${rgb})`; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    const depth = (grade.shadows ?? (cool ? 12 * power : 0)) / 100;
    const gradient = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
    gradient.addColorStop(0, `rgba(0,0,0,${depth})`); gradient.addColorStop(.6, 'rgba(0,0,0,0)'); gradient.addColorStop(1, `rgba(0,0,0,${depth * .6})`);
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore();
  }
  ctx.save(); ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath(); ctx.roundRect(glass.x, glass.y, glass.width, glass.height, Math.min(glass.width * .025, glass.height * .04));
  ctx.fillStyle = '#000'; ctx.fill(); ctx.restore();
}
