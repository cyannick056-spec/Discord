export const youtubeMapping = {prefix:'/youtube',target:'www.youtube.com'};
export function isDiscordOrigin(value) {
  const url=new URL(value);return url.protocol==='https:' && url.hostname.endsWith('.discordsays.com');
}
export function youtubeBase(value) {
  const url=new URL(value);
  if(!isDiscordOrigin(url))return 'https://www.youtube.com';
  const proxy=url.pathname.startsWith('/.proxy/')?'/.proxy':'';
  return `${url.origin}${proxy}${youtubeMapping.prefix}`;
}
export function youtubeIdentity(value) {
  const url=new URL(value);
  return `${url.origin}/`;
}
export function youtubeMappedResourceUrl(value,path) {
  if(typeof path!=='string' || !path.startsWith('/') || path.startsWith('//'))throw new Error('Unexpected YouTube resource path');
  if(!isDiscordOrigin(value))return 'https://www.youtube.com'+path;
  return youtubeBase(value)+path;
}
export function youtubeScriptUrl(value) {return youtubeBase(value)+'/iframe_api';}
export function youtubeEmbedUrl(value,selection) {
  const identity=youtubeIdentity(value);
  const url=new URL(youtubeBase(value)+'/embed/'+(selection.videoId || 'videoseries'));
  url.search=new URLSearchParams({
    enablejsapi:'1',origin:new URL(value).origin,widget_referrer:identity,
    playsinline:'1',controls:'1',autoplay:selection.playing?'1':'0',
    start:String(Math.floor(selection.position || 0)),
    ...(selection.playlistId?{listType:'playlist',list:selection.playlistId,index:String(selection.index || 0)}:{}),
  }).toString();
  return url.href;
}
export function youtubeResourceUrl(value,path) {
  if(!path.startsWith('/s/'))throw new Error('Unexpected YouTube resource path');
  return youtubeMappedResourceUrl(value,path);
}
export function isYouTubeScriptResponse(status,contentType) {
  return status>=200 && status<300 && /^(application|text)\/(javascript|x-javascript|ecmascript)(;|$)/i.test(contentType.trim());
}
