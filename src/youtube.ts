import {parseYouTubeLink,playbackPosition,type PlaybackState} from '../youtube-model.mjs';
type YTPlayer = {destroy():void;playVideo():void;pauseVideo():void;seekTo(t:number,allow:boolean):void;setVolume(n:number):void;unMute():void;getPlayerState():number;getCurrentTime():number;getVideoData():{video_id?:string};getPlaylistIndex():number;nextVideo():void;loadVideoById(value:{videoId:string;startSeconds:number}):void;loadPlaylist(value:{list:string;listType:string;index:number;startSeconds:number}):void};
type YTConstructor = new (mount:HTMLElement,options:{videoId?:string;width:string;height:string;playerVars:Record<string,string|number>;events:Record<string,(event:{data:number;target:YTPlayer})=>void>})=>YTPlayer;
declare global {interface Window {YT?:{Player:YTConstructor};onYouTubeIframeAPIReady?:()=>void}}
let apiPromise:Promise<YTConstructor>|null=null;
function loadApi() {
  if(window.YT?.Player)return Promise.resolve(window.YT.Player);
  if(apiPromise)return apiPromise;
  apiPromise=new Promise<YTConstructor>((resolve,reject)=>{
    const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';script.referrerPolicy='strict-origin-when-cross-origin';
    const timer=setTimeout(()=>{script.remove();apiPromise=null;reject(new Error('YouTube no pudo conectarse en esta actividad.'));},15000);
    window.onYouTubeIframeAPIReady=()=>{clearTimeout(timer);resolve(window.YT!.Player);};
    script.onerror=()=>{clearTimeout(timer);script.remove();apiPromise=null;reject(new Error('Discord o la conexión bloquearon YouTube.'));};document.head.append(script);
  });return apiPromise;
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
  private dialog=document.querySelector<HTMLDialogElement>('#sourceDialog')!;
  private status=document.querySelector<HTMLElement>('#youtubeStatus')!;
  private notice=document.querySelector<HTMLElement>('#mediaNotice')!;
  private stage=document.querySelector<HTMLElement>('#stage')!;
  private mount=document.querySelector<HTMLElement>('#videoMount')!;
  private url:string;
  constructor(private changeSource:(source:'switch'|'youtube')=>Promise<void>,private volume:()=>number) {
    const params=new URLSearchParams(location.search), ticket=params.get('ticket') || '';
    const instance=params.get('instance_id') || `local-${ticket.split('.').at(-1) || 'preview'}`;
    this.url='/api/playback?'+new URLSearchParams({instance,...(ticket?{ticket}:{})});
    document.querySelector('#sourceButton')!.addEventListener('click',()=>{this.dialog.showModal();void this.refresh().catch(e=>this.message(e.message));});
    document.querySelector('#sourceClose')!.addEventListener('click',()=>this.dialog.close());
    document.querySelector('#youtubeForm')!.addEventListener('submit',event=>{
      event.preventDefault();void this.select().catch(e=>this.message(e.message));
    });
    document.querySelector('#switchSource')!.addEventListener('click',()=>{void this.publish({source:'switch',videoId:'',playlistId:'',position:0,playing:false}).then(()=>this.dialog.close()).catch(e=>this.message(e.message));});
    document.querySelector('#youtubePlay')!.addEventListener('click',()=>this.toggle());
    document.querySelector('#youtubeNext')!.addEventListener('click',()=>{if(this.ready && this.state?.playlistId)this.player?.nextVideo();});
    document.addEventListener('securitypolicyviolation',event=>{if(event.blockedURI.includes('youtube'))this.message('Discord bloqueó el acceso a YouTube. La integración necesita habilitar ese dominio.',true);});
    setInterval(()=>{if(!document.hidden && !this.stopped)void this.refresh().catch(()=>{});},1500);
    setInterval(()=>this.captureSeek(),1000);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)void this.refresh().catch(()=>{});});
    window.addEventListener('beforeunload',()=>{this.stopped=true;this.generation++;});
    window.addEventListener('resize',()=>{
      if(!this.isYouTube())return;
      if(this.tooSmall()){this.generation++;this.player?.destroy();this.player=null;this.ready=false;this.mount.replaceChildren();this.message('Amplía la actividad para ver YouTube.',true);}
      else if(!this.player)void this.createPlayer(this.state!).catch(e=>this.message(e.message,true));
    });
  }
  isYouTube(){return this.state?.source==='youtube';}
  setVolume(value:number){if(this.ready)this.player?.setVolume(value);}
  activate(){if(this.ready){this.player?.unMute();this.player?.playVideo();}}
  private message(value:string,visible=false){this.status.textContent=value;if(visible){this.notice.hidden=false;this.notice.textContent=value;}}
  private async select(){
    const selection=parseYouTubeLink(document.querySelector<HTMLInputElement>('#youtubeLink')!.value);
    await this.refresh();await this.publish({...selection,source:'youtube',playing:true});this.dialog.close();
  }
  async refresh(){
    if(this.fetching)return this.fetching;
    this.fetching=(async()=>{const res=await fetch(this.url,{cache:'no-store'});if(!res.ok)throw new Error('Abre la actividad en Discord para compartir la reproducción');const value=await res.json() as PlaybackState;this.clockOffset=(value.serverNow ?? Date.now())-Date.now();await this.apply(value);})();
    try{await this.fetching;}finally{this.fetching=null;}
  }
  private async publish(value:Partial<PlaybackState>){
    if(this.writing)return;this.writing=true;
    try{
      if(!this.state)await this.refresh();
      const res=await fetch(this.url,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...this.state,...value,revision:this.state!.revision})});
      const next=await res.json();if(res.status===409){await this.apply(next);throw new Error('La reproducción cambió; vuelve a intentarlo');}
      if(!res.ok)throw new Error(next.error || 'No se pudo compartir el cambio');await this.apply(next);
    }finally{this.writing=false;}
  }
  private async apply(next:PlaybackState){
    if(this.state && next.revision<this.state.revision)return;
    const old=this.state;this.state=next;
    if(old?.source!==next.source){
      this.generation++;this.ready=false;this.player?.destroy();this.player=null;
      await this.changeSource(next.source);
      document.querySelector('#sourceButton')!.textContent=`Fuente: ${next.source==='youtube'?'YouTube':'Switch'}`;
    }
    if(next.source!=='youtube')return;
    if(!this.player){void this.createPlayer(next).catch(e=>this.message(e.message,true));return;}
    if(!this.ready)return;
    const time=playbackPosition(next,Date.now()+this.clockOffset),current=this.player.getVideoData().video_id;
    const different = next.playlistId ? old?.playlistId!==next.playlistId || (next.index ?? 0)!==this.player.getPlaylistIndex() : next.videoId!==current;
    if(different){this.quietUntil=performance.now()+2500;
      if(next.playlistId)this.player.loadPlaylist({list:next.playlistId,listType:'playlist',index:next.index ?? 0,startSeconds:time});
      else this.player.loadVideoById({videoId:next.videoId,startSeconds:time});
    } else if(Math.abs(this.player.getCurrentTime()-time)>3){this.quietUntil=performance.now()+1500;this.player.seekTo(time,true);}
    const playing=this.player.getPlayerState()===1;
    if(playing!==next.playing){this.quietUntil=performance.now()+1500;if(next.playing)this.player.playVideo();else this.player.pauseVideo();}
  }
  private async createPlayer(initial:PlaybackState){
    if(this.tooSmall()){this.message('Amplía la actividad para ver YouTube.',true);return;}
    const generation=++this.generation;
    const Player=await loadApi();if(generation!==this.generation || !this.isYouTube())return;
    const target=document.createElement('div');this.mount.replaceChildren(target);
    this.quietUntil=performance.now()+2500;
    this.player=new Player(target,{width:'100%',height:'100%',videoId:initial.videoId || undefined,
      playerVars:{enablejsapi:1,origin:location.origin,playsinline:1,controls:1,autoplay:initial.playing?1:0,start:Math.floor(playbackPosition(initial,Date.now()+this.clockOffset)),...(initial.playlistId?{listType:'playlist',list:initial.playlistId}: {})},
      events:{onReady:event=>{
        if(generation!==this.generation)return;this.ready=true;this.player=event.target;event.target.setVolume(this.volume());
        this.notice.hidden=true;this.message('YouTube conectado. Los cambios se comparten en esta actividad.');
        if(initial.playlistId && !initial.videoId)event.target.loadPlaylist({list:initial.playlistId,listType:'playlist',index:initial.index ?? 0,startSeconds:initial.position});
        void this.apply(this.state!);
      },onStateChange:event=>{if(generation===this.generation && [1,2,0].includes(event.data))this.capture(true);},
      onAutoplayBlocked:()=>this.message('Pulsa reproducir en YouTube para activar el vídeo y su audio.',true),
      onError:event=>{const reasons:Record<number,string>={2:'Enlace inválido.',5:'No se pudo reproducir este vídeo.',100:'Este vídeo es privado o ya no está disponible.',101:'El autor no permite reproducir este vídeo aquí.',150:'El autor no permite reproducir este vídeo aquí.',153:'YouTube no reconoció esta actividad como reproductor.'};this.message(reasons[event.data] || 'No se pudo abrir YouTube. Prueba otro vídeo.',true);},
    }});
    setTimeout(()=>{if(generation===this.generation && !this.ready)this.message('YouTube no respondió. Revisa la conexión o vuelve a Switch.',true);},15000);
  }
  private captureSeek(){if(!this.ready || !this.state || !this.player || performance.now()<this.quietUntil)return;const expected=playbackPosition(this.state,Date.now()+this.clockOffset);if([1,2].includes(this.player.getPlayerState()) && Math.abs(this.player.getCurrentTime()-expected)>3)this.capture(true);}
  private capture(force=false){
    if(!this.ready || !this.player || !this.state || !this.isYouTube() || this.writing || performance.now()<this.quietUntil)return;
    const videoId=this.player.getVideoData().video_id || this.state.videoId,playing=this.player.getPlayerState()===1;
    if(force)void this.publish({videoId,playing,position:this.player.getCurrentTime(),index:Math.max(0,this.player.getPlaylistIndex())}).catch(e=>this.message(e.message));
  }
  private toggle(){if(!this.ready || !this.player)return;this.player.getPlayerState()===1?this.player.pauseVideo():this.player.playVideo();}
  private tooSmall(){return innerWidth<216 || innerHeight<280;}
  async retry(){if(!this.isYouTube())return;this.generation++;this.player?.destroy();this.player=null;this.ready=false;await this.apply(this.state!);}
}
