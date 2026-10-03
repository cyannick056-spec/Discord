import {test} from 'node:test';
import assert from 'node:assert/strict';
import {access} from 'node:fs/promises';
import {roomThemes,themeFor,roomPhoto} from '../public/room-themes.mjs';
import {tvModels} from '../public/tv/models.mjs';
import {themeGlass} from '../public/room-theme-glass.mjs';
import {validPresentations} from '../studio-validation.mjs';
import {photoLayout} from '../public/photo-layout.mjs';

test('shared TV models retain identical frame and glass proportions in every room and orientation',()=>{
 for(const {id} of roomThemes)for(const type of ['crt','flat'])for(const [width,height] of [[1200,800],[430,932]]){
  const {frame,screen}=photoLayout(width,height,type,{},false,id);
  assert.ok(Math.abs(frame.height/frame.width-tvModels[type].height/tvModels[type].width)<1e-8);
  assert.ok(Math.abs(screen.width/frame.width-tvModels[type].glass[2]/tvModels[type].width)<1e-8);
  assert.ok(Math.abs((screen.left-frame.left)/frame.width-tvModels[type].glass[0]/tvModels[type].width)<1e-8);
 }
});
test('the shared TV remains complete in Discord landscape aspect ratios',()=>{
 for(const {id} of roomThemes)for(const type of ['crt','flat'])for(const [width,height] of [[1536,674],[1920,650]]){
  const {photo,frame}=photoLayout(width,height,type,{},false,id);
  assert.ok(photo.top+frame.top>=11.999);
  assert.ok(photo.top+frame.top+frame.height<=height);
 }
});

test('all room options validate and retain neutral fallback for older preferences',()=>{
 const key='home-landscape-16x9',views=new Set([key]);
 for(const theme of roomThemes)assert.equal(validPresentations({[key]:{style:'minimal',environment:'cozy-night',roomTheme:theme.id}},views),true);
 assert.equal(validPresentations({[key]:{roomTheme:'unavailable'}},views),false);assert.equal(themeFor({}), 'midnight');assert.equal(themeFor({roomTheme:'unavailable'}),'midnight');
});
test('each neutral room has both TVs and orientations, with glass aligned at every zoom',async()=>{
 for(const {id} of roomThemes)for(const type of ['crt','flat'])for(const orientation of ['wide','portrait']){
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
