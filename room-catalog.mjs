// Public, allowlisted photographic assets; never resolve user-supplied paths.
export const rooms = [
  { id: 'morning', name: 'Mañana', description: 'Luz natural por la ventana; espacio para decorar', furniture: 'side-table' },
  { id: 'night', name: 'Noche', description: 'La misma habitación con iluminación nocturna propia', furniture: 'side-table' },
];
export const props = [
  { id: 'floor-lamp', name: 'Lámpara de pie', category: 'lamp' },
  { id: 'mushroom-lamp', name: 'Lámpara de hongo', category: 'lamp' },
  { id: 'desk-lamp', name: 'Lámpara articulada', category: 'lamp' },
  { id: 'lava-lamp', name: 'Lámpara de lava animada', category: 'lamp' },
  { id: 'cabinet', name: 'Mueble de TV', category: 'furniture', support: { corners: [[6.6,18],[93.4,18],[98.4,28],[1.6,28]], material: 'wood' } },
  { id: 'cabinet-black', name: 'Mueble negro', category: 'furniture', support: { corners: [[5.1,26],[94.9,26],[99.2,37],[.8,37]], material: 'matte' } },
  { id: 'gaming-desk', name: 'Escritorio', category: 'furniture', support: { corners: [[9.6,16.6],[90.4,16.6],[98.9,34.4],[1.1,34.4]], material: 'wood' } },
  { id: 'tv-cart', name: 'Carrito para TV', category: 'furniture', support: { corners: [[8,10.7],[92,10.7],[97.9,22.7],[2.1,22.7]], material: 'wood' } },
  { id: 'floating-shelf', name: 'Repisa flotante', category: 'furniture', support: { corners: [[8.3,33.4],[91.7,33.4],[97.5,45.6],[2.5,45.6]], material: 'wood' } },
  { id: 'tv-riser', name: 'Base elevada', category: 'furniture', support: { corners: [[7,33.7],[93,33.7],[98.8,50.3],[1.2,50.3]], material: 'wood' } },
  { id: 'sofa', name: 'Sofá', category: 'furniture' },
  { id: 'bed', name: 'Cama', category: 'furniture' },
  { id: 'shelf', name: 'Repisa de juegos', category: 'furniture' },
  { id: 'lamp', name: 'Lámpara de mesa', category: 'lamp' },
  { id: 'rug', name: 'Alfombra', category: 'furniture' },
  { id: 'console', name: 'Consola retro', category: 'game' },
  { id: 'controller', name: 'Mando retro', category: 'game' },
  { id: 'games', name: 'Cajas de videojuegos', category: 'game' },
  { id: 'poster', name: 'Póster de aventura', category: 'poster' },
  { id: 'handheld-purple', name: 'Portátil morada', category: 'game' },
  { id: 'console-cube', name: 'Consola cúbica', category: 'game' },
  { id: 'arcade-stick', name: 'Mando arcade', category: 'game' },
  { id: 'headphones', name: 'Audífonos con base', category: 'game' },
  { id: 'keyboard-retro', name: 'Teclado retro', category: 'game' },
  { id: 'plant-small', name: 'Planta en maceta', category: 'figurine' },
  { id: 'succulent', name: 'Suculenta', category: 'figurine' },
  { id: 'figure-knight', name: 'Figura caballero', category: 'figurine' },
  { id: 'figure-dragon', name: 'Figura dragoncito', category: 'figurine' },
  { id: 'wall-clock', name: 'Reloj de pared', category: 'frame' },
  { id: 'beanbag', name: 'Puff de tela', category: 'furniture' },
  { id: 'side-table', name: 'Mesa auxiliar', category: 'furniture', support: { corners: [[11.5,17],[88.5,17],[98.3,43.8],[1.7,43.8]], material: 'wood' } },
];
export const roomIds = new Set(rooms.map(r => r.id));
// Accepted only for loading/migrating older shared saves, never shown as rooms.
export const legacyRoomIds = new Set(['bedroom', 'retro', 'rain', 'rain-close', 'japanese', 'cabin', 'city']);
export const propIds = new Set(props.map(p => p.id));
export function builtinUrl(id) { return propIds.has(id) ? `/rooms/props/${id}.webp` : ''; }
export function visibleInRoom(item, presentation) {
  return !item.roomKit || item.roomKit === presentation?.environment || (roomIds.has(item.roomKit) && roomIds.has(presentation?.environment));
}
