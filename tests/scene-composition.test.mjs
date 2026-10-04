import {test} from 'node:test';
import assert from 'node:assert/strict';
import {soloLayout,videoStyle,tvAspect} from '../src/scene-composition.mjs';
import {scalePreviewLayout} from '../src/preview-viewport.mjs';
import {prepareSave} from '../src/activity-model.mjs';
import {validPresentations} from '../studio-validation.mjs';
test('overlay opening and saved camera produce identical editor and live composition at every viewport',()=>{
 const aperture={x:48,y:52,width:70,height:60};
 for(const [w,h]of [[430,932],[674,1536],[1536,674]])for(const zoom of [1,1.4,2])for(const pan of [-50,0,50]){
  const camera={zoom,x:pan,y:pan},live=soloLayout(w,h,'4:3',camera,aperture),preview=soloLayout(w/4,h/4,'4:3',camera,aperture);
  assert.deepEqual(preview,scalePreviewLayout(live,.25));
  assert.ok(live.photo.left<=0&&live.photo.top<=0&&live.photo.left+live.photo.width>=w&&live.photo.top+live.photo.height>=h);
 }
});
test('backgrounds, overlays and game framing survive save without losing personal figures or other views',()=>{
 const asset='e3d26189-65be-4c3b-ae4e-93b4f62b2a8c.png',key='arcade-portrait';
 const input={items:[{id:'my-figure',asset,placements:{'home-portrait-4x3':{x:10}}}],library:[{asset}],presentations:{[key]:{style:'minimal',background:asset,overlay:{asset,opacity:.7},aperture:{x:50,y:50,width:75,height:60},video:{fit:'cover',zoom:1.8,x:-10,y:5}}}};
 const output=prepareSave(input);assert.deepEqual(output.presentations[key],input.presentations[key]);assert.deepEqual(output.items,input.items);assert.deepEqual(output.library,input.library);
 assert.equal(validPresentations({[key]:output.presentations[key]},new Set([key])),true);
 for(const bad of [{overlay:{asset:'../file',opacity:1}},{overlay:{asset,opacity:NaN}},{aperture:{x:50,y:50,width:0,height:60}},{aperture:{x:50,y:50,width:75,height:Infinity}}])assert.equal(validPresentations({[key]:bad},new Set([key])),false);
 assert.equal(videoStyle(output.presentations[key].video).transform,'translate(-10%, 5%) scale(1.8)');assert.equal(tvAspect('original'),'4:3');assert.equal(tvAspect('flat-modern'),'16:9');
});
