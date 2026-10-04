import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {installActivityControls} from '../activity-controls.mjs';

test('host credentials are scoped, expire and protect shared activity controls',async()=>{
 let now=1000;const app=express();app.use(express.json());
 const authorize=(req,res,next)=>req.get('X-Test')==='yes'?next():res.sendStatus(401);
 installActivityControls(app,authorize,{editKey:'owner-test-key',now:()=>now});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const root=`http://127.0.0.1:${server.address().port}`;
 const headers={'X-Test':'yes','Content-Type':'application/json'};
 const call=(path,method='GET',body,extra={})=>fetch(root+path,{method,headers:{...headers,...extra},...(body?{body:JSON.stringify(body)}:{})});
 try{
  assert.equal((await fetch(root+'/api/activity-controls?instance=one')).status,401);
  const initial=await (await call('/api/activity-controls?instance=one')).json();assert.equal(initial.host,false);
  assert.equal((await call('/api/host/auth?instance=one','POST',null,{'X-Decoration-Key':'wrong'})).status,401);
  const auth=await (await call('/api/host/auth?instance=one','POST',null,{'X-Decoration-Key':'owner-test-key'})).json(),host={'X-Host-Token':auth.token};
  assert.equal((await call('/api/activity-controls?instance=one','PUT',{...initial,aspect:'4:3'})).status,403);
  assert.equal((await call('/api/activity-controls?instance=two','PUT',{...initial,aspect:'4:3'},host)).status,403);
  assert.equal((await call('/api/activity-controls?instance=one','PUT',{...initial,aspect:'4:3'},host)).status,200);
  const viewer=await (await call('/api/activity-controls?instance=one')).json();assert.equal(viewer.aspect,'4:3');assert.equal(viewer.host,false);
  assert.equal((await call('/api/activity-controls?instance=one','PUT',initial,host)).status,409);
  assert.equal((await (await call('/api/activity-controls?instance=two')).json()).aspect,'16:9');
  assert.equal((await call('/api/activity-controls?instance=one','GET',null,{'X-Host-Token':auth.token+'tampered'})).status,200);
  assert.equal((await (await call('/api/activity-controls?instance=one','GET',null,{'X-Host-Token':auth.token+'tampered'})).json()).host,false);
  now+=6*60*60*1000+1;assert.equal((await call('/api/activity-controls?instance=one','PUT',viewer,host)).status,403);
  const reset=await (await call('/api/activity-controls?instance=one')).json();assert.equal(reset.revision,0);assert.notEqual(reset.epoch,initial.epoch);
 }finally{await new Promise(r=>server.close(r));}
});


test('new activities use the saved initial scene while active calls keep their shared choices',async()=>{
 let initial={scene:'arcade',aspect:'4:3',retro:'normal',smoothing:false};const app=express();app.use(express.json());
 installActivityControls(app,(_req,_res,next)=>next(),{editKey:'test',initialScene:async()=>initial});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const root=`http://127.0.0.1:${server.address().port}`;
 try{
  const first=await (await fetch(root+'/api/activity-controls?instance=first')).json();assert.equal(first.scene,'arcade');assert.equal(first.aspect,'4:3');assert.equal(first.smoothing,false);
  initial={scene:'home',aspect:'16:9',retro:'immersive',smoothing:true};
  const existing=await (await fetch(root+'/api/activity-controls?instance=first')).json();assert.equal(existing.scene,'arcade');assert.equal(existing.epoch,first.epoch);
  const second=await (await fetch(root+'/api/activity-controls?instance=second')).json();assert.equal(second.scene,'home');assert.equal(second.aspect,'16:9');
 }finally{await new Promise(r=>server.close(r))}
});
