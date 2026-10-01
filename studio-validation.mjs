const finite = (value, low, high) => typeof value === 'number' && Number.isFinite(value) && value >= low && value <= high;
const optionalNumbers = (object, fields) => Object.entries(fields).every(([key, [lo, hi]]) => object[key] === undefined || finite(object[key], lo, hi));
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const uuid = value => typeof value === 'string' && /^[a-f0-9-]{36}$/.test(value);
const categories = ['figurine', 'sticker', 'poster', 'frame', 'lamp'];
function validCorners(points) {
  if (!Array.isArray(points) || points.length !== 4 || points.some(p => !Array.isArray(p) || p.length !== 2 || p.some(v => !finite(v, -60, 160)))) return false;
  const crosses = points.map((p, i) => { const q = points[(i + 1) % 4], r = points[(i + 2) % 4]; return (q[0] - p[0]) * (r[1] - q[1]) - (q[1] - p[1]) * (r[0] - q[0]); });
  return crosses.every(v => v > 25) || crosses.every(v => v < -25);
}
export function validPresentations(settings, views) {
  if (settings === undefined) return true;
  if (!object(settings)) return false;
  return Object.entries(settings).every(([view, p]) => views.has(view) && object(p) &&
    (p.style === undefined || ['original', 'classic', 'minimal', 'wood', 'brick', 'custom'].includes(p.style)) &&
    ['wall', 'cabinet', 'floor'].every(key => p[key] === undefined || (typeof p[key] === 'string' && /^#[a-fA-F0-9]{6}$/.test(p[key]))) &&
    (p.background === undefined || (typeof p.background === 'string' && /^[a-f0-9-]{36}\.(png|jpg|webp|gif)$/.test(p.background))) &&
    (p.hideCabinet === undefined || typeof p.hideCabinet === 'boolean') && optionalNumbers(p, { cabinetY: [15, 90], cabinetHeight: [5, 45] }) &&
    (p.screen === undefined || (object(p.screen) && optionalNumbers(p.screen, { x: [-50, 50], y: [-50, 50], width: [50, 150], height: [50, 150] }))) &&
    ['camera', 'tv', 'video'].every(key => p[key] === undefined || (object(p[key]) && optionalNumbers(p[key], { x: [key === 'tv' ? -80 : -50, key === 'tv' ? 80 : 50], y: [key === 'tv' ? -80 : -50, key === 'tv' ? 80 : 50], zoom: [key === 'tv' ? .3 : key === 'camera' ? .5 : 1, key === 'video' ? 3 : 2.5] }))));
}
export function validMetadata(item) {
  return (item.category === undefined || categories.includes(item.category)) &&
    (item.favorite === undefined || typeof item.favorite === 'boolean') &&
    (item.group === undefined || uuid(item.group)) &&
    (item.kind !== 'shape' || ['star', 'robot', 'frame', 'poster'].includes(item.shape));
}
function validGrade(g) {
  return object(g) && optionalNumbers(g, { exposure: [-60, 60], contrast: [50, 150], saturation: [0, 150], temperature: [-100, 100], shadows: [0, 60], influence: [0, 100] });
}
export function validMood(m) {
  return object(m) && ['neutral', 'blue-night', 'warm', 'classic-night', 'tv-only', 'moonlight', 'soft-night', 'neon'].includes(m.preset) &&
    ['accent', 'accent2'].every(key => m[key] === undefined || (typeof m[key] === 'string' && /^#[a-fA-F0-9]{6}$/.test(m[key]))) &&
    finite(m.intensity, 0, 100) && finite(m.tvGlow, 0, 200) &&
    optionalNumbers(m, { rim: [0, 200], cabinet: [0, 200], floor: [0, 200], reach: [30, 180], transition: [150, 2000] }) &&
    (m.grade === undefined || validGrade(m.grade)) &&
    (m.zones === undefined || (object(m.zones) && Object.entries(m.zones).every(([zone, g]) => ['wall', 'cabinet', 'floor', 'tv', 'figures'].includes(zone) && validGrade(g))));
}
export function validStudioPlacement(p) {
  const t = p.transform;
  return (t === undefined || (object(t) &&
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
    (input.library === undefined || (Array.isArray(input.library) && input.library.length <= 120 && input.library.every(i => object(i) && uuid(i.id) && typeof i.name === 'string' && i.name.length <= 70 && validMetadata(i) &&
      (i.kind === 'shape' || (i.kind === undefined && typeof i.asset === 'string' && /^[a-f0-9-]{36}\.(png|jpg|webp|gif)$/.test(i.asset))))));
}
