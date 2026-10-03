// Noise is generated only inside the inactive CRT glass, never on the room.
// A 96×72 buffer at 8 fps keeps the work bounded on Android.
export class TvStatic {
 private timer:ReturnType<typeof setTimeout>|undefined;
 private active=false;
 private seed=0x6a09e667;
 private context:CanvasRenderingContext2D|null;
 private frame:ImageData|null;
 constructor(private canvas:HTMLCanvasElement){
  canvas.width=96;canvas.height=72;
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
   const pixels=this.frame.data;
   for(let i=0;i<pixels.length;i+=4){this.seed^=this.seed<<13;this.seed^=this.seed>>>17;this.seed^=this.seed<<5;const v=32+(this.seed&159);pixels[i]=pixels[i+1]=pixels[i+2]=v;pixels[i+3]=255;}
   this.context.putImageData(this.frame,0,0);
  }
  this.timer=setTimeout(this.draw,125);
 }
 stop(){this.setActive(false)}
}
