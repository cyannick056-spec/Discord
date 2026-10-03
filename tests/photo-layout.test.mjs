import {test} from 'node:test';
import assert from 'node:assert/strict';
import {photoLayout,glass} from '../public/photo-layout.mjs';
for(const type of ['crt','flat'])for(const portrait of [false,true])test(`${type} ${portrait?'portrait':'wide'} glass follows photo at every zoom and crop`,()=>{
 const [iw,ih,x,y,w,h]=glass[`${type}-${portrait?'portrait':'wide'}`];
 for(const [width,height] of (portrait?[[864,1536],[430,932]]:[[1536,864],[1200,800]]))for(const zoom of [1,1.4,2])for(const pan of [-40,0,40]){
 const {photo,screen}=photoLayout(width,height,type,{zoom,x:pan,y:pan});
 const scale=photo.width/iw;
 assert.ok(Math.abs(screen.left-x*scale)<1e-8);assert.ok(Math.abs(screen.top-y*scale)<1e-8);
 assert.ok(Math.abs(screen.width-w*scale)<1e-8);assert.ok(Math.abs(screen.height-h*scale)<1e-8);
 assert.ok(photo.left<=.00001&&photo.top<=.00001);
 assert.ok(photo.left+photo.width>=width-.00001&&photo.top+photo.height>=height-.00001);
 }
});
test('compact video occupies all available space',()=>{
 assert.deepEqual(photoLayout(300,200,'crt',{},true).screen,{left:0,top:0,width:300,height:200});
});
