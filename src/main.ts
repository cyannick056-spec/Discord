import { DiscordSDK, RPCCloseCodes } from '@discord/embedded-app-sdk';
import { Room, RoomEvent, Track, type RemoteTrack } from 'livekit-client';
import { initDecorations } from './decorations';
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
const staticNoise = document.querySelector<HTMLCanvasElement>('#staticNoise')!;
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
const volumeControl = document.querySelector<HTMLDivElement>('#volumeControl')!;
const volumeButton = document.querySelector<HTMLButtonElement>('#volumeButton')!;
const volumePanel = document.querySelector<HTMLDivElement>('#volumePanel')!;
const volumeSlider = document.querySelector<HTMLInputElement>('#volumeSlider')!;
const volumeValue = document.querySelector<HTMLOutputElement>('#volumeValue')!;

let room: Room | null = null;
let config: AppConfig | null = null;
let discordSdk: DiscordSDK | null = null;
let signalLostTimer: ReturnType<typeof setTimeout> | null = null;
const editorPreviewMode = new URLSearchParams(location.search).has('editorPreview');

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

type RetroLevel = 'off' | 'normal' | 'immersive';
let retroLevel: RetroLevel = 'off';
let smoothing = false;
let volume = 100;
try {
  const storedRetro = localStorage.getItem('shis-retro-level');
  if (storedRetro === 'normal' || storedRetro === 'immersive') retroLevel = storedRetro;
  else if (storedRetro === null && localStorage.getItem('shis-retro-filter') === 'on') retroLevel = 'normal';
  smoothing = localStorage.getItem('shis-edge-smoothing') === 'on';
  const storedVolume = Number(localStorage.getItem('shis-volume'));
  if (localStorage.getItem('shis-volume') !== null && Number.isFinite(storedVolume)) {
    volume = Math.max(0, Math.min(100, storedVolume));
  }
} catch { /* Session-only fallback. */ }

function setRetroLevel(level: RetroLevel) {
  retroLevel = level;
  stage.classList.toggle('retro-strong', level === 'normal');
  stage.classList.toggle('retro-immersive', level === 'immersive');
  filterButton.dataset.level = level;
  filterButton.setAttribute('aria-pressed', String(level !== 'off'));
  filterButton.textContent = level === 'off' ? 'Retro apagado' : `Retro ${level === 'normal' ? 'normal' : 'inmersivo'}`;
  const next = level === 'off' ? 'normal' : level === 'normal' ? 'inmersivo' : 'apagado';
  filterButton.setAttribute('aria-label', `Retro ${level === 'off' ? 'apagado' : level === 'normal' ? 'normal' : 'inmersivo'}; cambiar a ${next}`);
  filterButton.title = `Retro: ${level === 'off' ? 'apagado' : level === 'normal' ? 'normal' : 'inmersivo'}. Pulsar para ${next}`;
  try { localStorage.setItem('shis-retro-level', level); } catch { /* Session-only fallback. */ }
}
setRetroLevel(retroLevel);

function setSmoothing(enabled: boolean) {
  smoothing = enabled;
  stage.classList.toggle('edge-smoothing', enabled);
  smoothingButton.setAttribute('aria-pressed', String(enabled));
  smoothingButton.setAttribute('aria-label', enabled ? 'Desactivar suavizado de bordes' : 'Activar suavizado de bordes');
  smoothingButton.title = enabled ? 'Suavizado activado: pulsar para comparar' : 'Suavizar bordes dentados';
  try { localStorage.setItem('shis-edge-smoothing', enabled ? 'on' : 'off'); } catch { /* Session-only fallback. */ }
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
let noiseSeed = 0x6a09e667;
function drawStatic(now: number) {
  if (noiseContext && noiseFrame && !stage.classList.contains('has-signal')) {
    const width = staticNoise.width;
    const band = Math.floor((now / 31) % staticNoise.height);
    for (let i = 0; i < noiseFrame.data.length; i += 4) {
      noiseSeed ^= noiseSeed << 13;
      noiseSeed ^= noiseSeed >>> 17;
      noiseSeed ^= noiseSeed << 5;
      const value = noiseSeed & 255;
      const y = Math.floor(i / 4 / width);
      const grain = Math.min(255, value + (Math.abs(y - band) < 3 ? 35 : 0));
      noiseFrame.data[i] = grain;
      noiseFrame.data[i + 1] = grain;
      noiseFrame.data[i + 2] = Math.min(255, grain + 3);
      noiseFrame.data[i + 3] = 255;
    }
    noiseContext.putImageData(noiseFrame, 0, 0);
    stage.style.setProperty('--glow-rgb', '116, 146, 169');
    stage.style.setProperty('--glow-strength', String(.13 + (noiseSeed & 31) / 700));
  }
  setTimeout(() => drawStatic(performance.now()), 42);
}
drawStatic(performance.now());

const glowCanvas = document.createElement('canvas');
glowCanvas.width = 12;
glowCanvas.height = 7;
const glowContext = glowCanvas.getContext('2d', { willReadFrequently: true });
let glowColor = [116, 146, 169];
setInterval(() => {
  const video = videoMount.querySelector('video');
  if (!video || video.readyState < 2 || document.hidden || !glowContext || !stage.classList.contains('has-signal')) return;
  try {
    glowContext.drawImage(video, 0, 0, glowCanvas.width, glowCanvas.height);
    const pixels = glowContext.getImageData(0, 0, glowCanvas.width, glowCanvas.height).data;
    const rgb = [0, 0, 0];
    for (let i = 0; i < pixels.length; i += 4) {
      rgb[0] += pixels[i]; rgb[1] += pixels[i + 1]; rgb[2] += pixels[i + 2];
    }
    const count = pixels.length / 4;
    glowColor = rgb.map((sum, channel) => Math.round(glowColor[channel] * .68 + sum / count * .32));
    stage.style.setProperty('--glow-rgb', glowColor.join(', '));
    stage.style.setProperty('--glow-strength', '.22');
  } catch { /* The video may forbid canvas sampling; retain the last safe light. */ }
}, 300);

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
    setStatus('');
  } else if (track.kind === Track.Kind.Audio) {
    element.style.display = 'none';
    element.volume = volume / 100;
    audioMount.appendChild(element);
    element.play().then(() => { audioButton.hidden = true; }).catch(() => {
      audioButton.hidden = false;
    });
  }
}

async function connectViewer(stream: string) {
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

  const credentials = await fetchJson<ViewerCredentials>(`/api/viewer-token?stream=${encodeURIComponent(stream)}`);
  roomText.textContent = credentials.roomName;

  const nextRoom = new Room({ adaptiveStream: false });
  room = nextRoom;

  nextRoom.on(RoomEvent.TrackSubscribed, (track) => attachTrack(track));
  nextRoom.on(RoomEvent.TrackUnsubscribed, (track) => {
    track.detach().forEach((element) => element.remove());
    if (track.kind === Track.Kind.Audio) audioButton.hidden = true;
    if (track.kind === Track.Kind.Video && videoMount.childElementCount === 0) signalLost();
  });
  nextRoom.on(RoomEvent.ParticipantConnected, () => {
    if (videoMount.childElementCount === 0) setStatus('SEÑAL DETECTADA…');
  });
  nextRoom.on(RoomEvent.ParticipantDisconnected, () => {
    if (videoMount.childElementCount === 0) signalLost();
  });
  nextRoom.on(RoomEvent.Disconnected, () => {
    signalLost();
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
settingsButton.addEventListener('click', () => {
  settingsPanel.hidden = !settingsPanel.hidden;
  settingsButton.setAttribute('aria-expanded', String(!settingsPanel.hidden));
  volumePanel.hidden = true;
  volumeButton.setAttribute('aria-expanded', 'false');
});
filterButton.addEventListener('click', () => setRetroLevel(retroLevel === 'off' ? 'normal' : retroLevel === 'normal' ? 'immersive' : 'off'));
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

initDecorations();
if (!editorPreviewMode) boot();
