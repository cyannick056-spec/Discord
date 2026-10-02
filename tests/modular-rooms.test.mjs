import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {installDecorations} from '../decorations.mjs';
import {prepareRoom,builtinDecoration,roomPlacement} from '../src/modular-rooms.ts';
import {rooms,props,visibleInRoom,builtinUrl} from '../room-catalog.mjs';

test('el catálogo integrado contiene solo muebles y cambiar fondo no añade piezas',()=>{
 assert.ok(props.length>0);assert.ok(props.every(p=>p.category==='furniture'));
 const key='home-landscape-16x9';
 const custom={id:crypto.randomUUID(),asset:crypto.randomUUID()+'.png',name:'Mi figura',placements:{[key]:{x:20,y:40,width:8}}};
 const cabinet=builtinDecoration('cabinet');cabinet.placements[key]=roomPlacement('cabinet');
 const manifest={items:[custom,cabinet],presentations:{[key]:{environment:'cozy-night',camera:{zoom:1.4},ambient:60,mood:{preset:'blue-night',intensity:50,tvGlow:110}}}};
 const beforeItems=structuredClone(manifest.items),beforeCamera=structuredClone(manifest.presentations[key].camera),beforeMood=structuredClone(manifest.presentations[key].mood);
 for(const room of rooms){assert.equal(prepareRoom(manifest,room.id,key),true);assert.deepEqual(manifest.items,beforeItems);assert.deepEqual(manifest.presentations[key].camera,beforeCamera);assert.deepEqual(manifest.presentations[key].mood,beforeMood);assert.equal(manifest.presentations[key].environment,room.id);}
 assert.equal(visibleInRoom(custom,manifest.presentations[key]),true);assert.equal(visibleInRoom(cabinet,manifest.presentations[key]),true);
 assert.equal(builtinUrl('cabinet'),'/rooms/props/cabinet.webp');assert.equal(builtinUrl('anime-figure'),'');assert.equal(builtinUrl('../private'),'');
});

test('muebles y decoraciones personales actuales hacen round-trip; builtins retirados se rechazan',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'shis-furniture-only-'));
 const app=express();app.use(express.json({limit:'4mb'}));installDecorations(app,{directory,editKey:'fixture'});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const url=`http://127.0.0.1:${server.address().port}/api/decorations`;
 const key='home-portrait-4x3',cabinet=builtinDecoration('side-table');cabinet.placements[key]=roomPlacement('side-table',true);
 const personal={id:crypto.randomUUID(),asset:crypto.randomUUID()+'.png',name:'Mi imagen',category:'figurine',placements:{[key]:{x:35,y:44,width:11,rotation:0,opacity:1,z:14,hidden:false}}};
 const manifest={items:[cabinet,personal],presentations:{[key]:{environment:'walnut-den',style:'classic',camera:{zoom:1.2},tvSupport:'cabinet',supportId:cabinet.id,video:{fit:'contain'},mood:{preset:'neutral',intensity:0,tvGlow:100}}}};
 const save=body=>fetch(url,{method:'PUT',headers:{'Content-Type':'application/json','X-Decoration-Key':'fixture'},body:JSON.stringify(body)});
 try{
  assert.equal((await save(manifest)).status,200);assert.deepEqual(await(await fetch(url)).json(),manifest);
  const old=structuredClone(manifest);old.items.push({id:crypto.randomUUID(),kind:'builtin',asset:'anime-figure',name:'Vieja',category:'figurine',placements:{}});
  assert.equal((await save(old)).status,400);assert.deepEqual(await(await fetch(url)).json(),manifest);
 }finally{await new Promise(r=>server.close(r));await rm(directory,{recursive:true,force:true});}
});
