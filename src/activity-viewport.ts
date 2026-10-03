// Keep the activity's layout viewport stable while Android displays an IME.
export class ActivityViewport {
 width=innerWidth;
 height=innerHeight;
 private keyboard=false;
 constructor(private stage:HTMLElement,private changed:()=>void){
  this.apply();
  const keyboard=(navigator as any).virtualKeyboard;if(keyboard)try{keyboard.overlaysContent=true}catch{}
  window.addEventListener('resize',this.resize);
  window.visualViewport?.addEventListener('resize',this.resize);
  document.addEventListener('focusin',()=>{if(this.editable())this.keyboard=true});
  document.addEventListener('focusout',()=>setTimeout(this.resize,350));
  window.visualViewport?.addEventListener('scroll',()=>{if(this.keyboard)window.scrollTo(0,0)});
 }
 private editable(){return !!document.activeElement?.matches('textarea,input:not([type=range]):not([type=file]),[contenteditable=true]')}
 private apply(){this.stage.style.width=`${this.width}px`;this.stage.style.height=`${this.height}px`;this.stage.style.setProperty('--control-gap',this.height>this.width?'160px':'96px');document.documentElement.style.setProperty('--activity-height',`${this.height}px`)}
 private resize=()=>{
  const w=innerWidth,h=innerHeight,rotated=Math.abs(w-this.width)>80;
  if(!rotated&&(this.keyboard||this.editable())&&h<this.height-80)return;
  if(h>=this.height-40||rotated)this.keyboard=this.editable();
  if(w===this.width&&h===this.height)return;
  this.width=w;this.height=h;this.apply();this.changed();
 }
}
