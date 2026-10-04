// Geometry shared by the editor and the activity; percentages survive resizing.
export function soloLayout(width,height,aspect,camera={},aperture){
 const zoom=Math.max(1,Math.min(2,camera.zoom??1));
 const photo={left:(width-width*zoom)/2+(camera.x??0)*width/100,top:(height-height*zoom)/2+(camera.y??0)*height/100,width:width*zoom,height:height*zoom};
 // Background always covers the viewport, even when the saved camera pans.
 photo.left=Math.max(width-photo.width,Math.min(0,photo.left));photo.top=Math.max(height-photo.height,Math.min(0,photo.top));
 const ratio=aspect==='4:3'?4/3:16/9,w=Math.min(photo.width,photo.height*ratio),h=w/ratio;
 const screen=aperture?{left:photo.width*(aperture.x-aperture.width/2)/100,top:photo.height*(aperture.y-aperture.height/2)/100,width:photo.width*aperture.width/100,height:photo.height*aperture.height/100}:{left:(photo.width-w)/2,top:(photo.height-h)/2,width:w,height:h};
 return {photo,screen,frame:{...screen}};
}
export function videoStyle(video={}){return {objectFit:video.fit??'contain',transform:`translate(${video.x??0}%, ${video.y??0}%) scale(${video.zoom??1})`};}
export const tvAspect=model=>model==='flat-modern'?'16:9':'4:3';

export function defaultAperture(width,height,aspect){const {screen}=soloLayout(width,height,aspect);return {x:50,y:50,width:screen.width/width*100,height:screen.height/height*100};}
