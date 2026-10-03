// Noise is generated only inside the inactive CRT glass, never on the room.
// The original 320×180 grain at 12 fps keeps the work bounded on Android.
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
   const pixels=this.frame.data,band=Math.floor((performance.now()/31)%this.canvas.height);
   for(let i=0;i<pixels.length;i+=4){this.seed^=this.seed<<13;this.seed^=this.seed>>>17;this.seed^=this.seed<<5;const y=Math.floor(i/4/this.canvas.width),v=Math.min(255,(this.seed&255)+(Math.abs(y-band)<3?35:0));pixels[i]=pixels[i+1]=v;pixels[i+2]=Math.min(255,v+3);pixels[i+3]=255;}
   this.context.putImageData(this.frame,0,0);
  }
  this.timer=setTimeout(this.draw,83);
 }
 stop(){this.setActive(false)}
}
