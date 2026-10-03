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
html.shis-editor-preview-lite #stage {
  touch-action: none !important;
  overscroll-behavior: none !important;
}
@media (pointer: coarse) {
  html.shis-editor-open .preview-zoom {
    gap: 8px !important;
    padding: 6px !important;
    border-radius: 14px !important;
    bottom: max(12px, env(safe-area-inset-bottom)) !important;
    right: 12px !important;
    touch-action: manipulation;
  }
  html.shis-editor-open .preview-zoom button {
    min-width: 50px !important;
    min-height: 48px !important;
    padding: 0 12px !important;
    font-size: 18px !important;
    border-radius: 11px !important;
    touch-action: manipulation;
  }
  html.shis-editor-open #previewZoomReset {
    min-width: 72px !important;
    font-size: 15px !important;
  }
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

  // Mobile gesture layer. The old touch path could start dragging a figurine
  // with the first finger before the second finger arrived for pinch zoom.
  // Pointer capture here lets two fingers own the viewport gesture completely:
  // pinch zooms around the midpoint and moving both fingers pans the preview.
  // After a pinch, the remaining finger is swallowed until every finger lifts,
  // preventing the common "jump" where an object suddenly moves.
  const installMobilePinch = () => {
    if (!coarsePointer) return;
    const stage = document.getElementById('stage');
    if (!stage) return;
    const pointers = new Map<number, { x: number; y: number }>();
    let pinch: { distance: number; midX: number; midY: number } | null = null;
    let swallowUntilClear = false;

    const pair = () => {
      const points = [...pointers.values()].slice(0, 2);
      if (points.length < 2) return null;
      const [a, b] = points;
      return {
        midX: (a.x + b.x) / 2,
        midY: (a.y + b.y) / 2,
        distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      };
    };

    stage.addEventListener('pointerdown', event => {
      if (event.pointerType !== 'touch') return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size !== 2 || pinch) return;
      const point = pair();
      if (!point) return;
      pinch = point;
      swallowUntilClear = true;
      event.preventDefault();
      event.stopImmediatePropagation();
      parent.postMessage({ type: 'decor-zoom-start', x: point.midX, y: point.midY }, location.origin);
    }, true);

    stage.addEventListener('pointermove', event => {
      if (event.pointerType !== 'touch' || !pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pinch && pointers.size >= 2) {
        const point = pair();
        if (!point) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        // Slight damping makes small finger movements easier to control.
        const ratio = Math.pow(point.distance / pinch.distance, 0.88);
        parent.postMessage({
          type: 'decor-zoom-move', ratio,
          dx: point.midX - pinch.midX, dy: point.midY - pinch.midY,
        }, location.origin);
        return;
      }
      if (swallowUntilClear) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);

    const release = (event: PointerEvent) => {
      if (event.pointerType !== 'touch' || !pointers.has(event.pointerId)) return;
      pointers.delete(event.pointerId);
      if (pinch && pointers.size < 2) {
        pinch = null;
        event.preventDefault();
        event.stopImmediatePropagation();
        parent.postMessage({ type: 'decor-gesture-end' }, location.origin);
      } else if (swallowUntilClear) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      if (pointers.size === 0) swallowUntilClear = false;
    };
    stage.addEventListener('pointerup', release, true);
    stage.addEventListener('pointercancel', release, true);

    // Suppress the older TouchEvent pinch implementation only while the new
    // two-finger viewport gesture owns the interaction. One-finger editing is
    // left alone so figurines still drag normally.
    const suppressLegacyTouch = (event: TouchEvent) => {
      if (!pinch && !swallowUntilClear && event.touches.length < 2) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    stage.addEventListener('touchstart', suppressLegacyTouch, { capture: true, passive: false });
    stage.addEventListener('touchmove', suppressLegacyTouch, { capture: true, passive: false });
    stage.addEventListener('touchend', suppressLegacyTouch, { capture: true, passive: false });
    stage.addEventListener('touchcancel', suppressLegacyTouch, { capture: true, passive: false });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installMobilePinch, { once: true });
  else installMobilePinch();
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

  // On phones the old +/- buttons jumped by 40% each press. Intercept only
  // those two buttons and translate the tap into a small centered wheel zoom;
  // the existing zoom state and 100% reset button remain the source of truth.
  const installMobileZoomButtons = () => {
    if (!coarsePointer) return;
    const frame = document.getElementById('previewFrame');
    const minus = document.getElementById('previewZoomOut');
    const plus = document.getElementById('previewZoomIn');
    if (!frame || !minus || !plus) return;
    const bind = (button: HTMLElement, deltaY: number) => button.addEventListener('click', event => {
      if (!editorVisible()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const bounds = frame.getBoundingClientRect();
      frame.dispatchEvent(new WheelEvent('wheel', {
        bubbles: true, cancelable: true, ctrlKey: true, deltaY,
        clientX: bounds.left + bounds.width / 2,
        clientY: bounds.top + bounds.height / 2,
      }));
    }, true);
    bind(minus, 95);
    bind(plus, -95);
  };

  const installObserver = () => {
    const editor = document.getElementById('decorEditor');
    if (!editor) return;
    new MutationObserver(lockEditorViewport).observe(editor, { attributes: true, attributeFilter: ['hidden'] });
    lockEditorViewport();
    installMobileZoomButtons();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installObserver, { once: true });
  else installObserver();
}
