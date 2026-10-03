const p = new URLSearchParams(location.search);
const ticket = p.get('ticket') || '';
const instance = p.get('instance_id') || `local-${ticket.split('.').at(-1) || 'preview'}`;
const storageKey = `shis-host-${instance}`;
let launcher = null;

const css = document.createElement('style');
css.id = 'shis-room-hotfix';
css.textContent = `
html.one-room .room-scene { background:#0a0d15 !important; }
html.one-room #oneBg { object-fit:cover !important; object-position:center !important; filter:none !important; }
#oneWallPatch { position:absolute; z-index:-4; left:15%; right:15%; top:8%; height:49%; pointer-events:none; border-radius:3px; background:linear-gradient(90deg,rgba(9,29,53,.98) 0%,rgba(23,22,31,.99) 49%,rgba(64,34,23,.97) 100%); box-shadow:0 0 35px 18px rgba(12,14,22,.18); }
#oneFloorPatch { position:absolute; z-index:-3; left:0; right:0; top:72%; bottom:0; pointer-events:none; background:linear-gradient(180deg,rgba(30,24,25,.97),rgba(18,15,20,.99) 45%,#0a0e16 100%); }
html.one-room #tvScene { width:min(76vw,960px) !important; }
html.one-room.room-edit #oneTable { pointer-events:auto !important; cursor:grab; }
#oneEditLauncher { min-width:46px; min-height:46px; border:1px solid #526774; border-radius:50%; background:#111820; color:#f4f8fa; font:700 10px/1 system-ui; padding:0 8px; box-shadow:0 7px 18px #0008; }
@media (orientation:portrait) and (min-height:430px) {
  #oneWallPatch { left:7%; right:7%; top:8%; height:50%; }
  #oneFloorPatch { top:70%; }
  html.one-room #tvScene { width:min(96vw,680px) !important; }
}
@media (max-height:360px),(max-width:520px) and (max-height:400px),(max-width:360px) and (max-height:520px) {
  #oneWallPatch,#oneFloorPatch,#oneEditLauncher { display:none !important; }
}
`;
document.head.append(css);

function token() { try { return localStorage.getItem(storageKey) || ''; } catch { return ''; } }
function hostHistory() {
  try {
    for (let i=0;i<localStorage.length;i++) if ((localStorage.key(i)||'').startsWith('shis-host-')) return true;
  } catch {}
  return false;
}
function ensurePatches() {
  const room = document.querySelector('.room-scene');
  const tv = document.querySelector('#tvScene');
  if (!room || !tv) return;
  if (!document.querySelector('#oneWallPatch')) {
    const wall = document.createElement('div'); wall.id='oneWallPatch'; room.insertBefore(wall,tv);
  }
  if (!document.querySelector('#oneFloorPatch')) {
    const floor = document.createElement('div'); floor.id='oneFloorPatch'; room.insertBefore(floor,tv);
  }
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
function fixTableEditing() {
  const t = document.querySelector('#oneTable');
  if (t && document.documentElement.classList.contains('room-edit')) t.style.pointerEvents='auto';
}

new MutationObserver(()=>{ ensurePatches(); ensureEditorAccess(); fixTableEditing(); }).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden']});
window.addEventListener('shis-host-change',ensureEditorAccess);
setInterval(()=>{ ensurePatches(); ensureEditorAccess(); fixTableEditing(); },1000);
ensurePatches(); ensureEditorAccess();