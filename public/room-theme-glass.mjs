import {tvModels} from './tv/models.mjs';
// Edited room photos contain no TV and no coffee table.
const cabinetTop={midnight:[505,830],retro:[503,810],minimal:[515,894],rain:[507,916]};
export const themeFrames={},themeGlass={};
for(const [theme,tops] of Object.entries(cabinetTop)){
 themeFrames[theme]={};themeGlass[theme]={};
 for(const portrait of [false,true])for(const type of ['crt','flat']){
  const iw=portrait?941:1672,ih=portrait?1672:941,m=tvModels[type];
  const bodyWidth=iw*(type==='crt'?(portrait?.78:.34):(portrait?.84:.46));
  const factor=bodyWidth/m.body[2],fw=m.width*factor,fh=m.height*factor;
  const fx=iw/2-(m.body[0]+m.body[2]/2)*factor,fy=tops[portrait?1:0]-(m.body[1]+m.body[3])*factor;
  const key=`${type}-${portrait?'portrait':'wide'}`;
  const [gx,gy,gw,gh]=m.glass;
  themeFrames[theme][key]=[iw,ih,fx,fy,fw,fh];
  themeGlass[theme][key]=[iw,ih,fx+gx*factor,fy+gy*factor,gw*factor,gh*factor];
 }
}
