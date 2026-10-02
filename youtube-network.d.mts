export const youtubeMapping:{prefix:string;target:string};
export function isDiscordOrigin(value:string|URL):boolean;
export function youtubeBase(value:string|URL):string;
export function youtubeScriptUrl(value:string|URL):string;
export function youtubeEmbedUrl(value:string|URL,selection:{videoId?:string;playlistId?:string;position?:number;index?:number;playing?:boolean}):string;
export function youtubeResourceUrl(value:string|URL,path:string):string;
export function isYouTubeScriptResponse(status:number,contentType:string):boolean;
