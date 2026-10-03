// Cloudflare Realtime SFU viewer: only our Discord-authenticated backend can request media.
type Description = { type: 'offer' | 'answer'; sdp: string };
type TrackResult = { mid?: string; trackName?: string; errorCode?: string };
type TrackResponse = { description: Description; tracks: TrackResult[] };
type LegacyRtcGlobal = typeof globalThis & { webkitRTCPeerConnection?: typeof RTCPeerConnection };

async function gather(pc: RTCPeerConnection) {
  if (pc.iceGatheringState === 'complete') return;
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => { cleanup(); reject(new Error('Tiempo de conexión agotado')); }, 8000);
    const changed = () => { if (pc.iceGatheringState === 'complete') { cleanup(); resolve(); } };
    const cleanup = () => { clearTimeout(timeout); pc.removeEventListener('icegatheringstatechange', changed); };
    pc.addEventListener('icegatheringstatechange', changed);
    changed();
  });
}

function createPeerConnection() {
  const standard = typeof RTCPeerConnection === 'function' ? RTCPeerConnection : undefined;
  const legacy = (globalThis as LegacyRtcGlobal).webkitRTCPeerConnection;
  const PeerConnection = standard || legacy;
  if (!PeerConnection) throw new Error('WebRTC no está disponible en esta vista de Discord');

  try {
    return new PeerConnection({
      iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }],
    });
  } catch {
    // Algunos Android WebView rechazan una configuración ICE durante el
    // constructor aunque sí permitan crear la conexión. El SFU puede seguir
    // negociando con los candidatos que entregue el navegador.
    return new PeerConnection();
  }
}

function diagnosticKind(error: unknown) {
  const name = error instanceof DOMException ? error.name : error instanceof Error ? error.name : 'error';
  const message = error instanceof Error ? error.message : String(error || '');
  if (/WebRTC no está disponible|RTCPeerConnection.*not defined|unsupported/i.test(message)) return 'rtc-unavailable';
  if (/stun|turn|ice|peerconnection|construct/i.test(message)) return 'rtc-or-ice';
  return name.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 32) || 'error';
}

export class CloudflareViewer {
  private pc: RTCPeerConnection | null = null;
  private source: string | null = null;
  private polling: ReturnType<typeof setInterval> | null = null;
  private connecting = false;
  private attemptAt = 0;
  private closed = false;
  private mids = new Map<string, 'video' | 'audio'>();
  private lastDiagnostic = '';

  constructor(
    private readonly accessToken: () => string,
    private readonly onTrack: (kind: 'video' | 'audio', track: MediaStreamTrack) => void,
    private readonly onSignalLost: () => void,
    private readonly onError: (error: unknown) => void,
  ) {}

  private async request<T>(route: string, body?: object): Promise<T> {
    const response = await fetch(`/api/cloudflare/${route}`, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${this.accessToken()}`,
        'X-Activity-Ticket': new URLSearchParams(location.search).get('ticket') || '', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: 'no-store',
    });
    const value = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(value.error || `HTTP ${response.status}`);
    return value as T;
  }

  private reportDiagnostic(stage: string, error: unknown) {
    const rtc = typeof RTCPeerConnection === 'function' ? 'standard' :
      typeof (globalThis as LegacyRtcGlobal).webkitRTCPeerConnection === 'function' ? 'webkit' : 'none';
    const key = `${stage}-${rtc}-${diagnosticKind(error)}`.replace(/[^a-z0-9_-]/gi, '-').slice(0, 96);
    if (key === this.lastDiagnostic) return;
    this.lastDiagnostic = key;
    // Deliberadamente termina en 404: Railway registra la ruta y con ella el
    // paso que falló, sin enviar SDP, tokens, IDs de usuario ni secretos.
    void fetch(`/api/cloudflare/client-diagnostic/${key}`, {
      headers: { 'X-Activity-Ticket': new URLSearchParams(location.search).get('ticket') || '' },
      cache: 'no-store',
    }).catch(() => {});
  }

  async start() {
    this.closed = false;
    this.polling = setInterval(() => { if (!this.closed && !document.hidden) void this.poll().catch(this.onError); }, 3000);
    document.addEventListener('visibilitychange', this.visible);
    await this.poll();
  }

  private visible = () => {
    if (!document.hidden && !this.closed) void this.poll().catch(this.onError);
  };

  stop() {
    this.closed = true;
    if (this.polling) clearInterval(this.polling);
    this.polling = null;
    document.removeEventListener('visibilitychange', this.visible);
    this.reset();
  }

  private reset() {
    this.pc?.close();
    this.pc = null;
    this.source = null;
    this.mids.clear();
    this.onSignalLost();
  }

  private async poll() {
    if (this.connecting || this.closed) return;
    this.connecting = true;
    try {
      const status = await this.request<{ sessionId: string | null }>('stream');
      if (this.closed) return;
      if (!status.sessionId) {
        if (this.source) this.reset();
        return;
      }
      if (status.sessionId === this.source && this.pc &&
          (this.pc.connectionState === 'connected' ||
            (this.pc.connectionState !== 'failed' && Date.now() - this.attemptAt < 20_000))) return;
      if (this.source) this.reset();
      await this.connect(status.sessionId);
    } finally { this.connecting = false; }
  }

  private async connect(source: string) {
    let stage = 'peer';
    let pc: RTCPeerConnection;
    try {
      pc = createPeerConnection();
    } catch (error) {
      this.reportDiagnostic(stage, error);
      throw error;
    }
    this.pc = pc;
    this.source = source;
    this.attemptAt = Date.now();
    pc.addEventListener('track', (event) => {
      if (this.closed || this.pc !== pc) return;
      const kind = this.mids.get(event.transceiver.mid || '');
      if (kind) this.onTrack(kind, event.track);
      event.track.addEventListener('ended', () => { if (this.pc === pc) this.reset(); }, { once: true });
    });
    pc.addEventListener('connectionstatechange', () => {
      if (this.pc !== pc) return;
      if (pc.connectionState === 'failed') {
        this.reportDiagnostic('connection-state', new Error('PeerConnection failed'));
        this.reset();
      } else if (pc.connectionState === 'closed') this.reset();
    });
    try {
      stage = 'viewer-session';
      const session = await this.request<{ sessionId: string; source: string }>('viewer/session', {});
      if (this.closed || this.pc !== pc || session.source !== source) return this.reset();
      stage = 'viewer-tracks';
      const result = await this.request<TrackResponse>('viewer/tracks', { sessionId: session.sessionId });
      if (this.closed || this.pc !== pc) return;
      for (const track of result.tracks) {
        if (track.errorCode) throw new Error('No se pudo recibir una pista');
        if (track.mid && track.trackName === 'screen') this.mids.set(track.mid, 'video');
        if (track.mid && track.trackName === 'game-audio') this.mids.set(track.mid, 'audio');
      }
      if (this.mids.size !== 2) throw new Error('Falta video o audio');
      stage = 'remote-description';
      await pc.setRemoteDescription(result.description);
      stage = 'create-answer';
      const answer = await pc.createAnswer();
      stage = 'local-description';
      await pc.setLocalDescription(answer);
      stage = 'ice-gathering';
      await gather(pc);
      if (this.closed || this.pc !== pc) return;
      stage = 'renegotiate';
      await this.request('viewer/answer', { sessionId: session.sessionId, description: pc.localDescription });
      this.lastDiagnostic = '';
    } catch (error) {
      this.reportDiagnostic(stage, error);
      if (this.pc === pc) this.reset();
      throw error;
    }
  }
}
