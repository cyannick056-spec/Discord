// Percentages refer to the full uncropped photographic asset.
export const tvModels = [
  { id: 'original', name: 'CRT original', asset: '' },
  { id: 'silver', name: 'CRT plateada', asset: '' },
  { id: 'charcoal', name: 'CRT carbón', asset: '' },
  { id: 'projection', name: 'Gigante · retroproyección 2000', asset: '/tvs/projection.webp', ratio: 1227 / 1282, bounds: [6.9, 4.3, 86.2, 91.6], glass: [12.5, 8, 75, 50.5], floor: true },
  { id: 'crt-silver2000', name: 'CRT 2002 · estéreo plateada', asset: '/tvs/crt-silver2000.webp', ratio: 1.5, bounds: [5.1, 2.5, 89.9, 94.6], glass: [21.5, 14.5, 57, 61.5] },
  { id: 'crt-champagne', name: 'CRT 2000 · champagne curva', asset: '/tvs/crt-champagne.webp', ratio: 1.5, bounds: [6.3, 3.5, 86.6, 92.8], glass: [16.2, 15.5, 57, 59.5] },
  { id: 'crt-black2000', name: 'CRT 2004 · negra de vidrio plano', asset: '/tvs/crt-black2000.webp', ratio: 1401 / 1123, bounds: [5.9, 3.1, 88.3, 93.6], glass: [16.3, 16.2, 67.1, 57.2] },
  { id: 'lcd2005', name: 'LCD 2005 · plateada', asset: '/tvs/lcd2005.webp', ratio: 1.5, bounds: [4.7, 3.6, 91, 83.2], glass: [13.6, 11.5, 73.4, 59.8] },
  { id: 'flat-modern', name: 'Pantalla plana · marco fino', asset: '/tvs/flat-modern.webp', ratio: 1672 / 941, bounds: [4.9, 4.8, 90.2, 81.8], glass: [5.8, 6.4, 88.4, 78] },
];
export const tvIds = new Set(tvModels.map(t => t.id));
