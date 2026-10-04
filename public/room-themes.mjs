export const roomThemes=[
 {id:'midnight',name:'Noche cálida'},
 {id:'midnight3',name:'3 a. m.'},
 {id:'retro',name:'Cuarto retro'},
 {id:'minimal',name:'Minimalista'},
 {id:'rain',name:'Lluvia'},
];
export const roomThemeIds=new Set(['classic',...roomThemes.map(t=>t.id)]);
export const themeFor=p=>roomThemeIds.has(p?.roomTheme)&&p.roomTheme!=='classic'?p.roomTheme:'midnight';
export function roomPhoto(type,view,theme='midnight'){
 const orientation=view==='portrait'?'portrait':'wide';
 const selected=themeFor({roomTheme:theme});
 return `/rooms/${selected==='midnight'?'hd-v3':'clean-hd-v4'}/${selected}-${orientation}.webp`;
}
