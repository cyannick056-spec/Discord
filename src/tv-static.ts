// Noise is generated only inside the inactive CRT glass, never on the room.
// The original 320×180 grain at 12 fps keeps the work bounded on Android.
// Original band profiles: a broad slow pass and a narrower, faster pass.
const bands=(now:number,height:number)=>[
 {center:(now/31)%(height+24)-12,halfWidth:12},
 {center:(now/17)%(height+10)-5,halfWidth:5},
];
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
   for(let i=0;i<pixels.length;i+=4){this.seed^=this.seed<<13;this.seed^=this.seed>>>17;this.seed^=this.seed<<5;const y=Math.floor(i/4/this.canvas.width);let shift=0;for(const {center,halfWidth} of passes){const distance=y-center,strength=Math.max(0,1-Math.abs(distance)/halfWidth);shift+=(distance<0?24:-20)*strength}const v=Math.max(0,Math.min(255,48+(this.seed&255)*.8+shift));pixels[i]=pixels[i+1]=pixels[i+2]=v;pixels[i+3]=255;}
   this.context.putImageData(this.frame,0,0);
  }
  this.timer=setTimeout(this.draw,83);
 }
 stop(){this.setActive(false)}
}

// Transparent grain sweeps retain the original sizes and speeds on live video.
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
    for(let y=Math.max(0,Math.floor(center-halfWidth));y<Math.min(height,Math.ceil(center+halfWidth));y++){
     const distance=y-center,strength=1-Math.abs(distance)/halfWidth;if(strength<=0)continue;const light=distance<0;
     for(let x=0;x<width;x++){this.seed^=this.seed<<13;this.seed^=this.seed>>>17;this.seed^=this.seed<<5;const i=(y*width+x)*4,grain=(this.seed&255)/255,alpha=Math.round((light?35:55)*strength*(.55+grain*.7));if(alpha<=data[i+3])continue;data[i]=light?245:0;data[i+1]=light?252:0;data[i+2]=light?255:0;data[i+3]=alpha}
    }
   }
   this.context.putImageData(this.frame,0,0);
  }
  this.timer=setTimeout(this.draw,42);
 }
 stop(){this.setActive(false)}
}
