import 'dotenv/config';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import express from 'express';
import { installDecorations } from './decorations.mjs';
import { installCloudflare } from './cloudflare.mjs';
import { installActivityControls } from './activity-controls.mjs';

const app = express();
const port = Number(process.env.PORT || 3000);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, 'dist');

app.disable('x-powered-by');
app.use((_req,res,next)=>{res.set('Referrer-Policy','strict-origin-when-cross-origin');next();});

app.use('/api/decorations', express.json({ limit: '16mb' }));
app.use(express.json({ limit: '256kb' }));
installCloudflare(app, requireActivityTicket);
const activityControls=installActivityControls(app,requireActivityTicket,{editKey:process.env.DECORATION_EDIT_KEY || process.env.STREAM_KEY});
app.use('/api/decorations', requireActivityTicket);
installDecorations(app, {
  directory: process.env.DECORATION_DATA_DIR || path.join(__dirname, '.data', 'decorations'),
  editKey: process.env.DECORATION_EDIT_KEY || process.env.STREAM_KEY,
  rebuildRooms: false,
  hostAuthorized: activityControls.isHost,
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

function sameSecret(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  if (left.length !== right.length || left.length === 0) return false;
  return crypto.timingSafeEqual(left, right);
}

const entryTicketLifetime = 6 * 60 * 60_000;

function activityTicket() {
  const payload = Buffer.from(JSON.stringify({ expires: Date.now() + entryTicketLifetime, nonce: crypto.randomUUID() })).toString('base64url');
  const signature = crypto.createHmac('sha256', required('DISCORD_CLIENT_SECRET'))
    .update(`shis-activity:${payload}`).digest('base64url');
  return `${payload}.${signature}`;
}

function validActivityTicket(value) {
  if (typeof value !== 'string' || value.length > 512) return false;
  const [payload, signature, extra] = value.split('.');
  if (!payload || !signature || extra || !process.env.DISCORD_CLIENT_SECRET) return false;
  const expected = crypto.createHmac('sha256', process.env.DISCORD_CLIENT_SECRET)
    .update(`shis-activity:${payload}`).digest('base64url');
  if (!sameSecret(signature, expected)) return false;
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return Number.isSafeInteger(decoded.expires) && decoded.expires > Date.now() &&
      decoded.expires <= Date.now() + entryTicketLifetime && typeof decoded.nonce === 'string';
  } catch { return false; }
}

function requireActivityTicket(req, res, next) {
  if (validActivityTicket(req.get('X-Activity-Ticket') || req.query.ticket)) return next();
  res.set('Cache-Control', 'no-store').status(401).json({ error: 'Abre Shis Stream desde Discord' });
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'shis-stream', streamProvider: 'cloudflare' });
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
    res.set('Cache-Control', 'no-store').json({ access_token: token.access_token, ticket: activityTicket() });
  } catch (error) {
    console.error('Discord token exchange failed:', error);
    res.status(502).json({ error: 'No se pudo autorizar con Discord' });
  }
});

if (existsSync(distDir)) {
  const serveActivityEntry = async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (validActivityTicket(req.query.ticket)) {
      const html = await readFile(path.join(distDir, 'index.html'), 'utf8');
      return res.type('html').send(html);
    }
    if (typeof req.query.frame_id === 'string' || typeof req.query.instance_id === 'string') {
      return res.sendFile(path.join(distDir, 'gate.html'));
    }
    return res.status(403).type('text/plain').send('Abre Shis Stream desde la actividad de Discord.');
  };
  app.get(['/', '/index.html', '/gate.html'], serveActivityEntry);
  app.use(express.static(distDir, { index: false, maxAge: '1h', setHeaders(res, file) {
    if (!file.includes(`${path.sep}assets${path.sep}`)) res.set('Cache-Control', 'no-cache');
  } }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
    return serveActivityEntry(req, res).catch(next);
  });
}

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.status(404).send('Run npm run build first.');
});

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`SHIS Stream Activity listening on :${port} (Cloudflare SFU)`);
});

process.once('SIGTERM', () => {
  server.close(() => {
    console.log('SHIS Stream Activity stopped');
  });
});
