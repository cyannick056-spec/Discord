import {defaultLightResponse,lightResponse} from './light-response';
import {resizeSprite,sampleSpriteAlpha} from './sprite-rendering';
// Background illumination belongs to the wall/floor behind solid furniture.
// Reuse the rendered sprite alpha, including its crop and real leg openings.
const masks=new WeakMap<CanvasRenderingContext2D,{key:string;sprites:(HTMLCanvasElement|HTMLImageElement)[]}>();
const photoMasks=new WeakMap<HTMLImageElement,HTMLCanvasElement>();
export function paintFurnitureOcclusion(ctx: CanvasRenderingContext2D, scene: DOMRect, scale: number, protection:boolean|'foreground'=false) {
  const selector=protection==='foreground' ? '.decoration-box:not([data-furniture=true]):not(.decor-depth-outline):not([data-prop=rug])' : protection ? '.decoration-box:not(.decor-depth-outline):not([data-prop=rug])' : '.decoration-box[data-furniture=true]:not(.decor-depth-outline):not([data-prop=rug])';
  const boxes=[...document.querySelectorAll<HTMLElement>(selector)];
  const spriteFor=(b:HTMLElement)=>b.querySelector<HTMLCanvasElement>('.decoration-material,.decoration-finish') ?? (protection?b.querySelector<HTMLImageElement>('img.decoration'):null);
  const sprites=boxes.map(spriteFor).filter((s):s is HTMLCanvasElement|HTMLImageElement=>Boolean(s));
  const cached=masks.get(ctx);
  const face=document.querySelector<HTMLElement>('.tv-face'),art=face?.getBoundingClientRect(),tvStyle=face?getComputedStyle(face):undefined;
  const tvRects=art && tvStyle?['tv-body','tv-feet'].map(prefix=>{const n=(k:string)=>parseFloat(tvStyle.getPropertyValue(`--${prefix}-${k}`))/100;return {x:(art.x-scene.x+art.width*n('x'))*scale,y:(art.y-scene.y+art.height*n('y'))*scale,width:art.width*n('w')*scale,height:art.height*n('h')*scale};}):[];
  const key=JSON.stringify([protection,scene.x,scene.y,scale,ctx.canvas.width,ctx.canvas.height,tvRects,boxes.map(b=>[b.style.cssText,b.dataset.lightResponse,b.offsetWidth,b.offsetHeight,b.parentElement!.getBoundingClientRect().toJSON(),b.querySelector<HTMLImageElement>('img')?.complete,b.querySelector('img')?.style.clipPath])]);
  if(cached?.key===key && sprites.length===cached.sprites.length && sprites.every((s,i)=>s===cached!.sprites[i])) return;
  ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);
  for(const box of boxes) {
    let sprite=spriteFor(box);
    if(sprite instanceof HTMLImageElement) {
      if(!sprite.complete || !sprite.naturalWidth) continue;
      let canvas=photoMasks.get(sprite);if(!canvas){const ratio=Math.min(1,400/sprite.naturalWidth,600/sprite.naturalHeight);canvas=resizeSprite(sprite,Math.max(1,Math.round(sprite.naturalWidth*ratio)),Math.max(1,Math.round(sprite.naturalHeight*ratio)));photoMasks.set(sprite,canvas);}sprite=canvas;
    }
    if(!sprite || !box.offsetWidth || !box.offsetHeight) continue;
    const style=getComputedStyle(box), parent=box.parentElement!.getBoundingClientRect();
    const matrix=new DOMMatrix(style.transform), w=box.offsetWidth, h=box.offsetHeight;
    const ox=(parent.x+parseFloat(box.style.left)+w/2-scene.x)*scale;
    const oy=(parent.y+parseFloat(box.style.top)+h/2-scene.y)*scale;
    ctx.save();ctx.globalAlpha=protection===true?(1-lightResponse(Number(box.dataset.lightResponse ?? defaultLightResponse)))*Number(style.opacity):Number(style.opacity);
    if(box.parentElement!.classList.contains('decorations-behind-tv')) {
      ctx.beginPath();ctx.rect(0,0,ctx.canvas.width,ctx.canvas.height);
      for(const r of tvRects) if(r.width>0 && r.height>0 && Object.values(r).every(Number.isFinite)) ctx.roundRect(r.x,r.y,r.width,r.height,Math.min(r.width,r.height)*.012);
      ctx.clip('evenodd');
    }
    ctx.translate(ox,oy);ctx.scale(scale,scale);
    // Affine transforms are exact. Perspective uses an inverted texture projection,
    // preserving the sprite alpha rather than blocking its bounding rectangle.
    if(matrix.m14===0 && matrix.m24===0) {
      ctx.transform(matrix.a/matrix.m44,matrix.b/matrix.m44,matrix.c/matrix.m44,matrix.d/matrix.m44,matrix.e/matrix.m44,matrix.f/matrix.m44);
      const crop=box.querySelector<HTMLImageElement>('img')?.style.clipPath.match(/inset\(([^)]+)\)/)?.[1].match(/[\d.]+/g)?.map(Number);
      if(crop?.length===4) {ctx.beginPath();ctx.rect(-w/2+w*crop[3]/100,-h/2+h*crop[0]/100,w*(1-(crop[1]+crop[3])/100),h*(1-(crop[0]+crop[2])/100));ctx.clip();}
      ctx.drawImage(sprite,-w/2,-h/2,w,h);
    } else {
      const crop=box.querySelector<HTMLImageElement>('img')?.style.clipPath.match(/inset\(([^)]+)\)/)?.[1].match(/[\d.]+/g)?.map(Number) ?? [0,0,0,0];
      const point=(x:number,y:number)=>{const p=new DOMPoint(x,y).matrixTransform(matrix);return [ox+p.x/p.w*scale,oy+p.y/p.w*scale];};
      const corners=[point(-w/2,-h/2),point(w/2,-h/2),point(w/2,h/2),point(-w/2,h/2)];
      const left=Math.max(0,Math.floor(Math.min(...corners.map(p=>p[0])))),top=Math.max(0,Math.floor(Math.min(...corners.map(p=>p[1]))));
      const right=Math.min(ctx.canvas.width,Math.ceil(Math.max(...corners.map(p=>p[0])))),bottom=Math.min(ctx.canvas.height,Math.ceil(Math.max(...corners.map(p=>p[1]))));
      const a=matrix.m11,b=matrix.m12,c=matrix.m21,d=matrix.m22,e=matrix.m41,f=matrix.m42,g=matrix.m14,hp=matrix.m24,i=matrix.m44;
      // Invert the homography on the sprite plane. Rasterize only on changes;
      // triangle meshes leave antialiased seams inside an otherwise solid face.
      const inverse=[d*i-f*hp,e*hp-c*i,c*f-e*d,f*g-b*i,a*i-e*g,e*b-a*f,b*hp-d*g,c*g-a*hp,a*d-c*b];
      if(right>left && bottom>top && [...inverse,left,top,right,bottom].every(Number.isFinite)) {
        const bitmap=document.createElement('canvas');bitmap.width=right-left;bitmap.height=bottom-top;
        const pixels=new ImageData(bitmap.width,bitmap.height),source=sprite.getContext('2d')!.getImageData(0,0,sprite.width,sprite.height).data;
        for(let y=0;y<bitmap.height;y++) for(let x=0;x<bitmap.width;x++) {
          const px=(left+x+.5-ox)/scale,py=(top+y+.5-oy)/scale,den=inverse[6]*px+inverse[7]*py+inverse[8];
          const u=((inverse[0]*px+inverse[1]*py+inverse[2])/den+w/2)/w,v=((inverse[3]*px+inverse[4]*py+inverse[5])/den+h/2)/h;
          if(u<crop[3]/100 || u>=1-crop[1]/100 || v<crop[0]/100 || v>=1-crop[2]/100) continue;
          pixels.data[(y*bitmap.width+x)*4+3]=sampleSpriteAlpha(source,sprite.width,sprite.height,u*sprite.width-.5,v*sprite.height-.5);
        }
        bitmap.getContext('2d')!.putImageData(pixels,0,0);ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(bitmap,left,top);
      }
    }
    ctx.restore();
  }
  masks.set(ctx,{key,sprites});
}
