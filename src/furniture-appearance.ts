import { props } from '../room-catalog.mjs';
import type { Decoration } from './decorations';

export function isSolidFurniture(item: Pick<Decoration,'kind'|'category'|'asset'>) {
  return item.category === 'furniture' || item.kind === 'builtin' && props.some(p=>p.id===item.asset && p.category==='furniture');
}

// Keep transparent openings and soft antialiased edges. Only the sprite body
// becomes opaque; filling the image rectangle would block gaps between legs.
export function solidFurniturePixels(pixels: Uint8ClampedArray) {
  for(let i=3;i<pixels.length;i+=4) if(pixels[i]>=128) pixels[i]=255;
}
