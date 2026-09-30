import { DiscordSDK, Events, RPCCloseCodes, type Types } from '@discord/embedded-app-sdk';
import { Room, RoomEvent, Track, type RemoteTrack } from 'livekit-client';
import { initDecorations, setDecorationViewers } from './decorations';
import { CloudflareViewer } from './cloudflare';
import { initRoomLighting } from './lighting';
import './style.css';
import './scenes.css';

type AppConfig = {
  discordClientId: string;
  discordAuthAvailable: boolean;
  defaultStream: string;
  streamProvider: 'livekit' | 'cloudflare';
};

type ViewerCredentials = {
  serverUrl: string;
  token: string;
  roomName: string;
};

const statusText = document.querySelector<HTMLSpanElement>('#statusText')!;
const roomText = document.querySelector<HTMLSpanElement>('#roomText')!;
const liveBadge = document.querySelector<HTMLSpanElement>('#liveBadge')!;
const videoMount = document.querySelector<HTMLDivElement>('#videoMount')!;
const audioMount = document.querySelector<HTMLDivElement>('#audioMount')!;
const emptyState = document.querySelector<HTMLDivElement>('#emptyState')!;
const staticNoise = document.querySelector<HTMLCanvasElement>('#staticNoise')!;
const signalSweep = document.querySelector<HTMLCanvasElement>('#signalSweep')!;
const audioButton = document.querySelector<HTMLButtonElement>('#audioButton')!;
const retryButton = document.querySelector<HTMLButtonElement>('#retryButton')!;
const tvScene = document.querySelector<HTMLDivElement>('#tvScene')!;
const aspectButton = document.querySelector<HTMLButtonElement>('#aspectButton')!;
const exitButton = document.querySelector<HTMLButtonElement>('#exitButton')!;
const stage = document.querySelector<HTMLElement>('#stage')!;
const player = document.querySelector<HTMLElement>('#player')!;
const homeScreenMount = document.querySelector<HTMLDivElement>('#homeScreenMount')!;
const arcadeScene = document.querySelector<HTMLDivElement>('#arcadeScene')!;
const arcadeScreen = document.querySelector<HTMLDivElement>('#arcadeScreen')!;
const modeButton = document.querySelector<HTMLButtonElement>('#modeButton')!;
const filterButton = document.querySelector<HTMLButtonElement>('#filterButton')!;
const settingsControl = document.querySelector<HTMLDivElement>('#settingsControl')!;
const settingsButton = document.querySelector<HTMLButtonElement>('#settingsButton')!;
const settingsPanel = document.querySelector<HTMLDivElement>('#settingsPanel')!;
const smoothingButton = document.querySelector<HTMLButtonElement>('#smoothingButton')!;
const viewerStatus = document.querySelector<HTMLSpanElement>('#viewerStatus')!;
const viewerRetry = document.querySelector<HTMLButtonElement>('#viewerRetry')!;
const volumeControl = document.querySelector<HTMLDivElement>('#volumeControl')!;
const volumeButton = document.querySelector<HTMLButtonElement>('#volumeButton')!;
const volumePanel = document.querySelector<HTMLDivElement>('#volumePanel')!;
const volumeSlider = document.querySelector<HTMLInputElement>('#volumeSlider')!;
const volumeValue = document.querySelector<HTMLOutputElement>('#volumeValue')!;

let room: Room | null = null;
let cloudflareViewer: CloudflareViewer | null = null;
let config: AppConfig | null = null;
let discordSdk: DiscordSDK | null = null;
let discordAccessToken = '';
let retryDiscordAuthorization: (() => Promise<void>) | null = null;
let participantOrder: string[] = [];
let signalLostTimer: ReturnType<typeof setTimeout> | null = null;
let activeVideoTrack: RemoteTrack | null = null;
let activeVideoPublisherId: string | null = null;
let activeVideoElement: HTMLVideoElement | null = null;
let lastDecodedFrameAt = 0;
let videoStalled = false;
const editorPreviewMode = new URLSearchParams(location.search).has('editorPreview');

type AspectMode = '16:9' | '4:3';
let aspectMode: AspectMode = '16:9';
try {
  if (localStorage.getItem('shis-tv-aspect') === '4:3') aspectMode = '4:3';
} catch { /* Embedded browsers may deny storage. */ }
if (editorPreviewMode) aspectMode = new URLSearchParams(location.search).get('aspect') === '4:3' ? '4:3' : '16:9';

function setAspect(mode: AspectMode) {
  aspectMode = mode;
  tvScene.classList.toggle('aspect-4x3', mode === '4:3');
  aspectButton.textContent = mode;
  aspectButton.setAttribute('aria-label', `Cambiar proporción de la TV a ${mode === '4:3' ? '16:9' : '4:3'}`);
  if (!editorPreviewMode) try { localStorage.setItem('shis-tv-aspect', mode); } catch { /* Session-only fallback. */ }
  window.dispatchEvent(new Event('shis-aspect-change'));
}
setAspect(aspectMode);

type SceneMode = 'home' | 'arcade';
let sceneMode: SceneMode = 'home';
try {
  if (localStorage.getItem('shis-scene') === 'arcade') sceneMode = 'arcade';
} catch { /* Session-only fallback. */ }
if (editorPreviewMode) sceneMode = new URLSearchParams(location.search).get('scene') === 'arcade' ? 'arcade' : 'home';

function setScene(mode: SceneMode) {
  sceneMode = mode;
  stage.classList.toggle('home-mode', mode === 'home');
  stage.classList.toggle('arcade-mode', mode === 'arcade');
  arcadeScene.hidden = mode !== 'arcade';
  aspectButton.hidden = mode === 'arcade';
  volumePanel.hidden = true;
  volumeButton.setAttribute('aria-expanded', 'false');
  (mode === 'arcade' ? arcadeScreen : homeScreenMount).appendChild(player);
  modeButton.textContent = mode === 'arcade' ? 'Casa' : 'Arcade';
  modeButton.setAttribute('aria-label', mode === 'arcade' ? 'Cambiar a modo casa' : 'Cambiar a modo arcade');
  videoMount.querySelector('video')?.play().catch(() => {});
  window.dispatchEvent(new Event('shis-scene-change'));
  if (!editorPreviewMode) try { localStorage.setItem('shis-scene', mode); } catch { /* Session-only fallback. */ }
}
setScene(sceneMode);

type RetroLevel = 'off' | 'normal' | 'immersive' | 'scanlines';
let retroLevel: RetroLevel = 'immersive';
let smoothing = true;
let volume = 100;
try {
  const storedVolume = Number(localStorage.getItem('shis-volume'));
  if (localStorage.getItem('shis-volume') !== null && Number.isFinite(storedVolume)) {
    volume = Math.max(0, Math.min(100, storedVolume));
  }
} catch { /* Session-only fallback. */ }

function setRetroLevel(level: RetroLevel) {
  retroLevel = level;
  stage.classList.toggle('retro-strong', level === 'normal');
  stage.classList.toggle('retro-immersive', level === 'immersive');
  stage.classList.toggle('retro-scanlines', level === 'scanlines');
  filterButton.dataset.level = level;
  filterButton.setAttribute('aria-pressed', String(level !== 'off'));
  const names: Record<RetroLevel, string> = {
    off: 'apagado', normal: 'normal', immersive: 'inmersivo', scanlines: 'barrido',
  };
  filterButton.textContent = `Retro ${names[level]}`;
  const next: Record<RetroLevel, RetroLevel> = {
    off: 'normal', normal: 'immersive', immersive: 'scanlines', scanlines: 'off',
  };
  filterButton.setAttribute('aria-label', `Retro ${names[level]}; cambiar a ${names[next[level]]}`);
  filterButton.title = `Retro: ${names[level]}. Pulsar para ${names[next[level]]}`;
}
setRetroLevel(retroLevel);

function setSmoothing(enabled: boolean) {
  smoothing = enabled;
  stage.classList.toggle('edge-smoothing', enabled);
  smoothingButton.setAttribute('aria-pressed', String(enabled));
  smoothingButton.setAttribute('aria-label', enabled ? 'Desactivar suavizado de bordes' : 'Activar suavizado de bordes');
  smoothingButton.title = enabled ? 'Suavizado activado: pulsar para comparar' : 'Suavizar bordes dentados';
}
setSmoothing(smoothing);

function setVolume(value: number) {
  volume = Math.max(0, Math.min(100, value));
  volumeSlider.value = String(volume);
  volumeValue.value = `${volume}%`;
  volumeButton.dataset.muted = String(volume === 0);
  volumeButton.title = `Volumen: ${volume}%`;
  audioMount.querySelectorAll('audio').forEach((element) => { element.volume = volume / 100; });
  try { localStorage.setItem('shis-volume', String(volume)); } catch { /* Session-only fallback. */ }
}
setVolume(volume);

function isInsideDiscord() {
  const params = new URLSearchParams(window.location.search);
  return params.has('frame_id') || params.has('instance_id');
}

function setStatus(text: string) {
  statusText.textContent = text;
}

function setLive(isLive: boolean) {
  if (isLive && signalLostTimer) {
    clearTimeout(signalLostTimer);
    signalLostTimer = null;
  }
  liveBadge.textContent = isLive ? 'PLAY' : 'STANDBY';
  liveBadge.classList.toggle('live', isLive);
  stage.classList.toggle('has-signal', isLive);
  emptyState.style.display = isLive ? 'none' : 'flex';
}

function signalLost() {
  if (signalLostTimer) clearTimeout(signalLostTimer);
  setLive(false);
  setStatus('SEÑAL PERDIDA');
  signalLostTimer = setTimeout(() => {
    signalLostTimer = null;
    if (!stage.classList.contains('has-signal')) setStatus('ESPERANDO SEÑAL…');
  }, 2000);
}

const noiseContext = staticNoise.getContext('2d', { alpha: false });
const noiseFrame = noiseContext?.createImageData(staticNoise.width, staticNoise.height);
const sweepContext = signalSweep.getContext('2d');
const sweepFrame = sweepContext?.createImageData(signalSweep.width, signalSweep.height);
let noiseSeed = 0x6a09e667;
function nextNoise() {
  noiseSeed ^= noiseSeed << 13;
  noiseSeed ^= noiseSeed >>> 17;
  noiseSeed ^= noiseSeed << 5;
  return noiseSeed & 255;
}
function drawSignalSweeps(now: number) {
  if (!sweepContext || !sweepFrame) return;
  const { width, height } = signalSweep;
  const data = sweepFrame.data;
  data.fill(0);
  // Exactly the thin moving grain band from the no-signal canvas. The wider
  // sweep uses that screen's CSS signalRoll animation and its 4.8s period.
  const band = Math.floor((now / 31) % height);
  for (let y = Math.max(0, band - 2); y < Math.min(height, band + 3); y++) {
    const strength = 1 - Math.abs(y - band) / 3;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const grain = nextNoise() / 255;
      data[i] = 205;
      data[i + 1] = 222;
      data[i + 2] = 241;
      data[i + 3] = Math.round(22 * strength * (.5 + grain));
    }
  }
  sweepContext.putImageData(sweepFrame, 0, 0);
}
function drawStatic(now: number) {
  if (noiseContext && noiseFrame && !stage.classList.contains('has-signal')) {
    const width = staticNoise.width;
    const band = Math.floor((now / 31) % staticNoise.height);
    for (let i = 0; i < noiseFrame.data.length; i += 4) {
      const value = nextNoise();
      const y = Math.floor(i / 4 / width);
      const grain = Math.min(255, value + (Math.abs(y - band) < 3 ? 35 : 0));
      noiseFrame.data[i] = grain;
      noiseFrame.data[i + 1] = grain;
      noiseFrame.data[i + 2] = Math.min(255, grain + 3);
      noiseFrame.data[i + 3] = 255;
    }
    noiseContext.putImageData(noiseFrame, 0, 0);
  }
  if (stage.classList.contains('has-signal') && stage.classList.contains('retro-scanlines')) {
    drawSignalSweeps(now);
  }
  setTimeout(() => drawStatic(performance.now()), 42);
}
drawStatic(performance.now());

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
  return body as T;
}

async function initDiscord(clientId: string) {
  if (!isInsideDiscord() || !clientId) {
    throw new Error('Abre Shis Stream desde la actividad de Discord');
  }

  type AuthUser = Awaited<ReturnType<DiscordSDK['commands']['authenticate']>>['user'];
  const gateSession = (window as Window & { __shisDiscordSession?: {
    sdk: DiscordSDK; user: AuthUser; accessToken: string;
  } }).__shisDiscordSession;
  discordSdk = gateSession?.sdk ?? new DiscordSDK(clientId);
  await discordSdk.ready();
  exitButton.hidden = false;
  type Participant = Types.GetActivityInstanceConnectedParticipantsResponse['participants'][number];
  const avatarUrl = (user: Participant) => user.avatar ?
    `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128` :
    `https://cdn.discordapp.com/embed/avatars/${(BigInt(user.id) >> 22n) % 6n}.png`;
  let activityPeople: Participant[] = [];
  let selfUser: Participant | null = null;
  let activityOk = false;
  let rosterRevision = 0;
  let authState = config?.discordAuthAvailable ? '…' : 'sin clave';
  let authProblem = '';
  let authInFlight = false;
  if (gateSession) {
    discordAccessToken = gateSession.accessToken;
    selfUser = { ...gateSession.user, bot: false, flags: gateSession.user.public_flags };
    authState = 'sí';
  }
  const showParticipants = () => {
    // A voice call can outlive the Activity. Only its instance roster belongs
    // on the TV; the authenticated local viewer covers mobile roster gaps.
    const byId = new Map<string, Participant>();
    for (const person of [...activityPeople, ...(selfUser ? [selfUser] : [])]) {
      if (!person.bot && !byId.has(person.id)) byId.set(person.id, person);
    }
    const people = [...byId.values()];
    const present = new Set(people.map((person) => person.id));
    participantOrder = participantOrder.filter((id) => present.has(id));
    for (const person of people) if (!participantOrder.includes(person.id)) participantOrder.push(person.id);
    setDecorationViewers(participantOrder.map((id) => byId.get(id)!).filter(Boolean).map((person) => ({
      id: person.id, name: person.nickname || person.global_name || person.username, avatar: avatarUrl(person),
    })));
    const connection = authState === 'sin clave' ? 'Falta clave de Discord' :
      authState === '×' ? `Acceso falló: ${authProblem}` :
      authState === '…' ? 'Conectando…' :
      activityOk ? 'Conectado' : 'Lista no disponible';
    viewerStatus.textContent = `${people.length} espectador${people.length === 1 ? '' : 'es'} · ${connection}`;
    viewerStatus.title = `En esta Activity: ${activityOk ? activityPeople.length : 'lista no disponible'}.`;
    viewerRetry.hidden = authState !== '×';
  };
  // The gate already verified this viewer; show their avatar even while the
  // Activity roster is still being requested from Discord.
  showParticipants();
  const onActivityUpdate = ({ participants }: Types.GetActivityInstanceConnectedParticipantsResponse) => {
    activityOk = true;
    rosterRevision++;
    activityPeople = participants.filter((person) => !person.bot);
    showParticipants();
  };
  const authenticateDiscord = async () => {
    if (authInFlight) return;
    authInFlight = true;
    viewerRetry.disabled = true;
    authState = '…';
    showParticipants();
    let step = 'permiso de Discord';
    try {
      let accessToken = '';
      try { accessToken = sessionStorage.getItem('shis-discord-access') || ''; } catch { /* Retry OAuth. */ }
      step = 'lectura del perfil';
      let auth;
      if (accessToken) {
        try { auth = await discordSdk!.commands.authenticate({ access_token: accessToken }); }
        catch {
          accessToken = '';
          try { sessionStorage.removeItem('shis-discord-access'); } catch { /* No storage. */ }
        }
      }
      if (!accessToken) {
        step = 'permiso de Discord';
        const { code } = await discordSdk!.commands.authorize({
          client_id: clientId, response_type: 'code', scope: ['identify'], prompt: 'none', state: '',
        });
        step = 'canje del código';
        const response = await fetch('/api/discord-token', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }),
        });
        const body = await response.json() as { access_token?: string; error?: string };
        if (!response.ok || !body.access_token) throw new Error(body.error || 'Discord rechazó el acceso');
        accessToken = body.access_token;
        step = 'lectura del perfil';
        auth = await discordSdk!.commands.authenticate({ access_token: accessToken });
        try { sessionStorage.setItem('shis-discord-access', accessToken); } catch { /* Session only. */ }
      }
      discordAccessToken = accessToken;
      selfUser = { ...auth!.user, bot: false, flags: auth!.user.public_flags };
      authState = 'sí';
      showParticipants();
      void refreshParticipants();
    } catch (error) {
      discordAccessToken = '';
      try { sessionStorage.removeItem('shis-discord-access'); } catch { /* No storage. */ }
      authState = '×';
      const rpcError = error && typeof error === 'object' ? error as { code?: unknown; message?: unknown } : null;
      const code = typeof rpcError?.code === 'number' ? String(rpcError.code) : '';
      const message = typeof rpcError?.message === 'string' ? rpcError.message.replace(/\s+/g, ' ').slice(0, 70) :
        error instanceof Error ? error.message.replace(/\s+/g, ' ').slice(0, 70) : '';
      authProblem = `${step}${code ? ` (${code})` : ''}${message ? `: ${message}` : ''}`;
      showParticipants();
      console.warn(`No se pudo autorizar el perfil de Discord (${step}):`, error);
    } finally {
      authInFlight = false;
      viewerRetry.disabled = false;
    }
  };
  retryDiscordAuthorization = authenticateDiscord;
  viewerRetry.addEventListener('click', () => {
    void authenticateDiscord().then(() => {
      if (discordAccessToken && config && !room && !cloudflareViewer) void connectViewer(config.defaultStream).catch(showConnectionError);
    });
  });
  let refreshInFlight = false;
  const refreshParticipants = async () => {
    if (refreshInFlight) return;
    refreshInFlight = true;
    const startedRevision = rosterRevision;
    try {
      const activity = await discordSdk!.commands.getActivityInstanceConnectedParticipants();
      activityOk = true;
      // An event received during this request is newer than its snapshot.
      if (startedRevision === rosterRevision) {
        activityPeople = activity.participants.filter((person) => !person.bot);
      }
    } catch (error) {
      if (startedRevision === rosterRevision) {
        activityOk = false;
        activityPeople = [];
      }
      console.warn('No se pudo consultar la Activity:', error);
    }
    showParticipants();
    refreshInFlight = false;
  };
  // A client may not support the update event. The initial query and periodic
  // refresh still work independently of that subscription.
  void discordSdk.subscribe(Events.ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE, onActivityUpdate)
    .catch((error) => console.warn('No se pudo seguir cambios de participantes:', error));
  void refreshParticipants();
  if (!config?.discordAuthAvailable) throw new Error('Falta configurar la autorización de Discord');
  if (!discordAccessToken) await authenticateDiscord();
  if (!discordAccessToken) throw new Error('Autoriza tu perfil en Discord para ver la transmisión');
  setInterval(() => { if (!document.hidden) void refreshParticipants(); }, 5000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void refreshParticipants(); });
}

function getLiveKitConnectUrl(serverUrl: string) {
  if (!isInsideDiscord()) return serverUrl;

  const proxyUrl = new URL('/livekit', window.location.origin);
  proxyUrl.protocol = serverUrl.startsWith('ws:') ? 'ws:' : 'wss:';
  return proxyUrl.toString().replace(/\/$/, '');
}

function clearVideo() {
  activeVideoTrack?.detach().forEach((element) => element.remove());
  activeVideoTrack = null;
  activeVideoPublisherId = null;
  activeVideoElement = null;
  videoMount.replaceChildren();
  signalLost();
}

function attachTrack(track: RemoteTrack, publisherId: string) {
  const element = track.attach();
  element.autoplay = true;

  if (track.kind === Track.Kind.Video) {
    const video = element as HTMLVideoElement;
    video.setAttribute('playsinline', 'true');
    activeVideoTrack?.detach().forEach((old) => old.remove());
    activeVideoTrack = track;
    activeVideoPublisherId = publisherId;
    activeVideoElement = video;
    lastDecodedFrameAt = performance.now();
    videoStalled = false;
    videoMount.replaceChildren(video);
    setStatus('SEÑAL DETECTADA…');
    if ('requestVideoFrameCallback' in video) {
      const onFrame: VideoFrameRequestCallback = (now) => {
        if (activeVideoElement !== video) return;
        lastDecodedFrameAt = now;
        videoStalled = false;
        if (!stage.classList.contains('has-signal')) {
          setLive(true);
          setStatus('');
        }
        video.requestVideoFrameCallback(onFrame);
      };
      video.requestVideoFrameCallback(onFrame);
    } else {
      // Older embedded browsers rely on track disconnect and relay timeout.
      setLive(true);
      setStatus('');
    }
  } else if (track.kind === Track.Kind.Audio) {
    element.style.display = 'none';
    element.volume = volume / 100;
    audioMount.appendChild(element);
    element.play().then(() => { audioButton.hidden = true; }).catch(() => {
      audioButton.hidden = false;
    });
  }
}


function attachCloudflareTrack(kind: 'video' | 'audio', mediaTrack: MediaStreamTrack) {
  if (kind === 'audio') {
    const element = document.createElement('audio');
    element.autoplay = true;
    element.srcObject = new MediaStream([mediaTrack]);
    element.style.display = 'none';
    element.volume = volume / 100;
    audioMount.replaceChildren(element);
    void element.play().then(() => { audioButton.hidden = true; })
      .catch(() => { audioButton.hidden = false; });
    return;
  }
  const element = document.createElement('video');
  element.autoplay = true;
  element.srcObject = new MediaStream([mediaTrack]);
  element.setAttribute('playsinline', 'true');
  activeVideoTrack = null;
  activeVideoPublisherId = 'cloudflare';
  activeVideoElement = element;
  lastDecodedFrameAt = performance.now();
  videoStalled = false;
  videoMount.replaceChildren(element);
  setStatus('SEÑAL DETECTADA…');
  void element.play().catch(() => {});
  if ('requestVideoFrameCallback' in element) {
    const onFrame: VideoFrameRequestCallback = (now) => {
      if (activeVideoElement !== element) return;
      lastDecodedFrameAt = now;
      videoStalled = false;
      if (!stage.classList.contains('has-signal')) {
        setLive(true);
        setStatus('');
      }
      element.requestVideoFrameCallback(onFrame);
    };
    element.requestVideoFrameCallback(onFrame);
  } else {
    setLive(true);
    setStatus('');
  }
}

setInterval(() => {
  if (document.hidden || !activeVideoElement || videoStalled ||
      !('requestVideoFrameCallback' in activeVideoElement)) return;
  if (performance.now() - lastDecodedFrameAt > 10000) {
    videoStalled = true;
    signalLost();
  }
}, 2000);

async function connectViewer(stream: string) {
  if (!discordAccessToken) throw new Error('Autoriza tu perfil en Discord para ver la transmisión');
  if (signalLostTimer) {
    clearTimeout(signalLostTimer);
    signalLostTimer = null;
  }
  retryButton.hidden = true;
  setStatus('SINTONIZANDO…');
  setLive(false);

  if (room) {
    await room.disconnect();
    room = null;
  }

  if (config?.streamProvider === 'cloudflare') {
    if (cloudflareViewer) cloudflareViewer.stop();
    roomText.textContent = `shis-${config.defaultStream}`;
    cloudflareViewer = new CloudflareViewer(
      () => discordAccessToken,
      attachCloudflareTrack,
      () => { audioMount.replaceChildren(); audioButton.hidden = true; clearVideo(); },
      showConnectionError,
    );
    await cloudflareViewer.start();
    if (!activeVideoElement) setStatus('BUSCANDO SEÑAL…');
    return;
  }

  const response = await fetch(`/api/viewer-token?stream=${encodeURIComponent(stream)}`, {
    headers: { Authorization: `Bearer ${discordAccessToken}` }, cache: 'no-store',
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) {
      discordAccessToken = '';
      try { sessionStorage.removeItem('shis-discord-access'); } catch { /* No storage. */ }
    }
    throw new Error(body.error || `HTTP ${response.status}`);
  }
  const credentials = body as ViewerCredentials;
  roomText.textContent = credentials.roomName;

  const nextRoom = new Room({ adaptiveStream: false });
  room = nextRoom;

  nextRoom.on(RoomEvent.TrackSubscribed, (track, _publication, participant) => {
    if (room === nextRoom) attachTrack(track, participant.identity);
  });
  nextRoom.on(RoomEvent.TrackUnsubscribed, (track) => {
    track.detach().forEach((element) => element.remove());
    if (track.kind === Track.Kind.Audio) audioButton.hidden = true;
    if (room === nextRoom && track === activeVideoTrack) clearVideo();
  });
  nextRoom.on(RoomEvent.ParticipantConnected, () => {
    if (videoMount.childElementCount === 0) setStatus('SEÑAL DETECTADA…');
  });
  nextRoom.on(RoomEvent.ParticipantDisconnected, (participant) => {
    if (room === nextRoom && participant.identity === activeVideoPublisherId) clearVideo();
  });
  nextRoom.on(RoomEvent.Disconnected, () => {
    if (room === nextRoom) clearVideo();
  });

  const connectUrl = getLiveKitConnectUrl(credentials.serverUrl);
  await nextRoom.connect(connectUrl, credentials.token, { autoSubscribe: true });
  if (videoMount.childElementCount === 0) setStatus('BUSCANDO SEÑAL…');
}

function showConnectionError(error: unknown) {
  console.error(error);
  setLive(false);
  setStatus(error instanceof Error && /Discord|actividad|perfil|autoriza/i.test(error.message) ?
    'ABRE EN DISCORD' : 'ERROR DE SEÑAL');
  retryButton.hidden = false;
}

async function boot() {
  try {
    config = await fetchJson<AppConfig>('/api/config');
    await initDiscord(config.discordClientId);
    await connectViewer(config.defaultStream);
  } catch (error) {
    showConnectionError(error);
  }
}

modeButton.addEventListener('click', () => setScene(sceneMode === 'home' ? 'arcade' : 'home'));
settingsButton.addEventListener('click', () => {
  settingsPanel.hidden = !settingsPanel.hidden;
  settingsButton.setAttribute('aria-expanded', String(!settingsPanel.hidden));
  volumePanel.hidden = true;
  volumeButton.setAttribute('aria-expanded', 'false');
});
filterButton.addEventListener('click', () => setRetroLevel(retroLevel === 'off' ? 'normal' : retroLevel === 'normal' ? 'immersive' : retroLevel === 'immersive' ? 'scanlines' : 'off'));
smoothingButton.addEventListener('click', () => setSmoothing(!smoothing));
aspectButton.addEventListener('click', () => setAspect(aspectMode === '4:3' ? '16:9' : '4:3'));
volumeButton.addEventListener('click', () => {
  volumePanel.hidden = !volumePanel.hidden;
  volumeButton.setAttribute('aria-expanded', String(!volumePanel.hidden));
  settingsPanel.hidden = true;
  settingsButton.setAttribute('aria-expanded', 'false');
});
volumeSlider.addEventListener('input', () => setVolume(Number(volumeSlider.value)));
document.addEventListener('pointerdown', (event) => {
  if (!volumeControl.contains(event.target as Node)) {
    volumePanel.hidden = true;
    volumeButton.setAttribute('aria-expanded', 'false');
  }
  if (!settingsControl.contains(event.target as Node)) {
    settingsPanel.hidden = true;
    settingsButton.setAttribute('aria-expanded', 'false');
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !volumePanel.hidden) {
    volumePanel.hidden = true;
    volumeButton.setAttribute('aria-expanded', 'false');
    volumeButton.focus();
  }
  if (event.key === 'Escape' && !settingsPanel.hidden) {
    settingsPanel.hidden = true;
    settingsButton.setAttribute('aria-expanded', 'false');
    settingsButton.focus();
  }
});
exitButton.addEventListener('click', () => discordSdk?.close(RPCCloseCodes.CLOSE_NORMAL, 'Salió de Shis Stream'));

audioButton.addEventListener('click', async () => {
  const audioElements = [...audioMount.querySelectorAll('audio')];
  if (audioElements.length === 0) return;
  const results = await Promise.allSettled([
    ...audioElements.map((element) => element.play()),
    room?.startAudio() ?? Promise.resolve(),
  ]);
  audioButton.hidden = results.every((result) => result.status === 'fulfilled');
  if (!audioButton.hidden) audioButton.title = 'El audio sigue bloqueado; toca de nuevo para activarlo';
});

retryButton.addEventListener('click', async () => {
  try {
    if (!config) return await boot();
    if (!discordAccessToken && retryDiscordAuthorization) await retryDiscordAuthorization();
    if (discordAccessToken) await connectViewer(config.defaultStream);
  } catch (error) {
    showConnectionError(error);
  }
});

initRoomLighting();
initDecorations();
if (!editorPreviewMode) boot();
