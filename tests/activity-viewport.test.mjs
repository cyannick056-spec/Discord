import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {build} from 'esbuild';

test('keyboard resizing in host, figure and editor fields retains the whole activity; rotation still works',async()=>{
 const dom=new JSDOM('<main id="stage"><input id="host" type="password"><input id="figure"><textarea id="editor"></textarea></main>',{runScripts:'outside-only'}),w=dom.window;
 const compiled=await build({entryPoints:[new URL('../src/activity-viewport.ts',import.meta.url).pathname],bundle:true,write:false,format:'iife',globalName:'Viewport'});
 w.innerWidth=430;w.innerHeight=932;let changes=0;
 try{
  w.eval(compiled.outputFiles[0].text+';window.Viewport=Viewport;');
  const stage=w.document.querySelector('#stage'),view=new w.Viewport.ActivityViewport(stage,()=>changes++);
  for(const id of ['host','figure','editor']){
   w.document.querySelector('#'+id).focus();w.innerHeight=410;w.dispatchEvent(new w.Event('resize'));
   assert.equal(view.height,932);assert.equal(stage.style.height,'932px');assert.equal(stage.style.getPropertyValue('--control-gap'),'160px');assert.equal(changes,0);
   w.document.querySelector('#'+id).blur();w.dispatchEvent(new w.Event('resize'));assert.equal(view.height,932);
   w.innerHeight=932;w.dispatchEvent(new w.Event('resize'));assert.equal(view.height,932);
  }
  w.innerWidth=932;w.innerHeight=430;w.dispatchEvent(new w.Event('resize'));
  assert.equal(view.width,932);assert.equal(view.height,430);assert.equal(stage.style.getPropertyValue('--control-gap'),'96px');assert.equal(changes,1);
 }finally{w.close()}
});
