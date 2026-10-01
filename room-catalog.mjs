// Public, allowlisted photographic assets; never resolve user-supplied paths.
export const rooms = [
  { id: 'bedroom', name: 'Dormitorio', description: 'Madera, azul suave y juegos', furniture: 'bed' },
  { id: 'retro', name: 'Sala retro', description: 'Una tarde de juegos de los 90', furniture: 'sofa' },
  { id: 'rain', name: 'Habitación con lluvia', description: 'Ventana lluviosa y luz tranquila', furniture: 'sofa' },
  { id: 'japanese', name: 'Cuarto japonés', description: 'Shoji, tatami y muebles bajos', furniture: 'shelf' },
  { id: 'cabin', name: 'Cabaña', description: 'Madera y una ventana al bosque', furniture: 'shelf' },
  { id: 'city', name: 'Apartamento', description: 'Una ventana hacia la ciudad', furniture: 'sofa' },
];
export const props = [
  { id: 'cabinet', name: 'Mueble de TV', category: 'furniture' },
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
