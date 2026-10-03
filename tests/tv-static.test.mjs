import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {build} from 'esbuild';

test('original idle grain and two historical sweep profiles stop when inactive',async()=>{
 const dom=new JSDOM('<canvas id="idle" hidden></canvas><canvas id="live" hidden></canvas>',{runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,frames=new Map(),timers=new Map();let next=0;
 const compiled=await build({entryPoints:[new URL('../src/tv-static.ts',import.meta.url).pathname],bundle:true,write:false,format:'iife',globalName:'TVFx'});
 w.performance.now=()=>4000;w.setTimeout=fn=>{timers.set(++next,fn);return next};w.clearTimeout=id=>timers.delete(id);
 w.HTMLCanvasElement.prototype.getContext=function(){const id=this.id;return {createImageData:(width,height)=>({data:new Uint8ClampedArray(width*height*4)}),putImageData:frame=>frames.set(id,frame.data.slice())}};
 try{
  w.eval(compiled.outputFiles[0].text+";window.TVFx=TVFx;");
  const idleCanvas=w.document.querySelector('#idle'),liveCanvas=w.document.querySelector('#live'),idle=new w.TVFx.TvStatic(idleCanvas),live=new w.TVFx.SignalSweeps(liveCanvas);
  idle.setActive(true);const noise=frames.get('idle');assert.equal(idleCanvas.hidden,false);
  for(let i=0;i<noise.length;i+=4){assert.equal(noise[i],noise[i+1]);assert.equal(Math.min(255,noise[i]+3),noise[i+2]);assert.equal(noise[i+3],255)}
  let seed=0x6a09e667;const historical=new Uint8ClampedArray(noise.length),band=Math.floor((4000/31)%180);
  for(let i=0;i<historical.length;i+=4){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;const y=Math.floor(i/4/320),grain=Math.min(255,(seed&255)+(Math.abs(y-band)<3?35:0));historical[i]=historical[i+1]=grain;historical[i+2]=Math.min(255,grain+3);historical[i+3]=255}
  assert.deepEqual(Array.from(noise),Array.from(historical));
  const greys=Array.from(noise).filter((_,i)=>i%4===0);assert.ok(greys.reduce((a,b)=>a+b,0)/greys.length>120);assert.ok(Math.max(...greys)>220);assert.ok(Math.min(...greys)<70);
  idle.stop();assert.equal(idleCanvas.hidden,true);assert.equal(timers.size,0);
  live.setActive(true);const pixels=frames.get('live'),runs=[];let start=-1;
  for(let y=0;y<=180;y++){const visible=y<180&&pixels.subarray(y*320*4,(y+1)*320*4).some((v,i)=>i%4===3&&v>0);if(visible&&start<0)start=y;if(!visible&&start>=0){runs.push([start,y-1]);start=-1}}
  assert.equal(runs.length,2);assert.ok(runs[1][1]-runs[1][0]>runs[0][1]-runs[0][0]);assert.ok(runs[1][0]<117&&runs[1][1]>117);assert.ok(runs[0][0]<40&&runs[0][1]>40);
  assert.ok(Math.max(...Array.from(pixels).filter((_,i)=>i%4===3))<=69);
  live.stop();assert.equal(liveCanvas.hidden,true);assert.equal(timers.size,0);
 }finally{w.close()}
});
