// Cloudflare Realtime SFU viewer: only our Discord-authenticated backend can request media.
type Description = { type: 'offer' | 'answer'; sdp: string };
type TrackResult = { mid?: string; trackName?: string; errorCode?: string };
type TrackResponse = { description: Description; tracks: TrackResult[] };

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

export class CloudflareViewer {
  private pc: RTCPeerConnection | null = null;
  private source: string | null = null;
  private polling: ReturnType<typeof setInterval> | null = null;
  private connecting = false;
  private attemptAt = 0;
  private closed = false;
  private mids = new Map<string, 'video' | 'audio'>();

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
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }],
    });
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
      if (this.pc === pc && (pc.connectionState === 'failed' || pc.connectionState === 'closed')) this.reset();
    });
    try {
      const session = await this.request<{ sessionId: string; source: string }>('viewer/session', {});
      if (this.closed || this.pc !== pc || session.source !== source) return this.reset();
      const result = await this.request<TrackResponse>('viewer/tracks', { sessionId: session.sessionId });
      if (this.closed || this.pc !== pc) return;
      for (const track of result.tracks) {
        if (track.errorCode) throw new Error('No se pudo recibir una pista');
        if (track.mid && track.trackName === 'screen') this.mids.set(track.mid, 'video');
        if (track.mid && track.trackName === 'game-audio') this.mids.set(track.mid, 'audio');
      }
      if (this.mids.size !== 2) throw new Error('Falta video o audio');
      await pc.setRemoteDescription(result.description);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await gather(pc);
      if (this.closed || this.pc !== pc) return;
      await this.request('viewer/answer', { sessionId: session.sessionId, description: pc.localDescription });
    } catch (error) {
      if (this.pc === pc) this.reset();
      throw error;
    }
  }
}
