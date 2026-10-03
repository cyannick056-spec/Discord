export const roomThemes=[
 {id:'classic',name:'Original'},
 {id:'midnight',name:'Madrugada'},
 {id:'retro',name:'Cuarto retro'},
 {id:'minimal',name:'Minimalista'},
 {id:'rain',name:'Lluvia'},
];
export const roomThemeIds=new Set(roomThemes.map(t=>t.id));
export const themeFor=p=>roomThemeIds.has(p?.roomTheme)?p.roomTheme:'classic';
export function roomPhoto(type,view,theme='classic'){
 const orientation=view==='portrait'?'portrait':'wide';
 return theme==='classic'?`/rooms/approved-${type}-${orientation}.jpg`:`/rooms/themes/${theme}-${type}-${orientation}.webp`;
}
