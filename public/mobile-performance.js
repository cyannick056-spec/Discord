const params = new URLSearchParams(location.search);
const previewMode = params.has('editorPreview');
const coarsePointer = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;

if (!globalThis.__shisMobilePerformanceInstalled && (coarsePointer || previewMode)) {
  globalThis.__shisMobilePerformanceInstalled = true;
  document.documentElement.classList.add('shis-mobile-lite');
  if (previewMode) document.documentElement.classList.add('shis-editor-preview-lite');

  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport && !viewport.content.includes('interactive-widget=')) {
    viewport.content += ', interactive-widget=overlays-content';
  }

  // SHIS room lighting normally samples at 8 fps (125 ms). On phones that is
  // one of the largest CPU/GPU costs because several full-scene canvases are
  // repainted. Keep the visual response, but lower only that exact high-rate
  // timer. Editor previews are allowed to be even cheaper.
  const nativeSetInterval = window.setInterval.bind(window);
  window.setInterval = (handler, delay, ...args) => {
    let next = delay;
    if (coarsePointer && typeof delay === 'number' && delay >= 120 && delay <= 130) {
      next = previewMode ? 300 : 200;
    }
    return nativeSetInterval(handler, next, ...args);
  };

  const style = document.createElement('style');
  style.id = 'shis-mobile-performance';
  style.textContent = `
    html.shis-mobile-lite, html.shis-mobile-lite body {
      overscroll-behavior: none !important;
    }
    html.shis-mobile-lite * {
      -webkit-tap-highlight-color: transparent;
    }
    html.shis-mobile-lite .noise {
      animation-duration: .42s !important;
    }
    html.shis-mobile-lite .decor-editor,
    html.shis-mobile-lite .editor-body,
    html.shis-mobile-lite .editor-sidebar,
    html.shis-mobile-lite .studio-scroll,
    html.shis-mobile-lite .preview-frame {
      overscroll-behavior: contain !important;
    }
    html.shis-mobile-lite .decor-editor *,
    html.shis-mobile-lite .studio-scroll * {
      scroll-behavior: auto !important;
    }
    html.shis-mobile-lite .studio-object-row,
    html.shis-mobile-lite .studio-section,
    html.shis-mobile-lite .studio-room-gallery > * {
      contain: layout paint style;
    }
    html.shis-mobile-lite .studio-object-row img,
    html.shis-mobile-lite .studio-room-gallery img {
      content-visibility: auto;
    }
    html.shis-editor-open,
    html.shis-editor-open body,
    html.shis-editor-open #app,
    html.shis-editor-open #stage {
      width: var(--shis-editor-width, 100vw) !important;
      height: var(--shis-editor-height, 100vh) !important;
      min-height: var(--shis-editor-height, 100vh) !important;
      max-height: var(--shis-editor-height, 100vh) !important;
      overflow: hidden !important;
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
    }
    /* The hidden room used to keep doing its full lighting pass behind the
       editor. display:none makes its bounds zero, so the lighting loop exits
       immediately while the iframe preview is open. */
    html.shis-editor-open .stage.editing-decoration > .room-scene {
      display: none !important;
    }
    html.shis-editor-open .stage.editing-decoration > .scene-controls,
    html.shis-editor-open .stage.editing-decoration > .compact-edit-notice,
    html.shis-editor-open .stage.editing-decoration > .media-notice {
      visibility: hidden !important;
      pointer-events: none !important;
    }
    html.shis-editor-preview-lite .noise,
    html.shis-editor-preview-lite .signal-sweep,
    html.shis-editor-preview-lite .lamp-animation,
    html.shis-editor-preview-lite .lamp-animation * {
      animation: none !important;
    }
    html.shis-editor-preview-lite #stage {
      touch-action: none !important;
      overscroll-behavior: none !important;
    }
    @media (pointer: coarse) {
      html.shis-editor-open #decorEditor * {
        transition-duration: 0s !important;
      }
      html.shis-editor-open .editor-sidebar,
      html.shis-editor-open .studio-scroll {
        backdrop-filter: none !important;
      }
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

  function shrinkNoiseCanvases() {
    const width = previewMode ? 48 : 128;
    const height = Math.round(width * 9 / 16);
    for (const id of ['staticNoise', 'signalSweep']) {
      const canvas = document.getElementById(id);
      if (canvas instanceof HTMLCanvasElement && (canvas.width > width || canvas.height > height)) {
        canvas.width = width;
        canvas.height = height;
      }
    }
  }

  function installPreviewPinch() {
    if (!previewMode || !coarsePointer) return;
    const stage = document.getElementById('stage');
    if (!stage || stage.dataset.shisPinchInstalled) return;
    stage.dataset.shisPinchInstalled = '1';
    const pointers = new Map();
    let pinch = null;
    let swallow = false;

    const pair = () => {
      const p = [...pointers.values()].slice(0, 2);
      if (p.length < 2) return null;
      const [a, b] = p;
      return {
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
        distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      };
    };

    stage.addEventListener('pointerdown', event => {
      if (event.pointerType !== 'touch') return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size !== 2 || pinch) return;
      pinch = pair();
      if (!pinch) return;
      swallow = true;
      event.preventDefault();
      event.stopImmediatePropagation();
      parent.postMessage({ type: 'decor-zoom-start', x: pinch.x, y: pinch.y }, location.origin);
    }, true);

    stage.addEventListener('pointermove', event => {
      if (event.pointerType !== 'touch' || !pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (!pinch || pointers.size < 2) {
        if (swallow) { event.preventDefault(); event.stopImmediatePropagation(); }
        return;
      }
      const next = pair();
      if (!next) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      parent.postMessage({
        type: 'decor-zoom-move',
        ratio: Math.pow(next.distance / pinch.distance, .88),
        dx: next.x - pinch.x,
        dy: next.y - pinch.y,
      }, location.origin);
    }, true);

    const release = event => {
      if (event.pointerType !== 'touch' || !pointers.has(event.pointerId)) return;
      pointers.delete(event.pointerId);
      if (pinch && pointers.size < 2) {
        pinch = null;
        event.preventDefault();
        event.stopImmediatePropagation();
        parent.postMessage({ type: 'decor-gesture-end' }, location.origin);
      } else if (swallow) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      if (pointers.size === 0) swallow = false;
    };
    stage.addEventListener('pointerup', release, true);
    stage.addEventListener('pointercancel', release, true);
  }

  function installEditorOptimizations() {
    if (previewMode) { shrinkNoiseCanvases(); installPreviewPinch(); return; }
    const editor = document.getElementById('decorEditor');
    if (!editor || editor.dataset.shisPerformanceInstalled) return;
    editor.dataset.shisPerformanceInstalled = '1';
    let lockedWidth = innerWidth;
    let lockedHeight = innerHeight;
    let directTarget = null;
    let directUntil = 0;
    let replayingInput = false;
    const pendingInputs = new Map();
    const cadence = coarsePointer ? 50 : 24;

    const editable = target => target instanceof HTMLInputElement &&
      ['text', 'number', 'password', 'url', 'email', 'search', 'tel'].includes(target.type) ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLElement && target.isContentEditable;

    const visible = () => !editor.hasAttribute('hidden');
    const lockViewport = () => {
      if (!visible()) {
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
    };

    document.addEventListener('pointerdown', event => {
      if (!visible()) return;
      const node = event.target instanceof HTMLElement ? event.target : null;
      const field = node?.closest('input, textarea, [contenteditable="true"]');
      directTarget = field || (node?.closest('label')?.control ?? null);
      directUntil = performance.now() + 1200;
    }, true);

    document.addEventListener('focusin', event => {
      if (!visible() || !editable(event.target)) return;
      const target = event.target;
      if (target === directTarget && performance.now() < directUntil) return;
      requestAnimationFrame(() => {
        if (document.activeElement === target) target.blur();
        scrollTo(0, 0);
      });
    }, true);

    document.addEventListener('input', event => {
      if (replayingInput || !visible()) return;
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || target.type !== 'range' || !target.closest('#decorEditor')) return;
      event.stopImmediatePropagation();
      if (pendingInputs.has(target)) return;
      const timer = setTimeout(() => {
        pendingInputs.delete(target);
        replayingInput = true;
        target.dispatchEvent(new Event('input', { bubbles: true }));
        replayingInput = false;
      }, cadence);
      pendingInputs.set(target, timer);
    }, true);

    window.addEventListener('resize', event => {
      if (!visible()) return;
      const widthDelta = Math.abs(innerWidth - lockedWidth);
      const heightLoss = lockedHeight - innerHeight;
      if (editable(document.activeElement) && widthDelta < 48 && heightLoss > 100) {
        event.stopImmediatePropagation();
        scrollTo(0, 0);
        return;
      }
      lockedWidth = innerWidth;
      lockedHeight = innerHeight;
      document.documentElement.style.setProperty('--shis-editor-width', `${lockedWidth}px`);
      document.documentElement.style.setProperty('--shis-editor-height', `${lockedHeight}px`);
    }, true);

    new MutationObserver(lockViewport).observe(editor, { attributes: true, attributeFilter: ['hidden'] });
    lockViewport();
    shrinkNoiseCanvases();
  }

  const boot = () => {
    shrinkNoiseCanvases();
    installEditorOptimizations();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  new MutationObserver(() => {
    shrinkNoiseCanvases();
    installEditorOptimizations();
  }).observe(document.documentElement, { childList: true, subtree: true });
}
