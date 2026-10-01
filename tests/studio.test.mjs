import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { installDecorations } from '../decorations.mjs';
import { perspectiveAngles, objectTransform, gradeFilter } from '../src/studio-model.ts';

test('automatic perspective follows a chosen surface; switching to manual retains editable geometry', () => {
  assert.deepEqual(perspectiveAngles({ auto: true, surface: 'floor' }), { x: 55, y: 0 });
  assert.deepEqual(perspectiveAngles({ auto: true, surface: 'wall' }, 0), { x: 0, y: 12 });
  assert.deepEqual(perspectiveAngles({ auto: true, surface: 'wall' }, 100), { x: 0, y: -12 });
  const manual = { auto: false, tiltX: 30, tiltY: -12, flipX: true, scaleY: .8, skewX: 7 };
  assert.deepEqual(perspectiveAngles(manual), { x: 30, y: -12 });
  assert.match(objectTransform(10, manual), /rotateX\(30deg\).*rotateY\(-12deg\).*skew\(7deg,0deg\).*scale\(-1,0.8\)/);
  assert.match(gradeFilter({ preset: 'classic-night', intensity: 100, tvGlow: 100 }, 'wall'), /brightness\(0.78\)/);
  assert.match(gradeFilter({ preset: 'classic-night', intensity: 100, tvGlow: 100, zones: { tv: { influence: 0 } } }, 'tv'), /brightness\(1\) contrast\(1\)/);
});

test('studio fields, personal library and nonrecursive rooms persist; invalid geometry and nested snapshots cannot overwrite them', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'shis-studio-'));
  const app = express(); app.use(express.json({ limit: '4mb' })); installDecorations(app, { directory, editKey: 'fixture' });
  const server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r));
  const url = `http://127.0.0.1:${server.address().port}/api/decorations`;
  const id = '11111111-1111-4111-8111-111111111111';
  const item = { id, name: 'Robot', kind: 'shape', shape: 'robot', asset: '', favorite: true, category: 'figurine', group: id,
    placements: { 'home-portrait-4x3': { x: 30, y: 50, width: 12, rotation: 9, z: 4, opacity: 1, hidden: false, behindTv: true,
      transform: { surface: 'cabinet', auto: true, flipX: true, skewX: 8, scaleY: .8 }, crop: [2, 0, 0, 0],
      contactShadow: { opacity: 50, blur: 4, width: 70, x: 0, y: -3 }, light: { color: '#fedcba', intensity: 75, radius: 4, shape: 'strip', softness: 80, angle: 30 } } } };
  const room = { items: [item], ambient: 45, mood: { preset: 'classic-night', intensity: 75, tvGlow: 125, rim: 150, cabinet: 75, floor: 100, reach: 120, transition: 500,
    grade: { exposure: -12 }, zones: { tv: { influence: 20 }, floor: { temperature: -25, shadows: 15 } } } };
  const { placements: _p, ...libraryItem } = item;
  const manifest = { ...room, profiles: [{ id, name: 'Mi noche', room }], versions: [{ id, name: 'Anterior', room }], library: [libraryItem] };
  const save = body => fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Decoration-Key': 'fixture' }, body: JSON.stringify(body) });
  try {
    assert.equal((await save(manifest)).status, 200); assert.deepEqual(await (await fetch(url)).json(), manifest);
    const invalids = [
      v => { v.items[0].placements['home-portrait-4x3'].transform.tiltX = 90; },
      v => { v.items[0].placements['home-portrait-4x3'].transform.auto = 'yes'; },
      v => { v.items[0].placements['home-portrait-4x3'].crop = [50, 0, 0, 0]; },
      v => { v.items[0].placements['home-portrait-4x3'].light.shape = 'unknown'; },
      v => { v.mood.zones.video = { exposure: 50 }; },
      v => { v.profiles[0].room.profiles = []; },
      v => { v.library[0].asset = '../private'; delete v.library[0].kind; },
    ];
    for (const mutate of invalids) { const copy = structuredClone(manifest); mutate(copy); assert.equal((await save(copy)).status, 400); }
    assert.deepEqual(await (await fetch(url)).json(), manifest);
  } finally { await new Promise(r => server.close(r)); await rm(directory, { recursive: true, force: true }); }
});
