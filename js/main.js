/* ============================================================
   LABTECA — LÓGICA PRINCIPAL
   Depende de que js/data.js se cargue primero en el HTML.
   ============================================================ */

let activeCat = 'all';
let statusFilter = 'all';
let searchTerm = '';
const GALERIA_PAGINA = 12; // fotos por página (12 se divide bien entre 2, 3 y 4 columnas)
let galeriaPagina = 0;     // página actual (0-indexada)

function catInfo(id){ return CATEGORIAS.find(c => c.id === id); }

/* ============================================================
   ESTADO DE LECTURA — "leyendo" / "leído" por libro, guardado en
   este navegador (localStorage). No requiere cuenta ni servidor;
   si se borra el caché o se usa otro dispositivo, no se conserva.
   ============================================================ */
const STATUS_KEY = 'labteca-status';
let bookStatus = {};
try { bookStatus = JSON.parse(localStorage.getItem(STATUS_KEY)) || {}; } catch(e){ bookStatus = {}; }

function getStatus(id){ return bookStatus[id] || 'none'; }

function setStatus(id, status){
  if(status === 'none') delete bookStatus[id];
  else bookStatus[id] = status;
  try { localStorage.setItem(STATUS_KEY, JSON.stringify(bookStatus)); } catch(e){ /* almacenamiento no disponible */ }
}

function cycleStatus(id){
  const order = ['none', 'leyendo', 'leido'];
  const next = order[(order.indexOf(getStatus(id)) + 1) % order.length];
  setStatus(id, next);
  return next;
}

function statusIconSVG(status){
  if(status === 'leido'){
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.6l4.6 4.6L19 7.5"/></svg>`;
  }
  if(status === 'leyendo'){
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12.3" r="7.3"/><path d="M12 8.4v4l2.8 1.8"/></svg>`;
  }
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1Z"/></svg>`;
}
function statusNextLabel(status){
  return status === 'leido' ? 'Quitar marca de leído' : status === 'leyendo' ? 'Marcar como leído' : 'Marcar como leyendo';
}

/* ============================================================
   TEMA CLARO / OSCURO
   ============================================================ */
const THEME_KEY = 'labteca-theme';
function applyTheme(theme){
  if(theme === 'dark'){
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}
(function initTheme(){
  let saved = null;
  try { saved = localStorage.getItem(THEME_KEY); } catch(e){ /* almacenamiento no disponible */ }
  if(saved === 'dark' || saved === 'light'){
    applyTheme(saved);
  } else {
    // Sin preferencia guardada todavía: usar la del sistema operativo/navegador.
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark ? 'dark' : 'light');
  }
})();

document.getElementById('themeToggle').addEventListener('click', () => {
  const root = document.documentElement;
  const isDark = root.getAttribute('data-theme') === 'dark';
  const next = isDark ? 'light' : 'dark';
  const flash = document.getElementById('themeFlash');

  // Técnica liviana de "cortina": en vez de animar cientos de elementos a
  // la vez (tarjetas, sombras, botones — costoso y causaba lentitud en
  // celulares modestos), se cubre la pantalla con el color actual, se
  // cambia el tema por debajo de forma instantánea (invisible bajo la
  // cortina) y luego solo esa cortina se desvanece. Un único elemento
  // animando opacidad es prácticamente gratis para el navegador.
  //
  // La limpieza depende solo de un temporizador simple (comprobado
  // confiable) y no de eventos como "transitionend" o el callback de
  // Animation.onfinish, que en la práctica no siempre llegan a tiempo.
  if(flash){
    const currentBg = getComputedStyle(root).getPropertyValue('--bg').trim();
    flash.style.transition = 'none';
    flash.style.backgroundColor = currentBg;
    flash.style.opacity = '1';

    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch(e){ /* almacenamiento no disponible */ }

    requestAnimationFrame(() => {
      flash.style.transition = 'opacity .5s ease';
      flash.style.opacity = '0';
    });
    setTimeout(() => {
      flash.style.transition = '';
      flash.style.opacity = '';
    }, 900);
  } else {
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch(e){ /* almacenamiento no disponible */ }
  }
});

/* ---------------- FILTROS ---------------- */
function renderFilters(){
  const wrap = document.getElementById('filters');
  const all = `<button class="chip is-active" data-cat="all" aria-pressed="true"><span class="dot" style="background:var(--ink)"></span>Todas</button>`;
  const chips = CATEGORIAS.map(c =>
    `<button class="chip" data-cat="${c.id}" aria-pressed="false"><span class="dot" style="background:${c.color}"></span>${c.nombre}</button>`
  ).join('');
  wrap.innerHTML = all + chips;
  wrap.addEventListener('click', e => {
    const btn = e.target.closest('.chip');
    if(!btn) return;
    activeCat = btn.dataset.cat;
    [...wrap.children].forEach(c => {
      const active = c === btn;
      c.classList.toggle('is-active', active);
      c.setAttribute('aria-pressed', active);
    });
    btn.blur();
    renderBooks();
  });
}

/* ---------------- ÍCONOS ----------------
   Set propio de íconos de línea, trazo consistente (1.5–1.8),
   con un par de piezas con identidad de laboratorio (frasco,
   buscador con mira de precisión) en vez de íconos genéricos. */
function phIconSVG(){
  return `<svg class="ph-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M9 3h6"/>
    <path d="M10 3v5.6L4.85 17.1a2 2 0 0 0 1.72 3h10.86a2 2 0 0 0 1.72-3L14 8.6V3"/>
    <path d="M7.6 14.4h8.8"/>
  </svg>`;
}
function bookIconSVG(){
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 6.4C10.3 5.2 7.9 4.5 5.3 4.5v12.7c2.6 0 5 .7 6.7 1.9 1.7-1.2 4.1-1.9 6.7-1.9V4.5c-2.6 0-5 .7-6.7 1.9Z"/>
    <path d="M12 6.4v12.7"/>
  </svg>`;
}
function downloadIconSVG(){
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 3.7v9.7"/><path d="M8.2 9.7l3.8 3.8 3.8-3.8"/>
    <path d="M5 16.6v1.8a1.8 1.8 0 0 0 1.8 1.8h10.4a1.8 1.8 0 0 0 1.8-1.8v-1.8"/>
  </svg>`;
}
function emptyIconSVG(){
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M9 3h6"/><path d="M10 3v5.6L4.85 17.1a2 2 0 0 0 1.72 3h10.86a2 2 0 0 0 1.72-3L14 8.6V3"/><path d="M7.6 14.4h8.8"/>
  </svg>`;
}

function coverHTML(libro){
  const src = libroPortada(libro);
  if(!src){
    return phIconSVG();
  }
  return `<img src="${src}" alt="Portada de ${libro.titulo}" loading="lazy"
           onload="this.classList.add('is-loaded')"
           onerror="this.style.display='none'; this.parentElement.insertAdjacentHTML('beforeend', phIconSVG());">`;
}

function bookCardHTML(libro, idx){
  const cat = catInfo(libro.categoria);
  const status = getStatus(libro.id);
  const warn = libro.permisoPendiente
    ? `<span class="card-warn">Falta compartir en Drive</span>`
    : '';
  return `
  <article class="card status-${status}" style="--ci:${idx}">
    <div class="card-cap" style="background:${cat.color}"></div>
    <div class="card-cover">
      <span class="card-code">${libro.codigo}</span>
      <button class="status-btn" data-action="status" data-id="${libro.id}" aria-label="${statusNextLabel(status)}" title="${statusNextLabel(status)}">${statusIconSVG(status)}</button>
      ${coverHTML(libro)}
    </div>
    <div class="card-body">
      <span class="card-cat" style="color:${cat.color}">${cat.nombre}</span>
      <h3 class="card-title">${libro.titulo}</h3>
      <p class="card-meta">${libro.autor}${libro.edicion ? ' · ' + libro.edicion : ''}</p>
      <p class="card-desc">${libro.descripcion}</p>
      ${warn}
      <div class="card-actions">
        <button class="btn btn-primary btn-sm" data-action="leer" data-id="${libro.id}">${bookIconSVG()}Leer</button>
        <a class="btn btn-ghost btn-sm" href="${libroDescarga(libro)}" target="_blank" rel="noopener">${downloadIconSVG()}Descargar</a>
      </div>
    </div>
  </article>`;
}

function emptyCardHTML(cat){
  return `
  <div class="card-empty">
    ${emptyIconSVG()}
    <strong>${cat.nombre}</strong>
    <p>Aún no hay libros aquí. Agrega uno en el arreglo <code>LIBROS</code> de js/data.js.</p>
  </div>`;
}

function noResultsHTML(){
  return `<div class="card-empty" style="grid-column:1/-1;">${emptyIconSVG()}<strong>Sin resultados</strong><p>Ningún libro coincide con tu búsqueda o filtro actual. Prueba con otro término o quita el filtro de estado.</p></div>`;
}

function renderBooks(){
  const grid = document.getElementById('bookGrid');
  const term = searchTerm.trim().toLowerCase();

  let lista = LIBROS.filter(l =>
    (activeCat === 'all' || l.categoria === activeCat) &&
    (statusFilter === 'all' || getStatus(l.id) === statusFilter) &&
    (term === '' || l.titulo.toLowerCase().includes(term) || l.autor.toLowerCase().includes(term))
  );

  const isFiltering = term !== '' || statusFilter !== 'all';

  if(lista.length === 0){
    if(isFiltering){
      grid.innerHTML = noResultsHTML();
    } else {
      const cats = activeCat === 'all' ? CATEGORIAS : [catInfo(activeCat)];
      grid.innerHTML = cats.map(emptyCardHTML).join('');
    }
  } else {
    grid.innerHTML = lista.map((l, i) => bookCardHTML(l, i)).join('');
  }

  document.getElementById('countTag').textContent = `${lista.length} título${lista.length === 1 ? '' : 's'}`;
  updateProgress();
  renderContinueReading();
}

function updateProgress(){
  const total = LIBROS.length;
  const leidos = LIBROS.filter(l => getStatus(l.id) === 'leido').length;
  const leyendo = LIBROS.filter(l => getStatus(l.id) === 'leyendo').length;
  const pct = total ? Math.round((leidos / total) * 100) : 0;
  const tag = document.getElementById('progressTag');
  const fill = document.getElementById('progressBarFill');
  if(tag) tag.textContent = `${leidos} de ${total} leídos · ${leyendo} en progreso`;
  if(fill) fill.style.width = pct + '%';
}

/* Franja "Retomar": acceso directo a los libros marcados como "leyendo",
   para no tener que buscarlos de nuevo entre todo el catálogo. */
function renderContinueReading(){
  const row = document.getElementById('continueRow');
  const list = document.getElementById('continueList');
  const enProgreso = LIBROS.filter(l => getStatus(l.id) === 'leyendo');

  if(enProgreso.length === 0){
    row.hidden = true;
    list.innerHTML = '';
    return;
  }

  row.hidden = false;
  list.innerHTML = enProgreso.map(l => {
    const cat = catInfo(l.categoria);
    return `<button class="continue-chip" data-id="${l.id}" title="${l.titulo}">
      <span class="dot" style="background:${cat.color}"></span>${l.titulo}
    </button>`;
  }).join('');
}
document.getElementById('continueList').addEventListener('click', e => {
  const btn = e.target.closest('.continue-chip');
  if(!btn) return;
  const libro = LIBROS.find(l => l.id == btn.dataset.id);
  if(libro) openReader(libro);
});

/* Botón "Al azar": abre directamente el lector de un libro cualquiera del
   catálogo completo — como sacar una muestra al azar de la gradilla. */
document.getElementById('randomBookBtn').addEventListener('click', (e) => {
  if(LIBROS.length === 0) return;
  const libro = LIBROS[Math.floor(Math.random() * LIBROS.length)];
  const btn = e.currentTarget;
  btn.classList.add('is-rolling');
  setTimeout(() => btn.classList.remove('is-rolling'), 500);
  openReader(libro);
});

function renderStatusFilters(){
  const wrap = document.getElementById('statusFilters');
  wrap.addEventListener('click', e => {
    const btn = e.target.closest('.chip');
    if(!btn) return;
    statusFilter = btn.dataset.status;
    [...wrap.children].forEach(c => {
      const active = c === btn;
      c.classList.toggle('is-active', active);
      c.setAttribute('aria-pressed', active);
    });
    btn.blur();
    renderBooks();
  });
}

/* ============================================================
   ACCESIBILIDAD: atrapar el foco dentro de un modal abierto
   (lector o galería a pantalla completa), para que la tecla Tab
   no se escape hacia el contenido de fondo, y devolver el foco
   a quien abrió el modal al cerrarlo.
   ============================================================ */
const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';
function trapFocus(container){
  const previousActive = document.activeElement;
  function handleKeydown(e){
    if(e.key !== 'Tab') return;
    const focusables = [...container.querySelectorAll(FOCUSABLE_SELECTOR)]
      .filter(el => el.offsetParent !== null);
    if(focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if(e.shiftKey && document.activeElement === first){
      e.preventDefault(); last.focus();
    } else if(!e.shiftKey && document.activeElement === last){
      e.preventDefault(); first.focus();
    }
  }
  container.addEventListener('keydown', handleKeydown);
  const firstFocusable = container.querySelector(FOCUSABLE_SELECTOR);
  if(firstFocusable) firstFocusable.focus();
  return function releaseFocus(){
    container.removeEventListener('keydown', handleKeydown);
    if(previousActive && typeof previousActive.focus === 'function') previousActive.focus();
  };
}
let releaseReaderFocus = null;
let releaseLightboxFocus = null;

/* ---------------- GALERÍA (paginada: tamaño fijo, no crece hacia abajo) ---------------- */
function renderGallery(){
  const grid = document.getElementById('galleryGrid');
  const pager = document.getElementById('galleryPager');

  if(GALERIA.length === 0){
    grid.innerHTML = `<div class="card-empty" style="grid-column:1/-1;">
      ${emptyIconSVG()}
      <strong>Sin imágenes todavía</strong>
      <p>Agrega fotos del laboratorio en el arreglo <code>GALERIA</code> de js/data.js.</p>
    </div>`;
    pager.style.display = 'none';
    document.getElementById('galleryCount').textContent = '';
    return;
  }

  const totalPaginas = Math.ceil(GALERIA.length / GALERIA_PAGINA);
  galeriaPagina = Math.max(0, Math.min(galeriaPagina, totalPaginas - 1));
  const inicio = galeriaPagina * GALERIA_PAGINA;
  const pagina = GALERIA.slice(inicio, inicio + GALERIA_PAGINA);

  grid.innerHTML = pagina.map((g, i) => `
    <figure class="gphoto" data-idx="${inicio + i}" style="--gi:${i}">
      <img src="${galeriaSrc(g, 400)}" alt="${g.caption || 'Imagen de laboratorio'}" loading="lazy"
           onload="this.classList.add('is-loaded')"
           onerror="this.style.display='none'; this.parentElement.insertAdjacentHTML('beforeend', phIconSVG());">
      ${g.caption ? `<figcaption>${g.caption}</figcaption>` : ''}
    </figure>`).join('');

  grid.querySelectorAll('.gphoto').forEach(fig => {
    fig.addEventListener('click', () => openLightbox(Number(fig.dataset.idx)));
  });

  document.getElementById('galleryCount').textContent = `${GALERIA.length} fotos en total`;
  document.getElementById('galleryPageLabel').textContent = `Página ${galeriaPagina + 1} / ${totalPaginas}`;
  document.getElementById('galleryPrev').disabled = galeriaPagina === 0;
  document.getElementById('galleryNext').disabled = galeriaPagina >= totalPaginas - 1;
}

document.getElementById('galleryPrev').addEventListener('click', () => {
  if(galeriaPagina > 0){ galeriaPagina--; renderGallery(); }
});
document.getElementById('galleryNext').addEventListener('click', () => {
  const totalPaginas = Math.ceil(GALERIA.length / GALERIA_PAGINA);
  if(galeriaPagina < totalPaginas - 1){ galeriaPagina++; renderGallery(); }
});

/* ---------------- LIGHTBOX con avanzar / retroceder (recorre TODA la galería) ---------------- */
const lightbox = document.getElementById('lightbox');
let lightboxIndex = 0;

function showLightboxImage(){
  const item = GALERIA[lightboxIndex];
  if(!item) return;
  const img = document.getElementById('lightboxImg');
  img.classList.add('is-swapping');
  // Pequeño fundido: se opaca, se cambia el src, y al cargar vuelve a aparecer.
  const swap = () => {
    img.src = galeriaSrc(item, 1600);
    img.alt = item.caption || '';
    img.onload = () => img.classList.remove('is-swapping');
    img.onerror = () => img.classList.remove('is-swapping');
  };
  setTimeout(swap, 90);
  document.getElementById('lightboxCount').textContent = `${lightboxIndex + 1} / ${GALERIA.length}`;
}

function openLightbox(idx){
  lightboxIndex = idx;
  showLightboxImage();
  lightbox.classList.add('is-open');
  requestAnimationFrame(() => lightbox.classList.add('is-active'));
  document.body.style.overflow = 'hidden';
  releaseLightboxFocus = trapFocus(lightbox);
}

function lightboxStep(delta){
  const n = GALERIA.length;
  lightboxIndex = (lightboxIndex + delta + n) % n;
  showLightboxImage();
}

function closeLightbox(){
  lightbox.classList.remove('is-active');
  document.body.style.overflow = '';
  setTimeout(() => lightbox.classList.remove('is-open'), 200);
  if(releaseLightboxFocus){ releaseLightboxFocus(); releaseLightboxFocus = null; }
}

document.getElementById('lightboxClose').addEventListener('click', closeLightbox);
document.getElementById('lightboxPrev').addEventListener('click', () => lightboxStep(-1));
document.getElementById('lightboxNext').addEventListener('click', () => lightboxStep(1));
lightbox.addEventListener('click', e => { if(e.target === lightbox) closeLightbox(); });

// Deslizar con el dedo para avanzar/retroceder
let touchStartX = null;
const stage = document.querySelector('.lightbox-stage');
stage.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].clientX; }, {passive:true});
stage.addEventListener('touchend', e => {
  if(touchStartX === null) return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  if(Math.abs(dx) > 40) lightboxStep(dx < 0 ? 1 : -1);
  touchStartX = null;
}, {passive:true});

/* ============================================================
   LECTOR (MODAL) — recorta la barra de Drive solo cuando aplica;
   incluye control de zoom propio (independiente del visor de Drive).
   ============================================================ */
const overlay = document.getElementById('readerOverlay');
const frameWrap = document.getElementById('readerFrameWrap');
const fallback = document.getElementById('readerFallback');
const zoomLevelEl = document.getElementById('zoomLevel');
let readerZoom = 1;
let readerFallbackTimer = null;
const ZOOM_MIN = 1, ZOOM_MAX = 3, ZOOM_STEP = 0.25;
const READER_TIMEOUT_MS = 9000; // margen generoso antes de asumir que algo salió mal

function applyZoom(){
  frameWrap.style.setProperty('--rzoom', readerZoom);
  zoomLevelEl.textContent = Math.round(readerZoom * 100) + '%';
}
document.getElementById('zoomIn').addEventListener('click', () => {
  readerZoom = Math.min(ZOOM_MAX, +(readerZoom + ZOOM_STEP).toFixed(2));
  applyZoom();
});
document.getElementById('zoomOut').addEventListener('click', () => {
  readerZoom = Math.max(ZOOM_MIN, +(readerZoom - ZOOM_STEP).toFixed(2));
  applyZoom();
});

function openReader(libro){
  document.getElementById('readerTitle').textContent = libro.titulo;
  document.getElementById('readerCode').textContent = libro.codigo;
  document.getElementById('readerDownload').href = libroDescarga(libro);
  fallback.classList.remove('show');
  clearTimeout(readerFallbackTimer);

  readerZoom = 1;
  applyZoom();

  frameWrap.classList.toggle('is-drive', libroEsDrive(libro));

  if(libro.permisoPendiente){
    // Ya sabemos que este archivo no tiene permiso público: no tiene caso
    // intentar cargarlo, mostramos el aviso directamente.
    frameWrap.innerHTML = '';
    fallback.classList.add('show');
  } else {
    frameWrap.innerHTML = `<iframe src="${libroVisor(libro)}" allow="autoplay" onload="window.__readerLoaded && window.__readerLoaded()"></iframe>`;
    // Google no permite inspeccionar si el iframe realmente cargó el
    // documento (origen cruzado), así que además de escuchar 'load' se
    // pone un margen de tiempo: si no ha cargado nada en ese lapso
    // (por ejemplo, sin conexión), se muestra el mismo aviso.
    window.__readerLoaded = () => clearTimeout(readerFallbackTimer);
    readerFallbackTimer = setTimeout(() => {
      if(overlay.classList.contains('is-open')) fallback.classList.add('show');
    }, READER_TIMEOUT_MS);
  }

  overlay.classList.add('is-open');
  requestAnimationFrame(() => overlay.classList.add('is-active'));
  document.body.style.overflow = 'hidden';
  releaseReaderFocus = trapFocus(document.querySelector('.reader-panel'));
}

function closeReader(){
  clearTimeout(readerFallbackTimer);
  overlay.classList.remove('is-active');
  document.body.style.overflow = '';
  setTimeout(() => {
    overlay.classList.remove('is-open');
    frameWrap.innerHTML = '';
  }, 200);
  if(releaseReaderFocus){ releaseReaderFocus(); releaseReaderFocus = null; }
}

document.getElementById('readerClose').addEventListener('click', closeReader);
overlay.addEventListener('click', e => { if(e.target === overlay) closeReader(); });

document.addEventListener('keydown', e => {
  if(e.key === 'Escape'){ closeReader(); closeLightbox(); }
  if(lightbox.classList.contains('is-open')){
    if(e.key === 'ArrowLeft') lightboxStep(-1);
    if(e.key === 'ArrowRight') lightboxStep(1);
  }
  // Atajo "/" para enfocar la búsqueda: no aplica si ya se escribe en un
  // campo, ni si hay un modal abierto (lector o galería a pantalla completa).
  const modalOpen = overlay.classList.contains('is-open') || lightbox.classList.contains('is-open');
  if(e.key === '/' && document.activeElement.tagName !== 'INPUT' && !modalOpen){
    e.preventDefault();
    document.getElementById('searchInput').focus();
  }
});

document.getElementById('bookGrid').addEventListener('click', e => {
  const leerBtn = e.target.closest('[data-action="leer"]');
  if(leerBtn){
    const libro = LIBROS.find(l => l.id == leerBtn.dataset.id);
    if(libro) openReader(libro);
    return;
  }
  const statusBtn = e.target.closest('[data-action="status"]');
  if(statusBtn){
    const next = cycleStatus(statusBtn.dataset.id);
    if(next === 'leido'){
      // Pequeña pausa para que se alcance a ver el "ping" de confirmación
      // sobre el botón real antes de que la tarjeta se vuelva a dibujar.
      statusBtn.classList.add('is-success');
      setTimeout(renderBooks, 280);
    } else {
      renderBooks();
    }
  }
});

/* ============================================================
   NAV MÓVIL, BÚSQUEDA Y GRADILLA
   ============================================================ */
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');
navToggle.addEventListener('click', () => {
  const open = navLinks.classList.toggle('is-open');
  navToggle.setAttribute('aria-expanded', open);
});
navLinks.addEventListener('click', e => { if(e.target.tagName === 'A') { navLinks.classList.remove('is-open'); navToggle.setAttribute('aria-expanded', false); } });
document.addEventListener('click', e => {
  if(!navLinks.classList.contains('is-open')) return;
  if(navLinks.contains(e.target) || navToggle.contains(e.target)) return;
  navLinks.classList.remove('is-open');
  navToggle.setAttribute('aria-expanded', false);
});

document.getElementById('searchInput').addEventListener('input', e => {
  searchTerm = e.target.value;
  renderBooks();
});

document.querySelector('.rack').addEventListener('click', e => {
  const tube = e.target.closest('.tube');
  if(!tube) return;
  e.preventDefault();
  activeCat = tube.dataset.cat;
  document.querySelectorAll('.chip').forEach(c => c.classList.toggle('is-active', c.dataset.cat === activeCat));
  renderBooks();
  document.getElementById('catalogo').scrollIntoView({behavior:'smooth'});
});

document.getElementById('year').textContent = new Date().getFullYear();

/* ============================================================
   ENCABEZADO: sombra al hacer scroll + barra de progreso de lectura
   ============================================================ */
const header = document.getElementById('siteHeader');
const progressBar = document.getElementById('headerProgress');
function onScrollHeader(){
  header.classList.toggle('is-scrolled', window.scrollY > 8);
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const pct = max > 0 ? (window.scrollY / max) * 100 : 0;
  progressBar.style.width = pct + '%';
}
document.addEventListener('scroll', onScrollHeader, {passive:true});
onScrollHeader();

/* ---------------- Resalte de sección activa en la navegación (scrollspy) ---------------- */
const spySections = ['inicio','categorias','catalogo','galeria','acerca']
  .map(id => document.getElementById(id)).filter(Boolean);
const spyLinks = [...document.querySelectorAll('[data-spy]')];
const spyObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if(entry.isIntersecting){
      const id = entry.target.id;
      spyLinks.forEach(a => a.classList.toggle('is-active', a.dataset.spy === id));
    }
  });
}, { rootMargin: '-45% 0px -50% 0px' });
spySections.forEach(s => spyObserver.observe(s));

/* ---------------- Botón "volver arriba" ---------------- */
const toTop = document.getElementById('toTop');
document.addEventListener('scroll', () => {
  toTop.classList.toggle('is-visible', window.scrollY > 600);
}, {passive:true});
toTop.addEventListener('click', () => window.scrollTo({top:0, behavior:'smooth'}));

/* ---------------- Revelado al hacer scroll ---------------- */
const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if(entry.isIntersecting){
      const delay = entry.target.dataset.revealDelay;
      if(delay) entry.target.style.transitionDelay = delay + 'ms';
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });
document.querySelectorAll('[data-reveal]').forEach(el => revealObserver.observe(el));

/* ---------------- Contadores animados de la sección "Acerca" ---------------- */
function animateCount(el, target, duration = 1100){
  const start = performance.now();
  function tick(now){
    const p = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(eased * target);
    if(p < 1) requestAnimationFrame(tick);
    else el.textContent = target;
  }
  requestAnimationFrame(tick);
}
const statBooksEl = document.getElementById('statBooks');
const statCatsEl = document.getElementById('statCats');
const countObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if(entry.isIntersecting){
      animateCount(statBooksEl, LIBROS.length);
      animateCount(statCatsEl, CATEGORIAS.length);
      countObserver.disconnect();
    }
  });
}, { threshold: 0.4 });
countObserver.observe(document.querySelector('.about-card'));

/* ============================================================
   INICIO
   ============================================================ */
renderFilters();
renderStatusFilters();
renderBooks();
renderGallery();
