// Noise is generated only inside the inactive CRT glass, never on the room.
// The original 320×180 grain at 12 fps keeps the work bounded on Android.
// Two softly feathered passes: the narrower pass is only slightly faster.
const bands=(now:number,height:number)=>[
 {center:(now/38)%(height+32)-16,halfWidth:16},
 {center:(now/30)%(height+16)-8,halfWidth:8},
];
const feather=(distance:number,width:number)=>{const t=Math.max(0,1-Math.abs(distance)/width);return t*t*(3-2*t)};
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
   const pixels=this.frame.data,passes=bands(performance.now(),this.canvas.height);
   for(let i=0;i<pixels.length;i+=4){this.seed^=this.seed<<13;this.seed^=this.seed>>>17;this.seed^=this.seed<<5;const y=Math.floor(i/4/this.canvas.width);let shift=0;for(const {center,halfWidth} of passes){const distance=y-center;shift+=10*feather(distance+halfWidth*.4,halfWidth)-9*feather(distance-halfWidth*.4,halfWidth)}const v=Math.max(0,Math.min(255,40+(this.seed&255)*.8+shift));pixels[i]=pixels[i+1]=pixels[i+2]=v;pixels[i+3]=255;}
   this.context.putImageData(this.frame,0,0);
  }
  this.timer=setTimeout(this.draw,83);
 }
 stop(){this.setActive(false)}
}

// Low-opacity, feathered grain sweeps share the idle signal's slow cadence.
export class SignalSweeps {
 private timer:ReturnType<typeof setTimeout>|undefined;
 private active=false;
 private seed=0x6a09e667;
 private context:CanvasRenderingContext2D|null;
 private frame:ImageData|null;
 constructor(private canvas:HTMLCanvasElement){canvas.width=320;canvas.height=180;this.context=canvas.getContext('2d');this.frame=this.context?.createImageData(320,180)??null}
 setActive(value:boolean){if(value===this.active)return;this.active=value;this.canvas.hidden=!value;if(this.timer)clearTimeout(this.timer);this.timer=undefined;if(value)this.draw()}
 private draw=()=>{
  if(!this.active)return;
  if(!document.hidden&&this.context&&this.frame){
   const data=this.frame.data,{width,height}=this.canvas;data.fill(0);
   for(const {center,halfWidth} of bands(performance.now(),height)){
    for(let y=Math.max(0,Math.floor(center-halfWidth*1.4));y<Math.min(height,Math.ceil(center+halfWidth*1.4));y++){
     const distance=y-center,light=distance<0,strength=feather(distance+(light?1:-1)*halfWidth*.4,halfWidth);if(strength<=0)continue;
     for(let x=0;x<width;x++){this.seed^=this.seed<<13;this.seed^=this.seed>>>17;this.seed^=this.seed<<5;const i=(y*width+x)*4,grain=(this.seed&255)/255,alpha=Math.round((light?14:19)*strength*(.8+grain*.3));if(alpha<=data[i+3])continue;data[i]=light?235:0;data[i+1]=light?235:0;data[i+2]=light?235:0;data[i+3]=alpha}
    }
   }
   this.context.putImageData(this.frame,0,0);
  }
  this.timer=setTimeout(this.draw,42);
 }
 stop(){this.setActive(false)}
}
