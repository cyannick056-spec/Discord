import {detectActiveArea,fullVideoArea,stabilizeActiveArea,type AreaState} from './video-active-area';
const states=new WeakMap<HTMLVideoElement,AreaState & {width:number;height:number;blocked?:boolean}>();
let sample:HTMLCanvasElement|undefined;
export function activeVideoArea(video:HTMLVideoElement) {return states.get(video)?.area ?? fullVideoArea();}
export function sampleActiveVideo(video:HTMLVideoElement) {
  if(video.readyState<2 || !video.videoWidth || !video.videoHeight) return false;
  let state=states.get(video);
  if(!state || state.width!==video.videoWidth || state.height!==video.videoHeight) {
    state={area:fullVideoArea(),count:0,width:video.videoWidth,height:video.videoHeight};states.set(video,state);
  }
  if(state.blocked) return false;
  sample ??= document.createElement('canvas');sample.width=160;sample.height=90;
  const ctx=sample.getContext('2d',{willReadFrequently:true});if(!ctx) return false;
  try {ctx.drawImage(video,0,0,160,90);return stabilizeActiveArea(state,detectActiveArea(ctx.getImageData(0,0,160,90).data,160,90,video.videoWidth/video.videoHeight));}
  catch {state.blocked=true;return false;}
}
export function resetActiveVideo(video:HTMLVideoElement) {states.delete(video);}
