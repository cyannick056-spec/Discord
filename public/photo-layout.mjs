import {themeGlass,themeFrames} from './room-theme-glass.mjs';
export const glass=themeGlass.midnight;
export function photoLayout(width,height,type,camera={},compact=false,theme='midnight'){
 if(compact){const rect={left:0,top:0,width,height};return {photo:rect,screen:rect,frame:rect}}
 const key=`${type}-${height>width?'portrait':'wide'}`;
 let [iw,ih,x,y,w,h]=(themeGlass[theme]??glass)[key];
 let [, ,fx,fy,fw,fh]=(themeFrames[theme]??themeFrames.midnight)[key];
 const zoom=Math.max(1,Math.min(2,camera.zoom??1));
 const scale=Math.max(width/iw,height/ih)*zoom;
 const pw=iw*scale,ph=ih*scale;
 const dx=Math.max(-(pw-width)/2,Math.min((pw-width)/2,(camera.x??0)*width/100));
 const dy=Math.max(-(ph-height)/2,Math.min((ph-height)/2,(camera.y??0)*height/100));
 const photo={left:(width-pw)/2+dx,top:(height-ph)/2+dy,width:pw,height:ph};
 // Discord's landscape activity can be much wider than 16:9. Keep the
 // whole television above the cabinet without stretching its proportions.
 if(zoom===1&&width>=height){
  const factor=Math.min(1,Math.max(.25,(fy+fh+photo.top/scale-12/scale)/fh));
  if(factor<1){const ox=fx,oy=fy;fx+=(fw-fw*factor)/2;fy+=fh-fh*factor;fw*=factor;fh*=factor;x=fx+(x-ox)*factor;y=fy+(y-oy)*factor;w*=factor;h*=factor}
 }
 return {photo,screen:{left:x*scale,top:y*scale,width:w*scale,height:h*scale},frame:{left:fx*scale,top:fy*scale,width:fw*scale,height:fh*scale}};
}
