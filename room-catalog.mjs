// Fondos fotográficos disponibles. Cambiar de fondo no debe crear, borrar ni mover objetos.
export const rooms = [
  { id: 'cozy-night', name: 'Rincón nocturno', description: 'Azul petróleo, lavanda y luz suave' },
  { id: 'midnight-den', name: 'Madrugada clásica', description: 'Pared azul oscura y profundidad nocturna' },
  { id: 'walnut-den', name: 'Noche de nogal', description: 'Paneles de madera y ambiente cálido' },
  { id: 'violet-den', name: 'Rincón violeta', description: 'Nicho malva y ambiente suave' },
];

// Catálogo integrado actual: únicamente muebles y superficies de apoyo.
// Las figuritas e imágenes personales se añaden mediante el editor y nunca se sustituyen al cambiar de fondo.
export const props = [
  { id: 'cabinet', name: 'Mueble de TV', category: 'furniture', support: { corners: [[6.6,18],[93.4,18],[98.4,28],[1.6,28]], material: 'wood' } },
  { id: 'cabinet-black', name: 'Mueble negro', category: 'furniture', support: { corners: [[5.1,26],[94.9,26],[99.2,37],[.8,37]], material: 'matte' } },
  { id: 'gaming-desk', name: 'Escritorio', category: 'furniture', support: { corners: [[9.6,16.6],[90.4,16.6],[98.9,34.4],[1.1,34.4]], material: 'wood' } },
  { id: 'tv-cart', name: 'Carrito para TV', category: 'furniture', support: { corners: [[8,10.7],[92,10.7],[97.9,22.7],[2.1,22.7]], material: 'wood' } },
  { id: 'floating-shelf', name: 'Repisa flotante', category: 'furniture', support: { corners: [[8.3,33.4],[91.7,33.4],[97.5,45.6],[2.5,45.6]], material: 'wood' } },
  { id: 'tv-riser', name: 'Base elevada', category: 'furniture', support: { corners: [[7,33.7],[93,33.7],[98.8,50.3],[1.2,50.3]], material: 'wood' } },
  { id: 'sofa', name: 'Sofá', category: 'furniture' },
  { id: 'bed', name: 'Cama', category: 'furniture' },
  { id: 'shelf', name: 'Repisa de juegos', category: 'furniture' },
  { id: 'rug', name: 'Alfombra', category: 'furniture' },
  { id: 'beanbag', name: 'Puff de tela', category: 'furniture' },
  { id: 'side-table', name: 'Mesa auxiliar', category: 'furniture', support: { corners: [[11.5,17],[88.5,17],[98.3,43.8],[1.7,43.8]], material: 'wood' } },
];

export const roomIds = new Set(rooms.map(r => r.id));
// Solo se aceptan para leer datos antiguos durante la migración; nunca se muestran como fondos actuales.
export const legacyRoomIds = new Set(['morning', 'night', 'bedroom', 'retro', 'rain', 'rain-close', 'japanese', 'cabin', 'city']);
export const propIds = new Set(props.map(p => p.id));
export function builtinUrl(id) { return propIds.has(id) ? `/rooms/props/${id}.webp` : ''; }

// Los objetos pertenecen a la vista, no al fondo. Cambiar de escenario debe conservarlos todos.
export function visibleInRoom() { return true; }

// Studio se construye dinámicamente. Ajusta las etiquetas al modelo actual sin acoplar la lógica del editor al catálogo.
function installCurrentCatalogLabels() {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;
  const apply = () => {
    const scene = document.getElementById('studioBackground');
    const catalog = document.getElementById('studioFurnitureTypes');
    if (scene) {
      const summary = scene.querySelector('summary');
      if (summary) summary.textContent = 'Fondos de escena';
      const notes = scene.querySelectorAll('.studio-note');
      if (notes[0]) notes[0].textContent = 'Cambiar el fondo conserva la TV, los muebles, tus figuritas, el filtro, las luces y el encuadre de esta vista.';
      if (notes[1]) notes[1].textContent = 'Los fondos solo cambian la imagen del entorno. Todo lo demás se edita por separado.';
    }
    if (catalog) {
      const summary = catalog.querySelector('summary');
      if (summary) summary.textContent = 'Catálogo · muebles';
      const note = catalog.querySelector('.studio-note');
      if (note) note.textContent = 'Añade muebles y superficies de apoyo. Tus imágenes y figuritas personales se conservan aparte.';
    }
    const lamps = document.getElementById('studioLampTypes');
    if (lamps) lamps.hidden = true;
    return Boolean(scene && catalog);
  };
  const start = () => {
    const observer = new MutationObserver(() => { if (apply()) observer.disconnect(); });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    if (apply()) observer.disconnect();
  };
  if (document.documentElement) start(); else addEventListener('DOMContentLoaded', start, { once: true });
}
installCurrentCatalogLabels();
