const SHIS_UPLOAD_MAX_BYTES = 8 * 1024 * 1024;
const SHIS_LEGACY_CLIENT_GUARD_BYTES = 2 * 1024 * 1024;

const nativeBlobSize = Object.getOwnPropertyDescriptor(Blob.prototype, 'size')?.get;

function realSize(file) {
  if (!nativeBlobSize) return file.size;
  return nativeBlobSize.call(file);
}

function updateFigurePicker() {
  const input = document.querySelector('#editorUpload');
  if (!(input instanceof HTMLInputElement)) return;
  input.accept = 'image/png,image/gif';
  const label = input.closest('label');
  if (label) {
    for (const node of label.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        node.textContent = 'Añadir figurita PNG/GIF · máx. 8 MB';
        break;
      }
    }
  }
}

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
