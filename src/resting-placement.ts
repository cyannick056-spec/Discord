import { supportPlane } from './support-surfaces';
import type { Placement, Manifest, PlacementKey } from './decorations';
import type { Presentation } from './presentation-model';
const silhouettes = new Map<string, number[]>();
function opaqueBounds(image: HTMLImageElement) {
  const saved = silhouettes.get(image.src); if (saved) return saved;
  const c = document.createElement('canvas'); c.width = c.height = 96;
  const ctx = c.getContext('2d', { willReadFrequently: true })!; ctx.drawImage(image,0,0,96,96);
  const data = ctx.getImageData(0,0,96,96).data; let left=96, right=0, top=96, bottom=0;
  for(let y=0;y<96;y++) for(let x=0;x<96;x++) if(data[(y*96+x)*4+3]>40) { left=Math.min(left,x);right=Math.max(right,x+1);top=Math.min(top,y);bottom=Math.max(bottom,y+1); }
  const bounds = left < right ? [left/96,top/96,right/96,bottom/96] : [0,0,1,1];
  silhouettes.set(image.src,bounds); if(silhouettes.size>100) silhouettes.delete(silhouettes.keys().next().value!); return bounds;
}
export async function restOnSurface(manifest: Manifest, key: PlacementKey, ids: string[], supportId: string, presentation: Presentation | undefined,
  basis: (p: Placement) => DOMRect, reposition: (box: HTMLDivElement,p: Placement) => void, authored = false) {
  const support = document.querySelector<HTMLDivElement>(`.decoration-box:not(.decor-depth-outline)[data-id="${CSS.escape(supportId)}"]`);
  if(!support || !support.dataset.support) return [];
  await support.querySelector('img')?.decode().catch(()=>{});
  const result: {id:string;x:number;y:number;width:number;rotation:number}[]=[];
  for (const [index,id] of ids.entries()) {
    const p=manifest.items.find(i=>i.id===id)?.placements[key]; if(!p || p.locked || id===supportId) continue;
    const box=document.querySelector<HTMLDivElement>(`.decoration-box:not(.decor-depth-outline)[data-id="${CSS.escape(id)}"]`), image=box?.querySelector('img'); if(!box || !image) continue;
    await image.decode().catch(()=>{}); if(!box.isConnected) continue;
    reposition(box,p);
    const plane=supportPlane({...presentation,supportId}); if(!plane?.quad) continue;
    const [a,b,c,d]=plane.quad, u=[.35,.72,.52][index%3],v=[.68,.42,.82][index%3];
    const target={x:(a[0]*(1-u)+b[0]*u)*(1-v)+(d[0]*(1-u)+c[0]*u)*v,y:(a[1]*(1-u)+b[1]*u)*(1-v)+(d[1]*(1-u)+c[1]*u)*v};
    const [l,t,r,bottom]=opaqueBounds(image), w=box.offsetWidth,h=box.offsetHeight,matrix=new DOMMatrix(getComputedStyle(box).transform);
    const corners=[[l,t],[r,t],[r,bottom],[l,bottom]].map(([x,y])=>new DOMPoint((x-.5)*w,(y-.5)*h).matrixTransform(matrix));
    const parent=box.parentElement!.getBoundingClientRect(), xs=corners.map(q=>q.x/q.w),ys=corners.map(q=>q.y/q.w);
    const foot={x:parent.x+parseFloat(box.style.left)+w/2+(Math.min(...xs)+Math.max(...xs))/2,y:parent.y+parseFloat(box.style.top)+h/2+Math.max(...ys)};
    if(authored) {
      const q=Math.max(0,Math.min(1,(foot.x-(a[0]+d[0])/2)/(((b[0]+c[0])-(a[0]+d[0]))/2)));
      target.x=foot.x;target.y=(a[1]*(1-q)+b[1]*q)*.4+(d[1]*(1-q)+c[1]*q)*.6;
    }
    const b0=basis(p);p.x=Math.max(-30,Math.min(130,p.x+(target.x-foot.x)/b0.width*100));p.y=Math.max(-35,Math.min(145,p.y+(target.y-foot.y)/b0.height*100));
    reposition(box,p); result.push({id,x:p.x,y:p.y,width:p.width,rotation:p.rotation});
  }
  return result;
}
