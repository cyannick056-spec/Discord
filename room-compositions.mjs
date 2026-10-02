import { props, roomIds } from './room-catalog.mjs';
import { MAX_SCENE_ITEMS } from './material-catalog.mjs';

// Layouts use scene coordinates before camera transform. All pieces remain
// ordinary editor objects with independent placements in each saved view.
export const compositions = {
  'midnight-den': { model:'original', ambient:85, backlight:'#668cae', depth:42, lamp:'#ffc17e',
    pieces:[
      ['rug',[50,93,78,0],[50,89,110,0]],
      ['cabinet',[52,81,84,3],[50,76,114,3]],
      ['linen-lamp',[15,64,12,4],[10,66,17,14]],
      ['plant-small',[88,67,10,14],[93,69,13,14]],
      ['floating-shelf',[15,12,20,1],[14,35,28,1]],
      ['wall-clock',[85,12,10,1],[86,32,16,1]],
      ['games',[16,11,9,2],[15,33,13,2]],
      ['controller',[79,72,7,14],[79,71,12,14]],
      ['console',[24,73,12,14],[22,72,17,14]],
      ['game-cases-stack',[84,94,10,14,-4],[84,94,13,14,-3]],
      ['cartridge-gray',[12,74,4,14,-7],[12,73,6,14,-6]],
      ['game-disc',[71,94,7,14,8],[74,92,10,14,12]],
      ['open-game-case',[30,92,13,14,-12],[28,93,21,14,-9]],
      ['anime-poster',[12,34,12,1,-3],[24,46,16,1,-3]],
    ] },
  'walnut-den': { model:'charcoal', ambient:87, backlight:'#b69475', depth:38, lamp:'#ffc48a',
    pieces:[
      ['rug',[52,94,78,0],[50,90,110,0]],
      ['cabinet',[48,81,78,3],[48,77,112,3]],
      ['linen-floor-lamp',[88,60,26,2],[97,70,46,2]],
      ['side-table',[14,83,24,2],[10,78,29,2]],
      ['succulent',[14,71,8,14],[10,73,12,14]],
      ['floating-shelf',[86,12,18,1],[83,29,26,1]],
      ['games',[86,11,8,2],[84,28,12,2]],
      ['console-cube',[18,68,10,14],[17,70,13,14]],
      ['anime-figure',[82,13,5,2,2],[81,29,7,2,2]],
      ['anime-poster',[20,27,13,1,3],[22,43,17,1,3]],
      ['game-cases-stack',[81,73,10,14,-3],[78,72,15,14,-4]],
      ['game-disc',[69,74,5,14,7],[68,73,7,14,9]],
      ['controller',[68,95,8,14,-17],[69,94,12,14,-13]],
      ['open-game-case',[34,93,12,14,9],[33,93,19,14,11]],
    ] },
  'violet-den': { model:'original', ambient:89, backlight:'#b49ad1', depth:36, lamp:'#efb3a2',
    pieces:[
      ['rug',[50,93,84,0],[50,90,112,0]],
      ['cabinet-black',[51,81,82,3],[50,77,114,3]],
      ['mushroom-lamp',[17,65,12,14],[10,68,17,14]],
      ['side-table',[88,83,23,2],[92,81,29,2]],
      ['plant-small',[88,70,10,14],[92,74,14,14]],
      ['floating-shelf',[18,14,21,1],[16,32,28,1]],
      ['handheld-purple',[17,13,7,2],[15,31,10,2]],
      ['headphones',[84,65,9,14],[85,67,13,14]],
      ['anime-figure',[24,14,5,2,-2],[24,32,7,2,-2]],
      ['anime-poster',[77,28,13,1,-3],[75,44,16,1,-3]],
      ['console-cube',[24,72,10,14],[24,73,15,14]],
      ['cartridge-gray',[73,73,4,14,5],[72,72,6,14,6]],
      ['game-cases-stack',[77,94,10,14,11],[78,94,15,14,13]],
      ['game-disc',[66,94,6,14,-4],[63,94,9,14,-5]],
    ] },
};
export function applyRoomComposition(room,id,key) {
  const spec=compositions[id]; if(!spec || !key.startsWith('home-')) return false;
  const missing=spec.pieces.filter(([asset])=>!room.items.some(i=>i.roomKit===id && i.asset===asset));
  if(room.items.filter(i=>i.kind!=='viewer-slot').length+missing.length>MAX_SCENE_ITEMS) return false;
  const portrait=key.includes('portrait');
  for(const item of room.items) {
    if((roomIds.has(item.roomKit) || item.kind==='light' && item.name==='Luz lavanda detrás de la TV') && item.placements[key]) item.placements[key].hidden=true;
  }
  for(const [asset,wide,tall] of spec.pieces) {
    const info=props.find(p=>p.id===asset);
    let item=room.items.find(i=>i.roomKit===id && i.asset===asset);
    if(!item) {item={id:crypto.randomUUID(),kind:'builtin',asset,name:info.name,category:info.category,roomKit:id,placements:{}};room.items.push(item);}
    const [x,y,width,z,rotation=0]=portrait?tall:wide;
    item.placements[key]={x,y,width,z,rotation,opacity:1,hidden:false,anchor:'scene',behindTv:z<10,
      brightness:100,saturation:90,shadow:24,
      contactShadow:{opacity:asset==='rug'?14:info.support?42:25,blur:info.support?9:5,width:info.support?90:65,x:0,y:asset==='rug'?-12:-5},
      ...(info.category==='lamp'?{light:{color:spec.lamp,intensity:78,radius:asset==='linen-floor-lamp'?2.8:5.5,x:50,y:asset==='linen-floor-lamp'?14:30,softness:95}}:{})};
  }
  const old=room.presentations?.[key] ?? {};
  const support=room.items.find(i=>i.roomKit===id && i.asset===(id==='violet-den'?'cabinet-black':'cabinet'));
  (room.presentations ??= {})[key]={...old,environment:id,style:'classic',camera:{zoom:portrait ? .85 : .75},tv:{zoom:portrait ? .78 : .70},tvModel:spec.model,tvSupport:'cabinet',supportId:support.id,
    video:old.video ?? {fit:'contain'},ambient:spec.ambient,
    mood:{daytime:'night',preset:'neutral',intensity:0,tvGlow:115,rim:65,cabinet:85,floor:50,reach:110,transition:450,depth:spec.depth,practicalLights:true,
      backlight:{color:spec.backlight,intensity:22,reach:115},zones:{tv:{influence:0}}},
    reflection:old.reflection ?? {enabled:true,intensity:60,table:55,floor:35,blur:14,texture:70}};
  const p=room.presentations[key];delete p.background;delete p.screen;delete p.tvPaint;delete p.rain;
  return true;
}
export function compositionRestGroups(room,key) {
  const id=room.presentations?.[key]?.environment;
  const pairs=id==='midnight-den' ? [['cabinet',['linen-lamp','plant-small','controller','console','cartridge-gray']],['floating-shelf',['games']]] :
    id==='walnut-den' ? [['cabinet',['console-cube','game-cases-stack','game-disc']],['side-table',['succulent']],['floating-shelf',['games','anime-figure']]] :
    id==='violet-den' ? [['cabinet-black',['mushroom-lamp','headphones','console-cube','cartridge-gray']],['side-table',['plant-small']],['floating-shelf',['handheld-purple','anime-figure']]] : [];
  const item=asset=>room.items.find(i=>i.roomKit===id && i.asset===asset);
  return pairs.map(([surface,assets])=>({supportId:item(surface).id,ids:assets.map(a=>item(a).id)}));
}
