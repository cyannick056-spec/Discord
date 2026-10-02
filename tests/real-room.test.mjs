import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareRealRoom,cleanupBuiltinDecorations,rebuildRealRooms} from '../real-room.mjs';
import {cameraRect,resolvedCamera} from '../src/presentation-model.ts';

test('cambiar de fondo conserva TV, muebles, figuras personales, filtro y encuadre',()=>{
 const key='home-landscape-16x9';
 const personal={id:crypto.randomUUID(),asset:crypto.randomUUID()+'.png',name:'Mi figura',placements:{[key]:{x:33,y:55,width:8,rotation:0,opacity:1,z:14,hidden:false}}};
 const cabinet={id:crypto.randomUUID(),kind:'builtin',asset:'cabinet',name:'Mueble',category:'furniture',placements:{[key]:{x:50,y:80,width:70,rotation:0,opacity:1,z:3,hidden:false}}};
 const room={items:[personal,cabinet],presentations:{[key]:{environment:'cozy-night',style:'classic',camera:{zoom:1.35,x:8,y:-4},tv:{zoom:.72,x:3},tvModel:'flat-modern',tvSupport:'cabinet',supportId:cabinet.id,video:{fit:'contain'},screen:{rounded:false},ambient:58,mood:{preset:'blue-night',intensity:61,tvGlow:120},reflection:{enabled:true,intensity:80}}}};
 const items=structuredClone(room.items),before=structuredClone(room.presentations[key]);
 assert.equal(prepareRealRoom(room,'walnut-den',key),true);
 assert.deepEqual(room.items,items);
 assert.equal(room.presentations[key].environment,'walnut-den');
 const after={...room.presentations[key],environment:before.environment};
 assert.deepEqual(after,before);
 assert.equal(prepareRealRoom(room,'no-existe',key),false);
});

test('la limpieza elimina solo decoración integrada retirada y conserva muebles y contenido personal',()=>{
 const key='home-portrait-4x3';
 const personal={id:crypto.randomUUID(),asset:crypto.randomUUID()+'.png',name:'Mía',category:'figurine',placements:{[key]:{x:30,y:40,width:9}}};
 const oldFigure={id:crypto.randomUUID(),kind:'builtin',asset:'anime-figure',name:'Figura antigua',category:'figurine',roomKit:'walnut-den',placements:{[key]:{x:50,y:50,width:5}}};
 const furniture={id:crypto.randomUUID(),kind:'builtin',asset:'side-table',name:'Mesa',category:'furniture',roomKit:'walnut-den',placements:{[key]:{x:70,y:70,width:25}}};
 const nested={items:[structuredClone(personal),structuredClone(oldFigure),structuredClone(furniture)]};
 const manifest={items:[personal,oldFigure,furniture],profiles:[{id:crypto.randomUUID(),name:'Perfil',room:structuredClone(nested)}],versions:[{id:crypto.randomUUID(),name:'Versión',room:structuredClone(nested)}],library:[{...oldFigure,placements:undefined},{...furniture,placements:undefined}]};
 cleanupBuiltinDecorations(manifest);
 for(const room of [manifest,manifest.profiles[0].room,manifest.versions[0].room]) {
  assert.equal(room.items.some(i=>i.asset==='anime-figure'),false);
  assert.equal(room.items.some(i=>i.asset===personal.asset),true);
  const kept=room.items.find(i=>i.asset==='side-table');assert.ok(kept);assert.equal(kept.roomKit,undefined);
 }
 assert.deepEqual(manifest.library.map(i=>i.asset),['side-table']);
 assert.equal(manifest.library[0].roomKit,undefined);
});

test('la migración conserva filtros y convierte entornos antiguos sin volver a crear presets',()=>{
 const key='home-landscape-16x9';
 const manifest={items:[],presentations:{[key]:{environment:'rain-close',camera:{zoom:1.8},ambient:44,mood:{preset:'warm',intensity:55,tvGlow:130}}}};
 rebuildRealRooms(manifest);
 assert.equal(manifest.items.length,0);
 assert.equal(manifest.presentations[key].environment,'cozy-night');
 assert.equal(manifest.presentations[key].camera.zoom,1.8);
 assert.equal(manifest.presentations[key].ambient,44);
 assert.equal(manifest.presentations[key].mood.preset,'warm');
});

test('photographic overscan covers every supported zoom and pan',()=>{
 for(const [width,height]of[[390,844],[1054,730],[1536,674]])for(const zoom of[.5,.75,1,1.5,2.5])for(const x of[-50,0,50])for(const y of[-50,0,50]){
  const p={environment:'cozy-night',camera:{zoom,x,y}},c=resolvedCamera(p),world=cameraRect({x:0,y:0,width,height},p);
  const left=width/2-width*zoom+width*c.x/100,top=height/2-height*zoom+height*c.y/100;
  assert.ok(left<=.001&&top<=.001&&left+width*zoom*2>=width-.001&&top+height*zoom*2>=height-.001);
  assert.equal(world.x+world.width/2,width/2+width*c.x/100);assert.equal(world.y+world.height/2,height/2+height*c.y/100);
 }
});
