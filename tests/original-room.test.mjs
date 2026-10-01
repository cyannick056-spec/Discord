import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import express from 'express';
import { installDecorations } from '../decorations.mjs';
import { restoreOriginalRoom } from '../original-room.mjs';

test('shared original-room restoration preserves compositions and decorations and runs only once', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'shis-original-room-'));
  const before = { items: [{ id: '11111111-1111-4111-8111-111111111111', asset: '11111111-1111-4111-8111-111111111111.png', name: 'Mi figura', placements: { 'home-portrait-4x3': { x: 22, y: 30, width: 8, rotation: 0, opacity: 1, z: 12, hidden: false } } }], ambient: 42, mood: { preset: 'blue-night', daytime: 'evening', intensity: 85, tvGlow: 150 },
    presentations: {
      'home-portrait-4x3': { style: 'custom', background: '11111111-1111-4111-8111-111111111111.png', tvPaint: { enabled: true, body: '#ff99cc' }, camera: { zoom: 1.2, x: 5 }, tv: { y: 7 }, screen: { width: 95 }, video: { zoom: 1.6 }, reflection: { blur: 4 } },
      'arcade-landscape': { tv: { x: 8 }, tvPaint: { enabled: true, body: '#ff99cc' } },
    }, profiles: [{ id: '22222222-2222-4222-8222-222222222222', name: 'Mi sala', room: { items: [], ambient: 72 } }] };
  const server = async () => {
    const app = express(); app.use(express.json()); installDecorations(app, { directory, editKey: 'test-key', restoreOriginal: true });
    const instance = app.listen(0, '127.0.0.1'); await new Promise(resolve => instance.once('listening', resolve));
    return { instance, url: `http://127.0.0.1:${instance.address().port}/api/decorations` };
  };
  let active;
  try {
    await writeFile(path.join(directory, 'manifest.json'), JSON.stringify(before));
    active = await server();
    const restored = await (await fetch(active.url)).json();
    assert.deepEqual(restored, restoreOriginalRoom(structuredClone(before)));
    assert.deepEqual(restored.presentations['home-portrait-4x3'], { style: 'classic', camera: { zoom: 1.2, x: 5 }, tv: { y: 7 }, screen: { width: 95 }, video: { zoom: 1.6 }, reflection: { blur: 4 } });
    assert.deepEqual(restored.profiles, before.profiles);
    assert.deepEqual(restored.items, before.items);
    assert.deepEqual(restored.presentations['arcade-landscape'], before.presentations['arcade-landscape']);
    assert.deepEqual(JSON.parse(await readFile(path.join(directory, 'manifest-before-original-room-v1.json'), 'utf8')), before);
    const edited = { ...restored, mood: { ...restored.mood, daytime: 'day' } };
    assert.equal((await fetch(active.url, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Decoration-Key': 'test-key' }, body: JSON.stringify(edited) })).status, 200);
    await new Promise(resolve => active.instance.close(resolve)); active = await server();
    assert.deepEqual(await (await fetch(active.url)).json(), edited);
    assert.deepEqual(JSON.parse(await readFile(path.join(directory, 'manifest-before-original-room-v1.json'), 'utf8')), before);
  } finally {
    if (active) await new Promise(resolve => active.instance.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
