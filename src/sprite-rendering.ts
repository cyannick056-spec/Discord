type Sprite=HTMLCanvasElement|HTMLImageElement;
const levels=new WeakMap<Sprite,HTMLCanvasElement[]>();
const sources=new WeakMap<HTMLCanvasElement,HTMLCanvasElement>();
const mounted=new WeakMap<HTMLElement,{canvas:HTMLCanvasElement;source:HTMLCanvasElement}>();
const size=(sprite:Sprite)=>sprite instanceof HTMLImageElement ? [sprite.naturalWidth,sprite.naturalHeight] : [sprite.width,sprite.height];
export function sampleSpriteAlpha(pixels:Uint8ClampedArray,w:number,h:number,x:number,y:number) {
  const left=Math.floor(x),top=Math.floor(y),fx=x-left,fy=y-top;
  const at=(px:number,py:number)=>px>=0 && py>=0 && px<w && py<h ? pixels[(py*w+px)*4+3] : 0;
  return (at(left,top)*(1-fx)+at(left+1,top)*fx)*(1-fy)+(at(left,top+1)*(1-fx)+at(left+1,top+1)*fx)*fy;
}
function draw(source:Sprite,width:number,height:number) {
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d')!;ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  ctx.drawImage(source,0,0,width,height);return canvas;
}
function reduce(source:Sprite,width:number,height:number) {
  const [sw,sh]=size(source),input=source instanceof HTMLCanvasElement ? source : draw(source,sw,sh);
  const pixels=input.getContext('2d')!.getImageData(0,0,sw,sh).data;
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d')!,output=ctx.createImageData(width,height);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
    const left=x*sw/width,right=(x+1)*sw/width,top=y*sh/height,bottom=(y+1)*sh/height;
    let alpha=0,r=0,g=0,b=0;
    for(let py=Math.floor(top);py<Math.ceil(bottom);py++)for(let px=Math.floor(left);px<Math.ceil(right);px++) {
      const weight=(Math.min(right,px+1)-Math.max(left,px))*(Math.min(bottom,py+1)-Math.max(top,py));
      const i=(py*sw+px)*4,a=pixels[i+3]*weight;
      alpha+=a;r+=pixels[i]*a;g+=pixels[i+1]*a;b+=pixels[i+2]*a;
    }
    const i=(y*width+x)*4;
    if(alpha){output.data[i]=r/alpha;output.data[i+1]=g/alpha;output.data[i+2]=b/alpha;}
    output.data[i+3]=alpha/((right-left)*(bottom-top));
  }
  ctx.putImageData(output,0,0);return canvas;
}
// Repeated small reductions average fine texture and alpha coverage instead of
// skipping pixels when a large sprite is displayed as a tiny figure.
export function resizeSprite(source:Sprite,width:number,height:number) {
  let current:Sprite=source;const chain=levels.get(source) ?? [];levels.set(source,chain);
  let [sw,sh]=size(current),index=0;
  while(sw>width*2 && sh>height*2) {
    current=chain[index] ??= reduce(current,Math.max(width,Math.ceil(sw/2)),Math.max(height,Math.ceil(sh/2)));
    [sw,sh]=size(current);index++;
  }
  return draw(current,width,height);
}
export function spriteSource(canvas:HTMLCanvasElement) {return sources.get(canvas) ?? canvas;}
export function refreshSpriteResolution(box:HTMLElement) {
  const render=mounted.get(box);if(!render || !box.isConnected)return;
  const {canvas,source}=render,b=box.getBoundingClientRect();
  // Two samples per device pixel also cover rotation and fractional placement.
  const scale=Math.min(1,Math.max(b.width/source.width,b.height/source.height)*Math.max(1,devicePixelRatio)*2);
  const width=Math.max(1,Math.round(source.width*scale)),height=Math.max(1,Math.round(source.height*scale));
  if(canvas.width===width && canvas.height===height && canvas.dataset.spriteReady==='true')return;
  const resized=resizeSprite(source,width,height);canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d')!;ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(resized,0,0);
  canvas.dataset.spriteReady='true';
}
export function mountSprite(box:HTMLElement,image:HTMLImageElement,source:HTMLCanvasElement,className:string,existing?:HTMLCanvasElement) {
  const canvas=existing ?? document.createElement('canvas');canvas.classList.add(className);
  canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;image-rendering:auto';
  canvas.style.filter=image.style.filter;canvas.style.clipPath=image.style.clipPath;
  sources.set(canvas,source);mounted.set(box,{canvas,source});delete canvas.dataset.spriteReady;
  if(!existing)box.append(canvas);refreshSpriteResolution(box);image.style.opacity='0';
  return canvas;
}
