import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,readFile,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import express from 'express';
import { installDecorations } from '../decorations.mjs';
import { prepareRealRoom,rebuildRealRooms } from '../real-room.mjs';
import { cameraRect,resolvedCamera } from '../src/presentation-model.ts';

test('replacement backs up old scenes, preserves personal assets, removes old kits and does not reset later edits',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'shis-real-room-'));
 const key='home-portrait-4x3', placement={x:40,y:70,width:8,rotation:0,opacity:1,z:14,hidden:false};
 const personal={id:crypto.randomUUID(),asset:crypto.randomUUID()+'.png',name:'Mi figura',placements:{[key]:placement}};
 const kit={id:crypto.randomUUID(),kind:'builtin',asset:'console',name:'Colección anterior',roomKit:'rain-close',placements:{[key]:placement}};
 const before={items:[personal,kit],ambient:42,mood:{preset:'blue-night',intensity:70,tvGlow:130},presentations:{[key]:{environment:'rain-close',camera:{zoom:2.2},tvPaint:{enabled:true,body:'#ffffff'}}}};
 const open=async()=>{const app=express();app.use(express.json());installDecorations(app,{directory,editKey:'fixture',rebuildRooms:true});const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));return{server,url:`http://127.0.0.1:${server.address().port}/api/decorations`}};
 let active;
 try{
  await writeFile(path.join(directory,'manifest.json'),JSON.stringify(before));active=await open();
  const response=await fetch(active.url);assert.equal(response.status,200);const after=await response.json();
  assert.equal(after.items.find(i=>i.id===personal.id).asset,personal.asset);assert.equal(after.items.find(i=>i.id===personal.id).placements[key].hidden,true);
  assert.ok(!after.items.some(i=>i.id===kit.id));assert.equal(after.items.filter(i=>i.roomKit).length,3);
  assert.equal(after.ambient,100);assert.equal(after.mood.preset,'neutral');assert.equal(after.mood.intensity,0);assert.equal(after.presentations[key].environment,'cozy-night');assert.equal(after.presentations[key].camera.zoom,1);assert.equal(after.presentations[key].tvPaint,undefined);
  assert.deepEqual(JSON.parse(await readFile(path.join(directory,'manifest-before-cozy-night-v2.json'),'utf8')),before);
  assert.equal((await fetch(active.url,{method:'PUT',headers:{'Content-Type':'application/json','X-Decoration-Key':'fixture'},body:JSON.stringify(before)})).status,409);
  assert.deepEqual(await(await fetch(active.url)).json(),after);
  prepareRealRoom(after,'cozy-night');after.items.find(i=>i.asset==='cabinet').placements[key].x=63;
  assert.equal((await fetch(active.url,{method:'PUT',headers:{'Content-Type':'application/json','X-Decoration-Key':'fixture'},body:JSON.stringify(after)})).status,200);
  await new Promise(r=>active.server.close(r));active=await open();assert.deepEqual(await(await fetch(active.url)).json(),after);
  const full={items:Array.from({length:500},()=>({...personal,id:crypto.randomUUID(),placements:structuredClone(personal.placements)}))};rebuildRealRooms(full);assert.equal(full.items.length,500);assert.equal(full.presentations[key].environment,'cozy-night');
 }finally{if(active)await new Promise(r=>active.server.close(r));await rm(directory,{recursive:true,force:true})}
});

test('photographic overscan covers every supported zoom and pan; furniture and TV camera coordinates agree',()=>{
 for(const environment of ['cozy-night'])for(const [width,height]of[[390,844],[1054,730],[1536,674]])for(const zoom of[.5,.75,1,1.5,2.5])for(const x of[-50,0,50])for(const y of[-50,0,50]){
  const p={environment,camera:{zoom,x,y}},c=resolvedCamera(p),world=cameraRect({x:0,y:0,width,height},p);
  const left=width/2-width*zoom+width*c.x/100,top=height/2-height*zoom+height*c.y/100;
  assert.ok(left<=.001 && top<=.001 && left+width*zoom*2>=width-.001 && top+height*zoom*2>=height-.001);
  assert.equal(world.x+world.width/2,width/2+width*c.x/100);assert.equal(world.y+world.height/2,height/2+height*c.y/100);
 }
});
