export function safeResourceLabel(value:string):string;
export function needsPlaybackCommand(playerState:number,playing:boolean):boolean;
export function playbackSelectionKey(state:{videoId?:string;playlistId?:string;index?:number}):string;
