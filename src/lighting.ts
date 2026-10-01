import { frameColor, blendColor, type LightColor } from './light-color';

export type DecorationLight = { id: string; color: string; intensity: number; radius: number; x?: number; y?: number };
let sources: DecorationLight[] = [];
let ambient = 62;
export type RoomMood = { preset: 'neutral' | 'blue-night' | 'warm'; intensity: number; tvGlow: number };
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
  const sample = document.createElement('canvas');
  sample.width = 32; sample.height = 18;
  const sampleCtx = sample.getContext('2d', { willReadFrequently: true });
  if (!shadowCtx || !tintCtx || !sampleCtx) return;
  const dark: LightColor = { r: 0, g: 0, b: 0, strength: 0 };
  let screenColor = { ...dark }, floorColor = { ...dark };
  let lastScreenSample = { ...dark }, lastFloorSample = { ...dark };
  let sampledVideo: HTMLVideoElement | null = null;
  let lastTime = -1;
  let blockedVideo: HTMLVideoElement | null = null;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const previewMode = new URLSearchParams(location.search).has('editorPreview');
  let previewColors: { screen: LightColor; floor: LightColor } | null = null;
  if (previewMode) window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== parent || event.data?.type !== 'room-video-light') return;
    const valid = (color: LightColor) => color && [color.r, color.g, color.b].every(value => Number.isFinite(value) && value >= 0 && value <= 255) &&
      Number.isFinite(color.strength) && color.strength >= 0 && color.strength <= 1;
    if (valid(event.data.screen) && valid(event.data.floor)) previewColors = event.data;
  });

  function glow(x: number, y: number, rx: number, ry: number, color: LightColor, gain = 1) {
    if (!shadowCtx || !tintCtx || rx <= 0 || ry <= 0) return;
    const power = Math.min(2, color.strength * gain);
    if (power < .005) return;
    for (const [ctx, isTint] of [[shadowCtx, false], [tintCtx, true]] as const) {
      ctx.save();
      ctx.translate(x, y); ctx.scale(rx, ry);
      ctx.globalCompositeOperation = isTint ? 'source-over' : 'destination-out';
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      const rgb = `${Math.round(color.r)},${Math.round(color.g)},${Math.round(color.b)}`;
      const alpha = Math.min(.95, power * (isTint ? .23 : .9));
      gradient.addColorStop(0, `rgba(${isTint ? rgb : '0,0,0'},${alpha})`);
      gradient.addColorStop(.35, `rgba(${isTint ? rgb : '0,0,0'},${alpha * .6})`);
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
      shade.width = tint.width = width; shade.height = tint.height = height;
    }
    shadowCtx.clearRect(0, 0, width, height);
    tintCtx.clearRect(0, 0, width, height);
    const blueNight = mood.preset === 'blue-night';
    const colored = mood.preset !== 'neutral';
    const filterPower = colored ? mood.intensity / 100 : 0;
    shadowCtx.fillStyle = `rgba(${blueNight ? '2,7,20' : '0,0,0'},${Math.min(.9, 1 - ambient / 100 + (blueNight ? filterPower * .12 : 0))})`;
    shadowCtx.fillRect(0, 0, width, height);
    if (colored) {
      tintCtx.fillStyle = `rgba(${blueNight ? '32,73,175' : '164,89,35'},${filterPower * .32})`;
      tintCtx.fillRect(0, 0, width, height);
    }
    const screen = document.querySelector<HTMLElement>(stage.classList.contains('arcade-mode') ? '#arcadeScreen' : '#homeScreenMount')!;
    const glass = screen.getBoundingClientRect();
    const gx = (glass.left - bounds.left) * scale, gy = (glass.top - bounds.top) * scale;
    const gw = glass.width * scale, gh = glass.height * scale;
    const video = document.querySelector<HTMLVideoElement>('#videoMount video');
    let target = { ...dark }, floorTarget = { ...dark };
    if (video && video.readyState >= 2 && video.videoWidth && stage.classList.contains('has-signal')) {
      // A future cross-origin iframe cannot be sampled. Failing a read must
      // never stop the existing stream or repeatedly throw on every tick.
      if (video !== blockedVideo && (video !== sampledVideo || video.currentTime !== lastTime)) {
        try {
          sampleCtx.drawImage(video, 0, 0, 32, 18);
          const pixels = sampleCtx.getImageData(0, 0, 32, 18).data;
          lastScreenSample = target = frameColor(pixels, 32, 18);
          lastFloorSample = floorTarget = frameColor(pixels, 32, 18, 12, 18);
          sampledVideo = video; lastTime = video.currentTime;
        } catch { blockedVideo = video; }
      } else if (video !== blockedVideo) { target = lastScreenSample; floorTarget = lastFloorSample; }
      if (video === blockedVideo) target = floorTarget = { r: 210, g: 220, b: 230, strength: .1 };
    } else if (!stage.classList.contains('has-signal')) {
      // The no-signal phosphor emits only a very weak neutral glow.
      target = floorTarget = { r: 210, g: 220, b: 230, strength: .06 };
    }
    if (previewColors) { target = previewColors.screen; floorTarget = previewColors.floor; }
    const easing = reducedMotion.matches ? .08 : .28;
    screenColor = blendColor(screenColor, target, easing);
    floorColor = blendColor(floorColor, floorTarget, easing);
    if (!previewMode) document.querySelector<HTMLIFrameElement>('#editorPreview')?.contentWindow?.postMessage(
      { type: 'room-video-light', screen: screenColor, floor: floorColor }, location.origin);
    const tvGain = mood.tvGlow / 100;
    glow(gx + gw / 2, gy + gh / 2, gw * .88, gh * 1.05, screenColor, .7 * tvGain);
    // Narrow pools on the bezel make the screen's color visible on the TV
    // itself as well as the room. The live glass is cut out afterwards.
    glow(gx + gw / 2, gy, gw * .62, Math.max(gh * .12, 8), screenColor, tvGain);
    glow(gx, gy + gh / 2, Math.max(gw * .12, 8), gh * .66, screenColor, tvGain);
    glow(gx + gw, gy + gh / 2, Math.max(gw * .12, 8), gh * .66, screenColor, tvGain);
    glow(gx + gw / 2, gy + gh, gw * .64, Math.max(gh * .17, 8), floorColor, tvGain);
    // Project a wider pool below the glass: cabinet first, floor further away.
    glow(gx + gw / 2, gy + gh * 1.17, gw * .72, Math.max(gh * .42, height * .09), floorColor, tvGain);
    glow(gx + gw / 2, gy + gh + height * .29, gw * .95, height * .25, floorColor, .65 * tvGain);
    const boxes = new Map([...document.querySelectorAll<HTMLElement>('.decoration-box:not(.decor-depth-outline)')].map(el => [el.dataset.id, el]));
    for (const light of sources) {
      const box = boxes.get(light.id);
      if (!box) continue;
      const rect = box.getBoundingClientRect();
      // Transform the emission point with the image, including its rotation.
      const angle = Number(/rotate\(([-\d.]+)deg\)/.exec(box.style.transform)?.[1] ?? 0) * Math.PI / 180;
      const dx = ((light.x ?? 50) / 100 - .5) * box.offsetWidth;
      const dy = ((light.y ?? 50) / 100 - .5) * box.offsetHeight;
      const x = (rect.left + rect.width / 2 + dx * Math.cos(angle) - dy * Math.sin(angle) - bounds.left) * scale;
      const y = (rect.top + rect.height / 2 + dx * Math.sin(angle) + dy * Math.cos(angle) - bounds.top) * scale;
      const color = { r: parseInt(light.color.slice(1, 3), 16), g: parseInt(light.color.slice(3, 5), 16),
        b: parseInt(light.color.slice(5, 7), 16), strength: light.intensity / 100 };
      const radius = Math.min(Math.max(width, height), box.offsetWidth * scale * light.radius);
      glow(x, y, radius, radius, color);
    }
    // Preserve the live picture and its native CRT treatment exactly.
    for (const ctx of [shadowCtx, tintCtx]) {
      ctx.save(); ctx.globalCompositeOperation = 'destination-out';
      const radius = stage.classList.contains('arcade-mode') ? Math.min(gw, gh) * .01 : Math.min(gw * .025, gh * .04);
      ctx.beginPath(); ctx.roundRect(gx, gy, gw, gh, radius);
      ctx.fillStyle = '#000'; ctx.fill(); ctx.restore();
    }
  }
  draw();
  // Eight tiny frame samples per second. Nothing is uploaded or sent to SFU.
  const timer = setInterval(draw, 125);
  window.addEventListener('pagehide', () => clearInterval(timer), { once: true });
}
