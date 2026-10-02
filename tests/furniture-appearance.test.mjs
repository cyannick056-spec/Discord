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
