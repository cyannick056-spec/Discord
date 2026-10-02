// Shared allowlist: material texture URLs are never supplied by a manifest.
export const materials = [
  { id: 'original', name: 'Material original', tint: '#ffffff', finish: 'wood' },
  { id: 'oak', name: 'Roble claro', texture: 'oak', tint: '#ffffff', finish: 'wood' },
  { id: 'walnut', name: 'Nogal oscuro', texture: 'oak', tint: '#805535', finish: 'wood' },
  { id: 'mahogany', name: 'Caoba', texture: 'oak', tint: '#ad6247', finish: 'wood' },
  { id: 'white', name: 'Lacado blanco', tint: '#eeeae4', finish: 'satin' },
  { id: 'black', name: 'Negro mate', tint: '#30343b', finish: 'matte' },
  { id: 'pink', name: 'Lacado rosa', tint: '#e7aec9', finish: 'satin' },
  { id: 'steel', name: 'Acero cepillado', texture: 'steel', tint: '#ffffff', finish: 'metal' },
  { id: 'marble', name: 'Mármol claro', texture: 'marble', tint: '#ffffff', finish: 'stone' },
  { id: 'concrete', name: 'Piedra gris', texture: 'marble', tint: '#8b9094', finish: 'matte' },
  { id: 'whitewashed', name: 'Madera blanqueada', texture: 'oak', tint: '#e6ded0', finish: 'wood' },
  { id: 'cherry', name: 'Cerezo cálido', texture: 'oak', tint: '#b87a58', finish: 'wood' },
  { id: 'black-ash', name: 'Fresno negro', texture: 'oak', tint: '#484544', finish: 'wood' },
  { id: 'cement', name: 'Cemento fino', texture: 'cement', tint: '#aaa69f', finish: 'matte' },
  { id: 'slate', name: 'Piedra oscura', texture: 'slate', tint: '#59616a', finish: 'stone' },
  { id: 'copper', name: 'Cobre cepillado', texture: 'steel', tint: '#cb9676', finish: 'metal' },
  { id: 'brass', name: 'Latón suave', texture: 'steel', tint: '#c7af7b', finish: 'metal' },
  { id: 'linen', name: 'Lino tejido', texture: 'linen', tint: '#d3c8b5', finish: 'matte' },
  { id: 'petrol', name: 'Lacado azul petróleo', tint: '#527d86', finish: 'satin' },
  { id: 'sage', name: 'Lacado verde salvia', tint: '#a5b7a0', finish: 'satin' },
  { id: 'lavender', name: 'Lacado lavanda', tint: '#b7a6cb', finish: 'satin' },
];
export const furnitureColors = [
  { name:'Crema', color:'#ece2cc' }, { name:'Café', color:'#946c50' },
  { name:'Azul petróleo', color:'#527d86' }, { name:'Verde salvia', color:'#a5b7a0' },
  { name:'Lavanda', color:'#b7a6cb' }, { name:'Rosa empolvado', color:'#d4a1ad' },
  { name:'Gris cálido', color:'#aaa69f' }, { name:'Carbón', color:'#464b52' },
];
export const materialIds = new Set(materials.map(m => m.id));
export const MAX_SCENE_ITEMS = 500;
export const MAX_LIBRARY_ITEMS = 500;
