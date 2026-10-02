import {isSolidFurniture,solidFurniturePixels} from './furniture-appearance.ts';
import type {Decoration,Placement} from './decorations';

export function isSolidObject(item:Decoration,p:Placement) {
  return isSolidFurniture(item) || (p.solid ?? (item.category==='figurine' || !item.kind));
}
export function finishPixels(pixels:Uint8ClampedArray,solid:boolean,color='#ffffff',strength=0) {
  if(solid) solidFurniturePixels(pixels);
  const rgb=color.match(/[a-f\d]{2}/gi)?.map(v=>parseInt(v,16));
  if(!rgb || !strength) return;
  const amount=Math.max(0,Math.min(100,strength))/100;
  for(let i=0;i<pixels.length;i+=4) for(let c=0;c<3;c++) pixels[i+c]*=1-amount+amount*rgb[c]/255;
}
const renders=new Map<string,HTMLCanvasElement>();
export async function applyObjectFinish(box:HTMLElement,image:HTMLImageElement,item:Decoration,p:Placement) {
  const solid=isSolidObject(item,p);
  if((!solid && !p.tintStrength) || /\.gif(?:\?|$)/i.test(image.src)) return;
  try {
    await image.decode();if(!box.isConnected) return;
    const material=box.querySelector<HTMLCanvasElement>('.decoration-material');
    const key=JSON.stringify([image.src,solid,p.tint,p.tintStrength,material?p.material:undefined]);
    let result=renders.get(key);
    if(!result) {
      const source=material ?? image,sw=material?.width ?? image.naturalWidth,sh=material?.height ?? image.naturalHeight;
      const ratio=Math.min(1,1000/sw,1200/sh);result=document.createElement('canvas');result.width=Math.max(1,Math.round(sw*ratio));result.height=Math.max(1,Math.round(sh*ratio));
      const ctx=result.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(source,0,0,result.width,result.height);
      const pixels=ctx.getImageData(0,0,result.width,result.height);finishPixels(pixels.data,solid,p.tint,p.tintStrength);ctx.putImageData(pixels,0,0);
      renders.set(key,result);if(renders.size>32) renders.delete(renders.keys().next().value!);
    }
    if(!box.isConnected) return;
    const canvas=material ?? document.createElement('canvas');canvas.classList.add('decoration-finish');canvas.width=result.width;canvas.height=result.height;
    canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none';canvas.style.filter=image.style.filter;canvas.style.clipPath=image.style.clipPath;
    canvas.getContext('2d')!.drawImage(result,0,0);if(!material) box.append(canvas);image.style.opacity='0';
  } catch { /* Preserve the original sprite if a readback is unavailable. */ }
}
