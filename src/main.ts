import {DiscordSDK,Events,RPCCloseCodes,type Types} from '@discord/embedded-app-sdk';
import {CloudflareViewer} from './cloudflare';
import {canControlActivity,hostHeaders,unlockHost,initActivityControls,changeActivityControls,type Controls} from './activity-controls';
import {previewViewport,scalePreviewLayout} from './preview-viewport.mjs';
import {soloLayout,videoStyle,tvAspect,defaultAperture} from './scene-composition.mjs';
import {photoLayout} from '../public/photo-layout.mjs';
import {roomThemes,roomThemeIds,themeFor,roomPhoto} from '../public/room-themes.mjs';
import {viewFor,keyFor,placementFor,settingsFor,prepareSave,updatePlacement,figureRect,slotColors} from './activity-model.mjs';
import {paintFor,paintFilter} from './tv-paint.mjs';
import {TvStatic,SignalSweeps} from './tv-static';
import {tvModels} from '../public/tv/models.mjs';
import {activityFetch,withDeadline} from './startup-timeout';
import {EditorView} from './editor-view';
import {updateAvatarBorder} from './avatar-border';
import {ActivityViewport} from './activity-viewport';
import './activity.css';
import './tv-legacy.css';

type Placement={x:number;y:number;width:number;rotation:number;opacity:number;z:number;hidden:boolean;anchor?:string;foreground?:boolean;behindTv?:boolean;locked?:boolean;[key:string]:any};
type Item={id:string;name:string;asset:string;kind?:string;placements:Record<string,Placement>;[key:string]:any};
type Manifest={items:Item[];presentations?:Record<string,any>;[key:string]:any};
type View='landscape'|'portrait'|'window';
type Person=Types.GetActivityInstanceConnectedParticipantsResponse['participants'][number];
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const params=new URLSearchParams(location.search),ticket=params.get('ticket')||'';
const api=(path:string)=>path+(path.includes('?')?'&':'?')+new URLSearchParams({ticket});
const headers=()=>({...hostHeaders(),'X-Activity-Ticket':ticket});
let saved:Manifest={items:[]},draft:Manifest|null=null,selected='',editView:View='landscape',editAspect='16:9',editScene:'home'|'arcade'='home',dirty=false,undo:Manifest[]=[],redo:Manifest[]=[];
let controls:Controls={aspect:'16:9',scene:'home',retro:'immersive',smoothing:true,revision:0,epoch:'',host:false};
let sdk:DiscordSDK|null=null,accessToken='',viewer:CloudflareViewer|null=null,people:Person[]=[],order:string[]=[],participantRevision=0;
let signalTimer:ReturnType<typeof setTimeout>|undefined,lastFrame=0,everLive=false,videoEpoch=0;
let loadingManifest=false;
let controlsReady=params.has('editorPreview');
let pendingExit=false,liveTv='crt',signalVisible=true,switchingTv=false;
const staticNoise=new TvStatic($<HTMLCanvasElement>('staticNoise'));
const previewNoise=new TvStatic($<HTMLCanvasElement>('previewNoise'));
const signalSweeps=new SignalSweeps($<HTMLCanvasElement>('signalSweep'));
function syncStatic(){if(document.hidden)previewNoise.setActive(false);if(draft){previewNoise.setActive(signalVisible&&settingsFor(draft,activeKey()).tvModel!=='flat-modern'&&!document.hidden);$('previewRoom').querySelector('.screen')!.classList.toggle('no-signal',signalVisible);$('previewRoom').querySelector('.preview-osd span:last-child')!.textContent=signalVisible?'STANDBY':'PLAY';$('previewSignal').hidden=!signalVisible;const pv=$<HTMLVideoElement>('previewVideo'),v=$<HTMLVideoElement>('video');if(pv.srcObject!==v.srcObject){pv.srcObject=v.srcObject;if(pv.srcObject)void pv.play().catch(()=>{})}}const active=liveTv==='crt'&&!document.hidden&&!draft;staticNoise.setActive(active&&signalVisible);signalSweeps.setActive(active&&!signalVisible&&controls.retro==='scanlines')}
let volume=100;try{volume=Number(localStorage.getItem('shis-volume')??100)}catch{}
volume=Math.max(0,Math.min(100,Number.isFinite(volume)?volume:100));
const decoded=new Map<string,Promise<HTMLImageElement>>();let renderEpoch=0,previewEpoch=0;
const viewport=new ActivityViewport($('stage'),()=>{void renderLive();if(draft){$('compactNotice').hidden=currentView()!=='window';void renderPreview()}});
const inspection=new EditorView($('preview'),$('previewRoom'),$('inspectZoom'));
const currentView=()=>viewFor(viewport.width,viewport.height) as View;
const activeKey=()=>keyFor(editView,editAspect,editScene);
const item=()=>draft?.items.find(i=>i.id===selected);
const isFigure=(i:Item)=>!i.kind||i.kind==='viewer-slot';
function loadingError(message:string){if($('loading').hidden){notify(message);return;}const text=document.createElement('p');text.textContent=message;const retry=document.createElement('button');retry.textContent='Reintentar';retry.onclick=()=>location.reload();$('loading').replaceChildren(text,retry)}
function notify(message:string){$('notice').textContent=message;$('notice').hidden=false;setTimeout(()=>$('notice').hidden=true,4500)}
async function json<T>(path:string,init:RequestInit={}):Promise<T>{const r=await activityFetch(api(path),{...init,headers:{...headers(),...init.headers},cache:'no-store'});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||`HTTP ${r.status}`);return data;}
function loadPhoto(src:string){let p=decoded.get(src);if(!p){const image=new Image();image.src=src;p=withDeadline(image.decode(),15000,'El fondo está tardando en cargar').then(()=>image).catch(error=>{decoded.delete(src);throw error});if(decoded.size>=4)decoded.delete(decoded.keys().next().value!);decoded.set(src,p)}return p;}
function photoSource(type:string,view:View,theme='classic'){return roomPhoto(type,view,theme)}
function setRect(el:HTMLElement,r:Record<string,number>){for(const [name,value]of Object.entries(r))el.style.setProperty(name,`${value}px`);}
function renderTv(tv:HTMLElement,type:string,frame:Record<string,number>,paint:any={}){const model=tvModels[type];const img=tv.querySelector<HTMLImageElement>('img')!;if(img.getAttribute('src')!==model.src)img.src=model.src;tv.dataset.model=type;tv.style.clipPath=model.clip;paint=paintFor(type,paint);img.style.filter=paintFilter(type,paint);const tint=tv.querySelector<HTMLElement>('.tv-tint')!;tint.style.background=paint.body??'#72777c';if(type==='flat'){tint.style.maskImage=`url("${model.src}")`;tint.style.webkitMaskImage=`url("${model.src}")`}else{tint.style.maskImage='';tint.style.webkitMaskImage=''};tint.style.opacity=paint.enabled?String((paint.strength??100)/100):'0';setRect(tv,frame)}
function assetSource(asset:string){return api(`/api/decorations/assets/${encodeURIComponent(asset)}`)}
function backgroundSource(p:any,type:string,view:View){return p.background?assetSource(p.background):photoSource(type,view,themeFor(p))}
function renderOverlay(el:HTMLImageElement,p:any,photo:any){el.hidden=!p.overlay?.asset;if(!el.hidden){el.src=assetSource(p.overlay.asset);el.style.opacity=String(p.overlay.opacity??1);setRect(el,photo)}}
function layout(room:HTMLElement,key:string,manifest:Manifest,view:View,solo=false){
 const p=settingsFor(manifest,key),type=p.tvModel==='flat-modern'?'flat':'crt';
 const reference=room.id==='previewRoom'?previewViewport(view,viewport.width,viewport.height):{width:room.clientWidth,height:room.clientHeight};
 let result=photoLayout(reference.width,reference.height,type,p.camera,view==='window',themeFor(p),p.tv);
 if(room.id==='previewRoom')result=scalePreviewLayout(result,room.clientWidth/reference.width);
 if(solo)result=soloLayout(room.clientWidth,room.clientHeight,room.id==='previewRoom'?editAspect:controls.aspect,p.camera,p.aperture);
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
 box.style.left=`${rect.x}px`;box.style.top=`${rect.y}px`;box.style.width=`${rect.width}px`;box.style.opacity=String(place.opacity);box.style.zIndex=String(place.behindTv?0:place.z+(place.foreground?100:0));box.style.transform=`translate(-50%,-50%) rotate(${place.rotation}deg)`;
 if(slot)box.style.setProperty('--slot','#ffffff');
 const src=slot&&person?avatar(person):!slot?api(`/api/decorations/assets/${encodeURIComponent(i.asset)}`):'';
 if(src){let image=box.querySelector('img');if(!image){image=document.createElement('img');box.replaceChildren(image)}if(slot){image.crossOrigin='anonymous';image.onload=()=>updateAvatarBorder(image!);if(image.complete&&image.naturalWidth)updateAvatarBorder(image)}image.alt=slot?(person?.username||i.name):i.name;image.draggable=false;if(image.getAttribute('src')!==src)image.src=src;box.style.lineHeight='';box.style.border='';box.style.aspectRatio='';}
 else {const label=String(index+1);if(box.textContent!==label)box.textContent=label;Object.assign(box.style,{color:'white',lineHeight:'2',textAlign:'center',border:'1px dashed #b5bac1',borderRadius:'50%',background:'#1e1f22',aspectRatio:'1'})}
 if(box.parentElement!==layer)layer.append(box);
 }
 for(const [id,box]of existing)if(!visible.has(id!))box.remove();
}
async function renderLive(){
 if(!controlsReady)return;
 const epoch=++renderEpoch,view=currentView(),key=keyFor(view,controls.aspect,controls.scene),room=$('room');
 // Solo pantalla reuses the saved home composition for its optional figures.
 const sourceKey=key;
 const {p,type,result,screen}=layout(room,sourceKey,saved,view,controls.scene==='arcade');
 const src=backgroundSource(p,type,view);try{await Promise.all([loadPhoto(src),loadPhoto(tvModels[type].src)])}catch{loadingError('El fondo no terminó de cargar');return}if(epoch!==renderEpoch)return;
 const bg=$<HTMLImageElement>('backdrop');if(bg.getAttribute('src')!==src)bg.src=src;
 setRect($('photo'),result.photo);setRect($('screen'),result.screen);const tv=$('tvFrame');renderTv(tv,type,result.frame,p.tvPaint);tv.hidden=controls.scene==='arcade'||view==='window';
 $('stage').classList.toggle('solo',controls.scene==='arcade'||view==='window');
 $('stage').classList.toggle('compact',view==='window');$('controls').hidden=view==='window';if(view==='window'){ $('optionsPanel').hidden=true;$('volumePanel').hidden=true; }
 $('roomText').textContent='SHIS PLUS';$('screen').style.setProperty('--glass-width',result.screen.width+'px');
 liveTv=type;$('screen').className=[type==='crt'?'crt':'',signalVisible?'no-signal':'',controls.retro==='immersive'?'intense':controls.retro,controls.smoothing?'smooth':''].join(' ');
 $('screen').style.borderRadius=type==='crt'&&p.screen?.rounded!==false&&view!=='window'?tvModels[type].rounding:'0';
 Object.assign($<HTMLVideoElement>('video').style,videoStyle(p.video));renderOverlay($<HTMLImageElement>('sceneOverlay'),p,result.photo);$('stage').classList.toggle('custom-background',Boolean(p.background||p.showEnvironment));
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
  for(const view of ['landscape','portrait','window'])for(const aspect of ['16:9','4:3']){const s=payload.presentations[keyFor(view,aspect)];s[field]=value;if(field==='roomTheme')delete s.background;}
  const current=settingsFor(payload,keyFor(currentView(),controls.aspect));await loadPhoto(photoSource(current.tvModel==='flat-modern'?'flat':'crt',currentView(),themeFor(current)));
  await json('/api/decorations',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  saved=payload;
  if(field==='tvModel')await changeActivityControls({aspect:tvAspect(value),scene:'home'});else if(controls.scene!=='home')await changeActivityControls({scene:'home'});
  await renderLive();notify(field==='roomTheme'?`${roomThemes.find((t:{id:string;name:string})=>t.id===value)?.name} aplicado`:value==='flat-modern'?'TV plana aplicada':'TV CRT aplicada');
 }catch(e){notify((e as Error).message)}finally{switchingTv=false;buttons.forEach(b=>b.disabled=false)}
}
function remember(){if(!draft)return;redo=[];undo.push(structuredClone(draft));if(undo.length>30)undo.shift();dirty=true;}
function mutate(fn:()=>void,history=true){if(!draft)return;if(history)remember();fn();dirty=true;renderPreview();syncEditor(false);}
function update(patch:Record<string,any>,history=true){mutate(()=>updatePlacement(draft!,selected,activeKey(),patch),history)}
function editorSettings(){return (draft!.presentations??={})[activeKey()]??=structuredClone(settingsFor(draft!,activeKey()))}
function resetFreshSettings(m:Manifest){m.presentations??={};for(const v of ['landscape','portrait','window'])for(const a of ['16:9','4:3']){const k=keyFor(v,a);m.presentations[k]=structuredClone(settingsFor(m,k));}}
async function renderPreview(){if(!draft)return;const epoch=++previewEpoch,room=$('previewRoom');const area=$('preview'),reference=previewViewport(editView,viewport.width,viewport.height),ratio=reference.width/reference.height;
 const w=Math.min(area.clientWidth-16,(area.clientHeight-16)*ratio);room.style.width=`${Math.max(1,w)}px`;room.style.height=`${Math.max(1,w/ratio)}px`;room.style.aspectRatio=String(ratio);
 const {p,type,result,screen}=layout(room,activeKey(),draft,editView,editScene==='arcade');const src=backgroundSource(p,type,editView);try{await Promise.all([loadPhoto(src),loadPhoto(tvModels[type].src)])}catch{notify('No se pudo cargar el fondo');return}if(epoch!==previewEpoch||!draft)return;
 const bg=room.querySelector<HTMLImageElement>('.backdrop')!;if(bg.getAttribute('src')!==src)bg.src=src;bg.hidden=(editView==='window'||editScene==='arcade')&&!p.background&&!p.showEnvironment;setRect(room.querySelector<HTMLElement>('.photo')!,result.photo);setRect(room.querySelector<HTMLElement>('.screen')!,result.screen);const tv=room.querySelector<HTMLElement>('.tv-frame')!;renderTv(tv,type,result.frame,p.tvPaint);tv.hidden=editView==='window'||editScene==='arcade';
 room.querySelector<HTMLElement>('.screen')!.style.borderRadius=type==='crt'&&p.screen?.rounded!==false?tvModels[type].rounding:'0';
 const pv=$<HTMLVideoElement>('previewVideo'),live=$<HTMLVideoElement>('video');if(pv.srcObject!==live.srcObject){pv.srcObject=live.srcObject;if(pv.srcObject)void pv.play().catch(()=>{})}Object.assign(pv.style,videoStyle(p.video));$('previewSignal').hidden=!signalVisible;const glass=room.querySelector<HTMLElement>('.screen')!;glass.className=['screen',type==='crt'?'crt':'',signalVisible?'no-signal':'',controls.retro==='immersive'?'intense':controls.retro,controls.smoothing?'smooth':''].join(' ');glass.style.setProperty('--glass-width',result.screen.width+'px');previewNoise.setActive(signalVisible&&type==='crt'&&!document.hidden);renderOverlay($<HTMLImageElement>('previewOverlay'),p,result.photo);
 renderFigures(room,room.querySelector<HTMLElement>('.figures')!,draft,activeKey(),screen,p,true);
}
function syncEditor(refresh=true){if(!draft)return;
 document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===editView)));
 document.querySelectorAll<HTMLButtonElement>('[data-edit-aspect]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.editAspect===editAspect)));
 const list=$<HTMLSelectElement>('figureList');if(refresh){const all=draft.items.filter(isFigure);list.replaceChildren(...all.map(i=>new Option(i.name,i.id)));if(!all.some(i=>i.id===selected))selected=all[0]?.id??'';list.value=selected;}
 const i=item(),p=i?placementFor(i,activeKey()):null;for(const id of ['size','rotation','figureName','copy','hideFigure','remove','front','back','anchor'])$<HTMLInputElement>(id).disabled=!i;
 $<HTMLInputElement>('figureName').value=i?.name??'';$<HTMLInputElement>('size').value=String(p?.width??15);$<HTMLInputElement>('rotation').value=String(p?.rotation??0);
 $('hideFigure').textContent=!p||p.hidden?'Mostrar':'Ocultar';$('anchor').textContent=p?.anchor==='frame'?'Anclada a TV · cambiar':'Anclada a sala · cambiar';
 const s=editorSettings(),paint=paintFor(s.tvModel==='flat-modern'?'flat':'crt',s.tvPaint);$<HTMLSelectElement>('initialMode').value=draft.initialScene?.scene??controls.scene;$('initialSummary').textContent=draft.initialScene?`Al abrir: ${draft.initialScene.scene==='home'?'Sala':'Solo pantalla'} · ${draft.initialScene.aspect}`:'Usa la escena guardada para iniciar una actividad nueva.';$<HTMLFieldSetElement>('tvAdjust').disabled=editView==='window'||editScene==='arcade';$<HTMLSelectElement>('editScene').value=editScene;syncSceneFields(s);$<HTMLInputElement>('tvSize').value=String(s.tv?.zoom??1);$('tvSizeValue').textContent=`${Math.round((s.tv?.zoom??1)*100)}%`;$<HTMLInputElement>('tvX').value=String(s.tv?.x??0);$<HTMLInputElement>('tvY').value=String(s.tv?.y??0);$<HTMLInputElement>('tvColor').value=paint.body??'#72777c';$<HTMLInputElement>('tvBrightness').value=String(paint.exposure??0);$('tvOriginalColor').setAttribute('aria-pressed',String(!paint.enabled));document.querySelectorAll<HTMLButtonElement>('[data-tv-color]').forEach(b=>b.setAttribute('aria-pressed',String(paint.enabled&&b.dataset.tvColor===paint.body)));document.querySelectorAll<HTMLButtonElement>('[data-theme]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.theme===themeFor(s))));$<HTMLInputElement>('zoom').value=String(s.camera?.zoom??1);$('sceneZoomValue').textContent=`${Math.round((s.camera?.zoom??1)*100)}%`;$<HTMLInputElement>('panX').value=String(s.camera?.x??0);$<HTMLInputElement>('panY').value=String(s.camera?.y??0);
 document.querySelectorAll<HTMLButtonElement>('[data-tv]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tv===(s.tvModel==='flat-modern'?'flat':'crt'))));
 document.querySelectorAll<HTMLButtonElement>('[data-fit]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.fit===(s.video?.fit??'contain'))));$('round').textContent=`Curvas CRT: ${s.screen?.rounded===false?'no':'sí'}`;$<HTMLButtonElement>('undo').disabled=!undo.length;
 $('slotTools').replaceChildren(...slotColors.map((color:string,index:number)=>{const button=document.createElement('button');const slot=draft!.items.find(i=>i.id===`viewer-slot-${color}`),place=slot&&placementFor(slot,activeKey());button.textContent=`Espectador ${index+1} · ${place&&!place.hidden?'visible':'oculto'}`;button.setAttribute('aria-pressed',String(Boolean(place&&!place.hidden)));button.onclick=()=>{const id=`viewer-slot-${color}`;mutate(()=>{let slot=draft!.items.find(i=>i.id===id);if(!slot){slot={id,kind:'viewer-slot',asset:'',name:`Espectador ${index+1}`,placements:{}};draft!.items.push(slot)}const old=placementFor(slot,activeKey());updatePlacement(draft!,id,activeKey(),{...(old??{x:10+index*20,y:85,width:8,rotation:0,opacity:1,z:18,anchor:'scene'}),hidden:old?!old.hidden:false});selected=id});syncEditor()};return button}));
}
function openEditor(){if(!canControlActivity())return;draft=structuredClone(saved);resetFreshSettings(draft);editView=currentView();editAspect=controls.aspect;editScene=controls.scene;dirty=false;undo=[];redo=[];inspection.reset();$('editor').hidden=false;$('optionsPanel').hidden=true;$('compactNotice').hidden=currentView()!=='window';syncEditor();renderPreview();syncStatic();}
function closeEditor(){previewNoise.stop();$<HTMLVideoElement>('previewVideo').srcObject=null;draft=null;dirty=false;$('editor').hidden=true;$('compactNotice').hidden=true;$<HTMLDialogElement>('closeDialog').close();syncStatic();}
async function save(){if(!draft)return;const button=$<HTMLButtonElement>('save');button.disabled=true;try{const payload=prepareSave(draft);await json('/api/decorations',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});saved=payload;draft=structuredClone(payload);dirty=false;$('editorStatus').textContent='Guardado';if(controls.scene!==editScene||controls.aspect!==editAspect)await changeActivityControls({scene:editScene,aspect:editAspect as Controls['aspect']});renderLive()}catch(e){$('editorStatus').textContent=(e as Error).message;throw e}finally{button.disabled=false}}
async function load(){if(draft||switchingTv||loadingManifest)return;loadingManifest=true;try{const value=await json<Manifest>('/api/decorations');if(draft||switchingTv)return;const changed=JSON.stringify(value)!==JSON.stringify(saved);saved=value;if(changed||!$('loading').hidden)await renderLive()}catch(e){loadingError((e as Error).message)}finally{loadingManifest=false}}
function setVolume(){const audio=$<HTMLAudioElement>('audio');audio.volume=volume/100;$<HTMLInputElement>('volume').value=String(volume);$<HTMLOutputElement>('volumeValue').value=`${volume}%`;$('volumeButton').dataset.muted=String(volume===0);try{localStorage.setItem('shis-volume',String(volume))}catch{}}
function signal(text:string){signalVisible=true;$('signal').hidden=false;$('statusText').textContent=text.toUpperCase();$('liveBadge').textContent='STANDBY';$('liveBadge').classList.remove('live');$('screen').classList.add('no-signal');syncStatic()}
function clearSignalTimer(){if(signalTimer)clearTimeout(signalTimer);signalTimer=undefined}
function signalLost(){clearSignalTimer();signal(everLive?'SEÑAL PERDIDA':'BUSCANDO SEÑAL…');signalTimer=setTimeout(()=>{signalTimer=undefined;if(signalVisible)signal('ESPERANDO SEÑAL…')},2000)}
function lost(){videoEpoch++;lastFrame=0;$<HTMLVideoElement>('video').srcObject=null;$<HTMLAudioElement>('audio').srcObject=null;signalLost()}
function track(kind:'video'|'audio',t:MediaStreamTrack){if(kind==='audio'){const audio=$<HTMLAudioElement>('audio');audio.srcObject=new MediaStream([t]);setVolume();audio.play().catch(()=>$('enableAudio').hidden=false);return}
 clearSignalTimer();signal('SEÑAL DETECTADA…');
 const video=$<HTMLVideoElement>('video');video.srcObject=new MediaStream([t]);video.play().catch(()=>{});const epoch=++videoEpoch;lastFrame=performance.now();
 const frame=()=>{if(epoch!==videoEpoch)return;lastFrame=performance.now();everLive=true;signalVisible=false;$('signal').hidden=true;$('liveBadge').textContent='PLAY';$('liveBadge').classList.add('live');$('statusText').textContent='';$('screen').classList.remove('no-signal');syncStatic();clearSignalTimer();if('requestVideoFrameCallback'in video)video.requestVideoFrameCallback(frame)};
 t.addEventListener('ended',()=>{if(epoch===videoEpoch)lost()},{once:true});
 if('requestVideoFrameCallback'in video)video.requestVideoFrameCallback(frame);else (video as HTMLVideoElement).onplaying=frame;
}
async function connect(){if(!accessToken)return;viewer?.stop();clearSignalTimer();videoEpoch++;lastFrame=0;signal('BUSCANDO SEÑAL…');viewer=new CloudflareViewer(()=>accessToken,track,lost,e=>{if(signalVisible){clearSignalTimer();signal('ESPERANDO SEÑAL…')}console.warn(e)});await viewer.start();if(signalVisible&&$('statusText').textContent==='BUSCANDO SEÑAL…')signalTimer=setTimeout(()=>{signalTimer=undefined;if(signalVisible&&$('statusText').textContent==='BUSCANDO SEÑAL…')signal('ESPERANDO SEÑAL…')},8000)}
async function boot(){try{
 const config=await json<{discordClientId:string}>('/api/config');
 const session=(window as any).__shisDiscordSession;sdk=session?.sdk??new DiscordSDK(config.discordClientId);await withDeadline(sdk!.ready(),12000,'Discord no respondió');
 if(session)accessToken=session.accessToken;else{const {code}=await withDeadline(sdk!.commands.authorize({client_id:config.discordClientId,response_type:'code',scope:['identify'],prompt:'none',state:''}),20000,'Discord tardó en autorizar');const r=await activityFetch('/api/discord-token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code})});const b=await r.json();if(!r.ok)throw new Error(b.error);accessToken=b.access_token;await withDeadline(sdk!.commands.authenticate({access_token:accessToken}),15000,'Discord tardó en confirmar el acceso')}
 const receive=(data:Types.GetActivityInstanceConnectedParticipantsResponse)=>{participantRevision++;const next=data.participants.filter(p=>!p.bot);if(JSON.stringify(next)===JSON.stringify(people))return;people=next;const present=new Set(people.map(p=>p.id));order=order.filter(id=>present.has(id));for(const p of people)if(!order.includes(p.id))order.push(p.id);renderLive()};
 void withDeadline(sdk!.subscribe(Events.ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE,receive),8000,'No se pudieron sincronizar los espectadores').catch(console.warn);let busy=false;
 const refresh=async()=>{if(busy||document.hidden)return;busy=true;const rev=participantRevision;try{const p=await withDeadline(sdk!.commands.getActivityInstanceConnectedParticipants(),6000,'Discord tardó en enviar los espectadores');if(rev===participantRevision)receive(p)}catch{if(rev===participantRevision)receive({participants:[]})}finally{busy=false}};
 void refresh();setInterval(refresh,5000);await connect();
 }catch(e){signal('No se pudo conectar con Discord');loadingError((e as Error).message);notify((e as Error).message)}}
function updateControls(){const host=canControlActivity();$('options').hidden=!host;$('optionsPanel').hidden=!host||$('optionsPanel').hidden;$('smooth').textContent=`Suavizado: ${controls.smoothing?'sí':'no'}`;$<HTMLSelectElement>('filter').value=controls.retro;document.querySelectorAll<HTMLButtonElement>('[data-aspect],[data-scene]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.aspect?b.dataset.aspect===controls.aspect:b.dataset.scene===controls.scene)));renderLive();if(draft){syncEditor(false);void renderPreview()}}
function share(value:Partial<Controls>){changeActivityControls(value).catch(e=>notify(e.message))}
$('focusEditor').onclick=()=>{const active=$('editor').classList.toggle('focus-preview');$('focusEditor').textContent=active?'Ver botones':'Vista grande';renderPreview()};
$('options').onclick=()=>{$('volumePanel').hidden=true;$('optionsPanel').hidden=!$('optionsPanel').hidden};
$('volumeButton').onclick=()=>{$('optionsPanel').hidden=true;const el=$('volumePanel');el.hidden=!el.hidden;$('volumeButton').setAttribute('aria-expanded',String(!el.hidden));$<HTMLAudioElement>('audio').play().then(()=>$('enableAudio').hidden=true).catch(()=>{})};
$('enableAudio').onclick=()=>$<HTMLAudioElement>('audio').play().then(()=>$('enableAudio').hidden=true).catch(()=>notify('Toca Volumen para activar sonido'));
$('volume').oninput=()=>{volume=Number($<HTMLInputElement>('volume').value);setVolume()};
const leave=()=>{viewer?.stop();sdk?.close(RPCCloseCodes.CLOSE_NORMAL,'Salió de Shis Stream')};
$('exit').onclick=()=>{if(dirty){pendingExit=true;$<HTMLDialogElement>('closeDialog').showModal();return}leave()};
$('edit').onclick=openEditor;$('reconnect').onclick=()=>connect().catch(e=>notify(e.message));
$('smooth').onclick=()=>share({smoothing:!controls.smoothing});$('filter').onchange=()=>share({retro:$<HTMLSelectElement>('filter').value as Controls['retro']});
$('closeEditor').onclick=()=>{pendingExit=false;return dirty?$<HTMLDialogElement>('closeDialog').showModal():closeEditor()};$('save').onclick=()=>save().catch(()=>{});$('saveClose').onclick=()=>save().then(()=>{closeEditor();if(pendingExit)leave()}).catch(()=>{});$('discardClose').onclick=()=>{closeEditor();if(pendingExit)leave()};$('cancelClose').onclick=()=>{pendingExit=false;$<HTMLDialogElement>('closeDialog').close()};
function undoEdit(){const old=undo.pop();if(old&&draft){redo.push(structuredClone(draft));draft=old;dirty=true;syncEditor();renderPreview()}}
function redoEdit(){const next=redo.pop();if(next&&draft){undo.push(structuredClone(draft));draft=next;dirty=true;syncEditor();renderPreview()}}
$('undo').onclick=undoEdit;
$('inspectIn').onclick=()=>inspection.scale(1.25);$('inspectOut').onclick=()=>inspection.scale(.8);$('inspectFit').onclick=()=>inspection.reset();
$('initialMode').onchange=()=>mutate(()=>draft!.initialScene={scene:$<HTMLSelectElement>('initialMode').value,aspect:editAspect,retro:controls.retro,smoothing:controls.smoothing});
$('setInitial').onclick=()=>mutate(()=>draft!.initialScene={scene:$<HTMLSelectElement>('initialMode').value,aspect:editAspect,retro:controls.retro,smoothing:controls.smoothing});
$('figureList').onchange=()=>{selected=$<HTMLSelectElement>('figureList').value;syncEditor(false);renderPreview()};
$('figureName').onchange=()=>{const i=item();if(i){mutate(()=>i.name=$<HTMLInputElement>('figureName').value.slice(0,70));syncEditor()}};
for(const [id,property]of [['size','width'],['rotation','rotation']]){$(id).addEventListener('pointerdown',()=>remember());$(id).oninput=()=>update({[property]:Number($<HTMLInputElement>(id).value)},false)}
for(const [id,property]of [['zoom','zoom'],['panX','x'],['panY','y']]){$(id).addEventListener('pointerdown',()=>remember());$(id).oninput=()=>mutate(()=>{const s=editorSettings();(s.camera??={})[property]=Number($<HTMLInputElement>(id).value)},false)}
for(const [id,property]of [['tvSize','zoom'],['tvX','x'],['tvY','y']]){$(id).addEventListener('pointerdown',()=>remember());$(id).oninput=()=>mutate(()=>{const s=editorSettings();(s.tv??={})[property]=Number($<HTMLInputElement>(id).value)},false)}
$('tvColor').oninput=()=>mutate(()=>{const s=editorSettings();s.tvPaint={...paintFor(s.tvModel==='flat-modern'?'flat':'crt',s.tvPaint),enabled:true,modelRevision:2,body:$<HTMLInputElement>('tvColor').value,strength:100}});
$('tvBrightness').addEventListener('pointerdown',()=>remember());$('tvBrightness').oninput=()=>mutate(()=>{const s=editorSettings();s.tvPaint={...paintFor(s.tvModel==='flat-modern'?'flat':'crt',s.tvPaint),enabled:true,modelRevision:2,body:paintFor(s.tvModel==='flat-modern'?'flat':'crt',s.tvPaint).body??'#72777c',strength:100,exposure:Number($<HTMLInputElement>('tvBrightness').value)}},false);
$('tvOriginalColor').onclick=()=>mutate(()=>editorSettings().tvPaint={enabled:false});
$('resetTv').onclick=()=>mutate(()=>{const s=editorSettings();s.tv={zoom:1,x:0,y:0};s.tvPaint={enabled:false}});
$('hideFigure').onclick=()=>{const p=item()&&placementFor(item(),activeKey());update({hidden:!p||!p.hidden})};$('remove').onclick=()=>update({hidden:true});
$('front').onclick=()=>update({z:Math.min(99,(placementFor(item(),activeKey())?.z??10)+1)});$('back').onclick=()=>update({z:Math.max(0,(placementFor(item(),activeKey())?.z??10)-1)});
$('copy').onclick=()=>{const i=item();if(!i||i.kind==='viewer-slot')return;mutate(()=>{const copy=structuredClone(i);copy.id=crypto.randomUUID();copy.placements={[activeKey()]:structuredClone(placementFor(i,activeKey())??{x:50,y:65,width:15,rotation:0,opacity:1,z:10,hidden:false,anchor:'scene'})};copy.name=`${copy.name} copia`.slice(0,70);draft!.items.push(copy);selected=copy.id;updatePlacement(draft!,copy.id,activeKey(),{x:Math.min(130,(placementFor(copy,activeKey())?.x??50)+3)})});syncEditor()};
$('anchor').onclick=()=>{const i=item(),p=i&&placementFor(i,activeKey());if(!p)return;const room=$('previewRoom'),l=layout(room,activeKey(),draft!,editView,editScene==='arcade'),rect=figureRect(p,{x:0,y:0,width:room.clientWidth,height:room.clientHeight},l.screen,l.p.camera);const target=p.anchor==='frame'?{x:0,y:0,width:room.clientWidth,height:room.clientHeight}:l.screen;update({anchor:p.anchor==='frame'?'scene':'frame',x:Math.max(-30,Math.min(130,(rect.x-target.x)/target.width*100)),y:Math.max(-35,Math.min(145,(rect.y-target.y)/target.height*100)),width:Math.max(1,Math.min(130,rect.width/target.width*100))})};
$('round').onclick=()=>mutate(()=>{const s=editorSettings();s.screen={...s.screen,rounded:s.screen?.rounded===false}});$('resetRoom').onclick=()=>mutate(()=>editorSettings().camera={zoom:1,x:0,y:0});
document.addEventListener('click',event=>{const b=(event.target as Element).closest<HTMLButtonElement>('button');if(!b)return;
 if(b.dataset.liveTv)void switchRoom('tvModel',b.dataset.liveTv==='flat'?'flat-modern':'original');
 if(b.dataset.liveTheme)void switchRoom('roomTheme',b.dataset.liveTheme);
 if(b.dataset.aspect)share({aspect:b.dataset.aspect as Controls['aspect']});if(b.dataset.scene)share({scene:b.dataset.scene as Controls['scene']});
 if(!draft)return;if(b.dataset.view){editView=b.dataset.view as View;inspection.reset();syncEditor();renderPreview()}
 if(b.dataset.editAspect){editAspect=b.dataset.editAspect;inspection.reset();syncEditor();renderPreview()}
 if(b.dataset.tab){document.querySelectorAll<HTMLElement>('[data-editor-section]').forEach(n=>n.hidden=n.dataset.editorSection!==b.dataset.tab);document.querySelectorAll('[data-tab]').forEach(n=>n.setAttribute('aria-pressed',String(n===b)))}
 if(b.dataset.tvColor)mutate(()=>{const s=editorSettings();s.tvPaint={...paintFor(s.tvModel==='flat-modern'?'flat':'crt',s.tvPaint),enabled:true,modelRevision:2,body:b.dataset.tvColor,strength:100}});
 if(b.dataset.theme&&roomThemeIds.has(b.dataset.theme))mutate(()=>{const s=editorSettings();s.roomTheme=b.dataset.theme;delete s.background;if(editScene==='arcade')s.showEnvironment=true});
 if(b.dataset.tv)mutate(()=>{const oldKey=activeKey(),settings=structuredClone(editorSettings());settings.tvModel=b.dataset.tv==='flat'?'flat-modern':'original';editAspect=tvAspect(settings.tvModel);draft!.presentations![activeKey()]=settings;for(const figure of draft!.items){const place=placementFor(figure,oldKey);if(place&&!figure.placements[activeKey()])figure.placements[activeKey()]=structuredClone(place)}});if(b.dataset.fit)mutate(()=>{const s=editorSettings();s.video={...s.video,fit:b.dataset.fit,auto:false}});
 if(b.dataset.nudge){const p=item()&&placementFor(item(),activeKey());if(p){const [x,y]=b.dataset.nudge.split(',').map(Number);update({x:Math.max(-30,Math.min(130,p.x+x)),y:Math.max(-35,Math.min(145,p.y+y))})}}
});

function apertureDefault(){const size=previewViewport(editView,viewport.width,viewport.height);return defaultAperture(size.width,size.height,editAspect)}
function syncSceneFields(s:any){
 $<HTMLSelectElement>('editorFilter').value=controls.retro;$('editorSmooth').textContent=`Suavizado: ${controls.smoothing?'sí':'no'}`;
 $('backgroundSummary').textContent=`Fondo: ${s.background?'personalizado':editScene==='home'||s.showEnvironment?'ambiente HD':'ninguno'} · Overlay: ${s.overlay?.asset?'personalizado':'ninguno'}`;
 $<HTMLInputElement>('overlayOpacity').value=String(s.overlay?.opacity??1);
 for(const [id,property]of [['videoZoom','zoom'],['videoX','x'],['videoY','y']])$<HTMLInputElement>(id).value=String(s.video?.[property]??(property==='zoom'?1:0));
 $('videoZoomValue').textContent=`${Math.round((s.video?.zoom??1)*100)}%`;
 $('apertureTools').hidden=editScene!=='arcade';$('removeBackground').hidden=editScene!=='arcade';
 for(const property of ['x','y','width','height'])$<HTMLInputElement>('aperture'+property[0].toUpperCase()+property.slice(1)).value=String(s.aperture?.[property]??apertureDefault()[property]);
}
$('editScene').onchange=()=>{editScene=$<HTMLSelectElement>('editScene').value as 'home'|'arcade';inspection.reset();syncEditor();void renderPreview()};
for(const [id,property]of [['videoZoom','zoom'],['videoX','x'],['videoY','y']]){$(id).addEventListener('pointerdown',()=>remember());$(id).oninput=()=>mutate(()=>{const s=editorSettings();s.video={...s.video,[property]:Number($<HTMLInputElement>(id).value)}},false)}
for(const property of ['x','y','width','height']){const id='aperture'+property[0].toUpperCase()+property.slice(1);$(id).addEventListener('pointerdown',()=>remember());$(id).oninput=()=>mutate(()=>{const s=editorSettings();s.aperture={...apertureDefault(),...s.aperture,[property]:Number($<HTMLInputElement>(id).value)}},false)}
$('editorFilter').onchange=()=>share({retro:$<HTMLSelectElement>('editorFilter').value as Controls['retro']});$('editorSmooth').onclick=()=>share({smoothing:!controls.smoothing});
$('resetVideo').onclick=()=>mutate(()=>editorSettings().video={fit:'contain',zoom:1,x:0,y:0,auto:false});
$('resetAperture').onclick=()=>mutate(()=>delete editorSettings().aperture);
$('clearBackground').onclick=()=>mutate(()=>{const s=editorSettings();delete s.background;s.showEnvironment=true});$('removeBackground').onclick=()=>mutate(()=>{const s=editorSettings();delete s.background;s.showEnvironment=false});
$('clearOverlay').onclick=()=>mutate(()=>delete editorSettings().overlay);
$('overlayOpacity').addEventListener('pointerdown',()=>remember());$('overlayOpacity').oninput=()=>mutate(()=>{const s=editorSettings();if(s.overlay)s.overlay.opacity=Number($<HTMLInputElement>('overlayOpacity').value)},false);
for(const [id,kind]of [['backgroundUpload','background'],['overlayUpload','overlay']])$(id).onchange=async()=>{const input=$<HTMLInputElement>(id),file=input.files?.[0];input.value='';if(!file||!draft)return;if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type)||file.size>8*1024*1024){notify('Usa PNG, JPG, WebP o GIF de hasta 8 MB');return}const key=activeKey(),target=draft;try{const {asset}=await json<{asset:string}>('/api/decorations/assets',{method:'POST',headers:{'Content-Type':file.type},body:file});if(draft!==target)return;mutate(()=>{const s=draft!.presentations![key]??=structuredClone(settingsFor(draft!,key));if(kind==='background')s.background=asset;else s.overlay={asset,opacity:1}})}catch(e){notify((e as Error).message)}};

$('upload').onchange=async()=>{const input=$<HTMLInputElement>('upload'),file=input.files?.[0];input.value='';if(!file||!draft)return;if(!['image/png','image/gif'].includes(file.type)||file.size>8*1024*1024){notify('Usa PNG o GIF de hasta 8 MB');return}try{const {asset}=await json<{asset:string}>('/api/decorations/assets',{method:'POST',headers:{'Content-Type':file.type},body:file});if(!draft)return;mutate(()=>{const i:Item={id:crypto.randomUUID(),asset,name:file.name.slice(0,70),placements:{}};draft!.items.push(i);selected=i.id;updatePlacement(draft!,i.id,activeKey(),{x:50,y:65,width:15,rotation:0,opacity:1,z:10,hidden:false,anchor:'scene'})});syncEditor()}catch(e){notify((e as Error).message)}};
const pointers=new Map<number,{x:number,y:number}>();let pinch:{distance:number;zoom:number}|null=null;
let tvDrag:{startX:number;startY:number;x:number;y:number;basis:{width:number;height:number};pointer:number}|null=null;
let drag:{id:string;startX:number;startY:number;p:Placement;basis:any;pointer:number}|null=null;
$('previewRoom').onpointerdown=e=>{pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});$('previewRoom').setPointerCapture?.(e.pointerId);if(pointers.size===2&&draft){const [a,b]=[...pointers.values()];pinch={distance:Math.hypot(a.x-b.x,a.y-b.y),zoom:inspection.zoom};drag=null;tvDrag=null;return;}if(draft&&!$('roomTools').hidden&&editView!=='window'&&editScene==='home'&&e.button===0){const room=$('previewRoom'),l=layout(room,activeKey(),draft,editView,false),r=room.getBoundingClientRect(),m=tvModels[l.type],f=l.result.frame,units=f.width/m.width,[bx,by,bw,bh]=m.body;const x=(e.clientX-r.left)/inspection.zoom-l.result.photo.left,y=(e.clientY-r.top)/inspection.zoom-l.result.photo.top;if(x>=f.left+bx*units&&x<=f.left+(bx+bw)*units&&y>=f.top+by*units&&y<=f.top+(by+bh)*units){remember();tvDrag={startX:e.clientX,startY:e.clientY,x:l.p.tv?.x??0,y:l.p.tv?.y??0,basis:l.result.photo,pointer:e.pointerId};e.preventDefault();return;}}const box=(e.target as Element).closest<HTMLElement>('.figure');if(!box||!draft||e.button!==0)return;selected=box.dataset.id!;const p=placementFor(item(),activeKey());if(!p||p.locked)return;remember();const room=$('previewRoom'),l=layout(room,activeKey(),draft,editView,editScene==='arcade');drag={id:selected,startX:e.clientX,startY:e.clientY,p:structuredClone(p),basis:figureRect(p,{x:0,y:0,width:room.clientWidth,height:room.clientHeight},l.screen,l.p.camera).basis,pointer:e.pointerId};room.setPointerCapture(e.pointerId);syncEditor(false);e.preventDefault()};
$('previewRoom').onpointermove=e=>{if(pointers.has(e.pointerId))pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pinch&&pointers.size===2&&draft){const [a,b]=[...pointers.values()];const next=Math.max(1,Math.min(8,pinch.zoom*Math.hypot(a.x-b.x,a.y-b.y)/Math.max(1,pinch.distance)));inspection.scale(next/inspection.zoom,(a.x+b.x)/2,(a.y+b.y)/2);return;}if(tvDrag&&e.pointerId===tvDrag.pointer&&draft){mutate(()=>{const s=editorSettings();s.tv={...s.tv,x:Math.max(-80,Math.min(80,tvDrag!.x+(e.clientX-tvDrag!.startX)/(tvDrag!.basis.width*inspection.zoom)*100)),y:Math.max(-80,Math.min(80,tvDrag!.y+(e.clientY-tvDrag!.startY)/(tvDrag!.basis.height*inspection.zoom)*100))}},false);return;}if(!drag||e.pointerId!==drag.pointer||!draft)return;selected=drag.id;update({x:Math.max(-30,Math.min(130,drag.p.x+(e.clientX-drag.startX)/(drag.basis.width*inspection.zoom)*100)),y:Math.max(-35,Math.min(145,drag.p.y+(e.clientY-drag.startY)/(drag.basis.height*inspection.zoom)*100))},false)};
const release=(e:PointerEvent)=>{pointers.delete(e.pointerId);pinch=null;drag=null;tvDrag=null};$('previewRoom').onpointerup=release;$('previewRoom').onpointercancel=release;
$('preview').addEventListener('wheel',e=>{if(!draft)return;e.preventDefault();if(e.altKey&&item()){const p=placementFor(item(),activeKey());if(!p||p.locked)return;if(e.shiftKey)update({rotation:Math.max(-180,Math.min(180,p.rotation-Math.sign(e.deltaY)*5))});else update({width:Math.max(1,Math.min(130,p.width*(e.deltaY<0?1.05:1/1.05)))});return;}inspection.scale(e.deltaY<0?1.12:1/1.12,e.clientX,e.clientY)},{passive:false});
let spaceHeld=false,viewPan:{pointer:number;x:number;y:number}|null=null;
$('preview').addEventListener('pointerdown',e=>{if(!draft||!(spaceHeld||e.button===1))return;e.preventDefault();e.stopPropagation();viewPan={pointer:e.pointerId,x:e.clientX,y:e.clientY};$('preview').setPointerCapture?.(e.pointerId)},true);
$('preview').addEventListener('pointermove',e=>{if(!viewPan||viewPan.pointer!==e.pointerId)return;e.stopPropagation();inspection.pan(e.clientX-viewPan.x,e.clientY-viewPan.y);viewPan.x=e.clientX;viewPan.y=e.clientY},true);
for(const event of ['pointerup','pointercancel'])$('preview').addEventListener(event,()=>viewPan=null,true);
window.addEventListener('blur',()=>{spaceHeld=false;viewPan=null});
document.addEventListener('keyup',e=>{if(e.code==='Space')spaceHeld=false});
document.addEventListener('keydown',e=>{
 if(!draft||(e.target as Element).closest?.('input,textarea,select,[contenteditable=true]')||$<HTMLDialogElement>('hostDialog').open||$<HTMLDialogElement>('closeDialog').open)return;
 const ctrl=e.ctrlKey||e.metaKey,key=e.key.toLowerCase();
 if(e.code==='Space'){e.preventDefault();spaceHeld=true;return;}
 if(ctrl&&key==='s'){e.preventDefault();void save().catch(()=>{});return;}
 if(ctrl&&key==='z'){e.preventDefault();if(e.shiftKey)redoEdit();else undoEdit();return;}
 if(ctrl&&key==='d'){e.preventDefault();$('copy').click();return;}
 if(ctrl&&key==='0'){e.preventDefault();inspection.reset();return;}
 if(ctrl&&['+','=','-'].includes(key)){e.preventDefault();inspection.scale(key==='-'?.8:1.25);return;}
 const p=item()&&placementFor(item(),activeKey());if(!p||p.locked)return;
 if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();update({hidden:true});return;}
 const directions:Record<string,[number,number]>={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]},direction=directions[e.key];
 if(direction){e.preventDefault();const step=e.shiftKey?10:1;update({x:Math.max(-30,Math.min(130,p.x+direction[0]*step)),y:Math.max(-35,Math.min(145,p.y+direction[1]*step))});}
});
let hold:ReturnType<typeof setTimeout>|undefined;let holdPoint={x:0,y:0};
$('screen').onpointerdown=e=>{if(currentView()==='window')return;e.preventDefault();clearTimeout(hold);$('screen').setPointerCapture?.(e.pointerId);holdPoint={x:e.clientX,y:e.clientY};hold=setTimeout(()=>{if(!canControlActivity())$<HTMLDialogElement>('hostDialog').showModal();else openEditor()},800)};
$('screen').onpointermove=e=>{if(Math.hypot(e.clientX-holdPoint.x,e.clientY-holdPoint.y)>12)clearTimeout(hold)};$('screen').onpointerup=() =>clearTimeout(hold);$('screen').onpointercancel=()=>clearTimeout(hold);
document.addEventListener('selectstart',event=>{const target=event.target as Element;if(!target.closest?.('input,textarea,[contenteditable="true"]'))event.preventDefault()});
document.addEventListener('contextmenu',event=>{const target=event.target as Element;if(!target.closest?.('input,textarea,[contenteditable="true"]'))event.preventDefault()});
document.addEventListener('visibilitychange',syncStatic);
$('hostForm').onsubmit=async e=>{e.preventDefault();try{await unlockHost($<HTMLInputElement>('hostKey').value);$<HTMLInputElement>('hostKey').value='';$<HTMLDialogElement>('hostDialog').close();updateControls();openEditor()}catch(error){$('hostStatus').textContent=(error as Error).message}};$('cancelHost').onclick=()=>$<HTMLDialogElement>('hostDialog').close();

window.addEventListener('shis-host-change',()=>{updateControls();if(draft&&!canControlActivity()){closeEditor();notify('Vuelve a entrar como host para editar')}});
initActivityControls(state=>{const first=!controlsReady;controlsReady=true;const changed=JSON.stringify(controls)!==JSON.stringify(state);controls=state;if(changed||first)updateControls()});
setInterval(()=>{if(!document.hidden)void load();if(!document.hidden&&lastFrame&&performance.now()-lastFrame>8000&&$('signal').hidden){signalLost();lastFrame=0}},2000);
for(const [id,attribute] of [['liveThemes','liveTheme'],['editThemes','theme']]){const container=$(id);for(const theme of roomThemes){const b=document.createElement('button');b.textContent=theme.name;b.dataset[attribute]=theme.id;container.append(b)}}
window.addEventListener('shis-load-error',e=>loadingError((e as CustomEvent).detail));
window.addEventListener('pagehide',()=>{clearSignalTimer();viewer?.stop();staticNoise.stop();signalSweeps.stop();previewNoise.stop()});setVolume();load();boot();
