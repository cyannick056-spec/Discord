import {canControlActivity,hostHeaders} from './activity-controls';
import {parseYouTubeLink,playbackPosition,type PlaybackState} from '../youtube-model.mjs';
import {patchUrlMappings} from '@discord/embedded-app-sdk';
import {isDiscordOrigin,youtubeMapping,youtubeBase,youtubeScriptUrl,youtubeEmbedUrl,youtubeResourceUrl,isYouTubeScriptResponse} from '../youtube-network.mjs';
import {safeResourceLabel,needsPlaybackCommand,playbackSelectionKey} from '../youtube-diagnostics.mjs';
type YTPlayer = {destroy():void;playVideo():void;pauseVideo():void;seekTo(t:number,allow:boolean):void;setVolume(n:number):void;unMute():void;getPlayerState():number;getCurrentTime():number;getVideoData():{video_id?:string};getPlaylistIndex():number;nextVideo():void;loadVideoById(value:{videoId:string;startSeconds:number}):void;loadPlaylist(value:{list:string;listType:string;index:number;startSeconds:number}):void};
type YTConstructor = new (mount:HTMLElement,options:{videoId?:string;width:string;height:string;playerVars:Record<string,string|number>;events:Record<string,(event:{data:number;target:YTPlayer})=>void>})=>YTPlayer;
declare global {interface Window {YT?:{Player:YTConstructor};onYouTubeIframeAPIReady?:()=>void}}
let apiPromise:Promise<YTConstructor>|null=null;
let remappingInstalled=false;
let embedAccessPromise:Promise<void>|null=null;
function checkEmbedAccess(selection:{videoId?:string;playlistId?:string}) {
  if(!isDiscordOrigin(location.href))return Promise.resolve();
  if(embedAccessPromise)return embedAccessPromise;
  embedAccessPromise=(async()=>{
    const url=youtubeEmbedUrl(location.href,selection);
    const response=await fetch(url,{cache:'no-store',referrerPolicy:'origin',signal:AbortSignal.timeout(10000)});
    if(!response.ok || !response.headers.get('Content-Type')?.includes('text/html'))throw new Error('La ruta de YouTube no entregó la página del reproductor.');
    const document=new DOMParser().parseFromString(await response.text(),'text/html');
    const paths=[...new Set(Array.from(document.querySelectorAll<HTMLScriptElement>('script[src]'),node=>new URL(node.getAttribute('src')!,url).pathname).filter(path=>path.startsWith('/s/')))];
    if(!paths.length)throw new Error('La ruta de YouTube entregó una página sin el programa del reproductor.');
    await Promise.all(paths.map(async path=>{
      const asset=await fetch(youtubeResourceUrl(location.href,path),{cache:'no-store',referrerPolicy:'origin',signal:AbortSignal.timeout(10000)});
      const valid=isYouTubeScriptResponse(asset.status,asset.headers.get('Content-Type') || '');
      await asset.body?.cancel();
      if(!valid)throw new Error('YouTube no pudo acceder a sus archivos internos (ruta /s). Puedes seguir usando Switch.');
    }));
  })().catch(error=>{embedAccessPromise=null;throw error;});return embedAccessPromise;
}
function loadApi() {
  if(window.YT?.Player)return Promise.resolve(window.YT.Player);
  if(apiPromise)return apiPromise;
  apiPromise=(async()=>{
    const mapped=isDiscordOrigin(location.href),src=youtubeScriptUrl(location.href);
    if(mapped){
      // Probe the exact mapped asset before loading it. A missing mapping can
      // return the Activity's HTML entry page, even with an HTTP 200 response.
      let response:Response;
      try{response=await fetch(src,{cache:'no-store',referrerPolicy:'origin',signal:AbortSignal.timeout(10000)});}
      catch{throw new Error('No se pudo comprobar el acceso de esta actividad a YouTube.');}
      if(!isYouTubeScriptResponse(response.status,response.headers.get('Content-Type') || ''))throw new Error('La ruta de YouTube no entregó el reproductor. Revisa su configuración en Discord; puedes seguir usando Switch.');
      if(!remappingInstalled){
        const prefix=new URL(youtubeBase(location.href)).pathname;
        patchUrlMappings([{...youtubeMapping,prefix}],{patchFetch:false,patchWebSocket:false,patchXhr:false,patchSrcAttributes:true});remappingInstalled=true;
      }
    }
    return new Promise<YTConstructor>((resolve,reject)=>{
      const script=document.createElement('script');script.src=src;script.referrerPolicy='origin';
      let finished=false;
      const finish=(error?:Error)=>{if(finished)return;finished=true;clearTimeout(timer);if(error){script.remove();reject(error);}else resolve(window.YT!.Player);};
      const timer=setTimeout(()=>finish(new Error('El programa del reproductor de YouTube no terminó de cargar. Reintenta o vuelve a Switch.')),15000);
      window.onYouTubeIframeAPIReady=()=>finish();
      script.onerror=()=>finish(new Error(mapped?'Discord no pudo cargar el programa de YouTube por su ruta configurada.':'No se pudo conectar con el programa de YouTube.'));document.head.append(script);
    });
  })().catch(error=>{apiPromise=null;throw error;});return apiPromise;
}
export class YouTubeRoom {
  private player:YTPlayer|null=null;
  private state:PlaybackState|null=null;
  private ready=false;
  private generation=0;
  private quietUntil=0;
  private writing=false;
  private clockOffset=0;
  private fetching:Promise<void>|null=null;
  private stopped=false;
  private creating:Promise<void>|null=null;
  private failedRevision:number|null=null;
  private selectionGeneration=0;
  private issues=new Set<string>();
  private lastError:number|null=null;
  private loadedSelection:string|null=null;
  private autoplayBlocked=false;
  private hasPlayed=false;
  private stallTimer:number|undefined;
  private stopObservation:(()=>void)|null=null;
  private diagnostic=document.querySelector<HTMLDetailsElement>('#youtubeDiagnostic')!;
  private diagnosticText=document.querySelector<HTMLElement>('#youtubeDiagnosticText')!;
  private externalButton=document.querySelector<HTMLButtonElement>('#youtubeExternal')!;
  private dialog=document.querySelector<HTMLDialogElement>('#sourceDialog')!;
  private status=document.querySelector<HTMLElement>('#youtubeStatus')!;
  private notice=document.querySelector<HTMLElement>('#mediaNotice')!;
  private stage=document.querySelector<HTMLElement>('#stage')!;
  private mount=document.querySelector<HTMLElement>('#videoMount')!;
  private url:string;
  constructor(private changeSource:(source:'switch'|'youtube')=>Promise<void>,private volume:()=>number,private openExternal:(url:string)=>Promise<void>) {
    const params=new URLSearchParams(location.search), ticket=params.get('ticket') || '';
    const instance=params.get('instance_id') || `local-${ticket.split('.').at(-1) || 'preview'}`;
    this.url='/api/playback?'+new URLSearchParams({instance,...(ticket?{ticket}:{})});
    document.querySelector('#sourceButton')!.addEventListener('click',()=>{if(!canControlActivity())return;this.dialog.showModal();void this.refresh().catch(e=>this.message(e.message));});
    document.querySelector('#sourceClose')!.addEventListener('click',()=>this.dialog.close());
    this.dialog.addEventListener('close',()=>{this.selectionGeneration++;});
    this.dialog.addEventListener('cancel',()=>{this.selectionGeneration++;});
    document.querySelector('#youtubeForm')!.addEventListener('submit',event=>{
      event.preventDefault();void this.select().catch(e=>this.message(e.message));
    });
    document.querySelector('#switchSource')!.addEventListener('click',()=>{this.selectionGeneration++;void this.publish({source:'switch',videoId:'',playlistId:'',position:0,playing:false}).then(()=>{this.notice.hidden=true;this.message('Switch seleccionado. Puedes volver a probar YouTube.');this.dialog.close();}).catch(e=>this.message(e.message));});
    document.querySelector('#youtubePlay')!.addEventListener('click',()=>this.toggle());
    document.querySelector('#youtubeNext')!.addEventListener('click',()=>{if(canControlActivity() && this.ready && this.state?.playlistId)this.player?.nextVideo();});
    document.querySelector('#youtubeRetry')!.addEventListener('click',()=>{void this.retry().catch(e=>this.message(e.message,true));});
    this.externalButton.addEventListener('click',()=>{void this.openCurrentExternally().catch(e=>this.message(e.message));});
    document.addEventListener('securitypolicyviolation',event=>{
      if(this.isYouTube() && event.blockedURI.includes('youtube') && /^(frame|child)-src/.test(event.effectiveDirective)){
        this.failPlayer('Discord bloqueó la ventana del reproductor de YouTube. Hay que revisar su configuración en la actividad.');
      }
    });
    setInterval(()=>{if(!document.hidden && !this.stopped)void this.refresh().catch(()=>{});},1500);
    setInterval(()=>this.captureSeek(),1000);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)void this.refresh().catch(()=>{});});
    window.addEventListener('beforeunload',()=>{this.stopped=true;this.generation++;this.selectionGeneration++;this.stopWatching();});
    window.addEventListener('resize',()=>{
      if(!this.isYouTube())return;
      if(this.tooSmall()){this.generation++;this.stopWatching();this.player?.destroy();this.player=null;this.ready=false;this.mount.replaceChildren();this.message('Amplía la actividad para ver YouTube.',true);}
      else if(!this.player && this.failedRevision!==this.state?.revision)void this.ensurePlayer(this.state!);
    });
  }
  isYouTube(){return this.state?.source==='youtube';}
  setVolume(value:number){if(this.ready)this.player?.setVolume(value);}
  activate(){if(this.ready){this.player?.unMute();this.player?.playVideo();}}
  private message(value:string,visible=false){this.status.textContent=value;if(visible){this.notice.hidden=false;this.notice.textContent=value;}}
  private stopWatching(){clearTimeout(this.stallTimer);this.stallTimer=undefined;this.stopObservation?.();this.stopObservation=null;}
  private resetDiagnostics(){this.stopWatching();this.issues.clear();this.lastError=null;this.autoplayBlocked=false;this.hasPlayed=false;this.diagnostic.hidden=true;this.diagnostic.open=false;this.externalButton.hidden=true;}
  private showDiagnostic(){
    const state=this.ready?this.player?.getPlayerState():undefined;
    const labels:Record<number,string>={[-1]:'sin iniciar',0:'terminado',1:'reproduciendo',2:'pausado',3:'cargando vídeo',5:'preparado'};
    this.diagnostic.hidden=false;this.externalButton.hidden=false;
    this.diagnosticText.textContent=[`Respuesta del reproductor: ${this.ready?'recibida':'pendiente'}`,`Vídeo: ${state===undefined?'sin respuesta':labels[state] || 'estado '+state}`,...(this.lastError===null?[]:[`Código YouTube: ${this.lastError}`]),...this.issues,...(!this.issues.size?['No se registró un bloqueo de red visible desde la actividad.']:[])].join('\n');
  }
  private observeFrame(frame:HTMLIFrameElement,generation:number){
    let observed:Document|null=null;const removers:Array<()=>void>=[];
    const attach=()=>{
      if(generation!==this.generation)return;
      try{
        const doc=frame.contentDocument;if(!doc || doc===observed)return;observed=doc;
        const listener=(event:SecurityPolicyViolationEvent)=>{
          if(generation!==this.generation || this.issues.size>=12)return;
          this.issues.add(`Bloqueo ${event.effectiveDirective}: ${safeResourceLabel(event.blockedURI)}`);
          if(!this.diagnostic.hidden)this.showDiagnostic();
        };
        doc.addEventListener('securitypolicyviolation',listener);removers.push(()=>doc.removeEventListener('securitypolicyviolation',listener));
      }catch{if(this.issues.size<12)this.issues.add('El navegador no permite inspeccionar la ventana de YouTube.');}
    };
    frame.addEventListener('load',attach);attach();
    const poll=setInterval(attach,100),deadline=setTimeout(()=>clearInterval(poll),15000);
    this.stopObservation=()=>{clearInterval(poll);clearTimeout(deadline);frame.removeEventListener('load',attach);removers.forEach(remove=>remove());};
  }
  private watchPlayback(generation:number){
    if(this.stallTimer!==undefined)return;
    this.stallTimer=window.setTimeout(()=>{
      this.stallTimer=undefined;
      if(generation!==this.generation || !this.ready || !this.player || this.lastError!==null || this.autoplayBlocked)return;
      if([0,1,2].includes(this.player.getPlayerState()))return;
      this.message('YouTube respondió, pero el vídeo no terminó de cargar. Abre Información de carga o vuelve a Switch.',true);this.showDiagnostic();
    },20000);
  }
  private async openCurrentExternally(){
    const selection=this.isYouTube()?this.state!:parseYouTubeLink(document.querySelector<HTMLInputElement>('#youtubeLink')!.value);
    const url=new URL(selection.videoId?'https://www.youtube.com/watch':'https://www.youtube.com/playlist');
    if(selection.videoId)url.searchParams.set('v',selection.videoId);
    if(selection.playlistId)url.searchParams.set('list',selection.playlistId);
    if(selection.position)url.searchParams.set('t',String(Math.floor(selection.position))+'s');
    await this.openExternal(url.href);
  }
  private async select(){
    const selection=parseYouTubeLink(document.querySelector<HTMLInputElement>('#youtubeLink')!.value);
    const generation=++this.selectionGeneration,button=document.querySelector<HTMLButtonElement>('#youtubeForm button')!;
    button.disabled=true;this.message('Comprobando acceso a YouTube…');
    try{
      await loadApi();await checkEmbedAccess(selection);if(generation!==this.selectionGeneration || !this.dialog.open)return;
      await this.refresh();if(generation!==this.selectionGeneration || !this.dialog.open)return;
      this.failedRevision=null;await this.publish({...selection,source:'youtube',playing:true});this.dialog.close();
    }finally{button.disabled=false;}
  }
  async refresh(){
    if(this.fetching)return this.fetching;
    this.fetching=(async()=>{const res=await fetch(this.url,{cache:'no-store'});if(!res.ok)throw new Error('Abre la actividad en Discord para compartir la reproducción');const value=await res.json() as PlaybackState;this.clockOffset=(value.serverNow ?? Date.now())-Date.now();await this.apply(value);})();
    try{await this.fetching;}finally{this.fetching=null;}
  }
  private async publish(value:Partial<PlaybackState>){
    if(!canControlActivity())throw new Error('Solo el host puede cambiar la reproducción');
    if(this.writing)return;this.writing=true;
    try{
      if(!this.state)await this.refresh();
      const res=await fetch(this.url,{method:'PUT',headers:{...hostHeaders(),'Content-Type':'application/json'},body:JSON.stringify({...this.state,...value,revision:this.state!.revision})});
      const next=await res.json();if(res.status===409){await this.apply(next);throw new Error('La reproducción cambió; vuelve a intentarlo');}
      if(!res.ok)throw new Error(next.error || 'No se pudo compartir el cambio');await this.apply(next);
    }finally{this.writing=false;}
  }
  private async apply(next:PlaybackState){
    if(this.state && next.revision<this.state.revision)return;
    const old=this.state;this.state=next;
    if(old?.source!==next.source){
      this.generation++;this.ready=false;this.player?.destroy();this.player=null;
      this.loadedSelection=null;
      this.resetDiagnostics();
      this.notice.hidden=true;this.status.textContent=next.source==='switch'?'Switch seleccionado. Puedes volver a probar YouTube.':'Preparando YouTube…';
      await this.changeSource(next.source);
      document.querySelector('#sourceButton')!.textContent=`Fuente: ${next.source==='youtube'?'YouTube':'Switch'}`;
    }
    if(next.source!=='youtube')return;
    if(!this.player){if(this.failedRevision!==next.revision)void this.ensurePlayer(next);return;}
    if(!this.ready)return;
    const time=playbackPosition(next,Date.now()+this.clockOffset),selection=playbackSelectionKey(next),playerState=this.player.getPlayerState();
    if(selection!==this.loadedSelection){
      this.loadedSelection=selection;
      const nativeMatches=next.playlistId?old?.playlistId===next.playlistId && (next.index ?? 0)===this.player.getPlaylistIndex():next.videoId===this.player.getVideoData().video_id;
      if(!nativeMatches){this.quietUntil=performance.now()+2500;
        this.hasPlayed=false;this.lastError=null;this.autoplayBlocked=false;this.issues.clear();this.notice.hidden=true;this.diagnostic.hidden=true;this.externalButton.hidden=true;
        if(next.playlistId)this.player.loadPlaylist({list:next.playlistId,listType:'playlist',index:next.index ?? 0,startSeconds:time});
        else this.player.loadVideoById({videoId:next.videoId,startSeconds:time});
        if(next.playing)this.watchPlayback(this.generation);
      }
    } else if([1,2].includes(playerState) && Math.abs(this.player.getCurrentTime()-time)>3){this.quietUntil=performance.now()+1500;this.player.seekTo(time,true);}
    if(this.lastError===null && needsPlaybackCommand(playerState,next.playing)){this.quietUntil=performance.now()+1500;if(next.playing)this.player.playVideo();else this.player.pauseVideo();}
  }
  private async ensurePlayer(initial:PlaybackState){
    if(this.creating)return this.creating;
    const revision=initial.revision;
    this.creating=this.createPlayer(initial).catch(error=>{
      if(this.isYouTube() && this.state?.revision===revision){this.failedRevision=revision;this.message(error.message,true);}
    });
    try{await this.creating;}finally{this.creating=null;}
  }
  private failPlayer(value:string){
    this.showDiagnostic();this.stopWatching();
    this.generation++;this.ready=false;this.player?.destroy();this.player=null;this.mount.replaceChildren();this.failedRevision=this.state?.revision ?? null;this.message(value,true);
  }
  private async createPlayer(initial:PlaybackState){
    if(this.tooSmall()){this.message('Amplía la actividad para ver YouTube.',true);return;}
    const generation=++this.generation;
    const Player=await loadApi();await checkEmbedAccess(initial);if(generation!==this.generation || !this.isYouTube())return;
    this.resetDiagnostics();
    const target=document.createElement('iframe');
    target.src=youtubeEmbedUrl(location.href,{...initial,position:playbackPosition(initial,Date.now()+this.clockOffset)});
    target.title='YouTube';target.width='100%';target.height='100%';target.allowFullscreen=true;
    target.allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';target.referrerPolicy='origin';
    this.mount.replaceChildren(target);
    this.observeFrame(target,generation);
    this.quietUntil=performance.now()+2500;
    this.loadedSelection=playbackSelectionKey(initial);
    // With an existing iframe the official API infers the message origin from
    // its src. Passing the mapped base as `host` includes /youtube and causes
    // the API to reject every MessageEvent.origin, which contains no path.
    this.player=new Player(target,{width:'100%',height:'100%',videoId:initial.videoId || undefined,
      playerVars:{enablejsapi:1,origin:location.origin,playsinline:1,controls:1,autoplay:initial.playing?1:0,start:Math.floor(playbackPosition(initial,Date.now()+this.clockOffset)),...(initial.playlistId?{listType:'playlist',list:initial.playlistId}: {})},
      events:{onReady:event=>{
        if(generation!==this.generation)return;this.ready=true;this.player=event.target;event.target.setVolume(this.volume());this.hasPlayed=event.target.getPlayerState()===1;
        if(this.lastError===null){this.notice.hidden=true;this.message('Reproductor de YouTube listo. Esperando el vídeo…');}else this.showDiagnostic();
        if(initial.playlistId && !initial.videoId)event.target.loadPlaylist({list:initial.playlistId,listType:'playlist',index:initial.index ?? 0,startSeconds:initial.position});
        void this.apply(this.state!);
        if(initial.playing)this.watchPlayback(generation);
      },onStateChange:event=>{
        if(generation!==this.generation)return;
        if(event.data===3)this.watchPlayback(generation);
        if(event.data===1){this.hasPlayed=true;this.lastError=null;this.autoplayBlocked=false;}
        if([0,1,2].includes(event.data)){clearTimeout(this.stallTimer);this.stallTimer=undefined;this.capture(true);}
        if(event.data===1){this.lastError=null;this.autoplayBlocked=false;this.notice.hidden=true;this.diagnostic.hidden=true;this.externalButton.hidden=true;this.message('YouTube reproduciendo. Los cambios se comparten en esta actividad.');}
      },
      onAutoplayBlocked:()=>{if(generation===this.generation){this.autoplayBlocked=true;this.message('Pulsa reproducir en YouTube para activar el vídeo y su audio.',true);}},
      onError:event=>{if(generation!==this.generation)return;this.lastError=event.data;const reasons:Record<number,string>={2:'Enlace inválido.',5:'No se pudo reproducir este vídeo.',100:'Este vídeo es privado o ya no está disponible.',101:'El autor no permite reproducir este vídeo aquí.',150:'El autor no permite reproducir este vídeo aquí.',153:'YouTube no reconoció esta actividad como reproductor (código 153).'};this.message(reasons[event.data] || 'No se pudo abrir YouTube. Prueba otro vídeo.',true);this.showDiagnostic();},
    }});
    setTimeout(()=>{if(generation===this.generation && !this.ready)this.failPlayer('La ventana de YouTube no respondió. Reintenta o vuelve a Switch.');},15000);
  }
  private captureSeek(){if(!canControlActivity() || !this.ready || !this.hasPlayed || this.lastError!==null || this.autoplayBlocked || !this.state || !this.player || performance.now()<this.quietUntil)return;const expected=playbackPosition(this.state,Date.now()+this.clockOffset);if([1,2].includes(this.player.getPlayerState()) && Math.abs(this.player.getCurrentTime()-expected)>3)this.capture(true);}
  private capture(force=false){
    if(!canControlActivity() || !this.ready || !this.hasPlayed || this.lastError!==null || this.autoplayBlocked || !this.player || !this.state || !this.isYouTube() || this.writing || performance.now()<this.quietUntil)return;
    const videoId=this.player.getVideoData().video_id || this.state.videoId,playing=this.player.getPlayerState()===1;
    if(force)void this.publish({videoId,playing,position:this.player.getCurrentTime(),index:Math.max(0,this.player.getPlaylistIndex())}).catch(e=>this.message(e.message));
  }
  private toggle(){if(!canControlActivity() || !this.ready || !this.player)return;[1,3].includes(this.player.getPlayerState())?this.player.pauseVideo():this.player.playVideo();}
  private tooSmall(){return innerWidth<216 || innerHeight<280;}
  async retry(){if(!this.isYouTube())return;this.generation++;this.resetDiagnostics();this.failedRevision=null;this.player?.destroy();this.player=null;this.ready=false;await this.apply(this.state!);}
}
