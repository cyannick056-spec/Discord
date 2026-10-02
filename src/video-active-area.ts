export type ActiveArea = {x:number;y:number;width:number;height:number};
export const fullVideoArea = ():ActiveArea => ({x:0,y:0,width:1,height:1});
// Small local samples only. Require symmetric, nearly black borders and a
// substantial image in a common game aspect, rather than zooming into text.
export function detectActiveArea(pixels:Uint8ClampedArray,w:number,h:number,aspect=w/h):ActiveArea|null {
  const columns=new Uint16Array(w),rows=new Uint16Array(h);let lit=0;
  for(let y=0;y<h;y++) for(let x=0;x<w;x++) {const i=(y*w+x)*4;if(Math.max(pixels[i],pixels[i+1],pixels[i+2])>16){columns[x]++;rows[y]++;lit++;}}
  if(lit<w*h*.035) return null; // Black/fading frames keep the last stable crop.
  let left=0,right=w-1,top=0,bottom=h-1;
  while(left<right && columns[left]<=h*.02) left++;
  while(right>left && columns[right]<=h*.02) right--;
  while(top<bottom && rows[top]<=w*.02) top++;
  while(bottom>top && rows[bottom]<=w*.02) bottom--;
  const rw=right-left+1,rh=bottom-top+1;
  if(Math.abs(left-(w-1-right))>2 || Math.abs(top-(h-1-bottom))>2 || rw<w*.45 || rh<h*.45 || lit<rw*rh*.25) return fullVideoArea();
  if(left<2 && w-1-right<2) {left=0;right=w-1;}
  if(top<2 && h-1-bottom<2) {top=0;bottom=h-1;}
  const activeAspect=(right-left+1)/(bottom-top+1)*aspect*h/w;
  if(![1,8/7,4/3,3/2,16/10,16/9,21/9].some(r=>Math.abs(activeAspect/r-1)<.055)) return fullVideoArea();
  return {x:left/w,y:top/h,width:(right-left+1)/w,height:(bottom-top+1)/h};
}
export type AreaState = {area:ActiveArea;pending?:ActiveArea;count:number};
export function stabilizeActiveArea(state:AreaState,candidate:ActiveArea|null) {
  if(!candidate) {state.pending=undefined;state.count=0;return false;}
  const near=(a:ActiveArea,b:ActiveArea)=>Object.keys(a).every(k=>Math.abs(a[k as keyof ActiveArea]-b[k as keyof ActiveArea])<.018);
  if(near(state.area,candidate)) {state.pending=undefined;state.count=0;return false;}
  if(state.pending && near(state.pending,candidate)) state.count++;else {state.pending=candidate;state.count=1;}
  if(state.count<3) return false;
  state.area=candidate;state.pending=undefined;state.count=0;return true;
}
