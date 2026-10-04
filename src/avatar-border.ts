export function borderFromPixels(pixels:Uint8ClampedArray){
 let light=0,total=0;
 for(let i=0;i<pixels.length;i+=4){if(pixels[i+3]<128)continue;total++;if(pixels[i]*.2126+pixels[i+1]*.7152+pixels[i+2]*.0722>170)light++}
 return total&&light/total>.5?'#111111':'#ffffff';
}
export function updateAvatarBorder(image:HTMLImageElement){
 try{const canvas=document.createElement('canvas');canvas.width=canvas.height=16;const context=canvas.getContext('2d');if(!context)return;context.drawImage(image,0,0,16,16);image.style.setProperty('--avatar-border',borderFromPixels(context.getImageData(0,0,16,16).data))}catch{image.style.setProperty('--avatar-border','#ffffff')}
}
