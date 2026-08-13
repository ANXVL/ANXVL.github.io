/* ============================================================
   LABTECA — LECTURA EN VOZ ALTA (módulo independiente)
   SIN NINGUNA API KEY, SIN CUENTAS, SIN REGISTRARSE EN NADA.

   Qué hace: dentro del lector aparece un botón de altavoz. Al
   pulsarlo se abre un panel que lee el PDF en voz alta y AVANZA
   SOLO de página en página hasta terminar todo el documento.

   ------------------------------------------------------------
   DE DÓNDE SACA EL PDF (lo intenta en este orden, automático):

   1. Archivo local del proyecto (campo `archivo`) o cualquier
      URL propia (campo `pdfUrl`)          → instantáneo.
   2. Caché de este navegador               → instantáneo y sin
      internet, si ya lo leíste antes.
   3. Espejos públicos gratuitos            → sirve para PDF
      chicos (insertos, guías). Los espejos gratis cortan en
      ~5 MB, así que los libros grandes no pasan por aquí.
   4. Elegir el PDF desde el dispositivo    → funciona SIEMPRE.
      Se hace una sola vez por libro: queda guardado en el
      navegador y las siguientes veces arranca solo.

   Por qué hace falta el paso 4 en los libros grandes: el
   navegador prohíbe leer con JavaScript el contenido de
   drive.google.com (regla CORS). No es un permiso de Drive —
   aunque el archivo sea público, el texto no se puede sacar de
   ahí. Con arrastrar el PDF al panel se resuelve en un gesto.

   ------------------------------------------------------------
   CÓMO ESTÁ HECHO PARA NO AFECTAR NADA:
   · Vive en su propio archivo. No modifica main.js, data.js ni
     style.css. En index.html solo se agregan 2 líneas.
   · Se engancha a openReader() envolviéndola, sin reescribirla.
   · Crea su interfaz por JavaScript: tampoco toca el HTML.
   · PDF.js se descarga del CDN solo la primera vez que pulsas
     "Escuchar". Mientras no lo uses, la página carga igual.
   · Si algo falla, el módulo se apaga solo y el lector normal
     sigue intacto.
   ============================================================ */
(function () {
  'use strict';

  /* ============================================================
     1. CONFIGURACIÓN
     ============================================================ */
  const CFG = Object.assign({

    /* Tamaño de cada fragmento hablado. Entre 150 y 220 es lo más
       seguro: los fragmentos largos se cortan solos en Chrome y
       en Android.                                                */
    maxCaracteresPorFrase: 190,

    velocidad: 1,           // 0.5 – 2
    tono: 1,                // 0 – 2
    idiomaPreferido: 'es',  // prefijo de idioma para elegir voz

    saltarPaginasSinTexto: true,  // portadas, láminas, separadores
    maxPaginasVaciasSeguidas: 30, // si supera esto, avisa "escaneado"
    quitarNumerosDePagina: true,
    expandirUnidades: true,       // "mg/dL" → "miligramos por decilitro"

    /* Espejos públicos gratuitos, sin clave. Se prueban en orden.
       Ponlo en false si prefieres que ningún documento pase por
       un tercero: entonces siempre se usará "elegir archivo".    */
    usarEspejos: true,
    espejos: [
      'https://api.codetabs.com/v1/proxy/?quest={url}',
      'https://api.allorigins.win/raw?url={url}',
      'https://corsproxy.io/?url={url}'
    ],
    maxMBporEspejo: 20,     // más grande que esto, ni se intenta

    /* Caché en este navegador (IndexedDB) para no volver a pedir
       el mismo PDF nunca más.                                    */
    usarCache: true,
    maxMBenCache: 60,       // no guardar archivos más grandes
    maxLibrosEnCache: 6,    // se borra el más viejo al pasarse

    /* CDN de PDF.js. Alternativa si jsDelivr estuviera bloqueado:
       https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js
       y .../pdf.worker.min.js                                    */
    pdfjsLib:     'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
    pdfjsWorker:  'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js',
    pdfjsCMaps:   'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
    pdfjsFuentes: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/standard_fonts/'

  }, window.LABTECA_VOZ_CONFIG || {});

  const CLAVE_POS  = 'labteca-voz-pos';   // página donde se quedó cada libro
  const CLAVE_PREF = 'labteca-voz-pref';  // voz y velocidad elegidas
  const DB_NOMBRE  = 'labteca-voz';
  const DB_STORE   = 'pdfs';

  /* ============================================================
     2. ESTADO
     ============================================================ */
  const S = {
    libro: null,
    doc: null,             // documento PDF.js abierto
    totalPag: 0,
    pagina: 1,
    trozos: [],            // fragmentos de la página actual
    idxTrozo: 0,
    estado: 'apagado',     // apagado|cargando|leyendo|pausado|fin|error
    gen: 0,                // generación: invalida callbacks viejos
    cache: new Map(),      // página → fragmentos ya extraídos
    fuente: '',            // de dónde salió el PDF
    voz: null,
    velocidad: CFG.velocidad,
    watchdog: null,
    keepAlive: null,
    desbloqueado: false,   // iOS exige un speak() dentro de un toque
    cargandoLib: null,
    mostrarTexto: window.matchMedia('(min-width: 700px)').matches
  };

  const soportaVoz = typeof window.speechSynthesis !== 'undefined' &&
                     typeof window.SpeechSynthesisUtterance !== 'undefined';

  /* ============================================================
     3. UTILIDADES CHICAS
     ============================================================ */
  function leerJSON(clave, porDefecto) {
    try { return JSON.parse(localStorage.getItem(clave)) || porDefecto; }
    catch (e) { return porDefecto; }
  }
  function guardarJSON(clave, valor) {
    try { localStorage.setItem(clave, JSON.stringify(valor)); } catch (e) { /* sin storage */ }
  }
  function posGuardada(codigo) { return (leerJSON(CLAVE_POS, {})[codigo] || {}).p || 0; }
  function guardarPos(codigo, pagina) {
    if (!codigo) return;
    const todo = leerJSON(CLAVE_POS, {});
    todo[codigo] = { p: pagina, t: Date.now() };
    guardarJSON(CLAVE_POS, todo);
  }
  function svg(d, w) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' +
      (w || 1.7) + '" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
  }
  function escapar(t) {
    return t.replace(/[<>&]/g, function (c) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]; });
  }

  const ICONO = {
    altavoz: svg('<path d="M4 9.5h3.2L12 5.6v12.8L7.2 14.5H4z"/><path d="M15.6 9.4a3.6 3.6 0 0 1 0 5.2"/><path d="M18.1 6.9a7.1 7.1 0 0 1 0 10.2"/>'),
    play:    svg('<path d="M8 5.4l10 6.6-10 6.6z" fill="currentColor" stroke-width="1.2"/>'),
    pausa:   svg('<path d="M9.2 5.5v13M14.8 5.5v13"/>', 2),
    stop:    svg('<rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="currentColor" stroke="none"/>'),
    prev:    svg('<path d="M16.5 6.2v11.6L8.6 12z" fill="currentColor" stroke-width="1.2"/><path d="M6.6 5.8v12.4"/>'),
    next:    svg('<path d="M7.5 6.2v11.6L15.4 12z" fill="currentColor" stroke-width="1.2"/><path d="M17.4 5.8v12.4"/>'),
    cerrar:  svg('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>', 1.8),
    texto:   svg('<path d="M5 6.5h14M5 12h14M5 17.5h9"/>'),
    bajar:   svg('<path d="M12 3.7v9.7"/><path d="M8.2 9.7l3.8 3.8 3.8-3.8"/><path d="M5 16.6v1.8a1.8 1.8 0 0 0 1.8 1.8h10.4a1.8 1.8 0 0 0 1.8-1.8v-1.8"/>'),
    subir:   svg('<path d="M12 20.3V10.6"/><path d="M8.2 14.3L12 10.5l3.8 3.8"/><path d="M5 7.4V5.6A1.8 1.8 0 0 1 6.8 3.8h10.4A1.8 1.8 0 0 1 19 5.6v1.8"/>')
  };

  /* ============================================================
     4. CARGA PEREZOSA DE PDF.JS
        Solo se descarga cuando el usuario pulsa "Escuchar".
     ============================================================ */
  function cargarPdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (S.cargandoLib) return S.cargandoLib;
    S.cargandoLib = new Promise(function (ok, mal) {
      const sc = document.createElement('script');
      sc.src = CFG.pdfjsLib;
      sc.async = true;
      sc.onload = function () {
        if (!window.pdfjsLib) return mal(new Error('PDF.js no se inicializó'));
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = CFG.pdfjsWorker;
        ok(window.pdfjsLib);
      };
      sc.onerror = function () { mal(new Error('No se pudo descargar PDF.js del CDN')); };
      document.head.appendChild(sc);
    });
    return S.cargandoLib;
  }

  /* ============================================================
     5. CACHÉ LOCAL (IndexedDB)
        Guarda el PDF ya obtenido para no volver a pedirlo nunca.
        Si el navegador no deja, todo sigue funcionando igual.
     ============================================================ */
  function abrirDB() {
    return new Promise(function (ok, mal) {
      if (!CFG.usarCache || !window.indexedDB) return mal(new Error('sin caché'));
      const req = indexedDB.open(DB_NOMBRE, 1);
      req.onupgradeneeded = function () {
        const db = req.result;
        if (!db.objectStoreNames.contains(DB_STORE)) {
          db.createObjectStore(DB_STORE, { keyPath: 'codigo' });
        }
      };
      req.onsuccess = function () { ok(req.result); };
      req.onerror = function () { mal(req.error || new Error('IndexedDB')); };
    });
  }

  function leerDeCache(codigo) {
    return abrirDB().then(function (db) {
      return new Promise(function (ok) {
        const tx = db.transaction(DB_STORE, 'readonly');
        const req = tx.objectStore(DB_STORE).get(codigo);
        req.onsuccess = function () { ok(req.result ? req.result.bytes : null); };
        req.onerror = function () { ok(null); };
      });
    }).catch(function () { return null; });
  }

  function guardarEnCache(codigo, bytes, nombre) {
    if (!CFG.usarCache || bytes.byteLength > CFG.maxMBenCache * 1024 * 1024) return Promise.resolve(false);
    return abrirDB().then(function (db) {
      return new Promise(function (ok) {
        const tx = db.transaction(DB_STORE, 'readwrite');
        const st = tx.objectStore(DB_STORE);
        st.put({ codigo: codigo, bytes: bytes, tam: bytes.byteLength, nombre: nombre || '', ts: Date.now() });
        tx.oncomplete = function () { podarCache(db); ok(true); };
        tx.onerror = function () { ok(false); };   // cuota llena: no pasa nada
        tx.onabort = function () { ok(false); };
      });
    }).catch(function () { return false; });
  }

  function podarCache(db) {
    try {
      const tx = db.transaction(DB_STORE, 'readwrite');
      const st = tx.objectStore(DB_STORE);
      const req = st.getAll();
      req.onsuccess = function () {
        const todos = (req.result || []).sort(function (a, b) { return b.ts - a.ts; });
        todos.slice(CFG.maxLibrosEnCache).forEach(function (x) { st.delete(x.codigo); });
      };
    } catch (e) { /* nada */ }
  }

  /* ============================================================
     6. OBTENER EL PDF — cadena de fuentes, todas sin clave
     ============================================================ */
  function esPDF(bytes) {
    const v = new Uint8Array(bytes.slice(0, 5));
    // "%PDF-" — si llega un HTML de error, aquí se detecta
    return v[0] === 0x25 && v[1] === 0x50 && v[2] === 0x44 && v[3] === 0x46;
  }

  function urlDirecta(libro) {
    if (libro.pdfUrl) return libro.pdfUrl;
    if (libro.archivo) return libro.archivo;
    return null;
  }

  function destinosDrive(id) {
    return [
      'https://drive.usercontent.google.com/download?id=' + id + '&export=download&confirm=t',
      'https://drive.google.com/uc?export=download&id=' + id
    ];
  }

  /* Descarga por espejo con dos relojes: uno corto para la
     respuesta (si el espejo está caído, se pasa al siguiente
     rápido) y otro largo para el cuerpo del archivo.           */
  function bajarPorEspejo(plantilla, destino) {
    const url = plantilla.replace('{url}', encodeURIComponent(destino));
    const ac = new AbortController();
    const cabeceras = setTimeout(function () { ac.abort(); }, 12000);
    return fetch(url, { signal: ac.signal, redirect: 'follow' }).then(function (res) {
      clearTimeout(cabeceras);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const largo = parseInt(res.headers.get('content-length') || '0', 10);
      if (largo && largo > CFG.maxMBporEspejo * 1024 * 1024) throw new Error('demasiado grande');
      const cuerpo = setTimeout(function () { ac.abort(); }, 90000);
      return res.arrayBuffer().then(function (b) { clearTimeout(cuerpo); return b; });
    }).then(function (bytes) {
      if (!bytes || !bytes.byteLength || !esPDF(bytes)) throw new Error('no es un PDF');
      return bytes;
    });
  }

  async function bytesDesdeEspejos(libro) {
    if (!CFG.usarEspejos || !libro.driveId) return null;
    const destinos = destinosDrive(libro.driveId);
    for (let d = 0; d < destinos.length; d++) {
      for (let e = 0; e < CFG.espejos.length; e++) {
        estado('Buscando el PDF… (intento ' + (d * CFG.espejos.length + e + 1) + ')', 'cargando');
        try {
          const bytes = await bajarPorEspejo(CFG.espejos[e], destinos[d]);
          if (bytes) return bytes;
        } catch (err) { /* siguiente espejo */ }
      }
    }
    return null;
  }

  /* ============================================================
     7. EXTRACCIÓN Y LIMPIEZA DEL TEXTO
     ============================================================ */
  const UNIDADES = [
    [/\bmg\s*\/\s*dL\b/g, ' miligramos por decilitro '],
    [/\bg\s*\/\s*dL\b/g, ' gramos por decilitro '],
    [/\bmg\s*\/\s*L\b/g, ' miligramos por litro '],
    [/\bmmol\s*\/\s*L\b/g, ' milimoles por litro '],
    [/\bmEq\s*\/\s*L\b/g, ' miliequivalentes por litro '],
    [/\bU\s*I\s*\/\s*L\b/g, ' unidades internacionales por litro '],
    [/\bU\s*\/\s*L\b/g, ' unidades por litro '],
    [/[µμu]\s*L\b/g, ' microlitros '],
    [/\bmL\b/g, ' mililitros '],
    [/[µμ]m\b/g, ' micrómetros '],
    [/\bnm\b/g, ' nanómetros '],
    [/°\s*C\b/g, ' grados centígrados '],
    [/\brpm\b/g, ' revoluciones por minuto '],
    [/\bpH\b/g, ' pe hache '],
    [/%/g, ' por ciento ']
  ];

  function limpiarTexto(bruto) {
    let t = bruto
      .replace(/\u00AD/g, '')                       // guion suave invisible
      .replace(/\uFB01/g, 'fi').replace(/\uFB02/g, 'fl')
      .replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"')
      .replace(/([A-Za-zÁÉÍÓÚÜÑáéíóúüñ])-\s*\n\s*([a-záéíóúüñ])/g, '$1$2') // palabra cortada
      .replace(/[ \t]{2,}/g, ' ');

    const lineas = t.split('\n').map(function (l) { return l.trim(); }).filter(function (l) {
      if (!l || l.length <= 2) return false;
      // números de página, guiones decorativos, puntos de índice
      if (CFG.quitarNumerosDePagina && /^[\s\d.\-–—_·|/]+$/.test(l)) return false;
      return true;
    });

    // Reunir respetando las frases que el maquetado del PDF partió
    let texto = '';
    lineas.forEach(function (l, i) {
      if (i === 0) { texto = l; return; }
      const fin = texto.slice(-1);
      const empiezaEnMinuscula = /^[a-záéíóúüñ¿¡("']/.test(l);
      if (/[.:;!?,]$/.test(fin) || empiezaEnMinuscula || /[-–—]$/.test(fin)) texto += ' ' + l;
      else texto += '. ' + l;   // título o línea suelta → pausa natural
    });

    if (CFG.expandirUnidades) {
      UNIDADES.forEach(function (par) { texto = texto.replace(par[0], par[1]); });
    }
    return texto.replace(/\s{2,}/g, ' ').replace(/\s+([,.;:!?)])/g, '$1').trim();
  }

  const ABREVIATURAS = /\s(?:Dr|Dra|Sr|Sra|Srta|etc|fig|Fig|pág|Pag|Pág|núm|Núm|No|nro|vs|aprox|Ej|ej|cap|Cap|Vol|vol|ed|Ed)\.$/;

  function dividirEnFrases(t) {
    const out = [];
    let buf = '';
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      buf += c;
      if ('.!?;:'.indexOf(c) === -1) continue;
      const sig = t[i + 1];
      if (sig !== undefined && !/\s/.test(sig)) continue;   // "3.5" o "www.x"
      if (c === '.' && ABREVIATURAS.test(buf)) continue;    // "Dr." no termina frase
      if (buf.trim()) out.push(buf.trim());
      buf = '';
    }
    if (buf.trim()) out.push(buf.trim());
    return out;
  }

  function partirLarga(frase, max) {
    const trozos = [];
    let resto = frase;
    while (resto.length > max) {
      let corte = resto.lastIndexOf(',', max);
      if (corte < max * 0.5) corte = resto.lastIndexOf(' ', max);
      if (corte < max * 0.4) corte = max;
      trozos.push(resto.slice(0, corte + 1).trim());
      resto = resto.slice(corte + 1).trim();
    }
    if (resto) trozos.push(resto);
    return trozos;
  }

  function trocear(texto) {
    const max = CFG.maxCaracteresPorFrase;
    const salida = [];
    let actual = '';
    dividirEnFrases(texto).forEach(function (fr) {
      if (fr.length > max) {
        if (actual) { salida.push(actual); actual = ''; }
        partirLarga(fr, max).forEach(function (p) { salida.push(p); });
        return;
      }
      if ((actual + ' ' + fr).trim().length <= max) actual = (actual ? actual + ' ' : '') + fr;
      else { if (actual) salida.push(actual); actual = fr; }
    });
    if (actual) salida.push(actual);
    // descartar fragmentos sin nada pronunciable
    return salida.filter(function (f) { return /[a-zA-Z0-9áéíóúüñÁÉÍÓÚÜÑ]{2,}/.test(f); });
  }

  async function trozosDePagina(n) {
    if (S.cache.has(n)) return S.cache.get(n);
    const page = await S.doc.getPage(n);
    const tc = await page.getTextContent();
    let bruto = '';
    let prev = null;
    tc.items.forEach(function (it) {
      if (prev) {
        if (prev.hasEOL) bruto += '\n';
        else if (!/\s$/.test(bruto) && !/^\s/.test(it.str)) bruto += ' ';
      }
      bruto += it.str;
      prev = it;
    });
    if (page.cleanup) page.cleanup();
    const trozos = trocear(limpiarTexto(bruto));
    if (S.cache.size > 60) S.cache.delete(S.cache.keys().next().value);
    S.cache.set(n, trozos);
    return trozos;
  }

  /* ============================================================
     8. INTERFAZ (se inyecta sola dentro del modal del lector)
     ============================================================ */
  const overlay = document.getElementById('readerOverlay');
  const panel = overlay && overlay.querySelector('.reader-panel');
  const accionesBarra = overlay && overlay.querySelector('.reader-bar-actions');
  if (!overlay || !panel || !accionesBarra) return; // otro proyecto: no hacer nada

  const btnEscuchar = document.createElement('button');
  btnEscuchar.className = 'icon-btn voz-btn';
  btnEscuchar.id = 'vozAbrir';
  btnEscuchar.type = 'button';
  btnEscuchar.setAttribute('aria-label', 'Escuchar este documento en voz alta');
  btnEscuchar.title = 'Escuchar en voz alta';
  btnEscuchar.innerHTML = ICONO.altavoz;
  accionesBarra.insertBefore(btnEscuchar, document.getElementById('readerDownload'));

  const dock = document.createElement('div');
  dock.className = 'voz-dock';
  dock.id = 'vozDock';
  dock.hidden = true;
  dock.innerHTML =
    '<div class="voz-fila-top">' +
      '<span class="voz-punto" id="vozPunto" aria-hidden="true"></span>' +
      '<span class="voz-estado" id="vozEstado" role="status" aria-live="polite">Listo</span>' +
      '<button class="voz-x" id="vozCerrar" type="button" aria-label="Cerrar lectura en voz alta">' + ICONO.cerrar + '</button>' +
    '</div>' +
    '<div class="voz-progreso"><span id="vozProgresoFill"></span></div>' +
    '<div class="voz-controles">' +
      '<button class="voz-b" id="vozPrev" type="button" aria-label="Página anterior">' + ICONO.prev + '</button>' +
      '<button class="voz-b voz-b--play" id="vozPlay" type="button" aria-label="Reproducir">' + ICONO.play + '</button>' +
      '<button class="voz-b" id="vozStop" type="button" aria-label="Detener">' + ICONO.stop + '</button>' +
      '<button class="voz-b" id="vozNext" type="button" aria-label="Página siguiente">' + ICONO.next + '</button>' +
      '<span class="voz-pag" id="vozPag">—</span>' +
      '<span class="voz-flex"></span>' +
      '<select class="voz-sel" id="vozVel" aria-label="Velocidad de lectura">' +
        '<option value="0.75">0.75×</option><option value="1" selected>1×</option>' +
        '<option value="1.25">1.25×</option><option value="1.5">1.5×</option>' +
        '<option value="1.75">1.75×</option><option value="2">2×</option>' +
      '</select>' +
      '<select class="voz-sel voz-sel--voz" id="vozVoz" aria-label="Voz">' +
        '<option>Voz del sistema</option></select>' +
      '<button class="voz-b voz-b--chico" id="vozTextoBtn" type="button" aria-label="Mostrar u ocultar el texto" title="Mostrar/ocultar texto">' + ICONO.texto + '</button>' +
    '</div>' +
    '<div class="voz-fuente" id="vozFuente" hidden>' +
      '<p class="voz-fuente-msg" id="vozFuenteMsg">Drive no deja que la web lea este archivo. Se arregla en dos toques:</p>' +
      '<div class="voz-fuente-btns">' +
        '<a class="voz-paso" id="vozDescargar" href="#" target="_blank" rel="noopener">' +
          '<span class="voz-num">1</span>' + ICONO.bajar + '<span>Descargar el PDF</span></a>' +
        '<label class="voz-paso voz-paso--fuerte">' +
          '<span class="voz-num">2</span>' + ICONO.subir + '<span>Elegir el PDF</span>' +
          '<input type="file" id="vozArchivo" accept="application/pdf,.pdf" hidden></label>' +
      '</div>' +
      '<small>También puedes arrastrar el PDF aquí. Se guarda en este navegador: la próxima vez arranca solo.</small>' +
    '</div>' +
    '<div class="voz-texto" id="vozTexto" hidden></div>';
  panel.appendChild(dock);

  const $ = function (id) { return document.getElementById(id); };
  const elEstado = $('vozEstado'), elPunto = $('vozPunto'), elFill = $('vozProgresoFill'),
        elPag = $('vozPag'), elPlay = $('vozPlay'), elTexto = $('vozTexto'),
        elFuente = $('vozFuente'), elFuenteMsg = $('vozFuenteMsg'),
        selVel = $('vozVel'), selVoz = $('vozVoz');

  function estado(txt, clase) {
    elEstado.textContent = txt;
    dock.dataset.estado = clase || S.estado;
  }
  function pintarPlay() {
    const leyendo = S.estado === 'leyendo';
    elPlay.innerHTML = leyendo ? ICONO.pausa : ICONO.play;
    elPlay.setAttribute('aria-label', leyendo ? 'Pausar' : 'Reproducir');
    elPunto.classList.toggle('is-on', leyendo);
    btnEscuchar.classList.toggle('is-leyendo', leyendo);
  }
  function pintarProgreso() {
    if (!S.totalPag) { elFill.style.width = '0%'; elPag.textContent = '—'; return; }
    const dentro = S.trozos.length ? (S.idxTrozo / S.trozos.length) : 0;
    const pct = ((S.pagina - 1 + dentro) / S.totalPag) * 100;
    elFill.style.width = Math.min(100, Math.max(0, pct)) + '%';
    elPag.textContent = 'Pág. ' + S.pagina + ' / ' + S.totalPag;
  }
  function pintarTexto() {
    if (!S.mostrarTexto) { elTexto.hidden = true; return; }
    elTexto.hidden = false;
    elTexto.innerHTML = S.trozos.map(function (t, i) {
      return '<span class="voz-frase' + (i === S.idxTrozo ? ' is-actual' : '') +
             '" data-i="' + i + '">' + escapar(t) + '</span>';
    }).join(' ');
    const act = elTexto.querySelector('.is-actual');
    if (act && act.scrollIntoView) act.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  function marcarFraseActual() {
    if (!S.mostrarTexto) return;
    const prev = elTexto.querySelector('.is-actual');
    if (prev) prev.classList.remove('is-actual');
    const act = elTexto.querySelector('[data-i="' + S.idxTrozo + '"]');
    if (act) {
      act.classList.add('is-actual');
      if (act.scrollIntoView) act.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }
  function mostrarZonaArchivo(msg) {
    if (msg) elFuenteMsg.textContent = msg;
    const a = $('vozDescargar');
    if (S.libro && typeof libroDescarga === 'function') a.href = libroDescarga(S.libro);
    elFuente.hidden = false;
    // Todavía no hay nada que seguir: se recoge el texto para que los dos
    // botones quepan enteros aunque el teléfono sea bajito.
    elTexto.hidden = true;
    // Mientras se pide el archivo no hay PDF que mirar, así que el panel
    // puede ocupar más alto y el aviso se lee entero sin desplazar.
    panel.classList.add('voz-pidiendo');
    dock.scrollTop = 0;
  }
  function ocultarZonaArchivo() {
    elFuente.hidden = true;
    panel.classList.remove('voz-pidiendo');
  }

  /* ============================================================
     9. MOTOR DE VOZ
        Blindado contra los tres problemas clásicos:
        a) Chrome corta la voz a los ~15 s  → fragmentos cortos +
           "keep alive" con pause/resume.
        b) onend a veces no llega nunca     → watchdog que fuerza
           el avance para que nunca se quede trabado.
        c) callbacks viejos tras cancel()   → contador de
           generación (S.gen) que los invalida.
     ============================================================ */
  function vocesDisponibles() {
    return new Promise(function (ok) {
      let v = speechSynthesis.getVoices();
      if (v && v.length) return ok(v);
      let intentos = 0;
      const t = setInterval(function () {
        v = speechSynthesis.getVoices();
        if ((v && v.length) || ++intentos > 20) { clearInterval(t); ok(v || []); }
      }, 150);
      speechSynthesis.onvoiceschanged = function () {
        v = speechSynthesis.getVoices();
        if (v && v.length) { clearInterval(t); ok(v); }
      };
    });
  }

  async function prepararVoces() {
    const voces = await vocesDisponibles();
    if (!voces.length) { selVoz.innerHTML = '<option>Voz del sistema</option>'; return; }
    const pref = leerJSON(CLAVE_PREF, {});
    const es = voces.filter(function (v) { return v.lang.toLowerCase().indexOf(CFG.idiomaPreferido) === 0; });
    const resto = voces.filter(function (v) { return es.indexOf(v) === -1; });
    const orden = es.concat(resto);
    selVoz.innerHTML = orden.map(function (v) {
      return '<option value="' + escapar(v.voiceURI) + '">' + escapar(v.name) + ' (' + v.lang + ')</option>';
    }).join('');
    S.voz = orden.find(function (v) { return v.voiceURI === pref.voz; }) || es[0] || orden[0];
    if (S.voz) selVoz.value = S.voz.voiceURI;
    if (pref.vel) { S.velocidad = pref.vel; selVel.value = String(pref.vel); }
  }

  function pararKeepAlive() { if (S.keepAlive) { clearInterval(S.keepAlive); S.keepAlive = null; } }
  function iniciarKeepAlive() {
    pararKeepAlive();
    S.keepAlive = setInterval(function () {
      if (S.estado !== 'leyendo') return;
      if (speechSynthesis.speaking && !speechSynthesis.paused) {
        speechSynthesis.pause(); speechSynthesis.resume();
      }
    }, 9000);
  }
  function pararWatchdog() { if (S.watchdog) { clearTimeout(S.watchdog); S.watchdog = null; } }

  function cancelarVoz() {
    S.gen++;
    pararWatchdog();
    pararKeepAlive();
    try { speechSynthesis.cancel(); } catch (e) { /* nada */ }
  }

  /* iOS/Safari solo permite hablar si el primer speak() sale de un
     toque real. Se dispara uno mudo al pulsar el botón.           */
  function desbloquear() {
    if (S.desbloqueado || !soportaVoz) return;
    try {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      speechSynthesis.speak(u);
      S.desbloqueado = true;
    } catch (e) { /* nada */ }
  }

  function armarWatchdog(largo, seguir) {
    pararWatchdog();
    // ~14 caracteres por segundo a velocidad 1, con margen amplio
    const estimado = (largo / (14 * Math.max(0.5, S.velocidad))) * 1000;
    S.watchdog = setTimeout(function () {
      if (S.estado !== 'leyendo') return;
      try { speechSynthesis.cancel(); } catch (e) { /* nada */ }
      seguir();
    }, 6000 + estimado * 2.5);
  }

  function hablarActual() {
    if (S.estado !== 'leyendo') return;
    const texto = S.trozos[S.idxTrozo];
    if (texto === undefined) { avanzarPagina(); return; }

    const gen = S.gen;
    const u = new SpeechSynthesisUtterance(texto);
    if (S.voz) { u.voice = S.voz; u.lang = S.voz.lang; }
    u.rate = S.velocidad;
    u.pitch = CFG.tono;
    u.volume = 1;

    let avanzado = false;
    const seguir = function () {
      if (gen !== S.gen || avanzado) return;
      avanzado = true;
      pararWatchdog();
      S.idxTrozo++;
      pintarProgreso();
      if (S.idxTrozo >= S.trozos.length) avanzarPagina();
      else { marcarFraseActual(); hablarActual(); }
    };

    u.onstart = function () { if (gen === S.gen) armarWatchdog(texto.length, seguir); };
    u.onend = seguir;
    u.onerror = function (ev) {
      if (gen !== S.gen) return;
      const cual = ev && ev.error;
      if (cual === 'canceled' || cual === 'interrupted') return;  // fuimos nosotros
      if (cual === 'not-allowed') {
        S.estado = 'pausado'; pintarPlay();
        estado('Toca ▶ para permitir el audio', 'pausado');
        return;
      }
      seguir();  // cualquier otro fallo: no trabarse, seguir adelante
    };

    try {
      speechSynthesis.speak(u);
      iniciarKeepAlive();
      armarWatchdog(texto.length, seguir);  // red extra por si onstart no llega
    } catch (e) { seguir(); }
  }

  async function avanzarPagina() {
    const gen = S.gen;
    let n = S.pagina + 1;
    let vacias = 0;
    while (n <= S.totalPag) {
      let trozos = [];
      try { trozos = await trozosDePagina(n); } catch (e) { trozos = []; }
      if (gen !== S.gen) return;
      if (trozos.length) {
        S.pagina = n; S.trozos = trozos; S.idxTrozo = 0;
        guardarPos(S.libro && S.libro.codigo, n);
        estado('Leyendo…', 'leyendo');
        pintarProgreso(); pintarTexto();
        precargar(n + 1);
        hablarActual();
        return;
      }
      if (!CFG.saltarPaginasSinTexto) break;
      vacias++;
      S.pagina = n;
      pintarProgreso();
      if (vacias % 5 === 0) estado('Saltando páginas sin texto (' + n + ')…', 'cargando');
      if (vacias >= CFG.maxPaginasVaciasSeguidas) {
        terminar('Este PDF parece escaneado: no tiene texto que se pueda leer.');
        return;
      }
      n++;
    }
    terminar('Documento terminado.');
  }

  function precargar(n) {
    if (!S.doc || n > S.totalPag || S.cache.has(n)) return;
    trozosDePagina(n).catch(function () { /* se reintenta al llegar */ });
  }

  function terminar(msg) {
    cancelarVoz();
    S.estado = 'fin';
    pintarPlay();
    estado(msg || 'Documento terminado.', 'fin');
    elFill.style.width = '100%';
    if (S.libro) guardarPos(S.libro.codigo, 0);  // terminado → volver a empezar
  }

  /* ============================================================
     10. ABRIR EL DOCUMENTO (cadena de fuentes)
     ============================================================ */
  async function abrirConPdfJs(origen) {
    const pdfjs = await cargarPdfJs();
    const opciones = {
      cMapUrl: CFG.pdfjsCMaps,
      cMapPacked: true,
      standardFontDataUrl: CFG.pdfjsFuentes
    };
    if (origen.url) {
      opciones.url = origen.url;
      opciones.withCredentials = false;
      opciones.disableAutoFetch = true;   // baja solo lo necesario
      opciones.disableStream = false;
    } else {
      opciones.data = origen.bytes;
    }
    const tarea = pdfjs.getDocument(opciones);
    tarea.onProgress = function (p) {
      if (S.estado === 'cargando' && p && p.total) {
        estado('Descargando… ' + Math.round((p.loaded / p.total) * 100) + '%', 'cargando');
      }
    };
    S.doc = await tarea.promise;
    S.totalPag = S.doc.numPages;
  }

  async function abrirDocumento() {
    const libro = S.libro;
    if (!libro) return false;

    if (location.protocol === 'file:') {
      S.estado = 'error';
      estado('Abre el sitio desde un servidor, no con doble clic al archivo.', 'error');
      return false;
    }

    S.estado = 'cargando'; pintarPlay();
    ocultarZonaArchivo();

    /* ---- Fuente 1: archivo local del proyecto o pdfUrl propio ---- */
    const directa = urlDirecta(libro);
    if (directa) {
      estado('Abriendo el documento…', 'cargando');
      try {
        await abrirConPdfJs({ url: directa });
        S.fuente = 'directa';
        return true;
      } catch (e) { /* seguimos con las otras fuentes */ }
    }

    /* ---- Fuente 2: caché de este navegador ---- */
    if (libro.codigo) {
      estado('Buscando en la memoria del navegador…', 'cargando');
      const guardado = await leerDeCache(libro.codigo);
      if (guardado && guardado.byteLength) {
        try {
          await abrirConPdfJs({ bytes: guardado });
          S.fuente = 'cache';
          estado('Cargado desde este navegador.', 'cargando');
          return true;
        } catch (e) { /* caché corrupta: seguimos */ }
      }
    }

    /* ---- Fuente 3: espejos públicos gratuitos (PDF chicos) ---- */
    if (libro.driveId) {
      try {
        const bytes = await bytesDesdeEspejos(libro);
        if (bytes) {
          await guardarEnCache(libro.codigo, bytes.slice(0));
          await abrirConPdfJs({ bytes: bytes });
          S.fuente = 'espejo';
          return true;
        }
      } catch (e) { /* seguimos */ }
    }

    /* ---- Fuente 4: el usuario elige el archivo (siempre funciona) ---- */
    S.estado = 'apagado'; pintarPlay();
    estado('Falta el archivo para poder leerlo', 'apagado');
    mostrarZonaArchivo(libro.driveId
      ? 'Este PDF es muy grande para bajarlo desde la web. Se arregla en dos toques (solo esta vez):'
      : 'No se pudo abrir el archivo. Elígelo desde tu dispositivo:');
    return false;
  }

  async function usarArchivoLocal(file) {
    if (!file) return;
    if (!/pdf/i.test(file.type) && !/\.pdf$/i.test(file.name)) {
      estado('Ese archivo no es un PDF.', 'error');
      return;
    }
    cancelarVoz();
    S.estado = 'cargando'; pintarPlay();
    estado('Leyendo ' + file.name + '…', 'cargando');
    try {
      const bytes = await file.arrayBuffer();
      if (!esPDF(bytes)) { estado('Ese archivo no es un PDF válido.', 'error'); S.estado = 'error'; return; }
      if (S.libro && S.libro.codigo) await guardarEnCache(S.libro.codigo, bytes.slice(0), file.name);
      if (S.doc && S.doc.destroy) { try { S.doc.destroy(); } catch (e) { /* nada */ } }
      S.cache.clear();
      await abrirConPdfJs({ bytes: bytes });
      S.fuente = 'archivo';
      ocultarZonaArchivo();
      const guardada = posGuardada(S.libro && S.libro.codigo);
      empezarDesde(guardada > 1 ? guardada : 1);
    } catch (e) {
      S.estado = 'error'; pintarPlay();
      estado('No se pudo abrir ese PDF: ' + String((e && e.message) || e).slice(0, 60), 'error');
    }
  }

  /* ============================================================
     11. REPRODUCIR / PAUSAR / SALTAR
     ============================================================ */
  async function empezarDesde(pagina) {
    const gen = ++S.gen;
    let n = Math.max(1, Math.min(pagina || 1, S.totalPag));
    let vacias = 0;
    estado('Buscando texto…', 'cargando');
    while (n <= S.totalPag) {
      let trozos = [];
      try { trozos = await trozosDePagina(n); } catch (e) { trozos = []; }
      if (gen !== S.gen) return;
      if (trozos.length) {
        S.pagina = n; S.trozos = trozos; S.idxTrozo = 0;
        S.estado = 'leyendo'; pintarPlay();
        estado('Leyendo…', 'leyendo');
        pintarProgreso(); pintarTexto();
        precargar(n + 1);
        hablarActual();
        return;
      }
      vacias++;
      if (vacias >= CFG.maxPaginasVaciasSeguidas) {
        terminar('Este PDF parece escaneado: no tiene texto que se pueda leer.');
        return;
      }
      n++;
    }
    terminar('No se encontró texto en el documento.');
  }

  async function reproducir() {
    desbloquear();
    if (S.estado === 'leyendo') return pausar();

    if (!S.doc) {
      const ok = await abrirDocumento();
      if (!ok) return;
      const guardada = posGuardada(S.libro && S.libro.codigo);
      return empezarDesde(guardada > 1 ? guardada : 1);
    }

    if (S.estado === 'pausado' && S.trozos.length) {
      S.gen++;                        // invalida lo anterior
      S.estado = 'leyendo'; pintarPlay();
      estado('Leyendo…', 'leyendo');
      // Repite la frase actual desde el principio: es mucho más
      // fiable que speechSynthesis.resume(), que falla en Android.
      setTimeout(hablarActual, 120);
      return;
    }
    return empezarDesde(S.pagina || 1);
  }

  function pausar() {
    if (S.estado !== 'leyendo') return;
    cancelarVoz();
    S.estado = 'pausado'; pintarPlay();
    estado('En pausa · pág. ' + S.pagina, 'pausado');
    guardarPos(S.libro && S.libro.codigo, S.pagina);
  }

  function detener() {
    cancelarVoz();
    S.estado = 'apagado'; pintarPlay();
    S.idxTrozo = 0;
    estado('Detenido', 'apagado');
    pintarProgreso();
  }

  async function saltarPagina(delta) {
    if (!S.doc) return;
    const destino = Math.max(1, Math.min(S.pagina + delta, S.totalPag));
    if (destino === S.pagina && delta !== 0) return;
    const seguiaLeyendo = S.estado === 'leyendo';
    cancelarVoz();
    S.pagina = destino;
    S.idxTrozo = 0;
    guardarPos(S.libro && S.libro.codigo, destino);
    if (seguiaLeyendo) { S.estado = 'leyendo'; return empezarDesde(destino); }
    S.estado = 'pausado'; pintarPlay();
    estado('Pág. ' + destino + ' · pulsa ▶', 'pausado');
    try { S.trozos = await trozosDePagina(destino); } catch (e) { S.trozos = []; }
    pintarProgreso(); pintarTexto();
  }

  /* ============================================================
     12. EVENTOS DE LA INTERFAZ
     ============================================================ */
  elPlay.addEventListener('click', reproducir);
  $('vozStop').addEventListener('click', detener);
  $('vozPrev').addEventListener('click', function () { saltarPagina(-1); });
  $('vozNext').addEventListener('click', function () { saltarPagina(1); });
  $('vozCerrar').addEventListener('click', function () { cerrarDock(); });

  $('vozArchivo').addEventListener('change', function (e) {
    usarArchivoLocal(e.target.files && e.target.files[0]);
    e.target.value = '';   // permite volver a elegir el mismo archivo
  });

  $('vozTextoBtn').addEventListener('click', function () {
    S.mostrarTexto = !S.mostrarTexto;
    this.classList.toggle('is-on', S.mostrarTexto);
    pintarTexto();
  });

  selVel.addEventListener('change', function () {
    S.velocidad = parseFloat(this.value) || 1;
    const pref = leerJSON(CLAVE_PREF, {}); pref.vel = S.velocidad; guardarJSON(CLAVE_PREF, pref);
    if (S.estado === 'leyendo') { S.gen++; setTimeout(hablarActual, 120); }  // aplicar al vuelo
  });

  selVoz.addEventListener('change', function () {
    const v = speechSynthesis.getVoices().find(function (x) { return x.voiceURI === selVoz.value; });
    if (!v) return;
    S.voz = v;
    const pref = leerJSON(CLAVE_PREF, {}); pref.voz = v.voiceURI; guardarJSON(CLAVE_PREF, pref);
    if (S.estado === 'leyendo') { S.gen++; setTimeout(hablarActual, 120); }
  });

  elTexto.addEventListener('click', function (e) {
    const sp = e.target.closest('.voz-frase');
    if (!sp) return;
    S.idxTrozo = Number(sp.dataset.i) || 0;
    marcarFraseActual();
    pintarProgreso();
    if (S.estado === 'leyendo') { S.gen++; setTimeout(hablarActual, 120); }
  });

  /* Arrastrar y soltar el PDF sobre el lector */
  ['dragenter', 'dragover'].forEach(function (ev) {
    panel.addEventListener(ev, function (e) {
      if (dock.hidden) return;
      e.preventDefault();
      panel.classList.add('voz-soltando');
    });
  });
  ['dragleave', 'dragend'].forEach(function (ev) {
    panel.addEventListener(ev, function (e) {
      if (e.target === panel) panel.classList.remove('voz-soltando');
    });
  });
  panel.addEventListener('drop', function (e) {
    if (dock.hidden) return;
    e.preventDefault();
    panel.classList.remove('voz-soltando');
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) usarArchivoLocal(f);
  });

  function mensajeInicial() {
    const g = posGuardada(S.libro && S.libro.codigo);
    estado(g > 1 ? 'Continuará en la pág. ' + g + ' · pulsa ▶'
                 : 'Pulsa ▶ para empezar a escuchar', 'apagado');
  }
  function abrirDock() {
    dock.hidden = false;
    btnEscuchar.classList.add('is-activo');
    panel.classList.add('tiene-voz');
    if (!S.doc) mensajeInicial();
    prepararVoces();
    $('vozTextoBtn').classList.toggle('is-on', S.mostrarTexto);
  }
  function cerrarDock() {
    detener();
    dock.hidden = true;
    ocultarZonaArchivo();
    btnEscuchar.classList.remove('is-activo');
    panel.classList.remove('tiene-voz');
  }

  btnEscuchar.addEventListener('click', function () {
    if (!soportaVoz) {
      dock.hidden = false;
      estado('Este navegador no tiene síntesis de voz.', 'error');
      return;
    }
    desbloquear();
    if (dock.hidden) abrirDock(); else cerrarDock();
  });

  /* ============================================================
     13. ENGANCHE CON EL LECTOR EXISTENTE
         Se envuelve openReader() sin reescribirla, y se vigila el
         cierre del modal por cualquier vía (botón, Escape, clic
         fuera) con un MutationObserver.
     ============================================================ */
  function libroPorCodigo(codigo) {
    if (typeof LIBROS === 'undefined') return null;
    return LIBROS.find(function (l) { return l.codigo === codigo; }) || null;
  }

  function reiniciarPara(libro) {
    cancelarVoz();
    S.libro = libro || null;
    if (S.doc && S.doc.destroy) { try { S.doc.destroy(); } catch (e) { /* nada */ } }
    S.doc = null; S.totalPag = 0; S.pagina = 1; S.trozos = []; S.idxTrozo = 0;
    S.cache.clear(); S.fuente = '';
    S.estado = 'apagado';
    pintarPlay(); pintarProgreso(); ocultarZonaArchivo();
    elTexto.innerHTML = '';
    mensajeInicial();
  }

  if (typeof window.openReader === 'function') {
    const original = window.openReader;
    window.openReader = function (libro) {
      const r = original.apply(this, arguments);
      try {
        cerrarDock();   // cada libro arranca con el panel recogido…
        reiniciarPara(libro || libroPorCodigo(document.getElementById('readerCode').textContent));
      } catch (e) { /* nunca romper el lector */ }
      return r;
    };
  }

  new MutationObserver(function () {
    if (!overlay.classList.contains('is-open')) {
      if (S.estado === 'leyendo' || S.estado === 'pausado') {
        guardarPos(S.libro && S.libro.codigo, S.pagina);
      }
      cerrarDock();
    }
  }).observe(overlay, { attributes: true, attributeFilter: ['class'] });

  // Si el modal ya estuviera abierto (o si openReader no existiera),
  // se detecta el libro por su código visible en la barra.
  new MutationObserver(function () {
    const code = document.getElementById('readerCode').textContent.trim();
    if (S.libro && S.libro.codigo === code) return;
    const l = libroPorCodigo(code);
    if (l) reiniciarPara(l);
  }).observe(document.getElementById('readerCode'), { childList: true, characterData: true, subtree: true });

  // Nunca dejar la voz sonando al salir de la página
  window.addEventListener('pagehide', cancelarVoz);
  window.addEventListener('beforeunload', cancelarVoz);

  /* Pequeña API por si quieres controlarlo desde la consola */
  window.LABTECA_VOZ = {
    reproducir: reproducir, pausar: pausar, detener: detener,
    irAPagina: function (n) { saltarPagina(n - S.pagina); },
    estado: function () { return { pagina: S.pagina, total: S.totalPag, modo: S.estado, fuente: S.fuente }; },
    borrarCache: function () {
      try { indexedDB.deleteDatabase(DB_NOMBRE); return 'Caché de PDF borrada.'; }
      catch (e) { return 'No se pudo borrar.'; }
    },
    config: CFG
  };
})();
