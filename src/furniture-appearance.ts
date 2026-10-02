import { props } from '../room-catalog.mjs';
import type { Decoration } from './decorations';

export function isSolidFurniture(item: Pick<Decoration,'kind'|'category'|'asset'>) {
  return item.category === 'furniture' || item.kind === 'builtin' && props.some(p=>p.id===item.asset && p.category==='furniture');
}

// Keep transparent openings and soft antialiased edges. Only the sprite body
// becomes opaque; filling the image rectangle would block gaps between legs.
export function solidFurniturePixels(pixels: Uint8ClampedArray,width?:number,height?:number) {
  const original=width && height ? new Uint8ClampedArray(pixels) : undefined;
  for(let i=3;i<pixels.length;i+=4) {
    if(pixels[i]<128)continue;
    if(original && width && height) {
      const n=(i-3)/4,x=n%width,y=Math.floor(n/width);
      // Edge alpha expresses covered area, not unwanted body transparency.
      // Preserve it beside both the outer contour and internal cutouts.
      let edge=false;
      for(let dy=-1;dy<=1 && !edge;dy++)for(let dx=-1;dx<=1;dx++) {
        const px=x+dx,py=y+dy;
        if(px<0 || py<0 || px>=width || py>=height || original[(py*width+px)*4+3]<128){edge=true;break;}
      }
      if(edge)continue;
    }
    pixels[i]=255;
  }
}
