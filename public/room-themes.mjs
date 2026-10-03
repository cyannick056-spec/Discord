export const roomThemes=[
 {id:'midnight',name:'Madrugada'},
 {id:'retro',name:'Cuarto retro'},
 {id:'minimal',name:'Minimalista'},
 {id:'rain',name:'Lluvia'},
];
export const roomThemeIds=new Set(['classic',...roomThemes.map(t=>t.id)]);
export const themeFor=p=>roomThemeIds.has(p?.roomTheme)&&p.roomTheme!=='classic'?p.roomTheme:'midnight';
export function roomPhoto(type,view,theme='midnight'){
 const orientation=view==='portrait'?'portrait':'wide';
 return `/rooms/clean/${themeFor({roomTheme:theme})}-${orientation}.webp`;
}
