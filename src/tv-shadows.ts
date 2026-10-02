import { projectTvShadow, type ShadowRect, type ShadowLight } from './tv-shadow-model';
import type { SurfacePlane } from './support-surfaces';

const images=new Map<string,HTMLImageElement>();
let cached: {key:string;mask:HTMLCanvasElement} | undefined;
// Reuse the photographed alpha and the same body crop as the displayed casing.
// Fill the glass: it is transparent for video compositing, but physically solid.
export function tvSilhouette(face: HTMLElement) {
  const s=getComputedStyle(face), n=(k:string)=>parseFloat(s.getPropertyValue('--'+k))/100;
  const url=/url\(["']?([^"')]+)["']?\)/.exec(s.getPropertyValue('--room-art'))?.[1];if(!url) return;
  let image=images.get(url);if(!image){image=new Image();image.src=url;images.set(url,image);}
  if(!image.complete || !image.naturalWidth) return;
  const original=face.dataset.tvModel==='original';
  const photo=original ? [0,0,1,1] : ['x','y','w','h'].map(k=>n('photo-'+k));
  const body=['x','y','w','h'].map(k=>n('tv-body-'+k)),glass=['x','y','w','h'].map(k=>n('glass-'+k));
  if([...photo,...body,...glass].some(v=>!Number.isFinite(v)) || photo[2]<=0 || photo[3]<=0) return;
  const ratio=face.offsetHeight*body[3]/(face.offsetWidth*body[2]);
  const key=JSON.stringify([url,photo,body,glass,ratio]);if(cached?.key===key) return cached.mask;
  const mask=document.createElement('canvas');mask.width=256;mask.height=Math.max(32,Math.min(512,Math.round(256*ratio)));
  const c=mask.getContext('2d')!;c.beginPath();c.roundRect(0,0,mask.width,mask.height,Math.min(mask.width,mask.height)*.012);c.clip();
  const sx=(body[0]-photo[0])/photo[2]*image.naturalWidth,sy=(body[1]-photo[1])/photo[3]*image.naturalHeight;
  c.drawImage(image,sx,sy,body[2]/photo[2]*image.naturalWidth,body[3]/photo[3]*image.naturalHeight,0,0,mask.width,mask.height);
  c.fillStyle='#000';c.fillRect((glass[0]-body[0])/body[2]*mask.width,(glass[1]-body[1])/body[3]*mask.height,glass[2]/body[2]*mask.width,glass[3]/body[3]*mask.height);
  c.globalCompositeOperation='source-in';c.fillRect(0,0,mask.width,mask.height);cached={key,mask};return mask;
}

export function clipSurface(ctx: CanvasRenderingContext2D, p: SurfacePlane) {
  ctx.beginPath();if(p.quad){p.quad.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();}
  else ctx.rect(p.x,p.y,p.width,p.height);ctx.clip();
}

export function paintCastMask(ctx: CanvasRenderingContext2D, mask: HTMLCanvasElement, tv: ShadowRect, light: ShadowLight, wallBottom: number) {
  const projection=projectTvShadow(tv,light);if(!projection) return;
  ctx.save();ctx.beginPath();ctx.rect(0,0,ctx.canvas.width,Math.max(0,wallBottom));ctx.clip();
  ctx.filter=`blur(${projection.blur}px)`;ctx.drawImage(mask,projection.x,projection.y,projection.width,projection.height);ctx.restore();
  return projection;
}

export function weightShadowByLight(ctx: CanvasRenderingContext2D, mask: HTMLCanvasElement, light: ShadowLight) {
  ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);ctx.save();
  ctx.translate(light.x,light.y);ctx.rotate((light.angle ?? 0)*Math.PI/180);
  ctx.scale(light.radius,light.radius*(light.shape==='strip' ? .16 : light.shape==='spot' ? .4 : 1));
  const fade=ctx.createRadialGradient(0,0,0,0,0,1);
  fade.addColorStop(0,`rgba(0,0,0,${light.intensity})`);fade.addColorStop(.15+light.softness/100*.4,`rgba(0,0,0,${light.intensity*.6})`);fade.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=fade;ctx.fillRect(-1,-1,2,2);ctx.restore();
  ctx.globalCompositeOperation='destination-in';ctx.drawImage(mask,0,0);ctx.globalCompositeOperation='source-over';
}

export function paintTvContact(ctx: CanvasRenderingContext2D, mask: HTMLCanvasElement, tv: ShadowRect, plane: SurfacePlane, gain: number) {
  // A narrow silhouette footprint on the actual support plane, with a firm
  // contact edge and a widening soft penumbra. Nothing spills down its front.
  if(gain<=0 || plane.width<=0 || plane.height<=0) return;
  const bottom=tv.y+tv.height, h=Math.min(tv.width*.075,plane.height*.85);
  ctx.save();clipSurface(ctx,plane);
  ctx.globalAlpha=gain*.42;ctx.filter=`blur(${Math.max(.8,tv.width*.012)}px)`;
  ctx.drawImage(mask,tv.x-tv.width*.025,bottom-h*.75,tv.width*1.05,h);
  ctx.globalAlpha=gain*.58;ctx.filter=`blur(${Math.max(.4,tv.width*.0025)}px)`;
  // Use only the bottom of the photographed silhouette for the contact band.
  ctx.drawImage(mask,0,mask.height*.92,mask.width,mask.height*.08,tv.x,bottom-tv.width*.003,tv.width,Math.max(1,tv.width*.007));ctx.restore();
}
