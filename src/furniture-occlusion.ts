// Background illumination belongs to the wall/floor behind solid furniture.
// Reuse the rendered sprite alpha, including its crop and real leg openings.
let cached: {context:CanvasRenderingContext2D;key:string;sprites:HTMLCanvasElement[]} | undefined;
export function paintFurnitureOcclusion(ctx: CanvasRenderingContext2D, scene: DOMRect, scale: number) {
  const boxes=[...document.querySelectorAll<HTMLElement>('.decoration-box[data-furniture=true]:not(.decor-depth-outline):not([data-prop=rug])')];
  const sprites=boxes.map(b=>b.querySelector<HTMLCanvasElement>('.decoration-material')).filter((s):s is HTMLCanvasElement=>Boolean(s));
  const key=JSON.stringify([scene.x,scene.y,scale,ctx.canvas.width,ctx.canvas.height,boxes.map(b=>[b.style.cssText,b.offsetWidth,b.offsetHeight,b.parentElement!.getBoundingClientRect().toJSON(),b.querySelector('img')?.style.clipPath])]);
  if(cached?.context===ctx && cached.key===key && sprites.length===cached.sprites.length && sprites.every((s,i)=>s===cached!.sprites[i])) return;
  ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);
  for(const box of boxes) {
    const sprite=box.querySelector<HTMLCanvasElement>('.decoration-material');
    if(!sprite || !box.offsetWidth || !box.offsetHeight) continue;
    const style=getComputedStyle(box), parent=box.parentElement!.getBoundingClientRect();
    const matrix=new DOMMatrix(style.transform), w=box.offsetWidth, h=box.offsetHeight;
    const ox=(parent.x+parseFloat(box.style.left)+w/2-scene.x)*scale;
    const oy=(parent.y+parseFloat(box.style.top)+h/2-scene.y)*scale;
    ctx.save();ctx.translate(ox,oy);ctx.scale(scale,scale);
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
          const sx=Math.min(sprite.width-1,Math.floor(u*sprite.width)),sy=Math.min(sprite.height-1,Math.floor(v*sprite.height));
          if(sx>=0 && sy>=0) pixels.data[(y*bitmap.width+x)*4+3]=source[(sy*sprite.width+sx)*4+3];
        }
        bitmap.getContext('2d')!.putImageData(pixels,0,0);ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(bitmap,left,top);
      }
    }
    ctx.restore();
  }
  cached={context:ctx,key,sprites};
}
