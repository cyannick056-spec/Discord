import crypto from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import express from 'express';

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
  if (!input || !Array.isArray(input.items) || input.items.length > 65) return false;
  const ids = new Set();
  let decorations = 0;
  return input.items.every((item) => {
    const slot = item?.kind === 'viewer-slot';
    if (!slot) decorations++;
    if (!item || typeof item.id !== 'string' ||
        (slot ? !viewerSlotIds.has(item.id) : !/^[a-f0-9-]{36}$/.test(item.id)) ||
        decorations > 60 || ids.has(item.id) ||
        (!slot && (typeof item.asset !== 'string' || !assetPattern.test(item.asset))) ||
        typeof item.name !== 'string' || item.name.length > 70 ||
        !item.placements || typeof item.placements !== 'object') return false;
    ids.add(item.id);
    return Object.entries(item.placements).every(([view, p]) =>
      views.has(view) && p &&
      inRange(p.x, -30, 130) && inRange(p.y, -35, 145) &&
      inRange(p.width, 1, 80) && inRange(p.rotation, -180, 180) &&
      inRange(p.opacity, 0, 1) && inRange(p.z, 0, 99) &&
      typeof p.hidden === 'boolean' &&
      (p.anchor === undefined || p.anchor === 'scene' || p.anchor === 'frame') &&
      (p.brightness === undefined || inRange(p.brightness, 35, 130)) &&
      (p.saturation === undefined || inRange(p.saturation, 0, 150)) &&
      (p.hue === undefined || inRange(p.hue, -60, 60)) &&
      (p.shadow === undefined || inRange(p.shadow, 0, 100)));
  });
}

export function installDecorations(app, { directory, editKey }) {
  const assetsDir = path.join(directory, 'assets');
  const manifestPath = path.join(directory, 'manifest.json');
  const blank = { items: [] };

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
    try {
      await mkdir(directory, { recursive: true });
      const temporary = path.join(directory, `manifest-${crypto.randomUUID()}.tmp`);
      await writeFile(temporary, JSON.stringify({ items: req.body.items }));
      await rename(temporary, manifestPath);
      res.set('Cache-Control', 'no-store').json({ ok: true });
    } catch (error) {
      console.error('Decoration save failed:', error);
      res.status(500).json({ error: 'No se pudo guardar la decoración' });
    }
  });
}
