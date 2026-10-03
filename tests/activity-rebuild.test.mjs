import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareSave,settingsFor,placementFor,updatePlacement,keyFor,viewFor} from '../src/activity-model.mjs';
test('page rebuild retains every figure asset, placement and collection without mutating source',()=>{
 const p={x:23,y:70,width:19,rotation:7,opacity:.8,z:15,hidden:false,anchor:'frame',transform:{flipX:true}};
 const figure={id:'5d1fc860-0330-4bf4-8d63-ad072c3ca840',asset:'image.gif',name:'Personal',placements:{'home-portrait-4x3':p}};
 const m={items:[figure],presentations:{'home-portrait-4x3':{environment:'cozy-night',style:'classic',camera:{zoom:2},tvModel:'flat-modern'}},library:[{asset:'other.png'}],profiles:[{room:{items:[figure]}}],startup:{style:'classic'}};
 const before=structuredClone(m),saved=prepareSave(m);
 assert.deepEqual(m,before);assert.deepEqual(saved.items,before.items);assert.deepEqual(saved.library,before.library);assert.deepEqual(saved.profiles,before.profiles);
 assert.equal(saved.presentations['home-portrait-4x3'].style,'minimal');assert.equal(saved.presentations['home-portrait-4x3'].camera.zoom,1);
});
test('editing a view retains all other saved figure positions and unexposed metadata',()=>{
 const m={items:[{id:'one',placements:{'home-landscape-16x9':{x:1,hidden:false},'home-portrait-16x9':{x:42,hidden:true,transform:{flipX:true}}}}]};
 updatePlacement(m,'one','home-landscape-16x9',{x:50});assert.equal(m.items[0].placements['home-portrait-16x9'].x,42);assert.deepEqual(m.items[0].placements['home-portrait-16x9'].transform,{flipX:true});
});
test('new settings persist across reload and legacy placements remain readable',()=>{
 const m={items:[],presentations:{'home-landscape-16x9':{style:'minimal',camera:{zoom:1.4},tvModel:'flat-modern'}}};
 assert.equal(settingsFor(prepareSave(m),'home-landscape-16x9').camera.zoom,1.4);
 assert.equal(placementFor({placements:{'home-portrait':{x:8}}},'home-portrait-4x3').x,8);
 assert.equal(keyFor('portrait','4:3'),'home-portrait-4x3');
 for(const [w,h] of [[500,390],[340,510],[800,300]])assert.equal(viewFor(w,h),'window');assert.equal(viewFor(430,900),'portrait');
});
