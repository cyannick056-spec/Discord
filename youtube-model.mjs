const videoPattern = /^[A-Za-z0-9_-]{11}$/;
const listPattern = /^[A-Za-z0-9_-]{10,128}$/;
export function parseYouTubeLink(input) {
  if (typeof input !== 'string' || input.length > 2048) throw new Error('Pega un enlace de vídeo o lista de YouTube');
  let url; try { url = new URL(input.trim()); } catch { throw new Error('Pega un enlace completo de YouTube'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) throw new Error('Enlace de YouTube inválido');
  const host = url.hostname.toLowerCase();
  if (!['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com','youtu.be','www.youtu.be'].includes(host)) throw new Error('Solo se admiten enlaces de YouTube');
  const videoId = host.endsWith('youtu.be') ? url.pathname.slice(1).split('/')[0] : url.pathname === '/watch' ? url.searchParams.get('v') : /^\/(shorts|live|embed)\//.test(url.pathname) ? url.pathname.split('/')[2] : null;
  const playlistId = url.searchParams.get('list');
  if (videoId && !videoPattern.test(videoId) || playlistId && !listPattern.test(playlistId) || !videoId && !playlistId) throw new Error('Ese enlace no contiene un vídeo o lista válidos');
  const t = url.searchParams.get('t') || url.searchParams.get('start') || '';
  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(t);
  const position = /^\d+$/.test(t) ? Number(t) : match ? Number(match[1]||0)*3600+Number(match[2]||0)*60+Number(match[3]||0) : 0;
  const index=Math.max(0,Math.min(10000,(Number(url.searchParams.get('index')) || 1)-1));
  return {videoId:videoId || '', playlistId:playlistId || '', position:Math.min(86400,position),index};
}
export function playbackPosition(state, now = Date.now()) {
  return Math.max(0, Math.min(86400, state.position + (state.playing ? Math.max(0,now-state.updatedAt)/1000 : 0)));
}
export function validatePlayback(body) {
  if (!body || !['switch','youtube'].includes(body.source)) throw new Error('Fuente inválida');
  if (body.source === 'switch') return {source:'switch',videoId:'',playlistId:'',position:0,playing:false};
  if (typeof body.videoId !== 'string' || body.videoId && !videoPattern.test(body.videoId) || typeof body.playlistId !== 'string' || body.playlistId && !listPattern.test(body.playlistId) || !body.videoId && !body.playlistId) throw new Error('Vídeo inválido');
  if (!Number.isFinite(body.position) || body.position < 0 || body.position > 86400 || typeof body.playing !== 'boolean') throw new Error('Reproducción inválida');
  const index=body.index ?? 0;if(!Number.isInteger(index) || index<0 || index>10000)throw new Error('Lista inválida');
  return {source:'youtube',videoId:body.videoId,playlistId:body.playlistId,position:body.position,playing:body.playing,index};
}
