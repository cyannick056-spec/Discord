const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number.isFinite(v)?v:a));
export const effectDefaults={brightness:100,contrast:100,saturation:100,hue:0,blur:0,shadow:0,shadowBlur:6,shadowX:2,shadowY:4};
export function figureFilter(e={},scale=1){
 const p={...effectDefaults,...e};
 if(Object.keys(effectDefaults).every(k=>p[k]===effectDefaults[k]))return '';
 return `brightness(${clamp(p.brightness,0,200)/100}) contrast(${clamp(p.contrast,0,200)/100}) saturate(${clamp(p.saturation,0,200)/100}) hue-rotate(${clamp(p.hue,-180,180)}deg) blur(${clamp(p.blur,0,5)*scale}px)`+(p.shadow?` drop-shadow(${clamp(p.shadowX,-30,30)*scale}px ${clamp(p.shadowY,-30,30)*scale}px ${clamp(p.shadowBlur,0,25)*scale}px rgba(0,0,0,${clamp(p.shadow,0,100)/100}))`:'');
}
// A marked support line lives in photo coordinates, so camera zoom/pan follows it.
export function supportPoint(surface,photo,x){
 const [a,b]=surface,lo=Math.min(a.x,b.x),hi=Math.max(a.x,b.x),nx=clamp((x-photo.left)/photo.width*100,lo,hi);
 const t=b.x===a.x?.5:(nx-a.x)/(b.x-a.x);
 return {x:photo.left+nx/100*photo.width,y:photo.top+(a.y+(b.y-a.y)*t)/100*photo.height,angle:Math.atan2((b.y-a.y)*photo.height,(b.x-a.x)*photo.width)*180/Math.PI};
}
export function supportedPlacement(p,rect,photo,surface,height){
 const foot=supportPoint(surface,photo,rect.x),basis=rect.basis;
 return {anchor:'scene',x:(foot.x-basis.x)/basis.width*100,y:(foot.y-height/2-basis.y)/basis.height*100,rotation:Math.max(-180,Math.min(180,foot.angle)),transform:{...p.transform,surface:'cabinet',auto:false,tiltX:0,tiltY:Math.max(-12,Math.min(12,(foot.x-photo.left)/photo.width*24-12))},contactShadow:{opacity:35,blur:6,width:65,x:0,y:0}};
}
