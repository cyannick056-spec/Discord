import {themeGlass} from './room-theme-glass.mjs';
// Pixel coordinates measured in the four supplied photographs. A single
// transform maps both photograph and glass, including cover crops and zoom.
export const glass = {
 'crt-wide': [1536,864,554,122,420,301],
 'crt-portrait': [864,1536,242,470,390,275],
 'flat-wide': [1536,864,402,99,741,352],
 'flat-portrait': [864,1536,146,484,572,303],
};
export function photoLayout(width,height,type,camera={},compact=false,theme='classic'){
 if(compact)return {photo:{left:0,top:0,width,height},screen:{left:0,top:0,width,height}};
 const portrait=height>width && !compact;
 const [iw,ih,x,y,w,h]=(themeGlass[theme]??glass)[`${type}-${portrait?'portrait':'wide'}`];
 const zoom=Math.max(1,Math.min(2,camera.zoom??1));
 const scale=Math.max(width/iw,height/ih)*zoom;
 const pw=iw*scale,ph=ih*scale;
 const dx=Math.max(-(pw-width)/2,Math.min((pw-width)/2,(camera.x??0)*width/100));
 const dy=Math.max(-(ph-height)/2,Math.min((ph-height)/2,(camera.y??0)*height/100));
 return {photo:{left:(width-pw)/2+dx,top:(height-ph)/2+dy,width:pw,height:ph},screen:compact?{left:0,top:0,width,height}:{left:x*scale,top:y*scale,width:w*scale,height:h*scale}};
}
