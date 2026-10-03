import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {build} from 'esbuild';

test('historical signal labels follow decoded frames, loss and recovery without stale waiting timers',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const dom=new JSDOM(html,{url:'https://test.invalid/?editorPreview=1',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 const compiled=await build({entryPoints:[new URL('../src/main.ts',import.meta.url).pathname],bundle:true,write:false,format:'iife',loader:{'.css':'empty'},plugins:[{name:'viewer-test',setup(b){b.onLoad({filter:/\/cloudflare\.ts$/},()=>({contents:'export class CloudflareViewer {constructor(_a,track,lost){window.testTrack=track;window.testLost=lost} async start(){} stop(){}}',loader:'ts'}))}}]});
 const timers=new Map(),intervals=[];let timerId=0,frame,now=1000;
 w.structuredClone=structuredClone;w.Image.prototype.decode=async()=>{};w.innerWidth=1200;w.innerHeight=800;
 w.performance.now=()=>now;w.setTimeout=(fn,delay)=>{timers.set(++timerId,{fn,delay});return timerId};w.clearTimeout=id=>timers.delete(id);
 w.setInterval=(fn,delay)=>{intervals.push({fn,delay});return intervals.length};
 w.HTMLCanvasElement.prototype.getContext=()=>null;w.HTMLMediaElement.prototype.play=async()=>{};
 w.HTMLVideoElement.prototype.requestVideoFrameCallback=fn=>{frame=fn};w.MediaStream=class{constructor(tracks){this.tracks=tracks}};
 Object.defineProperties(w.HTMLElement.prototype,{clientWidth:{get(){return 1200}},clientHeight:{get(){return 800}}});
 w.__shisDiscordSession={accessToken:'test',sdk:{ready:async()=>{},subscribe:async()=>{},commands:{getActivityInstanceConnectedParticipants:async()=>({participants:[]})}}};
 w.fetch=async url=>({ok:true,status:200,json:async()=>new URL(url,'https://test.invalid').pathname==='/api/config'?{discordClientId:'test'}:{items:[]}});
 const status=()=>w.document.querySelector('#statusText').textContent;
 try{
  w.eval(compiled.outputFiles[0].text);await new Promise(r=>setTimeout(r,20));
  assert.equal(status(),'BUSCANDO SEÑAL…');
  const track=new w.EventTarget();w.testTrack('video',track);assert.equal(status(),'SEÑAL DETECTADA…');
  frame();assert.equal(status(),'');assert.equal(w.document.querySelector('#liveBadge').textContent,'PLAY');
  assert.equal(w.document.querySelector('#signal').hidden,true);assert.equal([...timers.values()].some(t=>t.delay===8000),false);
  // A stalled source retains its track so the next decoded frame can recover.
  now+=9000;intervals.find(t=>t.delay===2000).fn();assert.equal(status(),'SEÑAL PERDIDA');
  const waiting=[...timers.entries()].find(([,t])=>t.delay===2000);waiting[1].fn();timers.delete(waiting[0]);assert.equal(status(),'ESPERANDO SEÑAL…');
  frame();assert.equal(status(),'');assert.equal(w.document.querySelector('#signal').hidden,true);
  track.dispatchEvent(new w.Event('ended'));assert.equal(status(),'SEÑAL PERDIDA');assert.equal(w.document.querySelector('#video').srcObject,null);
  const replacement=new w.EventTarget();w.testTrack('video',replacement);frame();
  assert.equal(status(),'');assert.equal([...timers.values()].some(t=>t.delay===2000),false);
  track.dispatchEvent(new w.Event('ended'));assert.equal(w.document.querySelector('#signal').hidden,true);
  assert.deepEqual([...w.document.querySelectorAll('#controls .control-label')].map(n=>n.textContent),['Ajustes','Volumen','Salir']);
 }finally{w.close()}
});
