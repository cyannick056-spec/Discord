import test from 'node:test';
import assert from 'node:assert/strict';
import {removeFromView,duplicateInView,saveView,viewMood} from '../src/view-state.ts';
const a='home-landscape-16x9',b='home-portrait-4x3',c='home-window-16x9';
const placement={x:40,y:60,width:10,rotation:0,opacity:1,z:12,hidden:false};
const fixture=()=>({items:[{id:crypto.randomUUID(),asset:crypto.randomUUID()+'.png',name:'Figura',placements:{[a]:structuredClone(placement),[b]:{...placement,x:70},[c]:{...placement,x:20}}}],presentations:{[a]:{camera:{zoom:1},ambient:100},[b]:{camera:{zoom:1.4},ambient:80}},mood:{preset:'neutral',intensity:0,tvGlow:100}});
test('removal and duplication affect only the selected view, including independent nested lights',()=>{
 const draft=fixture(),before=structuredClone(draft);removeFromView(draft.items[0],a);
 assert.equal(draft.items[0].placements[a].hidden,true);assert.deepEqual(draft.items[0].placements[b],before.items[0].placements[b]);assert.deepEqual(draft.items[0].placements[c],before.items[0].placements[c]);
 const copy=duplicateInView(draft.items[0],b);assert.deepEqual(Object.keys(copy.placements),[b]);assert.notEqual(copy.id,draft.items[0].id);copy.placements[b].x=5;assert.equal(draft.items[0].placements[b].x,70);
 viewMood(draft,a).tvGlow=160;assert.equal(viewMood(draft,b).tvGlow,100);assert.equal(draft.mood.tvGlow,100);
});
test('saving one view excludes unsaved edits and additions to other views, then persists independently',()=>{
 const saved=fixture(),draft=structuredClone(saved);draft.items[0].placements[a].x=15;draft.items[0].placements[b].x=99;draft.presentations[a].camera.zoom=1.2;draft.presentations[b].ambient=35;
 const figure={id:crypto.randomUUID(),asset:crypto.randomUUID()+'.png',name:'Nueva',placements:{[a]:{...placement},[b]:{...placement,x:90}}};draft.items.push(figure);
 const result=saveView(saved,draft,a);assert.equal(result.items[0].placements[a].x,15);assert.equal(result.items[0].placements[b].x,70);assert.equal(result.presentations[b].ambient,80);assert.deepEqual(Object.keys(result.items[1].placements),[a]);assert.equal(draft.items[0].placements[b].x,99);
 const portrait=saveView(result,draft,b);assert.equal(portrait.items[0].placements[a].x,15);assert.equal(portrait.items[0].placements[b].x,99);assert.equal(portrait.presentations[b].ambient,35);assert.equal(portrait.items[1].placements[b].x,90);
});
