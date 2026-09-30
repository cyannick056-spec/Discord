export type LightColor = { r: number; g: number; b: number; strength: number };

// Tiny decoded-frame samples, never a second media stream or full-size readback.
export function frameColor(pixels: Uint8ClampedArray, width: number, height: number,
  fromY = 0, toY = height): LightColor {
  let r = 0, g = 0, b = 0, count = 0;
  for (let y = fromY; y < toY; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    r += pixels[i]; g += pixels[i + 1]; b += pixels[i + 2]; count++;
  }
  if (!count) return { r: 0, g: 0, b: 0, strength: 0 };
  r /= count; g /= count; b /= count;
  const peak = Math.max(r, g, b);
  // Keep black frames dark; saturation is retained even for red/blue scenes.
  const strength = Math.min(1, peak / 255);
  const gain = peak > 0 ? 255 / peak : 0;
  return { r: r * gain, g: g * gain, b: b * gain, strength };
}

export function blendColor(previous: LightColor, next: LightColor, amount: number): LightColor {
  return { r: previous.r + (next.r - previous.r) * amount,
    g: previous.g + (next.g - previous.g) * amount,
    b: previous.b + (next.b - previous.b) * amount,
    strength: previous.strength + (next.strength - previous.strength) * amount };
}
