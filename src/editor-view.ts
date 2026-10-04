// Inspection zoom changes only the editor viewport, never a saved scene.
export class EditorView {
 zoom=1;x=0;y=0;
 private area:HTMLElement;private room:HTMLElement;private output:HTMLElement;
 constructor(area:HTMLElement,room:HTMLElement,output:HTMLElement){this.area=area;this.room=room;this.output=output}
 apply(){this.room.style.transform=`translate(${this.x}px,${this.y}px) scale(${this.zoom})`;this.output.textContent=`${Math.round(this.zoom*100)}%`}
 reset(){this.zoom=1;this.x=this.y=0;this.apply()}
 scale(factor:number,clientX?:number,clientY?:number){
  const old=this.zoom,next=Math.max(1,Math.min(8,old*factor)),rect=this.area.getBoundingClientRect();
  const ax=(clientX??rect.left+rect.width/2)-rect.left-rect.width/2,ay=(clientY??rect.top+rect.height/2)-rect.top-rect.height/2;
  this.x=ax-(ax-this.x)*next/old;this.y=ay-(ay-this.y)*next/old;this.zoom=next;
  if(next===1)this.x=this.y=0;this.apply();
 }
 pan(dx:number,dy:number){this.x+=dx;this.y+=dy;this.apply()}
}
