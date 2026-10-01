import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { installDecorations } from '../decorations.mjs';
import { prepareRoom } from '../src/modular-rooms.ts';
import { tvModels } from '../tv-catalog.mjs';
import { roomPlacement } from '../src/modular-rooms.ts';
import { rooms, visibleInRoom, builtinUrl } from '../room-catalog.mjs';

test('switching photographic rooms reuses edited furniture and preserves custom decorations', () => {
  const custom = { id: crypto.randomUUID(), asset: crypto.randomUUID() + '.png', name: 'Mi figura', placements: {} };
  const manifest = { items: [custom], ambient: 66 };
  prepareRoom(manifest, 'cozy-night');
  const cabinet = manifest.items.find(i => i.asset === 'cabinet');
  cabinet.placements['home-portrait-4x3'].x = 24;
  cabinet.placements['home-portrait-4x3'].rotation = -12;
  prepareRoom(manifest, 'cozy-night'); prepareRoom(manifest, 'cozy-night');
  assert.equal(manifest.items.filter(i => i.roomKit === 'cozy-night').length, 3);
  assert.equal(cabinet.placements['home-portrait-4x3'].x, 24);
  assert.equal(cabinet.placements['home-portrait-4x3'].rotation, -12);
  assert.equal(manifest.items[0], custom);
  assert.equal(visibleInRoom(cabinet, { environment: 'cozy-night' }), true);
  assert.equal(visibleInRoom(cabinet, { environment: 'cozy-night' }), true);
  assert.equal(visibleInRoom(custom, { environment: 'cozy-night' }), true);
  assert.equal(builtinUrl('../private'), '');
});

test('the night nook uses editable furniture and practical lights while personal decorations remain available', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'shis-modular-'));
  const app = express(); app.use(express.json({ limit: '4mb' })); installDecorations(app, { directory, editKey: 'fixture' });
  const server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r));
  const url = `http://127.0.0.1:${server.address().port}/api/decorations`;
  const manifest = { items: [], ambient: 66 };
  rooms.forEach(room => assert.equal(prepareRoom(manifest, room.id), true));
  assert.equal(manifest.items.length, 4);
  for (let n = 0; n < 60; n++) manifest.items.push({ id: crypto.randomUUID(), asset: crypto.randomUUID() + '.png', name: 'Figura ' + n, placements: {} });
  for (const [i, t] of tvModels.entries()) { const key = i % 2 ? 'home-portrait-4x3' : 'home-landscape-16x9'; manifest.presentations[key].tvModel = t.id; manifest.presentations[key].tvSupport = t.floor ? 'floor' : 'cabinet'; assert.equal((await fetch(url, { method:'PUT', headers:{'Content-Type':'application/json','X-Decoration-Key':'fixture'}, body:JSON.stringify(manifest) })).status, 200); }
  manifest.items.push({ id: crypto.randomUUID(), kind:'builtin', asset:'lava-lamp', name:'Lava', category:'lamp', placements:{'home-portrait-4x3':roomPlacement('lava-lamp',true)} });
  manifest.items.at(-1).placements['home-portrait-4x3'].lava = { motion:false, speed:2.4 };
  manifest.items.at(-1).placements['home-portrait-4x3'].light.color = '#ad7aff';
  manifest.presentations['home-landscape-16x9'].rain = {enabled:true,forceMotion:true,intensity:80,speed:1.7};
  const viewKeys = Object.keys(manifest.presentations); viewKeys.forEach((k,i) => manifest.presentations[k].camera = {zoom:1+i*.1});
  const save = body => fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Decoration-Key': 'fixture' }, body: JSON.stringify(body) });
  try {
    assert.equal((await save(manifest)).status, 200);
    assert.deepEqual(await (await fetch(url)).json(), manifest);
    for (const mutation of [v => v.presentations['home-landscape-16x9'].ambient = 101, v => v.presentations['home-landscape-16x9'].mood.tvGlow = 300, v => v.presentations['home-landscape-16x9'].rain.forceMotion = 'yes', v => v.presentations['home-landscape-16x9'].rain.speed = 99, v => v.presentations['home-landscape-16x9'].rain.enabled = 'true', v => v.presentations['home-landscape-16x9'].rain.intensity = -1, v => v.items.at(-1).placements['home-portrait-4x3'].lava.speed = 99, v => v.items.at(-1).placements['home-portrait-4x3'].lava.motion = 'yes', v => v.presentations['home-portrait-4x3'].tvSupport = 'wall', v => v.items[0].asset = '../private', v => v.items[0].roomKit = 'unknown', v => v.presentations['home-portrait-4x3'].tvModel = 'untrusted', v => v.presentations['home-portrait-4x3'].environment = '../private']) {
      const invalid = structuredClone(manifest); mutation(invalid); assert.equal((await save(invalid)).status, 400);
      assert.deepEqual(await (await fetch(url)).json(), manifest);
    }
  } finally { await new Promise(r => server.close(r)); await rm(directory, { recursive: true, force: true }); }
});
