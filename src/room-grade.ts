import { getPresentation } from './scene-presentation';
import { paintTv } from './tv-paint';
import { gradeFilter, type Mood, type Zone } from './studio-model';
type Rect = { x: number; y: number; width: number; height: number };
const textures = new Map<string, HTMLImageElement>();
let cached: { key: string; canvas: HTMLCanvasElement } | undefined;

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
  const backdrop = document.querySelector<HTMLImageElement>('#roomBackdrop img'), back = backdrop?.getBoundingClientRect();
  const detached = document.querySelector('#stage')?.classList.contains('free-room');
  const bx = back ? (back.x - scene.x) * scale : x, by = back ? (back.y - scene.y) * scale : y, bw = back ? back.width * scale : w, bh = back ? back.height * scale : h;
  const modular = Boolean(getPresentation()?.environment);
  const cabinet = Math.round(modular ? by + bh * .65 : detached ? by + bh * (innerHeight > innerWidth ? .47 : .9) : y + h * (value('tv-feet-y') + value('tv-feet-h')));
  const floor = modular ? cabinet : Math.round(detached ? by + bh * (innerHeight > innerWidth ? .62 : 1) : cabinet + (ctx.canvas.height - cabinet) * (innerHeight > innerWidth ? .48 : .75));
  const power = mood.intensity / 100;
  const free = document.querySelector('#stage')?.classList.contains('free-room');
  const key = JSON.stringify([url, getPresentation()?.tvPaint, getPresentation()?.screen?.rounded, backdrop?.src, backdrop?.style.objectPosition, bx, by, bw, bh, backdrop?.complete, x, y, w, h, tv, cabinet, floor, glass, mood, free, ctx.canvas.width, ctx.canvas.height]);
  if (cached?.key === key) { ctx.drawImage(cached.canvas, 0, 0); return; }
  const target = ctx, buffer = document.createElement('canvas'); buffer.width = ctx.canvas.width; buffer.height = ctx.canvas.height;
  const bufferContext = buffer.getContext('2d'); if (!bufferContext) return; ctx = bufferContext;
  const texture = document.createElement('canvas'); texture.width = buffer.width; texture.height = buffer.height;
  const textureCtx = texture.getContext('2d'); if (!textureCtx) return;
  for (const zone of ['wall', 'cabinet', 'floor', 'tv'] as Zone[]) {
    const backgroundImage = free && zone !== 'tv' ? backdrop : image;
    if (!backgroundImage?.complete || !backgroundImage.naturalWidth) continue;
    const grade = { ...mood.grade, ...mood.zones?.[zone] };
    const influence = (grade.influence ?? (zone === 'tv' ? 30 : 100)) / 100;
    if (influence === 0) continue;
    const photo = free && zone !== 'tv' ? { x: bx, y: by, width: bw, height: bh } : face.dataset.tvModel && face.dataset.tvModel !== 'original' ? { x: x + w * value('photo-x'), y: y + h * value('photo-y'), width: w * value('photo-w'), height: h * value('photo-h') } : { x, y, width: w, height: h };
    const cover = free && zone !== 'tv' && getComputedStyle(backgroundImage).objectFit === 'cover';
    const ratio = cover ? Math.max(photo.width / backgroundImage.naturalWidth, photo.height / backgroundImage.naturalHeight) : 1;
    const sw = cover ? photo.width / ratio : backgroundImage.naturalWidth, sh = cover ? photo.height / ratio : backgroundImage.naturalHeight;
    const sx = cover && backgroundImage.style.objectPosition === 'left center' ? 0 : (backgroundImage.naturalWidth - sw) / 2;
    const drawTexture = () => textureCtx.drawImage(backgroundImage, sx, (backgroundImage.naturalHeight - sh) / 2, sw, sh, photo.x, photo.y, photo.width, photo.height);
    // Color the full texture before cutting its silhouette. Multiply fills on
    // antialiased clip edges used to turn the TV contour and zone seams white.
    textureCtx.clearRect(0, 0, texture.width, texture.height);
    textureCtx.filter = gradeFilter(mood, zone);
    drawTexture(); textureCtx.filter = 'none';
    textureCtx.globalCompositeOperation = 'multiply';
    const cool = ['blue-night', 'classic-night', 'moonlight', 'soft-night'].includes(mood.preset);
    const temperature = (grade.temperature ?? (mood.preset === 'warm' ? 28 : cool ? -18 * power : 0)) / 100;
    if (temperature !== 0) {
      textureCtx.fillStyle = temperature >= 0 ? `rgb(255,${255 - Math.round(temperature * 65)},${255 - Math.round(temperature * 120)})` :
        `rgb(${255 + Math.round(temperature * 110)},${255 + Math.round(temperature * 45)},255)`;
      textureCtx.fillRect(0, 0, texture.width, texture.height);
    }
    const depth = (grade.shadows ?? (cool ? 12 * power : 0)) / 100;
    if (depth > 0) {
      const gradient = textureCtx.createLinearGradient(0, 0, 0, texture.height);
      gradient.addColorStop(0, `rgba(0,0,0,${depth})`); gradient.addColorStop(.6, 'rgba(0,0,0,0)'); gradient.addColorStop(1, `rgba(0,0,0,${depth * .6})`);
      textureCtx.fillStyle = gradient; textureCtx.fillRect(0, 0, texture.width, texture.height);
    }
    // Restore the source alpha, including transparent custom backgrounds.
    textureCtx.globalCompositeOperation = 'destination-in';
    drawTexture();
    textureCtx.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.beginPath();
    if (zone === 'tv') ctx.roundRect(tv.x, tv.y, tv.width, tv.height, Math.min(tv.width, tv.height) * .012);
    else if (zone === 'cabinet') ctx.rect(0, cabinet, ctx.canvas.width, Math.max(0, floor - cabinet));
    else if (zone === 'floor') ctx.rect(0, floor, ctx.canvas.width, Math.max(0, ctx.canvas.height - floor));
    else ctx.rect(0, 0, ctx.canvas.width, Math.max(0, cabinet));
    ctx.clip();
    ctx.beginPath();
    ctx.rect(photo.x, photo.y, photo.width, photo.height);
    ctx.clip();
    if (zone !== 'tv') { ctx.beginPath(); ctx.rect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.roundRect(tv.x, tv.y, tv.width, tv.height, Math.min(tv.width, tv.height) * .012); ctx.clip('evenodd'); }
    ctx.globalAlpha = influence;
    ctx.drawImage(texture, 0, 0); ctx.restore();
  }
  const aperture = { x: x + w * value('glass-x'), y: y + h * value('glass-y'), width: w * value('glass-w'), height: h * value('glass-h') };
  paintTv(ctx, image, face.dataset.tvModel && face.dataset.tvModel !== 'original' ? { x: x + w * value('photo-x'), y: y + h * value('photo-y'), width: w * value('photo-w'), height: h * value('photo-h') } : { x, y, width: w, height: h }, tv, aperture, getPresentation()?.tvPaint);
  ctx.save(); ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath(); ctx.roundRect(glass.x, glass.y, glass.width, glass.height, getPresentation()?.screen?.rounded === false ? 0 : Math.min(glass.width * .025, glass.height * .04));
  ctx.fillStyle = '#000'; ctx.fill(); ctx.restore();
  cached = { key, canvas: buffer }; target.drawImage(buffer, 0, 0);
}
