import {viewFor} from './activity-model.mjs';
export function previewViewport(view,width,height){
 if(view===viewFor(width,height))return {width,height};
 if(view==='window')return {width:320,height:240};
 if(viewFor(width,height)==='window')return view==='portrait'?{width:430,height:932}:{width:1200,height:800};
 return view==='portrait'?{width:Math.min(width,height),height:Math.max(width,height)}:{width:Math.max(width,height),height:Math.min(width,height)};
}
export function scalePreviewLayout(result,scale){
 return Object.fromEntries(Object.entries(result).map(([name,rect])=>[name,Object.fromEntries(Object.entries(rect).map(([key,value])=>[key,value*scale]))]));
}
