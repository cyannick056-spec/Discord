import crypto from 'node:crypto';
const lifetime=6*60*60*1000;
const same=(a,b)=>{const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));return x.length>0 && x.length===y.length && crypto.timingSafeEqual(x,y);};
export function installActivityControls(app,authorize,{editKey,now=Date.now}={}) {
  const rooms=new Map(),attempts=new Map();
  const instance=req=>req.query.instance || req.get('X-Activity-Instance');
  const validInstance=id=>typeof id==='string' && /^[A-Za-z0-9_-]{1,128}$/.test(id);
  const sign=value=>crypto.createHmac('sha256',editKey).update(`shis-host:${value}`).digest('base64url');
  const isHost=req=>{
    const token=req.get('X-Host-Token');if(!editKey || typeof token!=='string' || token.length>512)return false;
    const [body,signature,extra]=token.split('.');if(!body || extra || !same(signature,sign(body)))return false;
    try{const value=JSON.parse(Buffer.from(body,'base64url'));return value.instance===instance(req) && Number.isSafeInteger(value.expires) && value.expires>now() && value.expires<=now()+lifetime;}catch{return false;}
  };
  const requireHost=(req,res,next)=>isHost(req)?next():res.status(403).json({error:'Solo el host puede cambiar la actividad'});
  const session=(req,res,next)=>{
    const id=instance(req);if(!validInstance(id))return res.status(400).json({error:'Actividad inválida'});
    for(const [id,room] of rooms)if(now()-room.touched>lifetime)rooms.delete(id);
    if(!rooms.has(id)){if(rooms.size>=128)return res.status(503).json({error:'Inténtalo en unos minutos'});rooms.set(id,{aspect:'16:9',scene:'home',retro:'immersive',smoothing:true,revision:0,epoch:crypto.randomUUID()});}
    req.controls=rooms.get(id);req.controls.touched=now();res.set('Cache-Control','no-store');next();
  };
  app.post('/api/host/auth',authorize,(req,res)=>{
    const id=instance(req);if(!validInstance(id))return res.status(400).json({error:'Actividad inválida'});
    for(const [ip,entry] of attempts)if(now()-entry.start>=60_000)attempts.delete(ip);
    const ip=req.ip,entry=attempts.get(ip)||{start:now(),count:0};entry.count++;attempts.set(ip,entry);
    if(entry.count>10)return res.status(429).json({error:'Espera un minuto antes de reintentar'});
    if(!same(req.get('X-Decoration-Key'),editKey))return res.status(401).json({error:'Clave de edición incorrecta'});
    const body=Buffer.from(JSON.stringify({instance:id,expires:now()+lifetime,nonce:crypto.randomUUID()})).toString('base64url');
    res.set('Cache-Control','no-store').json({token:`${body}.${sign(body)}`});
  });
  const reply=(req,res)=>{const {touched,...state}=req.controls;res.json({...state,host:isHost(req)});};
  app.get('/api/activity-controls',authorize,session,reply);
  app.put('/api/activity-controls',authorize,requireHost,session,(req,res)=>{
    const b=req.body,r=req.controls;
    if(!b || !['16:9','4:3'].includes(b.aspect) || !['home','arcade'].includes(b.scene) || !['off','normal','immersive','scanlines'].includes(b.retro) || typeof b.smoothing!=='boolean')return res.status(400).json({error:'Formato inválido'});
    if(b.revision!==r.revision)return res.status(409).json({...r,host:true});
    Object.assign(r,{aspect:b.aspect,scene:b.scene,retro:b.retro,smoothing:b.smoothing,revision:r.revision+1});reply(req,res);
  });
  return {requireHost,isHost};
}
