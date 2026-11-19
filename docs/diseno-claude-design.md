# Diseño con Claude Design (código) y kit de marca por cliente

El diseñador produce las piezas gráficas con **Claude Design como primera opción**: cada pieza es un
HTML que usa el kit de marca del cliente, se controla automáticamente, se renderiza a PNG y se
itera desde Postagent hasta llegar al resultado esperado. **Canva sigue disponible** como alternativa.

## Elegir el motor

El primero que aplique:

1. Lo que pida el usuario en ese pedido («con Canva», «en Claude Design»).
2. El campo **`Motor de diseño`** del `perfil.md` del cliente (`claude-design` o `canva`).
3. Por defecto, **Claude Design**.

El motor usado queda registrado en el `.plan.json` (`diseno.motor`).

Al dar de alta un cliente, `/nuevo-cliente` (sección C) ofrece todas las opciones para lo que falte: el kit
de Claude Design, las 3 plantillas maestras de Canva, Claude Design importado a Canva, o dejarlo para
más tarde. Se pueden combinar (por ejemplo, kit de Claude Design y plantillas de Canva).

## Dónde vive cada cosa

```
herramientas/marca/                 el motor (igual para todos los clientes)
├── marca.mjs                       CLI: init, build, nueva, iterar, listar, lint, render, exportar
├── lib/marca.mjs                   la lógica (la usa también Postagent)
└── base/                           base.css + plantillas (feed-cifra, feed-foto, feed-lista, historia, carrusel)

clientes/<cliente>/
├── marca/                          el kit de marca del cliente
│   ├── marca.json                  colores, tipografías, logo y reglas de voz
│   ├── marca.css                   generado desde marca.json (no se edita)
│   ├── logo/  fuentes/             archivos del cliente
└── diseno/<AAAA-MM-DD>-<slug>/     una carpeta por pieza
    ├── v1.html  v1.png  v2.html …  versiones; nunca se pisan
    ├── notas.md                    historial de cambios pedidos
    └── aprobada.json               versión aprobada (la deja Postagent o el CLI)
```

Las piezas aprobadas se copian a `assets/exports/`, que es lo que toman `/crear-post` y el
publicador de Instagram.

## `marca.json`

```json
{
  "nombre": "Cliente",
  "tokens": {
    "colores": { "primario": "#1f4fd8", "secundario": "#0b1633", "acento": "#f5a524",
                 "fondo": "#ffffff", "texto": "#0b1633", "superficie": "#f3f5fa",
                 "fondoOscuro": "#0b1633", "textoOscuro": "#ffffff" },
    "fuentes": { "titulo": { "familia": "Georgia", "archivo": null },
                 "texto":  { "familia": "Segoe UI", "archivo": "segoe.ttf" } },
    "radio": 16
  },
  "logo": { "principal": "logo/logo.png", "inverso": null, "texto": "Cliente" },
  "reglas": { "sinEmojis": true, "sinExclamaciones": false, "prohibidas": ["garantizado"], "logoObligatorio": true }
}
```

- Los colores son hex de 6 dígitos; las fuentes con `archivo` se cargan desde `marca/fuentes/`.
- `reglas.prohibidas` sale de las **restricciones** del perfil. Lo que el brief y el manual no
  digan no se inventa: se marca como supuesto.
- Las piezas usan solo `var(--c-*)` y `var(--f-*)`; el lint avisa de colores y fuentes fuera de marca.

## Comandos

```bash
node herramientas/marca/marca.mjs init <cliente>                  # crea el kit
node herramientas/marca/marca.mjs plantillas                      # plantillas base
node herramientas/marca/marca.mjs nueva <cliente> <slug> carrusel # crea diseno/<fecha>-<slug>/v1.html
node herramientas/marca/marca.mjs lint <cliente> <pieza>          # errores (código 1) y avisos
node herramientas/marca/marca.mjs render <cliente> <pieza>        # PNG junto al HTML (--escala 2 para retina)
node herramientas/marca/marca.mjs iterar <cliente> <pieza>        # copia la última versión a vN+1
node herramientas/marca/marca.mjs exportar <cliente> <pieza> [vN] # copia los PNG a assets/exports/
```

El render usa **Edge o Chrome** ya instalados (sin dependencias nuevas). Se puede forzar otro
navegador con la variable `MARCA_NAVEGADOR`. En los HTML, `{{MARCA}}`, `{{BASE}}` y `{{ASSETS}}`
apuntan al kit del cliente, a la base y a `assets/` del cliente (por ejemplo
`{{ASSETS}}/fotos/trabajos/obra/foto.jpg`).

## Control de marca (lint)

Errores: no hay `.piece`, emojis, exclamaciones (si la marca las prohíbe), palabras o frases
prohibidas, texto de relleno (Lorem, XXX, TODO, `{{…}}`). Avisos: colores fuera de la paleta,
negro puro, tipografías fuera de la marca y falta de logo.

## Flujo

1. `/disenar <cliente> <#|slug|"tema"> [canva]` (o `/crear-post`, que lo invoca): resuelve la ficha
   del calendario, asegura el kit de marca, crea `v1.html` desde una plantilla, lo controla, lo
   renderiza, **mira el PNG** y presenta la pieza.
2. En **Postagent → cliente → Diseños** se ve la pieza (PNG), se compara con la versión anterior y se
   escribe qué cambiar. **Pedir cambios** abre el Agente y ejecuta `/iterar-diseno`, que crea la
   versión siguiente sin pisar la anterior, la controla y la renderiza. Se repite hasta que quede
   como se espera.
3. **Aprobar vN** (en Postagent, o el agente con `exportar`) copia los PNG a `assets/exports/` y deja
   `aprobada.json` y una línea en `registro-actividad.log`.
4. `/crear-post` genera el `.plan.json` con `diseno.motor`, `html_fuente` y `version`. La
   publicación sigue requiriendo su propio OK por pieza.

## Reglas

- La aprobación de un diseño no es la aprobación de la publicación.
- Nunca se pisan versiones ni se copia material de la marca de un cliente a otro.
- Foto real del cliente primero; imagen IA solo en los casos excepcionales de `CLAUDE.md`.
- El manual, los logos y los textos de una marca de terceros no se versionan en este repositorio.
