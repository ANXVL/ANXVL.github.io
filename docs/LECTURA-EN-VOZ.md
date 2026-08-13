# Lectura en voz alta

Dentro del lector aparece un botón de altavoz. Al pulsarlo se abre un panel que
lee el PDF en voz alta y **avanza solo de página en página hasta terminar todo
el documento**.

**No hace falta ninguna API key, ninguna cuenta, ni registrarse en nada.**

- Salta solas las páginas sin texto (portadas, láminas, separadores).
- Recuerda en qué página quedaste de cada libro y ofrece continuar ahí.
- Velocidad de 0.75× a 2× y elección de voz.
- Puede mostrar el texto e ir resaltando la frase que suena; si tocas otra
  frase, salta a ella.
- Al cerrar el lector, la voz se detiene sola.

---

## De dónde saca el PDF

El módulo lo intenta en este orden, **solo**, sin preguntar nada:

| # | Fuente | Cuándo aplica |
|---|---|---|
| 1 | Archivo del proyecto (`archivo`) o URL propia (`pdfUrl`) | Instantáneo |
| 2 | Memoria de este navegador | Si ya lo leíste antes: instantáneo y sin internet |
| 3 | Espejos públicos gratuitos | PDF chicos: insertos, guías, artículos |
| 4 | Elegir el PDF desde tu dispositivo | **Siempre funciona** |

Si los tres primeros no dan resultado, el panel muestra dos botones:
**1. Descargar el PDF** → **2. Elegir el PDF**. También puedes arrastrar el
archivo directamente sobre el lector.

Eso se hace **una sola vez por libro**: el PDF queda guardado en el navegador y
la próxima vez el botón ▶ arranca de inmediato.

---

## Por qué los libros grandes piden el paso 4

El navegador **prohíbe** que una página web lea con JavaScript el contenido de
`drive.google.com`. Es una regla de seguridad del propio navegador (CORS), no
un permiso de Drive: aunque el archivo esté como "cualquiera con el enlace", el
texto no se puede extraer por esa vía.

Los espejos públicos gratuitos esquivan esa regla, pero cortan alrededor de los
**5 MB** (CodeTabs, por ejemplo, lo dice en su documentación). Sirven de sobra
para insertos y guías cortas; un libro de 40 MB no pasa por ahí. De ahí el
paso 4, que no depende de nadie y funciona siempre.

---

## Si quieres que TODO sea automático

Sube los PDF a cualquier sitio que permita CORS y agrégale al libro el campo
`pdfUrl`. `raw.githubusercontent.com` sirve tal cual:

```js
{
  id: 2, categoria: 'parasitologia', codigo: 'PARA-02',
  titulo: 'Atlas de Parasitología', autor: 'Consuelo López',
  descripcion: '...',
  driveId: '1tG5vg-iYxHE3Fv_iusKDbxL6srGh-xFo',  // sigue sirviendo para ver y descargar
  pdfUrl: 'https://raw.githubusercontent.com/ANXVL/labteca-pdfs/main/PARA-02.pdf'
}
```

El visor y el botón de descarga siguen usando Drive; `pdfUrl` se usa **solo**
para la voz. (GitHub admite hasta 100 MB por archivo.)

---

## PDF escaneados

Muchos atlas son fotos de páginas, no texto. Ahí no hay nada que leer: el
módulo lo detecta, avisa *"Este PDF parece escaneado"* y se detiene en vez de
quedarse en silencio. Para esos habría que pasarlos antes por un OCR (por
ejemplo con `ocrmypdf`) y volverlos a subir.

---

## Ajustes

Todo está al inicio de `js/lector-voz.js`, en el bloque `CFG`:

| Opción | Para qué sirve |
|---|---|
| `maxCaracteresPorFrase` | Largo de cada fragmento hablado (190 es lo más estable) |
| `velocidad` | Velocidad inicial |
| `idiomaPreferido` | Prefijo del idioma para elegir voz (`'es'`) |
| `saltarPaginasSinTexto` | Saltar portadas y láminas |
| `maxPaginasVaciasSeguidas` | Páginas mudas seguidas antes de avisar "escaneado" |
| `expandirUnidades` | Leer `mg/dL` como "miligramos por decilitro" |
| `usarEspejos` | Ponlo en `false` si prefieres que ningún documento pase por un tercero |
| `usarCache` / `maxLibrosEnCache` | Guardar PDF en el navegador y cuántos |

Para agregar más unidades de laboratorio, edita el arreglo `UNIDADES` en ese
mismo archivo.

**Nota de privacidad:** los espejos del paso 3 son servicios de terceros por los
que pasa el archivo. Tus libros de Drive ya son públicos, así que el riesgo es
mínimo, pero si prefieres evitarlo pon `usarEspejos: false` y el módulo usará
siempre el paso 4.

---

## Desde la consola del navegador

```js
LABTECA_VOZ.estado()       // { pagina, total, modo, fuente }
LABTECA_VOZ.irAPagina(50)
LABTECA_VOZ.borrarCache()  // vacía los PDF guardados
```

---

## Compatibilidad

- **Chrome, Edge, Firefox y Safari** de escritorio: funciona.
- **Android**: funciona; usa las voces de Google TTS del sistema.
- **iPhone/iPad**: hay que pulsar ▶ (el primer sonido debe salir de un toque
  real; el módulo ya lo maneja).
- Si abres `index.html` con doble clic (`file://`), el módulo avisa que hay que
  servirlo desde un servidor o desde GitHub Pages.
