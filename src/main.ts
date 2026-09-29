import { DiscordSDK } from '@discord/embedded-app-sdk';
import { Room, RoomEvent, Track, type RemoteTrack } from 'livekit-client';
import './style.css';

type AppConfig = {
  discordClientId: string;
  defaultStream: string;
};

type ViewerCredentials = {
  serverUrl: string;
  token: string;
  roomName: string;
};

const statusText = document.querySelector<HTMLDivElement>('#statusText')!;
const roomText = document.querySelector<HTMLDivElement>('#roomText')!;
const liveBadge = document.querySelector<HTMLSpanElement>('#liveBadge')!;
const videoMount = document.querySelector<HTMLDivElement>('#videoMount')!;
const audioMount = document.querySelector<HTMLDivElement>('#audioMount')!;
const emptyState = document.querySelector<HTMLDivElement>('#emptyState')!;
const audioButton = document.querySelector<HTMLButtonElement>('#audioButton')!;
const fullscreenButton = document.querySelector<HTMLButtonElement>('#fullscreenButton')!;
const retryButton = document.querySelector<HTMLButtonElement>('#retryButton')!;
const player = document.querySelector<HTMLElement>('#player')!;

let room: Room | null = null;
let config: AppConfig | null = null;

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

  const discordSdk = new DiscordSDK(clientId);
  await discordSdk.ready();
}

function getLiveKitConnectUrl(serverUrl: string) {
  if (!isInsideDiscord()) return serverUrl;

  // Discord Activities run behind a sandbox proxy. Connecting to the mapped
  // /livekit path directly avoids external CSP blocks and also prevents
  // LiveKit Cloud's regional failover from escaping the Discord proxy.
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

  // SHIS publishes one native H.264 layer from SysDVR. Adaptive stream can
  // request quality/layer changes that do not exist on this single-layer track,
  // so keep the subscription continuous for the lowest-latency stable path.
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

audioButton.addEventListener('click', async () => {
  const audioElements = [...audioMount.querySelectorAll('audio')];
  await Promise.allSettled(audioElements.map((element) => element.play()));
  audioButton.hidden = true;
});

fullscreenButton.addEventListener('click', () => {
  player.requestFullscreen?.().catch(() => undefined);
});

retryButton.addEventListener('click', () => {
  if (config) connectViewer(config.defaultStream).catch((error) => {
    console.error(error);
    setLive(false);
    setStatus('ERROR DE SEÑAL');
    retryButton.hidden = false;
  });
  else boot();
});

boot();
