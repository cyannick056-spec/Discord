import {test} from 'node:test';
import assert from 'node:assert/strict';
import {previewViewport,scalePreviewLayout} from '../src/preview-viewport.mjs';
import {photoLayout} from '../public/photo-layout.mjs';
test('phone and desktop previews use the exact active viewport proportions and TV fit',()=>{
 for(const [width,height,view] of [[674,1536,'portrait'],[430,932,'portrait'],[1536,674,'landscape'],[1920,650,'landscape'],[205,205,'window']]){
  const reference=previewViewport(view,width,height);assert.deepEqual(reference,{width,height});
  for(const type of ['crt','flat'])for(const zoom of [1,1.4,2]){
   const live=photoLayout(width,height,type,{zoom,x:20,y:-15},view==='window','rain',{zoom:.7,x:3,y:4});
   const preview=scalePreviewLayout(photoLayout(reference.width,reference.height,type,{zoom,x:20,y:-15},view==='window','rain',{zoom:.7,x:3,y:4}),.25);
   for(const part of ['photo','frame','screen'])for(const key of ['left','top','width','height'])assert.equal(preview[part][key],live[part][key]*.25);
  }
 }
});
test('other editor orientations retain sensible proportions without forcing the current phone into 9:16',()=>{
 assert.deepEqual(previewViewport('landscape',674,1536),{width:1536,height:674});
 assert.deepEqual(previewViewport('portrait',1536,674),{width:674,height:1536});
});
