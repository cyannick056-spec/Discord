// Small deterministic albedo tiles, without baked highlights or shadows.
// Generated once per material; no noise generation in the lighting loop.
export function proceduralMaterialTexture(name:string): HTMLCanvasElement | undefined {
  if(!['cement','slate','linen'].includes(name)) return;
  const tile=document.createElement('canvas');tile.width=tile.height=96;
  const ctx=tile.getContext('2d')!;
  const data=ctx.createImageData(96,96);
  const noise=(x:number,y:number)=>{
    let n=((x*374761393+y*668265263)^0x27d4eb2d)>>>0;
    n=Math.imul(n^(n>>>13),1274126177)>>>0;return (n^(n>>>16))>>>0;
  };
  for(let y=0;y<96;y++) for(let x=0;x<96;x++) {
    const grain=noise(x,y)%13-6;
    const wave=Math.sin(x*Math.PI/24)*Math.cos(y*Math.PI/48);
    const value=name==='linen' ? 227+grain*.4+(x%4===0?-20:0)+(y%4===0?-14:0) : name==='slate' ? 211+grain+wave*10 : 229+grain+wave*4;
    const i=(y*96+x)*4;data.data[i]=data.data[i+1]=data.data[i+2]=value;data.data[i+3]=255;
  }
  ctx.putImageData(data,0,0);return tile;
}
