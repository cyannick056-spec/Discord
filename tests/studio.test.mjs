import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { installDecorations } from '../decorations.mjs';
import { perspectiveAngles, objectTransform, gradeFilter } from '../src/studio-model.ts';
import { straightCorners, validCorners, cornerMatrix } from '../src/perspective.ts';
import { reflectionPlanes } from '../src/reflections.ts';
import { cameraRect, videoCrop, screenRect } from '../src/presentation-model.ts';

test('four-corner projection maps every corner and rejects crossed or collapsed quads', () => {
  const target = [[10, 5], [90, 0], [100, 100], [0, 90]], w = 180, h = 240;
  assert.equal(validCorners(target), true); assert.equal(validCorners([[0, 0], [100, 100], [100, 0], [0, 100]]), false);
  assert.equal(validCorners([[0, 0], [0, 0], [100, 100], [0, 100]]), false);
  const m = cornerMatrix(target, w, h).slice(9, -1).split(',').map(Number);
  straightCorners().forEach((p, i) => {
    const x = (p[0] / 100 - .5) * w, y = (p[1] / 100 - .5) * h, denominator = m[3] * x + m[7] * y + m[15];
    const u = (m[0] * x + m[4] * y + m[12]) / denominator, v = (m[1] * x + m[5] * y + m[13]) / denominator;
    assert.ok(Math.abs(u - (target[i][0] / 100 - .5) * w) < 1e-6); assert.ok(Math.abs(v - (target[i][1] / 100 - .5) * h) < 1e-6);
  });
  assert.deepEqual(perspectiveAngles({ auto: true, surface: 'ceiling' }), { x: -55, y: 0 });
  assert.deepEqual(perspectiveAngles({ auto: true, surface: 'left-wall' }), { x: 0, y: 45 });
  assert.deepEqual(perspectiveAngles({ auto: true, surface: 'right-wall' }), { x: 0, y: -45 });
});

test('camera coordinates preserve framing and video light sampling follows the visible crop', () => {
  assert.deepEqual(cameraRect({ x: 10, y: 20, width: 800, height: 600 }, { camera: { x: 10, y: -5, zoom: 2 } }), { x: -310, y: -310, width: 1600, height: 1200 });
  const crop = videoCrop(1920, 1080, 800, 450, { zoom: 2, x: 50, y: -50 });
  assert.deepEqual(crop, { x: 0, y: 540, width: 960, height: 540 });
  assert.deepEqual(videoCrop(1920, 1080, 600, 600, { zoom: 1.8, x: 50, y: -50, fit: 'contain' }), { x: 0, y: 0, width: 1920, height: 1080 });
  assert.deepEqual(videoCrop(1920, 1080, 600, 600, { zoom: 1 }, 'contain'), { x: 0, y: 0, width: 1920, height: 1080 });
});

test('screen position and dimensions are independent from TV and video framing', () => {
  const base = { x: 100, y: 50, width: 800, height: 450 };
  assert.deepEqual(screenRect(base), base);
  assert.deepEqual(screenRect(base, { x: 5, y: -10, width: 90, height: 110 }), { x: 140, y: 5, width: 720, height: 495 });
});

test('reflection surfaces stay attached to photographic furniture as the room is framed', () => {
  const p = reflectionPlanes({ x: -100, y: 20, width: 1000, height: 1600 }, true);
  assert.deepEqual(p.table, { x: -100, y: 692, width: 1000, height: 94.39999999999999 });
  assert.equal(p.floor.y, 1020);
  const wide = reflectionPlanes({ x: 0, y: 0, width: 1000, height: 600 }, false);
  assert.ok(wide.floor.y > 600);
});

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
      transform: { surface: 'cabinet', auto: true, flipX: true, skewX: 8, scaleY: .8, depth: 600, corners: [[5, 0], [95, 5], [100, 100], [0, 90]] }, crop: [2, 0, 0, 0],
      contactShadow: { opacity: 50, blur: 4, width: 70, x: 0, y: -3 }, light: { color: '#fedcba', intensity: 75, radius: 4, shape: 'strip', softness: 80, angle: 30 } } } };
  const room = { items: [item], ambient: 45, presentations: { 'home-portrait-4x3': { style: 'wood', wall: '#303b50', tv: { x: -10, y: 12, zoom: .7 }, camera: { zoom: 1.4 }, video: { zoom: 1.6, x: 25, fit: 'contain' }, screen: { x: 2, y: -1, width: 98, height: 96, rounded: false }, supportId: id, tvPaint: { enabled: true, body: '#cc99bb', bezel: '#222233', panel: '#aaccff', strength: 90, hue: 5, saturation: 120, exposure: 10, contrast: 110, finish: 'satin' }, reflection: { enabled: true, intensity: 110, table: 90, floor: 100, blur: 8, reach: 110, spread: 100, texture: 50 } } }, mood: { daytime: 'evening', preset: 'classic-night', intensity: 75, tvGlow: 125, rim: 150, cabinet: 75, floor: 100, reach: 120, transition: 500,
    grade: { exposure: -12 }, zones: { tv: { influence: 20 }, floor: { temperature: -25, shadows: 15 } } } };
  const { placements: _p, ...libraryItem } = item;
  const manifest = { ...room, profiles: [{ id, name: 'Mi noche', room }], versions: [{ id, name: 'Anterior', room }], library: [libraryItem] };
  const save = body => fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Decoration-Key': 'fixture' }, body: JSON.stringify(body) });
  try {
    assert.equal((await save(manifest)).status, 200); assert.deepEqual(await (await fetch(url)).json(), manifest);
    const invalids = [
      v => { v.items[0].placements['home-portrait-4x3'].transform.tiltX = 90; },
      v => { v.items[0].placements['home-portrait-4x3'].transform.auto = 'yes'; },
      v => { v.items[0].placements['home-portrait-4x3'].transform.corners = [[0, 0], [100, 100], [100, 0], [0, 100]]; },
      v => { v.presentations['home-portrait-4x3'].background = '../private'; },
      v => { v.presentations['home-portrait-4x3'].video.zoom = .5; },
      v => { v.presentations['home-portrait-4x3'].video.fit = 'stretch'; },
      v => { v.presentations['home-portrait-4x3'].screen.rounded = 'false'; },
      v => { v.presentations['home-portrait-4x3'].supportId = '../other'; },
      v => { v.presentations.unknown = {}; },
      v => { v.presentations['home-portrait-4x3'].tvPaint.body = '#oops'; },
      v => { v.presentations['home-portrait-4x3'].tvPaint.finish = 'fake'; },
      v => { v.presentations['home-portrait-4x3'].reflection.blur = -1; },
      v => { v.presentations['home-portrait-4x3'].reflection.enabled = 'true'; },
      v => { v.mood.daytime = 'midnight-other'; },
      v => { v.presentations['home-portrait-4x3'].screen.width = 0; },
      v => { v.presentations['home-portrait-4x3'].screen.x = '5'; },
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
