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
export function youtubeScriptUrl(value) {return youtubeBase(value)+'/iframe_api';}
export function isYouTubeScriptResponse(status,contentType) {
  return status>=200 && status<300 && /^(application|text)\/(javascript|x-javascript|ecmascript)(;|$)/i.test(contentType.trim());
}
