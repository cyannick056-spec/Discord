import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import express from 'express';
import { installDecorations } from '../decorations.mjs';

test('lighting saves round-trip without losing legacy placements and reject invalid writes', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'shis-light-test-'));
  const app = express(); app.use(express.json());
  installDecorations(app, { directory, editKey: 'test-editor-key' });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/decorations`;
  const placement = { x: 22, y: 30, width: 8, rotation: 0, opacity: 1, z: 12, hidden: false };
  const legacy = { items: [{ id: '11111111-1111-4111-8111-111111111111',
    asset: '11111111-1111-4111-8111-111111111111.png', name: 'Mi figura',
    placements: { 'home-landscape': placement } }] };
  const save = (body, key = 'test-editor-key') => fetch(url, { method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Decoration-Key': key }, body: JSON.stringify(body) });
  try {
    assert.equal((await save(legacy)).status, 200);
    assert.deepEqual(await (await fetch(url)).json(), legacy);
    const updated = structuredClone(legacy);
    updated.ambient = 62;
    updated.mood = { preset: 'blue-night', intensity: 65, tvGlow: 150 };
    updated.presentations = { 'home-landscape-16x9': { ambient: 78, mood: {preset:'neutral',intensity:0,tvGlow:120,depth:42,practicalLights:false,backlight:{color:'#779fcd',intensity:32,reach:115}} } };
    updated.items[0].placements['home-landscape'].light = { color: '#ffcc88', intensity: 75, radius: 6, x: 50, y: 20 };
    updated.items[0].placements['home-landscape'].behindTv = true;
    updated.items[0].placements['home-landscape'].locked = true;
    updated.items.push({ id: '22222222-2222-4222-8222-222222222222', kind: 'light', asset: '', name: 'Lámpara',
      placements: { 'home-portrait-4x3': { ...placement, light: { color: '#8899ff', intensity: 50, radius: 4 } } } });
    assert.equal((await save(updated)).status, 200);
    assert.deepEqual(await (await fetch(url)).json(), updated);
    assert.equal((await save(legacy, 'wrong-key')).status, 401);
    for (const badLight of [{ color: 'url(https://example.com)', intensity: 50, radius: 4 },
      { color: '#ffffff', intensity: 101, radius: 4 }, { color: '#ffffff', intensity: 50, radius: -2 },
      { color: '#ffffff', intensity: 50, radius: 4, x: 101 }]) {
      const invalid = structuredClone(updated);
      invalid.items[0].placements['home-landscape'].light = badLight;
      assert.equal((await save(invalid)).status, 400);
    }
    assert.equal((await save({ ...updated, ambient: 0 })).status, 400);
    const invalidDepth = structuredClone(updated);
    invalidDepth.items[0].placements['home-landscape'].behindTv = 'yes';
    assert.equal((await save(invalidDepth)).status, 400);
    for (const mood of [{ preset: 'unknown-preset', intensity: 60, tvGlow: 100 },
      { preset: 'blue-night', intensity: -1, tvGlow: 100 }, { preset: 'warm', intensity: 50, tvGlow: 201 },
      { preset: 'neutral', intensity: '65', tvGlow: 100 }]) {
      assert.equal((await save({ ...updated, mood })).status, 400);
    }
    const invalidLock = structuredClone(updated); invalidLock.items[0].placements['home-landscape'].locked = 1;
    assert.equal((await save(invalidLock)).status, 400);
    assert.deepEqual(await (await fetch(url)).json(), updated);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
