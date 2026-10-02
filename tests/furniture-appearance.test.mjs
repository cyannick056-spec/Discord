import test from 'node:test';
import assert from 'node:assert/strict';
import {isSolidFurniture,solidFurniturePixels} from '../src/furniture-appearance.ts';

test('furniture stays solid while holes, edge feathering and source colors survive',()=>{
  const pixels=new Uint8ClampedArray([91,57,39,253,12,34,56,200,0,0,0,0,25,20,18,40]);
  solidFurniturePixels(pixels);
  assert.deepEqual([...pixels],[91,57,39,255,12,34,56,255,0,0,0,0,25,20,18,40]);
  assert.equal(isSolidFurniture({kind:'builtin',asset:'cabinet'}),true);
  assert.equal(isSolidFurniture({asset:'custom.png',category:'furniture'}),true);
  assert.equal(isSolidFurniture({kind:'builtin',asset:'anime-figure',category:'figurine'}),false);
  assert.equal(isSolidFurniture({kind:'builtin',asset:'mushroom-lamp',category:'lamp'}),false);
});

test('solid sprite bodies preserve contour coverage and internal hole edges',()=>{
  const w=9,h=9,pixels=new Uint8ClampedArray(w*h*4);
  for(let y=1;y<8;y++)for(let x=1;x<8;x++)pixels.set([90,60,30,190],(y*w+x)*4);
  pixels[(4*w+4)*4+3]=0;pixels.set([90,60,30,40],(3*w)*4);
  solidFurniturePixels(pixels,w,h);
  const alpha=(x,y)=>pixels[(y*w+x)*4+3];
  assert.equal(alpha(2,2),255);assert.equal(alpha(1,4),190);
  assert.equal(alpha(4,3),190);assert.equal(alpha(4,4),0);assert.equal(alpha(0,3),40);
  assert.deepEqual([...pixels.slice((2*w+2)*4,(2*w+2)*4+3)],[90,60,30]);
});
