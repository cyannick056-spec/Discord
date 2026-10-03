// Original CRT grain and two signal sweep profiles from f0e10ec.
// Lifecycle guards stop drawing when the glass is inactive or hidden.
export class TvStatic {
 private timer:ReturnType<typeof setTimeout>|undefined;
 private active=false;
 private seed=0x6a09e667;
 private context:CanvasRenderingContext2D|null;
 private frame:ImageData|null;
 constructor(private canvas:HTMLCanvasElement){
  canvas.width=320;canvas.height=180;
  this.context=canvas.getContext('2d',{alpha:false});
  this.frame=this.context?.createImageData(canvas.width,canvas.height)??null;
 }
 setActive(value:boolean){
  if(this.active===value)return;
  this.active=value;this.canvas.hidden=!value;
  if(this.timer)clearTimeout(this.timer);this.timer=undefined;
  if(value)this.draw();
 }
 private draw=()=>{
  if(!this.active)return;
  if(!document.hidden&&this.context&&this.frame){
   const pixels=this.frame.data,width=this.canvas.width,band=Math.floor((performance.now()/31)%this.canvas.height);
   for(let i=0;i<pixels.length;i+=4){
    this.seed^=this.seed<<13;this.seed^=this.seed>>>17;this.seed^=this.seed<<5;
    const value=this.seed&255,y=Math.floor(i/4/width),grain=Math.min(255,value+(Math.abs(y-band)<3?35:0));
    pixels[i]=grain;pixels[i+1]=grain;pixels[i+2]=Math.min(255,grain+3);pixels[i+3]=255;
   }
   this.context.putImageData(this.frame,0,0);
  }
  this.timer=setTimeout(this.draw,42);
 }
 stop(){this.setActive(false)}
}

// Original independent broad and narrow moving grain bands.
export class SignalSweeps {
 private timer:ReturnType<typeof setTimeout>|undefined;
 private active=false;
 private seed=0x6a09e667;
 private context:CanvasRenderingContext2D|null;
 private frame:ImageData|null;
 constructor(private canvas:HTMLCanvasElement){canvas.width=320;canvas.height=180;this.context=canvas.getContext('2d');this.frame=this.context?.createImageData(320,180)??null}
 setActive(value:boolean){if(value===this.active)return;this.active=value;this.canvas.hidden=!value;if(this.timer)clearTimeout(this.timer);this.timer=undefined;if(value)this.draw()}
 private nextNoise(){this.seed^=this.seed<<13;this.seed^=this.seed>>>17;this.seed^=this.seed<<5;return this.seed&255}
 private draw=()=>{
  if(!this.active)return;
  if(!document.hidden&&this.context&&this.frame){
   const now=performance.now();
  const { width, height } = this.canvas;
  const data = this.frame.data;
  data.fill(0);
  // The no-signal canvas brightens random pixels in a travelling band. Use
  // the same moving grain on live video, with two independent band profiles.
  for (const { center, halfWidth } of [
    { center: (now / 31) % (height + 24) - 12, halfWidth: 12 },
    { center: (now / 17) % (height + 10) - 5, halfWidth: 5 },
  ]) {
    for (let y = Math.max(0, Math.floor(center - halfWidth)); y < Math.min(height, Math.ceil(center + halfWidth)); y++) {
      const distance = y - center;
      const strength = 1 - Math.abs(distance) / halfWidth;
      if (strength <= 0) continue;
      const light = distance < 0;
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const grain = this.nextNoise() / 255;
        const alpha = Math.round((light ? 35 : 55) * strength * (.55 + grain * .7));
        if (alpha <= data[i + 3]) continue;
        data[i] = light ? 245 : 0;
        data[i + 1] = light ? 252 : 0;
        data[i + 2] = light ? 255 : 0;
        data[i + 3] = alpha;
      }
    }
  }
   this.context.putImageData(this.frame,0,0);
  }
  this.timer=setTimeout(this.draw,42);
 }
 stop(){this.setActive(false)}
}
