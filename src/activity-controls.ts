export type Controls={aspect:'16:9'|'4:3';scene:'home'|'arcade';retro:'off'|'normal'|'immersive'|'scanlines';smoothing:boolean;revision:number;epoch:string;host:boolean};
const params=new URLSearchParams(location.search),ticket=params.get('ticket')||'';
export const activityInstance=params.get('instance_id') || `local-${ticket.split('.').at(-1)||'preview'}`;
const storageKey=`shis-host-${activityInstance}`;
let token='';try{token=localStorage.getItem(storageKey)||'';}catch{}
let host=params.has('editorPreview'),state:Controls|undefined,apply:((state:Controls)=>void)|undefined;
export const canControlActivity=()=>host;
export const hostHeaders=()=>({'X-Host-Token':token,'X-Activity-Instance':activityInstance});
const url='/api/activity-controls?'+new URLSearchParams({instance:activityInstance,...(ticket?{ticket}:{})});
function receive(value:Controls){if(state && value.epoch===state.epoch && value.revision<state.revision)return;state=value;host=value.host;apply?.(value);window.dispatchEvent(new Event('shis-host-change'));}
export async function refreshActivityControls(){const requestedToken=token;const r=await fetch(url,{headers:hostHeaders(),cache:'no-store'});if(!r.ok)throw new Error('No se pudo cargar el formato compartido');const value=await r.json();if(requestedToken===token)receive(value);}
export async function unlockHost(key:string){
  const r=await fetch('/api/host/auth?'+new URLSearchParams({instance:activityInstance,...(ticket?{ticket}:{})}),{method:'POST',headers:{'X-Decoration-Key':key}});
  const b=await r.json();if(!r.ok)throw new Error(b.error||'No se pudo verificar al host');token=b.token;
  try{localStorage.setItem(storageKey,token);}catch{}
  await refreshActivityControls();
}
export async function changeActivityControls(value:Partial<Controls>){
  if(!host)return;if(!state)await refreshActivityControls();
  const r=await fetch(url,{method:'PUT',headers:{...hostHeaders(),'Content-Type':'application/json'},body:JSON.stringify({...state,...value,revision:state!.revision})});
  const b=await r.json();if(r.status===409){receive(b);return;}if(!r.ok){await refreshActivityControls();throw new Error(b.error||'No se pudo compartir el formato');}receive(b);
}
export function initActivityControls(callback:(state:Controls)=>void){
  apply=callback;if(params.has('editorPreview'))return;
  void refreshActivityControls().catch(()=>{});
  const timer=setInterval(()=>{if(!document.hidden)void refreshActivityControls().catch(()=>{});},1500);
  window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
}
