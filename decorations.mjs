import { MAX_SCENE_ITEMS } from './material-catalog.mjs';
import crypto from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import { validMood, validMetadata, validStudioPlacement, validCollections, validPresentations } from './studio-validation.mjs';
import { restoreOriginalRoom } from './original-room.mjs';
import { rebuildRealRooms } from './real-room.mjs';
import { roomIds, legacyRoomIds } from './room-catalog.mjs';

const views = new Set([
  'home-landscape', 'home-portrait', 'home-window',
  'arcade-landscape', 'arcade-portrait', 'arcade-window',
  'home-landscape-16x9', 'home-landscape-4x3',
  'home-portrait-16x9', 'home-portrait-4x3',
  'home-window-16x9', 'home-window-4x3',
]);
const assetPattern = /^[a-f0-9-]{36}\.(png|jpg|webp|gif)$/;
const viewerSlotIds = new Set(['viewer-slot-red', 'viewer-slot-blue', 'viewer-slot-green', 'viewer-slot-yellow', 'viewer-slot-black']);
const mimeFor = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };

function assetExtension(buffer) {
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png';
  if (buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) return 'jpg';
  if (buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP') return 'webp';
  if (['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString())) return 'gif';
  return null;
}

function inRange(value, low, high) {
  return typeof value === 'number' && Number.isFinite(value) && value >= low && value <= high;
}

function validManifest(input) {
  if (!input || !Array.isArray(input.items) || input.items.length > MAX_SCENE_ITEMS + 5) return false;
  if (input.ambient !== undefined && !inRange(input.ambient, 25, 100)) return false;
  if (input.mood !== undefined && !validMood(input.mood)) return false;
  if (!validCollections(input, validManifest)) return false;
  if (!validPresentations(input.presentations, views)) return false;
  const ids = new Set();
  let decorations = 0;
  let builtins = 0;
  return input.items.every((item) => {
    const slot = item?.kind === 'viewer-slot';
    const light = item?.kind === 'light';
    const shape = item?.kind === 'shape';
    const builtin = item?.kind === 'builtin';
    if (builtin) builtins++; else if (!slot) decorations++;
    if (!item || typeof item.id !== 'string' ||
        (slot ? !viewerSlotIds.has(item.id) : !/^[a-f0-9-]{36}$/.test(item.id)) ||
        decorations + builtins > MAX_SCENE_ITEMS || ids.has(item.id) ||
        (item.kind !== undefined && !slot && !light && !shape && !builtin) ||
        (!slot && !light && !shape && !builtin && (typeof item.asset !== 'string' || !assetPattern.test(item.asset))) ||
        !validMetadata(item) ||
        typeof item.name !== 'string' || item.name.length > 70 ||
        !item.placements || typeof item.placements !== 'object') return false;
    ids.add(item.id);
    return Object.entries(item.placements).every(([view, p]) =>
      views.has(view) && p && validStudioPlacement(p) &&
      inRange(p.x, -30, 130) && inRange(p.y, -35, 145) &&
      inRange(p.width, 1, 130) && inRange(p.rotation, -180, 180) &&
      inRange(p.opacity, 0, 1) && inRange(p.z, 0, 99) &&
      typeof p.hidden === 'boolean' &&
      (p.foreground === undefined || typeof p.foreground === 'boolean') &&
      (p.behindTv === undefined || typeof p.behindTv === 'boolean') &&
      (p.locked === undefined || typeof p.locked === 'boolean') &&
      (p.anchor === undefined || p.anchor === 'scene' || p.anchor === 'frame') &&
      (p.brightness === undefined || inRange(p.brightness, 35, 130)) &&
      (p.saturation === undefined || inRange(p.saturation, 0, 150)) &&
      (p.hue === undefined || inRange(p.hue, -60, 60)) &&
      (p.shadow === undefined || inRange(p.shadow, 0, 100)) &&
      (p.light === undefined || (p.light && /^#[a-fA-F0-9]{6}$/.test(p.light.color) &&
        inRange(p.light.intensity, 0, 100) && inRange(p.light.radius, 1, 12) &&
        (p.light.x === undefined || inRange(p.light.x, 0, 100)) &&
        (p.light.y === undefined || inRange(p.light.y, 0, 100)))));
  });
}

export function installDecorations(app, { directory, editKey, restoreOriginal = false, rebuildRooms = false }) {
  const assetsDir = path.join(directory, 'assets');
  const manifestPath = path.join(directory, 'manifest.json');
  const blank = { items: [] };

  // Apply the requested shared-room restoration once, with a full backup.
  // Subsequent deployments and editor saves keep the user's newer choices.
  const originalReady = restoreOriginal ? (async () => {
    const marker = path.join(directory, 'original-room-restored-v1.json');
    try { await readFile(marker); return; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const data = await readFile(manifestPath, 'utf8').catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    await mkdir(directory, { recursive: true });
    const manifest = data === null ? structuredClone(blank) : JSON.parse(data);
    if (!validManifest(manifest)) throw new Error('Cannot restore an invalid decoration manifest');
    if (data !== null) {
      await writeFile(path.join(directory, 'manifest-before-original-room-v1.json'), data, { flag: 'wx' }).catch(error => { if (error.code !== 'EEXIST') throw error; });
    }
    const temporary = path.join(directory, `manifest-${crypto.randomUUID()}.tmp`);
    await writeFile(temporary, JSON.stringify(restoreOriginalRoom(manifest)));
    await rename(temporary, manifestPath);
    await writeFile(marker, JSON.stringify({ restoredAt: new Date().toISOString() }));
    console.info(`Original photo room restored; ${manifest.items.length} decorations preserved`);
  })().then(() => null, error => error) : Promise.resolve(null);
  const ready = rebuildRooms ? originalReady.then(async error => {
    if (error) throw error;
    const marker = path.join(directory, 'real-rooms-rebuilt-v1.json');
    try { await readFile(marker); return; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const data = await readFile(manifestPath, 'utf8').catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    const manifest = data === null ? structuredClone(blank) : JSON.parse(data);
    if (!validManifest(manifest)) throw new Error('Cannot replace an invalid shared scene');
    await mkdir(directory, { recursive: true });
    if (data !== null) await writeFile(path.join(directory, 'manifest-before-real-rooms-v1.json'), data, { flag: 'wx' }).catch(error => { if (error.code !== 'EEXIST') throw error; });
    rebuildRealRooms(manifest);
    if (!validManifest(manifest)) throw new Error('Replacement scene failed validation');
    const temporary = path.join(directory, `manifest-${crypto.randomUUID()}.tmp`);
    await writeFile(temporary, JSON.stringify(manifest)); await rename(temporary, manifestPath);
    await writeFile(marker, JSON.stringify({ rebuiltAt: new Date().toISOString() }));
  }).then(() => null, error => error) : originalReady;
  app.use('/api/decorations', async (_req, res, next) => {
    const error = await ready;
    if (error) { console.error('Room preparation failed:', error); return res.status(500).json({ error: 'No se pudo preparar el entorno' }); }
    next();
  });

  function editorOnly(req, res, next) {
    const supplied = Buffer.from(String(req.get('X-Decoration-Key') || ''));
    const expected = Buffer.from(String(editKey || ''));
    if (!expected.length || supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
      return res.status(401).json({ error: 'Clave de edición incorrecta' });
    }
    next();
  }

  app.get('/api/decorations', async (_req, res) => {
    try {
      const data = await readFile(manifestPath, 'utf8').catch((error) => {
        if (error.code === 'ENOENT') return JSON.stringify(blank);
        throw error;
      });
      res.set('Cache-Control', 'no-store').type('json').send(data);
    } catch (error) {
      console.error('Decoration load failed:', error);
      res.status(500).json({ error: 'No se pudo cargar la decoración' });
    }
  });

  app.get('/api/decorations/assets/:asset', (req, res) => {
    const asset = req.params.asset;
    if (!assetPattern.test(asset)) return res.sendStatus(404);
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.type(mimeFor[asset.split('.').pop()]);
    createReadStream(path.join(assetsDir, asset))
      .on('error', () => { if (!res.headersSent) res.sendStatus(404); else res.destroy(); })
      .pipe(res);
  });

  app.post('/api/decorations/auth', editorOnly, (_req, res) => res.sendStatus(204));

  app.post('/api/decorations/assets', editorOnly,
    express.raw({ type: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'], limit: '2mb' }),
    async (req, res) => {
      const buffer = req.body;
      const extension = Buffer.isBuffer(buffer) && buffer.length > 0 && assetExtension(buffer);
      if (!extension) return res.status(400).json({ error: 'Usa una imagen PNG, JPG, WebP o GIF (máximo 2 MB)' });
      try {
        await mkdir(assetsDir, { recursive: true });
        const asset = `${crypto.randomUUID()}.${extension}`;
        await writeFile(path.join(assetsDir, asset), buffer, { flag: 'wx' });
        res.status(201).json({ asset });
      } catch (error) {
        console.error('Decoration upload failed:', error);
        res.status(500).json({ error: 'No se pudo guardar la imagen' });
      }
    });

  app.put('/api/decorations', editorOnly, async (req, res) => {
    if (!validManifest(req.body)) return res.status(400).json({ error: 'Decoración inválida' });
    if (rebuildRooms && req.body && (
      Object.entries(req.body.presentations ?? {}).some(([key,p]) => key.startsWith('home-') && (!p || (!roomIds.has(p.environment) && !(p.style === 'custom' && p.background)))) ||
      (req.body.items ?? []).some(i => legacyRoomIds.has(i.roomKit)))) {
      return res.status(409).json({ error: 'Los escenarios anteriores se reemplazaron. Vuelve a abrir la actividad antes de guardar.' });
    }
    try {
      await mkdir(directory, { recursive: true });
      const temporary = path.join(directory, `manifest-${crypto.randomUUID()}.tmp`);
      await writeFile(temporary, JSON.stringify({ items: req.body.items,
        ...(req.body.ambient !== undefined ? { ambient: req.body.ambient } : {}),
        ...(req.body.mood !== undefined ? { mood: req.body.mood } : {}),
        ...(req.body.library !== undefined ? { library: req.body.library } : {}),
        ...(req.body.profiles !== undefined ? { profiles: req.body.profiles } : {}),
        ...(req.body.versions !== undefined ? { versions: req.body.versions } : {}),
        ...(req.body.presentations !== undefined ? { presentations: req.body.presentations } : {}) }));
      await rename(temporary, manifestPath);
      res.set('Cache-Control', 'no-store').json({ ok: true });
    } catch (error) {
      console.error('Decoration save failed:', error);
      res.status(500).json({ error: 'No se pudo guardar la decoración' });
    }
  });
}
