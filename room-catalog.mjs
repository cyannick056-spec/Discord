// Public, allowlisted photographic assets; never resolve user-supplied paths.
export const rooms = [
  { id: 'bedroom', name: 'Dormitorio', description: 'Madera, azul suave y juegos', furniture: 'bed' },
  { id: 'retro', name: 'Sala retro', description: 'Una tarde de juegos de los 90', furniture: 'sofa' },
  { id: 'rain', name: 'Habitación con lluvia', description: 'Ventana lateral con lluvia animada', furniture: 'sofa' },
  { id: 'japanese', name: 'Cuarto japonés', description: 'Shoji, tatami y muebles bajos', furniture: 'shelf' },
  { id: 'cabin', name: 'Cabaña', description: 'Madera y una ventana al bosque', furniture: 'shelf' },
  { id: 'city', name: 'Apartamento', description: 'Una ventana hacia la ciudad', furniture: 'sofa' },
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
];
export const roomIds = new Set(rooms.map(r => r.id));
export const propIds = new Set(props.map(p => p.id));
export function builtinUrl(id) { return propIds.has(id) ? `/rooms/props/${id}.webp` : ''; }
export function visibleInRoom(item, presentation) {
  return !item.roomKit || item.roomKit === presentation?.environment;
}
