import {activityFetch,withDeadline} from './startup-timeout';
import { DiscordSDK } from '@discord/embedded-app-sdk';

const status = document.querySelector<HTMLParagraphElement>('#gateStatus')!;
const retry = document.querySelector<HTMLButtonElement>('#gateRetry')!;
let entering=false;
const params = new URLSearchParams(location.search);

async function enterActivity() {
  if(entering)return;entering=true;let swapped=false;
  retry.hidden = true;
  if (!params.has('frame_id') && !params.has('instance_id')) {
    status.textContent = 'Abre la actividad desde Discord para ver la transmisión.';
    entering=false;return;
  }

  try {
    status.textContent = 'Comprobando acceso desde Discord…';
    const configResponse = await activityFetch('/api/config', { cache: 'no-store' });
    if (!configResponse.ok) throw new Error('No se pudo iniciar la actividad');
    const config = await configResponse.json() as { discordClientId: string; discordAuthAvailable: boolean };
    if (!config.discordClientId || !config.discordAuthAvailable) throw new Error('Falta configurar Discord');

    const discord = new DiscordSDK(config.discordClientId);
    await withDeadline(discord.ready(),12000,'Discord no respondió. Vuelve a abrir la actividad.');
    status.textContent='Autorizando con Discord…';
    const { code } = await withDeadline(discord.commands.authorize({
      client_id: config.discordClientId, response_type: 'code', scope: ['identify'], prompt: 'none', state: '',
    }),20000,'Discord tardó en autorizar. Vuelve a intentar.');
    status.textContent = 'Abriendo transmisión…';
    const response = await activityFetch('/api/discord-token', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }),
    });
    const result = await response.json() as { ticket?: string; access_token?: string; error?: string };
    if (!response.ok || !result.ticket || !result.access_token) {
      throw new Error(result.error || 'No se pudo comprobar el acceso');
    }
    const auth = await withDeadline(discord.commands.authenticate({ access_token: result.access_token }),15000,'Discord tardó en confirmar el acceso.');
    try { sessionStorage.setItem('shis-discord-access', result.access_token); } catch { /* Retry OAuth on the full page. */ }
    params.set('ticket', result.ticket);
    // Navigating the embedded iframe tears down its Discord RPC connection.
    // Keep the authorized SDK and swap in the protected Activity in this document.
    const entry = await activityFetch(`/?${params}`, { cache: 'no-store' });
    if (!entry.ok) throw new Error('No se pudo abrir la transmisión');
    const activity = new DOMParser().parseFromString(await entry.text(), 'text/html');
    if (!activity.querySelector('#stage')) throw new Error('La transmisión no está disponible');
    (window as Window & { __shisDiscordSession?: unknown }).__shisDiscordSession = {
      sdk: discord, user: auth.user, accessToken: result.access_token,
    };
    // Wait for the current scene styles before replacing the entry screen.
    // Otherwise the browser can paint the old unstyled room for one frame.
    const stylesheets = [...activity.head.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')];
    status.textContent='Cargando interfaz…';
    await withDeadline(Promise.all(stylesheets.map((stylesheet) => new Promise<void>((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = stylesheet.getAttribute('href') || '';
      link.addEventListener('load', () => resolve(), { once: true });
      link.addEventListener('error', () => reject(new Error('No se pudo cargar el entorno')), { once: true });
      document.head.append(link);
    }))),15000,'La interfaz no terminó de cargar. Vuelve a intentar.');
    history.replaceState(null, '', `/?${params}`);
    document.title = activity.title;
    const viewport = activity.head.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    const currentViewport = document.head.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    if (viewport && currentViewport) currentViewport.content = viewport.content;
    document.head.querySelector('style')?.remove();
    document.body.innerHTML = activity.body.innerHTML;swapped=true;
    await withDeadline(import('./main'),15000,'No se pudo cargar la actividad. Vuelve a intentar.');
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : 'No se pudo entrar desde Discord';
    retry.hidden = false;
    if(swapped){const loading=document.querySelector('#loading')??document.body;const message=document.createElement('p');message.textContent=status.textContent;const button=document.createElement('button');button.textContent='Reintentar';button.onclick=()=>location.reload();loading.replaceChildren(message,button)}
  }finally{entering=false;
  }
}

retry.addEventListener('click', () => location.reload());
void enterActivity();
