import test from 'node:test';
import assert from 'node:assert/strict';
import { frameColor, blendColor } from '../src/light-color.ts';

test('black video contributes no light, even after saturation normalization', () => {
  assert.deepEqual(frameColor(new Uint8ClampedArray([0, 0, 0, 255]), 1, 1),
    { r: 0, g: 0, b: 0, strength: 0 });
});
test('a dim blue frame retains its color without becoming a full-power light', () => {
  const color = frameColor(new Uint8ClampedArray([0, 0, 30, 255]), 1, 1);
  assert.equal(color.b, 255);
  assert.ok(color.strength < .12);
  assert.equal(color.r, 0);
});
test('floor bounce follows the bottom of a video rather than a different-colored top', () => {
  const pixels = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 255]);
  assert.deepEqual(frameColor(pixels, 1, 2, 1, 2), { r: 0, g: 0, b: 255, strength: 1 });
});
test('a cut from bright red to black fades instead of flashing instantly', () => {
  const faded = blendColor({ r: 255, g: 0, b: 0, strength: 1 }, { r: 0, g: 0, b: 0, strength: 0 }, .28);
  assert.ok(faded.strength > 0 && faded.strength < 1);
});
