// Cloudflare Realtime SFU signaling stays on this server. Never expose the App Secret to a viewer.
import crypto from 'node:crypto';

const sessions = new Map();
const authorizedViewers = new Map();
let publisher = null;
const publisherTimeout = 15_000;

function ready() {
  return Boolean(process.env.CLOUDFLARE_SFU_APP_ID && process.env.CLOUDFLARE_SFU_APP_SECRET);
}

function sessionDescription(value, type) {
  return value && value.type === type && typeof value.sdp === 'string' &&
    value.sdp.length > 100 && value.sdp.length < 64_000;
}

function equal(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length !== 0 && x.length === y.length && crypto.timingSafeEqual(x, y);
}

async function sfu(method, path, body) {
  if (!ready()) throw new Error('Cloudflare SFU no está configurado');
  const appId = encodeURIComponent(process.env.CLOUDFLARE_SFU_APP_ID);
  const response = await fetch(`https://rtc.live.cloudflare.com/v1/apps/${appId}${path}`, {
    method,
    headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_SFU_APP_SECRET}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(10_000),
  });
  const value = await response.json().catch(() => ({}));
  if (!response.ok || value.errorCode || value.tracks?.some((track) => track.errorCode)) {
    console.warn('Cloudflare SFU error:', response.status, value.errorCode || value.tracks?.find((track) => track.errorCode)?.errorCode);
    throw new Error('Cloudflare no pudo completar la conexión');
  }
  return value;
}

function sid(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{8,128}$/.test(value);
}

function sessionPath(id, suffix) {
  if (!sid(id)) throw new Error('Sesión inválida');
  return `/sessions/${encodeURIComponent(id)}${suffix}`;
}

function fail(res, error) {
  console.error('Cloudflare signaling:', error);
  res.status(502).json({ error: error instanceof Error ? error.message : 'Error de conexión' });
}

function activePublisher() {
  if (publisher && Date.now() - publisher.seen < publisherTimeout) return publisher;
  publisher = null;
  return null;
}

export function installCloudflare(app) {
  const publisherAuth = (req, res, next) => {
    if (!ready()) return res.status(503).json({ error: 'Cloudflare SFU no está configurado' });
    if (!equal(req.get('X-Stream-Key'), process.env.STREAM_KEY)) {
      return res.status(401).json({ error: 'Clave de transmisión incorrecta' });
    }
    next();
  };

  const viewerAuth = async (req, res, next) => {
    if (!ready()) return res.status(503).json({ error: 'Cloudflare SFU no está configurado' });
    const token = /^Bearer ([A-Za-z0-9._~-]+)$/.exec(req.get('Authorization') || '')?.[1];
    if (!token || !process.env.DISCORD_CLIENT_ID) return res.status(401).json({ error: 'Abre la actividad en Discord' });
    const cached = authorizedViewers.get(token);
    if (cached && cached.until > Date.now()) {
      req.viewerId = cached.id;
      return next();
    }
    try {
      const response = await fetch('https://discord.com/api/v10/oauth2/@me', {
        headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) return res.status(401).json({ error: 'Vuelve a autorizarte en Discord' });
      const info = await response.json();
      if (info.application?.id !== process.env.DISCORD_CLIENT_ID ||
          !info.scopes?.includes('identify') || !/^\d{15,22}$/.test(info.user?.id || '')) {
        return res.status(401).json({ error: 'Acceso de Discord no válido' });
      }
      req.viewerId = info.user.id;
      if (authorizedViewers.size > 100) authorizedViewers.clear();
      authorizedViewers.set(token, { id: info.user.id, until: Date.now() + 30_000 });
      next();
    } catch (error) { fail(res, error); }
  };

  app.post('/api/cloudflare/publisher/session', publisherAuth, async (_req, res) => {
    try {
      const result = await sfu('POST', '/sessions/new');
      if (!sid(result.sessionId)) throw new Error('Cloudflare no devolvió una sesión');
      res.json({ sessionId: result.sessionId });
    } catch (error) { fail(res, error); }
  });

  app.post('/api/cloudflare/publisher/publish', publisherAuth, async (req, res) => {
    const { sessionId, description, videoMid, audioMid } = req.body || {};
    if (!sid(sessionId) || !sessionDescription(description, 'offer') ||
        !/^\d{1,3}$/.test(videoMid || '') || !/^\d{1,3}$/.test(audioMid || '') ||
        videoMid === audioMid) return res.status(400).json({ error: 'Oferta inválida' });
    try {
      const result = await sfu('POST', sessionPath(sessionId, '/tracks/new'), {
        sessionDescription: description,
        tracks: [
          { location: 'local', mid: videoMid, trackName: 'screen' },
          { location: 'local', mid: audioMid, trackName: 'game-audio' },
        ],
      });
      if (!sessionDescription(result.sessionDescription, 'answer') ||
          !Array.isArray(result.tracks) || result.tracks.length !== 2) {
        throw new Error('Respuesta incompleta de Cloudflare');
      }
      publisher = { sessionId, seen: Date.now() };
      res.json({ description: result.sessionDescription });
    } catch (error) { fail(res, error); }
  });

  app.post('/api/cloudflare/publisher/heartbeat', publisherAuth, async (req, res) => {
    const sessionId = req.body?.sessionId;
    if (!sid(sessionId)) return res.status(400).json({ error: 'Sesión inválida' });
    try {
      if (publisher?.sessionId !== sessionId) {
        // Restore discovery if the web service restarted while the Switch kept streaming.
        const result = await sfu('GET', sessionPath(sessionId, ''));
        const active = result.tracks?.filter((track) => track.location === 'local' && track.status === 'active') || [];
        if (!active.some((track) => track.trackName === 'screen') ||
            !active.some((track) => track.trackName === 'game-audio')) {
          return res.status(409).json({ error: 'La sesión ya no transmite' });
        }
      }
      publisher = { sessionId, seen: Date.now() };
      res.json({ ok: true });
    } catch (error) { fail(res, error); }
  });

  app.post('/api/cloudflare/publisher/end', publisherAuth, (req, res) => {
    if (publisher?.sessionId === req.body?.sessionId) publisher = null;
    res.json({ ok: true });
  });

  app.get('/api/cloudflare/stream', viewerAuth, (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ sessionId: activePublisher()?.sessionId || null });
  });

  app.post('/api/cloudflare/viewer/session', viewerAuth, async (req, res) => {
    const source = activePublisher();
    if (!source) return res.status(409).json({ error: 'Esperando señal' });
    try {
      const result = await sfu('POST', '/sessions/new');
      if (!sid(result.sessionId)) throw new Error('Cloudflare no devolvió una sesión');
      if (sessions.size > 100) {
        for (const [id, item] of sessions) if (Date.now() - item.seen > 120_000) sessions.delete(id);
      }
      sessions.set(result.sessionId, { viewer: req.viewerId, source: source.sessionId, seen: Date.now() });
      res.json({ sessionId: result.sessionId, source: source.sessionId });
    } catch (error) { fail(res, error); }
  });

  const ownSession = (req, res, next) => {
    const state = sessions.get(req.body?.sessionId);
    if (!state || state.viewer !== req.viewerId || state.source !== activePublisher()?.sessionId ||
        Date.now() - state.seen > 120_000) {
      return res.status(403).json({ error: 'La sesión caducó' });
    }
    state.seen = Date.now();
    req.sfuSession = state;
    next();
  };

  app.post('/api/cloudflare/viewer/tracks', viewerAuth, ownSession, async (req, res) => {
    try {
      const result = await sfu('POST', sessionPath(req.body.sessionId, '/tracks/new'), {
        tracks: [
          { location: 'remote', sessionId: req.sfuSession.source, trackName: 'screen' },
          { location: 'remote', sessionId: req.sfuSession.source, trackName: 'game-audio' },
        ],
      });
      if (!sessionDescription(result.sessionDescription, 'offer') ||
          !Array.isArray(result.tracks) || result.tracks.length !== 2) {
        throw new Error('No se encontraron el video y el audio');
      }
      res.json({ description: result.sessionDescription, tracks: result.tracks });
    } catch (error) { fail(res, error); }
  });

  app.post('/api/cloudflare/viewer/answer', viewerAuth, ownSession, async (req, res) => {
    if (!sessionDescription(req.body?.description, 'answer')) return res.status(400).json({ error: 'Respuesta inválida' });
    try {
      await sfu('PUT', sessionPath(req.body.sessionId, '/renegotiate'), {
        sessionDescription: req.body.description,
      });
      res.json({ ok: true });
    } catch (error) { fail(res, error); }
  });
}
