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
];
export const materialIds = new Set(materials.map(m => m.id));
export const MAX_SCENE_ITEMS = 500;
export const MAX_LIBRARY_ITEMS = 500;
