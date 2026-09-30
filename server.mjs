import 'dotenv/config';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import express from 'express';
import { AccessToken } from 'livekit-server-sdk';
import { installDecorations } from './decorations.mjs';

const app = express();
const port = Number(process.env.PORT || 3000);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, 'dist');

app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));
installDecorations(app, {
  directory: process.env.DECORATION_DATA_DIR || path.join(__dirname, '.data', 'decorations'),
  editKey: process.env.DECORATION_EDIT_KEY || process.env.STREAM_KEY,
});

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function normalizeStream(value) {
  const stream = String(value || process.env.DEFAULT_STREAM || 'cris')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .slice(0, 48);
  return stream || 'cris';
}

function roomFor(stream) {
  return `shis-${normalizeStream(stream)}`;
}

function sameSecret(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  if (left.length !== right.length || left.length === 0) return false;
  return crypto.timingSafeEqual(left, right);
}

async function mintToken({ roomName, identity, publish, subscribe, ttl = '6h' }) {
  const apiKey = required('LIVEKIT_API_KEY');
  const apiSecret = required('LIVEKIT_API_SECRET');
  const token = new AccessToken(apiKey, apiSecret, { identity, ttl });
  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: publish,
    canSubscribe: subscribe,
    canPublishData: false,
  });
  return token.toJwt();
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'shis-stream' });
});

app.get('/api/config', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({
    discordClientId: process.env.DISCORD_CLIENT_ID || '',
    discordAuthAvailable: Boolean(process.env.DISCORD_CLIENT_SECRET),
    defaultStream: normalizeStream(process.env.DEFAULT_STREAM || 'cris'),
  });
});

app.post('/api/discord-token', async (req, res) => {
  const code = req.body?.code;
  if (typeof code !== 'string' || code.length < 10 || code.length > 512 || /\s/.test(code)) {
    return res.status(400).json({ error: 'Código de autorización inválido' });
  }
  if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET) {
    return res.status(503).json({ error: 'Autorización de Discord sin configurar' });
  }
  try {
    const response = await fetch('https://discord.com/api/v10/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
      }),
      signal: AbortSignal.timeout(10000),
    });
    const token = await response.json();
    if (!response.ok || typeof token.access_token !== 'string') {
      const reason = ['invalid_client', 'invalid_grant', 'invalid_request', 'unauthorized_client']
        .includes(token?.error) ? token.error : `HTTP ${response.status}`;
      console.warn('Discord OAuth rechazado:', response.status, reason);
      return res.status(502).json({ error: `Discord no aceptó la autorización (${reason})` });
    }
    res.set('Cache-Control', 'no-store').json({ access_token: token.access_token });
  } catch (error) {
    console.error('Discord token exchange failed:', error);
    res.status(502).json({ error: 'No se pudo autorizar con Discord' });
  }
});

app.get('/api/publisher-token', async (req, res) => {
  try {
    const configuredKey = required('STREAM_KEY');
    if (!sameSecret(req.get('X-Stream-Key'), configuredKey)) {
      return res.status(401).json({ error: 'Clave de transmisión incorrecta' });
    }

    const stream = normalizeStream(req.query.stream);
    const roomName = roomFor(stream);
    const token = await mintToken({
      roomName,
      identity: `switch-${crypto.randomUUID()}`,
      publish: true,
      subscribe: false,
    });

    res.set('Cache-Control', 'no-store');
    res.json({ serverUrl: required('LIVEKIT_URL'), token, roomName });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Server error' });
  }
});

app.get('/api/viewer-token', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET) {
    return res.status(503).json({ error: 'La autorización de Discord no está configurada' });
  }
  const authorization = req.get('Authorization') || '';
  const accessToken = /^Bearer ([A-Za-z0-9._~-]+)$/.exec(authorization)?.[1];
  if (!accessToken) return res.status(401).json({ error: 'Abre la actividad en Discord para ver la transmisión' });
  try {
    // Verify the viewer with Discord on the server. URL parameters, iframe
    // headers and the client-side SDK alone are not proof of identity.
    const profileResponse = await fetch('https://discord.com/api/v10/oauth2/@me', {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!profileResponse.ok) {
      return res.status(401).json({ error: 'La autorización de Discord caducó; vuelve a entrar a la actividad' });
    }
    const authorizationInfo = await profileResponse.json();
    if (authorizationInfo.application?.id !== process.env.DISCORD_CLIENT_ID ||
        !authorizationInfo.scopes?.includes('identify') ||
        typeof authorizationInfo.user?.id !== 'string' ||
        !/^\d{15,22}$/.test(authorizationInfo.user.id)) {
      return res.status(401).json({ error: 'No se pudo verificar tu perfil de Discord' });
    }
    // Viewers cannot create arbitrary LiveKit rooms by changing the URL.
    const stream = normalizeStream(process.env.DEFAULT_STREAM || 'cris');
    const roomName = roomFor(stream);
    const token = await mintToken({
      roomName,
      identity: `viewer-${crypto.randomUUID()}`,
      publish: false,
      subscribe: true,
      ttl: '2m',
    });

    res.json({ serverUrl: required('LIVEKIT_URL'), token, roomName });
  } catch (error) {
    console.error('Viewer authorization failed:', error);
    res.status(502).json({ error: 'No se pudo verificar el acceso con Discord' });
  }
});

if (existsSync(distDir)) {
  app.use(express.static(distDir, { index: false, maxAge: '1h' }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.status(404).send('Run npm run build first.');
});

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`SHIS Stream Activity listening on :${port}`);
});

process.once('SIGTERM', () => {
  server.close(() => {
    console.log('SHIS Stream Activity stopped');
  });
});
