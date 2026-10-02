import test from 'node:test';
import assert from 'node:assert/strict';
import {detectActiveArea,fullVideoArea,stabilizeActiveArea} from '../src/video-active-area.ts';
import {videoCrop} from '../src/presentation-model.ts';
import {objectLightGain} from '../src/light-response.ts';
import {gradeFilter} from '../src/studio-model.ts';
import {validPresentations,validStudioPlacement} from '../studio-validation.mjs';
function frame(x,y,w,h) {const pixels=new Uint8ClampedArray(160*90*4);for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++){const p=(j*160+i)*4;pixels[p]=180;pixels[p+1]=120;pixels[p+2]=90;pixels[p+3]=255;}return pixels;}
test('detects pillarboxed 4:3 gameplay and centered windowboxed game output',()=>{
  assert.deepEqual(detectActiveArea(frame(20,0,120,90),160,90),{x:.125,y:0,width:.75,height:1});
  assert.deepEqual(detectActiveArea(frame(32,9,96,72),160,90),{x:.2,y:.1,width:.6,height:.8});
  assert.deepEqual(detectActiveArea(frame(0,0,160,90),160,90),fullVideoArea());
});
test('black frames, small centered logos and asymmetric dark artwork do not trigger a zoom',()=>{
  assert.equal(detectActiveArea(new Uint8ClampedArray(160*90*4),160,90),null);
  assert.equal(detectActiveArea(frame(70,40,20,10),160,90),null);
  assert.deepEqual(detectActiveArea(frame(30,0,130,90),160,90),fullVideoArea());
  const pixels=frame(20,0,120,90);for(let y=0;y<90;y++)pixels[(y*160+3)*4]=100;
  assert.deepEqual(detectActiveArea(pixels,160,90),fullVideoArea());
});
test('a stable crop needs three samples and survives fades before returning to wide gameplay',()=>{
  const state={area:fullVideoArea(),count:0},crop={x:.125,y:0,width:.75,height:1};
  assert.equal(stabilizeActiveArea(state,crop),false);assert.equal(stabilizeActiveArea(state,null),false);
  assert.equal(stabilizeActiveArea(state,crop),false);assert.equal(stabilizeActiveArea(state,crop),false);assert.equal(stabilizeActiveArea(state,crop),true);
  assert.equal(stabilizeActiveArea(state,null),false);assert.deepEqual(state.area,crop);
  for(let n=0;n<3;n++)stabilizeActiveArea(state,fullVideoArea());assert.deepEqual(state.area,fullVideoArea());
});
test('automatic visible crop uses the active rectangle and keeps the light sample inside it',()=>{
  const area={x:.2,y:.1,width:.6,height:.8};
  const crop=videoCrop(1280,720,640,480,undefined,'cover',area);
  assert.deepEqual(crop,{x:256,y:72,width:768,height:576});
  const wide=videoCrop(1280,720,800,450,undefined,'cover',area);
  assert.equal(wide.x,256);assert.equal(wide.width,768);assert.ok(Math.abs(wide.height-432)<1e-9);assert.ok(Math.abs(wide.y-144)<1e-9);
});
test('object light response can preserve detail or restore the full ambient treatment',()=>{
  assert.equal(objectLightGain(.22,0),1);assert.ok(Math.abs(objectLightGain(.22,100)-.22)<1e-9);assert.ok(objectLightGain(.22)>.7);
  const mood={preset:'classic-night',intensity:100,tvGlow:100,grade:{exposure:-60,contrast:150,saturation:20,temperature:100}};
  assert.equal(gradeFilter(mood,'figures',0),'brightness(1) contrast(1) saturate(1) sepia(0) hue-rotate(0deg)');
  assert.notEqual(gradeFilter(mood,'figures',35),gradeFilter(mood,'figures',100));
});
test('automatic framing and per-object light settings validate while malformed writes are rejected',()=>{
  const views=new Set(['home-landscape-16x9']);
  assert.equal(validPresentations({'home-landscape-16x9':{video:{auto:true,fit:'cover'}}},views),true);
  assert.equal(validPresentations({'home-landscape-16x9':{video:{auto:false,fit:'contain'}}},views),true);
  assert.equal(validPresentations({'home-landscape-16x9':{video:{auto:'yes'}}},views),false);
  assert.equal(validStudioPlacement({lightResponse:0}),true);assert.equal(validStudioPlacement({lightResponse:100}),true);
  assert.equal(validStudioPlacement({lightResponse:101}),false);assert.equal(validStudioPlacement({lightResponse:'35'}),false);
});

test('detects encoded dark borders and slight asymmetric console overscan',()=>{
 const pixels=frame(29,8,100,75);
 for(let y=0;y<90;y++)for(let x=0;x<160;x++){const i=(y*160+x)*4;if(!pixels[i]){pixels[i]=18+(x+y)%7;pixels[i+1]=20;pixels[i+2]=22;pixels[i+3]=255;}}
 assert.deepEqual(detectActiveArea(pixels,160,90),{x:29/160,y:8/90,width:100/160,height:75/90});
});
