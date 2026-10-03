const params = new URLSearchParams(location.search);
const previewMode = params.has('editorPreview');
const coarsePointer = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;

const viewportMeta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
if (viewportMeta && !viewportMeta.content.includes('interactive-widget=')) {
  viewportMeta.content += ', interactive-widget=overlays-content';
}

const style = document.createElement('style');
style.id = 'shis-editor-performance';
style.textContent = `
html.shis-editor-open,
html.shis-editor-open body,
html.shis-editor-open #app,
html.shis-editor-open #stage {
  width: var(--shis-editor-width, 100vw) !important;
  height: var(--shis-editor-height, 100vh) !important;
  min-height: var(--shis-editor-height, 100vh) !important;
  max-height: var(--shis-editor-height, 100vh) !important;
  overflow: hidden !important;
  overscroll-behavior: none !important;
}
html.shis-editor-open #decorEditor {
  position: fixed !important;
  inset: 0 auto auto 0 !important;
  width: var(--shis-editor-width, 100vw) !important;
  height: var(--shis-editor-height, 100vh) !important;
  max-width: none !important;
  max-height: none !important;
  contain: layout paint style;
  overscroll-behavior: contain;
  transform: translateZ(0);
}
html.shis-editor-open .stage.editing-decoration > .room-scene,
html.shis-editor-open .stage.editing-decoration > .scene-controls,
html.shis-editor-open .stage.editing-decoration > .compact-edit-notice,
html.shis-editor-open .stage.editing-decoration > .media-notice {
  visibility: hidden !important;
  pointer-events: none !important;
}
html.shis-editor-preview-lite .noise,
html.shis-editor-preview-lite .signal-sweep {
  animation: none !important;
}
html.shis-editor-preview-lite * {
  scroll-behavior: auto !important;
}
`;
document.head.append(style);

if (previewMode) {
  document.documentElement.classList.add('shis-editor-preview-lite');
  // The preview used to run the same 320x180 static-noise canvas as the real
  // scene. On phones this burns CPU even though it is only an editor preview.
  // Keep the effect, but render it at a much cheaper internal resolution.
  const width = coarsePointer ? 80 : 160;
  const height = Math.round(width * 9 / 16);
  for (const id of ['staticNoise', 'signalSweep']) {
    const canvas = document.getElementById(id) as HTMLCanvasElement | null;
    if (canvas) { canvas.width = width; canvas.height = height; }
  }
} else {
  let editorOpen = false;
  let lockedWidth = innerWidth;
  let lockedHeight = innerHeight;
  let directFocusTarget: HTMLElement | null = null;
  let directFocusUntil = 0;
  let allowEditorFocusUntil = 0;
  let replayingInput = false;
  let replayingMessage = false;
  const queuedInputs = new Map<HTMLInputElement, number>();
  const queuedMessages = new Map<string, { event: MessageEvent; timer: number }>();
  const interval = coarsePointer ? 34 : 18;

  const editable = (element: Element | null) => element instanceof HTMLInputElement &&
    ['text', 'number', 'password', 'url', 'email', 'search', 'tel'].includes(element.type) ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLElement && element.isContentEditable;

  const editorVisible = () => {
    const editor = document.getElementById('decorEditor');
    return Boolean(editor && !editor.hasAttribute('hidden'));
  };

  function lockEditorViewport() {
    editorOpen = editorVisible();
    if (!editorOpen) {
      document.documentElement.classList.remove('shis-editor-open');
      document.documentElement.style.removeProperty('--shis-editor-width');
      document.documentElement.style.removeProperty('--shis-editor-height');
      return;
    }
    lockedWidth = innerWidth;
    lockedHeight = innerHeight;
    document.documentElement.style.setProperty('--shis-editor-width', `${lockedWidth}px`);
    document.documentElement.style.setProperty('--shis-editor-height', `${lockedHeight}px`);
    document.documentElement.classList.add('shis-editor-open');
    scrollTo(0, 0);
  }

  function directTarget(event: PointerEvent) {
    const node = event.target instanceof HTMLElement ? event.target : null;
    if (!node) return null;
    const field = node.closest<HTMLElement>('input, textarea, [contenteditable="true"]');
    if (field) return field;
    const label = node.closest<HTMLLabelElement>('label');
    return label?.control instanceof HTMLElement ? label.control : null;
  }

  document.addEventListener('pointerdown', event => {
    const field = directTarget(event);
    directFocusTarget = field;
    directFocusUntil = performance.now() + 1200;
  }, true);

  // Do not let programmatic focus summon Android's keyboard. A text/number
  // keyboard is allowed only after the user directly touches that field (or a
  // deliberate rename action inside the preview).
  document.addEventListener('focusin', event => {
    if (!editorVisible() || !editable(event.target as Element)) return;
    const target = event.target as HTMLElement;
    const allowed = (directFocusTarget === target && performance.now() < directFocusUntil) ||
      performance.now() < allowEditorFocusUntil;
    if (allowed) return;
    requestAnimationFrame(() => {
      if (document.activeElement === target) target.blur();
      scrollTo(0, 0);
    });
  }, true);

  // Range sliders can fire much faster than the preview can redraw. Keep only
  // the latest value and deliver at a phone-friendly cadence.
  document.addEventListener('input', event => {
    if (replayingInput || !editorVisible()) return;
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.type !== 'range' || !target.closest('#decorEditor')) return;
    event.stopImmediatePropagation();
    if (queuedInputs.has(target)) return;
    const timer = window.setTimeout(() => {
      queuedInputs.delete(target);
      replayingInput = true;
      target.dispatchEvent(new Event('input', { bubbles: true }));
      replayingInput = false;
    }, interval);
    queuedInputs.set(target, timer);
  }, true);

  const highFrequencyMessages = new Set(['decor-change', 'presentation-change', 'decor-pan-move', 'decor-zoom-move']);
  function flushMessage(type: string) {
    const queued = queuedMessages.get(type);
    if (!queued) return;
    clearTimeout(queued.timer);
    queuedMessages.delete(type);
    replayingMessage = true;
    window.dispatchEvent(new MessageEvent('message', {
      data: queued.event.data,
      origin: queued.event.origin,
      source: queued.event.source,
      ports: [...queued.event.ports],
    }));
    replayingMessage = false;
  }
  function flushMessages() { for (const type of [...queuedMessages.keys()]) flushMessage(type); }

  window.addEventListener('message', event => {
    if (replayingMessage || !editorVisible()) return;
    const type = typeof event.data?.type === 'string' ? event.data.type : '';
    if (type === 'decor-rename') allowEditorFocusUntil = performance.now() + 1200;
    if (!highFrequencyMessages.has(type)) {
      if (type === 'decor-gesture-end' || type === 'decor-key-end' || type === 'decor-select') flushMessages();
      return;
    }
    event.stopImmediatePropagation();
    const previous = queuedMessages.get(type);
    if (previous) clearTimeout(previous.timer);
    const snapshot = event;
    const timer = window.setTimeout(() => flushMessage(type), interval);
    queuedMessages.set(type, { event: snapshot, timer });
  }, true);

  // Android WebView often emits a window resize while only the soft keyboard
  // changed the visual viewport. Decorations used that event to rebuild the
  // scene and iframe, which caused both lag and visible jumping.
  window.addEventListener('resize', event => {
    if (!editorOpen) return;
    const widthDelta = Math.abs(innerWidth - lockedWidth);
    const heightLoss = lockedHeight - innerHeight;
    const keyboardResize = editable(document.activeElement) && widthDelta < 48 && heightLoss > 100;
    if (keyboardResize) {
      event.stopImmediatePropagation();
      scrollTo(0, 0);
      return;
    }
    lockedWidth = innerWidth;
    lockedHeight = innerHeight;
    document.documentElement.style.setProperty('--shis-editor-width', `${lockedWidth}px`);
    document.documentElement.style.setProperty('--shis-editor-height', `${lockedHeight}px`);
  }, true);

  window.visualViewport?.addEventListener('resize', () => {
    if (editorOpen && editable(document.activeElement)) scrollTo(0, 0);
  }, { passive: true });
  window.visualViewport?.addEventListener('scroll', () => {
    if (editorOpen && editable(document.activeElement)) scrollTo(0, 0);
  }, { passive: true });

  const installObserver = () => {
    const editor = document.getElementById('decorEditor');
    if (!editor) return;
    new MutationObserver(lockEditorViewport).observe(editor, { attributes: true, attributeFilter: ['hidden'] });
    lockEditorViewport();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installObserver, { once: true });
  else installObserver();
}
