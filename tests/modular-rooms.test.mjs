import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { installDecorations } from '../decorations.mjs';
import { prepareRoom } from '../src/modular-rooms.ts';
import { rooms, visibleInRoom, builtinUrl } from '../room-catalog.mjs';

test('switching photographic rooms reuses edited furniture and preserves custom decorations', () => {
  const custom = { id: crypto.randomUUID(), asset: crypto.randomUUID() + '.png', name: 'Mi figura', placements: {} };
  const manifest = { items: [custom], ambient: 66 };
  prepareRoom(manifest, 'retro');
  const cabinet = manifest.items.find(i => i.asset === 'cabinet');
  cabinet.placements['home-portrait-4x3'].x = 24;
  cabinet.placements['home-portrait-4x3'].rotation = -12;
  prepareRoom(manifest, 'rain'); prepareRoom(manifest, 'retro');
  assert.equal(manifest.items.filter(i => i.roomKit === 'retro').length, 8);
  assert.equal(cabinet.placements['home-portrait-4x3'].x, 24);
  assert.equal(cabinet.placements['home-portrait-4x3'].rotation, -12);
  assert.equal(manifest.items[0], custom);
  assert.equal(visibleInRoom(cabinet, { environment: 'rain' }), false);
  assert.equal(visibleInRoom(cabinet, { environment: 'retro' }), true);
  assert.equal(visibleInRoom(custom, { environment: 'rain' }), true);
  assert.equal(builtinUrl('../private'), '');
});

test('six furnished rooms fit without consuming the custom decoration allowance', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'shis-modular-'));
  const app = express(); app.use(express.json({ limit: '4mb' })); installDecorations(app, { directory, editKey: 'fixture' });
  const server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r));
  const url = `http://127.0.0.1:${server.address().port}/api/decorations`;
  const manifest = { items: [], ambient: 66 };
  rooms.forEach(room => assert.equal(prepareRoom(manifest, room.id), true));
  assert.equal(manifest.items.length, 48);
  for (let n = 0; n < 60; n++) manifest.items.push({ id: crypto.randomUUID(), asset: crypto.randomUUID() + '.png', name: 'Figura ' + n, placements: {} });
  manifest.presentations['home-portrait-4x3'].tvModel = 'silver';
  const save = body => fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Decoration-Key': 'fixture' }, body: JSON.stringify(body) });
  try {
    assert.equal((await save(manifest)).status, 200);
    assert.deepEqual(await (await fetch(url)).json(), manifest);
    for (const mutation of [v => v.items[0].asset = '../private', v => v.items[0].roomKit = 'unknown', v => v.presentations['home-portrait-4x3'].tvModel = 'untrusted', v => v.presentations['home-portrait-4x3'].environment = '../private']) {
      const invalid = structuredClone(manifest); mutation(invalid); assert.equal((await save(invalid)).status, 400);
      assert.deepEqual(await (await fetch(url)).json(), manifest);
    }
  } finally { await new Promise(r => server.close(r)); await rm(directory, { recursive: true, force: true }); }
});
