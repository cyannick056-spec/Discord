import {test} from 'node:test';
import assert from 'node:assert/strict';
import {paintFor,paintFilter} from '../src/tv-paint.mjs';
import {validPresentations} from '../studio-validation.mjs';
import {tvModels} from '../public/tv/models.mjs';
import {roomThemes,roomPhoto} from '../public/room-themes.mjs';
test('replacement flat TV starts black without filters despite retired bright settings, while CRT colors stay intact',()=>{
 const old={enabled:true,body:'#ffffff',exposure:60,strength:100};
 assert.equal(paintFilter('flat',old),'');assert.equal(paintFor('flat',old).body,'#202124');
 assert.deepEqual(paintFor('crt',old),old);
 const custom={enabled:true,modelRevision:2,body:'#72777c',exposure:0,strength:100};
 assert.deepEqual(paintFor('flat',custom),custom);assert.match(paintFilter('flat',custom),/^brightness\(/);assert.equal(paintFilter('flat',custom).includes('blur'),false);
 assert.equal(paintFilter('flat',{...custom,body:'#ffffff',exposure:60}),'brightness(4)');
 const views=new Set(['home-landscape-16x9']);assert.equal(validPresentations({'home-landscape-16x9':{tvPaint:custom}},views),true);
 assert.equal(validPresentations({'home-landscape-16x9':{tvPaint:{...custom,modelRevision:'2'}}},views),false);
 assert.equal(tvModels.flat.glass[2]/tvModels.flat.glass[3],16/9);
});
test('warm night keeps its original assets; true 3am is a separate choice',()=>{
 assert.equal(roomThemes.find(t=>t.id==='midnight').name,'Noche cálida');assert.equal(roomThemes.find(t=>t.id==='midnight3').name,'3 a. m.');
 assert.equal(roomPhoto('flat','landscape','midnight'),'/rooms/hd-v3/midnight-wide.webp');
 assert.equal(roomPhoto('flat','landscape','midnight3'),'/rooms/clean-hd-v4/midnight3-wide.webp');
});
