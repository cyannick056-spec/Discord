import {isSolidFurniture,solidFurniturePixels} from './furniture-appearance.ts';
import type {Decoration,Placement} from './decorations';
import {mountSprite,resizeSprite,spriteSource} from './sprite-rendering.ts';

export function isSolidObject(item:Decoration,p:Placement) {
  return isSolidFurniture(item) || (p.solid ?? (item.category==='figurine' || !item.kind));
}
export function finishPixels(pixels:Uint8ClampedArray,solid:boolean,color='#ffffff',strength=0,width?:number,height?:number) {
  if(solid) solidFurniturePixels(pixels,width,height);
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
      const source=material ? spriteSource(material) : image,sw=material ? (source as HTMLCanvasElement).width : image.naturalWidth,sh=material ? (source as HTMLCanvasElement).height : image.naturalHeight;
      const ratio=Math.min(1,1000/sw,1200/sh);result=resizeSprite(source,Math.max(1,Math.round(sw*ratio)),Math.max(1,Math.round(sh*ratio)));
      const ctx=result.getContext('2d',{willReadFrequently:true})!;
      const pixels=ctx.getImageData(0,0,result.width,result.height);finishPixels(pixels.data,solid,p.tint,p.tintStrength,result.width,result.height);ctx.putImageData(pixels,0,0);
      renders.set(key,result);if(renders.size>32) renders.delete(renders.keys().next().value!);
    }
    if(!box.isConnected) return;
    mountSprite(box,image,result,'decoration-finish',material ?? undefined);
  } catch { /* Preserve the original sprite if a readback is unavailable. */ }
}
