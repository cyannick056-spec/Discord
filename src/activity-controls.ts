import {activityFetch} from './startup-timeout';

export type Controls={aspect:'16:9'|'4:3';scene:'home'|'arcade';retro:'off'|'normal'|'immersive'|'scanlines';smoothing:boolean;revision:number;epoch:string;host:boolean};
const params=new URLSearchParams(location.search),ticket=params.get('ticket')||'';
export const activityInstance=params.get('instance_id') || `local-${ticket.split('.').at(-1)||'preview'}`;
const storageKey=`shis-host-${activityInstance}`;
let token='';try{token=localStorage.getItem(storageKey)||'';}catch{}
let refreshing:Promise<void>|undefined;
let host=params.has('editorPreview'),state:Controls|undefined,apply:((state:Controls)=>void)|undefined;
export const canControlActivity=()=>host;
export const hostHeaders=()=>({'X-Host-Token':token,'X-Activity-Instance':activityInstance});
const url='/api/activity-controls?'+new URLSearchParams({instance:activityInstance,...(ticket?{ticket}:{})});
function receive(value:Controls){if(state && value.epoch===state.epoch && value.revision<state.revision)return;const changed=host!==value.host;state=value;host=value.host;apply?.(value);if(changed)window.dispatchEvent(new Event('shis-host-change'));}
export async function refreshActivityControls(force=false):Promise<void>{
 if(refreshing){await refreshing;if(force)return refreshActivityControls();return}
 const requestedToken=token;
 refreshing=(async()=>{const r=await activityFetch(url,{headers:hostHeaders(),cache:'no-store'});if(!r.ok)throw new Error('No se pudo cargar el formato compartido');const value=await r.json();if(requestedToken===token)receive(value)})();
 try{await refreshing}finally{refreshing=undefined}
}
export async function unlockHost(key:string){
  const r=await activityFetch('/api/host/auth?'+new URLSearchParams({instance:activityInstance,...(ticket?{ticket}:{})}),{method:'POST',headers:{'X-Decoration-Key':key}});
  const b=await r.json();if(!r.ok)throw new Error(b.error||'No se pudo verificar al host');token=b.token;
  try{localStorage.setItem(storageKey,token);}catch{}
  await refreshActivityControls(true);
}
export async function changeActivityControls(value:Partial<Controls>){
  if(!host)return;if(!state)await refreshActivityControls();
  const r=await activityFetch(url,{method:'PUT',headers:{...hostHeaders(),'Content-Type':'application/json'},body:JSON.stringify({...state,...value,revision:state!.revision})});
  const b=await r.json();if(r.status===409){receive(b);return;}if(!r.ok){await refreshActivityControls();throw new Error(b.error||'No se pudo compartir el formato');}receive(b);
}
export function initActivityControls(callback:(state:Controls)=>void){
  apply=callback;if(params.has('editorPreview'))return;
  void refreshActivityControls().catch(error=>window.dispatchEvent(new CustomEvent('shis-load-error',{detail:error.message})));
  const timer=setInterval(()=>{if(!document.hidden)void refreshActivityControls().catch(()=>{});},1500);
  window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
}
