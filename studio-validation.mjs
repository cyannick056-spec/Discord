const finite = (value, low, high) => typeof value === 'number' && Number.isFinite(value) && value >= low && value <= high;
const optionalNumbers = (object, fields) => Object.entries(fields).every(([key, [lo, hi]]) => object[key] === undefined || finite(object[key], lo, hi));
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const uuid = value => typeof value === 'string' && /^[a-f0-9-]{36}$/.test(value);
const categories = ['figurine', 'sticker', 'poster', 'frame', 'lamp'];
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
    (t.surface === undefined || ['free', 'wall', 'cabinet', 'floor'].includes(t.surface)) &&
    ['auto', 'flipX', 'flipY'].every(key => t[key] === undefined || typeof t[key] === 'boolean') &&
    optionalNumbers(t, { tiltX: [-75, 75], tiltY: [-75, 75], skewX: [-45, 45], skewY: [-45, 45], scaleX: [.25, 2.5], scaleY: [.25, 2.5] }))) &&
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
