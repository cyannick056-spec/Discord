export function safeResourceLabel(value) {
  try {
    const url=new URL(value);
    if(!['http:','https:'].includes(url.protocol))return 'recurso sin dominio';
    const path=url.pathname.split('/').filter(Boolean).slice(0,2).map(part=>part.replace(/[^a-zA-Z0-9_.-]/g,'').slice(0,48)).join('/');
    return url.hostname.slice(0,120)+(path?'/'+path:'');
  }catch{return 'recurso sin dominio';}
}
export function needsPlaybackCommand(playerState,playing) {
  // Buffering is already a play attempt. Polling must not repeat playVideo()
  // every 1.5 seconds while the native player waits for its media.
  return playing ? ![1,3].includes(playerState) : [1,3].includes(playerState);
}
export function playbackSelectionKey(state) {
  return state.playlistId?`list:${state.playlistId}:${state.index || 0}`:`video:${state.videoId}`;
}
