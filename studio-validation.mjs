import {roomThemeIds} from './public/room-themes.mjs';
import { materialIds, MAX_LIBRARY_ITEMS } from './material-catalog.mjs';
import { tvIds } from './tv-catalog.mjs';
import { roomIds, legacyRoomIds, propIds } from './room-catalog.mjs';
const finite = (value, low, high) => typeof value === 'number' && Number.isFinite(value) && value >= low && value <= high;
const optionalNumbers = (object, fields) => Object.entries(fields).every(([key, [lo, hi]]) => object[key] === undefined || finite(object[key], lo, hi));
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const uuid = value => typeof value === 'string' && /^[a-f0-9-]{36}$/.test(value);
const categories = ['figurine', 'sticker', 'poster', 'frame', 'lamp', 'furniture', 'game'];
function validCorners(points) {
  if (!Array.isArray(points) || points.length !== 4 || points.some(p => !Array.isArray(p) || p.length !== 2 || p.some(v => !finite(v, -60, 160)))) return false;
  const crosses = points.map((p, i) => { const q = points[(i + 1) % 4], r = points[(i + 2) % 4]; return (q[0] - p[0]) * (r[1] - q[1]) - (q[1] - p[1]) * (r[0] - q[0]); });
  return crosses.every(v => v > 25) || crosses.every(v => v < -25);
}
export function validPresentations(settings, views) {
  if (settings === undefined) return true;
  if (!object(settings)) return false;
  return Object.entries(settings).every(([view, p]) => views.has(view) && object(p) &&
    (p.ambient === undefined || finite(p.ambient, 25, 100)) &&
    (p.mood === undefined || validMood(p.mood)) &&
    (p.roomTheme === undefined || roomThemeIds.has(p.roomTheme)) &&
    (p.environment === undefined || roomIds.has(p.environment) || legacyRoomIds.has(p.environment)) &&
    (p.rain === undefined || (object(p.rain) && (p.rain.enabled === undefined || typeof p.rain.enabled === 'boolean') && (p.rain.forceMotion === undefined || typeof p.rain.forceMotion === 'boolean') && optionalNumbers(p.rain, { intensity: [0,100], speed: [.2,3] }))) &&
    (p.tvSupport === undefined || ['free', 'cabinet', 'floor'].includes(p.tvSupport)) &&
    (p.supportId === undefined || uuid(p.supportId)) &&
    (p.video?.fit === undefined || ['cover', 'contain'].includes(p.video.fit)) &&
    (p.video?.auto === undefined || typeof p.video.auto === 'boolean') &&
    (p.tvModel === undefined || tvIds.has(p.tvModel)) &&
    (p.style === undefined || ['original', 'classic', 'minimal', 'wood', 'brick', 'custom'].includes(p.style)) &&
    ['wall', 'cabinet', 'floor'].every(key => p[key] === undefined || (typeof p[key] === 'string' && /^#[a-fA-F0-9]{6}$/.test(p[key]))) &&
    (p.showEnvironment === undefined || typeof p.showEnvironment === 'boolean') &&
    (p.overlay === undefined || (object(p.overlay) && typeof p.overlay.asset === 'string' && /^[a-f0-9-]{36}\.(png|jpg|webp|gif)$/.test(p.overlay.asset) && optionalNumbers(p.overlay,{opacity:[0,1]}))) &&
    (p.aperture === undefined || (object(p.aperture) && ['x','y','width','height'].every(k=>typeof p.aperture[k]==='number') && optionalNumbers(p.aperture,{x:[0,100],y:[0,100],width:[1,100],height:[1,100]}))) &&
    (p.background === undefined || (typeof p.background === 'string' && /^[a-f0-9-]{36}\.(png|jpg|webp|gif)$/.test(p.background))) &&
    (p.hideCabinet === undefined || typeof p.hideCabinet === 'boolean') && optionalNumbers(p, { cabinetY: [15, 90], cabinetHeight: [5, 45] }) &&
    (p.tvPaint === undefined || (object(p.tvPaint) && (p.tvPaint.modelRevision === undefined || p.tvPaint.modelRevision === 2) && (p.tvPaint.enabled === undefined || typeof p.tvPaint.enabled === 'boolean') && ['body','bezel','panel'].every(key => p.tvPaint[key] === undefined || (typeof p.tvPaint[key] === 'string' && /^#[a-fA-F0-9]{6}$/.test(p.tvPaint[key]))) && (p.tvPaint.finish === undefined || ['matte','satin','gloss'].includes(p.tvPaint.finish)) && optionalNumbers(p.tvPaint, { strength: [0,100], hue: [-180,180], saturation: [0,200], exposure: [-60,60], contrast: [50,150] }))) &&
    (p.reflection === undefined || (object(p.reflection) && (p.reflection.enabled === undefined || typeof p.reflection.enabled === 'boolean') && optionalNumbers(p.reflection, { intensity: [0,150], table: [0,200], floor: [0,200], blur: [0,30], reach: [30,180], spread: [50,180], offset: [-20,30], texture: [0,100] }))) &&
    (p.screen === undefined || (object(p.screen) && (p.screen.rounded === undefined || typeof p.screen.rounded === 'boolean') && optionalNumbers(p.screen, { x: [-50, 50], y: [-50, 50], width: [50, 150], height: [50, 150] }))) &&
    ['camera', 'tv', 'video'].every(key => p[key] === undefined || (object(p[key]) && optionalNumbers(p[key], { x: [key === 'tv' ? -80 : -50, key === 'tv' ? 80 : 50], y: [key === 'tv' ? -80 : -50, key === 'tv' ? 80 : 50], zoom: [key === 'tv' ? .3 : key === 'camera' ? .5 : 1, key === 'video' ? 3 : 2.5] }))));
}
export function validMetadata(item) {
  return (item.category === undefined || categories.includes(item.category)) &&
    (item.roomKit === undefined || (item.kind === 'builtin' && (roomIds.has(item.roomKit) || legacyRoomIds.has(item.roomKit)))) &&
    (item.kind !== 'builtin' || propIds.has(item.asset)) &&
    (item.favorite === undefined || typeof item.favorite === 'boolean') &&
    (item.group === undefined || uuid(item.group)) &&
    (item.kind !== 'shape' || ['star', 'robot', 'frame', 'poster'].includes(item.shape));
}
function validGrade(g) {
  return object(g) && optionalNumbers(g, { exposure: [-60, 60], contrast: [50, 150], saturation: [0, 150], temperature: [-100, 100], shadows: [0, 60], influence: [0, 100] });
}
export function validMood(m) {
  return object(m) && (m.daytime === undefined || ['morning', 'day', 'evening', 'night'].includes(m.daytime)) && ['neutral', 'blue-night', 'warm', 'classic-night', 'tv-only', 'moonlight', 'soft-night', 'neon'].includes(m.preset) &&
    (m.practicalLights === undefined || typeof m.practicalLights === 'boolean') &&
    ['accent', 'accent2'].every(key => m[key] === undefined || (typeof m[key] === 'string' && /^#[a-fA-F0-9]{6}$/.test(m[key]))) &&
    finite(m.intensity, 0, 100) && finite(m.tvGlow, 0, 200) &&
    optionalNumbers(m, { rim: [0, 200], cabinet: [0, 200], floor: [0, 200], reach: [30, 180], transition: [150, 2000], depth: [0, 100], tvDetail:[0,100],tvSoftness:[0,100] }) &&
    (m.backlight === undefined || (!!object(m.backlight) && typeof m.backlight.color === 'string' && /^#[a-fA-F0-9]{6}$/.test(m.backlight.color) && finite(m.backlight.intensity, 0, 100) && finite(m.backlight.reach, 50, 180))) &&
    (m.grade === undefined || validGrade(m.grade)) &&
    (m.zones === undefined || (object(m.zones) && Object.entries(m.zones).every(([zone, g]) => ['wall', 'cabinet', 'floor', 'tv', 'figures'].includes(zone) && validGrade(g))));
}
export function validStudioPlacement(p) {
  if(p.lightResponse!==undefined && !finite(p.lightResponse,0,100)) return false;
  if(p.solid!==undefined && typeof p.solid!=='boolean') return false;
  if(p.tint!==undefined && (typeof p.tint!=='string' || !/^#[a-fA-F0-9]{6}$/.test(p.tint))) return false;
  if(p.tintStrength!==undefined && !finite(p.tintStrength,0,100)) return false;
  const t = p.transform;
  return (p.material === undefined || (object(p.material) && materialIds.has(p.material.preset) && (p.material.scope === undefined || ['top','all'].includes(p.material.scope)) && (p.material.color === undefined || /^#[a-fA-F0-9]{6}$/.test(p.material.color)) && optionalNumbers(p.material, { strength: [0,100], scale: [.25,4], roughness: [0,100] }))) &&
    (p.lava === undefined || (object(p.lava) && (p.lava.motion === undefined || typeof p.lava.motion === 'boolean') && optionalNumbers(p.lava, { speed: [.2, 3] }))) &&
    (t === undefined || (object(t) &&
    (t.surface === undefined || ['free', 'wall', 'cabinet', 'floor', 'ceiling', 'left-wall', 'right-wall', 'shelf'].includes(t.surface)) &&
    ['auto', 'flipX', 'flipY'].every(key => t[key] === undefined || typeof t[key] === 'boolean') &&
    optionalNumbers(t, { tiltX: [-85, 85], tiltY: [-85, 85], skewX: [-45, 45], skewY: [-45, 45], scaleX: [.25, 2.5], scaleY: [.25, 2.5], depth: [150, 2000] }) && (t.corners === undefined || validCorners(t.corners)))) &&
    (p.contactShadow === undefined || (object(p.contactShadow) && Object.entries({ opacity: [0, 100], blur: [0, 25], width: [20, 160], x: [-50, 50], y: [-40, 40] }).every(([key, [lo, hi]]) => finite(p.contactShadow[key], lo, hi)))) &&
    (p.crop === undefined || (Array.isArray(p.crop) && p.crop.length === 4 && p.crop.every(v => finite(v, 0, 45)))) &&
    (p.light === undefined || (object(p.light) &&
      (p.light.shape === undefined || ['point', 'spot', 'strip'].includes(p.light.shape)) && optionalNumbers(p.light, { angle: [-180, 180], softness: [0, 100], kelvin: [2000, 10000] })));
}
export function validCollections(input, validateRoom) {
  return ['profiles', 'versions'].every(key => input[key] === undefined || (Array.isArray(input[key]) && input[key].length <= (key === 'profiles' ? 6 : 3) &&
    new Set(input[key].map(v => v?.id)).size === input[key].length && input[key].every(v => object(v) && uuid(v.id) && typeof v.name === 'string' && v.name.length <= 70 && object(v.room) &&
      !['profiles', 'versions', 'library'].some(key => v.room[key] !== undefined) && validateRoom(v.room)))) &&
    (input.library === undefined || (Array.isArray(input.library) && input.library.length <= MAX_LIBRARY_ITEMS && input.library.every(i => object(i) && uuid(i.id) && typeof i.name === 'string' && i.name.length <= 70 && validMetadata(i) &&
      (i.kind === 'shape' || i.kind === 'builtin' || (i.kind === undefined && typeof i.asset === 'string' && /^[a-f0-9-]{36}\.(png|jpg|webp|gif)$/.test(i.asset))))));
}
