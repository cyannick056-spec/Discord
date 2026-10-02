import {validatePlayback} from './youtube-model.mjs';
// Ephemeral playback belongs to an Activity instance, never to room decoration.
export function installPlayback(app, authorize, {now=Date.now}={}) {
  const sessions=new Map(), lifetime=6*60*60*1000;
  const session = (req,res,next) => {
    const id=req.query.instance;
    if(typeof id!=='string' || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) return res.status(400).json({error:'Actividad inválida'});
    const time=now();for(const [key,value] of sessions)if(time-value.touched>lifetime)sessions.delete(key);
    if(!sessions.has(id)) {
      if(sessions.size>=128)return res.status(503).json({error:'Inténtalo en unos minutos'});
      sessions.set(id,{state:{source:'switch',videoId:'',playlistId:'',position:0,playing:false,updatedAt:time,revision:0},touched:time,writes:[]});
    }
    req.playback=sessions.get(id);req.playback.touched=time;res.set('Cache-Control','no-store');next();
  };
  app.get('/api/playback',authorize,session,(req,res)=>res.json({...req.playback.state,serverNow:now()}));
  app.put('/api/playback',authorize,session,(req,res)=>{
    const record=req.playback,time=now();
    if(req.body?.revision!==record.state.revision)return res.status(409).json({...record.state,serverNow:time});
    let value;try{value=validatePlayback(req.body);}catch(error){return res.status(400).json({error:error.message});}
    record.writes=record.writes.filter(t=>time-t<60_000);
    if(record.writes.length>=60)return res.status(429).json({error:'Demasiados cambios, espera un momento'});
    record.writes.push(time);record.state={...value,updatedAt:time,revision:record.state.revision+1};
    res.json({...record.state,serverNow:time});
  });
}
