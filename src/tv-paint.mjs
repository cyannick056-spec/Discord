// A replacement flat TV starts with its original black finish. Personal colors
// chosen for this model are explicit and never affect the transparent stand gap.
export function paintFor(type,paint={}){
 if(type==='flat'&&paint.modelRevision!==2)return {enabled:false,body:'#202124',exposure:0,strength:100};
 return paint;
}
export function paintFilter(type,paint={}){
 paint=paintFor(type,paint);if(!paint.enabled)return '';
 const color=/^#[a-f0-9]{6}$/i.test(paint.body??'')?paint.body:'#72777c';
 const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));
 const luminance=rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
 if(type==='flat')return `brightness(${Math.max(.25,Math.min(4,luminance/32*2**((paint.exposure??0)/60)))})`;
 return `brightness(${Math.max(.2,luminance/119)*2**((paint.exposure??0)/30)}) blur(.55px)`;
}
