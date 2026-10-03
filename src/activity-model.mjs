export const views=['landscape','portrait','window'];
export const slotColors=['red','blue','green','yellow','black'];
export const compact=(w,h)=>h<=360||(w<=520&&h<=400)||(w<=360&&h<=520);
export const viewFor=(w,h)=>compact(w,h)?'window':h>w?'portrait':'landscape';
export const keyFor=(view,aspect='16:9',scene='home')=>scene==='arcade'?`arcade-${view}`:`home-${view}-${aspect==='4:3'?'4x3':'16x9'}`;
export function placementFor(item,key){return item.placements?.[key]??item.placements?.[key.replace(/-(16x9|4x3)$/,'')];}
export function settingsFor(manifest,key){
 const old=manifest.presentations?.[key];
 return old?.style==='minimal'?old:{environment:'cozy-night',style:'minimal',tvModel:'original',camera:{zoom:1,x:0,y:0},video:{fit:'contain',auto:false},screen:{rounded:true},reflection:{enabled:false}};
}
export function prepareSave(draft){
 const copy=structuredClone(draft);
 copy.presentations??={};
 for(const view of views)for(const aspect of ['16:9','4:3']){
 const key=keyFor(view,aspect);copy.presentations[key]=structuredClone(settingsFor(copy,key));
 }
 // Old startup lighting is retired; image assets, placements and collections
 // retain their exact identity. Nothing removes a personal item.
 delete copy.startup;
 return copy;
}
export function updatePlacement(manifest,id,key,patch){
 const item=manifest.items.find(i=>i.id===id);if(!item)return;
 item.placements??={};item.placements[key]={...structuredClone(placementFor(item,key)??{x:50,y:65,width:15,rotation:0,opacity:1,z:10,hidden:false,anchor:'scene'}),...patch};
}
export function figureRect(p,room,screen,camera={}){
 const z=camera.zoom??1;
 const basis=p.anchor==='frame'?screen:{x:room.x+room.width*(1-z)/2+(camera.x??0)*room.width/100,y:room.y+room.height*(1-z)/2+(camera.y??0)*room.height/100,width:room.width*z,height:room.height*z};
 return {x:basis.x+basis.width*p.x/100,y:basis.y+basis.height*p.y/100,width:basis.width*p.width/100,basis};
}
