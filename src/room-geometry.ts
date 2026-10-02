import { getPresentation } from './scene-presentation';
import { rooms } from '../room-catalog.mjs';
import {objectLightGain,defaultLightResponse} from './light-response';
// Full rendered photographic rectangle, including object-fit cover crops and
// camera transforms. Floor effects must begin on the wood, never on the wall.
export function roomPhotoRect() {
  const image = document.querySelector<HTMLImageElement>('#roomBackdrop img')!;
  const b = image.getBoundingClientRect();
  const scale = image.naturalWidth ? Math.max(b.width / image.naturalWidth, b.height / image.naturalHeight) : 1;
  const width = image.naturalWidth ? image.naturalWidth * scale : b.width, height = image.naturalHeight ? image.naturalHeight * scale : b.height;
  return { x: b.x + (b.width - width) / 2, y: b.y + (b.height - height) / 2, width, height };
}
export function photoFloor() {
  const b = roomPhotoRect(), line = rooms.find(r => r.id === getPresentation()?.environment)?.floorLine ?? .60;
  return { x: b.x, y: b.y + b.height * line, width: b.width, height: b.height * (1-line), material: 'wood' as const, roughness: 90 };
}
const lightMaps = new Map<string, Promise<ImageData>>();
// Match movable photographs to the light actually present at their location
// in the room photograph. This never darkens or recolors the background.
export async function applyPhotoLight(box: HTMLElement, sprite: HTMLImageElement) {
  if (!getPresentation()?.environment) return;
  const photo=document.querySelector<HTMLImageElement>('#roomBackdrop img')!, source=photo.src, baseFilter=sprite.style.filter;
  let pending=lightMaps.get(source);
  if(!pending) { const image=new Image(); image.src=source;
    pending=image.decode().then(()=>{const c=document.createElement('canvas');c.width=128;c.height=128;const ctx=c.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(image,0,0,128,128);return ctx.getImageData(0,0,128,128);});lightMaps.set(source,pending);
  }
  try {
    const map=await pending;if(!box.isConnected || photo.src!==source) return;
    const room=roomPhotoRect(), b=box.getBoundingClientRect();
    const x=Math.max(0,Math.min(127,Math.round((b.x+b.width*.5-room.x)/room.width*127))), y=Math.max(0,Math.min(127,Math.round((b.y+b.height*.55-room.y)/room.height*127)));
    const i=(y*128+x)*4, luminance=map.data[i]*.2126+map.data[i+1]*.7152+map.data[i+2]*.0722;
    const gain=objectLightGain(Math.min(1.05,Math.max(.22,Math.sqrt(luminance/145))),Number(box.dataset.lightResponse ?? defaultLightResponse));
    sprite.style.filter=baseFilter+` brightness(${gain})`;box.dataset.lightGain=String(gain);
    box.querySelectorAll<HTMLCanvasElement>('.decoration-material').forEach(c=>c.style.filter=sprite.style.filter);
  } catch { /* Leave the original object if a light map is unavailable. */ }
}
