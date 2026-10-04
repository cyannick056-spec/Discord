import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {build} from 'esbuild';
import {tvModels} from '../public/tv/models.mjs';

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
 let body={};if(path==='/api/config')body={discordClientId:'test'};else if(path==='/api/activity-controls'){if(init.method==='PUT')state={...state,...JSON.parse(init.body),revision:state.revision+1};body=state;}else if(path==='/api/decorations'){if(init.method==='PUT'){manifest=JSON.parse(init.body);body={ok:true}}else body=manifest}else if(path==='/api/decorations/assets')body={asset:'e3d26189-65be-4c3b-ae4e-93b4f62b2a8c.png'};else if(path==='/api/cloudflare/stream')body={sessionId:null};
 return {ok:true,status:200,json:async()=>structuredClone(body)};};
 try{
 w.eval(compiled.outputFiles[0].text);await new Promise(r=>setTimeout(r,30));
 assert.equal(w.document.querySelector('#loading').hidden,true);assert.equal(w.document.querySelector('#options').hidden,false);
 assert.equal(w.document.querySelector('#backdrop').getAttribute('src'),'/rooms/hd-v3/midnight-wide.webp');assert.equal(w.document.querySelector('#oneBg'),null);assert.equal(w.document.querySelector('#staticNoise').hidden,false);
 w.document.querySelector('#edit').click();await new Promise(r=>setTimeout(r,10));assert.equal(w.document.querySelector('#editor').hidden,false);
 const inspectionCamera=structuredClone(manifest.presentations??{});
 w.document.querySelector('#preview').dispatchEvent(new w.WheelEvent('wheel',{deltaY:-100,clientX:300,clientY:200,bubbles:true,cancelable:true}));
 assert.equal(w.document.querySelector('#inspectZoom').textContent,'112%');assert.deepEqual(manifest.presentations??{},inspectionCamera);
 w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'0',ctrlKey:true,bubbles:true,cancelable:true}));assert.equal(w.document.querySelector('#inspectZoom').textContent,'100%');
 w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight',shiftKey:true,bubbles:true,cancelable:true}));
 w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'z',ctrlKey:true,bubbles:true,cancelable:true}));
 w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'z',ctrlKey:true,shiftKey:true,bubbles:true,cancelable:true}));
 w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'z',ctrlKey:true,bubbles:true,cancelable:true}));
 const initialMode=w.document.querySelector('#initialMode');initialMode.value='arcade';initialMode.dispatchEvent(new w.Event('change'));w.document.querySelector('#setInitial').click();
 const beforeTv=parseFloat(w.document.querySelector('#previewRoom .tv-frame').style.width),beforeGlass=parseFloat(w.document.querySelector('#previewRoom .screen').style.width);
 for(const [id,value] of [['tvSize','1.4'],['tvX','12'],['tvY','-8']]){const input=w.document.querySelector('#'+id);input.dispatchEvent(new w.Event('pointerdown'));input.value=value;input.dispatchEvent(new w.Event('input'))}
 w.document.querySelector('[data-tv-color="#b8bbbf"]').click();await new Promise(r=>setTimeout(r,10));
 assert.ok(Math.abs(parseFloat(w.document.querySelector('#previewRoom .tv-frame').style.width)/beforeTv-1.4)<1e-8);
 assert.ok(Math.abs(parseFloat(w.document.querySelector('#previewRoom .screen').style.width)/beforeGlass-1.4)<1e-8);
 assert.equal(w.document.querySelector('#previewRoom .tv-tint').style.opacity,'1');
 assert.equal(w.document.querySelector('#previewRoom .screen').style.filter,'');assert.equal(w.document.querySelector('#previewRoom .figure').style.filter,'');
 w.document.querySelector('[data-tab=room]').click();
 const preview=w.document.querySelector('#previewRoom'),tv=preview.querySelector('.tv-frame'),photo=preview.querySelector('.photo'),m=tvModels.crt,units=parseFloat(tv.style.width)/m.width;
 const cx=parseFloat(photo.style.left)+parseFloat(tv.style.left)+(m.body[0]+m.body[2]/2)*units,cy=parseFloat(photo.style.top)+parseFloat(tv.style.top)+(m.body[1]+m.body[3]/2)*units;
 const tvPointer=(type,x,y)=>{const e=new w.MouseEvent(type,{clientX:x,clientY:y,button:0,bubbles:true,cancelable:true});Object.defineProperty(e,'pointerId',{value:1});return e};
 preview.dispatchEvent(tvPointer('pointerdown',cx,cy));preview.dispatchEvent(tvPointer('pointermove',cx+40,cy+20));preview.dispatchEvent(tvPointer('pointerup',cx+40,cy+20));
 assert.ok(Number(w.document.querySelector('#tvX').value)>12);assert.ok(Number(w.document.querySelector('#tvY').value)>-8);
 w.document.querySelector('#undo').click();assert.equal(w.document.querySelector('#tvX').value,'12');assert.equal(w.document.querySelector('#tvY').value,'-8');

 const size=w.document.querySelector('#size');size.dispatchEvent(new w.Event('pointerdown'));size.value='25';size.dispatchEvent(new w.Event('input'));
 w.document.querySelector('[data-tv=flat]').click();w.document.querySelector('#save').click();await new Promise(r=>setTimeout(r,20));
 assert.deepEqual(manifest.initialScene,{scene:'arcade',aspect:'16:9',retro:'immersive',smoothing:true});
 assert.deepEqual(manifest.presentations['home-landscape-16x9'].tv,{zoom:1.4,x:12,y:-8});assert.equal(manifest.presentations['home-landscape-16x9'].tvPaint.body,'#b8bbbf');assert.equal(manifest.presentations['home-portrait-16x9'].tv,undefined);
 assert.equal(manifest.items[0].placements['home-landscape-16x9'].width,25);assert.deepEqual(manifest.items[0].placements['home-portrait-16x9'],before.items[0].placements['home-portrait-16x9']);
 assert.equal(w.document.querySelector('#previewRoom .tv-tint').style.maskImage,`url("${tvModels.flat.src}")`);assert.equal(w.document.querySelector('#previewRoom .tv-frame img').style.filter.includes('blur'),false);assert.equal(manifest.presentations['home-landscape-16x9'].tvPaint.modelRevision,2);
 assert.equal(manifest.items[0].asset,before.items[0].asset);assert.deepEqual(manifest.library,before.library);assert.equal(manifest.presentations['home-landscape-16x9'].tvModel,'flat-modern');
 w.document.querySelector('#closeEditor').click();await new Promise(r=>setTimeout(r,10));assert.equal(w.document.querySelector('#backdrop').getAttribute('src'),'/rooms/hd-v3/midnight-wide.webp');assert.equal(w.document.querySelector('#staticNoise').hidden,true);
 state={...state,scene:'arcade'};await timers.find(t=>t.delay===1500).fn();await new Promise(r=>setTimeout(r,10));
 w.document.querySelector('[data-live-tv=crt]').click();await new Promise(r=>setTimeout(r,20));assert.equal(state.scene,'home');assert.equal(w.document.querySelector('#backdrop').getAttribute('src'),'/rooms/hd-v3/midnight-wide.webp');assert.equal(w.document.querySelector('#staticNoise').hidden,false);
 assert.deepEqual(manifest.items[0].placements['home-portrait-16x9'],before.items[0].placements['home-portrait-16x9']);assert.equal(manifest.presentations['home-portrait-4x3'].tvModel,'original');
 const preserved=structuredClone(manifest.items);
 w.document.querySelector('[data-live-theme=midnight]').click();await new Promise(r=>setTimeout(r,20));
 assert.equal(w.document.querySelector('#backdrop').getAttribute('src'),'/rooms/hd-v3/midnight-wide.webp');assert.deepEqual(manifest.items,preserved);assert.equal(manifest.presentations['home-portrait-4x3'].roomTheme,'midnight');
 w.document.querySelector('#edit').click();w.document.querySelector('[data-theme=rain]').click();w.document.querySelector('#save').click();await new Promise(r=>setTimeout(r,20));w.document.querySelector('#closeEditor').click();
 assert.equal(manifest.presentations['home-landscape-4x3'].roomTheme,'rain');assert.equal(manifest.presentations['home-portrait-4x3'].roomTheme,'midnight');assert.deepEqual(manifest.items,preserved);
 w.document.querySelector('[data-live-tv=flat]').click();await new Promise(r=>setTimeout(r,20));assert.equal(w.document.querySelector('#backdrop').getAttribute('src'),'/rooms/hd-v3/midnight-wide.webp');

 w.document.querySelector('#edit').click();await new Promise(r=>setTimeout(r,10));
 for(const tab of ['background','room','video','camera','figures','spectators','initial']){w.document.querySelector(`[data-tab=${tab}]`).click();assert.equal(w.document.querySelector(`[data-editor-section=${tab}]`).hidden,false);assert.equal(w.document.querySelectorAll('[data-editor-section]:not([hidden])').length,1)}
 assert.ok(w.document.querySelector('#tvSize'));assert.equal(w.document.querySelector('[data-edit-aspect]'),null);
 const mode=w.document.querySelector('#editScene');mode.value='arcade';mode.dispatchEvent(new w.Event('change'));await new Promise(r=>setTimeout(r,10));
 for(const id of ['backgroundUpload','overlayUpload']){const input=w.document.querySelector('#'+id);Object.defineProperty(input,'files',{value:[new w.File(['image'],'retroarch.png',{type:'image/png'})],configurable:true});input.dispatchEvent(new w.Event('change'));await new Promise(r=>setTimeout(r,10))}
 for(const [id,value]of [['videoZoom','1.7'],['videoX','-8'],['apertureWidth','60'],['apertureHeight','55'],['zoom','1.4']]){const input=w.document.querySelector('#'+id);input.dispatchEvent(new w.Event('pointerdown'));input.value=value;input.dispatchEvent(new w.Event('input'))}
 await new Promise(r=>setTimeout(r,10));
 const pr=w.document.querySelector('#previewRoom'),ps=pr.querySelector('.screen'),pp=pr.querySelector('.photo'),previewGeometry=[ps,pp].map(el=>['left','top','width','height'].map(key=>parseFloat(el.style[key])/pr.clientWidth));
 assert.equal(w.document.querySelector('#previewOverlay').hidden,false);
 w.document.querySelector('#save').click();await new Promise(r=>setTimeout(r,30));
 assert.equal(state.scene,'arcade');assert.equal(manifest.presentations['arcade-landscape'].video.zoom,1.7);assert.equal(manifest.presentations['arcade-landscape'].video.x,-8);assert.equal(manifest.presentations['arcade-landscape'].aperture.width,60);
 assert.deepEqual(manifest.items,preserved);assert.deepEqual(manifest.library,before.library);
 w.document.querySelector('#closeEditor').click();await new Promise(r=>setTimeout(r,10));
 assert.equal(w.document.querySelector('#sceneOverlay').hidden,false);assert.equal(w.document.querySelector('#stage').classList.contains('custom-background'),true);assert.equal(w.document.querySelector('#tvFrame').hidden,true);
 const liveGeometry=['screen','photo'].map(id=>['left','top','width','height'].map(key=>parseFloat(w.document.querySelector('#'+id).style[key])/w.document.querySelector('#room').clientWidth));
 for(let i=0;i<2;i++)for(let j=0;j<4;j++)assert.ok(Math.abs(liveGeometry[i][j]-previewGeometry[i][j])<1e-9);
 assert.equal(w.document.querySelector('#previewVideo').srcObject,null);
 const event=new w.Event('contextmenu',{bubbles:true,cancelable:true});w.document.querySelector('#screen').dispatchEvent(event);assert.equal(event.defaultPrevented,true);
 const fieldEvent=new w.Event('selectstart',{bubbles:true,cancelable:true});w.document.querySelector('#hostKey').dispatchEvent(fieldEvent);assert.equal(fieldEvent.defaultPrevented,false);
 state={...state,host:false};await timers.find(t=>t.delay===1500).fn();await new Promise(r=>setTimeout(r,10));
 assert.equal(w.document.querySelector('#options').hidden,true);w.document.querySelector('#edit').click();assert.equal(w.document.querySelector('#editor').hidden,true);
 assert.equal(w.document.querySelector('#staticNoise').width,320);assert.equal(w.document.querySelector('#staticNoise').height,180);
 assert.equal(w.document.querySelector('.no-signal-copy strong').textContent,'SIN SEÑAL');assert.equal(w.document.querySelector('#liveBadge').textContent,'STANDBY');
 w.document.querySelector('#volumeButton').click();assert.equal(w.document.querySelector('#volumePanel').hidden,false);
 w.innerWidth=205;w.innerHeight=205;w.dispatchEvent(new w.Event('resize'));await new Promise(r=>setTimeout(r,10));
 assert.equal(w.document.querySelector('#stage').classList.contains('compact'),true);assert.equal(w.document.querySelector('#controls').hidden,true);assert.equal(w.document.querySelector('#volumePanel').hidden,true);assert.equal(w.document.querySelector('#optionsPanel').hidden,true);
 const pointer=new w.Event('pointerdown',{cancelable:true});w.document.querySelector('#screen').dispatchEvent(pointer);assert.equal(pointer.defaultPrevented,false);
 w.innerWidth=1200;w.innerHeight=800;w.dispatchEvent(new w.Event('resize'));await new Promise(r=>setTimeout(r,10));assert.equal(w.document.querySelector('#controls').hidden,false);assert.equal(w.document.querySelector('#stage').classList.contains('compact'),false);
 assert.equal(typeof participantCallback,'function');assert.equal(w.document.documentElement.classList.contains('one-room'),false);
 }finally{dom.window.close()}
});

test('object lists, redo, appearance, direct handles and furniture placement persist without changing other views',async()=>{
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
 let body={};if(path==='/api/config')body={discordClientId:'test'};else if(path==='/api/activity-controls'){if(init.method==='PUT')state={...state,...JSON.parse(init.body),revision:state.revision+1};body=state;}else if(path==='/api/decorations'){if(init.method==='PUT'){manifest=JSON.parse(init.body);body={ok:true}}else body=manifest}else if(path==='/api/decorations/assets')body={asset:'e3d26189-65be-4c3b-ae4e-93b4f62b2a8c.png'};else if(path==='/api/cloudflare/stream')body={sessionId:null};
 return {ok:true,status:200,json:async()=>structuredClone(body)};};
 try{
 w.eval(compiled.outputFiles[0].text);await new Promise(r=>setTimeout(r,30));
 const q=s=>w.document.querySelector(s),pointer=(type,x,y,id=1,pointerType='mouse')=>{const e=new w.MouseEvent(type,{clientX:x,clientY:y,button:0,bubbles:true,cancelable:true});Object.defineProperties(e,{pointerId:{value:id},pointerType:{value:pointerType}});return e};
 q('#edit').click();await new Promise(r=>setTimeout(r,10));
 assert.equal(q('#redo').disabled,true);assert.equal(q('#figureRows').children.length,1);assert.equal(q('#slotTools').children.length,5);
 const range=(id,value)=>{const input=q('#'+id);input.dispatchEvent(new w.Event('pointerdown'));input.value=value;input.dispatchEvent(new w.Event('input'))};
 range('effect-brightness','70');await new Promise(r=>setTimeout(r,10));
 assert.match(q('#previewRoom .figure').style.filter,/brightness\(0.7\)/);q('#undo').click();await new Promise(r=>setTimeout(r,10));assert.equal(q('#previewRoom .figure').style.filter,'');assert.equal(q('#redo').disabled,false);q('#redo').click();
 range('effect-shadow','30');range('effect-tiltY','12');range('effect-opacity','.8');
 await new Promise(r=>setTimeout(r,10));assert.match(q('#previewRoom .figure').style.transform,/rotateY\(12deg\)/);
 // Pointer handles operate on the selected placement, not the editor zoom.
 q('[data-tab=room]').click();const handle=q('.figure-handle[data-handle=scale]');handle.dispatchEvent(pointer('pointerdown',50,50));q('#previewRoom').dispatchEvent(pointer('pointermove',100,100));q('#previewRoom').dispatchEvent(pointer('pointerup',100,100));assert.equal(q('#size').value,'26');q('#undo').click();q('[data-tab=figures]').click();
 q('#handTool').click();const oldZoom=q('#inspectZoom').textContent;q('#preview').dispatchEvent(pointer('pointerdown',30,30));q('#preview').dispatchEvent(pointer('pointermove',80,50));q('#preview').dispatchEvent(pointer('pointerup',80,50));assert.equal(q('#inspectZoom').textContent,oldZoom);assert.match(q('#previewRoom').style.transform,/translate\(50px,20px\)/);q('#handTool').click();q('#inspectFit').click();
 // Two-finger gestures pan and zoom, including touches outside the narrow portrait.
 q('#preview').dispatchEvent(pointer('pointerdown',100,100,1,'touch'));q('#preview').dispatchEvent(pointer('pointerdown',200,100,2,'touch'));q('#preview').dispatchEvent(pointer('pointermove',250,100,2,'touch'));assert.equal(q('#inspectZoom').textContent,'150%');q('#preview').dispatchEvent(pointer('pointerup',100,100,1,'touch'));q('#preview').dispatchEvent(pointer('pointerup',250,100,2,'touch'));q('#inspectFit').click();
 q('#markSurface').click();q('#previewRoom').dispatchEvent(pointer('pointerdown',150,340));q('#previewRoom').dispatchEvent(pointer('pointerdown',450,340));q('#attachSurface').click();await new Promise(r=>setTimeout(r,10));
 assert.ok(q('.support-line'));assert.ok(q('.contact-shadow'));q('#save').click();await new Promise(r=>setTimeout(r,20));
 const savedPlace=manifest.items[0].placements['home-landscape-16x9'];assert.equal(savedPlace.effects.brightness,70);assert.equal(savedPlace.effects.shadow,30);assert.equal(savedPlace.opacity,.8);assert.equal(savedPlace.transform.surface,'cabinet');assert.equal(manifest.presentations['home-landscape-16x9'].supportSurface.length,2);assert.deepEqual(manifest.items[0].placements['home-portrait-16x9'],before.items[0].placements['home-portrait-16x9']);
 q('#figureRows [data-object-action=visibility]').click();assert.equal(q('#hideFigure').textContent,'Mostrar');q('#figureRows [data-object-action=visibility]').click();q('#figureRows [data-object-action=up]').click();assert.match(q('#figureRows .object-title').textContent,/capa 11/);
 q('#figureRows [data-object-action=delete]').click();assert.equal(q('#figureRows').children.length,0);q('#undo').click();assert.equal(q('#figureRows').children.length,1);
 q('#slotTools [data-object-action=visibility]').click();await new Promise(r=>setTimeout(r,10));assert.equal(q('#figureList').value,'viewer-slot-red');q('#slotTools [data-object-action=up]').click();q('#save').click();await new Promise(r=>setTimeout(r,20));assert.equal(manifest.items.find(i=>i.id==='viewer-slot-red').placements['home-landscape-16x9'].z,19);
 q('#slotTools [data-object-action=delete]').click();q('#save').click();await new Promise(r=>setTimeout(r,20));assert.equal(manifest.items.find(i=>i.id==='viewer-slot-red').placements['home-landscape-16x9'].hidden,true);
 }finally{dom.window.close()}
});
