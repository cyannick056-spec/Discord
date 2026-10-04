export function validInitialScene(value){
 return value&&typeof value==='object'&&!Array.isArray(value)&&
 ['home','arcade'].includes(value.scene)&&['16:9','4:3'].includes(value.aspect)&&
 ['off','normal','immersive','scanlines'].includes(value.retro)&&typeof value.smoothing==='boolean';
}
