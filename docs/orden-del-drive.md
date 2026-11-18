# Orden del Drive de un cliente

Convención única para todas las cuentas. Todo cliente nuevo se ordena así (a mano, o con el
plan de orden que propone `/nuevo-cliente`), y `descargar-assets.ps1` depende de esta forma para
que `clientes/<cliente>/assets/` quede siempre igual.

## 1. Estructura del Drive

```
<Nombre del cliente>/                       ← carpeta raíz (su URL va en perfil.md)
├── 01 Brief y manual/                      brief de marca, manual de marca, plan de contenido
├── 02 Identidad visual/                    logos, paleta, tipografías
│   ├── logo/
│   └── plantillas-canva/                   links o exports de las 3 plantillas maestras
├── 03 Fotos/
│   └── <categoría>/<tema>/                 ver sección 2
├── 04 Videos/
│   └── <categoría>/<tema>/                 ver sección 2
├── 05 Otros/                               catálogos, listas de precios, contratos, etc.
└── 06 Agente/                              la crea y mantiene la agencia (ver sección 7); no se edita a mano
```

- Las 6 carpetas de primer nivel llevan prefijo numérico para que Drive las ordene siempre igual.
  El script tolera mayúsculas, tildes y que falte el número (`Fotos`, `03-fotos`, `03 Fotos`).
- Nada suelto en la raíz salvo accesos directos o documentos de Google que aún no se clasificaron.

## 2. Fotos y videos: categoría → tema

Máximo **3 niveles** bajo `03 Fotos` / `04 Videos`: `<categoría>/<tema>/archivo`.

**Categorías de fotos** (usar solo estas; si ninguna sirve, `varios`):

| Categoría | Qué va | Subcarpeta `<tema>` |
|---|---|---|
| `trabajos` | obras, proyectos o casos terminados | una por trabajo: `AAAA-MM nombre-del-trabajo` |
| `producto` | productos, materiales, muestras, catálogo en foto | una por línea o familia |
| `equipo` | personas del equipo, retratos | opcional |
| `local` | fachada, taller, showroom, oficina | opcional |
| `eventos` | ferias, inauguraciones, capacitaciones | una por evento: `AAAA-MM nombre` |
| `varios` | lo que no encaja en lo anterior | no usar subcarpetas |

**Categorías de videos:**

| Categoría | Qué va |
|---|---|
| `crudos` | material sin editar (es lo que toma `/editar-video` y `/crear-reel`) |
| `proceso` | trabajo en curso, detrás de escena |
| `testimonios` | clientes o equipo hablando a cámara |
| `varios` | el resto |

**Antes/después**: van dentro del mismo `<tema>` del trabajo, con `antes` / `despues` en el nombre
del archivo.

## 3. Nombres de archivo

`AAAA-MM-DD descripción corta.ext` — por ejemplo `2026-03-12 living-pulido-final.jpg`.

- La fecha es la de la toma. Si no se conoce, `AAAA-MM`.
- Los nombres de cámara (`IMG_4021.jpg`) se aceptan, pero cuanto más descriptivo, mejor lo
  encuentra el agente al elegir una foto para una pieza.
- No hace falta cuidar tildes ni espacios: el script los normaliza al bajar.

## 4. Cómo queda en local

`descargar-assets.ps1` replica el árbol con nombres normalizados (minúsculas, sin tildes, guiones):

| Drive | Local (`clientes/<cliente>/assets/`) |
|---|---|
| `03 Fotos/trabajos/2026-03 Obra Ñandú/Living 1.JPG` | `fotos/trabajos/2026-03-obra-nandu/living-1.jpg` |
| `04 Videos/crudos/Recorrido.mp4` | `videos/crudos/recorrido.mp4` |
| `02 Identidad visual/logo/Logo.png` | `identidad/logo/logo.png` |
| `01 Brief y manual/`, `05 Otros/`, `06 Agente/` | no se descargan (las dos primeras se leen con el conector de Drive; `06 Agente` la escribe la agencia) |

Las demás carpetas de `assets/` (`ia/`, `exports/`, `referencias/`, `edicion/`, `terminados/`)
son locales: no existen en Drive ni se sincronizan.

## 5. Reglas del script

- Solo **lee** Drive. Nunca mueve, renombra ni borra nada allá ni en local.
- Idempotente: `assets/.drive-manifest.json` guarda id de Drive → ruta local + md5. Correrlo de
  nuevo solo baja lo nuevo; si un archivo cambió en Drive, lo actualiza.
- Dos archivos distintos que quedarían con el mismo nombre local: el segundo recibe un sufijo con
  las primeras 6 letras de su id de Drive.
- Solo baja el tipo esperado por sección (`image/*` en fotos, `video/*` en videos). Lo demás se
  omite y se avisa.
- Avisa, sin frenarse, de: archivos sueltos sin categoría, carpetas a más de 3 niveles, carpetas de
  primer nivel no reconocidas y secciones `fotos`/`videos` ausentes.
- Revisión previa: `-DryRun` lista qué descargaría.

```powershell
# el token se toma de GOOGLE_ACCESS_TOKEN o de .claude/.env (ignorado por git)
.\.claude\scripts\descargar-assets.ps1 -Cliente <cliente> -DriveFolderId <id> -DryRun
.\.claude\scripts\descargar-assets.ps1 -Cliente <cliente> -DriveFolderId <id>
```

Con el conector de plataforma (sin CLI), el agente aplica estas mismas reglas usando
`download_file_content` archivo por archivo.

## Token de Drive

El conector de Drive de la plataforma no sirve para bajar 91 archivos (devuelve cada uno en base64
al chat), por eso el script usa la API de Drive con un token propio, de solo lectura:

1. **Rápido (1 hora)**: en https://developers.google.com/oauthplayground elegir el scope
   `https://www.googleapis.com/auth/drive.readonly`, autorizar con la cuenta dueña del Drive,
   *Exchange authorization code for tokens* y copiar el *Access token* a `GOOGLE_ACCESS_TOKEN`
   en `.claude/.env`.
2. **Estable**: crear un cliente OAuth ("Aplicación de escritorio") en Google Cloud Console con la
   API de Drive habilitada, obtener un *refresh token* (el mismo Playground, con tu propio client
   id/secret en su engranaje) y completar `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` y
   `GOOGLE_REFRESH_TOKEN`. El script pide un token nuevo en cada corrida.

## 7. Carpeta `06 Agente`: lo que genera la agencia

Al terminar el alta y cada vez que cambian los datos del cliente, el skill `/sincronizar-drive`
sube a `06 Agente` una copia de lo que vive en `clientes/<cliente>/`, para que el cliente y el
equipo lo vean junto a su material:

```
06 Agente/
├── perfil.md   calendario-editorial.md   aprendizajes.md
├── analisis/   historial/   tendencias-AAAA-MM.md
```

- Es una **copia de lectura**: la fuente de verdad es `clientes/<cliente>/`. Lo que se edite en
  Drive no vuelve.
- **No se sube** `assets/`, `registro-actividad.log`, archivos ocultos ni nada que contenga un
  token o clave.
- Un manifiesto local (`clientes/<cliente>/.drive-agente.json`) recuerda qué archivo de Drive
  corresponde a cada archivo local. Solo se sube lo nuevo o modificado. Como el conector de Drive
  no reemplaza el contenido de un archivo, la versión anterior (y solo la que figura en el
  manifiesto) se envía a la papelera, recuperable, después de subir la nueva.
- El script `descargar-assets.ps1` reconoce la carpeta y nunca la baja.

## 6. Checklist al ordenar un Drive nuevo

1. Crear las 5 carpetas de primer nivel (`06 Agente` la crea la agencia).
2. Mover brief, manual y plan de contenido a `01 Brief y manual`.
3. Logos y paleta a `02 Identidad visual/logo`.
4. Clasificar cada foto en una categoría; las de obras, en una carpeta por trabajo.
5. Videos a `04 Videos/crudos` salvo que sean claramente de otra categoría.
6. Catálogos y documentos sueltos a `05 Otros`.
7. Correr `-DryRun` y revisar los avisos antes de descargar.
