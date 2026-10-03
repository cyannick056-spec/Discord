import {DiscordSDK,Events,RPCCloseCodes,type Types} from '@discord/embedded-app-sdk';
import {CloudflareViewer} from './cloudflare';
import {canControlActivity,hostHeaders,unlockHost,initActivityControls,changeActivityControls,type Controls} from './activity-controls';
import {photoLayout} from '../public/photo-layout.mjs';
import {roomThemes,roomThemeIds,themeFor,roomPhoto} from '../public/room-themes.mjs';
import {viewFor,keyFor,placementFor,settingsFor,prepareSave,updatePlacement,figureRect,slotColors} from './activity-model.mjs';
import {TvStatic,SignalSweeps} from './tv-static';
import './activity.css';

type Placement={x:number;y:number;width:number;rotation:number;opacity:number;z:number;hidden:boolean;anchor?:string;foreground?:boolean;behindTv?:boolean;locked?:boolean;[key:string]:any};
type Item={id:string;name:string;asset:string;kind?:string;placements:Record<string,Placement>;[key:string]:any};
type Manifest={items:Item[];presentations?:Record<string,any>;[key:string]:any};
type View='landscape'|'portrait'|'window';
type Person=Types.GetActivityInstanceConnectedParticipantsResponse['participants'][number];
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const params=new URLSearchParams(location.search),ticket=params.get('ticket')||'';
const api=(path:string)=>path+(path.includes('?')?'&':'?')+new URLSearchParams({ticket});
const headers=()=>({...hostHeaders(),'X-Activity-Ticket':ticket});
let saved:Manifest={items:[]},draft:Manifest|null=null,selected='',editView:View='landscape',editAspect='16:9',dirty=false,undo:Manifest[]=[];
let controls:Controls={aspect:'16:9',scene:'home',retro:'immersive',smoothing:true,revision:0,epoch:'',host:false};
let sdk:DiscordSDK|null=null,accessToken='',viewer:CloudflareViewer|null=null,people:Person[]=[],order:string[]=[],participantRevision=0;
let signalTimer:ReturnType<typeof setTimeout>|undefined,lastFrame=0,everLive=false,videoEpoch=0;
let pendingExit=false,liveTv='crt',signalVisible=true,switchingTv=false;
const staticNoise=new TvStatic($<HTMLCanvasElement>('staticNoise'));
const signalSweeps=new SignalSweeps($<HTMLCanvasElement>('signalSweep'));
function syncStatic(){const active=liveTv==='crt'&&!document.hidden&&!draft;staticNoise.setActive(active&&signalVisible);signalSweeps.setActive(active&&!signalVisible&&controls.retro==='scanlines')}
let volume=100;try{volume=Number(localStorage.getItem('shis-volume')??100)}catch{}
volume=Math.max(0,Math.min(100,Number.isFinite(volume)?volume:100));
const decoded=new Map<string,Promise<HTMLImageElement>>();let renderEpoch=0,previewEpoch=0;
const currentView=()=>viewFor(innerWidth,innerHeight) as View;
const activeKey=()=>keyFor(editView,editAspect);
const item=()=>draft?.items.find(i=>i.id===selected);
const isFigure=(i:Item)=>!i.kind||i.kind==='viewer-slot';
function notify(message:string){$('notice').textContent=message;$('notice').hidden=false;setTimeout(()=>$('notice').hidden=true,4500)}
async function json<T>(path:string,init:RequestInit={}):Promise<T>{const r=await fetch(api(path),{...init,headers:{...headers(),...init.headers},cache:'no-store'});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||`HTTP ${r.status}`);return data;}
function loadPhoto(src:string){let p=decoded.get(src);if(!p){const image=new Image();image.src=src;p=image.decode().then(()=>image).catch(error=>{decoded.delete(src);throw error});if(decoded.size>=4)decoded.delete(decoded.keys().next().value!);decoded.set(src,p)}return p;}
function photoSource(type:string,view:View,theme='classic'){return roomPhoto(type,view,theme)}
function setRect(el:HTMLElement,r:Record<string,number>){for(const [name,value]of Object.entries(r))el.style.setProperty(name,`${value}px`);}
function layout(room:HTMLElement,key:string,manifest:Manifest,view:View,solo=false){
 const p=settingsFor(manifest,key),type=p.tvModel==='flat-modern'?'flat':'crt';
 let result=photoLayout(room.clientWidth,room.clientHeight,type,p.camera,view==='window',themeFor(p));
 if(solo&&view!=='window'){
 const ratio=controls.aspect==='4:3'?4/3:16/9,w=Math.min(room.clientWidth,room.clientHeight*ratio),h=w/ratio;
 result={photo:{left:(room.clientWidth-w)/2,top:(room.clientHeight-h)/2,width:w,height:h},screen:{left:0,top:0,width:w,height:h}};
 }
 return {p,type,result,screen:{x:result.photo.left+result.screen.left,y:result.photo.top+result.screen.top,width:result.screen.width,height:result.screen.height}};
}
function peopleForSlots(){return order.map(id=>people.find(p=>p.id===id)).filter(Boolean) as Person[];}
function avatar(p:Person){return p.avatar?`https://cdn.discordapp.com/avatars/${p.id}/${p.avatar}.png?size=128`:`https://cdn.discordapp.com/embed/avatars/${(BigInt(p.id)>>22n)%6n}.png`;}
function renderFigures(room:HTMLElement,layer:HTMLElement,manifest:Manifest,key:string,screen:any,p:any,editable:boolean){
 const members=peopleForSlots(),existing=new Map([...layer.children].map(n=>[(n as HTMLElement).dataset.id,n as HTMLElement])),visible=new Set<string>();
 for(const i of manifest.items){if(!isFigure(i))continue;const place=placementFor(i,key);if(!place||place.hidden)continue;
 const slot=i.kind==='viewer-slot',index=slotColors.indexOf(i.id.replace('viewer-slot-','')),person=members[index];if(slot&&!person&&!editable)continue;
 visible.add(i.id);const box=existing.get(i.id)??document.createElement('div');box.className='figure'+(slot?' slot':'')+(editable&&selected===i.id?' selected':'');box.dataset.id=i.id;
 const rect=figureRect(place,{x:0,y:0,width:room.clientWidth,height:room.clientHeight},screen,p.camera);
 box.style.left=`${rect.x}px`;box.style.top=`${rect.y}px`;box.style.width=`${rect.width}px`;box.style.opacity=String(place.opacity);box.style.zIndex=String(place.z+(place.foreground?100:0));box.style.transform=`translate(-50%,-50%) rotate(${place.rotation}deg)`;
 if(slot)box.style.setProperty('--slot',slotColors[index]??'white');
 const src=slot&&person?avatar(person):!slot?api(`/api/decorations/assets/${encodeURIComponent(i.asset)}`):'';
 if(src){let image=box.querySelector('img');if(!image){image=document.createElement('img');box.replaceChildren(image)}image.alt=slot?(person?.username||i.name):i.name;image.draggable=false;if(image.getAttribute('src')!==src)image.src=src;box.style.lineHeight='';box.style.border='';box.style.aspectRatio='';}
 else {const label=String(index+1);if(box.textContent!==label)box.textContent=label;Object.assign(box.style,{color:'white',lineHeight:'2',textAlign:'center',border:'2px solid var(--slot)',background:'black',aspectRatio:'1'})}
 if(box.parentElement!==layer)layer.append(box);
 }
 for(const [id,box]of existing)if(!visible.has(id!))box.remove();
}
async function renderLive(){
 const epoch=++renderEpoch,view=currentView(),key=keyFor(view,controls.aspect,controls.scene),room=$('room');
 // Solo pantalla reuses the saved home composition for its optional figures.
 const sourceKey=controls.scene==='arcade'?keyFor(view,controls.aspect):key;
 const {p,type,result,screen}=layout(room,sourceKey,saved,view,controls.scene==='arcade');
 const src=photoSource(type,view,themeFor(p));try{await loadPhoto(src)}catch{notify('No se pudo cargar el fondo');return}if(epoch!==renderEpoch)return;
 const bg=$<HTMLImageElement>('backdrop');if(bg.getAttribute('src')!==src)bg.src=src;
 setRect($('photo'),result.photo);setRect($('screen'),result.screen);
 $('stage').classList.toggle('solo',controls.scene==='arcade'||view==='window');
 $('stage').classList.toggle('compact',view==='window');$('controls').hidden=view==='window';if(view==='window'){ $('optionsPanel').hidden=true;$('volumePanel').hidden=true; }
 $('roomText').textContent=controls.aspect;
 liveTv=type;$('screen').className=[type==='crt'?'crt':'',signalVisible?'no-signal':'',controls.retro==='immersive'?'intense':controls.retro,controls.smoothing?'smooth':''].join(' ');
 $('screen').style.borderRadius=type==='crt'&&p.screen?.rounded!==false&&view!=='window'?'5% / 8%':'0';
 $<HTMLVideoElement>('video').style.objectFit=p.video?.fit??'contain';
 renderFigures(room,$('figures'),saved,key,screen,p,false);$('loading').hidden=true;syncStatic();document.querySelectorAll<HTMLButtonElement>('[data-live-theme]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.liveTheme===themeFor(p))));document.querySelectorAll<HTMLButtonElement>('[data-live-tv]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.liveTv===type)));
}
async function switchRoom(field:'tvModel'|'roomTheme',value:string){
 if(field==='roomTheme'&&!roomThemeIds.has(value))return;
 if(!canControlActivity()||switchingTv)return;
 switchingTv=true;
 const buttons=[...document.querySelectorAll<HTMLButtonElement>('[data-live-tv],[data-live-theme]')];buttons.forEach(b=>b.disabled=true);
 try{
  // Read fresh before saving so a quick model change cannot overwrite figures.
  const latest=await json<Manifest>('/api/decorations'),payload=prepareSave(latest);
  for(const view of ['landscape','portrait','window'])for(const aspect of ['16:9','4:3'])payload.presentations[keyFor(view,aspect)][field]=value;
  const current=settingsFor(payload,keyFor(currentView(),controls.aspect));await loadPhoto(photoSource(current.tvModel==='flat-modern'?'flat':'crt',currentView(),themeFor(current)));
  await json('/api/decorations',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  saved=payload;
  if(controls.scene!=='home')await changeActivityControls({scene:'home'});
  await renderLive();notify(field==='roomTheme'?`${roomThemes.find((t:{id:string;name:string})=>t.id===value)?.name} aplicado`:value==='flat-modern'?'TV plana aplicada':'TV CRT aplicada');
 }catch(e){notify((e as Error).message)}finally{switchingTv=false;buttons.forEach(b=>b.disabled=false)}
}
function remember(){if(!draft)return;undo.push(structuredClone(draft));if(undo.length>30)undo.shift();dirty=true;}
function mutate(fn:()=>void,history=true){if(!draft)return;if(history)remember();fn();dirty=true;renderPreview();syncEditor(false);}
function update(patch:Record<string,any>,history=true){mutate(()=>updatePlacement(draft!,selected,activeKey(),patch),history)}
function editorSettings(){return (draft!.presentations??={})[activeKey()]??=structuredClone(settingsFor(draft!,activeKey()))}
function resetFreshSettings(m:Manifest){m.presentations??={};for(const v of ['landscape','portrait','window'])for(const a of ['16:9','4:3']){const k=keyFor(v,a);m.presentations[k]=structuredClone(settingsFor(m,k));}}
async function renderPreview(){if(!draft)return;const epoch=++previewEpoch,room=$('previewRoom');const area=$('preview'),ratio=editView==='portrait'?9/16:editView==='window'?4/3:16/9;
 const w=Math.min(area.clientWidth-16,(area.clientHeight-16)*ratio);room.style.width=`${Math.max(1,w)}px`;room.style.height=`${Math.max(1,w/ratio)}px`;room.style.aspectRatio=String(ratio);
 const {p,type,result,screen}=layout(room,activeKey(),draft,editView);const src=photoSource(type,editView,themeFor(p));try{await loadPhoto(src)}catch{notify('No se pudo cargar el fondo');return}if(epoch!==previewEpoch||!draft)return;
 const bg=room.querySelector<HTMLImageElement>('.backdrop')!;if(bg.getAttribute('src')!==src)bg.src=src;bg.hidden=editView==='window';setRect(room.querySelector<HTMLElement>('.photo')!,result.photo);setRect(room.querySelector<HTMLElement>('.screen')!,result.screen);
 room.querySelector<HTMLElement>('.screen')!.style.borderRadius=type==='crt'&&p.screen?.rounded!==false?'5% / 8%':'0';
 renderFigures(room,room.querySelector<HTMLElement>('.figures')!,draft,activeKey(),screen,p,true);
}
function syncEditor(refresh=true){if(!draft)return;
 document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===editView)));
 document.querySelectorAll<HTMLButtonElement>('[data-edit-aspect]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.editAspect===editAspect)));
 const list=$<HTMLSelectElement>('figureList');if(refresh){const all=draft.items.filter(isFigure);list.replaceChildren(...all.map(i=>new Option(i.name,i.id)));if(!all.some(i=>i.id===selected))selected=all[0]?.id??'';list.value=selected;}
 const i=item(),p=i?placementFor(i,activeKey()):null;for(const id of ['size','rotation','figureName','copy','hideFigure','remove','front','back','anchor'])$<HTMLInputElement>(id).disabled=!i;
 $<HTMLInputElement>('figureName').value=i?.name??'';$<HTMLInputElement>('size').value=String(p?.width??15);$<HTMLInputElement>('rotation').value=String(p?.rotation??0);
 $('hideFigure').textContent=!p||p.hidden?'Mostrar':'Ocultar';$('anchor').textContent=p?.anchor==='frame'?'Anclada a TV · cambiar':'Anclada a sala · cambiar';
 const s=editorSettings();document.querySelectorAll<HTMLButtonElement>('[data-theme]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.theme===themeFor(s))));$<HTMLInputElement>('zoom').value=String(s.camera?.zoom??1);$<HTMLInputElement>('panX').value=String(s.camera?.x??0);$<HTMLInputElement>('panY').value=String(s.camera?.y??0);
 document.querySelectorAll<HTMLButtonElement>('[data-tv]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tv===(s.tvModel==='flat-modern'?'flat':'crt'))));
 document.querySelectorAll<HTMLButtonElement>('[data-fit]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.fit===(s.video?.fit??'contain'))));$('round').textContent=`Curvas CRT: ${s.screen?.rounded===false?'no':'sí'}`;$<HTMLButtonElement>('undo').disabled=!undo.length;
 $('slotTools').replaceChildren(...slotColors.map((color:string,index:number)=>{const button=document.createElement('button');button.textContent=`${index+1} · ${color}`;button.onclick=()=>{const id=`viewer-slot-${color}`;mutate(()=>{let slot=draft!.items.find(i=>i.id===id);if(!slot){slot={id,kind:'viewer-slot',asset:'',name:`Espectador ${index+1}`,placements:{}};draft!.items.push(slot)}const old=placementFor(slot,activeKey());updatePlacement(draft!,id,activeKey(),{...(old??{x:10+index*20,y:85,width:8,rotation:0,opacity:1,z:18,anchor:'scene'}),hidden:old?!old.hidden:false});selected=id});syncEditor()};return button}));
}
function openEditor(){if(!canControlActivity())return;draft=structuredClone(saved);resetFreshSettings(draft);editView=currentView();editAspect=controls.aspect;dirty=false;undo=[];$('editor').hidden=false;$('optionsPanel').hidden=true;$('compactNotice').hidden=currentView()!=='window';syncEditor();renderPreview();syncStatic();}
function closeEditor(){draft=null;dirty=false;$('editor').hidden=true;$('compactNotice').hidden=true;$<HTMLDialogElement>('closeDialog').close();syncStatic();}
async function save(){if(!draft)return;const button=$<HTMLButtonElement>('save');button.disabled=true;try{const payload=prepareSave(draft);await json('/api/decorations',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});saved=payload;draft=structuredClone(payload);dirty=false;$('editorStatus').textContent='Guardado';renderLive()}catch(e){$('editorStatus').textContent=(e as Error).message;throw e}finally{button.disabled=false}}
async function load(){if(draft||switchingTv)return;try{const value=await json<Manifest>('/api/decorations');if(draft||switchingTv)return;const changed=JSON.stringify(value)!==JSON.stringify(saved);saved=value;if(changed||!$('loading').hidden)await renderLive()}catch(e){notify((e as Error).message)}}
function setVolume(){const audio=$<HTMLAudioElement>('audio');audio.volume=volume/100;$<HTMLInputElement>('volume').value=String(volume);$<HTMLOutputElement>('volumeValue').value=`${volume}%`;try{localStorage.setItem('shis-volume',String(volume))}catch{}}
function signal(text:string){signalVisible=true;$('signal').hidden=false;$('statusText').textContent=text.toUpperCase();$('liveBadge').textContent='STANDBY';$('screen').classList.add('no-signal');syncStatic()}
function lost(){if(signalTimer)clearTimeout(signalTimer);videoEpoch++;$<HTMLVideoElement>('video').srcObject=null;$<HTMLAudioElement>('audio').srcObject=null;signal(everLive?'Señal perdida':'Buscando señal…');signalTimer=setTimeout(()=>signal('Esperando señal…'),2000)}
function track(kind:'video'|'audio',t:MediaStreamTrack){if(kind==='audio'){const audio=$<HTMLAudioElement>('audio');audio.srcObject=new MediaStream([t]);setVolume();audio.play().catch(()=>$('enableAudio').hidden=false);return}
 const video=$<HTMLVideoElement>('video');video.srcObject=new MediaStream([t]);video.play().catch(()=>{});const epoch=++videoEpoch;lastFrame=performance.now();
 const frame=()=>{if(epoch!==videoEpoch)return;lastFrame=performance.now();everLive=true;signalVisible=false;$('signal').hidden=true;$('liveBadge').textContent='PLAY';$('statusText').textContent='SEÑAL RECIBIDA';$('screen').classList.remove('no-signal');syncStatic();if(signalTimer)clearTimeout(signalTimer);if('requestVideoFrameCallback'in video)video.requestVideoFrameCallback(frame)};
 if('requestVideoFrameCallback'in video)video.requestVideoFrameCallback(frame);else (video as HTMLVideoElement).onplaying=frame;
}
async function connect(){if(!accessToken)return;viewer?.stop();signal('Buscando señal…');viewer=new CloudflareViewer(()=>accessToken,track,lost,e=>{signal('Esperando señal…');console.warn(e)});await viewer.start();setTimeout(()=>{if(!everLive&&$('statusText').textContent==='BUSCANDO SEÑAL…')signal('Esperando señal…')},8000)}
async function boot(){try{
 const config=await json<{discordClientId:string}>('/api/config');
 const session=(window as any).__shisDiscordSession;sdk=session?.sdk??new DiscordSDK(config.discordClientId);await sdk!.ready();
 if(session)accessToken=session.accessToken;else{const {code}=await sdk!.commands.authorize({client_id:config.discordClientId,response_type:'code',scope:['identify'],prompt:'none',state:''});const r=await fetch('/api/discord-token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code})});const b=await r.json();if(!r.ok)throw new Error(b.error);accessToken=b.access_token;await sdk!.commands.authenticate({access_token:accessToken})}
 const receive=(data:Types.GetActivityInstanceConnectedParticipantsResponse)=>{participantRevision++;const next=data.participants.filter(p=>!p.bot);if(JSON.stringify(next)===JSON.stringify(people))return;people=next;const present=new Set(people.map(p=>p.id));order=order.filter(id=>present.has(id));for(const p of people)if(!order.includes(p.id))order.push(p.id);renderLive()};
 await sdk!.subscribe(Events.ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE,receive);let busy=false;
 const refresh=async()=>{if(busy||document.hidden)return;busy=true;const rev=participantRevision;try{const p=await sdk!.commands.getActivityInstanceConnectedParticipants();if(rev===participantRevision)receive(p)}catch{if(rev===participantRevision)receive({participants:[]})}finally{busy=false}};
 await refresh();setInterval(refresh,5000);await connect();
 }catch(e){signal('Abre Shis Stream desde Discord');notify((e as Error).message)}}
function updateControls(){const host=canControlActivity();$('options').hidden=!host;$('optionsPanel').hidden=!host||$('optionsPanel').hidden;$('smooth').textContent=`Suavizado: ${controls.smoothing?'sí':'no'}`;$<HTMLSelectElement>('filter').value=controls.retro;document.querySelectorAll<HTMLButtonElement>('[data-aspect],[data-scene]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.aspect?b.dataset.aspect===controls.aspect:b.dataset.scene===controls.scene)));renderLive()}
function share(value:Partial<Controls>){changeActivityControls(value).catch(e=>notify(e.message))}
$('focusEditor').onclick=()=>{const active=$('editor').classList.toggle('focus-preview');$('focusEditor').textContent=active?'Ver botones':'Vista grande';renderPreview()};
$('options').onclick=()=>$('optionsPanel').hidden=!$('optionsPanel').hidden;
$('volumeButton').onclick=()=>{const el=$('volumePanel');el.hidden=!el.hidden;$('volumeButton').setAttribute('aria-expanded',String(!el.hidden));$<HTMLAudioElement>('audio').play().then(()=>$('enableAudio').hidden=true).catch(()=>{})};
$('enableAudio').onclick=()=>$<HTMLAudioElement>('audio').play().then(()=>$('enableAudio').hidden=true).catch(()=>notify('Toca Volumen para activar sonido'));
$('volume').oninput=()=>{volume=Number($<HTMLInputElement>('volume').value);setVolume()};
const leave=()=>{viewer?.stop();sdk?.close(RPCCloseCodes.CLOSE_NORMAL,'Salió de Shis Stream')};
$('exit').onclick=()=>{if(dirty){pendingExit=true;$<HTMLDialogElement>('closeDialog').showModal();return}leave()};
$('edit').onclick=openEditor;$('reconnect').onclick=()=>connect().catch(e=>notify(e.message));
$('smooth').onclick=()=>share({smoothing:!controls.smoothing});$('filter').onchange=()=>share({retro:$<HTMLSelectElement>('filter').value as Controls['retro']});
$('closeEditor').onclick=()=>{pendingExit=false;return dirty?$<HTMLDialogElement>('closeDialog').showModal():closeEditor()};$('save').onclick=()=>save().catch(()=>{});$('saveClose').onclick=()=>save().then(()=>{closeEditor();if(pendingExit)leave()}).catch(()=>{});$('discardClose').onclick=()=>{closeEditor();if(pendingExit)leave()};$('cancelClose').onclick=()=>{pendingExit=false;$<HTMLDialogElement>('closeDialog').close()};
$('undo').onclick=()=>{const old=undo.pop();if(old){draft=old;dirty=true;syncEditor();renderPreview()}};
$('figureList').onchange=()=>{selected=$<HTMLSelectElement>('figureList').value;syncEditor(false);renderPreview()};
$('figureName').onchange=()=>{const i=item();if(i){mutate(()=>i.name=$<HTMLInputElement>('figureName').value.slice(0,70));syncEditor()}};
for(const [id,property]of [['size','width'],['rotation','rotation']]){$(id).addEventListener('pointerdown',()=>remember());$(id).oninput=()=>update({[property]:Number($<HTMLInputElement>(id).value)},false)}
for(const [id,property]of [['zoom','zoom'],['panX','x'],['panY','y']]){$(id).addEventListener('pointerdown',()=>remember());$(id).oninput=()=>mutate(()=>{const s=editorSettings();(s.camera??={})[property]=Number($<HTMLInputElement>(id).value)},false)}
$('hideFigure').onclick=()=>{const p=item()&&placementFor(item(),activeKey());update({hidden:!p||!p.hidden})};$('remove').onclick=()=>update({hidden:true});
$('front').onclick=()=>update({z:Math.min(99,(placementFor(item(),activeKey())?.z??10)+1)});$('back').onclick=()=>update({z:Math.max(0,(placementFor(item(),activeKey())?.z??10)-1)});
$('copy').onclick=()=>{const i=item();if(!i||i.kind==='viewer-slot')return;mutate(()=>{const copy=structuredClone(i);copy.id=crypto.randomUUID();copy.placements={[activeKey()]:structuredClone(placementFor(i,activeKey())??{x:50,y:65,width:15,rotation:0,opacity:1,z:10,hidden:false,anchor:'scene'})};copy.name=`${copy.name} copia`.slice(0,70);draft!.items.push(copy);selected=copy.id;updatePlacement(draft!,copy.id,activeKey(),{x:Math.min(130,(placementFor(copy,activeKey())?.x??50)+3)})});syncEditor()};
$('anchor').onclick=()=>{const i=item(),p=i&&placementFor(i,activeKey());if(!p)return;const room=$('previewRoom'),l=layout(room,activeKey(),draft!,editView),rect=figureRect(p,{x:0,y:0,width:room.clientWidth,height:room.clientHeight},l.screen,l.p.camera);const target=p.anchor==='frame'?{x:0,y:0,width:room.clientWidth,height:room.clientHeight}:l.screen;update({anchor:p.anchor==='frame'?'scene':'frame',x:Math.max(-30,Math.min(130,(rect.x-target.x)/target.width*100)),y:Math.max(-35,Math.min(145,(rect.y-target.y)/target.height*100)),width:Math.max(1,Math.min(130,rect.width/target.width*100))})};
$('round').onclick=()=>mutate(()=>{const s=editorSettings();s.screen={...s.screen,rounded:s.screen?.rounded===false}});$('resetRoom').onclick=()=>mutate(()=>editorSettings().camera={zoom:1,x:0,y:0});
document.addEventListener('click',event=>{const b=(event.target as Element).closest<HTMLButtonElement>('button');if(!b)return;
 if(b.dataset.liveTv)void switchRoom('tvModel',b.dataset.liveTv==='flat'?'flat-modern':'original');
 if(b.dataset.liveTheme)void switchRoom('roomTheme',b.dataset.liveTheme);
 if(b.dataset.aspect)share({aspect:b.dataset.aspect as Controls['aspect']});if(b.dataset.scene)share({scene:b.dataset.scene as Controls['scene']});
 if(!draft)return;if(b.dataset.view){editView=b.dataset.view as View;syncEditor();renderPreview()}
 if(b.dataset.editAspect){editAspect=b.dataset.editAspect;syncEditor();renderPreview()}
 if(b.dataset.tab){$('figureTools').hidden=b.dataset.tab!=='figures';$('roomTools').hidden=b.dataset.tab!=='room';document.querySelectorAll('[data-tab]').forEach(n=>n.setAttribute('aria-pressed',String(n===b)))}
 if(b.dataset.theme&&roomThemeIds.has(b.dataset.theme))mutate(()=>editorSettings().roomTheme=b.dataset.theme);
 if(b.dataset.tv)mutate(()=>editorSettings().tvModel=b.dataset.tv==='flat'?'flat-modern':'original');if(b.dataset.fit)mutate(()=>editorSettings().video={fit:b.dataset.fit,auto:false});
 if(b.dataset.nudge){const p=item()&&placementFor(item(),activeKey());if(p){const [x,y]=b.dataset.nudge.split(',').map(Number);update({x:Math.max(-30,Math.min(130,p.x+x)),y:Math.max(-35,Math.min(145,p.y+y))})}}
});
$('upload').onchange=async()=>{const input=$<HTMLInputElement>('upload'),file=input.files?.[0];input.value='';if(!file||!draft)return;if(!['image/png','image/gif'].includes(file.type)||file.size>8*1024*1024){notify('Usa PNG o GIF de hasta 8 MB');return}try{const {asset}=await json<{asset:string}>('/api/decorations/assets',{method:'POST',headers:{'Content-Type':file.type},body:file});if(!draft)return;mutate(()=>{const i:Item={id:crypto.randomUUID(),asset,name:file.name.slice(0,70),placements:{}};draft!.items.push(i);selected=i.id;updatePlacement(draft!,i.id,activeKey(),{x:50,y:65,width:15,rotation:0,opacity:1,z:10,hidden:false,anchor:'scene'})});syncEditor()}catch(e){notify((e as Error).message)}};
const pointers=new Map<number,{x:number,y:number}>();let pinch:{distance:number;zoom:number}|null=null;
let drag:{id:string;startX:number;startY:number;p:Placement;basis:any;pointer:number}|null=null;
$('previewRoom').onpointerdown=e=>{pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});$('previewRoom').setPointerCapture?.(e.pointerId);if(pointers.size===2&&draft){const [a,b]=[...pointers.values()];remember();pinch={distance:Math.hypot(a.x-b.x,a.y-b.y),zoom:editorSettings().camera?.zoom??1};drag=null;return;}const box=(e.target as Element).closest<HTMLElement>('.figure');if(!box||!draft||e.button!==0)return;selected=box.dataset.id!;const p=placementFor(item(),activeKey());if(!p||p.locked)return;remember();const room=$('previewRoom'),l=layout(room,activeKey(),draft,editView);drag={id:selected,startX:e.clientX,startY:e.clientY,p:structuredClone(p),basis:figureRect(p,{x:0,y:0,width:room.clientWidth,height:room.clientHeight},l.screen,l.p.camera).basis,pointer:e.pointerId};room.setPointerCapture(e.pointerId);syncEditor(false);e.preventDefault()};
$('previewRoom').onpointermove=e=>{if(pointers.has(e.pointerId))pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pinch&&pointers.size===2&&draft){const [a,b]=[...pointers.values()];mutate(()=>{const s=editorSettings();s.camera={...s.camera,zoom:Math.max(1,Math.min(2,pinch!.zoom*Math.hypot(a.x-b.x,a.y-b.y)/Math.max(1,pinch!.distance))) }},false);return;}if(!drag||e.pointerId!==drag.pointer||!draft)return;selected=drag.id;update({x:Math.max(-30,Math.min(130,drag.p.x+(e.clientX-drag.startX)/drag.basis.width*100)),y:Math.max(-35,Math.min(145,drag.p.y+(e.clientY-drag.startY)/drag.basis.height*100))},false)};
const release=(e:PointerEvent)=>{pointers.delete(e.pointerId);pinch=null;drag=null};$('previewRoom').onpointerup=release;$('previewRoom').onpointercancel=release;
$('previewRoom').addEventListener('wheel',e=>{if(!draft||!e.ctrlKey)return;e.preventDefault();mutate(()=>{const s=editorSettings();s.camera={...s.camera,zoom:Math.max(1,Math.min(2,(s.camera?.zoom??1)-Math.sign(e.deltaY)*.06))}})},{passive:false});
let hold:ReturnType<typeof setTimeout>|undefined;let holdPoint={x:0,y:0};
$('screen').onpointerdown=e=>{if(currentView()==='window')return;e.preventDefault();clearTimeout(hold);$('screen').setPointerCapture?.(e.pointerId);holdPoint={x:e.clientX,y:e.clientY};hold=setTimeout(()=>{if(!canControlActivity())$<HTMLDialogElement>('hostDialog').showModal();else openEditor()},800)};
$('screen').onpointermove=e=>{if(Math.hypot(e.clientX-holdPoint.x,e.clientY-holdPoint.y)>12)clearTimeout(hold)};$('screen').onpointerup=() =>clearTimeout(hold);$('screen').onpointercancel=()=>clearTimeout(hold);
document.addEventListener('selectstart',event=>{const target=event.target as Element;if(!target.closest?.('input,textarea,[contenteditable="true"]'))event.preventDefault()});
document.addEventListener('contextmenu',event=>{const target=event.target as Element;if(!target.closest?.('input,textarea,[contenteditable="true"]'))event.preventDefault()});
document.addEventListener('visibilitychange',syncStatic);
$('hostForm').onsubmit=async e=>{e.preventDefault();try{await unlockHost($<HTMLInputElement>('hostKey').value);$<HTMLInputElement>('hostKey').value='';$<HTMLDialogElement>('hostDialog').close();updateControls();openEditor()}catch(error){$('hostStatus').textContent=(error as Error).message}};$('cancelHost').onclick=()=>$<HTMLDialogElement>('hostDialog').close();
window.addEventListener('resize',()=>{renderLive();if(draft){$('compactNotice').hidden=currentView()!=='window';renderPreview()}});
window.addEventListener('shis-host-change',()=>{updateControls();if(draft&&!canControlActivity()){closeEditor();notify('Vuelve a entrar como host para editar')}});
initActivityControls(state=>{const changed=JSON.stringify(controls)!==JSON.stringify(state);controls=state;if(changed)updateControls()});
setInterval(()=>{if(!document.hidden)void load();if(!document.hidden&&lastFrame&&performance.now()-lastFrame>8000&&$('signal').hidden){lost();lastFrame=0}},2000);
for(const [id,attribute] of [['liveThemes','liveTheme'],['editThemes','theme']]){const container=$(id);for(const theme of roomThemes){const b=document.createElement('button');b.textContent=theme.name;b.dataset[attribute]=theme.id;container.append(b)}}
window.addEventListener('pagehide',()=>{viewer?.stop();staticNoise.stop();signalSweeps.stop()});setVolume();load();boot();
