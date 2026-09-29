import { DiscordSDK, RPCCloseCodes } from '@discord/embedded-app-sdk';
import { Room, RoomEvent, Track, type RemoteTrack } from 'livekit-client';
import './style.css';
import './scenes.css';

type AppConfig = {
  discordClientId: string;
  defaultStream: string;
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

let room: Room | null = null;
let config: AppConfig | null = null;
let discordSdk: DiscordSDK | null = null;

type AspectMode = '16:9' | '4:3';
let aspectMode: AspectMode = '16:9';
try {
  if (localStorage.getItem('shis-tv-aspect') === '4:3') aspectMode = '4:3';
} catch { /* Embedded browsers may deny storage. */ }

function setAspect(mode: AspectMode) {
  aspectMode = mode;
  tvScene.classList.toggle('aspect-4x3', mode === '4:3');
  aspectButton.textContent = mode;
  aspectButton.setAttribute('aria-label', `Cambiar proporción de la TV a ${mode === '4:3' ? '16:9' : '4:3'}`);
  try { localStorage.setItem('shis-tv-aspect', mode); } catch { /* Session-only fallback. */ }
}
setAspect(aspectMode);

type SceneMode = 'home' | 'arcade';
let sceneMode: SceneMode = 'home';
try {
  if (localStorage.getItem('shis-scene') === 'arcade') sceneMode = 'arcade';
} catch { /* Session-only fallback. */ }

function setScene(mode: SceneMode) {
  sceneMode = mode;
  stage.classList.toggle('home-mode', mode === 'home');
  stage.classList.toggle('arcade-mode', mode === 'arcade');
  arcadeScene.hidden = mode !== 'arcade';
  (mode === 'arcade' ? arcadeScreen : homeScreenMount).appendChild(player);
  modeButton.textContent = mode === 'arcade' ? 'Casa' : 'Arcade';
  modeButton.setAttribute('aria-label', mode === 'arcade' ? 'Cambiar a modo casa' : 'Cambiar a modo arcade');
  videoMount.querySelector('video')?.play().catch(() => {});
  try { localStorage.setItem('shis-scene', mode); } catch { /* Session-only fallback. */ }
}
setScene(sceneMode);

let retroFilter = false;
try { retroFilter = localStorage.getItem('shis-retro-filter') === 'on'; } catch { /* Session-only fallback. */ }
function setRetroFilter(enabled: boolean) {
  retroFilter = enabled;
  stage.classList.toggle('retro-strong', enabled);
  filterButton.setAttribute('aria-pressed', String(enabled));
  filterButton.textContent = enabled ? 'TV retro ✓' : 'TV retro';
  filterButton.setAttribute('aria-label', enabled ? 'Desactivar efecto de TV antigua' : 'Activar efecto de TV antigua');
  filterButton.title = enabled ? 'Ver imagen limpia' : 'Activar efecto de TV antigua';
  try { localStorage.setItem('shis-retro-filter', enabled ? 'on' : 'off'); } catch { /* Session-only fallback. */ }
}
setRetroFilter(retroFilter);

function isInsideDiscord() {
  const params = new URLSearchParams(window.location.search);
  return params.has('frame_id') || params.has('instance_id');
}

function setStatus(text: string) {
  statusText.textContent = text;
}

function setLive(isLive: boolean) {
  liveBadge.textContent = isLive ? 'PLAY' : 'STANDBY';
  liveBadge.classList.toggle('live', isLive);
  emptyState.style.display = isLive ? 'none' : 'flex';
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
  return body as T;
}

async function initDiscord(clientId: string) {
  if (!isInsideDiscord() || !clientId) return;

  discordSdk = new DiscordSDK(clientId);
  await discordSdk.ready();
  exitButton.hidden = false;
}

function getLiveKitConnectUrl(serverUrl: string) {
  if (!isInsideDiscord()) return serverUrl;

  const proxyUrl = new URL('/livekit', window.location.origin);
  proxyUrl.protocol = serverUrl.startsWith('ws:') ? 'ws:' : 'wss:';
  return proxyUrl.toString().replace(/\/$/, '');
}

function attachTrack(track: RemoteTrack) {
  const element = track.attach();
  element.autoplay = true;

  if (track.kind === Track.Kind.Video) {
    element.setAttribute('playsinline', 'true');
    videoMount.replaceChildren(element);
    setLive(true);
    setStatus('SEÑAL RECIBIDA');
  } else if (track.kind === Track.Kind.Audio) {
    element.style.display = 'none';
    audioMount.appendChild(element);
    element.play().catch(() => {
      audioButton.hidden = false;
    });
  }
}

async function connectViewer(stream: string) {
  retryButton.hidden = true;
  setStatus('SINTONIZANDO…');
  setLive(false);

  if (room) {
    await room.disconnect();
    room = null;
  }

  const credentials = await fetchJson<ViewerCredentials>(`/api/viewer-token?stream=${encodeURIComponent(stream)}`);
  roomText.textContent = credentials.roomName;

  const nextRoom = new Room({ adaptiveStream: false });
  room = nextRoom;

  nextRoom.on(RoomEvent.TrackSubscribed, (track) => attachTrack(track));
  nextRoom.on(RoomEvent.TrackUnsubscribed, (track) => {
    track.detach().forEach((element) => element.remove());
    if (videoMount.childElementCount === 0) {
      setLive(false);
      setStatus('SIN SEÑAL');
    }
  });
  nextRoom.on(RoomEvent.ParticipantConnected, () => {
    if (videoMount.childElementCount === 0) setStatus('SEÑAL DETECTADA…');
  });
  nextRoom.on(RoomEvent.ParticipantDisconnected, () => {
    if (videoMount.childElementCount === 0) {
      setLive(false);
      setStatus('SEÑAL PERDIDA');
    }
  });
  nextRoom.on(RoomEvent.Disconnected, () => {
    setLive(false);
    setStatus('DESCONECTADO');
  });

  const connectUrl = getLiveKitConnectUrl(credentials.serverUrl);
  await nextRoom.connect(connectUrl, credentials.token, { autoSubscribe: true });
  if (videoMount.childElementCount === 0) setStatus('BUSCANDO SEÑAL…');
}

async function boot() {
  try {
    config = await fetchJson<AppConfig>('/api/config');
    await initDiscord(config.discordClientId);
    await connectViewer(config.defaultStream);
  } catch (error) {
    console.error(error);
    setLive(false);
    setStatus('ERROR DE SEÑAL');
    retryButton.hidden = false;
  }
}

modeButton.addEventListener('click', () => setScene(sceneMode === 'home' ? 'arcade' : 'home'));
filterButton.addEventListener('click', () => setRetroFilter(!retroFilter));
aspectButton.addEventListener('click', () => setAspect(aspectMode === '4:3' ? '16:9' : '4:3'));
exitButton.addEventListener('click', () => discordSdk?.close(RPCCloseCodes.CLOSE_NORMAL, 'Salió de Shis Stream'));

audioButton.addEventListener('click', async () => {
  const audioElements = [...audioMount.querySelectorAll('audio')];
  await Promise.allSettled(audioElements.map((element) => element.play()));
  audioButton.hidden = true;
});

retryButton.addEventListener('click', () => {
  if (config) {
    connectViewer(config.defaultStream).catch((error) => {
      console.error(error);
      setLive(false);
      setStatus('ERROR DE SEÑAL');
      retryButton.hidden = false;
    });
  } else {
    boot();
  }
});

boot();
