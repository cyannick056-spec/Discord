import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {build} from 'esbuild';

test('grey idle noise and both soft slow sweep profiles stop when inactive',async()=>{
 const dom=new JSDOM('<canvas id="idle" hidden></canvas><canvas id="live" hidden></canvas>',{runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,frames=new Map(),timers=new Map();let next=0;
 const compiled=await build({entryPoints:[new URL('../src/tv-static.ts',import.meta.url).pathname],bundle:true,write:false,format:'iife',globalName:'TVFx'});
 w.performance.now=()=>4000;w.setTimeout=fn=>{timers.set(++next,fn);return next};w.clearTimeout=id=>timers.delete(id);
 w.HTMLCanvasElement.prototype.getContext=function(){const id=this.id;return {createImageData:(width,height)=>({data:new Uint8ClampedArray(width*height*4)}),putImageData:frame=>frames.set(id,frame.data.slice())}};
 try{
  w.eval(compiled.outputFiles[0].text+";window.TVFx=TVFx;");
  const idleCanvas=w.document.querySelector('#idle'),liveCanvas=w.document.querySelector('#live'),idle=new w.TVFx.TvStatic(idleCanvas),live=new w.TVFx.SignalSweeps(liveCanvas);
  idle.setActive(true);const noise=frames.get('idle');assert.equal(idleCanvas.hidden,false);
  for(let i=0;i<noise.length;i+=4){assert.equal(noise[i],noise[i+1]);assert.equal(noise[i],noise[i+2]);assert.equal(noise[i+3],255)}
  const greys=Array.from(noise).filter((_,i)=>i%4===0);assert.ok(greys.reduce((a,b)=>a+b,0)/greys.length>140);assert.ok(Math.max(...greys)>220);assert.ok(Math.min(...greys)<70);
  idle.stop();assert.equal(idleCanvas.hidden,true);assert.equal(timers.size,0);
  live.setActive(true);const pixels=frames.get('live'),runs=[];let start=-1;
  for(let y=0;y<=180;y++){const visible=y<180&&pixels.subarray(y*320*4,(y+1)*320*4).some((v,i)=>i%4===3&&v>0);if(visible&&start<0)start=y;if(!visible&&start>=0){runs.push([start,y-1]);start=-1}}
  assert.equal(runs.length,2);assert.ok(runs[0][1]-runs[0][0]>runs[1][1]-runs[1][0]);assert.ok(runs[0][0]<89&&runs[0][1]>89);assert.ok(runs[1][0]<125&&runs[1][1]>125);
  assert.ok(Math.max(...Array.from(pixels).filter((_,i)=>i%4===3))<=21);
  live.stop();assert.equal(liveCanvas.hidden,true);assert.equal(timers.size,0);
 }finally{w.close()}
});
