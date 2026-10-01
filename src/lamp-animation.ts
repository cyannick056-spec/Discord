import type { Placement } from './decorations';

type Lamp = { canvas: HTMLCanvasElement; image: HTMLImageElement; placement: Placement; lava: boolean };
let lamps: Lamp[] = [], animation = 0, previous = 0;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
export function clearLampAnimation() { lamps = []; cancelAnimationFrame(animation); animation = 0; }
export function addLampAnimation(box: HTMLElement, image: HTMLImageElement, p: Placement, lava: boolean) {
  const canvas = document.createElement('canvas'); canvas.className = 'lamp-animation';
  canvas.width = 128; canvas.height = 384; canvas.setAttribute('aria-hidden', 'true'); box.append(canvas);
  lamps.push({ canvas, image, placement: p, lava });
  if (!animation) animation = requestAnimationFrame(draw);
}
function draw(time: number) {
  animation = 0;
  if (document.hidden) return;
  if (time - previous >= 40) {
    previous = time;
    lamps = lamps.filter(l => l.canvas.isConnected);
    for (const { canvas, image, placement: p, lava } of lamps) {
      const c = canvas.getContext('2d'); if (!c || !image.complete || !image.naturalWidth) continue;
      c.clearRect(0, 0, 128, 384);
      if (!p.light || p.light.intensity === 0) continue;
      const color = p.light.color;
      c.save();
      if (lava) {
        c.beginPath(); c.moveTo(54, 52); c.lineTo(74, 52); c.lineTo(87, 230); c.lineTo(41, 230); c.closePath(); c.clip();
        const liquid = c.createLinearGradient(0, 52, 0, 230);
        liquid.addColorStop(0, '#182237'); liquid.addColorStop(.8, '#252137'); liquid.addColorStop(1, color);
        c.globalAlpha = .65; c.fillStyle = liquid; c.fillRect(0, 0, 128, 384); c.globalAlpha = 1;
        const t = !reducedMotion.matches && p.lava?.motion !== false ? time / 9000 * (p.lava?.speed ?? 1) : 1;
        for (let i = 0; i < 6; i++) {
          const y = 143 + Math.sin(t * (.6 + i * .06) + i * 1.7) * 78;
          const x = 64 + Math.sin(t * .5 + i * 2) * 19;
          const r = 10 + i % 3 * 4, glow = c.createRadialGradient(x - r * .2, y - r * .3, 1, x, y, r * 1.5);
          glow.addColorStop(0, '#fff1ce'); glow.addColorStop(.3, color); glow.addColorStop(1, color + '00');
          c.fillStyle = glow; c.beginPath(); c.ellipse(x, y, r, r * (1.25 + Math.sin(t + i) * .25), 0, 0, Math.PI * 2); c.fill();
        }
      } else {
        const y = (p.light.y ?? 24) * 3.84, glow = c.createRadialGradient(64, y, 0, 64, y, 75);
        glow.addColorStop(0, color + 'bb'); glow.addColorStop(1, color + '00');
        c.fillStyle = glow; c.fillRect(0, 0, 128, 384);
      }
      c.restore(); c.globalAlpha = Math.min(1, p.light.intensity / 100);
      c.globalCompositeOperation = 'destination-in'; c.drawImage(image, 0, 0, 128, 384); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    }
  }
  if (lamps.length) animation = requestAnimationFrame(draw);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && lamps.length && !animation) animation = requestAnimationFrame(draw); });
