// The rooms contain no television. Both TV models use a shared SVG frame.
const cabinetTop={midnight:[505,830],retro:[503,810],minimal:[515,894],rain:[507,916]};
export const themeFrames={},themeGlass={};
for(const [theme,tops] of Object.entries(cabinetTop)){
 themeFrames[theme]={};themeGlass[theme]={};
 for(const portrait of [false,true])for(const type of ['crt','flat']){
  const iw=portrait?941:1672,ih=portrait?1672:941;
  const fw=iw*(type==='crt'?(portrait?.78:.34):(portrait?.84:.46));
  const fh=fw*(type==='crt'?.76:.6),fx=(iw-fw)/2,fy=tops[portrait?1:0]-fh;
  const key=`${type}-${portrait?'portrait':'wide'}`;
  const [gx,gy,gw,gh]=type==='crt'?[88,74,824,572]:[12,12,976,560];
  themeFrames[theme][key]=[iw,ih,fx,fy,fw,fh];
  themeGlass[theme][key]=[iw,ih,fx+gx*fw/1000,fy+gy*fw/1000,gw*fw/1000,gh*fw/1000];
 }
}
