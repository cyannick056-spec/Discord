import './simple-mode.js';

const ROOT = document.documentElement;
const NIGHT = {
  crt: {
    landscape: '/night/crt-landscape.webp',
    portrait: '/night/crt-portrait.webp',
  },
  flat: {
    landscape: '/night/flat-landscape.webp',
    portrait: '/night/flat-portrait.webp',
  },
};

function portrait() {
  return innerHeight > innerWidth && innerHeight > 430;
}

function currentTv() {
  return document.querySelector('#stage')?.dataset.shisTv === 'flat' ? 'flat' : 'crt';
}

function approvedSource() {
  const tv = currentTv();
  return NIGHT[tv][portrait() ? 'portrait' : 'landscape'];
}

const style = document.createElement('style');
style.id = 'shis-approved-night-style';
style.textContent = `
  html.shis-approved-night #modeButton,
  html.shis-approved-night #arcadeScene,
  html.shis-approved-night .shis-fixed-furniture,
  html.shis-approved-night .shis-fixed-light,
  html.shis-approved-night #shisSimpleEditor .simple-scenes { display:none !important; }

  html.shis-approved-night .room-lighting { display:none !important; }
  html.shis-approved-night #roomBackdrop { inset:0 !important; z-index:0 !important; opacity:1 !important; }
  html.shis-approved-night #roomBackdrop img {
    display:block !important;
    width:100% !important;
    height:100% !important;
    max-width:none !important;
    object-fit:cover !important;
    object-position:center center !important;
    filter:none !important;
    opacity:1 !important;
  }
  html.shis-approved-night .room-scene { background:#080b12 !important; }
  html.shis-approved-night #tvScene { z-index:4 !important; }
  html.shis-approved-night #decorationLayer { z-index:8 !important; }

  /* La escena aprobada ya lleva toda la iluminación pintada. */
  html.shis-approved-night .room-scene::before,
  html.shis-approved-night .room-scene::after { display:none !important; }

  /* CRT: conserva el modelo clásico y todos sus filtros. */
  html.shis-approved-night [data-shis-tv="crt"] .crt-overlay { display:block !important; }

  /* Plana: pantalla limpia, sin barridos/scanlines de CRT. */
  html.shis-approved-night [data-shis-tv="flat"] .crt-overlay,
  html.shis-approved-night [data-shis-tv="flat"] .signal-sweep,
  html.shis-approved-night [data-shis-tv="flat"] .noise { display:none !important; }
  html.shis-approved-night [data-shis-tv="flat"] .player::before,
  html.shis-approved-night [data-shis-tv="flat"] .player::after,
  html.shis-approved-night [data-shis-tv="flat"] .screen-wrap::before,
  html.shis-approved-night [data-shis-tv="flat"] .screen-wrap::after { display:none !important; }
  html.shis-approved-night [data-shis-tv="flat"] .video-mount video { filter:none !important; }

  /* La TV de la app ocupa el espacio de la TV pintada en el entorno. */
  @media (orientation:landscape) and (min-height:361px) {
    html.shis-approved-night [data-shis-tv="crt"] #tvScene,
    html.shis-approved-night [data-shis-tv="crt"] #tvScene.aspect-4x3 {
      position:absolute !important;
      left:50% !important;
      top:33.5% !important;
      bottom:auto !important;
      width:min(43vw,720px) !important;
      transform:translate(-50%,-50%) !important;
    }
    html.shis-approved-night [data-shis-tv="flat"] #tvScene,
    html.shis-approved-night [data-shis-tv="flat"] #tvScene.aspect-4x3 {
      position:absolute !important;
      left:51.5% !important;
      top:34% !important;
      bottom:auto !important;
      width:min(50vw,835px) !important;
      transform:translate(-50%,-50%) !important;
    }
  }
  @media (orientation:portrait) and (min-height:430px) {
    html.shis-approved-night [data-shis-tv="crt"] #tvScene,
    html.shis-approved-night [data-shis-tv="crt"] #tvScene.aspect-4x3 {
      position:absolute !important;
      left:50% !important;
      top:42.5% !important;
      bottom:auto !important;
      width:min(58vw,545px) !important;
      transform:translate(-50%,-50%) !important;
    }
    html.shis-approved-night [data-shis-tv="flat"] #tvScene,
    html.shis-approved-night [data-shis-tv="flat"] #tvScene.aspect-4x3 {
      position:absolute !important;
      left:50% !important;
      top:45% !important;
      bottom:auto !important;
      width:min(69vw,650px) !important;
      transform:translate(-50%,-50%) !important;
    }
  }

  /* Juegos antiguos: 4:3 llena la pantalla CRT sin bordes del contenedor. */
  html.shis-approved-night [data-shis-tv="crt"] #tvScene.aspect-4x3 .video-mount video {
    width:100% !important;
    height:100% !important;
    object-fit:cover !important;
    object-position:center !important;
  }

  /* Panel realmente mínimo: figuritas + tipo de pantalla. */
  html.shis-approved-night #shisSimpleEditor .simple-card { max-height:min(39dvh,350px) !important; }
  html.shis-approved-night #shisSimpleEditor header strong::after {
    content:' · Noche acogedora';
    opacity:.65;
    font-weight:500;
  }
`;
document.head.append(style);
ROOT.classList.add('shis-approved-night');

function enforceBackdrop() {
  const backdrop = document.querySelector('#roomBackdrop img');
  if (!(backdrop instanceof HTMLImageElement)) return;
  const wanted = approvedSource();
  const current = new URL(backdrop.src || location.href, location.href).pathname;
  if (current !== wanted) backdrop.src = wanted;
  backdrop.hidden = false;
}

function trimOldSceneUi() {
  const panel = document.querySelector('#shisSimpleEditor');
  panel?.querySelector('.simple-scenes')?.remove();
  const status = panel?.querySelector('#shisSimpleStatus');
  if (status && /preparada|mueble|escenario/i.test(status.textContent || '')) {
    status.textContent = 'Arrastra tus figuritas directamente sobre la escena.';
  }
}

function enforceSingleEnvironment() {
  const stage = document.querySelector('#stage');
  if (stage) {
    stage.classList.remove('arcade-mode');
    stage.classList.add('home-mode');
    stage.dataset.shisScene = 'approved-night';
  }
  document.querySelector('#arcadeScene')?.setAttribute('hidden', '');
  document.querySelector('#modeButton')?.setAttribute('hidden', '');
  document.querySelectorAll('.shis-fixed-furniture,.shis-fixed-light').forEach(node => node.remove());
  trimOldSceneUi();
  enforceBackdrop();
}

let scheduled = false;
function scheduleEnforce() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    enforceSingleEnvironment();
  });
}

function install() {
  enforceSingleEnvironment();
  const stage = document.querySelector('#stage');
  const backdrop = document.querySelector('#roomBackdrop img');
  if (stage) new MutationObserver(scheduleEnforce).observe(stage, { attributes:true, attributeFilter:['class','data-shis-tv','data-shis-scene'] });
  if (backdrop) new MutationObserver(scheduleEnforce).observe(backdrop, { attributes:true, attributeFilter:['src','hidden'] });
  new MutationObserver(scheduleEnforce).observe(document.body, { childList:true, subtree:true });
  window.addEventListener('resize', scheduleEnforce, { passive:true });
  window.addEventListener('orientationchange', scheduleEnforce, { passive:true });
  window.addEventListener('shis-aspect-change', scheduleEnforce);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
else install();
