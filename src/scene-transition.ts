// Keep the last complete scene visible while its replacement loads. The copy
// lives in a shadow tree, so it cannot enter player, lighting or editor queries.
let cover: HTMLElement | undefined;
let revision = 0;
export function sceneTransitionActive() { return Boolean(cover) || document.querySelector('#stage')!.classList.contains('scene-unready'); }
export function beginSceneTransition() {
  const token = ++revision;
  const stage = document.querySelector<HTMLElement>('#stage')!;
  if (cover || stage.classList.contains('scene-unready')) return token;
  const bounds = stage.getBoundingClientRect();
  const source = stage.querySelector<HTMLElement>('.room-scene')!;
  const copy = source.cloneNode(true) as HTMLElement;
  const originals = source.querySelectorAll('canvas,video,iframe');
  const copies = copy.querySelectorAll('canvas,video,iframe');
  originals.forEach((original, index) => {
    const target = copies[index];
    if (original instanceof HTMLCanvasElement && target instanceof HTMLCanvasElement) {
      target.getContext('2d')?.drawImage(original, 0, 0);
    } else if (original instanceof HTMLVideoElement) {
      const frame = document.createElement('canvas'), style = getComputedStyle(original);
      frame.width = original.videoWidth || original.clientWidth;
      frame.height = original.videoHeight || original.clientHeight;
      for (const key of style) frame.style.setProperty(key, style.getPropertyValue(key));
      try { if (original.readyState >= 2) frame.getContext('2d')?.drawImage(original, 0, 0); } catch { /* Protected video stays dark during the swap. */ }
      target.replaceWith(frame);
    } else if (original instanceof HTMLIFrameElement) {
      // Never instantiate a second media player just to hold a scene frame.
      const placeholder = document.createElement('div'); placeholder.style.cssText = 'width:100%;height:100%;background:#08090c';
      target.replaceWith(placeholder);
    }
  });
  cover = document.createElement('div');
  cover.dataset.sceneTransition = '';
  cover.setAttribute('aria-hidden', 'true'); cover.inert = true;
  Object.assign(cover.style, { position: 'fixed', left: `${bounds.x}px`, top: `${bounds.y}px`, width: `${bounds.width}px`, height: `${bounds.height}px`, zIndex: '29', pointerEvents: 'none' });
  const shadow = cover.attachShadow({ mode: 'closed' }), css = document.createElement('style');
  css.textContent = [...document.styleSheets].map(sheet => {
    try { return [...sheet.cssRules].map(rule => rule.cssText).join('\n'); } catch { return ''; }
  }).join('\n');
  const shell = stage.cloneNode(false) as HTMLElement;
  Object.assign(shell.style, { width: '100%', height: '100%', position: 'relative', padding: '0' });
  shell.append(copy); shadow.append(css, shell); document.body.append(cover);
  return token;
}
export async function finishSceneTransition(token: number, pending: Promise<unknown>[]) {
  await Promise.allSettled(pending);
  if (token !== revision) return;
  requestAnimationFrame(() => {
    if (token !== revision) return;
    // Repaint shadows and grade with the new geometry before revealing it.
    window.dispatchEvent(new Event('shis-scene-ready'));
    document.querySelector('#stage')!.classList.remove('scene-unready');
    cover?.remove(); cover = undefined;
  });
}
