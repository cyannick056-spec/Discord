import test from 'node:test';
import assert from 'node:assert/strict';
import {finishPixels,isSolidObject} from '../src/object-finish.ts';
import {edgeColors} from '../src/tv-light-detail.ts';
import {validMood,validStudioPlacement} from '../studio-validation.mjs';

test('solid figures preserve cutouts and soft edges while tint preserves their texture',()=>{
  const pixels=new Uint8ClampedArray([160,120,80,210,80,60,40,190,9,7,5,0,40,30,20,45]);
  finishPixels(pixels,true,'#ff8000',50);
  assert.equal(pixels[3],255);assert.equal(pixels[7],255);assert.equal(pixels[11],0);assert.equal(pixels[15],45);
  assert.equal(pixels[0],160);assert.equal(pixels[4],80);assert.equal(pixels[2],40);assert.equal(pixels[6],20);
  assert.equal(isSolidObject({category:'figurine'},{}),true);
  assert.equal(isSolidObject({category:'figurine'},{solid:false}),false);
  assert.equal(isSolidObject({category:'furniture'},{solid:false}),true);
  assert.equal(isSolidObject({kind:'builtin',category:'sticker'},{}),false);
});
test('TV spill retains opposing local colors and black video never emits detail light',()=>{
  const w=64,h=36,pixels=new Uint8ClampedArray(w*h*4);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++) {const i=(y*w+x)*4;pixels[i+(x<w/2?0:2)]=220;pixels[i+3]=255;}
  const colors=edgeColors(pixels,w,h);assert.ok(colors.left.r>250 && colors.left.b<1);assert.ok(colors.right.b>250 && colors.right.r<1);assert.ok(colors.top.r>250 && colors.top.b>250);
  const dark=edgeColors(new Uint8ClampedArray(w*h*4),w,h);for(const color of Object.values(dark)) assert.equal(color.strength,0);
});
test('solid, tint and detailed TV lighting validate, including old scenes with no new fields',()=>{
  assert.equal(validStudioPlacement({solid:true,tint:'#ffca80',tintStrength:35}),true);assert.equal(validStudioPlacement({}),true);
  for(const p of [{solid:'true'},{tint:'transparent'},{tintStrength:101},{tintStrength:NaN}]) assert.equal(validStudioPlacement(p),false);
  const mood={preset:'neutral',intensity:65,tvGlow:100};assert.equal(validMood(mood),true);assert.equal(validMood({...mood,tvDetail:70,tvSoftness:85}),true);assert.equal(validMood({...mood,tvDetail:-1}),false);
});
