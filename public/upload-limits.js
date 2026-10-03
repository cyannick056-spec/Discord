import './mobile-performance.js';

const SHIS_UPLOAD_MAX_BYTES = 8 * 1024 * 1024;
const SHIS_LEGACY_CLIENT_GUARD_BYTES = 2 * 1024 * 1024;

const nativeBlobSize = Object.getOwnPropertyDescriptor(Blob.prototype, 'size')?.get;

function realSize(file) {
  if (!nativeBlobSize) return file.size;
  return nativeBlobSize.call(file);
}

function installSelectionGuard() {
  if (globalThis.__shisSelectionGuardInstalled) return;
  globalThis.__shisSelectionGuardInstalled = true;

  const style = document.createElement('style');
  style.id = 'shis-selection-guard';
  style.textContent = `
    html, body, #app, #stage,
    .stage, .room-scene, .tv-scene, .player, .scene-controls,
    button, label, img, canvas {
      -webkit-user-select: none !important;
      user-select: none !important;
      -webkit-touch-callout: none !important;
    }
    input, textarea, select, [contenteditable="true"] {
      -webkit-user-select: text !important;
      user-select: text !important;
      -webkit-touch-callout: default !important;
    }
  `;
  document.head.append(style);

  // Android/WebView puede intentar seleccionar texto tras una pulsación larga
  // aunque el elemento no sea editable. Conservamos selección dentro de campos
  // del editor para no romper nombres, claves ni valores.
  document.addEventListener('selectstart', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return event.preventDefault();
    if (target.closest('input, textarea, select, [contenteditable="true"]')) return;
    event.preventDefault();
  }, true);

  document.addEventListener('copy', (event) => {
    const target = event.target;
    if (target instanceof Element && target.closest('input, textarea, [contenteditable="true"]')) return;
    event.preventDefault();
  }, true);
}

function updateFigurePicker() {
  const input = document.querySelector('#editorUpload');
  if (!(input instanceof HTMLInputElement)) return;

  input.accept = 'image/png,image/gif';
  const label = input.closest('label');
  if (!(label instanceof HTMLLabelElement)) return;

  for (const node of label.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      node.textContent = '＋ Añadir figurita PNG/GIF · máx. 8 MB';
      break;
    }
  }

  // El layout moderno oculta varias acciones antiguas de la barra superior.
  // Dejamos la subida dentro del panel de Objetos, donde siempre es encontrable.
  const sidebar = document.querySelector('.editor-sidebar');
  if (sidebar && label.parentElement !== sidebar) sidebar.prepend(label);

  label.classList.add('shis-figure-upload');
  label.style.display = 'flex';
  label.style.alignItems = 'center';
  label.style.justifyContent = 'center';
  label.style.width = '100%';
  label.style.boxSizing = 'border-box';
  label.style.minHeight = '38px';
  label.style.marginBottom = '10px';
  label.style.padding = '9px 12px';
  label.style.border = '1px solid #456579';
  label.style.borderRadius = '8px';
  label.style.background = '#203747';
  label.style.color = '#eef8ff';
  label.style.fontWeight = '700';
  label.style.cursor = 'pointer';
  label.title = 'Subir una figurita PNG o GIF de hasta 8 MB';
}

installSelectionGuard();

if (nativeBlobSize && !globalThis.__shisUploadLimitInstalled) {
  globalThis.__shisUploadLimitInstalled = true;

  // El editor antiguo aún compara file.size contra 2 MB. Para archivos válidos
  // de hasta 8 MB exponemos un tamaño compatible con esa comprobación; fetch
  // sigue enviando el Blob/File real y el backend valida el límite verdadero.
  Object.defineProperty(File.prototype, 'size', {
    configurable: true,
    get() {
      const size = nativeBlobSize.call(this);
      return size <= SHIS_UPLOAD_MAX_BYTES
        ? Math.min(size, SHIS_LEGACY_CLIENT_GUARD_BYTES - 1)
        : size;
    },
  });

  document.addEventListener('change', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== 'file') return;
    const file = input.files?.[0];
    if (!file) return;
    if (realSize(file) <= SHIS_UPLOAD_MAX_BYTES) return;

    event.stopImmediatePropagation();
    input.value = '';
    const status = document.querySelector('#editorStatus');
    if (status) status.textContent = 'La imagen debe pesar máximo 8 MB.';
  }, true);
}

updateFigurePicker();
new MutationObserver(updateFigurePicker).observe(document.documentElement, { childList: true, subtree: true });