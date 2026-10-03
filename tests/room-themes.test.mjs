import {test} from 'node:test';
import assert from 'node:assert/strict';
import {access} from 'node:fs/promises';
import {roomThemes,themeFor,roomPhoto} from '../public/room-themes.mjs';
import {themeGlass} from '../public/room-theme-glass.mjs';
import {validPresentations} from '../studio-validation.mjs';
import {photoLayout} from '../public/photo-layout.mjs';

test('all room options validate and retain original fallback for older preferences',()=>{
 const key='home-landscape-16x9',views=new Set([key]);
 for(const theme of roomThemes)assert.equal(validPresentations({[key]:{style:'minimal',environment:'cozy-night',roomTheme:theme.id}},views),true);
 assert.equal(validPresentations({[key]:{roomTheme:'unavailable'}},views),false);assert.equal(themeFor({}), 'classic');assert.equal(themeFor({roomTheme:'unavailable'}),'classic');
});
test('each neutral room has both TVs and orientations, with glass aligned at every zoom',async()=>{
 for(const {id} of roomThemes.filter(t=>t.id!=='classic'))for(const type of ['crt','flat'])for(const orientation of ['wide','portrait']){
  await access(new URL('../public'+roomPhoto(type,orientation==='wide'?'landscape':'portrait',id),import.meta.url));
  const [iw,ih,x,y,w,h]=themeGlass[id][`${type}-${orientation}`];assert.ok(x>0&&y>0&&x+w<iw&&y+h<ih);
  for(const zoom of [1,1.4,2])for(const pan of [-40,0,40]){
   const width=orientation==='wide'?1200:430,height=orientation==='wide'?800:932;
   const {photo,screen}=photoLayout(width,height,type,{zoom,x:pan,y:pan},false,id),scale=photo.width/iw;
   assert.ok(Math.abs(screen.left-x*scale)<1e-8);assert.ok(Math.abs(screen.top-y*scale)<1e-8);assert.ok(Math.abs(screen.width-w*scale)<1e-8);assert.ok(Math.abs(screen.height-h*scale)<1e-8);
   assert.ok(photo.left<=0&&photo.top<=0&&photo.left+photo.width>=width-.001&&photo.top+photo.height>=height-.001);
  }
 }
});
