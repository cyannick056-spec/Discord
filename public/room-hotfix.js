const p = new URLSearchParams(location.search);
const ticket = p.get('ticket') || '';
const instance = p.get('instance_id') || `local-${ticket.split('.').at(-1) || 'preview'}`;
const storageKey = `shis-host-${instance}`;
let launcher = null;

const css = document.createElement('style');
css.id = 'shis-room-hotfix';
css.textContent = `#oneEditLauncher { min-width:46px; min-height:46px; border:1px solid #526774; border-radius:50%; background:#111820; color:#f4f8fa; font:700 10px system-ui; padding:0 8px; }`;
document.head.append(css);

function token() { try { return localStorage.getItem(storageKey) || ''; } catch { return ''; } }
function hostHistory() {
  try {
    for (let i=0;i<localStorage.length;i++) if ((localStorage.key(i)||'').startsWith('shis-host-')) return true;
  } catch {}
  return false;
}
async function authenticateHost() {
  const key = prompt('Clave de edición');
  if (!key) return;
  const u = new URL('/api/host/auth', location.origin);
  u.searchParams.set('instance',instance); if (ticket) u.searchParams.set('ticket',ticket);
  const r = await fetch(`${u.pathname}${u.search}`, {method:'POST',headers:{'X-Decoration-Key':key}});
  const b = await r.json().catch(()=>({}));
  if (!r.ok) { alert(b.error || 'No se pudo verificar al host'); return; }
  try { localStorage.setItem(storageKey,b.token); } catch {}
  location.reload();
}
function ensureEditorAccess() {
  const settings = document.querySelector('#settingsControl');
  const controls = document.querySelector('.scene-controls');
  if (!settings || !controls) return;
  if (token()) {
    settings.hidden = false;
    launcher?.remove(); launcher=null;
    return;
  }
  if (!settings.hidden || !hostHistory() || launcher) return;
  launcher = document.createElement('button');
  launcher.id='oneEditLauncher'; launcher.type='button'; launcher.textContent='Editar'; launcher.title='Entrar como host';
  launcher.addEventListener('click',()=>void authenticateHost());
  controls.insertBefore(launcher, document.querySelector('#volumeControl') || controls.firstChild);
}
window.addEventListener('shis-host-change',ensureEditorAccess);
setInterval(ensureEditorAccess,1000);
ensureEditorAccess();
