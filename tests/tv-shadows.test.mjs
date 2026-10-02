import test from 'node:test';
import assert from 'node:assert/strict';
import {lightAt,projectTvShadow} from '../src/tv-shadow-model.ts';
const tv={x:200,y:100,width:240,height:180};
const light={x:90,y:160,radius:500,intensity:.8,softness:70};
test('TV shadow follows light direction, range, power and source size',()=>{
 const left=projectTvShadow(tv,light),right=projectTvShadow(tv,{...light,x:550});
 assert.ok(left.x+left.width/2>320);assert.ok(right.x+right.width/2<320);
 assert.ok(projectTvShadow(tv,{...light,y:0}).y>projectTvShadow(tv,{...light,y:400}).y);
 assert.equal(projectTvShadow(tv,{...light,radius:30}),undefined);
 assert.equal(projectTvShadow(tv,{...light,intensity:0}),undefined);
 assert.equal(projectTvShadow(tv,{...light,behindTv:true}),undefined);
 assert.ok(projectTvShadow(tv,{...light,intensity:.4}).power<left.power);
 assert.ok(projectTvShadow(tv,{...light,softness:95}).blur>projectTvShadow(tv,{...light,softness:10}).blur);
});
test('elliptical and rotated light ranges match practical illumination',()=>{
 assert.equal(lightAt({...light,shape:'strip'},90,400),0);
 assert.ok(lightAt({...light,shape:'strip',angle:90},90,400)>0);
 assert.equal(lightAt(light,590,160),0);
 assert.ok(lightAt(light,100,160)>lightAt(light,450,160));
});
