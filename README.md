# Portafolio ANXVL

Sitio estático para publicar proyectos web. Sin compilación, sin dependencias:
se abre con doble clic o se sube tal cual a cualquier hosting.

## Estructura

```
portafolio/
├── index.html                  Portada           →  /
├── proyectos/
│   ├── index.html              Catálogo          →  /proyectos/
│   ├── pixelshrink/            ← pixelshrink     →  /proyectos/pixelshrink/
│   ├── nova-wing/              ← NOVA_SWING_GAME
│   ├── labteca/                ← BIBLIOTECA_WEB
│   ├── anxvl-code/             ← ANXVL_EDITOR_STUDIO
│   ├── candy-cosmos/           ← CANDY_COSMOS
│   ├── vault-zero/             ← PASSWORD_VAULT-ZERO
│   └── metaclean-pro/          ← METACLEAN
├── sobre/index.html            Sobre mí          →  /sobre/
├── contacto/index.html         Contacto          →  /contacto/
├── 404.html                    Página de error
├── site.webmanifest            Permite instalar la web como aplicación
├── README.md
└── assets/
    ├── css/
    │   ├── base.css            Reset, variables, accesibilidad, fondo
    │   ├── layout.css          Cabecera, secciones, rejillas, pie
    │   ├── componentes.css     Botones, tarjetas, filtros, iconos, efectos
    │   └── tema-anxvl.css      Identidad compartida por los 7 proyectos
    ├── js/
    │   ├── datos-proyectos.js  ← EL ÚNICO ARCHIVO QUE EDITAS
    │   ├── galaxia.js          Fondo animado, reutilizable en los proyectos
    │   ├── volver.js           Botón de regreso dentro de cada proyecto
    │   └── main.js             Render, filtros, búsqueda, revelado, menú
    └── img/
        ├── favicon.svg · favicon.ico · iconos.svg · og-anxvl.jpg
        ├── iconos/             Favicons PNG, apple-touch, iconos de app
        └── proyectos/          Miniaturas (1280×800)
```

## URLs limpias

Ninguna dirección muestra `index.html` ni la extensión `.html`. Cada sección
es una carpeta con su índice dentro, que es la forma que entienden por igual
GitHub Pages, Netlify y Cloudflare Pages:

| Enlace en el HTML  | URL que ve el visitante   |
|--------------------|---------------------------|
| `./`               | `tudominio.com/`          |
| `proyectos/`       | `tudominio.com/proyectos/` |
| `sobre/`           | `tudominio.com/sobre/`    |
| `contacto/`        | `tudominio.com/contacto/` |
| `proyectos/labteca/` | `tudominio.com/proyectos/labteca/` |

**Al abrir con doble clic** no hay servidor que resuelva el índice de una
carpeta, así que el navegador mostraría el listado de archivos. Para eso hay
un respaldo: `main.js` y `volver.js` detectan el protocolo `file://` y añaden
`index.html` a los enlaces internos sobre la marcha. En un servidor no hacen
nada y las URLs se ven limpias.

El único `.html` visible es `404.html`, y es a propósito: los hosts lo buscan
con ese nombre exacto.

## Estado

Los 7 proyectos ya están dentro, con sus archivos tal cual venían. Las rutas internas (`css/`, `js/`, `icons/`) se
comprobaron una a una y todas resuelven.

No se incluyeron los duplicados que traían algunos zips:
`NovaWing_index_completo.html` y `vault-zero-standalone.html` son versiones de
archivo único de proyectos que ya están en su carpeta.

Faltan de la lista original, porque no venían en el zip:
TERMUX_DEBIAN-V2, GIT-HU_CONFIGURACION, ANXVL-PHOTO y la versión con voz de la
biblioteca.

## Añadir un proyecto (3 pasos)

1. **Copia tu carpeta** dentro de `proyectos/`. Dentro debe haber un `index.html`.
   Ejemplo: `proyectos/mi-calculadora/index.html`.

2. **Pon una miniatura** en `assets/img/proyectos/`. Formato 16:10, por ejemplo
   1280×800. Sirve `.jpg`, `.png`, `.webp` o `.svg`.

3. **Añade el bloque** en `assets/js/datos-proyectos.js`:

```js
{
  id: "mi-calculadora",
  titulo: "Mi calculadora",
  resumen: "Una o dos frases sobre lo que hace, no sobre cómo está hecho.",
  categoria: "Herramientas",
  fecha: "2026-09",
  imagen: "assets/img/proyectos/mi-calculadora.png",
  enlace: "proyectos/mi-calculadora/",
  destacado: false
}
```

Guarda y recarga. La tarjeta aparece sola, ordenada por fecha.

> `destacado: true` solo en **uno**: es el que sale grande en la portada y no
> se repite en la rejilla de abajo.
> Categorías disponibles: Aplicaciones, Herramientas, Seguridad, Juegos. Si
> añades una nueva, ponla también en `CATEGORIAS` y crea su botón de filtro en
> `index.html` y `proyectos.html`.

## Personalizar

| Qué                  | Dónde                                                |
|----------------------|------------------------------------------------------|
| Nombre y logo        | `.marca` en cada `.html` y `assets/img/favicon.svg`  |
| Colores              | Bloque `:root` en `assets/css/base.css`              |
| Tipografía           | Variable `--fuente` en `assets/css/base.css`         |
| Correo de contacto   | Atributo `data-email` del formulario en `contacto.html` |
| Enlace de GitHub     | Sección "Enlaces" del pie                            |
| Galaxia del fondo    | Constante `AJUSTES` en `assets/js/galaxia.js`        |

## El fondo de galaxia

Un lienzo fijo detrás de todo, con una espiral que gira despacio y estrellas
que parpadean y derivan. La espiral se dibuja una sola vez y luego solo se rota,
así que el coste por fotograma es mínimo. Se detiene sola cuando cambias de
pestaña y no se anima si el sistema pide menos movimiento.

Todo se controla desde `AJUSTES`, arriba del todo de `assets/js/galaxia.js`:

| Ajuste      | Qué cambia                                        |
|-------------|---------------------------------------------------|
| `velocidad` | Lo rápido que gira. Más bajo, más lento.          |
| `centroX/Y` | Dónde queda el núcleo (0 a 1 de la pantalla).     |
| `tamano`    | Radio de la espiral.                              |
| `brazos`    | Número de brazos.                                 |
| `estrellas` | Densidad del campo de estrellas.                  |
| `nebulosa`  | Manchas de color al fondo. `false` para quitarlas. |
| `fugaces`   | Estrellas fugaces. `fugazCada` marca el intervalo. |
| `parallaxRaton`  | Cuánto se desplaza el cielo con el puntero.  |
| `parallaxScroll` | Cuánto sube el cielo al hacer scroll.        |

### La misma galaxia dentro de los proyectos

`galaxia.js` tiene dos ajustes preestablecidos: `pleno` (el del portafolio) y
`suave` (más tenue, más lento y con la mitad de estrellas, para ir detrás de
una interfaz con contenido). Un proyecto la activa con una sola línea, sin
tocar nada más de su HTML:

```html
<script src="../../assets/js/galaxia.js" data-fondo="suave"></script>
```

El script monta él mismo el lienzo. Los estilos salen de `tema-anxvl.css`, que
pasa el color de fondo del `<body>` al `<html>` para que se vea por detrás.

Está puesta en **PixelShrink, Labteca, MetaClean Pro y Vault Zero**, que son
los que tienen contenido que se desplaza y dejan ver el fondo. **Nova Wing,
Candy Cosmos y ANXVL Code** llenan la pantalla con sus propias superficies
opacas: ahí la galaxia no se vería y solo gastaría batería. Si aun así la
quieres en alguno, se activa con esa misma línea.

## Botón de regreso

Cada proyecto lleva esta línea antes de `</body>`:

```html
<script src="../../assets/js/volver.js"></script>
```

Crea un botón flotante que vuelve a la portada. No toca el CSS ni el HTML del
proyecto: se construye solo, con el prefijo `anxvl-` para no chocar con nada.
La posición se cambia con la constante `POSICION` en `volver.js`
(`abajo-izquierda` por defecto). Para quitarlo de un proyecto, borra su línea.

El degradado que oscurece la parte de abajo, para que el texto se lea, está en
`.cosmos::after` dentro de `base.css`.

Para quitar la galaxia: borra el div `.cosmos` de los cinco `.html` y la
etiqueta que carga `galaxia.js`.

## Publicar

**GitHub Pages** — sube la carpeta a un repositorio, entra en *Settings →
Pages* y elige la rama `main` y la raíz `/`. Queda en
`https://usuario.github.io/repositorio/`.

**Netlify o Vercel** — arrastra la carpeta a su panel. No hay comando de build:
el directorio de publicación es la raíz.

**Hosting propio** — sube todo por FTP a `public_html/`.

## Iconos

Todos los iconos de la interfaz salen de un sprite de símbolos. El bloque de
`assets/img/iconos.svg` va pegado en línea dentro del `<body>` de cada página,
oculto, y luego se usa así:

```html
<svg class="icono" aria-hidden="true"><use href="#i-flecha"></use></svg>
```

Va en línea a propósito: `<use>` apuntando a un archivo externo no funciona al
abrir la web con doble clic (protocolo `file://`). Todos los trazos usan
`currentColor`, así que cada icono hereda el color del texto que lo rodea y
funciona igual sobre cualquier fondo. El tamaño se controla con `font-size`
o con las clases `.icono--paso` y `.icono--vacio`.

Símbolos disponibles: `i-marca`, `i-inicio`, `i-proyectos`, `i-persona`,
`i-correo`, `i-github`, `i-aplicaciones`, `i-herramientas`, `i-seguridad`,
`i-juegos`, `i-flecha`, `i-arriba`, `i-buscar`, `i-menu`, `i-cerrar`,
`i-candado`, `i-rayo`, `i-sin-cuenta`, `i-vacio`.

Para añadir uno: pega un `<symbol id="i-loquesea" viewBox="0 0 16 16">` en
`iconos.svg`, cópialo al bloque de las cinco páginas y úsalo con `<use>`.

## Favicons e instalación

Los iconos PNG se generan con `assets/img/iconos/`: 16, 32, 180 (Apple), 192,
512 y una versión enmascarable para Android. `site.webmanifest` los declara,
así que la web se puede instalar en el móvil y abrirse a pantalla completa.

Si cambias la marca, regenera todos los tamaños a partir del mismo diseño y
mantén el `theme-color` (`#05070d`) igual que `--fondo`.

## Identidad compartida

Los siete proyectos cargan `assets/css/tema-anxvl.css` después de su propia
hoja de estilos, y se identifican con `data-anxvl` en su etiqueta `<html>`:

```html
<html lang="es" data-anxvl="labteca">
...
<link rel="stylesheet" href="css/style.css">
<link rel="stylesheet" href="../../assets/css/tema-anxvl.css">
```

Ese archivo unifica tipografía, fondos, superficies, bordes, tonos de texto,
radios de esquina, anillo de foco, selección y barra de scroll. **No toca el
color de acento de cada aplicación**: Labteca sigue verde azulado, PixelShrink
turquesa, MetaClean violeta y Candy Cosmos con sus caramelos. Es lo que distingue
una aplicación de otra dentro de la misma familia.

Labteca y MetaClean Pro tienen interruptor claro/oscuro. Arrancan en oscuro y
la identidad ANXVL se aplica a ese modo; si el usuario pasa a claro, recupera
la paleta original del proyecto y el interruptor sigue teniendo sentido.

Para añadir un proyecto nuevo a la familia: ponle `data-anxvl="tu-slug"` al
`<html>`, carga el tema y añade su bloque de variables en `tema-anxvl.css`.

## Dependencias externas de los proyectos

Ya no queda ninguna tipografía externa: se quitaron los enlaces a Google Fonts
de Candy Cosmos, Labteca y MetaClean Pro, y los `@import` de Nova Wing y Vault
Zero. Todos usan ahora la fuente del sistema que define `tema-anxvl.css`.

Quedan dos proyectos que necesitan conexión la primera vez, por librerías de
funcionamiento:

| Proyecto      | Qué carga de fuera                    |
|---------------|---------------------------------------|
| ANXVL Code    | Monaco Editor, JSZip                  |
| MetaClean Pro | JSZip, pdf-lib, Font Awesome          |

PixelShrink, Labteca, Candy Cosmos, Nova Wing y Vault Zero no dependen de nada
externo. Para cerrar los dos que faltan hay que descargar esas librerías a la
carpeta del proyecto y cambiar las rutas.

## Atajos y detalles de uso

- Tecla `/` en la página de Proyectos: salta al buscador.
- Botón circular abajo a la derecha: vuelve arriba, aparece al bajar.
- Los enlaces de categoría del pie (`proyectos.html#seguridad`) llegan con el
  filtro ya aplicado.
- El botón del menú en móvil cambia a un aspa cuando está abierto.

## Cambios sobre el código original de los proyectos

Se tocó lo mínimo y todo está comentado en su sitio:

- **Todos**: una línea que carga `volver.js`, otra que carga `tema-anxvl.css`
  y el atributo `data-anxvl` en `<html>`. Se quitaron los enlaces a Google
  Fonts.
- **Vault Zero**: ya no genera una contraseña sola. Antes lo hacía al abrir la
  página, al mover el deslizador, al marcar una casilla y al escribir en el
  campo de exclusiones. Ahora solo genera el botón Generar (o Espacio/Intro), y
  al abrir aparece el aviso «Pulsa Generar para crear una contraseña».
- **Labteca y MetaClean Pro**: arrancan en modo oscuro en vez de seguir la
  preferencia del sistema. El interruptor de cada uno sigue funcionando.
- **Nova Wing y Vault Zero**: se quitó el `@import` de tipografías de sus CSS.
- **PixelShrink**: su hoja propia se llamaba `tema-anxvl.css`, igual que la
  capa compartida del portafolio. Se renombró a `assets/css/base.css` para que
  ese nombre quede reservado a la capa común y no haya dos archivos iguales.
- **MetaClean Pro**: su Content-Security-Policy ya no permite Google Fonts,
  porque ya no las usa.

Archivos eliminados por no formar parte del código que se ejecuta: los
`README.md` de Candy Cosmos, Vault Zero y Labteca, la carpeta `docs/` de
Labteca (guía y capturas) y once `README.md` de marcador dentro de
`labteca/assets/img/`. Esas carpetas de imágenes estaban vacías y solo se
mencionaban en comentarios; si más adelante quieres portadas propias, vuelve a
crearlas. El `LICENSE` de Labteca se mantuvo: es un documento legal, no un
archivo sobrante.

## Nota

Las miniaturas son gráficos generados, no capturas reales. Cuando tengas
capturas de cada proyecto, sustituye los `.svg` de `assets/img/proyectos/` por
tus imágenes (16:10, 1280×800) y cambia la ruta en `datos-proyectos.js`.

Las tarjetas solo dicen qué es cada proyecto y para qué sirve. No se muestran
lenguajes ni herramientas: eso queda en el código, no en la web.

Las descripciones salen del título y la meta descripción de cada proyecto. Si
quieres cambiarlas, están en `datos-proyectos.js`.
