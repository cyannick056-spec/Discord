import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {prepareRealRoom} from '../real-room.mjs';
import {compositions,compositionRestGroups} from '../room-compositions.mjs';
import {installDecorations} from '../decorations.mjs';
import {MAX_SCENE_ITEMS} from '../material-catalog.mjs';

test('complete compositions replace only their own view, reuse pieces and preserve personal edits',()=>{
 const a='home-landscape-16x9',b='home-portrait-4x3';
 const personal={id:crypto.randomUUID(),name:'Mi figurita',asset:crypto.randomUUID()+'.png',placements:{[a]:{x:12,y:50,width:8}}};
 const d={items:[personal]};prepareRealRoom(d,'cozy-night');const beforeB=structuredClone(d.presentations[b]),beforePersonal=structuredClone(personal);
 for(const id of Object.keys(compositions)) {
  assert.equal(prepareRealRoom(d,id,a),true);assert.deepEqual(d.presentations[b],beforeB);assert.deepEqual(d.items.find(i=>i.id===personal.id),beforePersonal);
  const visible=d.items.filter(i=>i.roomKit && !i.placements[a]?.hidden);assert.equal(visible.length,8);assert.ok(visible.every(i=>i.roomKit===id));
  assert.ok(visible.some(i=>i.category==='lamp'&&i.placements[a].light.intensity>0));assert.ok(visible.some(i=>i.placements[a].contactShadow.opacity>0));
  assert.ok(d.presentations[a].mood.depth>0);assert.equal(d.presentations[a].rain,undefined);assert.equal(d.presentations[a].tvSupport,'cabinet');
  for(const group of compositionRestGroups(d,a))assert.ok(d.items.some(i=>i.id===group.supportId));
  const count=d.items.length;prepareRealRoom(d,id,a);assert.equal(d.items.length,count);
 }
 const beforeA=structuredClone(d.presentations[a]);prepareRealRoom(d,'midnight-den',b);assert.deepEqual(d.presentations[a],beforeA);
});
test('capacity failure is atomic, and all complete compositions round-trip through the server',async()=>{
 const full={items:Array.from({length:MAX_SCENE_ITEMS},()=>({id:crypto.randomUUID(),asset:crypto.randomUUID()+'.png',name:'Figura',placements:{}}))};const old=structuredClone(full);
 assert.equal(prepareRealRoom(full,'midnight-den','home-landscape-16x9'),false);assert.deepEqual(full,old);
 const dir=await mkdtemp(path.join(tmpdir(),'shis-compositions-'));const app=express();app.use(express.json());installDecorations(app,{directory:dir,editKey:'fixture'});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const url=`http://127.0.0.1:${server.address().port}/api/decorations`;
 try {
  const d={items:[]};prepareRealRoom(d,'cozy-night');
  for(const id of Object.keys(compositions)) {
   prepareRealRoom(d,id,'home-landscape-16x9');prepareRealRoom(d,id,'home-portrait-4x3');
   assert.equal((await fetch(url,{method:'PUT',headers:{'Content-Type':'application/json','X-Decoration-Key':'fixture'},body:JSON.stringify(d)})).status,200);
   assert.deepEqual(await(await fetch(url)).json(),d);
  }
 } finally {await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
});
