export type ShadowRect = { x: number; y: number; width: number; height: number };
export type ShadowLight = { x: number; y: number; radius: number; intensity: number; softness: number; angle?: number; shape?: 'point' | 'spot' | 'strip'; behindTv?: boolean };

// Match the elliptical range and falloff used by the practical-light renderer.
export function lightAt(light: ShadowLight, x: number, y: number) {
  if(light.radius <= 0 || light.intensity <= 0) return 0;
  const angle=(light.angle ?? 0)*Math.PI/180, dx=x-light.x,dy=y-light.y;
  const aspect=light.shape==='strip' ? .16 : light.shape==='spot' ? .4 : 1;
  const distance=Math.hypot((dx*Math.cos(angle)+dy*Math.sin(angle))/light.radius,(-dx*Math.sin(angle)+dy*Math.cos(angle))/(light.radius*aspect));
  if(distance>=1) return 0;
  const knee=.15+light.softness/100*.4;
  const falloff=distance<knee ? 1-distance/knee*.4 : .6*(1-distance)/(1-knee);
  return Math.min(1,light.intensity)*falloff;
}

export function projectTvShadow(tv: ShadowRect, light: ShadowLight) {
  // Behind-TV accent lights illuminate the wall directly, rather than casting
  // the TV's front silhouette back towards the viewer.
  if(light.behindTv) return;
  const cx=tv.x+tv.width/2,cy=tv.y+tv.height/2;
  const nearX=Math.max(tv.x,Math.min(tv.x+tv.width,light.x)),nearY=Math.max(tv.y,Math.min(tv.y+tv.height,light.y));
  const power=Math.max(lightAt(light,cx,cy),lightAt(light,nearX,nearY)*.65);
  if(power<.008) return;
  const distance=Math.max(tv.width*.45,Math.hypot(cx-light.x,cy-light.y));
  // Approximate casing-to-wall separation in this photographic 2.5D scene.
  const separation=tv.width*.11, magnification=1+separation/distance;
  const dx=(cx-light.x)/distance*separation,dy=(cy-light.y)/distance*separation;
  return { x:cx+dx-tv.width*magnification/2,y:cy+dy-tv.height*magnification/2,
    width:tv.width*magnification,height:tv.height*magnification,
    blur:Math.max(.7,tv.width*.004+separation*(light.softness/100)*.32),power };
}
