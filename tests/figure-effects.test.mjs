import {test} from 'node:test';
import assert from 'node:assert/strict';
import {figureFilter,supportedPlacement,supportPoint} from '../src/figure-effects.mjs';
import {validStudioPlacement,validPresentations} from '../studio-validation.mjs';
import {figureRect,prepareSave} from '../src/activity-model.mjs';
test('figure effects retain a neutral default and reject unsafe persisted values',()=>{
 assert.equal(figureFilter(), '');
 assert.match(figureFilter({brightness:65,contrast:110,hue:-30,shadow:40}),/brightness\(0.65\).*hue-rotate\(-30deg\).*rgba\(0,0,0,0.4\)/);
 assert.equal(validStudioPlacement({effects:{brightness:65,hue:-30,shadow:40}}),true);
 for(const effects of [{brightness:201},{hue:NaN},{shadowBlur:-1}])assert.equal(validStudioPlacement({effects}),false);
});
test('marked furniture supports follow the photo and retain their exact geometry through save',()=>{
 const surface=[{x:10,y:60},{x:90,y:64}],photo={left:-50,top:-20,width:1000,height:800};
 const p={x:50,y:30,width:10,rotation:0,opacity:1,z:10,hidden:false,anchor:'scene'};
 const room={x:0,y:0,width:500,height:400},rect=figureRect(p,room,room),height=70;
 const patch=supportedPlacement(p,rect,photo,surface,height),foot=supportPoint(surface,photo,rect.x);
 const final=figureRect({...p,...patch},room,room);
 assert.ok(Math.abs(final.y+height/2-foot.y)<1e-9);assert.ok(Math.abs(final.x-foot.x)<1e-9);
 assert.equal(validStudioPlacement({...p,...patch}),true);
 const settings={'home-landscape-4x3':{style:'minimal',supportSurface:surface}};
 assert.equal(validPresentations(settings,new Set(Object.keys(settings))),true);
 assert.equal(validPresentations({'home-landscape-4x3':{supportSurface:[surface[0],surface[0]]}},new Set(Object.keys(settings))),false);
 const manifest={items:[{id:'figure',placements:{'home-landscape-4x3':{...p,...patch,effects:{brightness:80}}}}],presentations:settings};
 const saved=prepareSave(manifest);assert.deepEqual(saved.items,manifest.items);assert.deepEqual(saved.presentations['home-landscape-4x3'].supportSurface,surface);
});
