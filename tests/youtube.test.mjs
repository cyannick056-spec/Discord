import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {parseYouTubeLink,playbackPosition,validatePlayback} from '../youtube-model.mjs';
import {installPlayback} from '../playback.mjs';
import {youtubeBase,youtubeScriptUrl,isDiscordOrigin,isYouTubeScriptResponse} from '../youtube-network.mjs';
test('YouTube uses the configured Discord route for scripts and iframe host; rejects HTML masquerading as a loader',()=>{
 const discord='https://1553964489517568082.discordsays.com/?instance_id=123';
 assert.equal(youtubeScriptUrl(discord),'https://1553964489517568082.discordsays.com/youtube/iframe_api');
 assert.equal(youtubeBase(discord),'https://1553964489517568082.discordsays.com/youtube');
 assert.equal(youtubeScriptUrl('https://1553964489517568082.discordsays.com/.proxy/?frame_id=1'),'https://1553964489517568082.discordsays.com/.proxy/youtube/iframe_api');
 assert.equal(youtubeScriptUrl('http://localhost:5185/?instance_id=123'),'https://www.youtube.com/iframe_api');
 assert.equal(isDiscordOrigin('https://discordsays.com.evil.test/'),false);
 assert.equal(isDiscordOrigin('https://evil.test/?domain=1553964489517568082.discordsays.com'),false);
 assert.equal(isYouTubeScriptResponse(200,'application/javascript; charset=utf-8'),true);
 assert.equal(isYouTubeScriptResponse(200,'text/javascript'),true);
 for(const [status,content] of [[200,'text/html'],[404,'application/javascript'],[403,'text/plain'],[200,'application/json'],[302,'application/javascript']])assert.equal(isYouTubeScriptResponse(status,content),false);
});
test('YouTube links normalize videos, shorts, timestamps and playlists; reject unrelated or malformed URLs',()=>{
 assert.deepEqual(parseYouTubeLink('https://youtu.be/dQw4w9WgXcQ?t=1m30s'),{videoId:'dQw4w9WgXcQ',playlistId:'',position:90,index:0});
 assert.equal(parseYouTubeLink('https://www.youtube.com/shorts/dQw4w9WgXcQ').videoId,'dQw4w9WgXcQ');
 assert.equal(parseYouTubeLink('https://www.youtube.com/playlist?list=PL1234567890&index=3').index,2);
 for(const url of ['https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ','https://youtube.com@evil.test','javascript:alert(1)','https://www.youtube.com/watch?v=wrong','https://www.youtube.com/playlist?list=x','https://youtu.be:444/dQw4w9WgXcQ'])assert.throws(()=>parseYouTubeLink(url));
 assert.equal(playbackPosition({position:12,playing:true,updatedAt:1000},4000),15);
 assert.equal(playbackPosition({position:12,playing:false,updatedAt:1000},4000),12);
 assert.throws(()=>validatePlayback({source:'youtube',videoId:'dQw4w9WgXcQ',playlistId:'',playing:true,position:NaN}));
});
test('playback requires authorization, isolates activities, rejects stale or invalid writes and expires sessions',async()=>{
 let now=10_000;const app=express();app.use(express.json());installPlayback(app,(req,res,next)=>req.get('X-Test')==='yes'?next():res.sendStatus(401),{now:()=>now});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const root=`http://127.0.0.1:${server.address().port}/api/playback`,headers={'X-Test':'yes','Content-Type':'application/json'};
 const put=(body)=>fetch(root+'?instance=one',{method:'PUT',headers,body:JSON.stringify(body)});
 try{
  assert.equal((await fetch(root+'?instance=one')).status,401);
  assert.equal((await fetch(root+'?instance=bad.space',{headers})).status,400);
  const initial=await (await fetch(root+'?instance=one',{headers})).json();assert.equal(initial.source,'switch');
  const state={source:'youtube',videoId:'dQw4w9WgXcQ',playlistId:'',position:10,playing:true,revision:0};
  assert.equal((await put({...state,videoId:'<iframe>'})).status,400);
  assert.equal((await put(state)).status,200);assert.equal((await put(state)).status,409);
  now+=5000;const one=await (await fetch(root+'?instance=one',{headers})).json();assert.equal(playbackPosition(one,now),15);assert.equal(one.revision,1);
  assert.equal((await (await fetch(root+'?instance=two',{headers})).json()).source,'switch');
  assert.equal((await put({...one,source:'switch'})).status,200);
  now+=6*60*60*1000+1;assert.equal((await (await fetch(root+'?instance=one',{headers})).json()).revision,0);
 }finally{await new Promise(r=>server.close(r));}
});
