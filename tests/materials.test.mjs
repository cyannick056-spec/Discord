import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { installDecorations } from '../decorations.mjs';
import { materials, MAX_SCENE_ITEMS } from '../material-catalog.mjs';
import { prepareRoom, roomPlacement, builtinDecoration } from '../src/modular-rooms.ts';

test('furniture materials survive saves; shared allowance admits furniture plus personal images and rejects overflow safely', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'shis-material-'));
  const app = express(); app.use(express.json({ limit: '4mb' })); installDecorations(app, { directory, editKey: 'fixture' });
  const server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r));
  const url = `http://127.0.0.1:${server.address().port}/api/decorations`;
  const save = body => fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Decoration-Key': 'fixture' }, body: JSON.stringify(body) });
  const key = 'home-portrait-4x3';
  const cabinet = builtinDecoration('cabinet'); cabinet.placements[key] = roomPlacement('cabinet', true);
  const manifest = { items: [cabinet], ambient: 66 };
  prepareRoom(manifest, 'cozy-night', key);
  try {
    for (const material of materials) {
      cabinet.placements[key].material = { preset: material.id, scope: 'top', color: '#b7a6ca', strength: 86, scale: 1.8, roughness: 40 };
      assert.equal((await save(manifest)).status, 200);
      assert.deepEqual(await (await fetch(url)).json(), manifest);
    }
    for (const material of [{ preset: '../private' }, { preset: 'oak', scope: 'wall' }, { preset: 'steel', scale: 0 }, { preset: 'marble', roughness: 101 }, { preset: 'white', color: 'url(x)' }, { preset: 'pink', strength: '80' }]) {
      const invalid = structuredClone(manifest); invalid.items.find(i => i.asset === 'cabinet').placements[key].material = material;
      assert.equal((await save(invalid)).status, 400);
      assert.deepEqual(await (await fetch(url)).json(), manifest);
    }
    while (manifest.items.length < MAX_SCENE_ITEMS) {
      const builtin = manifest.items.length % 2 === 0;
      if (builtin) {
        const item = builtinDecoration('side-table'); item.placements[key] = roomPlacement('side-table', true); manifest.items.push(item);
      } else manifest.items.push({ id: crypto.randomUUID(), asset: crypto.randomUUID() + '.png', name: 'Decoración personal', category: 'figurine', placements: {} });
    }
    assert.equal((await save(manifest)).status, 200);
    const overflow = structuredClone(manifest); const extra = builtinDecoration('cabinet-black'); extra.placements[key] = roomPlacement('cabinet-black', true); overflow.items.push(extra);
    assert.equal((await save(overflow)).status, 400);
    assert.deepEqual(await (await fetch(url)).json(), manifest);
    assert.equal(prepareRoom(manifest, 'walnut-den', key), true);
    assert.equal(manifest.items.length, MAX_SCENE_ITEMS);
  } finally { await new Promise(r=>server.close(r)); await rm(directory,{recursive:true,force:true}); }
});
