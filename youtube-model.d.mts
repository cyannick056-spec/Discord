export type PlaybackState = {source:'switch'|'youtube';videoId:string;playlistId:string;position:number;playing:boolean;updatedAt:number;revision:number;serverNow?:number;index?:number};
export function parseYouTubeLink(input:string): {videoId:string;playlistId:string;position:number;index:number};
export function playbackPosition(state:PlaybackState,now?:number):number;
export function validatePlayback(body:unknown):Partial<PlaybackState>;
