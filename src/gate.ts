import { DiscordSDK } from '@discord/embedded-app-sdk';

const status = document.querySelector<HTMLParagraphElement>('#gateStatus')!;
const retry = document.querySelector<HTMLButtonElement>('#gateRetry')!;
const params = new URLSearchParams(location.search);

async function enterActivity() {
  retry.hidden = true;
  if (!params.has('frame_id') && !params.has('instance_id')) {
    status.textContent = 'Abre la actividad desde Discord para ver la transmisión.';
    return;
  }

  try {
    status.textContent = 'Comprobando acceso desde Discord…';
    const configResponse = await fetch('/api/config', { cache: 'no-store' });
    if (!configResponse.ok) throw new Error('No se pudo iniciar la actividad');
    const config = await configResponse.json() as { discordClientId: string; discordAuthAvailable: boolean };
    if (!config.discordClientId || !config.discordAuthAvailable) throw new Error('Falta configurar Discord');

    const discord = new DiscordSDK(config.discordClientId);
    await Promise.race([
      discord.ready(),
      new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error('Discord no respondió')), 12000)),
    ]);
    const { code } = await discord.commands.authorize({
      client_id: config.discordClientId, response_type: 'code', scope: ['identify'], prompt: 'none', state: '',
    });
    status.textContent = 'Abriendo transmisión…';
    const response = await fetch('/api/discord-token', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }),
    });
    const result = await response.json() as { ticket?: string; access_token?: string; error?: string };
    if (!response.ok || !result.ticket || !result.access_token) {
      throw new Error(result.error || 'No se pudo comprobar el acceso');
    }
    try { sessionStorage.setItem('shis-discord-access', result.access_token); } catch { /* Retry OAuth on the full page. */ }
    params.set('ticket', result.ticket);
    location.replace(`/?${params}`);
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : 'No se pudo entrar desde Discord';
    retry.hidden = false;
  }
}

retry.addEventListener('click', () => { void enterActivity(); });
void enterActivity();
