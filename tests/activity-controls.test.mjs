import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {installActivityControls} from '../activity-controls.mjs';
import {installPlayback} from '../playback.mjs';
test('host credentials are scoped, expire and protect shared format and playback',async()=>{
 let now=1000;const app=express();app.use(express.json());
 const authorize=(req,res,next)=>req.get('X-Test')==='yes'?next():res.sendStatus(401);
 const {requireHost}=installActivityControls(app,authorize,{editKey:'owner-test-key',now:()=>now});
 installPlayback(app,authorize,{requireHost,now:()=>now});
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
  const playback={source:'youtube',videoId:'dQw4w9WgXcQ',playlistId:'',position:0,playing:true,revision:0};
  assert.equal((await call('/api/playback?instance=one','PUT',playback)).status,403);
  assert.equal((await call('/api/playback?instance=one','PUT',playback,host)).status,200);
  assert.equal((await call('/api/activity-controls?instance=one','GET',null,{'X-Host-Token':auth.token+'tampered'})).status,200);
  assert.equal((await (await call('/api/activity-controls?instance=one','GET',null,{'X-Host-Token':auth.token+'tampered'})).json()).host,false);
  now+=6*60*60*1000+1;assert.equal((await call('/api/activity-controls?instance=one','PUT',viewer,host)).status,403);
 }finally{await new Promise(r=>server.close(r));}
});
