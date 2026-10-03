import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {build} from 'esbuild';

test('fresh activity edits and saves a figure while retaining other views, assets and library; spectators remain read-only',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const dom=new JSDOM(html,{url:'https://test.invalid/?instance_id=testing&ticket=test',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 const compiled=await build({entryPoints:[new URL('../src/main.ts',import.meta.url).pathname],bundle:true,write:false,format:'iife',loader:{'.css':'empty'}});
 const id='caf517c5-4a43-4b50-bb2c-ff71ca96d42a';
 let manifest={items:[{id,name:'Mi figura',asset:'e3d26189-65be-4c3b-ae4e-93b4f62b2a8c.png',placements:{'home-landscape-16x9':{x:17,y:60,width:13,rotation:0,opacity:1,z:10,hidden:false,anchor:'scene'},'home-portrait-16x9':{x:55,y:78,width:21,rotation:4,opacity:.8,z:11,hidden:false,anchor:'frame'}}}],library:[{asset:'saved-library.png'}]};
 const before=structuredClone(manifest),timers=[];let state={aspect:'16:9',scene:'home',retro:'immersive',smoothing:true,revision:0,epoch:'test',host:true};let participantCallback;
 w.innerWidth=1200;w.innerHeight=800;w.structuredClone=structuredClone;w.Image.prototype.decode=async()=>{};
 w.HTMLCanvasElement.prototype.getContext=()=>({createImageData:(width,height)=>({data:new Uint8ClampedArray(width*height*4)}),putImageData:()=>{}});
 w.HTMLMediaElement.prototype.play=async()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};w.HTMLElement.prototype.setPointerCapture=()=>{};
 Object.defineProperties(w.HTMLElement.prototype,{clientWidth:{get(){return parseFloat(this.style.width)||(this.id==='preview'?700:1200)}},clientHeight:{get(){return parseFloat(this.style.height)||(this.id==='preview'?600:800)}}});
 w.setInterval=(fn,delay)=>{timers.push({fn,delay});return timers.length};
 w.__shisDiscordSession={accessToken:'test-access',sdk:{ready:async()=>{},subscribe:async(_event,cb)=>{participantCallback=cb},commands:{getActivityInstanceConnectedParticipants:async()=>({participants:[]})},close:()=>{}}};
 w.fetch=async(url,init={})=>{const path=new URL(url,'https://test.invalid').pathname;
 let body={};if(path==='/api/config')body={discordClientId:'test'};else if(path==='/api/activity-controls'){if(init.method==='PUT')state={...state,...JSON.parse(init.body),revision:state.revision+1};body=state;}else if(path==='/api/decorations'){if(init.method==='PUT'){manifest=JSON.parse(init.body);body={ok:true}}else body=manifest}else if(path==='/api/cloudflare/stream')body={sessionId:null};
 return {ok:true,status:200,json:async()=>structuredClone(body)};};
 try{
 w.eval(compiled.outputFiles[0].text);await new Promise(r=>setTimeout(r,30));
 assert.equal(w.document.querySelector('#loading').hidden,true);assert.equal(w.document.querySelector('#options').hidden,false);
 assert.equal(w.document.querySelector('#backdrop').getAttribute('src'),'/rooms/approved-crt-wide.jpg');assert.equal(w.document.querySelector('#oneBg'),null);assert.equal(w.document.querySelector('#staticNoise').hidden,false);
 w.document.querySelector('#edit').click();await new Promise(r=>setTimeout(r,10));assert.equal(w.document.querySelector('#editor').hidden,false);
 const size=w.document.querySelector('#size');size.dispatchEvent(new w.Event('pointerdown'));size.value='25';size.dispatchEvent(new w.Event('input'));
 w.document.querySelector('[data-tv=flat]').click();w.document.querySelector('#save').click();await new Promise(r=>setTimeout(r,20));
 assert.equal(manifest.items[0].placements['home-landscape-16x9'].width,25);assert.deepEqual(manifest.items[0].placements['home-portrait-16x9'],before.items[0].placements['home-portrait-16x9']);
 assert.equal(manifest.items[0].asset,before.items[0].asset);assert.deepEqual(manifest.library,before.library);assert.equal(manifest.presentations['home-landscape-16x9'].tvModel,'flat-modern');
 w.document.querySelector('#closeEditor').click();await new Promise(r=>setTimeout(r,10));assert.equal(w.document.querySelector('#backdrop').getAttribute('src'),'/rooms/approved-flat-wide.jpg');assert.equal(w.document.querySelector('#staticNoise').hidden,true);
 state={...state,scene:'arcade'};await timers.find(t=>t.delay===1500).fn();await new Promise(r=>setTimeout(r,10));
 w.document.querySelector('[data-live-tv=crt]').click();await new Promise(r=>setTimeout(r,20));assert.equal(state.scene,'home');assert.equal(w.document.querySelector('#backdrop').getAttribute('src'),'/rooms/approved-crt-wide.jpg');assert.equal(w.document.querySelector('#staticNoise').hidden,false);
 assert.deepEqual(manifest.items[0].placements['home-portrait-16x9'],before.items[0].placements['home-portrait-16x9']);assert.equal(manifest.presentations['home-portrait-4x3'].tvModel,'original');
 const event=new w.Event('contextmenu',{bubbles:true,cancelable:true});w.document.querySelector('#screen').dispatchEvent(event);assert.equal(event.defaultPrevented,true);
 const fieldEvent=new w.Event('selectstart',{bubbles:true,cancelable:true});w.document.querySelector('#hostKey').dispatchEvent(fieldEvent);assert.equal(fieldEvent.defaultPrevented,false);
 state={...state,host:false};await timers.find(t=>t.delay===1500).fn();await new Promise(r=>setTimeout(r,10));
 assert.equal(w.document.querySelector('#options').hidden,true);w.document.querySelector('#edit').click();assert.equal(w.document.querySelector('#editor').hidden,true);
 assert.equal(typeof participantCallback,'function');assert.equal(w.document.documentElement.classList.contains('one-room'),false);
 }finally{dom.window.close()}
});
