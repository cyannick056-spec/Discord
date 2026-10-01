import { roomIds, props } from './room-catalog.mjs';
import { MAX_SCENE_ITEMS } from './material-catalog.mjs';
export const homeKeys = ['home-landscape-16x9', 'home-landscape-4x3', 'home-portrait-16x9', 'home-portrait-4x3', 'home-window-16x9', 'home-window-4x3'];
const starterAssets = ['cabinet', 'mushroom-lamp', 'plant-small', 'lavender-light'];
export function realRoomPlacement(asset, portrait) {
  const coords = asset === 'cabinet' ? [50, portrait ? 72 : 77, portrait ? 94 : 78, 3] :
    asset === 'mushroom-lamp' ? [portrait ? 8 : 17, portrait ? 67 : 64, portrait ? 10 : 8, 14] :
    asset === 'plant-small' ? [portrait ? 92 : 85, portrait ? 68 : 64.5, portrait ? 9 : 7, 14] :
    [50, portrait ? 55 : 49, portrait ? 28 : 22, 0];
  const [x,y,width,z] = coords;
  return { x,y,width,z,rotation:0,opacity:1,hidden:false,anchor:'scene',behindTv:asset === 'cabinet' || asset === 'lavender-light',brightness:100,saturation:100,shadow:30,
    ...(asset === 'mushroom-lamp' ? { light:{color:'#ffb66c',intensity:90,radius:5,x:50,y:30} } : {}),
    ...(asset === 'lavender-light' ? { light:{color:'#9e86dd',intensity:46,radius:2.5,shape:'point',softness:85} } : {}) };
}
export function defaultRealPresentation(key, environment = 'cozy-night') {
  return {environment,style:'classic',camera:{zoom:1},tv:{zoom:key.includes('portrait') ? .72 : .58},tvModel:'flat-modern',tvSupport:'cabinet',video:{fit:'contain'},screen:{rounded:false},ambient:100,
    mood:{daytime:'night',preset:'neutral',intensity:0,tvGlow:110,rim:75,cabinet:90,floor:70,zones:{tv:{influence:0}}},
    reflection:{enabled:true,intensity:60,table:55,floor:35,blur:14,texture:60}};
}
export function prepareRealRoom(room,id,viewKey) {
  if(!roomIds.has(id)) return false;
  const keys = viewKey ? [viewKey] : homeKeys;
  const missing = starterAssets.filter(asset => !room.items.some(i=>asset==='lavender-light' ? i.kind==='light' && i.name==='Luz lavanda detrás de la TV' : i.roomKit===id && i.asset===asset));
  if(room.items.filter(i=>i.kind!=='viewer-slot').length+missing.length > MAX_SCENE_ITEMS) return false;
  for(const asset of missing) {
    const info=props.find(p=>p.id===asset);
    room.items.push({id:crypto.randomUUID(), ...(info ? {kind:'builtin',asset,name:info.name,category:info.category,roomKit:id} : {kind:'light',asset:'',name:'Luz lavanda detrás de la TV',category:'lamp'}),placements:{}});
  }
  for(const asset of starterAssets) {
    const item=room.items.find(i=>asset==='lavender-light' ? i.kind==='light' && i.name==='Luz lavanda detrás de la TV' : i.roomKit===id && i.asset===asset);
    for(const key of keys) item.placements[key] ??= realRoomPlacement(asset,key.includes('portrait'));
  }
  for(const key of keys) {
    const old=(room.presentations ??= {})[key];
    const p=roomIds.has(old?.environment) ? old : defaultRealPresentation(key,id);
    p.environment=id;delete p.background;delete p.rain;room.presentations[key]=p;
  }
  return true;
}
// One-time replacement; personal images remain in Objects and Library. Older
// view placements stay independent, hidden until the user chooses to place them.
export function rebuildRealRooms(manifest) {
  const rebuild=room=>{
    room.items=room.items.filter(i=>!i.roomKit || roomIds.has(i.roomKit));
    for(const item of room.items) for(const [key,p] of Object.entries(item.placements)) if(key.startsWith('home-')) p.hidden=true;
    for(const key of homeKeys) (room.presentations ??= {})[key]=defaultRealPresentation(key);
    if(!prepareRealRoom(room,'cozy-night')) for(const key of homeKeys) room.presentations[key].tvSupport='free';
    room.ambient=100;room.mood=structuredClone(defaultRealPresentation(homeKeys[0]).mood);
    for(const p of Object.values(room.presentations)) delete p.rain;
  };
  rebuild(manifest);
  for(const entries of [manifest.profiles,manifest.versions]) for(const entry of entries ?? []) rebuild(entry.room);
  for(const item of manifest.library ?? []) delete item.roomKit;
  return manifest;
}
