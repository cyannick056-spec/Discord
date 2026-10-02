import {frameColor,type LightColor} from './light-color.ts';
export type EdgeColors={top:LightColor;left:LightColor;right:LightColor;bottom:LightColor};
export const uniformEdges=(color:LightColor):EdgeColors=>({top:{...color},left:{...color},right:{...color},bottom:{...color}});
export function edgeColors(pixels:Uint8ClampedArray,w:number,h:number):EdgeColors {
  // Broad edge regions retain the colors nearest each receiving surface.
  // This deliberately averages detail instead of projecting sharp video shapes.
  const side=(from:number,to:number)=>{
    const region=new Uint8ClampedArray((to-from)*h*4);
    for(let y=0;y<h;y++) region.set(pixels.subarray((y*w+from)*4,(y*w+to)*4),y*(to-from)*4);
    return frameColor(region,to-from,h);
  };
  return {top:frameColor(pixels,w,h,0,Math.max(1,Math.round(h*.3))),bottom:frameColor(pixels,w,h,Math.floor(h*.7),h),left:side(0,Math.max(1,Math.round(w*.3))),right:side(Math.floor(w*.7),w)};
}
