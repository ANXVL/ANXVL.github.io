# Guía de uso y mantenimiento — ANXVL LABTECA

> [!NOTE]
> Este documento es la referencia técnica para mantener y editar el
> proyecto (agregar libros, fotos, entender la estructura, etc.).
> Si buscas la presentación general del proyecto, vuelve al
> [README principal](../README.md).

Sitio estático (HTML, CSS y JavaScript separados) para mostrar y leer libros
de laboratorio clínico alojados en Google Drive, sin exponer nunca la
interfaz de Drive al usuario final.

## Estructura del proyecto

```
labteca/
├── index.html                 → estructura de la página (HTML)
├── index-completo.html        → la misma página en UN SOLO archivo (CSS y JS inline)
├── manifest.webmanifest       → permite "agregar a pantalla de inicio" en móviles
├── README.md                  → presentación del proyecto (este documento es otro)
├── LICENSE
├── docs/
│   ├── GUIA-DE-USO.md          → este documento
│   └── screenshots/            → capturas usadas en el README
├── css/
│   └── style.css              → todos los estilos (colores, tipografía, responsive, tema oscuro)
├── js/
│   ├── data.js                 → SOLO datos: categorías, libros y galería
│   └── main.js                 → lógica: filtros, búsqueda, lector, galería, tema, progreso
└── assets/
    ├── icons/                   → favicon (svg, ico, png en varios tamaños)
    └── img/
        ├── galeria/             → vacía; solo se usa si guardas alguna foto local (opcional)
        └── portadas/            → portadas propias de cada libro (aún vacías)
            ├── parasitologia/  ├── insertos/
            ├── hematologia/    ├── microbiologia/
            ├── uroanalisis/    ├── inmunologia/
            ├── cultivos/       ├── bioquimica/
            ├── anatomia/       └── general/
```


Todo el catálogo y la galería de fotos están alojados en Google Drive — el
proyecto en sí pesa apenas unos cientos de KB, nada de PDFs ni fotos
pesadas dentro del zip.

Para el día a día se recomienda seguir usando la versión por carpetas
(`labteca/`), ya que es más fácil de mantener y editar. `index-completo.html`
es útil solo si necesitas compartir o subir un único archivo autocontenido.

## Categorías

`parasitologia`, `hematologia`, `uroanalisis`, `cultivos`, `anatomia`,
`bioquimica`, `insertos`, `microbiologia`, `inmunologia`, `general` (manuales
de referencia amplios, como "La Clínica y el Laboratorio" de Balcells, que
no son específicos de una sola área).

## Cómo ver el sitio

Abre `index.html` con doble clic, o súbelo a cualquier hosting estático
(GitHub Pages, Netlify, Vercel, hosting compartido, etc.). No necesita
servidor ni instalación: es HTML, CSS y JS puros.

## Cómo agregar un libro

Abre `js/data.js` y copia un bloque dentro del arreglo `LIBROS`:

```js
{
  id: 161,
  categoria: 'uroanalisis',
  codigo: 'URO-29',
  titulo: 'Nombre del libro',
  autor: 'Autor',
  edicion: 'Edición',
  descripcion: 'Descripción breve.',
  driveId: 'ID_DEL_ARCHIVO_DE_DRIVE'  // el código entre "/d/" y "/view" del enlace
}
```

**Importante:** en Google Drive, cada archivo debe compartirse como
*"Cualquiera con el enlace puede ver"*, o la portada y el lector no van a
cargar. Si un libro no tiene ese permiso, agrégale `permisoPendiente: true`
para que se marque con un aviso en su tarjeta y el lector muestre un
mensaje claro en vez de intentar cargar un documento roto.

Si alguna vez quieres agregar un documento que ya tengas guardado en el
propio proyecto (sin pasar por Drive), usa el campo `archivo` en vez de
`driveId`, apuntando a una ruta dentro de `assets/`:
```js
{ ..., archivo: 'assets/algo/documento.pdf' }
```

Recuerda que si editas `js/data.js` o `js/main.js`, `index-completo.html`
queda desactualizado — es un archivo generado, no se actualiza solo.

## Cómo poner tu propia portada a un libro

Cuando tengas las imágenes de portada, guárdalas en
`assets/img/portadas/<categoría>/` y agrega el campo `portada` al libro:
```js
{
  ...
  portada: 'assets/img/portadas/parasitologia/PARA-01.jpg'
}
```
Si no agregas `portada`, el sitio sigue mostrando automáticamente la
miniatura de Drive — no se rompe nada mientras tanto.

## Galería de imágenes del laboratorio

Cada foto vive en Google Drive, igual que los libros, y se referencia por
su `driveId` en el arreglo `GALERIA` de `js/data.js`:
```js
{ driveId: 'ID_DE_LA_IMAGEN_EN_DRIVE' },
```
**Importante:** la imagen en Drive debe compartirse como *"Cualquiera con
el enlace puede ver"*, igual que los libros.

Se muestran en un **paginador de tamaño fijo**: 12 fotos por página, con
flechas `‹ ›` y "Página X / Y" — la cuadrícula nunca cambia de tamaño ni de
posición. Al tocar una foto se abre un visor de pantalla completa que
recorre todas las fotos (no solo la página actual), con flechas, deslizar
con el dedo, las flechas del teclado, y un fundido suave entre foto y foto.

Si alguna vez prefieres usar una foto guardada dentro del propio proyecto
en lugar de Drive, sigue siendo posible con el campo `src` en vez de
`driveId`:
```js
{ src: 'assets/img/galeria/foto.jpg' },
```

## Cómo funciona el "ocultamiento" de Drive

- **Portada del libro:** miniatura de Drive (`/thumbnail?id=...`), que no
  muestra ninguna interfaz de Drive.
- **Botón "Leer":** abre un visor propio (modal) que carga el visor oficial
  `/preview` de Drive dentro de un recuadro recortado, para que la barra
  superior de Drive quede fuera de la vista. Incluye botones propios de
  zoom (**+ / −**, con transición suave), ya que el visor de Drive no
  permite pinch-zoom dentro del recuadro recortado. Si el documento no
  carga (por ejemplo, si no tiene el permiso público activado, o si no hay
  conexión), se muestra un aviso claro en vez de dejar la ventana en blanco.
- **Botón "Descargar":** enlace directo `uc?export=download&id=...`.

### Límites a tener en cuenta
- El recorte de la barra de Drive es un ajuste visual por píxeles (variable
  `--drive-bar-offset` en `css/style.css`); puede variar levemente según el
  navegador o el tamaño de pantalla.
- Archivos de Drive mayores a 100 MB pueden mostrar la pantalla de
  confirmación de Google antes de descargar — eso lo controla Google, no
  el sitio.
- Un libro con la etiqueta "Falta compartir en Drive" significa que el
  archivo todavía no tiene permiso público de lectura.

## Estado de lectura ("Leyendo" / "Leído")

Cada tarjeta tiene un botón circular (marcador) en la esquina de la
portada para marcar el libro como **Leyendo** o **Leído** (con una breve
animación de confirmación al completarlo); un tercer clic lo regresa a su
estado original. Esto se guarda en el navegador de quien lo usa (no
requiere cuenta ni conexión a un servidor), así que **no se comparte entre
dispositivos** ni sobrevive si se borra el caché del navegador.

- La barra de progreso arriba del catálogo muestra cuántos libros están
  leídos y cuántos en progreso.
- Los chips "Leyendo" / "Leídos" en Categorías filtran el catálogo por
  ese estado.
- La franja **"Retomar"**, arriba del catálogo, aparece automáticamente en
  cuanto hay al menos un libro marcado "Leyendo" y da acceso directo a su
  lector sin tener que volver a buscarlo.

## Buscar y explorar

- El cuadro de búsqueda filtra por título o autor en tiempo real.
- Atajo de teclado **`/`** para saltar directo al buscador (se desactiva
  automáticamente si ya hay un modal abierto, para no interferir).
- Botón **"Al azar"** (con una pequeña animación de dado) junto al
  contador del catálogo: abre el lector de un libro cualquiera de todo el
  catálogo — útil para explorar sin buscar nada en particular.
- La gradilla de tubos del inicio también funciona como acceso rápido:
  tocar un tubo filtra el catálogo por esa categoría.

## Tema claro / oscuro

Botón de sol/luna en el encabezado. La primera vez que alguien visita el
sitio, se usa automáticamente el tema que tenga configurado su sistema
operativo o navegador; después de eso, su elección manual se recuerda en
ese navegador, con un fundido suave al cambiar entre uno y otro. El tema
claro es el de siempre, sin cambios. El oscuro usa **negro puro** como
base con un fondo animado tipo espacio (estrellas titilando + nebulosas en
los mismos tonos violeta/teal de la marca) detrás de las secciones — las
tarjetas y superficies se mantienen en tonos oscuros sólidos para que el
texto siga siendo legible.

## Animaciones y efectos

- Fundido suave al cambiar de tema claro/oscuro.
- Entrada escalonada de las tarjetas del catálogo y la galería cada vez
  que se filtran o cambian de página.
- Fundido entre foto y foto al navegar la galería a pantalla completa.
- Zoom con transición suave dentro del lector de documentos.
- Animación de "dado rodando" en el botón "Al azar".
- Ping de confirmación al marcar un libro como "Leído".
- Barra de progreso de lectura en la parte superior de la página, según
  el avance del scroll.
- Números animados (contador ascendente) en las estadísticas del inicio.
- Aparición progresiva de las secciones al hacer scroll.
- Fondo animado tipo espacio en el tema oscuro; tubos de la gradilla con
  ligera flotación y "llenado líquido" al pasar el cursor.
- Todas las animaciones respetan la preferencia "reducir movimiento" del
  sistema operativo, y se desactivan automáticamente si está activada.

## Accesibilidad

- Enlace "Saltar al contenido" (aparece al navegar con Tab) para quien usa
  teclado o lector de pantalla.
- El lector de documentos y el visor de galería atrapan el foco del
  teclado mientras están abiertos (Tab no se escapa hacia el contenido de
  fondo) y devuelven el foco a donde estaba al cerrarlos.
- Los filtros de categoría y de estado indican su estado seleccionado
  (`aria-pressed`) para lectores de pantalla.
- Contraste cuidado en ambos temas, foco visible en todos los controles.

## Estabilidad del diseño (nada se mueve ni se desborda)

Se reforzó el CSS para que ningún elemento empuje el ancho de la página:
- `overflow-x: hidden` en `html`/`body` como salvaguarda general.
- La gradilla de tubos, los filtros y la franja "Retomar" usan
  desplazamiento horizontal propio (con un desvanecido sutil en los
  bordes) en vez de poder ensanchar la página.
- Las miniaturas de la galería usan columnas fijas por tamaño de pantalla
  (2 / 3 / 4) en vez de un cálculo automático que podía variar.
- Se evitaron propiedades CSS de soporte todavía irregular en navegadores
  y WebViews más antiguos (`aspect-ratio`, `color-mix()`), a favor de
  técnicas equivalentes con compatibilidad universal.
- Verificado sin desbordamiento horizontal en 4 anchos de pantalla
  distintos (320px, 390px, 768px, 1440px), en ambos temas.

## Contraste del footer y SEO

En el tema oscuro, el footer reutilizaba la misma variable de color que
los botones (`--brand-dark`), pensada para verse bien en superficies
pequeñas y vibrantes — no para un fondo grande con texto encima. El
resultado eran textos casi ilegibles (se midió un contraste de apenas
1.11:1 en el peor caso, muy por debajo del mínimo de 4.5:1 recomendado).
Se creó una variable propia para el footer (`--footer-bg`) con un violeta
bien oscuro, sin tocar el color de los botones. Ahora el texto del footer
tiene contraste de 12:1 a 18:1 según el elemento — muy por encima del
mínimo recomendado.

También se quitó la línea "Un proyecto de ANXVL · cero huellas" del
footer visible, y en su lugar se reforzó la atribución a ANXVL donde
realmente ayuda: un `<meta name="author">` y un bloque de datos
estructurados (JSON-LD, `schema.org/WebSite`) en el `<head>` del
documento, que es la forma en que los buscadores asocian un sitio con su
autor — más efectivo para SEO que una línea de texto en el pie de página.

## Rendimiento

Se detectó y corrigió un problema real de lentitud al cambiar entre tema
claro/oscuro (se notaba, por ejemplo, en que la gradilla del inicio se
quedaba "pegada" en negro un momento). Dos causas, medidas con el
profiler de Chrome antes y después de corregir:

1. La transición de colores estaba aplicada a *todos* los elementos de la
   página a la vez (con `!important`), obligando al navegador a redibujar
   cientos de tarjetas y sombras al mismo tiempo. Se reemplazó por una
   "cortina" (`#themeFlash`) que solo anima su propia opacidad — un único
   elemento, en vez de miles.
2. Con el catálogo completo (126+ libros) sin paginar, cambiar de tema
   obligaba a recalcular el estilo de todas las tarjetas aunque casi
   ninguna estuviera a la vista. Se agregó `content-visibility: auto` a
   las tarjetas, que le dice al navegador que no calcule diseño ni
   pintura de las que están fuera de pantalla.

Con ambas correcciones, el tiempo que el cambio de tema bloquea la
página bajó de más de 2.5 segundos a entre 100–170 milisegundos, medido
con CPU simulada 4 veces más lenta (para representar un celular modesto).
Se puede seguir agregando libros sin que este problema regrese, ya que
`content-visibility` escala automáticamente con el tamaño del catálogo.

## Notas de la auditoría de código

El proyecto se revisó línea por línea y se probó en un navegador real
(escritorio y móvil, tema claro y oscuro) antes de esta entrega. Entre lo
corregido:
- Un mensaje de "sin resultados" que no aparecía correctamente al buscar
  un término inexistente (mostraba, en cambio, las 10 categorías como si
  estuvieran vacías).
- El aviso de "no se pudo cargar el documento" en el lector, que nunca
  llegaba a mostrarse aunque el documento fallara.
- Reglas de CSS que ya no tenían efecto (sobrantes de una versión
  anterior de la galería).
- Archivos `.gitkeep` (ocultos) en las carpetas de portadas, que GitHub
  bloquea al subir por arrastrar-y-soltar — reemplazados por `README.md`.
