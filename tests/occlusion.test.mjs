import test from 'node:test';
import assert from 'node:assert/strict';
import { projectRect } from '../src/occlusion.ts';

test('TV silhouette follows a centered image cropped beyond the scene edges', () => {
  const body = projectRect({ x: 10, y: 8, width: 80, height: 76 },
    { x: -100, y: -20, width: 1200, height: 700 }, { x: 0, y: 0, width: 1000, height: 600 });
  assert.deepEqual(body, { x: 20, y: 36, width: 960, height: 532 });
});
test('occlusion is expressed in the scene coordinates, including editor offsets', () => {
  const percent = { x: 12, y: 10, width: 75, height: 34 };
  const body = projectRect(percent, { x: 210, y: 120, width: 400, height: 700 },
    { x: 200, y: 100, width: 400, height: 700 });
  assert.deepEqual(body, { x: 58, y: 90, width: 300, height: 238 });
});
