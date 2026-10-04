import {themeGlass,themeFrames} from './room-theme-glass.mjs';
import {tvModels} from './tv/models.mjs';
export const glass=themeGlass.midnight;
export function photoLayout(width,height,type,camera={},compact=false,theme='midnight',tv={}){
 if(compact){const rect={left:0,top:0,width,height};return {photo:rect,screen:rect,frame:rect}}
 const key=`${type}-${height>width?'portrait':'wide'}`;
 let [iw,ih,x,y,w,h]=(themeGlass[theme]??glass)[key];
 let [, ,fx,fy,fw,fh]=(themeFrames[theme]??themeFrames.midnight)[key];
 const baseScale=Math.max(width/iw,height/ih),model=tvModels[type];
 // Fit once for this viewport, independently of camera zoom/pan. The TV,
 // glass, buttons and cabinet then share a continuous camera transform.
 if(width>=height){
  const units=fw/model.width,[bx,by,bw,bh]=model.body;
  const contact=fy+(by+bh)*units,center=fx+(bx+bw/2)*units;
  const factor=Math.min(1,Math.max(.25,(contact+(height-ih*baseScale)/2/baseScale-12/baseScale)/(bh*units)));
  if(factor<1){const ox=fx,oy=fy;fx=center-(bx+bw/2)*units*factor;fy=contact-(by+bh)*units*factor;fw*=factor;fh*=factor;x=fx+(x-ox)*factor;y=fy+(y-oy)*factor;w*=factor;h*=factor}
 }
 // One transform for the full housing and glass, independently of the room.
 const tvZoom=1;
 const [bx,by,bw,bh]=model.body,units=fw/model.width;
 const cx=fx+(bx+bw/2)*units,cy=fy+(by+bh/2)*units;
 const tx=Math.max(-80,Math.min(80,tv.x??0))*iw/100,ty=Math.max(-80,Math.min(80,tv.y??0))*ih/100;
 fx=cx+(fx-cx)*tvZoom+tx;fy=cy+(fy-cy)*tvZoom+ty;
 x=cx+(x-cx)*tvZoom+tx;y=cy+(y-cy)*tvZoom+ty;
 fw*=tvZoom;fh*=tvZoom;w*=tvZoom;h*=tvZoom;
 const zoom=Math.max(1,Math.min(2,camera.zoom??1));
 const scale=baseScale*zoom;
 const pw=iw*scale,ph=ih*scale;
 const dx=Math.max(-(pw-width)/2,Math.min((pw-width)/2,(camera.x??0)*width/100));
 const dy=Math.max(-(ph-height)/2,Math.min((ph-height)/2,(camera.y??0)*height/100));
 const photo={left:(width-pw)/2+dx,top:(height-ph)/2+dy,width:pw,height:ph};
 return {photo,screen:{left:x*scale,top:y*scale,width:w*scale,height:h*scale},frame:{left:fx*scale,top:fy*scale,width:fw*scale,height:fh*scale}};
}
