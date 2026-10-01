import { paintReflections, reflectionPlanes } from './reflections';
import { paintRoomGrade } from './room-grade';
import { type Mood } from './studio-model';
import { getPresentation } from './scene-presentation';
import { videoCrop } from './presentation-model';
import { frameColor, blendColor, type LightColor } from './light-color';
import { supportPlane } from './support-surfaces';

export type DecorationLight = { id: string; color: string; intensity: number; radius: number; x?: number; y?: number; shape?: 'point' | 'spot' | 'strip'; angle?: number; softness?: number; kelvin?: number };
let sources: DecorationLight[] = [];
let ambient = 62;
export type RoomMood = Mood;
let testLight = 'live';
export function setTestLight(value: string) { testLight = value; }
let mood: RoomMood = { preset: 'neutral', intensity: 65, tvGlow: 100 };
export function setDecorationLights(lights: DecorationLight[]) { sources = lights; }
export function setRoomAmbient(value: number) { ambient = Math.min(100, Math.max(25, value)); }
export function setRoomMood(value?: RoomMood) { mood = value ?? { preset: 'neutral', intensity: 65, tvGlow: 100 }; }

export function initRoomLighting() {
  const stage = document.querySelector<HTMLElement>('#stage')!;
  const scene = document.querySelector<HTMLElement>('.room-scene')!;
  const shade = document.querySelector<HTMLCanvasElement>('#roomShade')!;
  const tint = document.querySelector<HTMLCanvasElement>('#roomTint')!;
  const shadowCtx = shade.getContext('2d');
  const tintCtx = tint.getContext('2d');
  const grade = document.querySelector<HTMLCanvasElement>('#roomGrade')!;
  const gradeCtx = grade.getContext('2d');
  const reflection = document.querySelector<HTMLCanvasElement>('#roomReflection')!, reflectionCtx = reflection.getContext('2d');
  const floorReflection = document.createElement('canvas'); floorReflection.id = 'roomFloorReflection';
  reflection.parentElement!.append(floorReflection); const floorReflectionCtx = floorReflection.getContext('2d');
  const sample = document.createElement('canvas');
  sample.width = 64; sample.height = 36;
  const testSample = document.createElement('canvas'); testSample.width = 64; testSample.height = 36;
  const testSampleCtx = testSample.getContext('2d');
  const sampleCtx = sample.getContext('2d', { willReadFrequently: true });
  if (!shadowCtx || !tintCtx || !sampleCtx) return;
  const dark: LightColor = { r: 0, g: 0, b: 0, strength: 0 };
  let screenColor = { ...dark }, floorColor = { ...dark };
  let lastScreenSample = { ...dark }, lastFloorSample = { ...dark };
  let sampledVideo: HTMLVideoElement | null = null;
  let lastTime = -1;
  let reflectionReady = false;
  let lastFraming = '';
  let blockedVideo: HTMLVideoElement | null = null;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const previewMode = new URLSearchParams(location.search).has('editorPreview');
  let previewColors: { screen: LightColor; floor: LightColor } | null = null;
  let tvBounds: { x: number; y: number; width: number; height: number } | undefined;
  if (previewMode) window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== parent || event.data?.type !== 'room-video-light') return;
    const valid = (color: LightColor) => color && [color.r, color.g, color.b].every(value => Number.isFinite(value) && value >= 0 && value <= 255) &&
      Number.isFinite(color.strength) && color.strength >= 0 && color.strength <= 1;
    if (valid(event.data.screen) && valid(event.data.floor)) previewColors = event.data;
  });

  function glow(x: number, y: number, rx: number, ry: number, color: LightColor, gain = 1, angle = 0, softness = 60, onTv = false) {
    if (!shadowCtx || !tintCtx || rx <= 0 || ry <= 0) return;
    const power = Math.min(2, color.strength * gain);
    if (power < .005) return;
    for (const [ctx, isTint] of [[shadowCtx, false], [tintCtx, true]] as const) {
      ctx.save();
      // Room light must not wash over the photographed plastic. Only the
      // separately controlled bezel light may illuminate the TV itself.
      if (tvBounds && !onTv) {
        ctx.beginPath(); ctx.rect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.roundRect(tvBounds.x, tvBounds.y, tvBounds.width, tvBounds.height, Math.min(tvBounds.width, tvBounds.height) * .012);
        ctx.clip('evenodd');
      }
      ctx.translate(x, y); ctx.rotate(angle * Math.PI / 180); ctx.scale(rx, ry);
      ctx.globalCompositeOperation = isTint ? 'source-over' : 'destination-out';
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      const rgb = `${Math.round(color.r)},${Math.round(color.g)},${Math.round(color.b)}`;
      const alpha = Math.min(.95, power * (isTint ? .23 : .9));
      gradient.addColorStop(0, `rgba(${isTint ? rgb : '0,0,0'},${alpha})`);
      gradient.addColorStop(.15 + softness / 100 * .4, `rgba(${isTint ? rgb : '0,0,0'},${alpha * .6})`);
      gradient.addColorStop(1, `rgba(${isTint ? rgb : '0,0,0'},0)`);
      ctx.fillStyle = gradient; ctx.fillRect(-1, -1, 2, 2);
      ctx.restore();
    }
  }

  function draw() {
    if (!shadowCtx || !tintCtx || !sampleCtx || document.hidden) return;
    // Tiny Discord tiles have no room around the picture.
    if (innerWidth <= 520 && innerHeight <= 360) return;
    const bounds = scene.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const scale = Math.min(1, 960 / Math.max(bounds.width, bounds.height));
    const width = Math.round(bounds.width * scale), height = Math.round(bounds.height * scale);
    if (shade.width !== width || shade.height !== height) {
      shade.width = tint.width = grade.width = reflection.width = floorReflection.width = width; shade.height = tint.height = grade.height = reflection.height = floorReflection.height = height;
    }
    reflectionCtx?.clearRect(0, 0, width, height);
    floorReflectionCtx?.clearRect(0, 0, width, height);
    shadowCtx.clearRect(0, 0, width, height);
    tintCtx.clearRect(0, 0, width, height);
    gradeCtx?.clearRect(0, 0, width, height);
    shadowCtx.fillStyle = `rgba(0,0,0,${1 - ambient / 100})`;
    shadowCtx.fillRect(0, 0, width, height);
    const screen = document.querySelector<HTMLElement>(stage.classList.contains('arcade-mode') ? '#arcadeScreen' : '#homeScreenMount')!;
    const glass = screen.getBoundingClientRect();
    const gx = (glass.left - bounds.left) * scale, gy = (glass.top - bounds.top) * scale;
    const gw = glass.width * scale, gh = glass.height * scale;
    tvBounds = undefined;
    if (stage.classList.contains('home-mode')) {
      const face = document.querySelector<HTMLElement>('.tv-face')!, art = face.getBoundingClientRect(), s = getComputedStyle(face);
      const n = (key: string) => parseFloat(s.getPropertyValue('--tv-body-' + key)) / 100;
      tvBounds = { x: (art.x - bounds.x + art.width * n('x')) * scale, y: (art.y - bounds.y + art.height * n('y')) * scale, width: art.width * n('w') * scale, height: art.height * n('h') * scale };
    }
    if (gradeCtx && stage.classList.contains('home-mode')) paintRoomGrade(gradeCtx, document.querySelector<HTMLElement>('.tv-face')!,
      { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }, { x: gx, y: gy, width: gw, height: gh }, mood, scale);
    const video = document.querySelector<HTMLVideoElement>('#videoMount video');
    let target = { ...dark }, floorTarget = { ...dark };
    if (video && video.readyState >= 2 && video.videoWidth && stage.classList.contains('has-signal')) {
      // A future cross-origin iframe cannot be sampled. Failing a read must
      // never stop the existing stream or repeatedly throw on every tick.
      const framing = JSON.stringify([getPresentation()?.video, glass.width / glass.height]);
      if (video !== blockedVideo && (video !== sampledVideo || video.currentTime !== lastTime || framing !== lastFraming)) {
        try {
          const crop = videoCrop(video.videoWidth, video.videoHeight, glass.width, glass.height, getPresentation()?.video, getComputedStyle(video).objectFit);
          sampleCtx.fillStyle = '#000'; sampleCtx.fillRect(0, 0, 64, 36);
          if (getPresentation()?.video?.fit === 'contain') {
            const fit = Math.min(glass.width / video.videoWidth, glass.height / video.videoHeight);
            const dw = video.videoWidth * fit / glass.width * 64, dh = video.videoHeight * fit / glass.height * 36;
            sampleCtx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight, (64 - dw) / 2, (36 - dh) / 2, dw, dh);
          } else sampleCtx.drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, 64, 36);
          const pixels = sampleCtx.getImageData(0, 0, 64, 36).data;
          lastScreenSample = target = frameColor(pixels, 64, 36);
          lastFloorSample = floorTarget = frameColor(pixels, 64, 36, 24, 36);
          reflectionReady = true; sampledVideo = video; lastTime = video.currentTime; lastFraming = framing;
        } catch { reflectionReady = false; blockedVideo = video; }
      } else if (video !== blockedVideo) { target = lastScreenSample; floorTarget = lastFloorSample; }
      if (video === blockedVideo) target = floorTarget = { r: 210, g: 220, b: 230, strength: .1 };
    } else if (!stage.classList.contains('has-signal')) {
      reflectionReady = false;
      // The no-signal phosphor emits only a very weak neutral glow.
      target = floorTarget = { r: 210, g: 220, b: 230, strength: .06 };
    }
    if (previewColors && (!video || video.readyState < 2)) { target = previewColors.screen; floorTarget = previewColors.floor; }
    let reflectionFrame = sample, mirrorReady = reflectionReady && Boolean(video && video.readyState >= 2 && stage.classList.contains('has-signal'));
    if (previewMode && testLight !== 'live') {
      const colors: Record<string, LightColor> = { red: { r: 255, g: 0, b: 0, strength: 1 }, blue: { r: 0, g: 80, b: 255, strength: 1 },
        white: { r: 255, g: 255, b: 255, strength: 1 }, dark: { ...dark } };
      if (colors[testLight]) { target = floorTarget = colors[testLight]; if (testSampleCtx) { testSampleCtx.fillStyle = `rgb(${target.r},${target.g},${target.b})`; testSampleCtx.fillRect(0, 0, 64, 36); } reflectionFrame = testSample; mirrorReady = testLight !== 'dark'; }
    }
    const easing = reducedMotion.matches ? .08 : 1 - Math.exp(-125 / (mood.transition ?? 380));
    screenColor = blendColor(screenColor, target, easing);
    floorColor = blendColor(floorColor, floorTarget, easing);
    if (!previewMode) document.querySelector<HTMLIFrameElement>('#editorPreview')?.contentWindow?.postMessage(
      { type: 'room-video-light', screen: screenColor, floor: floorColor }, location.origin);
    const tvGain = mood.tvGlow / 100;
    const paint = getPresentation()?.tvPaint;
    const finish = paint?.enabled ? paint.finish === 'gloss' ? 1.35 : paint.finish === 'satin' ? 1 : .7 : 1;
    const rimGain = tvGain * (mood.rim ?? 100) / 100 * finish;
    if (reflectionCtx && mirrorReady && stage.classList.contains('home-mode')) {
      const background = document.querySelector<HTMLElement>('#roomBackdrop')!.getBoundingClientRect();
      const surface = supportPlane(getPresentation());
      const table = surface ? { ...surface, x: (surface.x - bounds.x) * scale, y: (surface.y - bounds.y) * scale, width: surface.width * scale, height: surface.height * scale,
        quad: surface.quad?.map(([x, y]) => [(x - bounds.x) * scale, (y - bounds.y) * scale] as [number, number]) } : undefined;
      const surfaces = stage.classList.contains('modular-room') || table ? {
        table: table ?? { x: 0, y: 0, width: 0, height: 0 },
        floor: stage.classList.contains('modular-room') ? { x: (background.x - bounds.x) * scale, y: (background.y - bounds.y + background.height * .65) * scale, width: background.width * scale, height: background.height * .35 * scale } : reflectionPlanes({ x: (background.x - bounds.x) * scale, y: (background.y - bounds.y) * scale, width: background.width * scale, height: background.height * scale }, innerHeight > innerWidth).floor,
      } : undefined;
      paintReflections(reflectionCtx, reflectionFrame, { x: (background.x - bounds.x) * scale, y: (background.y - bounds.y) * scale, width: background.width * scale, height: background.height * scale },
        { x: gx, y: gy, width: gw, height: gh }, innerHeight > innerWidth, screenColor.strength * tvGain, { ...getPresentation()?.reflection, floor: 0 },
        tvBounds, surfaces);
      if (floorReflectionCtx) paintReflections(floorReflectionCtx, reflectionFrame, { x: (background.x - bounds.x) * scale, y: (background.y - bounds.y) * scale, width: background.width * scale, height: background.height * scale },
        { x: gx, y: gy, width: gw, height: gh }, innerHeight > innerWidth, screenColor.strength * tvGain, { ...getPresentation()?.reflection, table: 0 }, tvBounds, surfaces);
    }
    const reach = (mood.reach ?? 100) / 100;
    glow(gx + gw / 2, gy + gh / 2, gw * .88 * reach, gh * 1.05 * reach, screenColor, .7 * tvGain);
    // Narrow pools on the bezel make the screen's color visible on the TV
    // itself as well as the room. The live glass is cut out afterwards.
    glow(gx + gw / 2, gy, gw * .62, Math.max(gh * .12, 8), screenColor, rimGain, 0, 60, true);
    glow(gx, gy + gh / 2, Math.max(gw * .12, 8), gh * .66, screenColor, rimGain, 0, 60, true);
    glow(gx + gw, gy + gh / 2, Math.max(gw * .12, 8), gh * .66, screenColor, rimGain, 0, 60, true);
    glow(gx + gw / 2, gy + gh, gw * .64, Math.max(gh * .17, 8), floorColor, rimGain, 0, 60, true);
    // Project a wider pool below the glass: cabinet first, floor further away.
    glow(gx + gw / 2, gy + gh * 1.17, gw * .72, Math.max(gh * .42, height * .09), floorColor, tvGain * (mood.cabinet ?? 100) / 100);
    glow(gx + gw / 2, gy + gh + height * .29, gw * .95, height * .25, floorColor, .65 * tvGain * (mood.floor ?? 100) / 100);
    const power = mood.intensity / 100;
    if (['blue-night', 'classic-night', 'moonlight'].includes(mood.preset)) glow(width * .12, height * .25, width * .6, height * .7,
      { r: 100, g: 140, b: 210, strength: power * .09 });
    if (['warm', 'classic-night'].includes(mood.preset)) glow(width * .84, height * .5, width * .36, height * .45,
      { r: 255, g: 182, b: 95, strength: power * .1 });
    if (mood.preset === 'neon') {
      const accent = (hex: string) => ({ r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16), strength: power * .2 });
      glow(width * .06, height * .35, width * .35, height * .5, accent(mood.accent ?? '#b93cff'));
      glow(width * .95, height * .5, width * .35, height * .45, accent(mood.accent2 ?? '#1ec8e6'));
    }
    const boxes = new Map([...document.querySelectorAll<HTMLElement>('.decoration-box:not(.decor-depth-outline)')].map(el => [el.dataset.id, el]));
    for (const light of sources) {
      const box = boxes.get(light.id);
      if (!box) continue;
      // The projected origin follows flips, skew and perspective as well as rotation.
      const matrix = new DOMMatrix(getComputedStyle(box).transform);
      const point = new DOMPoint(((light.x ?? 50) / 100 - .5) * box.offsetWidth,
        ((light.y ?? 50) / 100 - .5) * box.offsetHeight).matrixTransform(matrix);
      const layer = document.querySelector<HTMLElement>('#decorationLayer')!.getBoundingClientRect();
      const x = (layer.left + parseFloat(box.style.left) + box.offsetWidth / 2 + point.x / point.w - bounds.left) * scale;
      const y = (layer.top + parseFloat(box.style.top) + box.offsetHeight / 2 + point.y / point.w - bounds.top) * scale;
      const color = { r: parseInt(light.color.slice(1, 3), 16), g: parseInt(light.color.slice(3, 5), 16),
        b: parseInt(light.color.slice(5, 7), 16), strength: light.intensity / 100 };
      const radius = Math.min(Math.max(width, height), box.offsetWidth * scale * light.radius);
      glow(x, y, radius, radius * (light.shape === 'strip' ? .16 : light.shape === 'spot' ? .4 : 1), color, 1, light.angle ?? 0, light.softness ?? 60);
    }
    // Preserve the live picture and its native CRT treatment exactly.
    for (const ctx of [shadowCtx, tintCtx, reflectionCtx, floorReflectionCtx].filter((c): c is CanvasRenderingContext2D => Boolean(c))) {
      ctx.save(); ctx.globalCompositeOperation = 'destination-out';
      const radius = getPresentation()?.screen?.rounded === false ? 0 : stage.classList.contains('arcade-mode') ? Math.min(gw, gh) * .01 : Math.min(gw * .025, gh * .04);
      ctx.beginPath(); ctx.roundRect(gx, gy, gw, gh, radius);
      ctx.fillStyle = '#000'; ctx.fill(); ctx.restore();
    }
  }
  draw();
  let refreshPending = false;
  window.addEventListener('shis-presentation-change', () => {
    if (refreshPending) return; refreshPending = true;
    requestAnimationFrame(() => { refreshPending = false; draw(); });
  });
  // Eight tiny frame samples per second. Nothing is uploaded or sent to SFU.
  const timer = setInterval(draw, 125);
  window.addEventListener('pagehide', () => clearInterval(timer), { once: true });
}
